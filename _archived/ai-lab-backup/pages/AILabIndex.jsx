import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import Header from '../../components/layout/Header';

const LABS = [
  {
    id: 'teachable',
    path: '/ai-lab/teachable',
    color: '#6C5CE7',
    icon: (c) => (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="12" r="6" stroke={c} strokeWidth="2" opacity="0.7"/>
        <path d="M8 28c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={c} strokeWidth="2" opacity="0.4"/>
        <circle cx="13" cy="11" r="1.5" fill={c}/>
        <circle cx="19" cy="11" r="1.5" fill={c}/>
      </svg>
    ),
    badge: 'Transfer Learning',
  },
  {
    id: 'rl',
    path: '/ai-lab/rl',
    color: '#00B894',
    icon: (c) => (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="4" width="6" height="6" rx="1" fill={c} opacity="0.3"/>
        <rect x="13" y="4" width="6" height="6" rx="1" fill={c} opacity="0.5"/>
        <rect x="22" y="4" width="6" height="6" rx="1" fill={c} opacity="0.3"/>
        <rect x="4" y="13" width="6" height="6" rx="1" fill={c} opacity="0.5"/>
        <rect x="13" y="13" width="6" height="6" rx="1" fill={c} opacity="0.9"/>
        <rect x="22" y="13" width="6" height="6" rx="1" fill={c} opacity="0.5"/>
        <rect x="4" y="22" width="6" height="6" rx="1" fill={c} opacity="0.3"/>
        <rect x="13" y="22" width="6" height="6" rx="1" fill={c} opacity="0.5"/>
        <rect x="22" y="22" width="6" height="6" rx="1" fill={c} opacity="0.7"/>
      </svg>
    ),
    badge: 'Q-Learning',
  },
  {
    id: 'neuralViz',
    path: '/ai-lab/neural-viz',
    color: '#4A6CF7',
    icon: (c) => (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="6" cy="10" r="3" fill={c} opacity="0.6"/>
        <circle cx="6" cy="22" r="3" fill={c} opacity="0.6"/>
        <circle cx="16" cy="8" r="3" fill={c} opacity="0.8"/>
        <circle cx="16" cy="16" r="3" fill={c} opacity="0.8"/>
        <circle cx="16" cy="24" r="3" fill={c} opacity="0.8"/>
        <circle cx="26" cy="16" r="3" fill={c}/>
        <line x1="9" y1="10" x2="13" y2="8" stroke={c} strokeWidth="1" opacity="0.3"/>
        <line x1="9" y1="10" x2="13" y2="16" stroke={c} strokeWidth="1" opacity="0.3"/>
        <line x1="9" y1="22" x2="13" y2="16" stroke={c} strokeWidth="1" opacity="0.3"/>
        <line x1="9" y1="22" x2="13" y2="24" stroke={c} strokeWidth="1" opacity="0.3"/>
        <line x1="19" y1="8" x2="23" y2="16" stroke={c} strokeWidth="1" opacity="0.3"/>
        <line x1="19" y1="16" x2="23" y2="16" stroke={c} strokeWidth="1" opacity="0.3"/>
        <line x1="19" y1="24" x2="23" y2="16" stroke={c} strokeWidth="1" opacity="0.3"/>
      </svg>
    ),
    badge: 'Neural Network',
  },
  {
    id: 'pose',
    path: '/ai-lab/pose-dance',
    color: '#E84393',
    icon: (c) => (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="6" r="3" fill={c} opacity="0.8"/>
        <line x1="16" y1="9" x2="16" y2="20" stroke={c} strokeWidth="2.5" opacity="0.6"/>
        <line x1="16" y1="13" x2="10" y2="8" stroke={c} strokeWidth="2" opacity="0.5"/>
        <line x1="16" y1="13" x2="24" y2="10" stroke={c} strokeWidth="2" opacity="0.5"/>
        <line x1="16" y1="20" x2="10" y2="28" stroke={c} strokeWidth="2" opacity="0.5"/>
        <line x1="16" y1="20" x2="22" y2="28" stroke={c} strokeWidth="2" opacity="0.5"/>
      </svg>
    ),
    badge: 'Pose Detection',
  },
  {
    id: 'physics',
    path: '/ai-lab/physics',
    color: '#F0883E',
    icon: (c) => (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M4 28Q12 4 28 20" stroke={c} strokeWidth="2" strokeDasharray="4 2" opacity="0.4"/>
        <circle cx="4" cy="28" r="3" fill={c} opacity="0.7"/>
        <circle cx="28" cy="20" r="3" fill={c}/>
        <text x="15" y="14" fill={c} fontSize="10" fontWeight="bold" opacity="0.6">?</text>
      </svg>
    ),
    badge: 'Regression',
  },
];

export default function AILabIndex() {
  const { t, locale: lang } = useI18n();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />

      <main className="flex-1">
        {/* 히어로 */}
        <section className="relative py-16 md:py-20" style={{ backgroundColor: 'var(--color-bg-panel)' }}>
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ backgroundColor: 'rgba(74, 108, 247, 0.08)', border: '1px solid rgba(74, 108, 247, 0.15)' }}>
              <span className="text-xs font-semibold" style={{ color: '#4A6CF7' }}>TensorFlow.js</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: '#4A6CF7', color: '#fff' }}>BROWSER</span>
            </div>

            <h1 className="font-display text-4xl md:text-5xl font-black mb-4"
              style={{ color: 'var(--color-text-primary)' }}>
              {t('aiLab.title')}
            </h1>
            <p className="text-base md:text-lg max-w-xl mx-auto"
              style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              {t('aiLab.subtitle')}
            </p>
          </div>
        </section>

        {/* 랩 카드 */}
        <section className="py-12 md:py-16">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {LABS.map((lab) => (
                <Link
                  key={lab.id}
                  to={lab.path}
                  className="group no-underline rounded-2xl p-6 transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--color-bg-panel)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = lab.color;
                    e.currentTarget.style.boxShadow = `0 8px 32px ${lab.color}15`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${lab.color}0D` }}>
                      {lab.icon(lab.color)}
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${lab.color}12`, color: lab.color }}>
                      {lab.badge}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}>
                    {t(`aiLab.${lab.id}.title`)}
                  </h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                    {t(`aiLab.${lab.id}.desc`)}
                  </p>

                  <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: lab.color }}>
                    {t('aiLab.startLab')}
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 푸터 */}
        <footer className="text-center text-sm py-8"
          style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
          <p>{t('home.author')}</p>
        </footer>
      </main>
    </div>
  );
}
