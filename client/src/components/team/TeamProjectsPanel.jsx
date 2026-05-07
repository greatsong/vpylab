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

export default function TeamProjectsPanel({ onOpenProject, onClose, currentCode, initialAction = 'browse' }) {
  const { user } = useAuthStore();
  const {
    myProjects, loadingProjects, projectCreationStatus,
    fetchMyProjects, createProject, joinByInviteCode,
  } = useProjectStore();

  const [creating, setCreating] = useState(false);
  const [createElapsed, setCreateElapsed] = useState(0);
  const [createStartedAt, setCreateStartedAt] = useState(null);
  const [createOpen, setCreateOpen] = useState(initialAction === 'create');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  const [openingProjectId, setOpeningProjectId] = useState(null);
  const [openError, setOpenError] = useState('');
  const [membersTarget, setMembersTarget] = useState(null);
  const [createError, setCreateError] = useState('');
  const [tokenStatus, setTokenStatus] = useState('checking');  // 'checking' | 'ok' | 'missing'

  useEffect(() => {
    if (user) fetchMyProjects();
  }, [user, fetchMyProjects]);

  useEffect(() => {
    if (!creating || !createStartedAt) return undefined;
    const tick = () => {
      setCreateElapsed(Math.floor((Date.now() - createStartedAt) / 1000));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [creating, createStartedAt]);

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

  const openCreate = () => {
    setCreateError('');
    if (tokenStatus === 'missing') {
      setCreateError('GitHub 인증이 만료되었습니다. 아래 "GitHub 재로그인" 버튼을 눌러주세요.');
      return;
    }
    setCreateOpen(true);
  };

  const handleCreate = async (e) => {
    e?.preventDefault();
    setCreateError('');
    const title = createTitle.trim();
    if (!title) {
      setCreateError('이름을 입력해주세요.');
      return;
    }
    setCreating(true);
    setCreateElapsed(0);
    setCreateStartedAt(Date.now());
    const seedCode = currentCode && currentCode.trim().length > 0
      ? currentCode
      : `# ${title} — VPyLab 프로젝트\n# 여기에 코드를 작성하세요.\n\nbox(pos=(0,0,0), size=(1,1,1), color=(1,0,0))\n`;
    const { data, error } = await createProject({
      title: title.slice(0, 80),
      description: createDescription.trim().slice(0, 240),
      initialCode: seedCode,
    });
    setCreating(false);
    setCreateStartedAt(null);
    if (error) {
      setCreateError(error.message);
      // 토큰 만료 케이스면 재인증 안내
      if (/GitHub 로그인|GitHub 인증/.test(error.message || '')) {
        setTokenStatus('missing');
      }
      return;
    }
    setCreateTitle('');
    setCreateDescription('');
    setCreateOpen(false);
    if (onOpenProject && data?.id) handleOpenProject(data.id);
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
    if (onOpenProject && data?.projectId) handleOpenProject(data.projectId);
  };

  const handleOpenProject = async (projectId) => {
    if (!onOpenProject || !projectId) return;
    setOpenError('');
    setOpeningProjectId(projectId);
    try {
      await onOpenProject(projectId);
    } catch (e) {
      setOpenError(e.message || '프로젝트를 열지 못했습니다.');
    } finally {
      setOpeningProjectId(null);
    }
  };

  // 미로그인
  if (!user) {
    return (
      <Overlay onClose={onClose}>
        <Header title="프로젝트" onClose={onClose} />
        <div className="flex-1 flex items-center justify-center" style={{ padding: 48 }}>
          <EmptyState
            title="로그인이 필요합니다"
            description="GitHub 프로젝트, 초대 코드, 저장 이력은 로그인 후 사용할 수 있습니다."
            actionLabel="로그인하기"
            onAction={() => {
              onClose?.();
              useAuthStore.getState().setAuthModalOpen(true);
            }}
          />
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <Header title="프로젝트" onClose={onClose} />

      {tokenStatus === 'missing' && (
        <StatusBanner tone="warning">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              GitHub 인증을 다시 연결해야 합니다
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              현재 작성 중인 코드는 유지됩니다. 다시 로그인한 뒤 이어서 저장할 수 있습니다.
            </p>
          </div>
          <button
            onClick={handleReauth}
            className="px-4 py-2 text-sm font-semibold cursor-pointer border-none whitespace-nowrap"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text, white)',
            }}
          >
            GitHub 재로그인
          </button>
        </StatusBanner>
      )}

      <div className="flex-1 overflow-y-auto" style={{ padding: 28 }}>
        <form
          onSubmit={(e) => { e.preventDefault(); handleJoin(); }}
          className="mb-6 flex flex-col gap-2 border sm:flex-row sm:items-center"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border)',
            padding: '14px 16px',
          }}
        >
          <label className="text-xs font-semibold sm:w-28" style={{ color: 'var(--color-text-secondary)' }}>
            초대 코드
          </label>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="8자 코드"
            className="min-w-0 flex-1 px-3 py-2 text-sm border outline-none font-mono"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            maxLength={16}
          />
          <button
            type="submit"
            disabled={joining}
            className="px-4 py-2 text-sm font-semibold cursor-pointer border disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            {joining ? '합류 중' : '합류'}
          </button>
          {joinError && (
            <p className="text-xs sm:basis-full sm:pl-28" style={{ color: 'var(--color-error, #e03131)' }}>
              {joinError}
            </p>
          )}
        </form>

        {openError && (
          <StatusBanner tone="error" compact>
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{openError}</p>
          </StatusBanner>
        )}

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          <button
            onClick={openCreate}
            disabled={creating || tokenStatus === 'missing'}
            className="text-left cursor-pointer border disabled:opacity-50 transition-colors flex flex-col justify-between min-h-[190px]"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-accent)',
              color: 'var(--color-text-primary)',
              padding: 22,
            }}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center border text-xl" style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}>+</span>
            <span>
              <span className="block text-base font-bold mb-1">새 프로젝트 만들기</span>
              <span className="block text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                현재 코드를 첫 커밋으로 저장하고 GitHub Pages 실행 페이지를 만듭니다.
              </span>
            </span>
          </button>

          {!loadingProjects && myProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              isOpening={openingProjectId === p.id}
              onOpen={() => handleOpenProject(p.id)}
              onMembersClick={() => setMembersTarget(p)}
            />
          ))}

          {loadingProjects && (
            <div className="col-span-full text-center text-sm py-8" style={{ color: 'var(--color-text-muted)' }}>
              프로젝트를 불러오는 중입니다.
            </div>
          )}
        </div>

        {createError && (
          <StatusBanner tone="error" compact>
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{createError}</p>
          </StatusBanner>
        )}
      </div>

      {createOpen && (
        <CreateProjectModal
          title={createTitle}
          description={createDescription}
          creating={creating}
          progressLabel={projectCreationStatus}
          elapsedSeconds={createElapsed}
          error={createError}
          hasCode={Boolean(currentCode?.trim())}
          onTitleChange={setCreateTitle}
          onDescriptionChange={setCreateDescription}
          onSubmit={handleCreate}
          onClose={() => {
            if (creating) return;
            setCreateOpen(false);
            setCreateError('');
          }}
        />
      )}

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
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.58)' }}
      onClick={onClose}
    >
      <div
        className="w-[min(1080px,96vw)] h-[min(720px,92vh)] flex flex-col shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          border: '1px solid var(--color-border)',
          borderRadius: 0,
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
      className="flex items-center justify-between border-b"
      style={{
        borderColor: 'var(--color-border)',
        padding: '20px 28px',
      }}
    >
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h2>
        <p className="text-xs mt-0.5 break-keep" style={{ color: 'var(--color-text-muted)' }}>
          GitHub 저장소, Pages 실행 페이지, 팀 초대를 한 곳에서 관리합니다.
        </p>
      </div>
      <button
        onClick={onClose}
        className="h-9 w-9 cursor-pointer border bg-transparent text-lg"
        style={{
          color: 'var(--color-text-muted)',
          borderColor: 'var(--color-border)',
        }}
        aria-label="닫기"
      >
        ×
      </button>
    </div>
  );
}

