import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
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

      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 w-full">
        {/* 브레드크럼 + 제목 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Link to="/" className="text-xs no-underline" style={{ color: 'var(--color-text-muted)' }}>
              {t('nav.home')}
            </Link>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/</span>
          </div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {t('nav.missions')}
          </h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
            {filteredMissions.length}{lang === 'ko' ? '개 미션' : ' missions'}
          </p>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2.5 flex-wrap mb-8">
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
                {cat.id}
                <span className="opacity-50 ml-1">{count}</span>
              </button>
            );
          })}
        </div>

        {/* 미션 리스트 */}
        <div className="space-y-3">
          {filteredMissions.map((mission) => {
            const color = CAT_COLORS[mission.category];
            const completed = missionProgress[mission.id]?.passed;
            const score = missionProgress[mission.id]?.score;

            return (
              <Link
                key={mission.id}
                to={`/mission/${mission.id}`}
                className="mission-card no-underline"
                style={{ '--mission-color': color }}
              >
                {/* 상태 */}
                <div className="mission-card-status">
                  {completed ? (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--color-success)' }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
                        <path d="M6.5 12L2 7.5l1.5-1.5L6.5 9 12.5 3 14 4.5 6.5 12z"/>
                      </svg>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full"
                      style={{ border: '2px solid var(--color-border)' }} />
                  )}
                </div>

                {/* 제목 + 설명 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono font-semibold" style={{ color }}>{mission.id}</span>
                    <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {mission.title[lang]}
                    </span>
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {mission.description[lang]}
                  </p>
                </div>

                {/* 레벨 + 점수 */}
                <div className="flex items-center gap-3 shrink-0">
                  {score != null && (
                    <span className="text-xs font-mono font-semibold" style={{ color: 'var(--color-success)' }}>
                      {score}
                    </span>
                  )}
                  <span className="mission-level-badge" style={{ '--level-color': color }}>
                    {LEVEL_LABELS[mission.level]?.[lang]}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {filteredMissions.length === 0 && (
          <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 12px' }}>
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
              <path d="M16 28a8 8 0 0116 0" stroke="currentColor" strokeWidth="2" opacity="0.3" fill="none"/>
              <circle cx="18" cy="20" r="2" fill="currentColor" opacity="0.3"/>
              <circle cx="30" cy="20" r="2" fill="currentColor" opacity="0.3"/>
            </svg>
            {t('home.preparing')}
          </div>
        )}
      </main>
    </div>
  );
}
