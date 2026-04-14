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

const CAT_ICONS = {
  CT: (c) => (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="4" width="10" height="10" rx="2" fill={c} opacity="0.85"/>
      <rect x="18" y="4" width="10" height="10" rx="2" fill={c} opacity="0.45"/>
      <rect x="4" y="18" width="10" height="10" rx="2" fill={c} opacity="0.45"/>
      <rect x="18" y="18" width="10" height="10" rx="2" fill={c} opacity="0.25"/>
    </svg>
  ),
  CR: (c) => (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12" stroke={c} strokeWidth="2" opacity="0.3"/>
      <circle cx="16" cy="16" r="7" fill={c} opacity="0.5"/>
      <circle cx="16" cy="16" r="3" fill={c}/>
    </svg>
  ),
  MA: (c) => (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M4 28L16 4L28 28" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75"/>
      <line x1="9" y1="20" x2="23" y2="20" stroke={c} strokeWidth="2" opacity="0.4"/>
    </svg>
  ),
  SC: (c) => (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <circle cx="10" cy="12" r="4.5" fill={c} opacity="0.65"/>
      <circle cx="22" cy="12" r="4.5" fill={c} opacity="0.35"/>
      <circle cx="16" cy="22" r="4.5" fill={c} opacity="0.5"/>
    </svg>
  ),
  AR: (c) => (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <polygon points="16,2 30,26 2,26" fill={c} opacity="0.25"/>
      <polygon points="16,10 26,26 6,26" fill={c} opacity="0.5"/>
    </svg>
  ),
  SN: (c) => (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M2 16h4l3-8 3 16 3-10 3 6h4l3-8 3 8h2" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
    </svg>
  ),
  AI: (c) => (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="5" width="22" height="22" rx="4" stroke={c} strokeWidth="2" opacity="0.3"/>
      <circle cx="12" cy="14" r="2.5" fill={c} opacity="0.7"/>
      <circle cx="20" cy="14" r="2.5" fill={c} opacity="0.7"/>
      <path d="M10 22c0 0 3 3 6 3s6-3 6-3" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
};

export default function Home() {
  const { t, locale: lang } = useI18n();
  const featuredWorks = useGalleryStore(s => s.featuredWorks);
  const fetchFeaturedWorks = useGalleryStore(s => s.fetchFeaturedWorks);

  useEffect(() => { fetchFeaturedWorks(); }, []);

  const catList = Object.values(categories);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="flex-1">
        {/* ===== 히어로 ===== */}
        <section className="hero-bg relative" style={{ padding: '6rem 0 5rem' }}>
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
              {/* 좌: 텍스트 */}
              <div className="flex-1 text-center">
                <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6 animate-slide-up"
                  style={{ color: 'var(--color-text-primary)', lineHeight: 1.05 }}>
                  {lang === 'ko' ? (
                    <>
                      <span style={{ color: 'var(--brand-purple)' }}>코드</span>로 만드는{' '}
                      <br className="hidden md:block" />
                      <span style={{ color: 'var(--brand-cyan)' }}>3D</span> 세계
                    </>
                  ) : (
                    <>
                      Build <span style={{ color: 'var(--brand-purple)' }}>3D</span> worlds{' '}
                      <br className="hidden lg:block" />
                      with <span style={{ color: 'var(--brand-cyan)' }}>code</span>
                    </>
                  )}
                </h1>

                <p className="text-base md:text-lg mb-8 mx-auto animate-slide-up-delay-1"
                  style={{ color: 'var(--color-text-secondary)', maxWidth: '480px', lineHeight: 1.7 }}>
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
                </div>
              </div>

              {/* 우: 비주얼 — 3D 코드 프리뷰 카드 */}
              <div className="hidden lg:block flex-shrink-0 animate-slide-up-delay-2" style={{ width: '340px' }}>
                <div style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                  overflow: 'hidden',
                }}>
                  {/* 코드 미리보기 */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#FF6B6B' }}/>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#FDCB6E' }}/>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#00B894' }}/>
                    </div>
                    <pre style={{
                      fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.7,
                      color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre',
                    }}>
{`ball = sphere(
  pos=vector(0, 5, 0),
  color=color.cyan
)

while True:
  rate(60)
  ball.pos.y -= 0.1`}
                    </pre>
                  </div>
                  {/* 스펙트럼 바 */}
                  <div style={{ display: 'flex', height: '4px' }}>
                    {['#6C5CE7','#4A6CF7','#00CEC9','#00B894','#F0883E','#FF6B6B','#E84393'].map((c, i) => (
                      <div key={i} style={{ flex: 1, backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 카테고리 ===== */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-bg-panel)' }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2 className="font-display text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {t('nav.missions')}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Python + 3D · {catList.length} {lang === 'ko' ? '카테고리' : 'categories'}
                </p>
              </div>
              <Link to="/missions" className="text-sm no-underline font-semibold"
                style={{ color: 'var(--color-accent)' }}>
                {lang === 'ko' ? '전체 보기' : 'View all'} →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {catList.map((cat) => {
                const color = CAT_COLORS[cat.id] || '#6C5CE7';
                const IconFn = CAT_ICONS[cat.id];
                const mCount = getMissionsByCategory(cat.id).length;
                const cCount = useAppStore.getState().getCompletedCount(cat.id);
                const pct = mCount > 0 ? Math.round((cCount / mCount) * 100) : 0;

                return (
                  <Link key={cat.id} to={`/missions?category=${cat.id}`}
                    className="category-card no-underline"
                    style={{ '--card-accent': color }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}0D` }}>
                        {IconFn ? IconFn(color) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-[15px]" style={{ color: 'var(--color-text-primary)' }}>
                          {t(`categories.${cat.id}`)}
                        </h3>
                        <span className="text-[11px] font-mono font-semibold" style={{ color }}>
                          {cat.id} · {mCount} {lang === 'ko' ? '미션' : 'missions'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1.5 font-medium">
                        <span style={{ color: 'var(--color-text-muted)' }}>{pct}%</span>
                        <span style={{ color }}>{cCount}/{mCount}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
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
          <section className="py-20" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <div className="max-w-6xl mx-auto px-6">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <h2 className="font-display text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {t('gallery.featured') || '인기 작품'}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {t('gallery.subtitle') || '학생들의 창의적인 3D 작품'}
                  </p>
                </div>
                <Link to="/gallery" className="text-sm no-underline font-semibold"
                  style={{ color: 'var(--color-accent)' }}>
                  {t('gallery.title') || '갤러리'} →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredWorks.slice(0, 6).map(work => (
                  <GalleryCard key={work.id} work={work} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===== 푸터 ===== */}
        <footer className="text-center text-sm py-10"
          style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
          <p>{t('home.author')}</p>
        </footer>
      </main>
    </div>
  );
}
