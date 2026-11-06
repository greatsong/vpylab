import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ restore: vi.fn(), fetch: vi.fn() }));
vi.mock('../../i18n/useI18n', () => ({ useI18n: () => ({ t: key => key }) }));
vi.mock('../../stores/codeStore', () => ({ default: () => ({
  savedCodes: ['X', 'Y'].map(id => ({ id, title: id, code: `saved-${id}`, updated_at: new Date().toISOString() })),
  currentCodeId: 'X', loading: false, fetchSavedCodes: vi.fn(),
}) }));
vi.mock('../../stores/authStore', () => ({ default: () => ({ user: { id: 'student-a' } }) }));
vi.mock('../../stores/projectStore', () => ({ default: () => ({ createProject: vi.fn() }) }));
vi.mock('../../stores/githubSyncStore', () => ({ default: () => ({ syncing: false, pushToGitHub: vi.fn() }) }));
vi.mock('../../stores/revisionStore', () => ({ default: () => ({
  revisions: [{ id: 'old-revision', message: '이전 코드', created_at: new Date().toISOString(), source: 'manual' }],
  loading: false, restoring: false, fetchRevisions: mocks.fetch, restoreRevision: mocks.restore,
}) }));
import SavedCodeList from './SavedCodeList';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mocks.restore.mockResolvedValue({ error: null });
});

describe('목록에서 복원할 때 현재 편집본과 저장 위치 전달', () => {
  it.each([0, 1])('X 편집 중 목록의 %i번째 작품을 복원해도 X 편집본의 소속을 유지한다', index => {
    render(<SavedCodeList currentCode="unsaved-X" onClose={vi.fn()} onLoadCode={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: '📜 이력' })[index]);
    fireEvent.click(screen.getByRole('button', { name: '↶ 이 버전으로' }));
    expect(mocks.restore).toHaveBeenCalledWith('old-revision', expect.objectContaining({ currentCode: 'unsaved-X', currentCodeId: 'X' }));
  });
});
