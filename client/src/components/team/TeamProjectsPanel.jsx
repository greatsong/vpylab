/**
 * VPyLab — 프로젝트 갤러리 (Phase 4-A 재디자인 v2)
 *
 * - 풀스크린 오버레이 + 큰 "+ 새 프로젝트" 카드 + 기존 프로젝트 카드 그리드
 * - GitHub 토큰이 없으면 재인증 버튼 노출 (현재 코드 유지)
 * - 둥근 모서리 사용 안 함 (사용자 요청)
 */
import { useEffect, useState } from 'react';
import useProjectStore from '../../stores/projectStore';
import useAuthStore from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
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
  const [tokenStatus, setTokenStatus] = useState('checking');  // 'checking' | 'ok' | 'missing'

  useEffect(() => {
    if (user) fetchMyProjects();
  }, [user, fetchMyProjects]);

  // GitHub 토큰 보유 여부 체크 (token이 없으면 재인증 버튼 노출)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) { setTokenStatus('checking'); return; }
      const t = await useAuthStore.getState().getGitHubToken();
      if (!alive) return;
      setTokenStatus(t ? 'ok' : 'missing');
    })();
    return () => { alive = false; };
  }, [user]);

  const handleReauth = () => {
    useAuthStore.getState().signInWithGitHub({
      returnPath: '/sandbox',
      returnCode: currentCode || '',
    });
  };

  const handleCreate = async () => {
    setCreateError('');
    if (tokenStatus === 'missing') {
      setCreateError('GitHub 인증이 만료되었습니다. 아래 "GitHub 재로그인" 버튼을 눌러주세요.');
      return;
    }
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
      // 토큰 만료 케이스면 재인증 안내
      if (/GitHub 로그인|GitHub 인증/.test(error.message || '')) {
        setTokenStatus('missing');
      }
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

  // 미로그인
  if (!user) {
    return (
      <Overlay onClose={onClose}>
        <Header title="📁 프로젝트" onClose={onClose} />
        <div className="flex-1 flex items-center justify-center p-12">
          <p className="text-base text-center" style={{ color: 'var(--color-text-muted)' }}>
            로그인 후 이용할 수 있어요.<br />
            <span className="text-sm">GitHub 계정으로 로그인하면 자동으로 레포가 만들어져요.</span>
          </p>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <Header title="📁 프로젝트" onClose={onClose} />

      {/* GitHub 재인증 안내 (토큰 만료 시) */}
      {tokenStatus === 'missing' && (
        <div
          className="mx-6 mt-6 px-4 py-3 flex items-center justify-between gap-4"
          style={{
            backgroundColor: 'var(--color-warning-bg, #fff3bf)',
            borderLeft: '3px solid var(--color-warning, #f59f00)',
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
              ⚠️ GitHub 인증이 만료되었습니다
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              다시 로그인하세요. 현재 작성 중인 코드는 유지됩니다.
            </p>
          </div>
          <button
            onClick={handleReauth}
            className="px-4 py-2 text-sm font-bold cursor-pointer border-none whitespace-nowrap"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text, white)',
            }}
          >
            GitHub 재로그인
          </button>
        </div>
      )}

      {/* 본문: 카드 그리드 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* 초대 코드 합류 (한 줄짜리 작은 입력) */}
        <div className="mb-6 flex items-center gap-2 max-w-md">
          <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
            초대 코드로 합류:
          </span>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="8자 코드"
            className="flex-1 px-2 py-1 text-xs border outline-none font-mono"
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
            className="px-3 py-1 text-xs cursor-pointer border disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            {joining ? '⏳' : '합류'}
          </button>
          {joinError && (
            <span className="text-xs ml-1" style={{ color: 'var(--color-error, #e03131)' }}>{joinError}</span>
          )}
        </div>

        {/* 카드 그리드 */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          {/* + 새 프로젝트 카드 */}
          <button
            onClick={handleCreate}
            disabled={creating || tokenStatus === 'missing'}
            className="p-6 text-left cursor-pointer border-2 border-dashed disabled:opacity-50 transition-colors flex flex-col items-center justify-center min-h-[180px]"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'var(--color-accent)',
              color: 'var(--color-accent)',
            }}
          >
            <span className="text-4xl mb-2">＋</span>
            <span className="text-base font-bold mb-1">새 프로젝트</span>
            <span className="text-xs text-center opacity-80" style={{ color: 'var(--color-text-secondary)' }}>
              {creating ? 'GitHub 레포 만드는 중…' : '현재 코드가 첫 commit이 됩니다'}
            </span>
          </button>

          {/* 기존 프로젝트 카드들 */}
          {!loadingProjects && myProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => onOpenProject && onOpenProject(p.id)}
              onMembersClick={() => setMembersTarget(p)}
            />
          ))}

          {loadingProjects && (
            <div className="col-span-full text-center text-sm py-8" style={{ color: 'var(--color-text-muted)' }}>
              불러오는 중…
            </div>
          )}
        </div>

        {createError && (
          <p className="text-sm mt-4 max-w-xl" style={{ color: 'var(--color-error, #e03131)' }}>
            {createError}
          </p>
        )}
      </div>

      {membersTarget && (
        <TeamMembersModal
          project={membersTarget}
          onClose={() => setMembersTarget(null)}
        />
      )}
    </Overlay>
  );
}

