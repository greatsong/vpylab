import { useI18n } from '../../i18n';
import useAuthStore from '../../stores/authStore';

export default function AuthModal() {
  const { authModalOpen, setAuthModalOpen, signInWithGoogle, signInWithGitHub } = useAuthStore();
  const { t } = useI18n();

  if (!authModalOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={() => setAuthModalOpen(false)}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        {/* 닫기 */}
        <button className="auth-close" onClick={() => setAuthModalOpen(false)} aria-label="닫기">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M13.5 4.5L4.5 13.5M4.5 4.5l9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* 상단 장식 */}
        <div className="auth-header-glow" />

        {/* 로고 + 타이틀 */}
        <div className="auth-logo">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="18" fill="url(#authLogoGrad)" />
            <line x1="18" y1="18" x2="26" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
            <line x1="18" y1="18" x2="18" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
            <line x1="18" y1="18" x2="11" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
            <circle cx="18" cy="18" r="2.5" fill="white"/>
            <defs>
              <linearGradient id="authLogoGrad" x1="0" y1="0" x2="36" y2="36">
                <stop stopColor="#6C5CE7" /><stop offset="1" stopColor="#4A6CF7" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h2 className="auth-title">{t('auth.login')}</h2>
        <p className="auth-desc">{t('auth.loginDescription')}</p>

        {/* 소셜 버튼 */}
        <div className="auth-buttons">
          <button onClick={signInWithGoogle} className="auth-btn auth-btn-google">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            {t('auth.googleLogin')}
          </button>

          <button onClick={signInWithGitHub} className="auth-btn auth-btn-github">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            {t('auth.githubLogin')}
          </button>
        </div>

        {/* 구분선 */}
        <div className="auth-divider">
          <span>또는</span>
        </div>

        {/* 안내 */}
        <p className="auth-notice">{t('auth.notice')}</p>
      </div>

      <style>{`
        .auth-modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(8px);
          animation: authFadeIn 0.2s ease;
        }
        @keyframes authFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes authSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .auth-modal {
          position: relative;
          width: 100%; max-width: 380px;
          border-radius: var(--radius-xl, 20px);
          padding: 36px 32px 28px;
          background: var(--color-bg-panel, #1E1E24);
          border: 1px solid var(--color-border, #2E2E38);
          box-shadow: 0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04) inset;
          overflow: hidden;
          animation: authSlideUp 0.3s ease;
          font-family: var(--font-body, 'DM Sans', sans-serif);
        }

        /* 상단 장식 그라데이션 */
        .auth-header-glow {
          position: absolute; top: 0; left: 0; right: 0; height: 120px;
          background: linear-gradient(180deg, rgba(108, 92, 231, 0.08) 0%, transparent 100%);
          pointer-events: none;
        }

        .auth-close {
          position: absolute; top: 16px; right: 16px;
          background: none; border: none; cursor: pointer;
          color: var(--color-text-muted, #72757E);
          padding: 6px; border-radius: 8px;
          transition: all 0.15s; z-index: 1;
        }
        .auth-close:hover {
          background: var(--color-bg-tertiary, #26262E);
          color: var(--color-text-primary, #FFFFFE);
        }

        .auth-logo {
          position: relative; z-index: 1;
          margin-bottom: 16px;
        }

        .auth-title {
          position: relative; z-index: 1;
          margin: 0 0 8px; font-size: 22px; font-weight: 700;
          font-family: var(--font-display, 'Satoshi', sans-serif);
          color: var(--color-text-primary, #FFFFFE);
        }

        .auth-desc {
          position: relative; z-index: 1;
          margin: 0 0 24px;
          font-size: 14px; line-height: 1.5;
          color: var(--color-text-secondary, #94A1B2);
        }

        .auth-buttons {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; gap: 10px;
        }

        .auth-btn {
          display: flex; align-items: center; justify-content: center;
          gap: 10px; width: 100%;
          padding: 13px 16px; border-radius: var(--radius-md, 12px);
          font-size: 14px; font-weight: 600; cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .auth-btn-google {
          background: var(--color-bg-secondary, #F0F1F5);
          border: 1px solid var(--color-border, #E5E6EE);
          color: var(--color-text-primary, #1A1A2E);
        }
        .auth-btn-google:hover {
          border-color: #4285F4;
          box-shadow: 0 2px 12px rgba(66, 133, 244, 0.15);
          transform: translateY(-1px);
        }

        .auth-btn-github {
          background: linear-gradient(135deg, #24292f, #1b1f23);
          border: none; color: #fff;
        }
        .auth-btn-github:hover {
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
          transform: translateY(-1px);
        }
        .auth-btn:active { transform: translateY(0); }

        .auth-divider {
          position: relative; z-index: 1;
          display: flex; align-items: center;
          margin: 20px 0 16px; gap: 12px;
        }
        .auth-divider::before,
        .auth-divider::after {
          content: ''; flex: 1; height: 1px;
          background: var(--color-border, #2E2E38);
        }
        .auth-divider span {
          font-size: 12px; color: var(--color-text-muted, #72757E);
          white-space: nowrap;
        }

        .auth-notice {
          position: relative; z-index: 1;
          text-align: center; margin: 0;
          font-size: 12px; line-height: 1.6;
          color: var(--color-text-muted, #72757E);
        }
      `}</style>
    </div>
  );
}
