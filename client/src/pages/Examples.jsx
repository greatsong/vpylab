import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';
import Header from '../components/layout/Header';
import EXAMPLES, { EXAMPLE_CATEGORIES } from '../data/examples';

/**
 * Examples — 모든 쇼케이스 예제 갤러리
 *   /examples                        → 전체 (필터 pill로 카테고리 좁히기)
 *   /examples?category=<id>          → 카테고리 프리필터
 *
 * 디자인: Home/Missions/Courses와 동일한 토큰 (container-main, category-card,
 * mission-filter-btn, font-display, CSS 변수). 카드 액센트는 카테고리별 색.
 */

// 카테고리별 액센트 — DESIGN.md 스펙트럼
const CAT_COLOR = {
  all: '#5A5B6A',
  space: '#4A6CF7',
  sound: '#E84393',
  science: '#00B894',
  art: '#F0883E',
  game: '#FF6B6B',
  creative: '#6C5CE7',
  math: '#00CEC9',
  interactive: '#4A6CF7',
};

const LEVEL_LABELS = {
  1: { ko: '쉬움', en: 'Easy' },
  2: { ko: '보통', en: 'Medium' },
  3: { ko: '도전', en: 'Hard' },
};

function ExampleCard({ ex, lang }) {
  const accent = CAT_COLOR[ex.category] || '#4A6CF7';
  const cat = EXAMPLE_CATEGORIES.find((c) => c.id === ex.category);
  const catLabel = cat ? (lang === 'ko' ? cat.label : (cat.labelEn || cat.label)) : ex.category;

  return (
    <Link
      to={`/sandbox?example=${ex.id}`}
      className="category-card no-underline"
      style={{ '--card-accent': accent }}
    >
      {/* 상단: 썸네일 + 카테고리 라벨 */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-[26px] leading-none shrink-0">{ex.thumbnail || '✨'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            <span
              className="text-[10.5px] font-mono font-bold uppercase tracking-wider"
              style={{ color: accent }}
            >
              {catLabel}
            </span>
            {ex.level && (
              <>
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>·</span>
                <span className="text-[10.5px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {LEVEL_LABELS[ex.level]?.[lang] || `Lv ${ex.level}`}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 제목 */}
      <h3
        className="font-display text-[15px] font-bold leading-snug mb-2"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {ex.title}
      </h3>

      {/* 설명 — 2줄 클램프 */}
      <p
        className="text-[12.5px] leading-relaxed mb-3"
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

      {/* 태그 */}
      {ex.tags && ex.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          {ex.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10.5px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${accent}1A`, color: accent }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export default function Examples() {
  const { t, locale: lang } = useI18n();
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || null;
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  // 사용 중인 카테고리만 필터에 노출 (개수 0짜리 제거)
  const usedCategories = useMemo(() => {
    const counts = {};
    for (const ex of EXAMPLES) counts[ex.category] = (counts[ex.category] || 0) + 1;
    return EXAMPLE_CATEGORIES.filter((c) => c.id === 'all' || counts[c.id] > 0)
      .map((c) => ({ ...c, count: c.id === 'all' ? EXAMPLES.length : counts[c.id] || 0 }));
  }, []);

  const filtered = selectedCategory
    ? EXAMPLES.filter((e) => e.category === selectedCategory)
    : EXAMPLES;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="flex-1 container-main py-8 w-full">
        {/* 브레드크럼 + 타이틀 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <Link to="/" className="text-xs no-underline" style={{ color: 'var(--color-text-muted)' }}>
              {t('nav.home')}
            </Link>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/</span>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {lang === 'ko' ? '예제' : 'Examples'}
            </span>
          </div>
          <h1
            className="font-display text-2xl md:text-3xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {lang === 'ko' ? '예제 갤러리' : 'Example Gallery'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {lang === 'ko'
              ? `${EXAMPLES.length}개 예제 · 카드를 누르면 코드가 샌드박스에 자동 로드됩니다`
              : `${EXAMPLES.length} examples · Click a card to auto-load the code into the sandbox`}
          </p>
        </div>

        {/* 카테고리 필터 — pill */}
        <div className="flex gap-2 flex-wrap mb-8">
          {usedCategories.map((cat) => {
            const active = (cat.id === 'all' && !selectedCategory) || selectedCategory === cat.id;
            const accent = CAT_COLOR[cat.id] || '#4A6CF7';
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id === 'all' ? null : cat.id)}
                className="mission-filter-btn"
                data-active={active || undefined}
                style={active && cat.id !== 'all' ? { '--filter-color': accent } : {}}
              >
                {lang === 'ko' ? cat.label : (cat.labelEn || cat.label)}
                <span className="opacity-50 ml-1">{cat.count}</span>
              </button>
            );
          })}
        </div>

        {/* 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" style={{ alignItems: 'start' }}>
          {filtered.map((ex) => (
            <ExampleCard key={ex.id} ex={ex} lang={lang} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
            <p className="text-sm">{lang === 'ko' ? '해당 카테고리에 예제가 없습니다.' : 'No examples in this category.'}</p>
          </div>
        )}
      </main>
    </div>
  );
}
