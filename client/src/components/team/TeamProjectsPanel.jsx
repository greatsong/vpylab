/**
 * VPyLab — 프로젝트 메인 패널 (Phase 4-A 재디자인)
 *
 * 모델: 프로젝트 = GitHub 레포 1:1.
 *   - "+ 새 프로젝트 만들기" 버튼 클릭 → 즉시 GitHub 레포 + Pages + 첫 commit
 *   - 카드: 제목 / 멤버 아바타 / GitHub 링크 / Pages 링크 / 최근 활동
 *   - 초대 코드 입력으로 팀원 합류 가능
 */
import { useEffect, useState } from 'react';
import useProjectStore from '../../stores/projectStore';
import useAuthStore from '../../stores/authStore';
import TeamMembersModal from './TeamMembersModal';

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString();
}

export default function TeamProjectsPanel({ onOpenProject, onClose, currentCode }) {
  const { user } = useAuthStore();
  const {
    myProjects, loadingProjects,
    fetchMyProjects, createProject, joinByInviteCode,
  } = useProjectStore();

  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  const [membersTarget, setMembersTarget] = useState(null);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (user) fetchMyProjects();
  }, [user, fetchMyProjects]);

  const handleCreate = async () => {
    setCreateError('');
    const title = window.prompt('새 프로젝트 이름은? (예: 우리 학교 종소리)');
    if (title === null) return;
    if (!title.trim()) {
      setCreateError('이름을 입력해주세요.');
      return;
    }
    setCreating(true);
    const seedCode = currentCode && currentCode.trim().length > 0
      ? currentCode
      : `# ${title.trim()} — VPyLab 프로젝트\n# 여기에 코드를 작성하세요.\n\nbox(pos=(0,0,0), size=(1,1,1), color=(1,0,0))\n`;
    const { data, error } = await createProject({
      title: title.trim().slice(0, 80),
      initialCode: seedCode,
    });
    setCreating(false);
    if (error) {
      setCreateError(error.message);
      return;
    }
    if (onOpenProject && data?.id) onOpenProject(data.id);
  };

  const handleJoin = async () => {
    setJoinError('');
    if (!joinCode.trim()) {
      setJoinError('초대 코드를 입력해주세요.');
      return;
    }
    setJoining(true);
    const { data, error } = await joinByInviteCode(joinCode);
    setJoining(false);
    if (error) {
      setJoinError(error.message);
      return;
    }
    setJoinCode('');
    if (onOpenProject && data?.projectId) onOpenProject(data.projectId);
  };

  if (!user) {
    return (
      <div
        className="fixed right-0 top-0 h-full w-[26rem] z-50 shadow-xl flex flex-col"
        style={{ backgroundColor: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>📁 프로젝트</h3>
          <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-lg" style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
            로그인 후 이용할 수 있어요.<br />
            <span className="text-xs">GitHub 계정으로 로그인하면 자동으로 레포가 만들어져요.</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed right-0 top-0 h-full w-[26rem] z-50 shadow-xl flex flex-col"
      style={{ backgroundColor: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-border)' }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>📁 프로젝트</h3>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>GitHub 레포 + Pages 자동 연결</p>
        </div>
        <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-lg" style={{ color: 'var(--color-text-muted)' }}>✕</button>
      </div>

      {/* 큰 + 새 프로젝트 만들기 버튼 */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-3 text-sm font-bold rounded-lg cursor-pointer border-none disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-accent-text, white)',
          }}
        >
          {creating ? '⏳ GitHub 레포 만드는 중…' : '＋ 새 프로젝트 만들기'}
        </button>
        <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--color-text-muted)' }}>
          현재 에디터의 코드가 첫 commit이 됩니다.
        </p>
        {createError && (
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-error, #e03131)' }}>{createError}</p>
        )}
      </div>

      {/* 초대 코드로 합류 */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
          친구가 보낸 초대 코드로 팀에 합류
        </p>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="초대 코드 (8자)"
            className="flex-1 px-2 py-1.5 text-xs rounded border outline-none font-mono"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            maxLength={16}
          />
          <button
            onClick={handleJoin}
            disabled={joining}
            className="px-3 py-1.5 text-xs rounded cursor-pointer border disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            {joining ? '⏳' : '합류'}
          </button>
        </div>
        {joinError && (
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-error, #e03131)' }}>{joinError}</p>
        )}
      </div>

      {/* 내 프로젝트 카드 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-[11px] px-2 py-1" style={{ color: 'var(--color-text-muted)' }}>
          내 프로젝트 ({myProjects.length})
        </p>
        {loadingProjects ? (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>불러오는 중…</div>
        ) : myProjects.length === 0 ? (
          <div className="p-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            아직 프로젝트가 없어요.<br />
            위에서 새로 만들거나 초대 코드로 합류하세요.
          </div>
        ) : (
          myProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => onOpenProject && onOpenProject(p.id)}
              onMembersClick={() => setMembersTarget(p)}
            />
          ))
        )}
      </div>

      {membersTarget && (
        <TeamMembersModal
          project={membersTarget}
          onClose={() => setMembersTarget(null)}
        />
      )}
    </div>
  );
}

// ========================================
// 프로젝트 카드
// ========================================
function ProjectCard({ project, onOpen, onMembersClick }) {
  const repo = project.github_repo;
  const repoUrl = repo ? `https://github.com/${repo}` : null;
  const pagesUrl = repo ? `https://${repo.split('/')[0]}.github.io/${repo.split('/')[1]}/` : null;
  const lastTouched = project.github_last_pushed_at || project.updated_at;
  const isOwner = project.my_role === 'owner';

  return (
    <div
      className="p-3 mx-1 my-1 rounded-lg transition-shadow"
      style={{
        backgroundColor: 'var(--color-bg-tertiary)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
      }}
    >
      {/* 제목 + 역할 */}
      <div className="flex items-center justify-between mb-1.5">
        <h4
          onClick={onOpen}
          className="text-sm font-bold truncate flex-1 cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-text-primary)' }}
        >
          📁 {project.title}
        </h4>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded ml-2 flex-shrink-0"
          style={{
            backgroundColor: 'var(--color-accent-bg)',
            color: 'var(--color-accent)',
          }}
        >
          {isOwner ? '👑 소유자' : project.my_role === 'editor' ? '✏️ 편집' : '👀 보기'}
        </span>
      </div>

      {/* 설명 */}
      {project.description && (
        <p className="text-[11px] mb-2 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
          {project.description}
        </p>
      )}

      {/* 메타: 최근 활동 + 초대 코드 */}
      <div className="flex items-center justify-between text-[10px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
        <span title={lastTouched ? new Date(lastTouched).toLocaleString() : ''}>
          ⏱️ {relativeTime(lastTouched)}
        </span>
        <span className="font-mono">초대: {project.invite_code}</span>
      </div>

      {/* GitHub / Pages 링크 */}
      {repo && (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] px-2 py-1 rounded inline-flex items-center gap-1 no-underline"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
            }}
          >
            🔗 GitHub
          </a>
          {pagesUrl && (
            <a
              href={pagesUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] px-2 py-1 rounded inline-flex items-center gap-1 no-underline"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              🌐 Pages
            </a>
          )}
          <a
            href={repo ? `${repoUrl}/commits/main` : '#'}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] px-2 py-1 rounded inline-flex items-center gap-1 no-underline"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
            }}
          >
            📜 이력
          </a>
        </div>
      )}

      {/* 액션: 열기 + 멤버 관리 */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onOpen}
          className="flex-1 text-[11px] py-1.5 rounded cursor-pointer border-none font-medium"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-accent-text, white)',
          }}
        >
          이 프로젝트로 작업하기
        </button>
        <button
          onClick={onMembersClick}
          className="text-[11px] px-3 py-1.5 rounded cursor-pointer border"
          style={{
            backgroundColor: 'transparent',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
          title="멤버 / 초대 코드"
        >
          👥
        </button>
      </div>
    </div>
  );
}
