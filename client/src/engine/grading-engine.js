/**
 * VPyLab — 채점 엔진
 *
 * - A    : 객체 스냅샷 조건식 검사 (gradeA) — 종류·개수·속성 범위
 * - B    : 궤적 유사도 비교 (gradeB)
 * - notes: 재생된 음표 시퀀스 비교 (gradeNotes)
 * - code : 코드 패턴 검사 (gradeCodeChecks)
 * - run  : 실행 확인 + 선택적 조건식 (gradeRun)
 * - gradeMission: 미션 데이터(gradeType, assertions, codeChecks, expectedNotes)를 읽어 위 채점기를 조합
 *
 * AI 루브릭 채점(과거 계획의 "C등급")은 구현되어 있지 않다. AI 기능은 커밋 ba6eacf에서 철수했다.
 *
 * ── 조건식(assertion) DSL ──────────────────────────────────────────
 *   {
 *     type: 'sphere' | 'box' | ... | 'note' | 'sfx' | 'bgm' | '*' | ['box', 'sphere'],
 *                       // 검사할 객체 종류. 'note'는 재생된 음표(name, duration, type),
 *                       // 'sfx'·'bgm'은 재생된 효과음·배경음악(name), '*'는 모든 3D 객체
 *     property: 'pos.x' | 'size.y' | 'axis.mag' | 'color.b' | 'radius' | 'emissive' | 'opacity'
 *             | 'texture' | 'text' | 'historyLength' | 'history.max.pos.y' | 'count' | ...,
 *                       // 'count'는 해당 종류의 객체 개수, 'historyLength'는 pos가 바뀐 횟수(움직임),
 *                       // 'history.max.pos.y'/'history.min.pos.x'는 움직인 동안의 최대·최소 좌표
 *     operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'approx' | 'in' | 'not_in' | 'between' | 'exists',
 *     value, tolerance,
 *     index: 0,         // match가 없을 때 검사할 객체 순번 (기본 첫 번째)
 *     match: 'any' | 'all' | 'count' | 'distinct',
 *                       // any: 하나라도 만족, all: 모두 만족,
 *                       // count: 만족하는 객체가 minCount개 이상,
 *                       // distinct: 속성값의 종류 수를 operator/value와 비교
 *     minCount: 1,
 *     message: { ko, en } | string,   // 결과에 보여줄 설명 (선택)
 *   }
 *   { anyOf: [assertion, ...], message }   // 하나만 만족해도 통과하는 묶음
 */

import { getSnapshot, getTrajectory, getNoteHistory, getSoundHistory } from './object-registry';

const COMPONENT_INDEX = { x: 0, y: 1, z: 2, r: 0, g: 1, b: 2 };

function pickText(value, lang = 'ko') {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.ko ?? value.en ?? '';
}

function formatValue(value) {
  if (Array.isArray(value)) return `(${value.map(formatValue).join(', ')})`;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (value === undefined) return '없음';
  return String(value);
}

function typeLabel(type) {
  if (type === '*') return '객체';
  if (type === 'note') return '음표';
  if (type === 'sfx') return '효과음';
  if (type === 'bgm') return '배경음악';
  if (Array.isArray(type)) return type.join('/');
  return type;
}

/**
 * 조건식이 가리키는 객체 목록
 * @param {object[]} snapshot - 3D 객체 스냅샷
 * @param {object[]} notes - 음표 기록을 객체 모양으로 바꾼 목록
 */
function selectObjects(type, snapshot, notes) {
  if (type === 'note') return notes;
  if (type === 'sfx' || type === 'bgm') {
    return getSoundHistory(type).map((s, i) => ({
      id: `${type}_${i}`, type, props: { name: s.name }, historyLength: 0,
    }));
  }
  if (type === '*' || type === undefined) return snapshot;
  const types = Array.isArray(type) ? type : [type];
  return snapshot.filter(o => types.includes(o.type));
}

/**
 * 속성 값 추출 (중첩 속성 지원)
 * 'pos.x' → props.pos[0], 'color.r' → props.color[0], 'axis.mag' → |props.axis|
 * 'historyLength' → 객체의 pos 갱신 횟수
 */
