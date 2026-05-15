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
    activeProject, activeMembers, openProject, removeMember, setMemberRole,
    leaveProject, regenerateInviteCode, inviteGithubCollaborator, inviteGithubCollaborators,
    fetchPendingCollaborators, cancelGithubInvitation, deleteProject,
  } = useProjectStore();

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [githubInviteMsg, setGithubInviteMsg] = useState('');
  const [githubInviteTone, setGithubInviteTone] = useState('info');
  const [githubInviting, setGithubInviting] = useState(false);
  const [githubBulkInviting, setGithubBulkInviting] = useState(false);
  // ── 보류 초대 ──
  // owner가 "지금 누구한테 초대 보냈는데 아직 수락 안 했는지" 확인 가능하게.
  // 초대를 보낸 뒤 "저장이 안 됐나?" 착각의 핵심 원인 제거.
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (project?.id) openProject(project.id);
  }, [project?.id, openProject]);

  const loadPendingInvitations = async () => {
    if (!activeProject?.github_repo) return;
    setPendingLoading(true);
    setPendingError('');
    const { data, error } = await fetchPendingCollaborators({ repoFullName: activeProject.github_repo });
    setPendingLoading(false);
    if (error) {
      setPendingError(error.message);
      return;
    }
    setPendingInvitations(data?.invitations || []);
  };

  useEffect(() => {
    if (activeProject?.github_repo) loadPendingInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.github_repo]);

  const isOwner = activeProject && user && activeProject.owner_id === user.id;
  const inviteCode = activeProject?.invite_code || project?.invite_code || '';
  const inviteUrl = inviteCode ? `${window.location.origin}/?team=${inviteCode}` : '';
  const repoFullName = activeProject?.github_repo || project?.github_repo || '';
  const collaboratorUrl = repoFullName ? `https://github.com/${repoFullName}/settings/access` : '';
  const editableMembers = activeMembers.filter((m) => m.role === 'owner' || m.role === 'editor');
  const githubInviteTargets = Array.from(new Set(editableMembers
    .filter((m) => m.role !== 'owner' && m.profile?.github_username)
    .map((m) => m.profile.github_username)));
  const githubMissingMembers = editableMembers
    .filter((m) => m.role !== 'owner' && !m.profile?.github_username);

  const getMemberDisplay = (member) => (
    member?.profile?.display_name || member?.user_id?.slice(0, 8) || '팀원'
  );
  const setGithubInviteResult = (message, tone = 'info') => {
    setGithubInviteMsg(message);
    setGithubInviteTone(tone);
  };
  const formatGithubInviteFailures = (failed = []) => (
    failed
      .map((item) => `@${item.username}: ${item.error || 'GitHub에서 확인이 필요합니다.'}`)
      .join(' / ')
  );
  const githubInviteMsgColor = {
    error: 'var(--color-danger, #dc2626)',
    warning: 'var(--color-warning, #b45309)',
    success: 'var(--color-success, #047857)',
    info: 'var(--color-text-muted)',
  }[githubInviteTone] || 'var(--color-text-muted)';

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
    await removeMember(activeProject.id, uid);
    setBusy(false);
  };

  const handleRoleChange = async (uid, role) => {
    setBusy(true);
    await setMemberRole(activeProject.id, uid, role);
    setBusy(false);
  };

  const handleLeave = async () => {
    if (!window.confirm('이 팀에서 나가시겠어요?')) return;
    setBusy(true);
    const { error } = await leaveProject(activeProject.id);
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
    await regenerateInviteCode(activeProject.id);
    setBusy(false);
  };

  const handleGithubInvite = async (e) => {
    e.preventDefault();
    if (!githubUsername.trim()) {
      setGithubInviteResult('GitHub 사용자명을 입력해주세요.', 'error');
      return;
    }
    setGithubInviting(true);
    setGithubInviteResult('', 'info');
    const { data, error } = await inviteGithubCollaborator({ username: githubUsername });
    setGithubInviting(false);
    if (error) {
      const failedDetail = formatGithubInviteFailures(data?.failed || []);
      setGithubInviteResult(failedDetail ? `${error.message} ${failedDetail}` : error.message, 'error');
      return;
    }
    setGithubUsername('');
    setGithubInviteResult(data.alreadyCollaborator
      ? `${data.username}님은 이미 GitHub collaborator입니다.`
      : `${data.username}님에게 GitHub 초대를 보냈습니다. 아래 "수락 대기 중" 목록에 표시됩니다. 본인이 GitHub에서 수락해야 권한이 활성화됩니다.`, 'success');
    loadPendingInvitations();
  };

  const handleGithubInviteKnownMembers = async () => {
    if (githubInviteTargets.length === 0) {
      setGithubInviteResult('먼저 편집 멤버가 GitHub로 로그인해야 자동 초대할 수 있습니다.', 'warning');
      return;
    }

    setGithubBulkInviting(true);
    setGithubInviteResult('', 'info');
    const { data, error } = await inviteGithubCollaborators({ usernames: githubInviteTargets });
    setGithubBulkInviting(false);

    if (error) {
      const failedDetail = formatGithubInviteFailures(data?.failed || []);
      setGithubInviteResult(failedDetail ? `${error.message} ${failedDetail}` : error.message, 'error');
      return;
    }

    const invitedCount = data?.invited?.length || 0;
    const failedCount = data?.failed?.length || 0;
    if (invitedCount > 0 && failedCount > 0) {
      const failedDetail = formatGithubInviteFailures(data.failed);
      setGithubInviteResult(`${invitedCount}명에게 초대를 보냈습니다. 실패: ${failedDetail}`, 'warning');
      return;
    }
    if (invitedCount > 0) {
      setGithubInviteResult(`${invitedCount}명에게 GitHub 초대를 보냈습니다. 아래 "수락 대기 중" 목록에 표시됩니다. 본인이 GitHub에서 수락해야 권한이 활성화됩니다.`, 'success');
      loadPendingInvitations();
      return;
    }
    setGithubInviteResult('초대를 보낼 수 있는 팀원이 없습니다.', 'warning');
  };

  const handleCancelInvitation = async (invitation) => {
    if (!invitation?.id) return;
    if (!window.confirm(`@${invitation.invitee}님 초대를 취소할까요? 다시 초대할 수 있습니다.`)) return;
    setCancellingId(invitation.id);
    const { error } = await cancelGithubInvitation({ invitationId: invitation.id });
    setCancellingId(null);
    if (error) {
      setGithubInviteResult(`초대 취소 실패: ${error.message}`, 'error');
      return;
    }
    setGithubInviteResult(`@${invitation.invitee}님 초대를 취소했습니다.`, 'success');
    loadPendingInvitations();
  };

  const handleDelete = async () => {
    const githubNote = repoFullName
      ? `\n\nGitHub 저장소(${repoFullName})는 자동으로 삭제되지 않고 그대로 남습니다.`
      : '\n\n연결된 GitHub 저장소는 없습니다.';
    if (!window.confirm(`정말 이 프로젝트를 VPyLab에서 삭제하시겠어요?\n관련 코드와 VPyLab 이력이 함께 삭제됩니다.${githubNote}`)) return;
    setBusy(true);
    const { error } = await deleteProject(activeProject.id);
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
              👥 {activeProject?.title || project?.title || '팀 프로젝트'}
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              멤버 {activeMembers.length}명
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
          {isOwner && collaboratorUrl && (
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
                    GitHub 권한
                    <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}> · 저장소 코드 push</span>
                  </strong>
                </div>
                <a
                  href={collaboratorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold no-underline flex-shrink-0"
                  style={{ color: 'var(--color-accent)' }}
                >
                  설정
                </a>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                ① 초대 코드와 별개입니다. 초대받은 학생이 GitHub 알림에서 직접 수락해야 권한이 켜집니다.
              </p>
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
                          {isOwnerMember ? '소유자' : githubName ? `@${githubName}` : 'GitHub 로그인 필요'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {githubMissingMembers.length > 0 && (
                <p className="mt-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  GitHub 로그인 필요: {githubMissingMembers.map(getMemberDisplay).join(', ')}
                </p>
              )}
              {githubInviteTargets.length > 0 && (
                <button
                  type="button"
                  onClick={handleGithubInviteKnownMembers}
                  disabled={githubBulkInviting}
                  className="mt-2 w-full border-none px-2 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text, white)',
                  }}
                >
                  {githubBulkInviting ? '초대 중' : `확인된 ${githubInviteTargets.length}명 초대`}
                </button>
              )}
              <form onSubmit={handleGithubInvite} className="mt-2 flex gap-1.5">
                <input
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  placeholder="username"
                  className="min-w-0 flex-1 border px-2 py-1 text-[11px] outline-none"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
                <button
                  type="submit"
                  disabled={githubInviting}
                  className="border-none px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text, white)',
                  }}
                >
                  {githubInviting ? '초대 중' : '초대'}
                </button>
              </form>
              {githubInviteMsg && (
                <div
                  className="mt-2 border-l-2 pl-2 py-1.5 text-[11px] leading-relaxed font-medium"
                  role={githubInviteTone === 'error' ? 'alert' : 'status'}
                  style={{
                    color: githubInviteMsgColor,
                    borderColor: githubInviteMsgColor,
                    backgroundColor: githubInviteTone === 'success'
                      ? 'color-mix(in srgb, var(--color-success, #047857) 8%, transparent)'
                      : githubInviteTone === 'error'
                        ? 'color-mix(in srgb, var(--color-danger, #dc2626) 8%, transparent)'
                        : 'transparent',
                  }}
                >
                  {githubInviteMsg}
                </div>
              )}

              {/* ── 수락 대기 중인 초대 ──
                  "초대 보냈는데 저장이 안 됐나?" 착각을 막는 핵심 UI.
                  invitee가 GitHub에서 수락하면 자동으로 목록에서 빠짐 + 멤버 목록의 @username으로 이동. */}
              {(pendingInvitations.length > 0 || pendingLoading || pendingError) && (
                <div
                  className="mt-3 border-t pt-2"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      수락 대기 중 ({pendingInvitations.length})
                    </p>
                    <button
                      onClick={loadPendingInvitations}
                      disabled={pendingLoading}
                      className="text-[10px] cursor-pointer border-none bg-transparent disabled:opacity-50"
                      style={{ color: 'var(--color-text-muted)' }}
                      title="새로고침"
                    >
                      {pendingLoading ? '확인 중…' : '↻'}
                    </button>
                  </div>
                  {pendingError && (
                    <p className="text-[10px]" style={{ color: 'var(--color-danger, #dc2626)' }}>
                      {pendingError}
                    </p>
                  )}
                  {pendingInvitations.length === 0 && !pendingLoading && !pendingError && (
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      대기 중인 초대가 없습니다.
                    </p>
                  )}
                  {pendingInvitations.map((inv) => {
                    const expired = inv.expired;
                    const isCancelling = cancellingId === inv.id;
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-1.5 py-1"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-mono truncate" style={{ color: 'var(--color-text-primary)' }}>
                              @{inv.invitee || '?'}
                            </span>
                            {expired && (
                              <span className="text-[9px] px-1" style={{ color: 'var(--color-danger, #dc2626)' }}>
                                만료
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}
                            {inv.permissions ? ` · ${inv.permissions}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {inv.htmlUrl && (
                            <a
                              href={inv.htmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] no-underline px-1.5 py-0.5"
                              style={{ color: 'var(--color-accent)' }}
                              title="GitHub에서 초대 확인"
                            >
                              열기
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCancelInvitation(inv)}
                            disabled={isCancelling}
                            className="text-[10px] cursor-pointer border-none bg-transparent disabled:opacity-50 px-1.5 py-0.5"
                            style={{ color: 'var(--color-text-muted)' }}
                            title="초대 취소"
                          >
                            {isCancelling ? '…' : '취소'}
                          </button>
                        </div>
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
          {activeMembers.length === 0 ? (
            <div className="p-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
              불러오는 중…
            </div>
          ) : (
            activeMembers.map((m) => {
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
