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
});
