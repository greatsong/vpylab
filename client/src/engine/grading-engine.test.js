/**
 * 채점 엔진 단위 테스트
 * A등급: 정적 assertion 검사
 * B등급: 궤적 유사도 비교
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { gradeA, gradeB, gradeCodeChecks, gradeNotes, gradeRun, gradeMission, stripPythonComments } from './grading-engine';
import {
  registerObject, updateObject, clearRegistry, registerNote, registerSound,
} from './object-registry';

// performance.now() 모킹 (jsdom에서 안정적 테스트)
let mockTime = 0;
const originalPerfNow = globalThis.performance.now;
beforeEach(() => {
  mockTime = 0;
  globalThis.performance.now = () => mockTime++;
});

afterAll(() => {
  globalThis.performance.now = originalPerfNow;
});

describe('gradeA — 정적 assertion 검사', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('sphere의 pos.x가 조건을 만족하면 통과', () => {
    registerObject('sphere', { pos: [5, 0, 0], color: [1, 0, 0] });

    const result = gradeA([
      { type: 'sphere', property: 'pos.x', operator: '>', value: 3 },
    ]);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('sphere의 pos.x가 조건 미달이면 실패', () => {
    registerObject('sphere', { pos: [1, 0, 0], color: [1, 0, 0] });

    const result = gradeA([
      { type: 'sphere', property: 'pos.x', operator: '>', value: 3 },
    ]);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('여러 assertion 중 일부만 통과하면 부분 점수', () => {
    registerObject('sphere', { pos: [5, 2, 0], color: [1, 0, 0] });

    const result = gradeA([
      { type: 'sphere', property: 'pos.x', operator: '>', value: 3 },
      { type: 'sphere', property: 'pos.y', operator: '>', value: 5 },
    ]);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(50);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[1].passed).toBe(false);
  });

  it('== 연산자로 정확한 값 비교', () => {
    registerObject('sphere', { pos: [3, 0, 0] });

    const result = gradeA([
      { type: 'sphere', property: 'pos.x', operator: '==', value: 3 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('approx 연산자로 근사값 비교 (tolerance 10%)', () => {
    registerObject('sphere', { pos: [3.05, 0, 0] });

    const result = gradeA([
      { type: 'sphere', property: 'pos.x', operator: 'approx', value: 3 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('approx 연산자는 음수 기대값도 절댓값 기준 허용 오차로 비교한다', () => {
    registerObject('sphere', { pos: [-2.5, 0, 0] });

    const result = gradeA([
      { type: 'sphere', property: 'pos.x', operator: 'approx', value: -2.5 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('== with tolerance로 근사값 비교', () => {
    registerObject('sphere', { pos: [3.001, 0, 0] });

    const result = gradeA([
      { type: 'sphere', property: 'pos.x', operator: '==', value: 3, tolerance: 0.01 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('color.r 속성 접근', () => {
    registerObject('sphere', { pos: [0, 0, 0], color: [1, 0, 0] });

    const result = gradeA([
      { type: 'sphere', property: 'color.r', operator: '==', value: 1 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('존재하지 않는 객체 타입은 실패', () => {
    registerObject('sphere', { pos: [0, 0, 0] });

    const result = gradeA([
      { type: 'box', property: 'pos.x', operator: '==', value: 0 },
    ]);

    expect(result.passed).toBe(false);
    expect(result.results[0].message).toContain('찾을 수 없습니다');
  });

  it('존재하지 않는 속성은 실패', () => {
    registerObject('sphere', { pos: [0, 0, 0] });

    const result = gradeA([
      { type: 'sphere', property: 'nonexistent', operator: '==', value: 0 },
    ]);

    expect(result.passed).toBe(false);
    expect(result.results[0].message).toContain('속성을 찾을 수 없습니다');
  });

  it('빈 assertion 배열은 score 0', () => {
    const result = gradeA([]);
    expect(result.score).toBe(0);
  });

  it('index로 특정 객체 선택', () => {
    registerObject('sphere', { pos: [1, 0, 0] });
    registerObject('sphere', { pos: [5, 0, 0] });

    const result = gradeA([
      { type: 'sphere', property: 'pos.x', operator: '>', value: 3, index: 1 },
    ]);

    expect(result.passed).toBe(true);
  });
});

describe('gradeB — 궤적 유사도 비교', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('궤적 데이터가 부족하면 실패', () => {
    const id = registerObject('sphere', { pos: [0, 0, 0] });

    const result = gradeB(id, [[0, 0, 0], [1, 0, 0]], 0.9);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.message).toContain('궤적 데이터가 부족');
  });

  it('완벽히 일치하는 궤적은 100% 유사도', () => {
    const id = registerObject('sphere', { pos: [0, 0, 0] });

    // 직선 궤적 생성
    const trajectory = [];
    for (let i = 0; i <= 10; i++) {
      const pos = [i * 0.1, 0, 0];
      updateObject(id, { pos }, i);
      trajectory.push(pos);
    }

    const result = gradeB(id, trajectory, 0.9);

    expect(result.passed).toBe(true);
    expect(result.similarity).toBeGreaterThanOrEqual(0.99);
    expect(result.grade).toBe('B');
  });

  it('유사한 궤적은 높은 유사도', () => {
    const id = registerObject('sphere', { pos: [0, 0, 0] });

    const reference = [];
    for (let i = 0; i <= 20; i++) {
      const x = i * 0.1;
      reference.push([x, 0, 0]);
      // 약간 다른 궤적 (미세한 오차)
      updateObject(id, { pos: [x + 0.01, 0, 0] }, i);
    }

    const result = gradeB(id, reference, 0.9);

    expect(result.passed).toBe(true);
    expect(result.similarity).toBeGreaterThanOrEqual(0.9);
  });

  it('완전히 다른 궤적은 낮은 유사도', () => {
    const id = registerObject('sphere', { pos: [0, 0, 0] });

    // 학생: x축 이동
    for (let i = 0; i <= 10; i++) {
      updateObject(id, { pos: [i, 0, 0] }, i);
    }

    // 모범: y축 이동 (완전히 다른 방향)
    const reference = [];
    for (let i = 0; i <= 10; i++) {
      reference.push([0, i, 0]);
    }

    const result = gradeB(id, reference, 0.9);

    expect(result.passed).toBe(false);
    expect(result.similarity).toBeLessThan(0.9);
  });

  it('존재하지 않는 객체는 빈 궤적 반환', () => {
    const result = gradeB('nonexistent', [[0, 0, 0], [1, 0, 0]], 0.9);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('threshold를 커스텀으로 설정 가능', () => {
    const id = registerObject('sphere', { pos: [0, 0, 0] });

    const reference = [];
    for (let i = 0; i <= 10; i++) {
      const x = i * 0.5;
      reference.push([x, 0, 0]);
      updateObject(id, { pos: [x + 0.3, 0, 0] }, i);
    }

    // 낮은 threshold로 통과
    const resultLow = gradeB(id, reference, 0.5);
    expect(resultLow.passed).toBe(true);
  });
});

describe('gradeCodeChecks — 코드 패턴 검사', () => {
  it('주석에 있는 함수명은 채점에 포함하지 않는다', () => {
    const result = gradeCodeChecks(`
# 효과음("coin")
효과음("jump")
# sfx("powerup")
`, [
      { pattern: '효과음\\s*\\(|sfx\\s*\\(', minCount: 2, message: '효과음()을 2종류 이상 사용하세요' },
    ]);

    expect(result.passed).toBe(false);
    expect(result.results[0].message).toContain('현재 1개');
  });

  it('문자열 내부의 #은 주석으로 자르지 않는다', () => {
    const stripped = stripPythonComments('음표("솔#4", 0.4)  # 샵 음');

    expect(stripped).toContain('솔#4');
    expect(stripped).not.toContain('샵 음');
  });

  it('검사 조건이 모두 맞으면 통과한다', () => {
    const result = gradeCodeChecks(`
효과음("jump")
sfx("coin")
`, [
      { pattern: '효과음\\s*\\(|sfx\\s*\\(', minCount: 2, message: '효과음()을 2종류 이상 사용하세요' },
    ]);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });
});

describe('gradeRun — 실행형 미션 검사', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('실행 결과 객체가 없으면 실패한다', () => {
    const result = gradeRun([]);

    expect(result.passed).toBe(false);
    expect(result.message).toContain('먼저 실행');
  });

  it('객체가 있고 assertion이 없으면 통과한다', () => {
    registerObject('sphere', { pos: [0, 0, 0] });

    const result = gradeRun([]);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('assertion이 있으면 실행 결과 조건까지 확인한다', () => {
    registerObject('sphere', { pos: [0, 1, 0] });

    const result = gradeRun([
      { type: 'sphere', property: 'pos.y', operator: '>', value: 0 },
    ]);

    expect(result.passed).toBe(true);
    expect(result.grade).toBe('run');
  });
});

describe('gradeA — 확장 DSL (종류·개수·범위·소리)', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('count 속성으로 객체 종류별 개수를 비교한다', () => {
    registerObject('box', { pos: [0, 0, 0], size: [1, 2, 3] });
    registerObject('box', { pos: [1, 0, 0], size: [1, 1, 1] });
    registerObject('cylinder', { pos: [0, 0, 0], radius: 0.5, axis: [3, 0, 0] });

    const result = gradeA([
      { type: 'box', property: 'count', operator: '>=', value: 2 },
      { type: 'cylinder', property: 'count', operator: '==', value: 1 },
      { type: ['box', 'cylinder'], property: 'count', operator: '==', value: 3 },
      { type: '*', property: 'count', operator: '==', value: 3 },
      { type: 'sphere', property: 'count', operator: '==', value: 0 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('box size.y, cylinder axis.mag, 색 벡터 비교를 지원한다', () => {
    registerObject('box', { pos: [0, 0, 0], size: [2, 0.1, 3], color: [0.5, 0.5, 0.5] });
    registerObject('cylinder', { pos: [0, 0, 0], radius: 0.5, axis: [0, 4, 0] });

    const result = gradeA([
      { type: 'box', property: 'size.y', operator: '<', value: 0.5 },
      { type: 'cylinder', property: 'axis.mag', operator: 'approx', value: 4 },
      { type: 'box', property: 'color', operator: '==', value: [0.5, 0.5, 0.5], tolerance: 0.01 },
      { type: 'box', property: 'color', operator: '!=', value: [1, 0, 0], tolerance: 0.01 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('match: any/all/count/distinct로 여러 객체를 한 번에 검사한다', () => {
    registerObject('sphere', { pos: [0, 1, 0], radius: 0.2, emissive: true });
    registerObject('sphere', { pos: [0, 2, 0], radius: 0.2, emissive: false });
    registerObject('sphere', { pos: [0, -1, 0], radius: 0.4, emissive: true });

    const result = gradeA([
      { type: 'sphere', property: 'pos.y', operator: '>', value: 1.5, match: 'any' },
      { type: 'sphere', property: 'radius', operator: '>', value: 0.1, match: 'all' },
      { type: 'sphere', property: 'emissive', operator: '==', value: true, match: 'count', minCount: 2 },
      { type: 'sphere', property: 'radius', operator: '==', value: 2, match: 'distinct' },
    ]);
    expect(result.passed).toBe(true);

    const failing = gradeA([
      { type: 'sphere', property: 'pos.y', operator: '>', value: 0, match: 'all' },
      { type: 'sphere', property: 'emissive', operator: '==', value: true, match: 'count', minCount: 3 },
    ]);
    expect(failing.passed).toBe(false);
    expect(failing.score).toBe(0);
  });

  it('in / not_in / between / exists 연산자', () => {
    registerObject('sphere', { pos: [0.3, 0, 0], color: [1, 0, 0], texture: 'wood' });

    const result = gradeA([
      { type: 'sphere', property: 'color', operator: 'in', value: [[0, 0, 1], [1, 0, 0]], tolerance: 0.01 },
      { type: 'sphere', property: 'color', operator: 'not_in', value: [[0, 0, 1]], tolerance: 0.01 },
      { type: 'sphere', property: 'pos.x', operator: 'between', value: [0, 1] },
      { type: 'sphere', property: 'texture', operator: 'exists' },
      { type: 'sphere', property: 'texture', operator: '==', value: 'wood' },
    ]);

    expect(result.passed).toBe(true);
  });

  it('anyOf 묶음은 하나만 만족하면 통과한다', () => {
    registerObject('sphere', { pos: [0, 0, 0], color: [1, 1, 0] });

    const result = gradeA([
      {
        anyOf: [
          { type: 'sphere', property: 'count', operator: '>=', value: 2 },
          { type: 'sphere', property: 'color', operator: '!=', value: [1, 0, 0], tolerance: 0.01 },
        ],
        message: '구를 추가하거나 색을 바꾸기',
      },
    ]);

    expect(result.passed).toBe(true);
    expect(result.results[0].message).toContain('구를 추가하거나 색을 바꾸기');

    const failing = gradeA([
      { anyOf: [
        { type: 'sphere', property: 'count', operator: '>=', value: 2 },
        { type: 'sphere', property: 'color', operator: '!=', value: [1, 1, 0], tolerance: 0.01 },
      ] },
    ]);
    expect(failing.passed).toBe(false);
  });

  it('historyLength와 history.max/min으로 움직임을 검사한다', () => {
    const id = registerObject('sphere', { pos: [0, 0, 0] });
    for (let i = 1; i <= 5; i++) updateObject(id, { pos: [i, i * i, 0] }, i);

    const result = gradeA([
      { type: 'sphere', property: 'historyLength', operator: '>=', value: 5 },
      { type: 'sphere', property: 'history.max.pos.y', operator: '==', value: 25 },
      { type: 'sphere', property: 'history.min.pos.x', operator: '==', value: 1 },
    ]);

    expect(result.passed).toBe(true);
    expect(gradeA([{ type: 'sphere', property: 'history.max.pos.y', operator: '>', value: 30 }]).passed).toBe(false);
  });

  it('note/sfx/bgm 종류로 재생된 소리를 검사한다', () => {
    registerNote('C4', 0.2, 'triangle');
    registerNote('E4', 0.4, 'square');
    registerNote('C4+E4+G4', 1.0, 'sine');
    registerSound('sfx', 'jump');
    registerSound('sfx', 'coin');
    registerSound('bgm', 'peaceful');

    const result = gradeA([
      { type: 'note', property: 'count', operator: '>=', value: 3 },
      { type: 'note', property: 'name', operator: '==', value: 'E4', index: 1 },
      { type: 'note', property: 'duration', operator: '==', value: 3, match: 'distinct' },
      { type: 'note', property: 'type', operator: '!=', value: 'triangle', match: 'any' },
      { type: 'note', property: 'name', operator: '==', value: 'C4+E4+G4', index: 2 },
      { type: 'sfx', property: 'count', operator: '==', value: 2 },
      { type: 'sfx', property: 'name', operator: 'not_in', value: ['jump'], match: 'any' },
      { type: 'bgm', property: 'name', operator: '==', value: 'peaceful', match: 'any' },
    ]);

    expect(result.passed).toBe(true);
  });

  it('객체가 없으면 count 0으로 비교하고, 속성 검사는 실패한다', () => {
    const result = gradeA([
      { type: 'box', property: 'count', operator: '==', value: 0 },
      { type: 'box', property: 'size.x', operator: '>', value: 0, match: 'any' },
    ]);

    expect(result.results[0].passed).toBe(true);
    expect(result.results[1].passed).toBe(false);
    expect(result.results[1].message).toContain('찾을 수 없습니다');
  });
});

describe('gradeNotes — 음표 시퀀스 비교', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('재생 기록이 없으면 실패한다', () => {
    const result = gradeNotes(['C4', 'E4']);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('재생되지 않았습니다');
  });

  it('순서까지 같아야 통과한다', () => {
    registerNote('c4', 0.3);
    registerNote('E4', 0.3);
    registerNote('G4', 0.3);

    expect(gradeNotes(['C4', 'E4', 'G4']).passed).toBe(true);
    const wrong = gradeNotes(['C4', 'G4', 'E4']);
    expect(wrong.passed).toBe(false);
    expect(wrong.matched).toBe(1);
  });
});

describe('gradeMission — 미션 데이터 기준 채점 조합', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('run 미션: 조건식과 codeChecks를 함께 검사한다', () => {
    registerObject('sphere', { pos: [0, 0, 0] });
    const mission = {
      gradeType: 'run',
      assertions: [{ type: 'sphere', property: 'count', operator: '>=', value: 1 }],
      codeChecks: [{ pattern: 'rate\\s*\\(', minCount: 1, message: 'rate() 사용' }],
    };

    expect(gradeMission(mission, 'sphere()\n').passed).toBe(false);
    expect(gradeMission(mission, 'sphere()\nrate(30)\n').passed).toBe(true);
  });

  it('run 미션에 expectedNotes가 있으면 멜로디도 확인한다', () => {
    registerObject('sphere', { pos: [0, 0, 0] });
    registerNote('C4', 0.2);
    const mission = {
      gradeType: 'run',
      assertions: [{ type: 'sphere', property: 'count', operator: '>=', value: 1 }],
      expectedNotes: ['C4', 'E4'],
    };

    const result = gradeMission(mission, '');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('멜로디');
  });

  it('A 미션은 gradeA 결과를 그대로 돌려준다', () => {
    registerObject('sphere', { pos: [5, 0, 0] });
    const mission = { gradeType: 'A', assertions: [{ type: 'sphere', property: 'pos.x', operator: '>', value: 3 }] };
    const result = gradeMission(mission, '');
    expect(result.grade).toBe('A');
    expect(result.passed).toBe(true);
  });
});
