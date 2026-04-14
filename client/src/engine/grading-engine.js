/**
 * VPyLab — 채점 엔진
 * A등급: 정적 변수 검사 (99%+ 정확도)
 * B등급: 궤적 비교 (90-99%)
 * C등급: AI 루브릭 (70-90%) — Step 7에서 구현
 */

import { getSnapshot, getTrajectory, getAllObjects, getNoteHistory } from './object-registry';

/**
 * A등급 채점: 정적 assertion 검사
 * 객체의 현재 속성이 조건에 맞는지 확인
 *
 * @param {object[]} assertions - 채점 조건 배열
 *   예: [{ type: 'sphere', property: 'pos.x', operator: '>', value: 3 }]
 * @returns {{ passed: boolean, score: number, results: object[] }}
 */
export function gradeA(assertions) {
  if (!assertions || assertions.length === 0) {
    return {
      grade: 'A',
      passed: false,
      score: 0,
      results: [],
      message: '채점 기준이 설정되지 않았습니다.',
    };
  }

  const snapshot = getSnapshot();
  const results = [];

  for (const assertion of assertions) {
    const objects = snapshot.filter(o => o.type === assertion.type);

    if (objects.length === 0) {
      results.push({
        assertion,
        passed: false,
        message: `${assertion.type} 객체를 찾을 수 없습니다`,
      });
      continue;
    }

    // 대상 객체 (인덱스 지정 가능, 기본 0번)
    const obj = objects[assertion.index ?? 0];
    if (!obj) {
      results.push({ assertion, passed: false, message: '객체 인덱스 초과' });
      continue;
    }

    // 중첩 속성 접근: 'pos.x' → obj.props.pos[0]
    const actualValue = getPropertyValue(obj.props, assertion.property);

    if (actualValue === undefined) {
      results.push({
        assertion,
        passed: false,
        message: `${assertion.property} 속성을 찾을 수 없습니다`,
      });
      continue;
    }

    const passed = compare(actualValue, assertion.operator, assertion.value, assertion.tolerance);

    results.push({
      assertion,
      passed,
      actual: actualValue,
      expected: assertion.value,
      message: passed
        ? `✅ ${assertion.property} ${assertion.operator} ${assertion.value}`
        : `❌ ${assertion.property}: ${actualValue} (기대값: ${assertion.operator} ${assertion.value})`,
    });
  }

  const passedCount = results.filter(r => r.passed).length;
  const score = assertions.length > 0 ? (passedCount / assertions.length) * 100 : 0;

  return {
    grade: 'A',
    passed: passedCount === assertions.length,
    score: Math.round(score),
    results,
  };
}

/**
 * B등급 채점: 궤적 유사도 비교
 *
 * @param {string} objectId - 추적할 객체 ID
 * @param {number[][]} referenceTrajectory - 모범 궤적 [[x,y,z], ...]
 * @param {number} threshold - 합격 유사도 (0~1, 기본 0.9)
 * @returns {{ passed: boolean, score: number, similarity: number }}
 */
