import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';
import Header from '../components/layout/Header';
import { categories, getMissionsByCategory } from '../data/missions';
import courses from '../data/courses';
import EXAMPLES from '../data/examples';
import useAppStore from '../stores/appStore';
import useGalleryStore from '../stores/galleryStore';
import GalleryCard from '../components/gallery/GalleryCard';

const CAT_COLORS = {
  CT: '#6C5CE7', CR: '#FF6B6B', MA: '#00CEC9',
  SC: '#00B894', AR: '#F0883E', SN: '#E84393', AI: '#4A6CF7',
};

// 예제 카테고리별 액센트 — DESIGN.md 스펙트럼
const EX_CAT_COLORS = {
  space: '#4A6CF7', sound: '#E84393', science: '#00B894',
  art: '#F0883E',  game: '#FF6B6B',  creative: '#6C5CE7',
  math: '#00CEC9', interactive: '#4A6CF7',
};

// 홈에서 추천할 핵심 예제 (12개) — 새 v3 + 음악 융합 골고루
const FEATURED_EXAMPLE_IDS = [
  'music-piano-recorder',       // ⭐ 인터랙티브 메인
  'music-childrens-songs',      // 동요
  'music-game-themes',          // 게임 BGM
  'music-mario-dance',          // 마리오 댄스
  'showcase-vertex-rainbow',    // 무지개 부채
  'showcase-keysdown-spaceship',// 우주선 조종
  'showcase-mouse-follow',      // 마우스 추적
  'showcase-pendulum-trail',    // 진자
  'music-rainbow-piano',        // 무지개 피아노
  'music-doppler',              // 도플러
  'showcase-clone-rotate',      // 12지 시계
  'showcase-graph-functions',   // 함수 그래프
];