// ========================================
// 프로젝트 카드 (갤러리 셀)
// ========================================
function ProjectCard({ project, isOpening = false, onOpen, onMembersClick }) {
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
      className="flex flex-col transition-shadow"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
        padding: 18,
      }}
    >
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
          {isOwner ? 'OWNER' : project.my_role === 'editor' ? 'EDIT' : 'VIEW'}
        </span>
      </div>

      {project.description && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
          {project.description}
        </p>
      )}

      <div className="flex items-center justify-between text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
        <span>
          {memberCount === null ? '멤버 확인 중' : memberCount === 1 ? '개인 프로젝트' : `${memberCount}명 참여`}
        </span>
        <span title={lastTouched ? new Date(lastTouched).toLocaleString() : ''}>
          {relativeTime(lastTouched)}
        </span>
      </div>

      {repo && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <a
            href={repoUrl} target="_blank" rel="noreferrer"
            className="text-[10px] px-2 py-1 inline-flex items-center gap-1 no-underline"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
            onClick={(e) => e.stopPropagation()}
          >GitHub</a>
          {pagesUrl && (
            <a
              href={pagesUrl} target="_blank" rel="noreferrer"
              className="text-[10px] px-2 py-1 inline-flex items-center gap-1 no-underline"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
              onClick={(e) => e.stopPropagation()}
            >Pages</a>
          )}
          <a
            href={`${repoUrl}/commits/main`} target="_blank" rel="noreferrer"
            className="text-[10px] px-2 py-1 inline-flex items-center gap-1 no-underline"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
            onClick={(e) => e.stopPropagation()}
          >커밋</a>
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={onOpen}
          disabled={isOpening}
          className="flex-1 text-xs py-2 cursor-pointer border-none font-bold disabled:opacity-60"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-accent-text, white)',
          }}
        >
          {isOpening ? '프로젝트 여는 중' : '이 프로젝트로 작업'}
        </button>
        <button
          onClick={onMembersClick}
          disabled={isOpening}
          className="text-xs px-3 py-2 cursor-pointer border"
          style={{
            backgroundColor: 'transparent',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
          title="멤버 / 초대 코드"
        >
          멤버
        </button>
      </div>
    </div>
  );
}

