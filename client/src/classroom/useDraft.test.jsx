import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useDraft from './useDraft';
import { draftKey, readDraft, recoveryDrafts, writeDraft } from './draft-journal';
import { request } from './api';

vi.mock('./api', () => ({ request: vi.fn() }));
const scope = ['student-a', 'project-a', 'test-client'];
const checkpoint = { code: '시작 코드', version: 0 };
const draft = (code, clientSequence = 1, baseVersion = 0) => ({ code, clientSequence, baseVersion });
const deferred = () => { let resolve; let reject; const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; }); return { promise, resolve, reject }; };
const renderDraft = (overrides = {}) => renderHook((props) => useDraft(props.userId, props.projectId, props.checkpoint, props.options), { initialProps: { userId: scope[0], projectId: scope[1], checkpoint, ...overrides } });
const settle = async () => { await act(async () => {}); };
const save = async () => { await act(async () => { vi.advanceTimersByTime(700); }); };
const puts = () => request.mock.calls.filter(([, options]) => options?.method === 'PUT');

describe('실제 개인 초안 hook의 보존과 요청 수명', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const name of ['localStorage', 'sessionStorage']) {
      const entries = new Map();
      vi.stubGlobal(name, { get length() { return entries.size; }, key: (index) => [...entries.keys()][index] ?? null, getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) });
    }
    sessionStorage.setItem('vpylab:v2:client', scope[2]); request.mockReset();
    request.mockImplementation(async (_, options) => options?.method === 'PUT' ? { draft: options.body } : { draft: null, checkpoint });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('초기 응답 전에는 이전 코드 대신 null을 반환한다', async () => {
    const load = deferred(); request.mockReturnValueOnce(load.promise);
    const hook = renderDraft();
    expect(hook.result.current.draft).toBeNull();
    expect(hook.result.current.status).toBe('loading');
    await act(async () => { load.resolve({ draft: null, checkpoint }); });
    expect(hook.result.current.draft.code).toBe('시작 코드');
  });

  it('계정·프로젝트 전환 후 늦은 GET은 새 초안과 저장 범위를 바꾸지 않는다', async () => {
    const oldLoad = deferred(); const newLoad = deferred();
    request.mockReturnValueOnce(oldLoad.promise).mockReturnValueOnce(newLoad.promise);
    const hook = renderDraft();
    hook.rerender({ userId: 'student-b', projectId: 'project-b', checkpoint: { code: '새 수업', version: 3 } });
    expect(hook.result.current.draft).toBeNull();
    await act(async () => { newLoad.resolve({ draft: null, checkpoint: { code: '새 수업', version: 3 } }); });
    await act(async () => { oldLoad.resolve({ draft: draft('이전 학생 비공개', 10), checkpoint }); });
    expect(hook.result.current.draft).toMatchObject({ code: '새 수업', baseVersion: 3 });
    await save();
    expect(puts()).toHaveLength(1);
    expect(puts()[0][0]).toBe('/projects/project-b/drafts');
    expect(puts()[0][1]).toMatchObject({ userId: 'student-b', body: { code: '새 수업' } });
    expect(readDraft(localStorage, ['student-b', 'project-b', scope[2]]).code).toBe('새 수업');
  });

  it('이전 프로젝트의 예약 저장과 완료 응답을 새 프로젝트에 적용하지 않는다', async () => {
    const pendingSave = deferred();
    const hook = renderDraft(); await settle();
    act(() => { hook.result.current.update('이전 프로젝트 수정'); });
    request.mockImplementationOnce(() => pendingSave.promise);
    await save();
    const previousOptions = puts()[0][1];
    request.mockReturnValueOnce(Promise.resolve({ draft: null, checkpoint: { code: '새 프로젝트', version: 4 } }));
    hook.rerender({ userId: scope[0], projectId: 'project-b', checkpoint: { code: '새 프로젝트', version: 4 } });
    expect(previousOptions.signal.aborted).toBe(true);
    await settle();
    await act(async () => { pendingSave.reject(new Error('이전 저장 실패')); });
    expect(hook.result.current.draft.code).toBe('새 프로젝트');
    expect(hook.result.current.error).toBe('');
    expect(readDraft(localStorage, scope).code).toBe('이전 프로젝트 수정');
  });

  it('로딩 중 입력은 늦은 서버 초안으로 덮지 않고 새 순번으로 보존한다', async () => {
    const load = deferred(); request.mockReturnValueOnce(load.promise);
    const hook = renderDraft();
    act(() => { hook.result.current.update('로딩 중 작성한 코드'); });
    expect(readDraft(localStorage, scope).code).toBe('로딩 중 작성한 코드');
    await save(); expect(puts()).toHaveLength(0);
    await act(async () => { load.resolve({ draft: draft('서버의 과거 작업', 30), checkpoint }); });
    expect(hook.result.current.draft).toMatchObject({ code: '로딩 중 작성한 코드', clientSequence: 31 });
    expect(hook.result.current.recoveries.some((entry) => entry.code === '서버의 과거 작업')).toBe(true);
    await save();
    expect(puts().at(-1)[1].body.clientSequence).toBe(31);
  });

  it('같은 clientSequence의 서로 다른 코드를 보존하고 409 없이 보낼 순번을 만든다', async () => {
    writeDraft(localStorage, scope, draft('로컬 작업', 7));
    request.mockReturnValueOnce(Promise.resolve({ draft: draft('서버 작업', 7), checkpoint }));
    const hook = renderDraft(); await settle();
    expect(hook.result.current.draft).toMatchObject({ code: '로컬 작업', clientSequence: 8 });
    expect(recoveryDrafts(localStorage, scope).some((entry) => entry.code === '서버 작업')).toBe(true);
    await save(); expect(puts()[0][1].body.clientSequence).toBe(8);
  });

  it('편집 중 새 입력은 늦은 저장 실패로 offline 상태가 되지 않는다', async () => {
    const pendingSave = deferred(); const hook = renderDraft(); await settle();
    act(() => { hook.result.current.update('첫 입력'); });
    request.mockImplementationOnce(() => pendingSave.promise); await save();
    act(() => { hook.result.current.update('둘째 입력'); });
    await act(async () => { pendingSave.reject(new Error('오래된 요청 실패')); });
    expect(hook.result.current.draft.code).toBe('둘째 입력');
    expect(hook.result.current.status).toBe('local');
    expect(hook.result.current.error).toBe('');
  });

  it('서버 순번 충돌 때 현재 코드를 유지하고 상대 코드를 복구 기록에 남긴다', async () => {
    const hook = renderDraft(); await settle();
    act(() => { hook.result.current.update('내 현재 코드'); });
    request.mockRejectedValueOnce(Object.assign(new Error('순번 충돌'), { code: 'draft_sequence_conflict', draft: draft('상대 창 작업', 50) }));
    await save();
    expect(hook.result.current.draft).toMatchObject({ code: '내 현재 코드', clientSequence: 51 });
    expect(hook.result.current.recoveries.some((entry) => entry.code === '상대 창 작업')).toBe(true);
    await save(); expect(hook.result.current.status).toBe('saved');
  });

  it('관찰자는 개인 초안을 노출하거나 쓰지 않고 팀 기준만 읽는다', async () => {
    writeDraft(localStorage, scope, draft('이전 편집 권한의 개인 코드', 8));
    const hook = renderDraft({ options: { readOnly: true } }); await settle();
    expect(hook.result.current.draft.code).toBe('시작 코드');
    act(() => { hook.result.current.update('관찰자 수정'); hook.result.current.replace('복원', 4); hook.result.current.advanceBase(4); });
    await save();
    expect(request).not.toHaveBeenCalled();
    expect(hook.result.current.draft.code).toBe('시작 코드');
    expect(readDraft(localStorage, scope).code).toBe('이전 편집 권한의 개인 코드');
  });

  it('초안 교체는 빈 코드까지 복구 기록에 보존하고 기준 변경은 현재 입력을 유지한다', async () => {
    const hook = renderDraft(); await settle();
    act(() => { hook.result.current.update(''); });
    act(() => { hook.result.current.replace('복원한 코드', 3); });
    expect(hook.result.current.recoveries.some((entry) => entry.code === '')).toBe(true);
    act(() => { hook.result.current.update('저장 응답 대기 중 더 쓴 코드'); hook.result.current.advanceBase(4); });
    expect(hook.result.current.draft).toMatchObject({ code: '저장 응답 대기 중 더 쓴 코드', baseVersion: 4 });
  });

  it('로컬 저장 실패를 알리되 서버 보존과 실제 입력은 계속 유지한다', async () => {
    const hook = renderDraft(); await settle();
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('저장 공간 부족'); });
    act(() => { hook.result.current.update('서버에 보존할 코드'); });
    expect(hook.result.current.storageError).toContain('파일로 내려받아');
    await save();
    expect(hook.result.current.status).toBe('saved');
    expect(hook.result.current.draft.code).toBe('서버에 보존할 코드');
    expect(localStorage.getItem(draftKey(...scope))).not.toContain('서버에 보존할 코드');
    setItem.mockRestore();
  });

  it('로컬 복구기록을 쓸 수 없으면 서버의 다른 코드를 덮지 않고 재시도를 기다린다', async () => {
    writeDraft(localStorage, scope, draft('내 보존 코드', 5));
    request.mockReturnValueOnce(Promise.resolve({ draft: draft('서버의 다른 코드', 5), checkpoint }));
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('저장 공간 부족'); });
    const hook = renderDraft(); await settle();
    expect(hook.result.current.draft.code).toBe('내 보존 코드');
    expect(hook.result.current.storageError).toContain('파일로 내려받아');
    await save(); expect(puts()).toHaveLength(0);
    act(() => { hook.result.current.update('차단 상태에서 계속 입력한 코드'); });
    expect(hook.result.current.status).toBe('offline');
    await save(); expect(puts()).toHaveLength(0);
    expect(hook.result.current.recoveries.some((entry) => entry.code === '서버의 다른 코드')).toBe(true);
    expect(readDraft(localStorage, scope).code).toBe('내 보존 코드');
    write.mockRestore();
    act(() => { hook.result.current.retry(); });
    await save();
    expect(hook.result.current.status).toBe('saved');
    expect(recoveryDrafts(localStorage, scope).some((entry) => entry.code === '서버의 다른 코드')).toBe(true);
  });

  it('같은 편집 창 식별자를 가진 다른 탭의 로컬 코드를 먼저 보존한다', async () => {
    const hook = renderDraft(); await settle();
    writeDraft(localStorage, scope, draft('복제된 탭에서 더 쓴 코드', 40));
    act(() => { hook.result.current.update('지금 탭의 새 입력'); });
    expect(hook.result.current.draft).toMatchObject({ code: '지금 탭의 새 입력', clientSequence: 41 });
    expect(hook.result.current.recoveries.some((entry) => entry.code === '복제된 탭에서 더 쓴 코드')).toBe(true);
  });

  it('권한이 관찰자로 바뀌면 예약 저장을 취소하고 개인 코드를 숨긴다', async () => {
    const hook = renderDraft(); await settle();
    act(() => { hook.result.current.update('편집자 시절 개인 코드'); });
    hook.rerender({ userId: scope[0], projectId: scope[1], checkpoint: { code: '관찰할 팀 최신', version: 6 }, options: { readOnly: true } });
    expect(hook.result.current.draft).toBeNull();
    await settle(); await save();
    expect(puts()).toHaveLength(0);
    expect(hook.result.current.draft.code).toBe('관찰할 팀 최신');
    expect(readDraft(localStorage, scope).code).toBe('편집자 시절 개인 코드');
  });

  it('화면 이탈 시 debounce를 취소하면서 마지막 타이핑은 기기에 남긴다', async () => {
    const hook = renderDraft(); await settle();
    act(() => { hook.result.current.update('화면을 나가기 직전 입력'); });
    hook.unmount(); await save();
    expect(puts()).toHaveLength(0);
    expect(readDraft(localStorage, scope).code).toBe('화면을 나가기 직전 입력');
  });

  it('서버 조회가 멈춰도 8초 뒤 기기 초안을 열고 늦은 응답은 무시한다', async () => {
    writeDraft(localStorage, scope, draft('네트워크 장애 전 보존 코드', 3));
    const load = deferred(); request.mockReturnValueOnce(load.promise);
    const hook = renderDraft();
    await act(async () => { vi.advanceTimersByTime(8_000); });
    expect(hook.result.current.draft.code).toBe('네트워크 장애 전 보존 코드');
    expect(hook.result.current.status).toBe('offline');
    act(() => { hook.result.current.update('장애 중 새로 작성한 코드'); });
    await act(async () => { load.resolve({ draft: draft('늦은 서버 코드', 20), checkpoint }); });
    expect(hook.result.current.draft.code).toBe('장애 중 새로 작성한 코드');
  });

  it('다음 날 새 창에서 서버가 끊겨도 같은 학생의 이전 창 초안을 새 창으로 복구한다', async () => {
    const oldScope = [scope[0], scope[1], 'closed-yesterday'];
    writeDraft(localStorage, oldScope, { ...draft('어제 마지막으로 작성한 코드', 25), updatedAt: '2026-10-27T15:00:00Z' });
    request.mockRejectedValueOnce(new Error('서버 오프라인'));
    const hook = renderDraft(); await settle();
    expect(hook.result.current.draft).toMatchObject({ code: '어제 마지막으로 작성한 코드', clientId: scope[2], recoveredFromClientId: 'closed-yesterday', clientSequence: 0 });
    expect(readDraft(localStorage, oldScope)).toMatchObject({ code: '어제 마지막으로 작성한 코드', clientSequence: 25 });
    expect(readDraft(localStorage, scope).code).toBe('어제 마지막으로 작성한 코드');
    await save();
    expect(puts()[0][1].body).toMatchObject({ code: '어제 마지막으로 작성한 코드', clientId: scope[2] });
  });

  it('새 창 복구는 같은 프로젝트의 다른 학생이나 다른 프로젝트의 코드를 읽지 않는다', async () => {
    writeDraft(localStorage, ['student-b', scope[1], 'closed-tab'], { ...draft('학생 나의 비공개 코드', 50), updatedAt: '2026-10-28T15:00:00Z' });
    writeDraft(localStorage, [scope[0], 'project-b', 'closed-tab'], { ...draft('다른 프로젝트 개인 코드', 50), updatedAt: '2026-10-28T15:00:00Z' });
    request.mockRejectedValueOnce(new Error('서버 오프라인'));
    const hook = renderDraft(); await settle();
    expect(hook.result.current.draft.code).toBe('시작 코드');
    expect(hook.result.current.recoveries).toEqual([]);
  });

  it('서버가 이전 창 초안을 돌려주면 원본을 변경하지 않고 현재 창 식별자로 저장한다', async () => {
    const original = { ...draft('서버에 남아 있는 이전 창 코드', 60), userId: scope[0], projectId: scope[1], clientId: 'server-old-tab', updatedAt: '2026-10-27T15:00:00Z' };
    request.mockReturnValueOnce(Promise.resolve({ draft: original, checkpoint, recoveredFromClientId: 'server-old-tab' }));
    const hook = renderDraft(); await settle();
    expect(hook.result.current.draft).toMatchObject({ code: original.code, clientId: scope[2], clientSequence: 0, recoveredFromClientId: 'server-old-tab' });
    await save();
    expect(puts()[0][1].body).toMatchObject({ code: original.code, clientId: scope[2], clientSequence: 0 });
    expect(original).toMatchObject({ clientId: 'server-old-tab', clientSequence: 60 });
  });

  it('서로 다른 창의 순번 대신 마지막 작성 시각으로 복구하고 다른 코드도 보존한다', async () => {
    const oldScope = [scope[0], scope[1], 'local-closed-tab'];
    writeDraft(localStorage, oldScope, { ...draft('더 최근의 미전송 로컬 코드', 2), updatedAt: '2026-10-28T15:00:00Z' });
    request.mockReturnValueOnce(Promise.resolve({ draft: { ...draft('순번만 높은 다른 창 코드', 999), clientId: 'server-closed-tab', updatedAt: '2026-10-27T15:00:00Z' }, checkpoint, recoveredFromClientId: 'server-closed-tab' }));
    const hook = renderDraft(); await settle();
    expect(hook.result.current.draft.code).toBe('더 최근의 미전송 로컬 코드');
    expect(hook.result.current.recoveries.some((entry) => entry.code === '순번만 높은 다른 창 코드')).toBe(true);
    expect(readDraft(localStorage, oldScope).clientSequence).toBe(2);
  });

  it('같은 창의 서버 초안보다 최근인 다른 로컬 창을 복구할 때 서버 순번을 앞당긴다', async () => {
    writeDraft(localStorage, [scope[0], scope[1], 'recent-closed-tab'], { ...draft('다른 창의 최신 로컬 작업', 1), updatedAt: '2026-10-28T15:00:00Z' });
    request.mockReturnValueOnce(Promise.resolve({ draft: { ...draft('현재 창의 오래된 서버 작업', 50), clientId: scope[2], updatedAt: '2026-10-27T15:00:00Z' }, checkpoint }));
    const hook = renderDraft(); await settle();
    expect(hook.result.current.draft).toMatchObject({ code: '다른 창의 최신 로컬 작업', clientId: scope[2], clientSequence: 51 });
    expect(hook.result.current.recoveries.some((entry) => entry.code === '현재 창의 오래된 서버 작업')).toBe(true);
  });

  it('다른 창 검색은 최초 로드에서만 하며 이후 입력은 정확한 자기 키만 조회한다', async () => {
    writeDraft(localStorage, [scope[0], scope[1], 'old-tab'], { ...draft('이전 창 코드'), updatedAt: '2026-10-28T15:00:00Z' });
    const keys = vi.spyOn(localStorage, 'key');
    const hook = renderDraft(); await settle();
    const scans = keys.mock.calls.length;
    expect(scans).toBeGreaterThan(0);
    act(() => { hook.result.current.update('새 입력 1'); hook.result.current.update('새 입력 2'); });
    expect(keys).toHaveBeenCalledTimes(scans);
  });

  it('서버 응답의 recoveredFromClientId가 이전 창을 가리키면 원본 순번을 새 창에 재사용하지 않는다', async () => {
    request.mockReturnValueOnce(Promise.resolve({ draft: { ...draft('서버가 복구한 코드', 400), clientId: scope[2] }, checkpoint, recoveredFromClientId: 'server-source-tab' }));
    const hook = renderDraft(); await settle();
    expect(hook.result.current.draft).toMatchObject({ code: '서버가 복구한 코드', clientId: scope[2], clientSequence: 0, recoveredFromClientId: 'server-source-tab' });
  });
});
