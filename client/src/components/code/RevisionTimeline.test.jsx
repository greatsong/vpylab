import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ restore: vi.fn(), fetch: vi.fn() }));
vi.mock('../../i18n/useI18n', () => ({ useI18n: () => ({ t: key => key }) }));
vi.mock('../../stores/githubSyncStore', () => ({ default: () => ({ syncing: false, pushToGitHub: vi.fn() }) }));
vi.mock('../../stores/revisionStore', () => ({ default: () => ({
  revisions: [{ id: 'latest', message: '복원 전 편집본 보관', created_at: new Date().toISOString(), source: 'manual' }],
  loading: false, restoring: false, fetchRevisions: mocks.fetch, restoreRevision: mocks.restore,
}) }));
import RevisionTimeline from './RevisionTimeline';

beforeEach(() => { vi.clearAllMocks(); });

describe('최신 이력도 다시 불러오기', () => {
  it('자동저장이나 미저장 편집으로 코드가 달라진 뒤 최신 기록으로 돌아갈 수 있다', () => {
    render(<RevisionTimeline codeId="code-1" currentCode="new-editor" />);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.restore.mockResolvedValue({ error: null });
    expect(screen.getByText('최신 기록')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '↶ 이 버전으로' }));
    expect(mocks.restore).toHaveBeenCalledWith('latest', expect.objectContaining({ currentCode: 'new-editor' }));
  });
});
