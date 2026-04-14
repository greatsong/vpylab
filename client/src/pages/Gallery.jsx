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
  const { t, lang } = useI18n();
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
        <div className="gallery-header">
          <h1>{t('gallery.title') || '갤러리'}</h1>
          <p>{t('gallery.subtitle') || '학생들의 멋진 3D 작품을 구경하고, Remix 해보세요!'}</p>
        </div>

        {/* 필터 바 */}
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

        {/* 작품 그리드 */}
        <div className="gallery-grid">
          {works.map(work => (
            <GalleryCard key={work.id} work={work} />
          ))}
        </div>

        {/* 빈 상태 */}
        {!loading && works.length === 0 && (
          <div className="gallery-empty">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 12px' }}>
              <rect x="6" y="6" width="36" height="36" rx="8" stroke="var(--color-text-muted)" strokeWidth="2" opacity="0.3"/>
              <circle cx="18" cy="20" r="4" fill="var(--color-text-muted)" opacity="0.3"/>
              <path d="M6 32L16 24L24 30L32 22L42 32" stroke="var(--color-text-muted)" strokeWidth="2" opacity="0.3"/>
            </svg>
            <p>{lang === 'ko' ? '아직 작품이 없습니다.' : 'No works yet.'}</p>
            <p style={{ fontSize: '0.8125rem' }}>{lang === 'ko' ? '첫 번째 작품을 올려보세요!' : 'Be the first to publish!'}</p>
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