export default function Home() {
  const { t, locale: lang } = useI18n();
  const featuredWorks = useGalleryStore(s => s.featuredWorks);
  const fetchFeaturedWorks = useGalleryStore(s => s.fetchFeaturedWorks);
  // missionProgress를 직접 구독 → 미션 완료 시 진행률이 반응형으로 갱신
  const missionProgress = useAppStore(s => s.missionProgress);

  useEffect(() => { fetchFeaturedWorks(); }, []);

  const catList = Object.values(categories);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="flex-1">
        {/* ===== 히어로 ===== */}
        <section className="hero-bg relative" style={{ padding: '4.5rem 1.5rem 4rem' }}>
          <div className="relative z-10 flex justify-center">
            <div className="text-center" style={{ maxWidth: '40rem' }}>
              <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight mb-4 animate-slide-up"
                style={{ color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
                {lang === 'ko' ? (
                  <>코드로 만드는 3D 세계</>
                ) : (
                  <>Build 3D worlds with code</>
                )}
              </h1>

              <p className="text-base mb-8 animate-slide-up-delay-1"
                style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                {lang === 'ko'
                  ? 'Python으로 3D 시뮬레이션을 만들고, 소리를 입히고, 세상과 공유하세요.'
                  : 'Create 3D simulations with Python. Add sound. Share with the world.'}
              </p>

              <div className="flex gap-3 justify-center flex-wrap animate-slide-up-delay-2">
                <Link to="/courses" className="btn-primary no-underline inline-flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h12v2H2v-2z"/></svg>
                  {t('nav.courses') || '코스'}
                </Link>
                <Link to="/sandbox" className="btn-secondary no-underline inline-flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M6 2l8 6-8 6V2z"/></svg>
                  {t('nav.sandbox')}
                </Link>
                <Link to="/missions" className="btn-secondary no-underline">
                  {t('nav.missions')}
                </Link>
                <Link to="/gallery" className="btn-secondary no-underline">
                  {t('gallery.title') || '갤러리'}
                </Link>
              </div>

              {/* 처음 사용자용 팀 안내 배너 */}
              <Link
                to="/guide"
                className="no-underline mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all animate-slide-up-delay-2"
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <span className="text-base">🚢</span>
                <span>
                  {lang === 'ko'
                    ? '처음이세요? 팀으로 작품 만드는 방법 보기'
                    : 'New here? See how to build with a team'}
                </span>
                <span style={{ color: 'var(--color-accent)' }}>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ===== 학습 코스 ===== */}
        <section className="py-16" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
          <div className="container-main">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="font-display text-xl md:text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {lang === 'ko' ? '학습 코스' : 'Learning Courses'}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {lang === 'ko'
                    ? `${courses.length}개 코스 · 입문 · 융합 · 튜토리얼`
                    : `${courses.length} courses · Beginner · Fusion · Tutorial`}
                </p>
              </div>
              <Link
                to="/courses"
                className="text-sm no-underline font-medium"
                style={{ color: 'var(--color-accent)' }}
              >
                {lang === 'ko' ? '전체 보기' : 'View all'} →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {courses.map((c) => {
                const accent = {
                  sky: '#4A6CF7', emerald: '#00B894', amber: '#F0883E',
                  indigo: '#6C5CE7', rose: '#FF6B6B', teal: '#00CEC9',
                  slate: '#5A5B6A', blue: '#4A6CF7',
                }[c.color] || '#4A6CF7';
                const trackKo = c.track === 'beginner' ? '입문' : c.track === 'fusion' ? '융합' : '튜토리얼';
                return (
                  <Link
                    key={c.id}
                    to={`/courses/${c.id}`}
                    className="category-card no-underline"
                    style={{ '--card-accent': accent }}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="text-xl leading-none shrink-0">{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider" style={{ color: accent }}>
                            {trackKo} · {c.subject || '코딩'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <h3
                      className="font-display font-bold text-[14px] leading-snug mb-1.5"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {c.title?.[lang] || c.title?.ko}
                    </h3>
                    <p
                      className="text-[12px] leading-relaxed mb-3"
                      style={{
                        color: 'var(--color-text-secondary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {c.description}
                    </p>
                    <div className="flex items-center justify-between text-[11px] pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{c.targetGrade}</span>
                      <span className="font-mono font-semibold" style={{ color: accent }}>
                        {c.sessions}{lang === 'ko' ? '차시' : ' sessions'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===== 카테고리 ===== */}
        <section className="py-16" style={{ backgroundColor: 'var(--color-bg-panel)' }}>
          <div className="container-main">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="font-display text-xl md:text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {t('nav.missions')}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Python + 3D · {catList.length} {lang === 'ko' ? '카테고리' : 'categories'}
                </p>
              </div>
              <Link to="/missions" className="text-sm no-underline font-medium"
                style={{ color: 'var(--color-accent)' }}>
                {lang === 'ko' ? '전체 보기' : 'View all'} →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catList.map((cat) => {
                const color = CAT_COLORS[cat.id] || '#6C5CE7';
                const mCount = getMissionsByCategory(cat.id).length;
                const cCount = Object.entries(missionProgress)
                  .filter(([id, p]) => id.startsWith(cat.id) && p.passed).length;
                const pct = mCount > 0 ? Math.round((cCount / mCount) * 100) : 0;

                return (
                  <Link key={cat.id} to={`/missions?category=${cat.id}`}
                    className="category-card no-underline"
                    style={{ '--card-accent': color }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {t(`categories.${cat.id}`)}
                        </h3>
                        <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          {cat.id} · {mCount} {lang === 'ko' ? '미션' : 'missions'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1 font-medium">
                        <span style={{ color: 'var(--color-text-muted)' }}>{pct}%</span>
                        <span style={{ color }}>{cCount}/{mCount}</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===== 예제 갤러리 ===== */}
        <section className="py-16" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
          <div className="container-main">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="font-display text-xl md:text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {lang === 'ko' ? '바로 실행해보는 예제' : 'Run-It-Now Examples'}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {lang === 'ko'
                    ? `${EXAMPLES.length}개 예제 · 음악 융합 · 인터랙티브 · 카드 클릭 = 코드 자동 로드`
                    : `${EXAMPLES.length} examples · Music fusion · Interactive · Click to auto-load`}
                </p>
              </div>
              <Link to="/examples" className="text-sm no-underline font-medium"
                style={{ color: 'var(--color-accent)' }}>
                {lang === 'ko' ? '전체 보기' : 'View all'} →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {FEATURED_EXAMPLE_IDS.map((id) => {
                const ex = EXAMPLES.find((e) => e.id === id);
                if (!ex) return null;
                const accent = EX_CAT_COLORS[ex.category] || '#4A6CF7';
                return (
                  <Link
                    key={ex.id}
                    to={`/sandbox?example=${ex.id}`}
                    className="category-card no-underline"
                    style={{ '--card-accent': accent }}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="text-[24px] leading-none shrink-0">{ex.thumbnail || '✨'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                          <span
                            className="text-[10.5px] font-mono font-bold uppercase tracking-wider truncate"
                            style={{ color: accent }}
                          >
                            {ex.category}
                          </span>
                        </div>
                      </div>
                    </div>
                    <h3
                      className="font-display font-bold text-[14px] leading-snug mb-1.5"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {ex.title}
                    </h3>
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{
                        color: 'var(--color-text-secondary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {ex.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===== 갤러리 하이라이트 ===== */}
        {featuredWorks.length > 0 && (
          <section className="py-16" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <div className="container-main">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="font-display text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {t('gallery.featured') || '인기 작품'}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {t('gallery.subtitle') || '학생들의 창의적인 3D 작품'}
                  </p>
                </div>
                <Link to="/gallery" className="text-sm no-underline font-medium"
                  style={{ color: 'var(--color-accent)' }}>
                  {t('gallery.title') || '갤러리'} →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredWorks.slice(0, 6).map(work => (
                  <GalleryCard key={work.id} work={work} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===== 푸터 ===== */}
        <footer className="text-center text-sm py-8"
          style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
          <p>{t('home.author')}</p>
        </footer>
      </main>
    </div>
  );
}
