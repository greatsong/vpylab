import { useI18n } from '../../i18n';
import useAuthStore from '../../stores/authStore';

export default function AuthModal() {
  const { authModalOpen, setAuthModalOpen, signInWithGoogle, signInWithGitHub } = useAuthStore();
  const { t } = useI18n();

  if (!authModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
      onClick={() => setAuthModalOpen(false)}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-8"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 cursor-pointer border-none bg-transparent p-1.5 rounded-lg transition-all"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.5 3L8 6.5 11.5 3 13 4.5 9.5 8 13 11.5 11.5 13 8 9.5 4.5 13 3 11.5 6.5 8 3 4.5 4.5 3z"/>
          </svg>
        </button>

        {/* 로고 + 타이틀 */}
        <div className="flex items-center gap-2.5 mb-2">
          <svg width="24" height="24" viewBox="0 0 28 28">
            <line x1="14" y1="14" x2="24" y2="20" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="14" y1="14" x2="14" y2="4" stroke="#00B894" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="14" y1="14" x2="6" y2="20" stroke="#6C5CE7" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="14" cy="14" r="3" fill="#6C5CE7"/>
          </svg>
          <h2 className="text-xl font-bold">{t('auth.login')}</h2>
        </div>

        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          {t('auth.loginDescription')}
        </p>

        {/* 소셜 버튼 */}
        <div className="flex flex-col gap-3">
          <button
            onClick={signInWithGoogle}
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl font-medium cursor-pointer border transition-all"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4285F4'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(66,133,244,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            {t('auth.googleLogin')}
          </button>

          <button
            onClick={signInWithGitHub}
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl font-medium cursor-pointer border-none transition-all"
            style={{ backgroundColor: '#24292f', color: '#fff' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1b1f23'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#24292f'}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            {t('auth.githubLogin')}
          </button>
        </div>

        {/* 안내 */}
        <p className="text-xs mt-5 text-center leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {t('auth.notice')}
        </p>
      </div>
    </div>
  );
}
