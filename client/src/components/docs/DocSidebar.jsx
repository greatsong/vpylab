import { useState, useMemo } from 'react';

/**
 * 문서 좌측 사이드바 — 검색 + 카테고리 네비게이션.
 *
 * Props:
 *   docs           — 표시할 문서 목록 (전체 또는 검색 결과)
 *   categories     — { id, name, icon } 배열
 *   selectedId     — 현재 선택된 문서 ID
 *   onSelect       — (docId) => void
 *   searchQuery    — 현재 검색어
 *   onSearchChange — (query) => void
 *   t              — 번역 함수
 *   docsByCategory — { [categoryId]: doc[] } 카테고리별 문서 그룹
 */
export default function DocSidebar({
  docs,
  categories,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  t,
  docsByCategory,
}) {
  // 카테고리별 열림/닫힘 (기본 전부 열림)
  const [collapsed, setCollapsed] = useState({});

  const toggleCategory = (catId) => {
    setCollapsed((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  // 검색 결과에 카테고리 아이콘을 매핑
  const categoryMap = useMemo(() => {
    const map = {};
    for (const cat of categories) {
      map[cat.id] = cat;
    }
    return map;
  }, [categories]);

  return (
    <div className="flex flex-col h-full">
      {/* 검색 */}
      <div className="p-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('docs.search')}
            className="text-sm flex-1 outline-none bg-transparent border-none"
            style={{
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-body)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="flex items-center justify-center w-4 h-4 rounded cursor-pointer"
              style={{ border: 'none', backgroundColor: 'transparent' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round">
                <line x1="2" y1="2" x2="8" y2="8" />
                <line x1="8" y1="2" x2="2" y2="8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 목록 영역 */}
      <div className="flex-1 overflow-y-auto px-2 pb-3" style={{ scrollbarWidth: 'thin' }}>
        {searchQuery ? (
          // 검색 결과 — 플랫 리스트
          docs.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              {t('docs.noResults')}
            </p>
          ) : (
            <ul className="list-none m-0 p-0">
              {docs.map((doc) => {
                const cat = categoryMap[doc.category];
                const isActive = doc.id === selectedId;
                return (
                  <li key={doc.id}>
                    <button
                      onClick={() => onSelect(doc.id)}
                      className="w-full text-left flex items-center gap-2 text-sm py-1.5 px-3 rounded-md cursor-pointer transition-colors"
                      style={{
                        border: 'none',
                        backgroundColor: isActive ? 'var(--color-accent-bg)' : 'transparent',
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {cat?.icon && <span className="text-xs flex-shrink-0">{cat.icon}</span>}
                      <span className="truncate">{typeof doc.title === 'object' ? (doc.title.ko || doc.title.en) : doc.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          // 카테고리별 그룹
          categories.map((cat) => {
            const catDocs = docsByCategory[cat.id] || [];
            if (catDocs.length === 0) return null;
            const isCollapsed = collapsed[cat.id];

            return (
              <div key={cat.id}>
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full text-left flex items-center gap-1.5 text-xs uppercase font-semibold px-3 py-1 rounded cursor-pointer mt-3 mb-1 transition-colors"
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--color-text-muted)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                    style={{
                      transition: 'transform 0.15s',
                      transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      flexShrink: 0,
                    }}
                  >
                    <polyline points="2,3 5,6 8,3" />
                  </svg>
                  {cat.icon && <span>{cat.icon}</span>}
                  {cat.name}
                </button>

                {!isCollapsed && (
                  <ul className="list-none m-0 p-0">
                    {catDocs.map((doc) => {
                      const isActive = doc.id === selectedId;
                      return (
                        <li key={doc.id}>
                          <button
                            onClick={() => onSelect(doc.id)}
                            className="w-full text-left text-sm py-1.5 px-3 pl-7 rounded-md cursor-pointer transition-colors truncate"
                            style={{
                              border: 'none',
                              backgroundColor: isActive ? 'var(--color-accent-bg)' : 'transparent',
                              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            {typeof doc.title === 'object' ? (doc.title.ko || doc.title.en) : doc.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
