import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import Header from '../components/layout/Header';
import { categories, getMissionsByCategory } from '../data/missions';
import useAppStore from '../stores/appStore';
import useGalleryStore from '../stores/galleryStore';
import GalleryCard from '../components/gallery/GalleryCard';

const CATEGORY_COLORS = {
  CT: '#58a6ff',
  CR: '#f78166',
  MA: '#d2a8ff',
  SC: '#3fb950',
  AR: '#f0883e',
  AI: '#79c0ff',
};

export default function Home() {
  const { t } = useI18n();
  const [serverStatus, setServerStatus] = useState(null);
  const featuredWorks = useGalleryStore(s => s.featuredWorks);
  const fetchFeaturedWorks = useGalleryStore(s => s.fetchFeaturedWorks);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setServerStatus(data.status))
      .catch(() => setServerStatus('offline'));
    fetchFeaturedWorks();
  }, []);

  const statusIcon = serverStatus === 'ok' ? '🟢' : serverStatus === 'offline' ? '🔴' : '⏳';
  const statusText = serverStatus === 'ok'
    ? t('home.serverConnected')
    : serverStatus === 'offline'
      ? t('home.serverOffline')
      : t('home.serverChecking');

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="flex-1">
        {/* 히어로 — 그리드 배경 */}
        <section className="hero-bg py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 text-center">
            {/* 배지 */}
            <div
              className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-6 animate-slide-up"
              style={{
                backgroundColor: 'var(--color-accent-bg)',
                color: 'var(--color-accent)',
                border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-accent)' }} />
              {t('home.footer')}
            </div>

            {/* 제목 — 브랜드 그라디언트 */}
            <h1 className="text-5xl md:text-7xl font-extrabold mb-5 tracking-tight animate-slide-up">
              <span style={{
                background: 'var(--brand-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                {t('app.title')}
              </span>
            </h1>

            <p
              className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-8 animate-slide-up"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('app.subtitle')}
            </p>

            {/* CTA 버튼 */}
            <div className="flex gap-3 justify-center animate-slide-up">
              <Link to="/sandbox" className="btn-primary no-underline">
                {t('nav.sandbox')}
              </Link>
              <Link to="/missions" className="btn-secondary no-underline">
                {t('nav.missions')}
              </Link>
            </div>

            {/* 서버 상태 */}
            <div className="flex justify-center items-center gap-2 mt-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <span>{statusIcon}</span>
              <span>{statusText}</span>
            </div>
          </div>
        </section>

        {/* 6대 카테고리 */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.values(categories).map((cat) => {
              const color = CATEGORY_COLORS[cat.id] || '#58a6ff';
              const missionCount = getMissionsByCategory(cat.id).length;
              const completedCount = useAppStore.getState().getCompletedCount(cat.id);
              const pct = missionCount > 0 ? Math.round((completedCount / missionCount) * 100) : 0;
              return (
              <Link
                key={cat.id}
                to={`/missions?category=${cat.id}`}
                className="category-card no-underline"
                style={{ '--card-accent': color }}
                aria-label={`${t(`categories.${cat.id}`)} - ${t('home.missionCount', { count: missionCount })}`}
              >
                {/* 상단: 아이콘 + 이름 + ID 뱃지 */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                      {t(`categories.${cat.id}`)}
                    </h3>
                  </div>
                  <span
                    className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0"
                    style={{ color, backgroundColor: `${color}15` }}
                  >
                    {cat.id}
                  </span>
                </div>

                {/* 진행률 바 */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {t('home.missionCount', { count: missionCount })}
                    </span>
                    <span style={{ color }}>{completedCount}/{missionCount}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>

                {/* 하단 CTA */}
                <div className="flex items-center justify-end pt-1">
                  <span className="text-xs font-medium" style={{ color }}>
                    {missionCount > 0 ? `${t('home.startMission')} →` : `${t('home.preparing')} →`}
                  </span>
                </div>
              </Link>
              );
            })}
          </div>
        </section>

        {/* 갤러리 하이라이트 */}
        {featuredWorks.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 py-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                🎨 {t('gallery.featured') || '인기 작품'}
              </h2>
              <Link to="/gallery" className="text-sm no-underline" style={{ color: 'var(--color-accent)' }}>
                {t('gallery.title') || '갤러리'} →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredWorks.slice(0, 6).map(work => (
                <GalleryCard key={work.id} work={work} />
              ))}
            </div>
          </section>
        )}

        {/* 푸터 */}
        <footer className="text-center text-sm py-8" style={{ color: 'var(--color-text-muted)' }}>
          <p>{t('home.author')}</p>
        </footer>
      </main>
    </div>
  );
}
