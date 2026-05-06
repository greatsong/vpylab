/**
 * VPyLab — 팀 프로젝트 메인 패널
 * Phase 2 (Plan C): 내 팀 프로젝트 목록 + 새로 만들기 + 초대 코드로 합류.
 */
import { useEffect, useState } from 'react';
import useProjectStore from '../../stores/projectStore';
import useAuthStore from '../../stores/authStore';
import TeamMembersModal from './TeamMembersModal';

export default function TeamProjectsPanel({ onOpenProject, onClose }) {
  const { user } = useAuthStore();
  const { myProjects, loadingProjects, fetchMyProjects, createProject, joinByInviteCode } = useProjectStore();

  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [membersTarget, setMembersTarget] = useState(null);

  useEffect(() => {
    if (user) fetchMyProjects();
  }, [user, fetchMyProjects]);

  const handleCreate = async () => {
    const title = window.prompt('새 팀 프로젝트 이름은?');
    if (!title) return;
    setCreateBusy(true);
    const { error } = await createProject({ title: title.slice(0, 80) });
    setCreateBusy(false);
    if (error) window.alert(`생성 실패: ${error.message || '알 수 없는 오류'}`);
  };

  const handleJoin = async () => {
    setJoinError('');
    if (!inviteCode.trim()) {
      setJoinError('초대 코드를 입력해주세요.');
      return;
    }
    setJoining(true);
    const { data, error } = await joinByInviteCode(inviteCode);
    setJoining(false);
    if (error) {
      setJoinError(error.message);
      return;
    }
    setInviteCode('');
    if (onOpenProject && data?.projectId) onOpenProject(data.projectId);
  };

  if (!user) {
    return (
      <div
        className="fixed right-0 top-0 h-full w-96 z-50 shadow-xl flex flex-col"
        style={{ backgroundColor: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>👥 팀 프로젝트</h3>
          <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-lg" style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>로그인 후 이용할 수 있어요.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed right-0 top-0 h-full w-96 z-50 shadow-xl flex flex-col"
      style={{ backgroundColor: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-border)' }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>👥 팀 프로젝트</h3>
        <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-lg" style={{ color: 'var(--color-text-muted)' }}>✕</button>
      </div>

      {/* 합류 영역 */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>팀원이 보낸 초대 코드로 합류</p>
        <div className="flex gap-2">
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
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
            className="px-3 py-1.5 text-xs rounded cursor-pointer border-none disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text, white)' }}
          >
            {joining ? '합류 중…' : '합류'}
          </button>
        </div>
        {joinError && (
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-error, #e03131)' }}>{joinError}</p>
        )}
      </div>

      {/* 새로 만들기 */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={handleCreate}
          disabled={createBusy}
          className="w-full py-2 text-xs rounded cursor-pointer border disabled:opacity-50"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          ＋ 빈 팀 프로젝트 만들기
        </button>
        <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
          저장된 코드를 팀으로 변환하려면 코드 패널에서 “👥 팀” 버튼을 누르세요.
        </p>
      </div>

      {/* 내 프로젝트 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-[11px] px-2 py-1" style={{ color: 'var(--color-text-muted)' }}>
          내 프로젝트 ({myProjects.length})
        </p>
        {loadingProjects ? (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>불러오는 중…</div>
        ) : myProjects.length === 0 ? (
          <div className="p-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            아직 팀 프로젝트가 없어요.<br />위에서 새로 만들거나 초대 코드로 합류하세요.
          </div>
        ) : (
          myProjects.map((p) => (
            <div
              key={p.id}
              className="p-2.5 mx-1 my-1 rounded-lg"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <h4
                  className="text-xs font-medium truncate flex-1 cursor-pointer hover:opacity-80"
                  style={{ color: 'var(--color-text-primary)' }}
                  onClick={() => onOpenProject && onOpenProject(p.id)}
                >
                  {p.title}
                </h4>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded ml-2"
                  style={{
                    backgroundColor: 'var(--color-accent-bg)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {p.my_role === 'owner' ? '소유자' : p.my_role === 'editor' ? '편집' : '보기'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                  코드 {p.invite_code}
                </span>
                <button
                  onClick={() => setMembersTarget(p)}
                  className="text-[10px] cursor-pointer border-none bg-transparent opacity-70 hover:opacity-100"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  멤버 관리
                </button>
              </div>
            </div>
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
