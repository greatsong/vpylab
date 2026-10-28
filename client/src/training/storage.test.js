import { describe, expect, it } from 'vitest';
import { loadTraining, newTraining, persistTraining, TRAINING_KEY } from './storage.js';

function storage(value) { let saved = value; return { getItem: () => saved, setItem: (key, next) => { expect(key).toBe(TRAINING_KEY); saved = next; } }; }
describe('교사 연수의 기기 저장', () => {
  it('서로 다른 실습의 수정 코드·예상·관찰·수업안을 다시 열어도 보존한다', () => {
    const cache = storage(null), state = newTraining();
    state.activities['first-light'] = { code: 'radius = 0.9', prediction: '크기가 커진다', observation: '위치는 같다', previousCode: 'radius = 0.6' };
    state.activities['math-proportion'] = { code: 'k = 2', observation: 'y가 두 배' };
    state.plan.goal = '비례상수와 좌표의 관계를 설명한다'; state.completed = [1, 2];
    expect(persistTraining(cache, state)).toBe(true);
    expect(loadTraining(cache)).toEqual(state);
  });
  it('손상되거나 다른 형식인 저장본을 성공한 기록으로 표시하지 않는다', () => {
    for (const value of ['{invalid', '{"schema":0}', '{"schema":1,"activities":[]}']) expect(loadTraining(storage(value))).toBeNull();
    expect(loadTraining({ getItem() { throw new Error('blocked'); } })).toBeNull();
  });
  it('저장 용량 부족을 실패로 돌려 사용자가 내보내기로 보존할 수 있게 한다', () => {
    expect(persistTraining({ setItem() { throw new Error('quota'); } }, newTraining())).toBe(false);
  });
  it('지원하지 않는 AI 정책과 잘못된 차시 값은 불러오지 않는다', () => {
    const state = loadTraining(storage(JSON.stringify({ schema: 1, activities: {}, aiPolicy: 'automatic', completed: [1, -1, 7, '2'], plan: {} })));
    expect(state.aiPolicy).toBe('disabled'); expect(state.completed).toEqual([1]);
  });
  it('6차시와 두 3차시의 같은 실습 기록을 서로 덮어쓰지 않는다', () => {
    const values = new Map(), cache = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    const courses = [{ id: 'intro-6', sessionCount: 6 }, { id: 'three-ai', sessionCount: 3, aiPolicy: 'optional', policyLocked: true }, { id: 'three-no-ai', sessionCount: 3, aiPolicy: 'disabled', policyLocked: true }];
    for (const course of courses) {
      const state = newTraining(course); state.activities['first-light'] = { prediction: course.id }; state.completed = [1, 3, 6];
      expect(persistTraining(cache, state, course)).toBe(true);
    }
    for (const course of courses) {
      const state = loadTraining(cache, course);
      expect(state.activities['first-light'].prediction).toBe(course.id);
      expect(state.completed).toEqual(course.sessionCount === 3 ? [1, 3] : [1, 3, 6]);
      expect(state.aiPolicy).toBe(course.aiPolicy || 'disabled');
    }
  });
  it('같은 예제를 재사용해도 차시별 AI 응답·검증·판단을 구별하여 보존한다', () => {
    const course = { id: 'three-ai', sessionCount: 3, policyLocked: true, aiPolicy: 'optional' };
    const values = new Map(), cache = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    const state = newTraining(course);
    state.activities['2:math-proportion'] = { activityId: 'math-proportion', sessionNumber: 2, aiResponse: '첫 설명', aiVerification: 'x=4에서 y=8', aiDecision: 'partly-adopted' };
    state.activities['3:math-proportion'] = { activityId: 'math-proportion', sessionNumber: 3, aiResponse: '동료 질문 검토', aiVerification: '원점도 비교함', aiDecision: 'rejected' };
    state.aiPolicy = 'disabled'; persistTraining(cache, state, course);
    const restored = loadTraining(cache, course);
    expect(restored.activities).toEqual(state.activities);
    expect(restored.aiPolicy).toBe('optional');
  });
});
