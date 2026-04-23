import { useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/useI18n';

/**
 * 콘솔 출력 패널
 * 보안: textContent만 사용 (innerHTML 절대 금지 — XSS 방지)
 */
export default function OutputConsole({ outputs = [], onClear }) {
  const { t } = useI18n();
  const scrollRef = useRef(null);

  // 새 출력 시 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputs]);

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-3 py-1.5 text-xs shrink-0"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span className="font-medium">{t('console.title')}</span>
        <button
          onClick={onClear}
          className="px-2 py-0.5 rounded text-xs cursor-pointer border-none transition-colors"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-muted)',
          }}
        >
          {t('console.clear')}
        </button>
      </div>

      {/* 출력 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 text-sm leading-relaxed"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {outputs.length === 0 ? (
          <div className="text-xs pt-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
            {t('console.noOutput')}
          </div>
        ) : (
          outputs.map((item, i) => (
            <div
              key={i}
              className="py-0.5 animate-slide-up"
              style={{
                color: item.type === 'error'
                  ? 'var(--color-error)'
                  : item.type === 'warning'
                    ? 'var(--color-warning)'
                    : item.type === 'success'
                      ? 'var(--color-success)'
                      : 'var(--color-text-primary)',
              }}
            >
              {/* textContent만 사용 — XSS 방지 */}
              {item.type === 'error' && <span style={{ marginRight: 4, fontFamily: 'var(--font-sans)' }}>&#x2716;</span>}
              {item.type === 'warning' && <span style={{ marginRight: 4, fontFamily: 'var(--font-sans)' }}>&#x26A0;</span>}
              {item.type === 'success' && <span style={{ marginRight: 4, fontFamily: 'var(--font-sans)' }}>&#x2714;</span>}
              {item.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
