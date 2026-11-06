import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), getUser: vi.fn(), createRevision: vi.fn(), fetchSavedCodes: vi.fn(), pauseAutoSave: vi.fn(), resumeAutoSave: vi.fn(),
  projectState: { activeCodeId: 'code-1' }, setProjectState: vi.fn(),
  saveCode: vi.fn(),
}));
vi.mock('./projectStore', () => ({ default: { getState: () => mocks.projectState, setState: mocks.setProjectState } }));
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser } } }));
vi.mock('./codeStore', () => ({ default: { getState: () => ({ saveCode: mocks.saveCode, _createRevision: mocks.createRevision, fetchSavedCodes: mocks.fetchSavedCodes, pauseAutoSave: mocks.pauseAutoSave }) } }));

import useRevisionStore from './revisionStore';

let saved;
let update;
let onRestored;
let updateResult;
let conditions;

beforeEach(() => {
  vi.clearAllMocks();
  saved = { id: 'code-1', project_id: null, code: 'saved-latest', updated_at: '2026-11-06T09:00:00Z' };
  update = vi.fn();
  onRestored = vi.fn();
  updateResult = { data: { id: saved.id, project_id: saved.project_id }, error: null };
  conditions = [];
  mocks.pauseAutoSave.mockResolvedValue(mocks.resumeAutoSave);
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'student-a' } } });
  mocks.createRevision.mockResolvedValue({ data: { id: 'new-revision' }, error: null });
  mocks.fetchSavedCodes.mockResolvedValue(undefined);
  mocks.from.mockImplementation(table => {
    expect(table).toBe('vpylab_saved_code');
    let rowId;
    const chain = {
      eq: vi.fn((...args) => { conditions.push(args); if (args[0] === 'id') rowId = args[1]; return chain; }), select: vi.fn(() => chain),
      single: vi.fn(async () => ({ data: rowId === 'editor-code' ? { id: rowId, code: 'other-saved', project_id: null } : saved, error: null })),
      maybeSingle: vi.fn(async () => updateResult),
    };
    return {
      select: () => chain,
      update: values => {
        update(values);
        return chain;
      },
    };
  });
  useRevisionStore.setState({
    restoring: false,
    fetchRevisionSnapshot: vi.fn().mockResolvedValue({ id: 'old-revision', code_id: 'code-1', project_id: null, code_snapshot: 'old-code' }),
    fetchRevisions: vi.fn().mockResolvedValue([]),
  });
});