export function gradeB(objectId, referenceTrajectory, threshold = 0.9) {
  const { positions } = getTrajectory(objectId);

  if (positions.length < 2) {
    return {
      grade: 'B',
      passed: false,
      score: 0,
      similarity: 0,
      message: '궤적 데이터가 부족합니다. 코드를 실행해주세요.',
    };
  }

  // 궤적 길이 정규화 (리샘플링)
  const studentNorm = normalizeTrajectory(positions, 100);
  const refNorm = normalizeTrajectory(referenceTrajectory, 100);

  // 유클리드 거리 기반 유사도
  let totalDist = 0;
  for (let i = 0; i < 100; i++) {
    const dx = studentNorm[i][0] - refNorm[i][0];
    const dy = studentNorm[i][1] - refNorm[i][1];
    const dz = studentNorm[i][2] - refNorm[i][2];
    totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  const avgDist = totalDist / 100;
  // 유사도: 거리가 0이면 1, 거리가 클수록 0에 가까움
  const similarity = Math.max(0, 1 - avgDist / 10);
  const score = Math.round(similarity * 100);
  const passed = similarity >= threshold;

  return {
    grade: 'B',
    passed,
    score,
    similarity: Math.round(similarity * 100) / 100,
    message: passed
      ? `✅ 궤적 유사도 ${score}% (기준: ${threshold * 100}%)`
      : `❌ 궤적 유사도 ${score}% (기준: ${threshold * 100}% 미달)`,
  };
}

/**
 * 궤적을 N개 포인트로 리샘플링
 */
function normalizeTrajectory(points, n) {
  if (points.length === 0) return Array(n).fill([0, 0, 0]);
  if (points.length === 1) return Array(n).fill(points[0]);

  const result = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const idx = t * (points.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, points.length - 1);
    const frac = idx - lo;

    result.push([
      points[lo][0] * (1 - frac) + points[hi][0] * frac,
      points[lo][1] * (1 - frac) + points[hi][1] * frac,
      points[lo][2] * (1 - frac) + points[hi][2] * frac,
    ]);
  }
  return result;
}

/**
 * 속성 값 추출 (중첩 속성 지원)
 * 'pos.x' → pos[0], 'pos.y' → pos[1], 'color.r' → color[0]
 */
function getPropertyValue(props, path) {
  const AXIS_MAP = { x: 0, y: 1, z: 2, r: 0, g: 1, b: 2 };
  const parts = path.split('.');

  let value = props;
  for (const part of parts) {
    if (value === undefined) return undefined;
    if (AXIS_MAP[part] !== undefined && Array.isArray(value)) {
      return value[AXIS_MAP[part]];
    }
    value = value[part];
  }
  return value;
}

/**
 * N등급 채점: 노트 시퀀스 비교 (음악 미션용)
 *
 * @param {string[]} expectedNotes - 정답 노트 시퀀스 (예: ['G4','G4','A4','A4','G4','G4','E4'])
 * @returns {{ passed: boolean, score: number, matched: number, total: number, message: string }}
 */
export function gradeNotes(expectedNotes) {
  const played = getNoteHistory();

  if (played.length === 0) {
    return {
      grade: 'N',
      passed: false,
      score: 0,
      matched: 0,
      total: expectedNotes.length,
      message: '음표가 재생되지 않았습니다. 코드를 실행한 뒤 채점하세요.',
    };
  }

  // 재생된 노트 이름만 추출 (대문자 정규화)
  const playedNames = played.map(n => n.name.toUpperCase());
  const expectedUpper = expectedNotes.map(n => n.toUpperCase());

  // 순서대로 매칭 (재생된 노트가 정답 시퀀스를 포함하는지)
  let matched = 0;
  for (let i = 0; i < expectedUpper.length; i++) {
    if (i < playedNames.length && playedNames[i] === expectedUpper[i]) {
      matched++;
    }
  }

  const score = Math.round((matched / expectedUpper.length) * 100);
  const passed = matched === expectedUpper.length && playedNames.length >= expectedUpper.length;

  return {
    grade: 'N',
    passed,
    score,
    matched,
    total: expectedUpper.length,
    played: playedNames.length,
    message: passed
      ? `✅ 멜로디 완성! ${matched}/${expectedUpper.length} 음표 일치`
      : `❌ ${matched}/${expectedUpper.length} 음표 일치 (${expectedUpper.length - matched}개 부족)`,
  };
}

/**
 * 비교 연산
 */
function compare(actual, operator, expected, tolerance = 0) {
  switch (operator) {
    case '==':
    case '===':
      return tolerance > 0
        ? Math.abs(actual - expected) <= tolerance
        : actual === expected;
    case '!=':
      return actual !== expected;
    case '>':
      return actual > expected;
    case '>=':
      return actual >= expected;
    case '<':
      return actual < expected;
    case '<=':
      return actual <= expected;
    case 'approx':
      return Math.abs(actual - expected) <= (tolerance || expected * 0.1);
    default:
      return false;
  }
}
