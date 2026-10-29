import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/useI18n';
import {
  getInstallState, subscribeInstallState, promptInstall, shouldShowIosHint, dismissIosHint,
} from '../../lib/pwa-install';

/** 헤더의 "앱으로 설치" 버튼. 브라우저가 설치 프롬프트를 준 동안만 보이고, 설치 뒤에는 숨깁니다. */
export function InstallButton() {
  const { t } = useI18n();
  const state = useSyncExternalStore(subscribeInstallState, getInstallState, getInstallState);
  if (!state.canPrompt) return null;
  return (
    <button
      type="button"
      onClick={() => { void promptInstall(); }}
      className="h-8 px-2.5 rounded-md transition-all cursor-pointer border flex items-center gap-1.5 text-xs font-semibold"
      style={{ borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
      title={t('pwa.installTitle')}
      data-testid="pwa-install-button"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13h10" />
      </svg>
      <span className="hidden sm:inline">{t('pwa.install')}</span>
    </button>
  );
}

/** iOS Safari용 한 번짜리 안내. 닫으면 localStorage에 기억합니다. */
export function IosInstallHint() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => shouldShowIosHint());
  if (!visible) return null;
  const close = () => { dismissIosHint(); setVisible(false); };
  return createPortal(
    <div
      role="status"
      className="fixed left-4 right-4 bottom-4 z-[60] rounded-xl px-4 py-3 flex items-start gap-3 text-sm"
      style={{
        backgroundColor: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12))',
        color: 'var(--color-text-primary)',
        maxWidth: 520,
        marginInline: 'auto',
      }}
      data-testid="ios-install-hint"
    >
      <span className="text-lg leading-none" aria-hidden="true">📲</span>
      <p className="flex-1 m-0 leading-relaxed">{t('pwa.iosHint')}</p>
      <button
        type="button"
        onClick={close}
        className="shrink-0 text-xs px-2 py-1 rounded-md cursor-pointer border"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}
      >
        {t('pwa.dismiss')}
      </button>
    </div>,
    document.body,
  );
}
