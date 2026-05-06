/**
 * VPyLab — 팀 멤버 관리 모달
 * Phase 2 (Plan C): owner는 멤버 추방·역할 변경 가능. 일반 멤버는 본인 탈퇴만 가능.
 */
import { useEffect, useState } from 'react';
import useProjectStore from '../../stores/projectStore';
import useAuthStore from '../../stores/authStore';

export default function TeamMembersModal({ project, onClose }) {
  const { user } = useAuthStore();
  const { activeProject, activeMembers, openProject, removeMember, setMemberRole, leaveProject, regenerateInviteCode, deleteProject } = useProjectStore();

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (project?.id) openProject(project.id);
  }, [project?.id, openProject]);

  const isOwner = activeProject && user && activeProject.owner_id === user.id;
  const inviteCode = activeProject?.invite_code || project?.invite_code || '';
  const inviteUrl = inviteCode ? `${window.location.origin}/?team=${inviteCode}` : '';

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

  const handleDelete = async () => {
    if (!window.confirm('정말 이 팀 프로젝트를 삭제하시겠어요?\n관련 코드와 이력이 모두 함께 삭제됩니다.')) return;
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
          <p className="text-[11px] mb-1.5" style={{ color: 'var(--color-text-muted)' }}>초대 코드</p>
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
              const display = m.profile?.display_name || m.user_id.slice(0, 8);
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
          className="p-3 border-t flex justify-between items-center"
          style={{ borderColor: 'var(--color-border)' }}
        >
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
  );
}
