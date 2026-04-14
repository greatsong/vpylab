import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  // 데스크톱: 그룹별 구분선 | 모바일: 섹션 라벨
  const navGroups = [
    {
      label: '코딩',
      items: [
        { key: 'sandbox', path: '/sandbox' },
        { key: 'missions', path: '/missions' },
      ],
    },
    {
      label: '탐색',
      items: [
        { key: 'gallery', path: '/gallery' },
        { key: 'aiLab', path: '/ai-lab' },
      ],
    },
    {
      label: '기타',
      items: [
        ...(isTeacher ? [{ key: 'dashboard', path: '/dashboard' }] : []),
        { key: 'about', path: '/about' },
      ],
    },
  ];

  // 플랫 목록 (모바일 메뉴에서 아이콘 매핑용)
  const navItems = navGroups.flatMap(g => g.items);

  const isActive = (path) => location.pathname === path;

  return (
    <header
      className="relative flex items-center justify-between px-4 md:px-6 h-14 border-b sticky top-0 z-50"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-panel)',
      }}
    >
      {/* 로고 */}
      <Link to="/" className="flex items-center gap-2.5 no-underline">
        <svg width="28" height="28" viewBox="0 0 48 48">
          <defs>
            <radialGradient id="h-s1" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#B8A9FF"/><stop offset="50%" stopColor="#6C5CE7"/><stop offset="100%" stopColor="#4834B0"/></radialGradient>
            <radialGradient id="h-s2" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#FFB3A7"/><stop offset="50%" stopColor="#FF6B6B"/><stop offset="100%" stopColor="#C44569"/></radialGradient>
            <radialGradient id="h-s3" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#7DFFDA"/><stop offset="50%" stopColor="#00B894"/><stop offset="100%" stopColor="#00876A"/></radialGradient>
            <radialGradient id="h-s4" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#FFE4A0"/><stop offset="50%" stopColor="#FDCB6E"/><stop offset="100%" stopColor="#E0A800"/></radialGradient>
            <radialGradient id="h-s5" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#A0F0EE"/><stop offset="50%" stopColor="#00CEC9"/><stop offset="100%" stopColor="#009E9A"/></radialGradient>
          </defs>
          {/* 5선지 */}
          {[11,17.5,24,30.5,37].map(y=><line key={y} x1="2" y1={y} x2="46" y2={y} stroke="#CBC3E3" strokeWidth="0.8" opacity="0.6"/>)}
          {/* 음표 1: 보라 */}
          <line x1="14.5" y1="9" x2="14.5" y2="24" stroke="#6C5CE7" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
          <path d="M14.5 9 C17.5 9, 19 12, 17 14" stroke="#6C5CE7" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.45"/>
          <ellipse cx="11.5" cy="25.5" rx="4.8" ry="3.5" transform="rotate(-15, 11.5, 25.5)" fill="url(#h-s1)"/>
          <ellipse cx="10" cy="24.2" rx="1.8" ry="1" transform="rotate(-15, 10, 24.2)" fill="white" opacity="0.4"/>
          {/* 음표 2: 앰버 */}
          <line x1="25.5" y1="14.5" x2="25.5" y2="32" stroke="#E0A800" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
          <path d="M25.5 32 C22.5 32, 21 29, 23 27" stroke="#E0A800" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.45"/>
          <ellipse cx="28.5" cy="13.5" rx="4.8" ry="3.5" transform="rotate(-15, 28.5, 13.5)" fill="url(#h-s4)"/>
          <ellipse cx="27" cy="12.2" rx="1.8" ry="1" transform="rotate(-15, 27, 12.2)" fill="white" opacity="0.4"/>
          {/* 음표 3: 코랄 */}
          <line x1="38" y1="15" x2="38" y2="32" stroke="#FF6B6B" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
          <path d="M38 15 C41 15, 42 18, 40 20" stroke="#FF6B6B" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.45"/>
          <ellipse cx="35" cy="33.5" rx="4.5" ry="3.3" transform="rotate(-15, 35, 33.5)" fill="url(#h-s2)"/>
          <ellipse cx="33.5" cy="32.3" rx="1.6" ry="0.9" transform="rotate(-15, 33.5, 32.3)" fill="white" opacity="0.4"/>
          {/* 장식 구 */}
          <circle cx="6" cy="37.5" r="2.2" fill="url(#h-s3)"/>
          <circle cx="43" cy="9" r="2" fill="url(#h-s5)"/>
        </svg>
        <span className="font-display text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          VPyLab
        </span>
      </Link>

      {/* 네비게이션 (데스크톱) */}
      <nav className="hidden md:flex items-center gap-1">
        {navGroups.flatMap(g => g.items).map(({ key, path }) => (
          <Link
            key={key}
            to={path}
            className="text-[13px] no-underline px-3.5 py-2 rounded-lg transition-colors font-medium"
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

      {/* 모바일 메뉴 오버레이 (Portal) */}
      {mobileMenuOpen && createPortal(
        <div
          className="md:hidden fixed inset-0 z-[9999]"
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
            <div className="flex items-center justify-between mb-8 px-1">
              <div className="flex items-center gap-2.5">
                <svg width="28" height="28" viewBox="0 0 48 48">
                  <defs>
                    <radialGradient id="mb-s1" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#B8A9FF"/><stop offset="50%" stopColor="#6C5CE7"/><stop offset="100%" stopColor="#4834B0"/></radialGradient>
                    <radialGradient id="mb-s4" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#FFE4A0"/><stop offset="50%" stopColor="#FDCB6E"/><stop offset="100%" stopColor="#E0A800"/></radialGradient>
                    <radialGradient id="mb-s2" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#FFB3A7"/><stop offset="50%" stopColor="#FF6B6B"/><stop offset="100%" stopColor="#C44569"/></radialGradient>
                  </defs>
                  {[11,17.5,24,30.5,37].map(y=><line key={y} x1="2" y1={y} x2="46" y2={y} stroke="#CBC3E3" strokeWidth="0.8" opacity="0.6"/>)}
                  <line x1="14.5" y1="9" x2="14.5" y2="24" stroke="#6C5CE7" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
                  <ellipse cx="11.5" cy="25.5" rx="4.8" ry="3.5" transform="rotate(-15, 11.5, 25.5)" fill="url(#mb-s1)"/>
                  <line x1="25.5" y1="14.5" x2="25.5" y2="32" stroke="#E0A800" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
                  <ellipse cx="28.5" cy="13.5" rx="4.8" ry="3.5" transform="rotate(-15, 28.5, 13.5)" fill="url(#mb-s4)"/>
                  <line x1="38" y1="15" x2="38" y2="32" stroke="#FF6B6B" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
                  <ellipse cx="35" cy="33.5" rx="4.5" ry="3.3" transform="rotate(-15, 35, 33.5)" fill="url(#mb-s2)"/>
                </svg>
                <span className="font-display text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  VPyLab
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ border: 'none', backgroundColor: 'transparent' }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="14" y2="14" />
                  <line x1="14" y1="4" x2="4" y2="14" />
                </svg>
              </button>
            </div>

            {/* 네비게이션 — 섹션별 그룹 */}
            <nav className="flex flex-col flex-1">
              {navGroups.map((group, gi) => {
                if (group.items.length === 0) return null;
                const iconColors = {
                  sandbox: '#00B894',
                  missions: '#FF6B6B',
                  gallery: '#FDCB6E',
                  aiLab: '#00CEC9',
                  dashboard: '#A29BFE',
                  about: '#72757E',
                };
                const icons = {
                  sandbox: <><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M8 8L16 8M8 12L13 12M8 16L15 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
                  missions: <><path d="M4 6H20M4 6V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V6M4 6L6 2H18L20 6" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M9 10L11 12L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
                  gallery: <><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none"/><circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M3 16L8 11L13 16L16 13L21 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
                  aiLab: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M8 12C8 9 10 7 12 7C14 7 16 9 16 12C16 15 14 17 12 17" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="2" fill="currentColor"/></>,
                  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none"/></>,
                  about: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
                };
                return (
                  <div key={gi}>
                    {gi > 0 && <div className="my-2 mx-3" style={{ borderTop: '1px solid var(--color-border)' }} />}
                    <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-1 mt-2"
                      style={{ color: 'var(--color-text-muted)' }}>
                      {group.label}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {group.items.map(({ key, path }) => {
                        const active = isActive(path);
                        const iconColor = active ? 'var(--color-accent)' : iconColors[key];
                        return (
                          <Link
                            key={key}
                            to={path}
                            className="flex items-center gap-3 text-sm no-underline px-3 py-2.5 rounded-xl transition-all font-medium"
                            style={{
                              color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
                              backgroundColor: active ? 'var(--color-accent-bg)' : 'transparent',
                            }}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: active ? 'var(--color-accent-bg)' : `${iconColors[key]}15` }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                style={{ color: iconColor }}>
                                {icons[key] || icons.about}
                              </svg>
                            </div>
                            {t(`nav.${key}`)}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
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
        </div>,
        document.body
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
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
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
                {isTeacher && (
                  <Link
                    to="/dashboard"
                    className="block px-4 py-2 text-xs no-underline transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                    onClick={() => setDropdownOpen(false)}
                  >
                    {t('nav.dashboard')}
                  </Link>
                )}
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
            className="btn-primary text-xs !py-1.5 !px-4"
          >
            {t('auth.login')}
          </button>
        )}
      </div>
    </header>
  );
}
