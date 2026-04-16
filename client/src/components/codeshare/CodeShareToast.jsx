import { useEffect } from 'react';
import { useI18n } from '../../i18n';

export default function CodeShareToast({ visible, onDismiss, onOpen }) {
  const { t } = useI18n();

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-50 flex items-center gap-3 rounded-xl cursor-pointer"
      style={{
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
        padding: '12px 20px',
        maxWidth: '420px',
        animation: 'slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={onOpen}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: 'var(--color-accent-light, #DBEAFE)' }}
      >
        📩
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {t('codeShare.newCodeReceived')}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {t('codeShare.clickToOpen')}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        className="py-1.5 px-3.5 rounded-md text-xs font-semibold cursor-pointer flex-shrink-0"
        style={{
          backgroundColor: 'var(--color-accent)',
          color: 'white',
          border: 'none',
          fontFamily: 'inherit',
        }}
      >
        {t('codeShare.open')}
      </button>

      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(80px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
