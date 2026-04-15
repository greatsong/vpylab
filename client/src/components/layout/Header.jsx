import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';
import useAppStore from '../../stores/appStore';
import useAuthStore from '../../stores/authStore';
import { prewarm } from '../../engine/pyodide-singleton';

export default function Header() {
  const { theme, setTheme, locale, setLocale, THEMES, THEME_META } = useAppStore();
  const { user, profile, signOut, setAuthModalOpen } = useAuthStore();
  const isTeacher = useAuthStore((s) => s.isTeacher());
  const { t } = useI18n();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const themeDropdownRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target)) {
        setThemeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // 페이지 이동 시 모바일 메뉴 닫기
  useEffect(() => {
    setMobileMenuOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [location.pathname]);

  const navItems = [
    { key: 'sandbox', path: '/sandbox' },
    { key: 'missions', path: '/missions' },
    { key: 'gallery', path: '/gallery' },
    { key: 'docs', path: '/docs' },
    ...(isTeacher ? [{ key: 'dashboard', path: '/dashboard' }] : []),
  ];

  const isActive = (path) => location.pathname === path;

  // Pyodide Worker를 미리 워밍업하는 라우트
  const prewarmPaths = new Set(['/sandbox', '/missions']);
  const handlePrewarm = useCallback((path) => {
    if (prewarmPaths.has(path)) prewarm();
  }, []);

  return (
    <header
      className="relative flex items-center justify-between px-4 md:px-6 h-14 border-b sticky top-0 z-50"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-panel)',
      }}
    >
      {/* 로고 */}
      <Link to="/" className="flex items-center gap-2 no-underline">
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
          <line x1="14" y1="14" x2="24" y2="20" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="14" y1="14" x2="14" y2="4" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="14" y1="14" x2="6" y2="20" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="14" cy="14" r="2.5" fill="#2563EB"/>
        </svg>
        <span className="font-display text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
          VPyLab
        </span>
      </Link>

      {/* 네비게이션 (데스크톱) */}
      <nav className="hidden md:flex items-center gap-1">
        {navItems.map(({ key, path }) => (
          <Link
            key={key}
            to={path}
            className="nav-link text-[13px] no-underline px-4 py-1.5 rounded-full transition-all font-semibold"
            style={{
              color: isActive(path) ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              backgroundColor: isActive(path) ? 'var(--color-accent-bg)' : 'transparent',
              border: isActive(path) ? '1px solid var(--color-accent)' : '1px solid transparent',
            }}
            onMouseEnter={() => handlePrewarm(path)}
            onFocus={() => handlePrewarm(path)}
          >
            {t(`nav.${key}`)}
          </Link>
        ))}
      </nav>

      {/* 모바일 햄버거 */}
      <button
        className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
        style={{ backgroundColor: 'transparent', border: 'none', order: -1, marginRight: 4 }}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="메뉴"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-primary)" strokeWidth="1.5" strokeLinecap="round">
          {mobileMenuOpen ? (
            <>
              <line x1="5" y1="5" x2="13" y2="13" />
              <line x1="13" y1="5" x2="5" y2="13" />
            </>
          ) : (
            <>
              <line x1="3" y1="5" x2="15" y2="5" />
              <line x1="3" y1="9" x2="15" y2="9" />
              <line x1="3" y1="13" x2="15" y2="13" />
            </>
          )}
        </svg>
      </button>

      {/* 모바일 메뉴 (Portal) */}
      {mobileMenuOpen && createPortal(
        <div
          className="md:hidden fixed inset-0 z-[9999]"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="flex flex-col w-[260px] h-full py-5 px-4"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 메뉴 헤더 */}
            <div className="flex items-center justify-between mb-6 px-1">
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                  <line x1="14" y1="14" x2="24" y2="20" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="14" y1="14" x2="14" y2="4" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="14" y1="14" x2="6" y2="20" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="14" cy="14" r="2.5" fill="#2563EB"/>
                </svg>
                <span className="font-display text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  VPyLab
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer"
                style={{ border: 'none', backgroundColor: 'transparent' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="3" y1="3" x2="11" y2="11" />
                  <line x1="11" y1="3" x2="3" y2="11" />
                </svg>
              </button>
            </div>

            {/* 네비게이션 */}
            <nav className="flex flex-col gap-0.5 flex-1">
              {navItems.map(({ key, path }) => {
                const active = isActive(path);
                return (
                  <Link
                    key={key}
                    to={path}
                    className="text-sm no-underline px-3 py-2.5 rounded-lg transition-colors font-medium"
                    style={{
                      color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      backgroundColor: active ? 'var(--color-accent-bg)' : 'transparent',
                    }}
                    onClick={() => setMobileMenuOpen(false)}
                    onMouseEnter={() => handlePrewarm(path)}
                    onFocus={() => handlePrewarm(path)}
                  >
                    {t(`nav.${key}`)}
                  </Link>
                );
              })}
              <Link
                to="/about"
                className="text-sm no-underline px-3 py-2.5 rounded-lg transition-colors font-medium"
                style={{
                  color: isActive('/about') ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive('/about') ? 'var(--color-accent-bg)' : 'transparent',
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.about')}
              </Link>
            </nav>

            <div className="pt-3 mt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-[11px] px-3" style={{ color: 'var(--color-text-muted)' }}>
                3D 프로그래밍 교육 플랫폼
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 컨트롤 */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
          className="text-xs px-2 py-1.5 rounded-md transition-all cursor-pointer border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}
        >
          {locale === 'ko' ? 'EN' : '한'}
        </button>

        <div className="relative" ref={themeDropdownRef}>
          <button
            onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
            className="h-8 px-2 rounded-md transition-all cursor-pointer border flex items-center gap-1.5"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'transparent' }}
            title={t('settings.theme')}
          >
            <span className="text-sm leading-none">{THEME_META[theme]?.icon}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="var(--color-text-muted)">
              <path d="M2 4l3 3 3-3" stroke="var(--color-text-muted)" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {themeDropdownOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-48 rounded-xl py-1.5 z-50"
              style={{
                backgroundColor: 'var(--color-bg-panel)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                테마 선택
              </p>
              {THEMES.map((t) => {
                const meta = THEME_META[t];
                const active = theme === t;
                return (
                  <button
                    key={t}
                    onClick={() => { setTheme(t); setThemeDropdownOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left border-none cursor-pointer transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--color-accent-bg)' : 'transparent',
                      color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8125rem',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span className="text-sm leading-none w-5 text-center">{meta.icon}</span>
                    <span>{meta.label}</span>
                    {active && (
                      <svg className="ml-auto" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7.5l3 3 5-6"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer border transition-all"
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
                className="absolute right-0 top-full mt-1.5 w-44 rounded-xl py-1 z-50"
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {profile?.display_name}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {profile?.role === 'teacher' ? t('auth.teacher') : t('auth.student')}
                  </p>
                </div>
                {isTeacher && (
                  <Link
                    to="/dashboard"
                    className="block px-3 py-2 text-xs no-underline transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    {t('nav.dashboard')}
                  </Link>
                )}
                <button
                  onClick={() => { signOut(); setDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs cursor-pointer border-none bg-transparent transition-colors"
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
            className="btn-primary text-xs !py-1.5 !px-3.5"
          >
            {t('auth.login')}
          </button>
        )}
      </div>
    </header>
  );
}
