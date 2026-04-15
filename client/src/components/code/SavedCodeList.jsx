import { useEffect } from 'react';
import { useI18n } from '../../i18n';
import useCodeStore from '../../stores/codeStore';
import useAuthStore from '../../stores/authStore';

export default function SavedCodeList({ onLoadCode, onClose }) {
  const { savedCodes, loading, fetchSavedCodes, deleteCode } = useCodeStore();
  const { user } = useAuthStore();
  const { t } = useI18n();

  useEffect(() => {
    if (user) fetchSavedCodes();
  }, [user, fetchSavedCodes]);

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
                  {item.title}
                </h4>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCode(item.id); }}
                  className="text-[10px] cursor-pointer border-none bg-transparent ml-2 opacity-50 hover:opacity-100"
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
    </div>
  );
}
