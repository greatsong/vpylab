/**
 * VPyLab — 팀 멤버 관리 모달
 * Phase 2 (Plan C): owner는 멤버 추방·역할 변경 가능. 일반 멤버는 본인 탈퇴만 가능.
 */
import { useEffect, useState } from 'react';
import useProjectStore from '../../stores/projectStore';
import useAuthStore from '../../stores/authStore';

export default function TeamMembersModal({ project, onClose }) {
  const { user } = useAuthStore();
  const {
    fetchProjectMembers, removeMember, setMemberRole,
    leaveProject, regenerateInviteCode, deleteProject,
  } = useProjectStore();

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [modalProject, setModalProject] = useState(project || null);
  const [modalMembers, setModalMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!project?.id) return;
      setLoadingMembers(true);
      setLoadError('');
      const { data, error } = await fetchProjectMembers(project.id);
      if (!alive) return;
      if (error) {
        setLoadError(error.message || '멤버 정보를 불러오지 못했습니다.');
        setModalProject(project);
        setModalMembers([]);
      } else {
        setModalProject(data.project);
        setModalMembers(data.members || []);
      }
      setLoadingMembers(false);
    };
    load();
    return () => { alive = false; };
  }, [project, fetchProjectMembers]);

  const displayProject = modalProject || project || {};
  const isOwner = displayProject && user && displayProject.owner_id === user.id;
  const inviteCode = displayProject?.invite_code || '';
  const inviteUrl = inviteCode ? `${window.location.origin}/sandbox?team=${inviteCode}` : '';
  const repoFullName = displayProject?.github_repo || '';
  const repoUrl = repoFullName ? `https://github.com/${repoFullName}` : '';
  const collaboratorUrl = repoFullName ? `https://github.com/${repoFullName}/settings/access` : '';
  const editableMembers = modalMembers.filter((m) => m.role === 'owner' || m.role === 'editor');

  const getMemberDisplay = (member) => (
    member?.profile?.display_name || member?.user_id?.slice(0, 8) || '팀원'
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl || inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('아래 코드를 복사하세요', inviteCode);
    }
  };

  const handleRemove = async (uid) => {
    if (!window.confirm('이 멤버를 내보낼까요?')) return;
    setBusy(true);
    const { error } = await removeMember(displayProject.id, uid);
    if (error) {
      window.alert(`내보내기 실패: ${error.message}`);
    } else {
      setModalMembers((members) => members.filter((member) => member.user_id !== uid));
    }
    setBusy(false);
  };

  const handleRoleChange = async (uid, role) => {
    setBusy(true);
    const { error } = await setMemberRole(displayProject.id, uid, role);
    if (error) {
      window.alert(`권한 변경 실패: ${error.message}`);
    } else {
      setModalMembers((members) => members.map((member) => (
        member.user_id === uid ? { ...member, role } : member
      )));
    }
    setBusy(false);
  };

  const handleLeave = async () => {
    if (!window.confirm('이 팀에서 나가시겠어요?')) return;
    setBusy(true);
    const { error } = await leaveProject(displayProject.id);
    setBusy(false);
    if (error) {
      window.alert(`나가기 실패: ${error.message}`);
      return;
    }
    onClose && onClose();
  };

  const handleRegenerate = async () => {
    if (!window.confirm('초대 코드를 재발급하면 기존 코드는 더 이상 동작하지 않습니다. 계속할까요?')) return;
    setBusy(true);
    const { data, error } = await regenerateInviteCode(displayProject.id);
    if (error) {
      window.alert(`초대 코드 재발급 실패: ${error.message}`);
    } else if (data) {
      setModalProject(data);
    }
    setBusy(false);
  };

  const handleDelete = async () => {
    const githubNote = repoFullName
      ? `\n\nGitHub 저장소(${repoFullName})는 자동으로 삭제되지 않고 그대로 남습니다.`
      : '\n\n연결된 GitHub 저장소는 없습니다.';
    if (!window.confirm(`정말 이 프로젝트를 VPyLab에서 삭제하시겠어요?\n관련 코드와 VPyLab 이력이 함께 삭제됩니다.${githubNote}`)) return;
    setBusy(true);
    const { error } = await deleteProject(displayProject.id);
    setBusy(false);
    if (error) {
      window.alert(`삭제 실패: ${error.message}`);
      return;
    }
    onClose && onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
              👥 {displayProject?.title || '팀 프로젝트'}
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              멤버 {modalMembers.length}명
            </p>
          </div>
          <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-lg" style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        {/* 초대 코드 */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-sm">①</span>
            <p className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>
              VPyLab 초대 코드 <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>· 앱 안에서 같이 작업</span>
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <code
              className="px-3 py-2 text-sm font-mono flex-1 truncate"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-accent)' }}
            >
              {inviteCode || '…'}
            </code>
            <button
              onClick={handleCopy}
              className="px-3 py-2 text-xs cursor-pointer border-none"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text, white)' }}
            >
              {copied ? '복사됨!' : '복사'}
            </button>
          </div>
          {isOwner && (
            <button
              onClick={handleRegenerate}
              disabled={busy}
              className="text-[10px] mt-2 cursor-pointer border-none bg-transparent disabled:opacity-50"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ↻ 코드 재발급
            </button>
          )}
          <div
            className="mt-3 border px-3 py-2 text-[11px] leading-relaxed"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
            }}
          >
            편집 멤버: 코드 저장 · 기록 남기기 가능
          </div>
          {repoFullName && (
            <div
              className="mt-3 border px-3 py-2 text-[11px] leading-relaxed"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm flex-shrink-0">②</span>
                  <strong className="text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>
                    GitHub 공동 작업자 초대
                    <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}> · 선택 사항</span>
                  </strong>
                </div>
                <a
                  href={isOwner ? collaboratorUrl : repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold no-underline flex-shrink-0"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {isOwner ? '공동 작업자 초대' : '저장소 보기'}
                </a>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                VPyLab 초대는 앱 안에서 함께 작업하는 권한이고, GitHub 초대는 저장소에 직접 반영하는 추가 권한입니다.
              </p>
              <div className="mt-2 space-y-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                <p><strong style={{ color: 'var(--color-text-secondary)' }}>추가 전:</strong> 팀장만 GitHub에 기록 가능 / <strong style={{ color: 'var(--color-text-secondary)' }}>추가 후:</strong> 팀원도 GitHub에 기록 가능</p>
                <p><strong style={{ color: 'var(--color-text-secondary)' }}>좋아지는 점:</strong> 내 저장이 GitHub 커밋과 Pages 실행 페이지에도 남아 팀 작품을 공개 링크와 포트폴리오처럼 보여줄 수 있습니다.</p>
                <p><strong style={{ color: 'var(--color-text-secondary)' }}>팀장:</strong> Manage access → Add people → 팀원 GitHub 아이디 검색 → Invite collaborator</p>
                <p><strong style={{ color: 'var(--color-text-secondary)' }}>팀장:</strong> Add people 단계에서 GitHub가 2FA를 요구하면 먼저 2FA 설정(휴대폰이 필요할 수 있음)을 마친 뒤 다시 초대</p>
                <p><strong style={{ color: 'var(--color-text-secondary)' }}>팀원:</strong> GitHub 알림 또는 이메일 열기 → Accept invitation 클릭 → VPyLab에서 GitHub로 다시 로그인</p>
                <p><strong style={{ color: 'var(--color-text-secondary)' }}>팀원:</strong> 수락 단계에서 2FA를 요구하면 설정을 마친 뒤 다시 Accept invitation</p>
                <p>초대 수락 전에도 VPyLab 저장은 가능하고, GitHub 반영만 권한 확인 뒤 이어집니다.</p>
              </div>
              {editableMembers.length > 0 && (
                <div className="mt-2 space-y-1">
                  {editableMembers.map((member) => {
                    const isOwnerMember = member.role === 'owner';
                    const githubName = member.profile?.github_username;
                    return (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between gap-2"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <span className="min-w-0 truncate">{getMemberDisplay(member)}</span>
                        <span className="flex-shrink-0 font-mono">
                          {isOwnerMember ? '소유자' : githubName ? `@${githubName}` : 'GitHub 아이디 미확인'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 멤버 목록 */}
        <div className="flex-1 overflow-y-auto p-2">
          {loadingMembers ? (
            <div className="p-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
              불러오는 중…
            </div>
          ) : loadError ? (
            <div className="p-6 text-center text-xs" style={{ color: 'var(--color-error, #e03131)' }}>
              {loadError}
            </div>
          ) : modalMembers.length === 0 ? (
            <div className="p-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
              아직 표시할 멤버 정보가 없습니다. 초대 코드를 공유해 팀원을 합류시켜주세요.
            </div>
          ) : (
            modalMembers.map((m) => {
              const isMe = m.user_id === user?.id;
              const isOwnerRow = m.role === 'owner';
              const display = getMemberDisplay(m);
              return (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between p-2 mx-1 my-0.5"
                  style={{ backgroundColor: isMe ? 'var(--color-accent-bg)' : 'var(--color-bg-secondary)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text, white)' }}
                    >
                      {display.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {display}{isMe && ' (나)'}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(m.joined_at).toLocaleDateString()}
                        {m.profile?.github_username ? ` · @${m.profile.github_username}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isOwner && !isOwnerRow ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                        disabled={busy}
                        className="text-[11px] px-1.5 py-1 border outline-none cursor-pointer"
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <option value="editor">편집</option>
                        <option value="viewer">보기</option>
                      </select>
                    ) : (
                      <span
                        className="text-[10px] px-1.5 py-0.5"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
                      >
                        {isOwnerRow ? '소유자' : m.role === 'editor' ? '편집' : '보기'}
                      </span>
                    )}
                    {isOwner && !isOwnerRow && (
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        disabled={busy}
                        className="text-[10px] cursor-pointer border-none bg-transparent opacity-60 hover:opacity-100 disabled:opacity-30"
                        style={{ color: 'var(--color-error, #e03131)' }}
                        title="멤버 내보내기"
                      >
                        내보내기
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 푸터 */}
        <div
          className="p-3 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {isOwner && repoFullName && (
            <p className="mb-2 text-[10px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              프로젝트를 삭제해도 GitHub 저장소는 포트폴리오와 공유 링크로 남습니다.
            </p>
          )}
          <div className="flex justify-between items-center">
            {!isOwner ? (
              <button
                onClick={handleLeave}
                disabled={busy}
                className="text-xs cursor-pointer border-none bg-transparent disabled:opacity-50"
                style={{ color: 'var(--color-error, #e03131)' }}
              >
                팀에서 나가기
              </button>
            ) : (
            <button
              onClick={handleDelete}
              disabled={busy}
              className="text-xs cursor-pointer border-none bg-transparent disabled:opacity-50"
              style={{ color: 'var(--color-error, #e03131)' }}
            >
              팀 프로젝트 삭제
            </button>
            )}
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 cursor-pointer border-none"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
