import Header from '../components/layout/Header';
import { useI18n } from '../i18n';

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--color-success)" style={{ verticalAlign: '-2px' }}>
    <path d="M6.5 12L2 7.5l1.5-1.5L6.5 9 12.5 3 14 4.5 6.5 12z"/>
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--color-text-muted)" style={{ verticalAlign: '-2px' }}>
    <path d="M4.5 3L8 6.5 11.5 3 13 4.5 9.5 8 13 11.5 11.5 13 8 9.5 4.5 13 3 11.5 6.5 8 3 4.5 4.5 3z"/>
  </svg>
);

const TECH_ICONS = {
  'React 19': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="3" fill="#61DAFB"/>
      <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#61DAFB" strokeWidth="1.5" fill="none"/>
      <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#61DAFB" strokeWidth="1.5" fill="none" transform="rotate(60 14 14)"/>
      <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#61DAFB" strokeWidth="1.5" fill="none" transform="rotate(120 14 14)"/>
    </svg>
  ),
  'Pyodide': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M8 6h6l-2 4h6l-8 12 2-8H8l4-8z" fill="#3776AB"/>
    </svg>
  ),
  'Three.js': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="6" y="6" width="16" height="16" rx="2" stroke="#6C5CE7" strokeWidth="1.5" transform="rotate(15 14 14)"/>
      <rect x="9" y="9" width="10" height="10" rx="1" fill="#6C5CE7" opacity="0.3" transform="rotate(15 14 14)"/>
    </svg>
  ),
  'Monaco Editor': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="4" y="4" width="20" height="20" rx="3" stroke="#00CEC9" strokeWidth="1.5"/>
      <line x1="8" y1="10" x2="16" y2="10" stroke="#00CEC9" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="14" x2="20" y2="14" stroke="#00CEC9" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="8" y1="18" x2="14" y2="18" stroke="#00CEC9" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
    </svg>
  ),
  'Supabase': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M14 4L6 16h8V4z" fill="#00B894" opacity="0.7"/>
      <path d="M14 24l8-12h-8v12z" fill="#00B894"/>
    </svg>
  ),
  'Web Audio API': (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M4 14h4l3-8 3 16 3-12 3 6h4" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

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
      <main className="max-w-3xl mx-auto px-6 py-14">
        {/* 비전 */}
        <section className="mb-14">
          <h1
            className="text-4xl font-black mb-5 tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {t('about.title')}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {t('about.vision')}
          </p>
        </section>

        {/* GlowScript 비교 */}
        <section className="mb-14">
          <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.whyTitle')}
          </h2>
          <div
            className="rounded-xl p-6 overflow-x-auto"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--color-text-muted)' }}>
                  <th className="text-left pb-4 font-medium">{t('about.feature')}</th>
                  <th className="text-left pb-4 font-medium">GlowScript</th>
                  <th className="text-left pb-4 font-medium">VPyLab</th>
                </tr>
              </thead>
              <tbody style={{ color: 'var(--color-text-secondary)' }}>
                {['python', 'language', 'grading', 'ai', 'sound'].map((key) => (
                  <tr key={key} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {t(`about.compare.${key}.name`)}
                    </td>
                    <td className="py-3">
                      <span className="flex items-center gap-1.5">
                        <XIcon /> {t(`about.compare.${key}.old`)}
                      </span>
                    </td>
                    <td className="py-3">
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
        <section className="mb-14">
          <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.techTitle')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="rounded-xl p-5 transition-all"
                style={{
                  backgroundColor: 'var(--color-bg-panel)',
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div className="mb-3">{TECH_ICONS[tech.name]}</div>
                <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>{tech.name}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{tech.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 기여 */}
        <section className="mb-14">
          <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.contributeTitle')}
          </h2>
          <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
            {t('about.contributeDesc')}
          </p>
          <a
            href="https://github.com/greatsong/vpylab"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-full no-underline transition-all font-medium"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub
          </a>
        </section>

        {/* 라이선스 */}
        <section className="mb-14">
          <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.licenseTitle')}
          </h2>
          <div className="flex flex-col gap-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold"
                style={{ backgroundColor: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>
                CODE
              </span>
              <span><strong style={{ color: 'var(--color-text-primary)' }}>{t('about.licenseCode')}:</strong> AGPL v3</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold"
                style={{ backgroundColor: 'rgba(0,206,201,0.1)', color: '#00CEC9' }}>
                DOCS
              </span>
              <span><strong style={{ color: 'var(--color-text-primary)' }}>{t('about.licenseContent')}:</strong> CC BY-NC-SA 4.0</span>
            </div>
          </div>
        </section>

        {/* 크레딧 */}
        <section className="pb-14">
          <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.creditsTitle')}
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {t('about.credits')}
          </p>
        </section>
      </main>
    </div>
  );
}