function StatusBanner({ children, tone = 'info', compact = false }) {
  const toneColor = tone === 'error'
    ? 'var(--color-error, #ef4444)'
    : tone === 'warning'
      ? 'var(--color-warning, #f59e0b)'
      : 'var(--color-accent)';
  return (
    <div
      className={`${compact ? 'mt-4' : 'mx-6 mt-6'} flex items-center justify-between gap-4 border px-4 py-3`}
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        boxShadow: `inset 3px 0 0 ${toneColor}`,
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="max-w-md text-center">
      <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</p>
      <p className="mt-2 text-sm leading-relaxed break-keep" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-5 border-none px-4 py-2 text-sm font-semibold"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-accent-text, white)',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function CreateProjectModal({
  title,
  description,
  creating,
  progressLabel,
  elapsedSeconds = 0,
  error,
  hasCode,
  onTitleChange,
  onDescriptionChange,
  onSubmit,
  onClose,
}) {
  const progressPercent = creating
    ? Math.min(92, 12 + elapsedSeconds * 3)
    : 0;
  const waitingMessage = elapsedSeconds >= 25
    ? 'GitHub 저장소 생성이나 Pages 활성화가 평소보다 오래 걸리고 있습니다. 창을 닫지 말고 조금만 기다려주세요.'
    : '보통 10-20초 정도 걸리고, GitHub 응답이 느리면 30초 안팎까지 걸릴 수 있습니다.';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.34)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg border shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          borderColor: 'var(--color-border)',
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              새 GitHub 프로젝트
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              저장소와 Pages 실행 페이지를 함께 준비합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="h-8 w-8 border bg-transparent text-lg disabled:opacity-40"
            style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              프로젝트 이름
            </span>
            <input
              autoFocus
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              maxLength={80}
              placeholder="예: 우리 학교 종소리"
              className="w-full border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              설명
            </span>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              maxLength={240}
              rows={3}
              placeholder="팀원이 알아볼 수 있는 짧은 설명"
              className="w-full resize-none border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </label>

          <div
            className="border px-3 py-2 text-xs"
            style={{
              backgroundColor: 'var(--color-accent-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {hasCode ? '현재 에디터 코드가 첫 커밋으로 저장됩니다.' : '빈 프로젝트 대신 기본 예제 코드로 시작합니다.'}
          </div>

          {error && (
            <p className="border px-3 py-2 text-xs" style={{ color: 'var(--color-error)', borderColor: 'var(--color-border)' }}>
              {error}
            </p>
          )}

          {creating && (
            <div
              className="border px-3 py-3 text-xs"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
              role="status"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {progressLabel || '프로젝트를 만드는 중입니다.'}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>{elapsedSeconds}초</span>
              </div>
              <div className="h-1.5 overflow-hidden" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: 'var(--color-accent)',
                  }}
                />
              </div>
              <p className="mt-2 leading-relaxed">{waitingMessage}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="border px-4 py-2 text-sm font-semibold disabled:opacity-40"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={creating}
            className="border-none px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text, white)',
            }}
          >
            {creating ? '만드는 중' : '프로젝트 만들기'}
          </button>
        </div>
      </form>
    </div>
  );
}