describe('교재의 코드 복원과 복원 전 작업 보관', () => {
  it('저장본과 미저장 편집본을 각각 보관한 뒤 이전 코드를 복원한다', async () => {
    const result = await useRevisionStore.getState().restoreRevision('old-revision', { currentCode: 'unsaved-editor', onRestored });
    expect(result.error).toBeNull();
    expect(mocks.createRevision.mock.calls.map(([args]) => args.code)).toEqual(['saved-latest', 'unsaved-editor', 'old-code']);
    expect(mocks.createRevision.mock.invocationCallOrder[1]).toBeLessThan(update.mock.invocationCallOrder[0]);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ code: 'old-code' }));
    expect(onRestored).toHaveBeenCalledWith('old-code');
    expect(conditions).toContainEqual(['updated_at', saved.updated_at]);
    expect(mocks.resumeAutoSave).toHaveBeenCalledWith(true);
  });

  it('보관에 실패하면 현재 코드와 에디터를 바꾸지 않는다', async () => {
    mocks.createRevision.mockResolvedValue({ data: null, error: { message: '이력 저장 실패' } });
    const result = await useRevisionStore.getState().restoreRevision('old-revision', { currentCode: 'unsaved-editor', onRestored });
    expect(result.error).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
    expect(onRestored).not.toHaveBeenCalled();
    expect(mocks.resumeAutoSave).toHaveBeenCalledWith(false);
  });

  it('저장본과 편집본이 같으면 보관 이력을 중복 생성하지 않는다', async () => {
    await useRevisionStore.getState().restoreRevision('old-revision', { currentCode: 'saved-latest', onRestored });
    expect(mocks.createRevision.mock.calls.map(([args]) => args.code)).toEqual(['saved-latest', 'old-code']);
  });

  it('다른 코드 목록에서 복원할 때도 현재 저장본을 먼저 보관한다', async () => {
    await useRevisionStore.getState().restoreRevision('old-revision', { onRestored });
    expect(mocks.createRevision.mock.calls.map(([args]) => args.code)).toEqual(['saved-latest', 'old-code']);
  });

  it('본문은 복원됐지만 복원 이력 추가가 실패한 경우 경고와 복원 결과를 함께 돌려준다', async () => {
    mocks.createRevision.mockResolvedValueOnce({ data: { id: 'backup' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: '복원 이력 실패' } });
    const result = await useRevisionStore.getState().restoreRevision('old-revision', { onRestored });
    expect(result.error).toBeNull();
    expect(result.warning).toContain('이력');
    expect(onRestored).toHaveBeenCalledWith('old-code');
  });

  it('다른 저장이 먼저 끝나 0행이 갱신되면 에디터를 바꾸지 않고 충돌을 알린다', async () => {
    updateResult = { data: null, error: null };
    const result = await useRevisionStore.getState().restoreRevision('old-revision', { onRestored });
    expect(result.error.message).toContain('다른 저장');
    expect(onRestored).not.toHaveBeenCalled();
    expect(mocks.resumeAutoSave).toHaveBeenCalledWith(false);
  });

  it('본문 갱신이 실패하면 에디터를 바꾸지 않는다', async () => {
    updateResult = { data: null, error: { message: '갱신 실패' } };
    const result = await useRevisionStore.getState().restoreRevision('old-revision', { onRestored });
    expect(result.error.message).toBe('갱신 실패');
    expect(onRestored).not.toHaveBeenCalled();
  });

  it('자동저장이 끝나기를 기다리는 동안 중복 복원을 막는다', async () => {
    let finish;
    mocks.pauseAutoSave.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const first = useRevisionStore.getState().restoreRevision('old-revision', { onRestored });
    expect(useRevisionStore.getState().restoring).toBe(true);
    expect(update).not.toHaveBeenCalled();
    const duplicate = await useRevisionStore.getState().restoreRevision('old-revision');
    expect(duplicate.error.message).toContain('이미 복원');
    finish(mocks.resumeAutoSave);
    await first;
    expect(update).toHaveBeenCalledTimes(1);
    expect(useRevisionStore.getState().restoring).toBe(false);
  });

  it('목록 새로고침이 실패해도 완료한 복원을 에디터에 반영하고 경고한다', async () => {
    useRevisionStore.setState({ fetchRevisions: vi.fn().mockRejectedValue(new Error('목록 조회 실패')) });
    const result = await useRevisionStore.getState().restoreRevision('old-revision', { onRestored });
    expect(result.error).toBeNull();
    expect(result.warning).toContain('목록');
    expect(onRestored).toHaveBeenCalledWith('old-code');
  });

  it('X 편집 중 Y를 복원하면 X의 편집본을 X 이력에 먼저 보관한다', async () => {
    const result = await useRevisionStore.getState().restoreRevision('old-revision', {
      currentCode: 'unsaved-X', currentCodeId: 'editor-code', onRestored,
    });
    expect(result.error).toBeNull();
    expect(mocks.createRevision.mock.calls.map(([args]) => [args.codeId, args.code])).toEqual([
      ['editor-code', 'unsaved-X'], ['code-1', 'saved-latest'], ['code-1', 'old-code'],
    ]);
    expect(mocks.createRevision.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
  });

  it('목록에서 현재 작품을 복원할 때도 미저장 편집본을 보관한다', async () => {
    await useRevisionStore.getState().restoreRevision('old-revision', { currentCode: 'unsaved-X', currentCodeId: 'code-1', onRestored });
    expect(mocks.createRevision).toHaveBeenCalledWith(expect.objectContaining({ codeId: 'code-1', code: 'unsaved-X' }));
  });

  it('현재 새 작품이 저장되지 않았거나 보관 실패 시 다른 작품 복원을 중단한다', async () => {
    const noId = await useRevisionStore.getState().restoreRevision('old-revision', { currentCode: 'new-work', currentCodeId: null, onRestored });
    expect(noId.error.message).toContain('먼저 저장');
    mocks.createRevision.mockResolvedValue({ data: null, error: { message: '이력 저장 실패' } });
    const failed = await useRevisionStore.getState().restoreRevision('old-revision', { currentCode: 'unsaved-X', currentCodeId: 'editor-code', onRestored });
    expect(failed.error).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
    expect(onRestored).not.toHaveBeenCalled();
  });

  it('공동 작품 복원도 본문·이력을 원자 저장하고 충돌 기준을 갱신한다', async () => {
    saved.project_id = 'project-1';
    mocks.saveCode.mockResolvedValue({ data: { id: 'code-1', code: 'old-code' }, error: null });
    const result = await useRevisionStore.getState().restoreRevision('old-revision', { onRestored });
    expect(result.error).toBeNull();
    expect(mocks.saveCode).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', expectedCode: 'saved-latest', code: 'old-code', source: 'restore' }));
    expect(update).not.toHaveBeenCalled();
    expect(mocks.setProjectState).toHaveBeenCalledWith({ activeCodeSnapshot: 'old-code' });
  });

  it('공동 복원 중 친구가 먼저 저장하면 에디터를 바꾸지 않는다', async () => {
    saved.project_id = 'project-1';
    mocks.saveCode.mockResolvedValue({ data: null, error: { code: 'saved_code_conflict', message: '다른 친구가 저장했습니다.' } });
    const result = await useRevisionStore.getState().restoreRevision('old-revision', { onRestored });
    expect(result.error.code).toBe('saved_code_conflict');
    expect(onRestored).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