// ========================================
// 풀스크린 오버레이 컨테이너
// ========================================
function Overlay({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-[min(1080px,96vw)] h-[min(720px,92vh)] flex flex-col shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Header({ title, onClose }) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          GitHub 레포 + Pages 자동 연결 · 저장은 모두 commit으로 누적
        </p>
      </div>
      <button
        onClick={onClose}
        className="cursor-pointer border-none bg-transparent text-xl"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}

// ========================================
// 프로젝트 카드 (갤러리 셀)
// ========================================
function ProjectCard({ project, onOpen, onMembersClick }) {
  const repo = project.github_repo;
  const repoUrl = repo ? `https://github.com/${repo}` : null;
  const pagesUrl = repo ? `https://${repo.split('/')[0]}.github.io/${repo.split('/')[1]}/` : null;
  const lastTouched = project.github_last_pushed_at || project.updated_at;
  const isOwner = project.my_role === 'owner';

  // 멤버 수 라벨 (owner 1명이면 "혼자", 그 외 N명)
  const [memberCount, setMemberCount] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { count } = await supabase
        .from('vpylab_project_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('project_id', project.id);
      if (alive) setMemberCount(count ?? null);
    })();
    return () => { alive = false; };
  }, [project.id]);

  return (
    <div
      className="flex flex-col p-4 transition-shadow"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
      }}
    >
      {/* 제목 + 역할 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3
          onClick={onOpen}
          className="text-base font-bold flex-1 cursor-pointer hover:opacity-80 line-clamp-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {project.title}
        </h3>
        <span
          className="text-[10px] px-1.5 py-0.5 flex-shrink-0"
          style={{
            backgroundColor: 'var(--color-accent-bg)',
            color: 'var(--color-accent)',
          }}
        >
          {isOwner ? '👑' : project.my_role === 'editor' ? '✏️' : '👀'}
        </span>
      </div>

      {/* 설명 */}
      {project.description && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
          {project.description}
        </p>
      )}

      {/* 메타: 멤버수 + 최근 활동 */}
      <div className="flex items-center justify-between text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
        <span>
          👥 {memberCount === null ? '…' : memberCount === 1 ? '혼자' : `${memberCount}명`}
        </span>
        <span title={lastTouched ? new Date(lastTouched).toLocaleString() : ''}>
          ⏱️ {relativeTime(lastTouched)}
        </span>
      </div>

      {/* 링크들 */}
      {repo && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <a
            href={repoUrl} target="_blank" rel="noreferrer"
            className="text-[10px] px-2 py-1 inline-flex items-center gap-1 no-underline"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
            onClick={(e) => e.stopPropagation()}
          >🔗 GitHub</a>
          {pagesUrl && (
            <a
              href={pagesUrl} target="_blank" rel="noreferrer"
              className="text-[10px] px-2 py-1 inline-flex items-center gap-1 no-underline"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
              onClick={(e) => e.stopPropagation()}
            >🌐 Pages</a>
          )}
          <a
            href={`${repoUrl}/commits/main`} target="_blank" rel="noreferrer"
            className="text-[10px] px-2 py-1 inline-flex items-center gap-1 no-underline"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
            onClick={(e) => e.stopPropagation()}
          >📜 이력</a>
        </div>
      )}

      {/* 액션 */}
      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={onOpen}
          className="flex-1 text-xs py-2 cursor-pointer border-none font-bold"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-accent-text, white)',
          }}
        >
          이 프로젝트로 작업
        </button>
        <button
          onClick={onMembersClick}
          className="text-xs px-3 py-2 cursor-pointer border"
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