export function getPropertyValue(obj, path) {
  if (!obj || !path) return undefined;
  if (path === 'historyLength') return obj.historyLength ?? 0;
  if (path.startsWith('history.')) return getHistoryAggregate(obj, path);

  const parts = path.split('.');
  let value = obj.props;
  for (const part of parts) {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) {
      if (COMPONENT_INDEX[part] !== undefined) return value[COMPONENT_INDEX[part]];
      if (part === 'mag') return Math.hypot(...value.map(Number));
      if (part === 'length') return value.length;
    }
    value = value[part];
  }
  return value;
}

/**
 * 궤적 집계: 'history.max.pos.y' → 기록된 pos.y의 최댓값, 'history.min.pos.x' → 최솟값
 */
function getHistoryAggregate(obj, path) {
  const [, agg, field, component] = path.split('.');
  const history = obj.history || [];
  if (history.length === 0 || field !== 'pos') return undefined;
  const idx = COMPONENT_INDEX[component];
  const values = history
    .map(h => (idx === undefined ? Math.hypot(...h.pos) : h.pos[idx]))
    .filter(v => Number.isFinite(v));
  if (values.length === 0) return undefined;
  if (agg === 'max') return Math.max(...values);
  if (agg === 'min') return Math.min(...values);
  return undefined;
}

function nearlyEqual(a, b, tolerance) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => nearlyEqual(v, b[i], tolerance));
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= (tolerance || 1e-6);
  }
  return a === b;
}

/**
 * 비교 연산
 */
function compare(actual, operator, expected, tolerance = 0) {
  switch (operator) {
    case '==':
    case '===':
      return nearlyEqual(actual, expected, tolerance);
    case '!=':
      return !nearlyEqual(actual, expected, tolerance);
    case '>':
      return actual > expected;
    case '>=':
      return actual >= expected;
    case '<':
      return actual < expected;
    case '<=':
      return actual <= expected;
    case 'approx':
      return Math.abs(actual - expected) <= (tolerance || Math.abs(expected) * 0.1);
    case 'in':
      return Array.isArray(expected) && expected.some(candidate => nearlyEqual(actual, candidate, tolerance));
    case 'not_in':
      return Array.isArray(expected) && !expected.some(candidate => nearlyEqual(actual, candidate, tolerance));
    case 'between':
      return Array.isArray(expected) && actual >= expected[0] && actual <= expected[1];
    case 'exists':
      return actual !== undefined && actual !== null;
    default:
      return false;
  }
}

function describeAssertion(assertion, lang) {
  const custom = pickText(assertion.message, lang);
  if (custom) return custom;
  const label = typeLabel(assertion.type);
  if (assertion.property === 'count') {
    return `${label} 개수 ${assertion.operator} ${formatValue(assertion.value)}`;
  }
  const subject = assertion.match === 'distinct'
    ? `${label}.${assertion.property} 종류 수`
    : `${label}.${assertion.property}`;
  if (assertion.operator === 'exists') return `${subject} 지정`;
  const quantifier = assertion.match === 'count'
    ? ` (${assertion.minCount ?? 1}개 이상)`
    : assertion.match === 'all' ? ' (모두)' : '';
  return `${subject} ${assertion.operator} ${formatValue(assertion.value)}${quantifier}`;
}

/**
 * 조건식 하나를 평가
 */
function evaluateAssertion(assertion, snapshot, notes, lang) {
  const label = describeAssertion(assertion, lang);
  const objects = selectObjects(assertion.type, snapshot, notes);
  const { property, operator, value, tolerance } = assertion;

  const done = (passed, actual) => ({
    assertion,
    passed,
    actual,
    expected: value,
    message: passed
      ? `✅ ${label}`
      : `❌ ${label} (현재: ${formatValue(actual)})`,
  });

  if (property === 'count') {
    return done(compare(objects.length, operator, value, tolerance), objects.length);
  }

  if (objects.length === 0) {
    return {
      assertion,
      passed: false,
      actual: undefined,
      expected: value,
      message: `❌ ${label} — ${typeLabel(assertion.type)} 객체를 찾을 수 없습니다`,
    };
  }

  const values = objects.map(obj => getPropertyValue(obj, property));

  if (assertion.match === 'distinct') {
    const distinct = new Set(values.filter(v => v !== undefined).map(v => JSON.stringify(v)));
    return done(compare(distinct.size, operator, value, tolerance), distinct.size);
  }

  const checks = values.map(v => v !== undefined && compare(v, operator, value, tolerance));

  if (assertion.match === 'any') {
    const idx = checks.indexOf(true);
    return done(idx >= 0, idx >= 0 ? values[idx] : values[0]);
  }

  if (assertion.match === 'all') {
    const idx = checks.indexOf(false);
    return done(idx < 0, idx < 0 ? values[0] : values[idx]);
  }

  if (assertion.match === 'count') {
    const matched = checks.filter(Boolean).length;
    return done(matched >= (assertion.minCount ?? 1), matched);
  }

  // 기본: index로 지정한 객체 하나 (기존 CT 미션 호환)
  const obj = objects[assertion.index ?? 0];
  if (!obj) {
    return { assertion, passed: false, expected: value, message: `❌ ${label} — 객체 인덱스 초과` };
  }
  const actual = getPropertyValue(obj, property);
  if (actual === undefined) {
    return {
      assertion,
      passed: false,
      actual,
      expected: value,
      message: `❌ ${label} — ${property} 속성을 찾을 수 없습니다`,
    };
  }
  return done(compare(actual, operator, value, tolerance), actual);
}

