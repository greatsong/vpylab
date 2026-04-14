import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n';
import useAppStore from '../../stores/appStore';
import useAuthStore from '../../stores/authStore';

const THEME_ICONS = {
  'deep-space': '🌌',
  'neon-lab': '💜',
  'forest-night': '🌲',
  'clean-white': '☀️',
};

export default function Header() {
  const { theme, setTheme, locale, setLocale, THEMES } = useAppStore();
  const { user, profile, signOut, setAuthModalOpen } = useAuthStore();
  const isTeacher = useAuthStore((s) => s.isTeacher());
  const { t } = useI18n();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navItems = ['home', 'sandbox', 'missions', 'gallery'];
  if (isTeacher) navItems.push('dashboard');
  navItems.push('about');

  return (
    <header
      className="flex items-center justify-between px-5 py-3 border-b backdrop-blur-sm sticky top-0 z-50"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 85%, transparent)',
      }}
    >
      {/* 로고 */}
      <div className="flex items-center gap-3">
        <a href="/" className="flex items-center gap-2 no-underline">
          <svg width="28" height="28" viewBox="0 0 28 28">
            <line x1="14" y1="14" x2="24" y2="20" stroke="#ff6b6b" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="14" y1="14" x2="14" y2="4" stroke="#51cf66" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="14" y1="14" x2="6" y2="20" stroke="#339af0" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="14" cy="14" r="3" fill="var(--brand-primary)"/>
          </svg>
          <span className="text-xl font-bold" style={{
            background: 'var(--brand-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {t('app.title')}
          </span>
        </a>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
        >
          {t('app.version')}
        </span>
      </div>

      {/* 네비게이션 */}
      <nav className="hidden md:flex items-center gap-6">
        {navItems.map((key) => (
          <a
            key={key}
            href={key === 'home' ? '/' : `/${key}`}
            className="text-sm no-underline transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t(`nav.${key}`)}
          </a>
        ))}
      </nav>

      {/* 컨트롤 */}
      <div className="flex items-center gap-2">
        {/* 언어 토글 */}
        <button
          onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
          className="text-xs px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border-none"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-primary)',
          }}
          title={t('settings.language')}
        >
          {locale === 'ko' ? 'EN' : '한'}
        </button>

        {/* 테마 순환 */}
        <button
          onClick={() => {
            const idx = THEMES.indexOf(theme);
            setTheme(THEMES[(idx + 1) % THEMES.length]);
          }}
          className="text-sm px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border-none"
          style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
          title={t('settings.theme')}
        >
          {THEME_ICONS[theme]}
        </button>

        {/* 로그인/프로필 */}
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer border-none transition-all"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
                >
                  {(profile?.display_name || '?')[0].toUpperCase()}
                </span>
              )}
              <span className="text-xs hidden sm:inline" style={{ color: 'var(--color-text-primary)' }}>
                {profile?.display_name || t('auth.user')}
              </span>
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-lg py-2 z-50"
                style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
              >
                <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {profile?.display_name}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    {profile?.role === 'teacher' ? t('auth.teacher') : t('auth.student')}
                  </p>
                </div>
                <a
                  href="/sandbox"
                  className="block px-4 py-2 text-xs no-underline hover:opacity-80"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onClick={() => setDropdownOpen(false)}
                >
                  {t('auth.myCode')}
                </a>
                {isTeacher && (
                  <a
                    href="/dashboard"
                    className="block px-4 py-2 text-xs no-underline hover:opacity-80"
                    style={{ color: 'var(--color-text-secondary)' }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    {t('nav.dashboard')}
                  </a>
                )}
                <button
                  onClick={() => { signOut(); setDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs cursor-pointer border-none bg-transparent hover:opacity-80"
                  style={{ color: 'var(--color-error, #e03131)' }}
                >
                  {t('auth.logout')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg cursor-pointer border-none font-medium transition-all"
            style={{
              background: 'var(--brand-gradient)',
              color: '#fff',
            }}
          >
            {t('auth.login')}
          </button>
        )}
      </div>
    </header>
  );
}
