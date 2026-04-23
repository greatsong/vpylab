import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';
import Header from '../components/layout/Header';
import missions, { categories, getMissionsByCategory } from '../data/missions';
import useAppStore from '../stores/appStore';

const LEVEL_LABELS = {
  1: { ko: '따라하기', en: 'Follow' },
  2: { ko: '변형하기', en: 'Modify' },
  3: { ko: '설계하기', en: 'Design' },
  4: { ko: '창작하기', en: 'Create' },
};

const CAT_COLORS = {
  CT: '#6C5CE7', CR: '#FF6B6B', MA: '#00CEC9',
  SC: '#00B894', AR: '#F0883E', SN: '#E84393', AI: '#4A6CF7',
};

export default function Missions() {
  const { t, locale: lang } = useI18n();
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || null;
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const missionProgress = useAppStore((s) => s.missionProgress);

  const categoryList = Object.values(categories);
  const filteredMissions = selectedCategory
    ? getMissionsByCategory(selectedCategory)
    : missions;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="flex-1 container-main py-8 w-full">
        {/* 제목 + 진행 요약 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <Link to="/" className="text-xs no-underline" style={{ color: 'var(--color-text-muted)' }}>
              {t('nav.home')}
            </Link>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {t('nav.missions')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {filteredMissions.length}{lang === 'ko' ? '개 미션' : ' missions'}
          </p>
        </div>

        {/* 카테고리 필터 — pill 형태 */}
        <div className="flex gap-2 flex-wrap mb-8">
          <button
            onClick={() => setSelectedCategory(null)}
            className="mission-filter-btn"
            data-active={!selectedCategory || undefined}
          >
            All
          </button>
          {categoryList.map((cat) => {
            const color = CAT_COLORS[cat.id];
            const count = getMissionsByCategory(cat.id).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className="mission-filter-btn"
                data-active={selectedCategory === cat.id || undefined}
                style={selectedCategory === cat.id ? { '--filter-color': color } : {}}
              >
                {cat.title[lang] || cat.id}
                <span className="opacity-50 ml-1">{count}</span>
              </button>
            );
          })}
        </div>

        {/* 미션 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" style={{ alignItems: 'start' }}>
          {filteredMissions.map((mission) => {
            const color = CAT_COLORS[mission.category];
            const completed = missionProgress[mission.id]?.passed;
            const score = missionProgress[mission.id]?.score;

            return (
              <Link
                key={mission.id}
                to={`/mission/${mission.id}`}
                className="no-underline block rounded-md p-5 transition-all"
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-sm)',
                  borderLeft: `3px solid ${color}`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* 상단: ID + 레벨 + 상태 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-semibold" style={{ color }}>{mission.id}</span>
                    <span className="mission-level-badge" style={{ '--level-color': color }}>
                      {LEVEL_LABELS[mission.level]?.[lang]}
                    </span>
                  </div>
                  {completed ? (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--color-success)' }}>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="white">
                        <path d="M6.5 12L2 7.5l1.5-1.5L6.5 9 12.5 3 14 4.5 6.5 12z"/>
                      </svg>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full"
                      style={{ border: '1.5px solid var(--color-border)' }} />
                  )}
                </div>

                {/* 제목 */}
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  {mission.title[lang]}
                </h3>

                {/* 설명 */}
                <p className="text-[13px] leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {mission.description[lang]}
                </p>

                {/* 하단: 카테고리 + 점수 */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${color}20`, color }}>
                    {t(`categories.${mission.category}`)}
                  </span>
                  {score != null && (
                    <span className="text-xs font-mono font-semibold" style={{ color: 'var(--color-success)' }}>
                      {score}점
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {filteredMissions.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: '0 auto 12px' }}>
              <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
              <path d="M13 25a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.5" opacity="0.3" fill="none"/>
              <circle cx="15" cy="17" r="1.5" fill="currentColor" opacity="0.3"/>
              <circle cx="25" cy="17" r="1.5" fill="currentColor" opacity="0.3"/>
            </svg>
            <p className="text-sm">{t('home.preparing')}</p>
          </div>
        )}
      </main>
    </div>
  );
}
