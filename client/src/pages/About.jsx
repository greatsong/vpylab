import Header from '../components/layout/Header';
import { useI18n } from '../i18n';

const FeatureIcon = ({ children }) => (
  <div
    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
    style={{ backgroundColor: 'var(--color-accent-bg)' }}
  >
    {children}
  </div>
);

export default function About() {
  const { t, messages } = useI18n();

  const features = [
    { icon: '🐍', title: t('about.feat.python'), desc: t('about.feat.pythonDesc') },
    { icon: '🎵', title: t('about.feat.sound'), desc: t('about.feat.soundDesc') },
    { icon: '🏆', title: t('about.feat.grading'), desc: t('about.feat.gradingDesc') },
    { icon: '🌍', title: t('about.feat.i18n'), desc: t('about.feat.i18nDesc') },
    { icon: '🎨', title: t('about.feat.gallery'), desc: t('about.feat.galleryDesc') },
    { icon: '📱', title: t('about.feat.mobile'), desc: t('about.feat.mobileDesc') },
  ];

  const techStack = [
    { name: 'React 19', desc: t('about.techReact') },
    { name: 'Pyodide', desc: t('about.techPyodide') },
    { name: 'Three.js', desc: t('about.techThreejs') },
    { name: 'Monaco Editor', desc: t('about.techMonaco') },
    { name: 'Supabase', desc: t('about.techSupabase') },
    { name: 'Web Audio API', desc: t('about.techAudio') },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-12">

        {/* 히어로 */}
        <section className="mb-14 text-center">
          <div className="text-5xl mb-4">🔬</div>
          <h1
            className="text-3xl font-bold mb-3 tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            VPyLab
          </h1>
          <p
            className="text-sm leading-relaxed max-w-md mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('about.vision')}
          </p>
        </section>

        {/* 주요 기능 */}
        <section className="mb-14">
          <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.featTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-xl p-4"
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <FeatureIcon>{f.icon}</FeatureIcon>
                <div>
                  <h3 className="text-xs font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                    {f.title}
                  </h3>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* GitHub 기반 오픈소스 협력 */}
        <section className="mb-14">
          <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.collabTitle')}
          </h2>
          <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {t('about.collabDesc')}
          </p>
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
            }}
          >
            <ul className="flex flex-col gap-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {(messages?.about?.collabItems || []).map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-success)' }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M6.5 12L2 7.5l1.5-1.5L6.5 9 12.5 3 14 4.5 6.5 12z"/>
                    </svg>
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <a
            href="https://github.com/greatsong/vpylab"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg no-underline transition-all font-medium mt-4"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub Repository
          </a>
        </section>

        {/* 기술 스택 */}
        <section className="mb-14">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.techTitle')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="rounded-xl p-4"
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <h3 className="text-xs font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>{tech.name}</h3>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{tech.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 라이선스 + 크레딧 */}
        <section className="pb-12">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.licenseTitle')}
          </h2>
          <div className="flex flex-col gap-2 text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                style={{ backgroundColor: 'rgba(37,99,235,0.08)', color: '#2563EB' }}>CODE</span>
              <span className="text-xs">AGPL v3</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                style={{ backgroundColor: 'rgba(16,185,129,0.08)', color: '#10B981' }}>DOCS</span>
              <span className="text-xs">CC BY-NC-SA 4.0</span>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('about.credits')}
          </p>
        </section>
      </main>
    </div>
  );
}
