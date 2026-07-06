import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useGalleryStore from '../stores/galleryStore';
import useAuthStore from '../stores/authStore';
import GalleryCard from '../components/gallery/GalleryCard';
import Header from '../components/layout/Header';
import { useI18n } from '../i18n/useI18n';

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
  { value: 'latest', label: '최신', en: 'Latest' },
  { value: 'popular', label: '좋아요', en: 'Liked' },
  { value: 'views', label: '조회', en: 'Viewed' },
];

export default function Gallery() {
  const { locale: lang } = useI18n();
  const { works, loading, hasMore, filters, setFilters, fetchWorks, myWorks, fetchMyWorks } = useGalleryStore();
  const user = useAuthStore(s => s.user);
  const [search, setSearch] = useState(filters.search || '');

  useEffect(() => {
    fetchWorks(true);
  }, [fetchWorks, filters.category, filters.sort, filters.search]);

  // 내 작품 목록 (비공개 Fork 초안 포함) — 로그인 시에만 조회
  useEffect(() => {
    if (user) fetchMyWorks();
  }, [user, fetchMyWorks]);

  const stats = useMemo(() => {
    const pages = works.filter(work => work.github_url || work.github_repo).length;
    const remixes = works.reduce((sum, work) => sum + (work.remix_count || 0), 0);
    const likes = works.reduce((sum, work) => sum + (work.like_count || 0), 0);
    return { pages, remixes, likes };
  }, [works]);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters({ search: search.trim() });
  };

  const clearSearch = () => {
    setSearch('');
    setFilters({ search: '' });
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) fetchWorks();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="gallery-page">
        <section className="gallery-command">
          <div className="gallery-command-copy">
            <p className="gallery-kicker">Open Source Studio</p>
            <h1>{lang === 'ko' ? '실행하고, 고치고, 다시 공유하는 갤러리' : 'Run, remix, and share VPyLab work'}</h1>
            <p>
              {lang === 'ko'
                ? '작품은 코드와 GitHub 저장소로 이어집니다. 마음에 드는 장면을 실행하고, 이슈를 남기고, 내 프로젝트로 발전시켜보세요.'
                : 'Every work can become code, feedback, a fork, and a new project.'}
            </p>
          </div>

          <div className="gallery-command-panel" aria-label="gallery summary">
            <div>
              <span>{works.length}</span>
              <p>{lang === 'ko' ? '로드된 작품' : 'Loaded works'}</p>
            </div>
            <div>
              <span>{stats.pages}</span>
              <p>GitHub Pages</p>
            </div>
            <div>
              <span>{stats.remixes}</span>
              <p>Remix</p>
            </div>
            <div>
              <span>{stats.likes}</span>
              <p>{lang === 'ko' ? '좋아요' : 'Likes'}</p>
            </div>
          </div>
        </section>

        <section className="gallery-toolbar" aria-label="gallery filters">
          <form onSubmit={handleSearch} className="gallery-search">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'ko' ? '제목으로 작품 검색' : 'Search by title'}
            />
            {filters.search && (
              <button type="button" className="gallery-search-clear" onClick={clearSearch}>
                {lang === 'ko' ? '초기화' : 'Clear'}
              </button>
            )}
            <button type="submit">{lang === 'ko' ? '검색' : 'Search'}</button>
          </form>

          <div className="gallery-filter-row">
            <div className="gallery-cats" role="tablist" aria-label="categories">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  className={`cat-pill ${filters.category === cat.value ? 'active' : ''}`}
                  onClick={() => setFilters({ category: cat.value })}
                  type="button"
                >
                  {lang === 'ko' ? cat.label : cat.en}
                </button>
              ))}
            </div>

            <div className="gallery-sort" aria-label="sort">
              {SORTS.map(sort => (
                <button
                  key={sort.value}
                  className={`sort-btn ${filters.sort === sort.value ? 'active' : ''}`}
                  onClick={() => setFilters({ sort: sort.value })}
                  type="button"
                >
                  {lang === 'ko' ? sort.label : sort.en}
                </button>
              ))}
            </div>
          </div>
        </section>

        {user && myWorks.length > 0 && (
          <section aria-label={lang === 'ko' ? '내 작품' : 'My works'} style={{ marginBottom: '2.5rem' }}>
            <div className="gallery-section-head compact">
              <div>
                <h2>{lang === 'ko' ? '내 작품' : 'My Works'}</h2>
                <p>
                  {lang === 'ko'
                    ? '비공개 작품(Fork 초안 포함)은 상세 페이지에서 갤러리에 공개할 수 있습니다.'
                    : 'Private works (including fork drafts) can be published from their detail page.'}
                </p>
              </div>
            </div>
            <div className="gallery-grid">
              {myWorks.map(work => (
                <div key={work.id} style={{ position: 'relative' }}>
                  {work.is_public === false && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        zIndex: 2,
                        padding: '3px 9px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#fff',
                        backgroundColor: 'rgba(20, 20, 28, 0.72)',
                        pointerEvents: 'none',
                      }}
                    >
                      {lang === 'ko' ? '비공개' : 'Private'}
                    </span>
                  )}
                  <GalleryCard work={work} />
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="gallery-section-head">
          <div>
            <h2>{lang === 'ko' ? '공개 작품' : 'Published Works'}</h2>
            <p>{lang === 'ko' ? '클릭하면 상세, 실행, GitHub 흐름으로 이어집니다.' : 'Open a work to run, inspect code, and fork.'}</p>
          </div>
          <Link to="/sandbox" className="gallery-create-link">
            {lang === 'ko' ? '새 작품 만들기' : 'Create work'}
          </Link>
        </div>

        <div className="gallery-grid">
          {works.map(work => (
            <GalleryCard key={work.id} work={work} />
          ))}
        </div>

        {!loading && works.length === 0 && (
          <div className="gallery-empty">
            <div className="gallery-empty-mark" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 16 16" fill="none">
                <path d="M3 3.5h10v9H3z" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6 6l4 2-4 2V6z" fill="currentColor" />
              </svg>
            </div>
            <h3>{lang === 'ko' ? '조건에 맞는 작품이 없습니다.' : 'No matching works.'}</h3>
            <p>{lang === 'ko' ? '검색어를 줄이거나 다른 카테고리를 선택해보세요.' : 'Try another search or category.'}</p>
          </div>
        )}

        {loading && <div className="gallery-loading">{lang === 'ko' ? '작품을 불러오는 중입니다.' : 'Loading works.'}</div>}
        {!loading && hasMore && works.length > 0 && (
          <button onClick={handleLoadMore} className="load-more-btn" type="button">
            {lang === 'ko' ? '더 불러오기' : 'Load more'}
          </button>
        )}
      </main>
    </div>
  );
}
