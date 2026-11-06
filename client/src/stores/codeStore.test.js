import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser } } }));
vi.mock('./authStore', () => ({ default: { getState: () => ({ user: { id: 'student-a' } }) } }));
import useCodeStore from './codeStore';

let writes;
let finishFirst;

beforeEach(() => {
  vi.useFakeTimers();
  writes = [];
  const first = new Promise(resolve => { finishFirst = () => resolve({ error: null, count: 1 }); });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'student-a' } } });
  mocks.from.mockImplementation(() => ({
    update: ({ code }) => {
      writes.push(code);
      const result = writes.length === 1 ? first : Promise.resolve({ error: null, count: 1 });
      const chain = { eq: () => chain, then: result.then.bind(result) };
      return chain;
    },
  }));
  useCodeStore.setState({ currentCodeId: 'code-1', _saveTimer: null, _autoSaveInFlight: false,
    _autoSavePendingArgs: null, _autoSaveTask: null, _autoSavePaused: false, _autoSaveLatestArgs: null, saveStatus: 'idle' });
});

afterEach(() => { useCodeStore.getState().clearAutoSave(); vi.useRealTimers(); });

describe('자동저장과 코드 복원 경합', () => {
  it('느린 A 저장 중 B 대기 후 C를 입력하면 가장 최신 C를 저장한다', async () => {
    const store = useCodeStore.getState();
    store.autoSave('A');
    await vi.advanceTimersByTimeAsync(2000);
    store.autoSave('B');
    await vi.advanceTimersByTimeAsync(2000);
    store.autoSave('C');
    finishFirst();
    await vi.advanceTimersByTimeAsync(2000);
    expect(writes).toEqual(['A', 'C']);
    expect(useCodeStore.getState()._saveTimer).toBeNull();
  });

  it('복원은 진행 중인 저장 완료를 기다리고 대기 중인 이전 코드는 버린다', async () => {
    const store = useCodeStore.getState();
    store.autoSave('A');
    await vi.advanceTimersByTimeAsync(2000);
    store.autoSave('B');
    let paused = false;
    const pause = store.pauseAutoSave().then(resume => { paused = true; return resume; });
    await vi.advanceTimersByTimeAsync(4000);
    expect(paused).toBe(false);
    expect(writes).toEqual(['A']);
    finishFirst();
    const resume = await pause;
    expect(useCodeStore.getState().currentCodeId).toBe('code-1');
    // 빈 코드/기본 코드로 복원해 새 자동저장 effect가 실행되지 않아도 B는 살아나지 않습니다.
    resume(true);
    await vi.advanceTimersByTimeAsync(4000);
    expect(writes).toEqual(['A']);
  });

  it('복원 실패 시 취소했던 편집본의 예약을 다시 살린다', async () => {
    const store = useCodeStore.getState();
    store.autoSave('unsaved');
    const resume = await store.pauseAutoSave();
    await vi.advanceTimersByTimeAsync(4000);
    expect(writes).toEqual([]);
    resume(false);
    finishFirst();
    await vi.advanceTimersByTimeAsync(2000);
    expect(writes).toEqual(['unsaved']);
  });

  it('복원 직전 예약이 없었다면 과거 편집본을 새로 예약하지 않는다', async () => {
    useCodeStore.setState({ _autoSaveLatestArgs: ['previous-personal-code', {}] });
    const resume = await useCodeStore.getState().pauseAutoSave();
    resume(false);
    await vi.advanceTimersByTimeAsync(4000);
    expect(writes).toEqual([]);
  });

  it('복원 대기 중 화면을 떠나 타이머를 정리했다면 실패 후 재예약하지 않는다', async () => {
    const store = useCodeStore.getState();
    store.autoSave('old-editor');
    const resume = await store.pauseAutoSave();
    store.clearAutoSave();
    resume(false);
    await vi.advanceTimersByTimeAsync(4000);
    expect(writes).toEqual([]);
  });

  it('자동저장 응답이 돌아오지 않으면 복원을 중단하고 대기를 해제한다', async () => {
    const store = useCodeStore.getState();
    store.autoSave('A');
    await vi.advanceTimersByTimeAsync(2000);
    const result = expect(store.pauseAutoSave()).rejects.toThrow('자동저장이 아직 끝나지');
    await vi.advanceTimersByTimeAsync(22000);
    await result;
    expect(useCodeStore.getState()._autoSavePaused).toBe(false);
    finishFirst();
    await vi.advanceTimersByTimeAsync(0);
  });
});
