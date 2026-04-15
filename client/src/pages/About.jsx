import Header from '../components/layout/Header';
import { useI18n } from '../i18n';

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-success)" style={{ verticalAlign: '-2px', flexShrink: 0 }}>
    <path d="M6.5 12L2 7.5l1.5-1.5L6.5 9 12.5 3 14 4.5 6.5 12z"/>
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-text-muted)" style={{ verticalAlign: '-2px', flexShrink: 0 }}>
    <path d="M4.5 3L8 6.5 11.5 3 13 4.5 9.5 8 13 11.5 11.5 13 8 9.5 4.5 13 3 11.5 6.5 8 3 4.5 4.5 3z"/>
  </svg>
);

export default function About() {
  const { t } = useI18n();

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
        {/* 비전 */}
        <section className="mb-12">
          <h1
            className="text-3xl font-bold mb-4 tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {t('about.title')}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {t('about.vision')}
          </p>
        </section>

        {/* GlowScript 비교 */}
        <section className="mb-12">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.whyTitle')}
          </h2>
          <div
            className="rounded-xl p-5 overflow-x-auto"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--color-text-muted)' }}>
                  <th className="text-left pb-3 font-medium text-xs">{t('about.feature')}</th>
                  <th className="text-left pb-3 font-medium text-xs">GlowScript</th>
                  <th className="text-left pb-3 font-medium text-xs">VPyLab</th>
                </tr>
              </thead>
              <tbody style={{ color: 'var(--color-text-secondary)' }}>
                {['python', 'language', 'grading', 'sound'].map((key) => (
                  <tr key={key} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-2.5 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {t(`about.compare.${key}.name`)}
                    </td>
                    <td className="py-2.5 text-xs">
                      <span className="flex items-center gap-1.5">
                        <XIcon /> {t(`about.compare.${key}.old`)}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs">
                      <span className="flex items-center gap-1.5" style={{ color: 'var(--color-success)' }}>
                        <CheckIcon /> {t(`about.compare.${key}.new`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 기술 스택 */}
        <section className="mb-12">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.techTitle')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="rounded-lg p-4"
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

        {/* 오픈소스 + 라이선스 */}
        <section className="mb-12">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.licenseTitle')}
          </h2>
          <div className="flex flex-col gap-2 text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                style={{ backgroundColor: 'rgba(37,99,235,0.08)', color: '#2563EB' }}>
                CODE
              </span>
              <span className="text-xs">AGPL v3</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                style={{ backgroundColor: 'rgba(16,185,129,0.08)', color: '#10B981' }}>
                DOCS
              </span>
              <span className="text-xs">CC BY-NC-SA 4.0</span>
            </div>
          </div>
          <a
            href="https://github.com/greatsong/vpylab"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg no-underline transition-all font-medium"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub
          </a>
        </section>

        {/* 크레딧 */}
        <section className="pb-12">
          <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.creditsTitle')}
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {t('about.credits')}
          </p>
        </section>
      </main>
    </div>
  );
}
