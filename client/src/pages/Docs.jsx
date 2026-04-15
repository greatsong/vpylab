import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import DocSidebar from '../components/docs/DocSidebar';
import DocContent from '../components/docs/DocContent';
import docs, { docCategories, getDocsByCategory, getDocById, searchDocs } from '../data/docs';
import { useI18n } from '../i18n';
import useAppStore from '../stores/appStore';

export default function Docs() {
  const { t } = useI18n();
  const locale = useAppStore((s) => s.locale);
  const location = useLocation();
  const navigate = useNavigate();

  const [selectedDocId, setSelectedDocId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // URL 해시에서 초기 선택 문서 읽기
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) {
      const doc = getDocById(hash);
      if (doc) setSelectedDocId(hash);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 선택 변경 시 해시 업데이트
  useEffect(() => {
    if (selectedDocId) {
      navigate(`#${selectedDocId}`, { replace: true });
    }
  }, [selectedDocId, navigate]);

  // 검색 결과 메모이제이션
  const filteredDocs = useMemo(
    () => (searchQuery ? searchDocs(searchQuery, locale) : docs),
    [searchQuery, locale],
  );

  // 카테고리를 배열로 변환 (DocSidebar가 배열을 기대)
  const categoriesArray = useMemo(
    () => Object.entries(docCategories).map(([id, cat]) => ({
      id,
      name: cat[locale] || cat.en,
      icon: cat.icon,
    })),
    [locale],
  );

  // 카테고리별 문서 그룹 메모이제이션
  const docsByCategory = useMemo(() => {
    const grouped = {};
    for (const catId of Object.keys(docCategories)) {
      grouped[catId] = getDocsByCategory(catId);
    }
    return grouped;
  }, []);

  const selectedDoc = useMemo(
    () => (selectedDocId ? getDocById(selectedDocId) : null),
    [selectedDocId],
  );

  const handleSelect = useCallback((id) => {
    setSelectedDocId(id);
    setMobileMenuOpen(false);
  }, []);

  const handleSearchChange = useCallback((q) => {
    setSearchQuery(q);
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <div className="flex" style={{ height: 'calc(100vh - 56px)' }}>
        {/* 데스크톱 사이드바 */}
        <aside
          className="hidden md:flex flex-col flex-shrink-0"
          style={{
            width: 280,
            borderRight: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-panel)',
            overflowY: 'auto',
          }}
        >
          <DocSidebar
            docs={filteredDocs}
            categories={categoriesArray}
            selectedId={selectedDocId}
            onSelect={handleSelect}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            t={t}
            docsByCategory={docsByCategory}
          />
        </aside>

        {/* 모바일 사이드바 오버레이 */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 z-[100]"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="flex flex-col h-full"
              style={{
                width: 280,
                backgroundColor: 'var(--color-bg-panel)',
                boxShadow: 'var(--shadow-md)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모바일 사이드바 헤더 */}
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
                  {t('docs.title')}
                </span>
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
              <DocSidebar
                docs={filteredDocs}
                categories={categoriesArray}
                selectedId={selectedDocId}
                onSelect={handleSelect}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                t={t}
                docsByCategory={docsByCategory}
              />
            </div>
          </div>
        )}

        {/* 콘텐츠 영역 */}
        <main
          className="flex-1"
          style={{ overflowY: 'auto', padding: '24px 32px' }}
        >
          <DocContent doc={selectedDoc} t={t} />
        </main>
      </div>

      {/* 모바일 플로팅 버튼 */}
      <button
        className="md:hidden fixed z-50 flex items-center justify-center rounded-full cursor-pointer"
        style={{
          bottom: 20,
          right: 20,
          width: 48,
          height: 48,
          backgroundColor: 'var(--color-accent)',
          border: 'none',
          boxShadow: 'var(--shadow-md)',
          color: '#fff',
        }}
        onClick={() => setMobileMenuOpen(true)}
        aria-label={t('docs.search')}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="5" x2="17" y2="5" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="15" x2="17" y2="15" />
        </svg>
      </button>
    </div>
  );
}
