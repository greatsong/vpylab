import Header from '../components/layout/Header';
import { useI18n } from '../i18n';

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
      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* 비전 */}
        <section className="mb-12">
          <h1
            className="text-3xl font-bold mb-4"
            style={{ background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {t('about.title')}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {t('about.vision')}
          </p>
        </section>

        {/* GlowScript 비교 */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.whyTitle')}
          </h2>
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--color-text-muted)' }}>
                  <th className="text-left pb-3 font-medium">{t('about.feature')}</th>
                  <th className="text-left pb-3 font-medium">GlowScript</th>
                  <th className="text-left pb-3 font-medium">VPy Lab</th>
                </tr>
              </thead>
              <tbody style={{ color: 'var(--color-text-secondary)' }}>
                {['python', 'language', 'grading', 'ai', 'sound'].map((key) => (
                  <tr key={key} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>{t(`about.compare.${key}.name`)}</td>
                    <td className="py-2.5 opacity-60">{t(`about.compare.${key}.old`)}</td>
                    <td className="py-2.5" style={{ color: 'var(--color-accent)' }}>{t(`about.compare.${key}.new`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 기술 스택 */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.techTitle')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
              >
                <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>{tech.name}</h3>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{tech.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 기여 */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.contributeTitle')}
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {t('about.contributeDesc')}
          </p>
          <div className="flex gap-3">
            <a
              href="https://github.com/greatsong/vpylab"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg no-underline transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              GitHub
            </a>
          </div>
        </section>

        {/* 라이선스 */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('about.licenseTitle')}
          </h2>
          <div className="flex flex-col gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <p><strong style={{ color: 'var(--color-text-primary)' }}>{t('about.licenseCode')}:</strong> AGPL v3</p>
            <p><strong style={{ color: 'var(--color-text-primary)' }}>{t('about.licenseContent')}:</strong> CC BY-NC-SA 4.0</p>
          </div>
        </section>

        {/* 크레딧 */}
        <section className="pb-12">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
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
