import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc, auth: { getUser: mocks.getUser } } }));
vi.mock('./authStore', () => ({ default: { getState: () => ({ user: { id: 'student-a' } }) } }));
import useCodeStore from './codeStore';

let writes;
let finishFirst;

beforeEach(() => {
  mocks.rpc.mockReset();
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

describe('공동 작품 본문·이력 원자 저장', () => {
  const input = { id: 'code-1', projectId: 'project-1', title: '공동 작품', expectedCode: 'loaded', code: 'edited' };
  it('편집 시작 코드와 저장 이력을 RPC 하나로 전달한다', async () => {
    useCodeStore.setState({ fetchSavedCodes: vi.fn().mockResolvedValue() });
    mocks.rpc.mockResolvedValue({ data: { saved: { id: 'code-1', code: 'edited' }, revision: { id: 'revision-1' } }, error: null });
    const result = await useCodeStore.getState().saveCode(input);
    expect(result.data._revision.id).toBe('revision-1');
    expect(mocks.rpc).toHaveBeenCalledWith('vpylab_save_project_code', expect.objectContaining({ p_expected_code: 'loaded', p_code: 'edited', p_project_id: 'project-1' }));
    expect(writes).toEqual([]);
  });
  it('다른 친구가 먼저 저장하면 성공으로 표시하거나 REST 덮어쓰기로 우회하지 않는다', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PT409', message: 'saved_code_conflict' } });
    const result = await useCodeStore.getState().saveCode(input);
    expect(result.error.code).toBe('saved_code_conflict');
    expect(result.error.message).toContain('편집기에 그대로');
    expect(result.data).toBeNull();
    expect(writes).toEqual([]);
  });
  it('편집 시작 코드가 없으면 기준 없이 저장하지 않는다', async () => {
    const result = await useCodeStore.getState().saveCode({ ...input, expectedCode: undefined });
    expect(result.error.code).toBe('save_context_missing');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('이력 생성의 트랜잭션 오류를 저장 성공으로 바꾸지 않는다', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '23514', message: 'revision source rejected' } });
    const result = await useCodeStore.getState().saveCode(input);
    expect(result.error.code).toBe('23514');
    expect(result.data).toBeNull();
    expect(writes).toEqual([]);
  });

  it('응답을 잃은 저장의 재시도는 같은 요청 ID와 최초 비교 기준을 유지한다', async () => {
    useCodeStore.setState({ fetchSavedCodes: vi.fn().mockResolvedValue() });
    mocks.rpc.mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({ data: { saved: { id: 'code-1', code: 'edited' }, revision: { id: 'saved-revision' }, already_saved: true }, error: null });
    const unknown = await useCodeStore.getState().saveCode(input);
    expect(unknown.error.code).toBe('save_result_unknown');
    const result = await useCodeStore.getState().saveCode({ ...input, expectedCode: 'edited' });
    expect(result.data._revision.id).toBe('saved-revision');
    expect(mocks.rpc.mock.calls[1][1].p_client_save_id).toBe(mocks.rpc.mock.calls[0][1].p_client_save_id);
    expect(mocks.rpc.mock.calls[1][1].p_expected_code).toBe('loaded');
  });

  it('DB 직렬화 실패를 친구의 코드 변경으로 잘못 분류하지 않는다', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'serialization failure' } });
    const result = await useCodeStore.getState().saveCode(input);
    expect(result.error.code).toBe('40001');
    expect(result.error.message).not.toContain('친구');
  });
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
