import useAppStore from '../../stores/appStore';
import DocCodeBlock from './DocCodeBlock';

function getBilingualParts(value) {
  if (!value || typeof value !== 'object') {
    return { ko: value, en: null };
  }

  const ko = value.ko || null;
  const en = value.en || null;
  return { ko: ko || en, en: en && en !== ko ? en : null };
}

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

  const title = getBilingualParts(doc.title);
  const description = getBilingualParts(doc.description);
  const example = doc.code || (typeof doc.example === 'object' ? (doc.example[locale] || doc.example['en']) : doc.example);

  return (
    <div className="max-w-3xl">
      {/* 제목 */}
      <h1
        className="text-2xl font-bold mb-3 tracking-tight"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
      >
        {title.ko}
      </h1>
      {title.en && !title.ko?.toLowerCase?.().includes(title.en.toLowerCase()) && (
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
          {title.en}
        </p>
      )}

      {/* 설명 */}
      {(description.ko || description.en) && (
        <div className="mb-5">
          {description.ko && (
            <p className="text-sm leading-relaxed mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              {description.ko}
            </p>
          )}
          {description.en && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {description.en}
            </p>
          )}
        </div>
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
                    '이름 / Name',
                    '타입 / Type',
                    '기본값 / Default',
                    '설명 / Description',
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
                  const paramDesc = getBilingualParts(descField);
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
                        {paramDesc.ko && <div>{paramDesc.ko}</div>}
                        {paramDesc.en && (
                          <div className="mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {paramDesc.en}
                          </div>
                        )}
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
