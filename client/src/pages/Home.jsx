import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import Header from '../components/layout/Header';
import { categories, getMissionsByCategory } from '../data/missions';
import useAppStore from '../stores/appStore';
import useGalleryStore from '../stores/galleryStore';
import GalleryCard from '../components/gallery/GalleryCard';

const CAT_COLORS = {
  CT: '#6C5CE7', CR: '#FF6B6B', MA: '#00CEC9',
  SC: '#00B894', AR: '#F0883E', SN: '#E84393', AI: '#4A6CF7',
};

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
        <section className="hero-bg relative" style={{ padding: '4.5rem 0 4rem' }}>
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center max-w-xl mx-auto">
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

              <div className="flex gap-3 justify-center animate-slide-up-delay-2">
                <Link to="/sandbox" className="btn-primary no-underline inline-flex items-center gap-2">
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
            </div>
          </div>
        </section>

        {/* ===== 카테고리 ===== */}
        <section className="py-16" style={{ backgroundColor: 'var(--color-bg-panel)' }}>
          <div className="max-w-7xl mx-auto px-6">
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

        {/* ===== 갤러리 하이라이트 ===== */}
        {featuredWorks.length > 0 && (
          <section className="py-16" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <div className="max-w-7xl mx-auto px-6">
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
