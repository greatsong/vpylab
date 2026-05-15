import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import useCodeStore from '../../stores/codeStore';
import useAuthStore from '../../stores/authStore';
import useProjectStore from '../../stores/projectStore';
import RevisionTimeline from './RevisionTimeline';
import TeamMembersModal from '../team/TeamMembersModal';

export default function SavedCodeList({ onLoadCode, onClose }) {
  const { savedCodes, loading, fetchSavedCodes, deleteCode } = useCodeStore();
  const { user } = useAuthStore();
  const { createProject } = useProjectStore();
  const { t } = useI18n();

  // 이력 패널 상태 (선택된 코드 1건의 revision 타임라인)
  const [historyTarget, setHistoryTarget] = useState(null);  // { id, title } | null
  // 팀 멤버 모달 상태
  const [teamTarget, setTeamTarget] = useState(null);  // { id, title } | null
  const [convertingId, setConvertingId] = useState(null);

  useEffect(() => {
    if (user) fetchSavedCodes();
  }, [user, fetchSavedCodes]);

  const handleMakeTeam = async (item) => {
    if (item.project_id) {
      // 이미 팀 코드면 멤버 관리 모달
      setTeamTarget({ id: item.project_id, title: item.title });
      return;
    }
    const teamTitle = window.prompt('팀 프로젝트 이름은? (취소하면 기존 코드 제목 사용)', item.title);
    if (teamTitle === null) return;  // 사용자가 취소
    setConvertingId(item.id);
    const { data, error } = await createProject({
      title: teamTitle || item.title,
      fromCodeId: item.id,
    });
    setConvertingId(null);
    if (error) {
      window.alert(`팀 변환 실패: ${error.message}`);
      return;
    }
    fetchSavedCodes();  // 코드 목록의 project_id 표시 갱신
    if (data?.id) setTeamTarget({ id: data.id, title: data.title });
  };

  if (!user) {
    return (
      <div
        className="fixed right-0 top-0 h-full w-80 z-50 shadow-xl flex flex-col"
        style={{ backgroundColor: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{t('code.savedCodes')}</h3>
          <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-lg" style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>{t('code.loginRequired')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed right-0 top-0 h-full w-80 z-50 shadow-xl flex flex-col"
      style={{ backgroundColor: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-border)' }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{t('code.savedCodes')}</h3>
        <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-lg" style={{ color: 'var(--color-text-muted)' }}>✕</button>
      </div>

      {/* 코드 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
          </div>
        ) : savedCodes.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('code.noSavedCodes')}</p>
          </div>
        ) : (
          savedCodes.map((item) => (
            <div
              key={item.id}
              className="p-3 mx-3 my-2 rounded-lg cursor-pointer transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <h4
                  className="text-xs font-medium truncate flex-1"
                  style={{ color: 'var(--color-text-primary)' }}
                  onClick={() => { onLoadCode(item.code, item.id); onClose(); }}
                >
                  {item.project_id && '👥 '}{item.title}
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setHistoryTarget({ id: item.id, title: item.title });
                  }}
                  className="text-[10px] cursor-pointer border-none bg-transparent ml-2 opacity-70 hover:opacity-100"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title="이 코드의 저장 이력 보기"
                >
                  📜 이력
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleMakeTeam(item); }}
                  disabled={convertingId === item.id}
                  className="text-[10px] cursor-pointer border-none bg-transparent ml-1 opacity-60 hover:opacity-100 disabled:opacity-30"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title={item.project_id ? '팀 멤버 관리' : '팀 프로젝트로 변환'}
                >
                  {item.project_id ? '👥' : '＋팀'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCode(item.id); }}
                  className="text-[10px] cursor-pointer border-none bg-transparent ml-1 opacity-50 hover:opacity-100"
                  style={{ color: 'var(--color-error, #e03131)' }}
                >
                  {t('common.delete')}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {item.mission_id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}>
                    {item.mission_id}
                  </span>
                )}
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(item.updated_at).toLocaleDateString()}
                </span>
              </div>
              <pre
                className="text-[10px] mt-1.5 max-h-12 overflow-hidden opacity-60"
                style={{ color: 'var(--color-text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {item.code.slice(0, 120)}...
              </pre>
            </div>
          ))
        )}
      </div>

      {/* 이력 패널 (특정 코드 선택 시 우측에 오버레이로 표시) */}
      {historyTarget && (
        <RevisionTimeline
          codeId={historyTarget.id}
          codeTitle={historyTarget.title}
          onClose={() => setHistoryTarget(null)}
          onRestored={(snapshotCode) => {
            // 복원 후 에디터에 즉시 반영하고 패널 닫기
            onLoadCode(snapshotCode, historyTarget.id);
            setHistoryTarget(null);
            onClose();
          }}
        />
      )}

      {/* 팀 멤버 모달 */}
      {teamTarget && (
        <TeamMembersModal
          project={{ id: teamTarget.id, title: teamTarget.title }}
          onClose={() => setTeamTarget(null)}
        />
      )}
    </div>
  );
}
