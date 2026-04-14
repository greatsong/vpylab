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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // 페이지 이동 시 모바일 메뉴 닫기
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { key: 'home', path: '/' },
    { key: 'sandbox', path: '/sandbox' },
    { key: 'missions', path: '/missions' },
    { key: 'gallery', path: '/gallery' },
    { key: 'aiLab', path: '/ai-lab' },
    ...(isTeacher ? [{ key: 'dashboard', path: '/dashboard' }] : []),
    { key: 'about', path: '/about' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header
      className="relative flex items-center justify-between px-4 md:px-6 py-3 border-b sticky top-0 z-50"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-panel)',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* 로고 */}
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <svg width="28" height="28" viewBox="0 0 48 48">
          <defs>
            <radialGradient id="h-sv" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#B8A9FF"/><stop offset="50%" stopColor="#6C5CE7"/><stop offset="100%" stopColor="#4834B0"/></radialGradient>
            <radialGradient id="h-sc" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#FFB3A7"/><stop offset="50%" stopColor="#FF6B6B"/><stop offset="100%" stopColor="#C44569"/></radialGradient>
            <radialGradient id="h-sm" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#7DFFDA"/><stop offset="50%" stopColor="#00B894"/><stop offset="100%" stopColor="#00876A"/></radialGradient>
            <linearGradient id="h-ba" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFEAA7"/><stop offset="100%" stopColor="#FDCB6E"/></linearGradient>
            <linearGradient id="h-bs" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#81ECEC"/><stop offset="100%" stopColor="#00CEC9"/></linearGradient>
          </defs>
          {/* 5선지 */}
          {[12,18,24,30,36].map(y=><line key={y} x1="3" y1={y} x2="45" y2={y} stroke="#D5C8F0" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>)}
          {/* 줄기 */}
          <line x1="12" y1="10" x2="12" y2="28" stroke="#6C5CE7" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
          <line x1="24" y1="8" x2="24" y2="20" stroke="#00B894" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
          <line x1="36" y1="14" x2="36" y2="32" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
          {/* 꼬리 */}
          <path d="M12 10 C15 10, 16 13, 14 15" stroke="#6C5CE7" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5"/>
          <path d="M24 8 C27 8, 28 11, 26 13" stroke="#00B894" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5"/>
          <path d="M36 14 C39 14, 40 17, 38 19" stroke="#FF6B6B" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5"/>
          {/* 구/박스 음표 머리 */}
          <circle cx="12" cy="30" r="4.5" fill="url(#h-sv)"/>
          <ellipse cx="10.8" cy="28.5" rx="1.5" ry="1" fill="white" opacity="0.45"/>
          <rect x="20.5" y="17" width="7" height="7" rx="1" fill="url(#h-ba)" transform="rotate(15, 24, 20.5)"/>
          <circle cx="36" cy="34" r="4" fill="url(#h-sc)"/>
          <ellipse cx="34.8" cy="32.8" rx="1.3" ry="0.8" fill="white" opacity="0.45"/>
          <circle cx="42" cy="13" r="2.5" fill="url(#h-sm)"/>
          <rect x="5" y="38" width="5" height="5" rx="0.8" fill="url(#h-bs)" transform="rotate(-10, 7.5, 40.5)"/>
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

      {/* 네비게이션 (데스크톱) */}
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

      {/* 모바일 햄버거 메뉴 */}
      <button
        className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
        style={{ backgroundColor: 'transparent', border: 'none', order: -1, marginRight: 4 }}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="메뉴"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round">
          {mobileMenuOpen ? (
            <>
              <line x1="5" y1="5" x2="15" y2="15" />
              <line x1="15" y1="5" x2="5" y2="15" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="17" y2="6" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="14" x2="17" y2="14" />
            </>
          )}
        </svg>
      </button>

      {/* 모바일 메뉴 오버레이 */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-[200]"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="flex flex-col w-[280px] h-full py-6 px-5"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 메뉴 헤더 */}
            <div className="flex items-center gap-2.5 mb-6 px-1">
              <svg width="24" height="24" viewBox="0 0 48 48">
                <defs>
                  <radialGradient id="m-sv" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#B8A9FF"/><stop offset="50%" stopColor="#6C5CE7"/><stop offset="100%" stopColor="#4834B0"/></radialGradient>
                  <radialGradient id="m-sc" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#FFB3A7"/><stop offset="50%" stopColor="#FF6B6B"/><stop offset="100%" stopColor="#C44569"/></radialGradient>
                  <radialGradient id="m-sm" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#7DFFDA"/><stop offset="50%" stopColor="#00B894"/><stop offset="100%" stopColor="#00876A"/></radialGradient>
                  <linearGradient id="m-ba" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFEAA7"/><stop offset="100%" stopColor="#FDCB6E"/></linearGradient>
                  <linearGradient id="m-bs2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#81ECEC"/><stop offset="100%" stopColor="#00CEC9"/></linearGradient>
                </defs>
                {[12,18,24,30,36].map(y=><line key={y} x1="3" y1={y} x2="45" y2={y} stroke="#D5C8F0" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>)}
                <line x1="12" y1="10" x2="12" y2="28" stroke="#6C5CE7" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                <line x1="24" y1="8" x2="24" y2="20" stroke="#00B894" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                <line x1="36" y1="14" x2="36" y2="32" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                <path d="M12 10 C15 10, 16 13, 14 15" stroke="#6C5CE7" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5"/>
                <path d="M24 8 C27 8, 28 11, 26 13" stroke="#00B894" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5"/>
                <path d="M36 14 C39 14, 40 17, 38 19" stroke="#FF6B6B" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5"/>
                <circle cx="12" cy="30" r="4.5" fill="url(#m-sv)"/>
                <ellipse cx="10.8" cy="28.5" rx="1.5" ry="1" fill="white" opacity="0.45"/>
                <rect x="20.5" y="17" width="7" height="7" rx="1" fill="url(#m-ba)" transform="rotate(15, 24, 20.5)"/>
                <circle cx="36" cy="34" r="4" fill="url(#m-sc)"/>
                <circle cx="42" cy="13" r="2.5" fill="url(#m-sm)"/>
                <rect x="5" y="38" width="5" height="5" rx="0.8" fill="url(#m-bs2)" transform="rotate(-10, 7.5, 40.5)"/>
              </svg>
              <span className="font-display text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                VPyLab
              </span>
            </div>

            {/* 네비게이션 */}
            <nav className="flex flex-col gap-1 flex-1">
              {navItems.map(({ key, path }) => {
                const icons = {
                  home: <path d="M3 10L12 3L21 10V20C21 20.55 20.55 21 20 21H15V14H9V21H4C3.45 21 3 20.55 3 20V10Z" fill="currentColor"/>,
                  sandbox: <><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M8 8L16 8M8 12L13 12M8 16L15 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
                  missions: <><path d="M4 6H20M4 6V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V6M4 6L6 2H18L20 6" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M9 10L11 12L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
                  gallery: <><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none"/><circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M3 16L8 11L13 16L16 13L21 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
                  aiLab: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M8 12C8 9 10 7 12 7C14 7 16 9 16 12C16 15 14 17 12 17" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="2" fill="currentColor"/></>,
                  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none"/></>,
                  about: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
                };
                const active = isActive(path);
                return (
                  <Link
                    key={key}
                    to={path}
                    className="flex items-center gap-3 text-sm no-underline px-3 py-3 rounded-xl transition-all font-medium"
                    style={{
                      color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      backgroundColor: active ? 'var(--color-accent-bg)' : 'transparent',
                    }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                      style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)', flexShrink: 0 }}>
                      {icons[key] || icons.about}
                    </svg>
                    {t(`nav.${key}`)}
                  </Link>
                );
              })}
            </nav>

            {/* 하단 정보 */}
            <div className="pt-4 mt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-[11px] px-3" style={{ color: 'var(--color-text-muted)' }}>
                VPyLab — 3D 프로그래밍 교육 플랫폼
              </p>
            </div>
          </div>
        </div>
      )}

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
