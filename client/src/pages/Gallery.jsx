import { useEffect, useState } from 'react';
import useGalleryStore from '../stores/galleryStore';
import GalleryCard from '../components/gallery/GalleryCard';
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
    <div className="gallery-page">
      {/* 헤더 */}
      <div className="gallery-header">
        <h1>🎨 갤러리</h1>
        <p>학생들의 멋진 3D 작품을 구경하고, Remix 해보세요!</p>
      </div>

      {/* 필터 바 */}
      <div className="gallery-filters">
        {/* 검색 */}
        <form onSubmit={handleSearch} className="gallery-search">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="작품 검색..."
          />
          <button type="submit">검색</button>
        </form>

        {/* 카테고리 pill */}
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

        {/* 정렬 */}
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
          <p>아직 작품이 없습니다.</p>
          <p>첫 번째 작품을 올려보세요! 🚀</p>
        </div>
      )}

      {/* 로딩 / 더보기 */}
      {loading && <div className="gallery-loading">로딩 중...</div>}
      {!loading && hasMore && works.length > 0 && (
        <button onClick={handleLoadMore} className="load-more-btn">
          더보기
        </button>
      )}

      <style>{`
        .gallery-page {
          max-width: 1100px; margin: 0 auto; padding: 24px 16px;
        }
        .gallery-header {
          text-align: center; margin-bottom: 24px;
        }
        .gallery-header h1 { font-size: 28px; margin: 0; }
        .gallery-header p { color: var(--text-secondary, #8b949e); margin: 4px 0 0; font-size: 14px; }

        .gallery-filters {
          display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;
        }
        .gallery-search {
          display: flex; gap: 6px;
        }
        .gallery-search input {
          flex: 1; padding: 8px 12px; border-radius: 6px;
          background: var(--bg-secondary, #161b22); border: 1px solid var(--border, #30363d);
          color: var(--text-primary, #e6edf3); font-size: 14px;
        }
        .gallery-search button {
          padding: 8px 16px; border-radius: 6px; border: none;
          background: var(--accent, #6C5CE7); color: white; cursor: pointer; font-size: 13px;
        }

        .gallery-cats, .gallery-sort {
          display: flex; flex-wrap: wrap; gap: 6px;
        }
        .cat-pill, .sort-btn {
          padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border, #30363d);
          background: transparent; color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 12px;
        }
        .cat-pill.active { background: var(--accent, #6C5CE7); color: white; border-color: var(--accent); }
        .sort-btn.active { background: rgba(255,255,255,0.1); color: var(--text-primary, #e6edf3); }

        .gallery-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;
        }

        .gallery-empty {
          text-align: center; padding: 60px 0; color: var(--text-secondary, #8b949e);
        }
        .gallery-loading {
          text-align: center; padding: 24px; color: var(--text-secondary, #8b949e);
        }
        .load-more-btn {
          display: block; margin: 24px auto; padding: 10px 32px; border-radius: 8px;
          border: 1px solid var(--border, #30363d); background: transparent;
          color: var(--text-secondary, #8b949e); cursor: pointer; font-size: 14px;
        }
        .load-more-btn:hover { border-color: var(--accent, #6C5CE7); color: var(--text-primary); }

        @media (max-width: 600px) {
          .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
        }
      `}</style>
    </div>
  );
}
