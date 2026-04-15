import useAppStore from '../../stores/appStore';
import DocCodeBlock from './DocCodeBlock';

/**
 * 문서 우측 콘텐츠 패널.
 * Props: { doc, t }
 *   doc — data/docs.js의 문서 항목 (null이면 빈 상태 표시)
 *   t   — useI18n()의 번역 함수
 */
export default function DocContent({ doc, t }) {
  const locale = useAppStore((s) => s.locale);

  // 빈 상태
  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--color-text-muted)' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16v16H4z" />
          <path d="M8 8h8M8 12h5" />
        </svg>
        <p className="text-sm">{t('docs.selectTopic')}</p>
      </div>
    );
  }

  const title = typeof doc.title === 'object' ? (doc.title[locale] || doc.title['en']) : doc.title;
  const description = typeof doc.description === 'object' ? (doc.description[locale] || doc.description['en']) : doc.description;
  const example = doc.code || (typeof doc.example === 'object' ? (doc.example[locale] || doc.example['en']) : doc.example);

  return (
    <div className="max-w-3xl">
      {/* 제목 */}
      <h1
        className="text-2xl font-bold mb-3 tracking-tight"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
      >
        {title}
      </h1>

      {/* 설명 */}
      {description && (
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      )}

      {/* 시그니처 */}
      {doc.signature && (
        <div
          className="text-[13px] px-4 py-3 mb-5 overflow-x-auto"
          style={{
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
          }}
        >
          {doc.signature}
        </div>
      )}

      {/* 파라미터 테이블 */}
      {doc.params && doc.params.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {t('docs.params')}
          </h3>
          <div
            className="rounded-lg overflow-hidden"
            style={{
              border: '1px solid var(--color-border)',
            }}
          >
            <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  {[
                    locale === 'ko' ? '이름' : 'Name',
                    locale === 'ko' ? '타입' : 'Type',
                    locale === 'ko' ? '기본값' : 'Default',
                    locale === 'ko' ? '설명' : 'Description',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 text-xs font-semibold"
                      style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doc.params.map((p, i) => {
                  const descField = p.desc || p.description;
                  const paramDesc = typeof descField === 'object'
                    ? (descField[locale] || descField['en'])
                    : descField;
                  return (
                    <tr
                      key={p.name}
                      style={{
                        backgroundColor: i % 2 === 1 ? 'var(--color-bg-secondary)' : 'transparent',
                        borderBottom: i < doc.params.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}
                    >
                      <td className="px-3 py-2 font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
                        {p.name}
                      </td>
                      <td className="px-3 py-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                        {p.type}
                      </td>
                      <td className="px-3 py-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                        {p.default ?? '-'}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {paramDesc}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 예제 코드 */}
      {example && (
        <div className="mb-5">
          <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {t('docs.example')}
          </h3>
          <DocCodeBlock code={example} />
        </div>
      )}

      {/* 추가 설명 (HTML) */}
      {doc.extra && (
        <div
          className="text-sm leading-relaxed mt-4"
          style={{ color: 'var(--color-text-secondary)' }}
          dangerouslySetInnerHTML={{ __html: doc.extra }}
        />
      )}
    </div>
  );
}
