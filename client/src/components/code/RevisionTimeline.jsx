/**
 * VPyLab — 코드 이력 타임라인
 * Phase 1 (Plan C): 특정 코드의 revision 목록을 시간순으로 보여주고,
 * 클릭하면 해당 시점으로 복원한다 (git log + checkout).
 *
 * 자동저장은 revision을 만들지 않으므로(설계상), 여기 보이는 항목은
 * 모두 학생이 명시적으로 "저장" 또는 "복원"한 시점이다.
 */
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import useRevisionStore from '../../stores/revisionStore';
import useGithubSyncStore from '../../stores/githubSyncStore';

const SOURCE_LABEL = {
  manual: '저장',
  restore: '복원',
  github_pull: 'GitHub 가져오기',
  mission_submit: '미션 제출',
};

const SOURCE_COLOR = {
  manual: 'var(--color-accent)',
  restore: 'var(--color-warning, #f59f00)',
  github_pull: 'var(--color-info, #228be6)',
  mission_submit: 'var(--color-success, #2f9e44)',
};

function formatRelative(isoStr) {
  const then = new Date(isoStr);
  const diffMs = Date.now() - then.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return then.toLocaleDateString();
}

export default function RevisionTimeline({ codeId, codeTitle, onClose, onRestored }) {
  const { revisions, loading, fetchRevisions, restoreRevision, fetchRevisionSnapshot } = useRevisionStore();
  const { syncing, pushToGitHub } = useGithubSyncStore();
  const { t } = useI18n();
  const [pushingId, setPushingId] = useState(null);

  useEffect(() => {
    if (codeId) fetchRevisions(codeId);
  }, [codeId, fetchRevisions]);

  const handlePush = async (rev) => {
    if (rev.project_id) {
      window.alert('팀 프로젝트의 GitHub 반영은 Sandbox의 "코드 저장" 또는 "기록 남기기" 흐름에서 처리됩니다.');
      return;
    }

    setPushingId(rev.id);
    try {
      const snapshot = await fetchRevisionSnapshot(rev.id);
      if (!snapshot) {
        window.alert('이 버전의 코드를 가져올 수 없습니다.');
        return;
      }
      const { error } = await pushToGitHub({
        code: snapshot.code_snapshot,
        title: codeTitle || '코드',
        message: rev.message || `${codeTitle || '코드'} 저장`,
        codeId,
        projectId: rev.project_id || null,
        revisionId: rev.id,
        source: rev.source,
        isTeam: !!rev.project_id,
      });
      if (error) {
        window.alert(`GitHub 동기화 실패: ${error.message}`);
        return;
      }
      // 갱신
      fetchRevisions(codeId);
    } finally {
      setPushingId(null);
    }
  };

  const handleRestore = async (revisionId, message) => {
    const label = message || '이 버전';
    const ok = window.confirm(`"${label}" 시점으로 되돌릴까요?\n\n현재 코드는 새로운 "복원" 기록으로 남아 사라지지 않습니다.`);
    if (!ok) return;

    const { error } = await restoreRevision(revisionId, {
      onRestored: (snapshotCode) => {
        if (onRestored) onRestored(snapshotCode);
      },
    });
    if (error) {
      window.alert(`복원 실패: ${error.message || '알 수 없는 오류'}`);
    }
  };

  return (
    <div
      className="fixed right-0 top-0 h-full w-96 z-[60] shadow-2xl flex flex-col"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex-1 min-w-0">
          <h3
            className="text-sm font-bold truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            📜 {codeTitle || '코드 이력'}
          </h3>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            저장/복원 시점 누적 · 자동저장은 포함되지 않음
          </p>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer border-none bg-transparent text-lg ml-2"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label={t?.('common.close') || '닫기'}
        >
          ✕
        </button>
      </div>

      {/* 타임라인 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t?.('common.loading') || '불러오는 중…'}
            </p>
          </div>
        ) : revisions.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              아직 저장 기록이 없습니다.<br />코드를 저장하면 여기에 차곡차곡 쌓여요.
            </p>
          </div>
        ) : (
          <ol className="relative">
            {/* 세로선 */}
            <div
              className="absolute left-3 top-2 bottom-2 w-px"
              style={{ backgroundColor: 'var(--color-border)' }}
              aria-hidden
            />
            {revisions.map((rev, idx) => {
              const sourceLabel = SOURCE_LABEL[rev.source] || rev.source;
              const dotColor = SOURCE_COLOR[rev.source] || 'var(--color-text-muted)';
              const isLatest = idx === 0;
              const isTeamRevision = !!rev.project_id;
              const number = revisions.length - idx;
              return (
                <li key={rev.id} className="relative pl-8 pr-1 py-2.5">
                  {/* 점 */}
                  <span
                    className="absolute left-2 top-3 w-2.5 h-2.5"
                    style={{
                      backgroundColor: dotColor,
                      boxShadow: isLatest ? `0 0 0 3px var(--color-bg-secondary), 0 0 0 4px ${dotColor}` : 'none',
                    }}
                    aria-hidden
                  />
                  <div
                    className="p-2.5 transition-all"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] px-1.5 py-0.5 font-medium"
                          style={{
                            backgroundColor: 'var(--color-accent-bg)',
                            color: dotColor,
                          }}
                        >
                          {sourceLabel}
                        </span>
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          #{number}
                        </span>
                        {isLatest && (
                          <span
                            className="text-[10px] px-1 py-0.5"
                            style={{
                              backgroundColor: 'var(--color-success-bg, #d3f9d8)',
                              color: 'var(--color-success, #2f9e44)',
                            }}
                          >
                            현재
                          </span>
                        )}
                      </div>
                      <span
                        className="text-[10px]"
                        style={{ color: 'var(--color-text-muted)' }}
                        title={new Date(rev.created_at).toLocaleString()}
                      >
                        {formatRelative(rev.created_at)}
                      </span>
                    </div>
                    <p
                      className="text-xs mb-1.5 break-words"
                      style={{
                        color: rev.message ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                        fontStyle: rev.message ? 'normal' : 'italic',
                      }}
                    >
                      {rev.message || '(메시지 없음)'}
                    </p>
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span
                        className="text-[10px] font-mono"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {rev.code_size?.toLocaleString() || 0}자
                        {rev.github_commit_sha && (
                          <span
                            className="ml-1.5 px-1 py-0.5"
                            style={{
                              backgroundColor: 'var(--color-success-bg, #d3f9d8)',
                              color: 'var(--color-success, #2f9e44)',
                            }}
                            title={`GitHub commit ${rev.github_commit_sha.slice(0, 7)}`}
                          >
                            ✓ GitHub
                          </span>
                        )}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handlePush(rev)}
                          disabled={isTeamRevision || (syncing && pushingId === rev.id)}
                          className="text-[10px] px-2 py-1 cursor-pointer border disabled:opacity-50"
                          style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text-secondary)',
                          }}
                          title={isTeamRevision
                            ? '팀 프로젝트는 Sandbox의 코드 저장/기록 남기기 흐름에서 GitHub에 반영됩니다.'
                            : '이 버전을 GitHub 레포에 commit'}
                        >
                          {isTeamRevision ? 'GitHub 자동' : pushingId === rev.id ? '⏳ push…' : '📤 GitHub'}
                        </button>
                        {!isLatest && (
                          <button
                            onClick={() => handleRestore(rev.id, rev.message)}
                            className="text-[10px] px-2 py-1 cursor-pointer border-none transition-opacity hover:opacity-80"
                            style={{
                              backgroundColor: 'var(--color-accent)',
                              color: 'var(--color-accent-text, white)',
                            }}
                          >
                            ↶ 이 버전으로
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* 푸터 */}
      <div
        className="p-3 border-t text-[10px]"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        💡 복원해도 현재 코드는 사라지지 않고 새 기록으로 보존됩니다.
      </div>
    </div>
  );
}
