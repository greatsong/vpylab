import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';
import useAppStore from '../../stores/appStore';
import useAuthStore from '../../stores/authStore';

export default function Header() {
  const { theme, setTheme, locale, setLocale, THEMES } = useAppStore();
  const { user, profile, signOut, setAuthModalOpen } = useAuthStore();
  const isTeacher = useAuthStore((s) => s.isTeacher());
  const { t } = useI18n();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navItems = [
    { key: 'home', path: '/' },
    { key: 'sandbox', path: '/sandbox' },
    { key: 'missions', path: '/missions' },
    { key: 'gallery', path: '/gallery' },
    ...(isTeacher ? [{ key: 'dashboard', path: '/dashboard' }] : []),
    { key: 'about', path: '/about' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header
      className="flex items-center justify-between px-6 py-3 border-b sticky top-0 z-50"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-panel)',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* 로고 */}
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <svg width="28" height="28" viewBox="0 0 28 28">
          <line x1="14" y1="14" x2="24" y2="20" stroke="#FF6B6B" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="14" y1="14" x2="14" y2="4" stroke="#00B894" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="14" y1="14" x2="6" y2="20" stroke="#6C5CE7" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="14" cy="14" r="3" fill="#6C5CE7"/>
        </svg>
        <span className="font-display text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          VPyLab
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
          style={{ backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
        >
          {t('app.version')}
        </span>
      </Link>

      {/* 네비게이션 */}
      <nav className="hidden md:flex items-center gap-1">
        {navItems.map(({ key, path }) => (
          <Link
            key={key}
            to={path}
            className="text-sm no-underline px-3 py-1.5 rounded-lg transition-all font-medium"
            style={{
              color: isActive(path) ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              backgroundColor: isActive(path) ? 'var(--color-accent-bg)' : 'transparent',
            }}
          >
            {t(`nav.${key}`)}
          </Link>
        ))}
      </nav>

      {/* 컨트롤 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
          className="text-xs px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}
        >
          {locale === 'ko' ? 'EN' : '한'}
        </button>

        <button
          onClick={() => {
            const idx = THEMES.indexOf(theme);
            setTheme(THEMES[(idx + 1) % THEMES.length]);
          }}
          className="w-8 h-8 rounded-lg transition-all cursor-pointer border flex items-center justify-center"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'transparent' }}
          title={t('settings.theme')}
        >
          {theme === 'creative-light' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--color-text-secondary)">
              <circle cx="8" cy="8" r="3.5"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--color-text-secondary)">
              <path d="M14 10a6 6 0 01-8-8 6 6 0 108 8z"/>
            </svg>
          )}
        </button>

        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer border transition-all"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'transparent' }}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-5 h-5 rounded-full" />
              ) : (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}>
                  {(profile?.display_name || '?')[0].toUpperCase()}
                </span>
              )}
              <span className="text-xs hidden sm:inline font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {profile?.display_name || t('auth.user')}
              </span>
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-48 rounded-xl py-1.5 z-50"
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  border: '1.5px solid var(--color-border)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                }}
              >
                <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {profile?.display_name}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {profile?.role === 'teacher' ? t('auth.teacher') : t('auth.student')}
                  </p>
                </div>
                {[
                  { href: '/sandbox', label: t('auth.myCode') },
                  ...(isTeacher ? [{ href: '/dashboard', label: t('nav.dashboard') }] : []),
                ].map(item => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="block px-4 py-2 text-xs no-underline transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  onClick={() => { signOut(); setDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs cursor-pointer border-none bg-transparent transition-colors"
                  style={{ color: 'var(--color-error)' }}
                >
                  {t('auth.logout')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="btn-primary text-xs !py-2 !px-4 !text-[13px]"
          >
            {t('auth.login')}
          </button>
        )}
      </div>
    </header>
  );
}
