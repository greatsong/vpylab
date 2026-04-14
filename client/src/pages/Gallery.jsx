import { useEffect, useState } from 'react';
import useGalleryStore from '../stores/galleryStore';
import GalleryCard from '../components/gallery/GalleryCard';
import Header from '../components/layout/Header';
import { useI18n } from '../i18n';

const CATEGORIES = [
  { value: 'all', label: '전체', en: 'All' },
  { value: 'CT', label: '컴퓨팅', en: 'CT' },
  { value: 'CR', label: '창작', en: 'Creative' },
  { value: 'MA', label: '수학', en: 'Math' },
  { value: 'SC', label: '과학', en: 'Science' },
  { value: 'AR', label: '아트', en: 'Art' },
  { value: 'SN', label: '사운드', en: 'Sound' },
  { value: 'free', label: '자유', en: 'Free' },
];

const SORTS = [
  { value: 'latest', label: '최신순', en: 'Latest' },
  { value: 'popular', label: '인기순', en: 'Popular' },
  { value: 'views', label: '조회순', en: 'Most Viewed' },
];

export default function Gallery() {
  const { t, locale: lang } = useI18n();
  const { works, loading, hasMore, filters, setFilters, fetchWorks } = useGalleryStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchWorks(true);
  }, [filters.category, filters.sort]);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters({ search });
    fetchWorks(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) fetchWorks();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <div className="gallery-page">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {t('gallery.title') || '갤러리'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('gallery.subtitle') || '학생들의 멋진 3D 작품을 구경하고, Remix 해보세요!'}
          </p>
        </div>

        {/* 필터 바 — 한 줄 정리 */}
        <div className="gallery-filters">
          <form onSubmit={handleSearch} className="gallery-search">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'ko' ? '작품 검색...' : 'Search...'}
            />
            <button type="submit">{lang === 'ko' ? '검색' : 'Search'}</button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <div className="gallery-cats">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  className={`cat-pill ${filters.category === cat.value ? 'active' : ''}`}
                  onClick={() => setFilters({ category: cat.value })}
                >
                  {lang === 'ko' ? cat.label : cat.en}
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 16, backgroundColor: 'var(--color-border)', margin: '0 4px' }} />

            <div className="gallery-sort">
              {SORTS.map(sort => (
                <button
                  key={sort.value}
                  className={`sort-btn ${filters.sort === sort.value ? 'active' : ''}`}
                  onClick={() => setFilters({ sort: sort.value })}
                >
                  {lang === 'ko' ? sort.label : sort.en}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 작품 그리드 */}
        <div className="gallery-grid">
          {works.map(work => (
            <GalleryCard key={work.id} work={work} />
          ))}
        </div>

        {/* 빈 상태 */}
        {!loading && works.length === 0 && (
          <div className="gallery-empty">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: '0 auto 12px' }}>
              <rect x="5" y="5" width="30" height="30" rx="6" stroke="var(--color-text-muted)" strokeWidth="1.5" opacity="0.3"/>
              <circle cx="15" cy="16" r="3" fill="var(--color-text-muted)" opacity="0.3"/>
              <path d="M5 28L13 21L20 26L27 19L35 28" stroke="var(--color-text-muted)" strokeWidth="1.5" opacity="0.3"/>
            </svg>
            <p className="text-sm">{lang === 'ko' ? '아직 작품이 없습니다.' : 'No works yet.'}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {lang === 'ko' ? '첫 번째 작품을 올려보세요!' : 'Be the first to publish!'}
            </p>
          </div>
        )}

        {/* 로딩 / 더보기 */}
        {loading && <div className="gallery-loading">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</div>}
        {!loading && hasMore && works.length > 0 && (
          <button onClick={handleLoadMore} className="load-more-btn">
            {lang === 'ko' ? '더보기' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}