/**
 * anyOf 묶음 평가 — 하나만 만족하면 통과
 */
function evaluateGroup(group, snapshot, notes, lang) {
  const inner = group.anyOf.map(a => evaluateAssertion(a, snapshot, notes, lang));
  const passed = inner.some(r => r.passed);
  const custom = pickText(group.message, lang);
  const label = custom || inner.map(r => describeAssertion(r.assertion, lang)).join(' 또는 ');
  return {
    assertion: group,
    passed,
    results: inner,
    message: passed ? `✅ ${label}` : `❌ ${label}`,
  };
}

/**
 * A등급 채점: 객체 스냅샷 조건식 검사
 *
 * @param {object[]} assertions - 조건식 배열 (DSL은 파일 머리 주석 참조)
 * @param {{ lang?: string }} [options]
 * @returns {{ grade: 'A', passed: boolean, score: number, results: object[] }}
 */
export function gradeA(assertions, options = {}) {
  if (!assertions || assertions.length === 0) {
    return {
      grade: 'A',
      passed: false,
      score: 0,
      results: [],
      message: '채점 기준이 설정되지 않았습니다.',
    };
  }

  const lang = options.lang || 'ko';
  const snapshot = getSnapshot();
  const notes = getNoteHistory().map((n, i) => ({
    id: `note_${i}`,
    type: 'note',
    props: { name: n.name, duration: n.duration, type: n.type },
    historyLength: 0,
  }));

  const results = assertions.map(assertion => (
    Array.isArray(assertion.anyOf)
      ? evaluateGroup(assertion, snapshot, notes, lang)
      : evaluateAssertion(assertion, snapshot, notes, lang)
  ));

  const passedCount = results.filter(r => r.passed).length;
  const score = Math.round((passedCount / assertions.length) * 100);

  return {
    grade: 'A',
    passed: passedCount === assertions.length,
    score,
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
 * 코드 검사형 채점: 주석을 제외한 실제 코드에서 패턴 사용 횟수 확인
 *
 * @param {string} code - 학생 Python 코드
 * @param {{pattern: string, minCount?: number, message: string}[]} checks
 * @returns {{grade: string, passed: boolean, score: number, results: object[], message: string}}
 */
export function gradeCodeChecks(code, checks = []) {
  if (!checks || checks.length === 0) {
    return {
      grade: 'code',
      passed: false,
      score: 0,
      results: [],
      message: '채점 기준이 설정되지 않았습니다.',
    };
  }

  const codeWithoutComments = stripPythonComments(code || '');
  const results = [];

  for (const check of checks) {
    let count = 0;

    try {
      const matches = codeWithoutComments.match(new RegExp(check.pattern, 'g'));
      count = matches ? matches.length : 0;
    } catch {
      results.push({
        passed: false,
        message: `❌ 잘못된 채점 패턴입니다: ${check.message}`,
      });
      continue;
    }

    const passed = count >= (check.minCount || 1);
    results.push({
      passed,
      message: passed
        ? `✅ ${check.message} (${count}개 사용)`
        : `❌ ${check.message} (현재 ${count}개)`,
    });
  }

  const passedAll = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;

  return {
    grade: 'code',
    passed: passedAll,
    score: passedAll ? 100 : Math.round((passedCount / results.length) * 100),
    results,
    message: passedAll ? '✅ 코드 검사 통과!' : '코드를 더 작성해 보세요.',
  };
}

/**
 * 실행형 미션 채점: 실제 객체 생성 후, 선택적 assertion으로 결과 확인
 */
export function gradeRun(assertions = [], options = {}) {
  const snapshot = getSnapshot();

  if (snapshot.length === 0 && getNoteHistory().length === 0 && getSoundHistory().length === 0) {
    return {
      grade: 'run',
      passed: false,
      score: 0,
      message: '코드를 먼저 실행한 뒤 채점하세요.',
    };
  }

  if (assertions.length > 0) {
    const result = gradeA(assertions, options);
    return {
      ...result,
      grade: 'run',
      message: result.passed
        ? '✅ 실행 결과 확인 완료!'
        : '실행은 되었지만 목표 조건을 아직 만족하지 못했습니다.',
    };
  }

  return {
    grade: 'run',
    passed: true,
    score: 100,
    message: '✅ 실행 완료!',
  };
}

/**
 * 결과 둘을 합친다 — 앞 결과가 통과했을 때만 뒤 결과를 추가 검증으로 반영
 */
function mergeIfFailed(result, extra, message) {
  if (!result.passed || extra.passed) return result;
  return {
    ...result,
    passed: false,
    score: Math.round((result.score + extra.score) / 2),
    results: [...(result.results || []), ...(extra.results || [{ passed: false, message: extra.message }])],
    message,
  };
}

/**
 * 미션 데이터 기준 채점 — MissionPlay와 교실 Workspace가 함께 사용하는 진입점
 *
 * 레지스트리(getSnapshot/getNoteHistory)는 코드 실행이 끝난 뒤 상태여야 한다.
 *
 * @param {object} mission - { gradeType, assertions, codeChecks, expectedNotes, referenceTrajectory, targetObjectId }
 * @param {string} code - 학생이 실행한 코드
 * @param {{ lang?: string }} [options]
 */
export function gradeMission(mission, code, options = {}) {
  let result;

  switch (mission.gradeType) {
    case 'notes':
      result = gradeNotes(mission.expectedNotes || []);
      break;
    case 'code':
      result = gradeCodeChecks(code, mission.codeChecks || []);
      break;
    case 'run':
      result = gradeRun(mission.assertions || [], options);
      break;
    case 'A':
      result = gradeA(mission.assertions, options);
      break;
    case 'B':
      result = gradeB(mission.targetObjectId || 'obj_1', mission.referenceTrajectory, 0.9);
      break;
    default: {
      // A+B 복합
      const aResult = gradeA(mission.assertions, options);
      if (mission.referenceTrajectory) {
        const bResult = gradeB(mission.targetObjectId || 'obj_1', mission.referenceTrajectory, 0.8);
        result = {
          grade: 'A+B',
          passed: aResult.passed && bResult.passed,
          score: Math.round((aResult.score + bResult.score) / 2),
          aResult,
          bResult,
          results: [...aResult.results],
        };
      } else {
        result = aResult;
      }
    }
  }

  // 실행형 미션에 expectedNotes가 있으면 멜로디도 확인
  if (mission.gradeType !== 'notes' && mission.expectedNotes?.length > 0) {
    result = mergeIfFailed(result, gradeNotes(mission.expectedNotes), '멜로디를 다시 확인해 보세요.');
  }

  // codeChecks 병행 검사: A, run 등에서도 codeChecks가 있으면 추가 검증
  if (mission.gradeType !== 'code' && mission.codeChecks?.length > 0) {
    result = mergeIfFailed(result, gradeCodeChecks(code, mission.codeChecks), '코드를 더 완성해 보세요.');
  }

  return result;
}

/**
 * Python 한 줄에서 문자열 바깥의 주석만 제거
 */
export function stripPythonComments(code) {
  const lines = code.split('\n');
  return lines.map(stripCommentFromLine).join('\n');
}

function stripCommentFromLine(line) {
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if ((inSingle || inDouble) && char === '\\') {
      escaped = true;
      continue;
    }

    if (!inDouble && char === "'") {
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && char === '"') {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && char === '#') {
      return line.slice(0, i);
    }
  }

  return line;
}
