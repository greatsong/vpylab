import { useState, useCallback, useMemo } from 'react';

const KEYWORDS = new Set([
  'from', 'import', 'def', 'class', 'return', 'for', 'while', 'if', 'else',
  'elif', 'True', 'False', 'None', 'in', 'not', 'and', 'or', 'as', 'await',
  'async', 'with', 'try', 'except', 'raise', 'print',
]);

/**
 * 간단한 Python 구문 강조.
 * 주석 -> 문자열 -> 숫자 -> 키워드 순으로 치환한다.
 */
function highlightPython(code) {
  // 토큰 슬롯: 치환 후 복원용
  const tokens = [];
  const ph = (html) => {
    const idx = tokens.length;
    tokens.push(html);
    return `\x00${idx}\x00`;
  };

  let result = code
    // HTML 이스케이프
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 주석
  result = result.replace(/(#.*)/g, (m) =>
    ph(`<span style="color:var(--color-text-muted)">${m}</span>`));

  // 문자열 (큰따옴표 / 작은따옴표 — 여러 줄 제외)
  result = result.replace(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (m) =>
    ph(`<span style="color:var(--color-success)">${m}</span>`));

  // 숫자 (토큰 플레이스홀더 \x00N\x00 내부의 숫자는 제외)
  result = result.replace(/(?<!\x00)\b(\d+\.?\d*)\b(?!\x00)/g, (m) =>
    ph(`<span style="color:var(--color-warning)">${m}</span>`));

  // 키워드 (단어 경계 기준)
  result = result.replace(/\b([a-zA-Z_]\w*)\b/g, (m) =>
    KEYWORDS.has(m)
      ? ph(`<span style="color:var(--color-accent)">${m}</span>`)
      : m);

  // 토큰 복원
  result = result.replace(/\x00(\d+)\x00/g, (_, i) => tokens[i]);

  return result;
}

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="5" width="9" height="9" rx="1.5" />
    <path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
  </svg>
);

export default function DocCodeBlock({ code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const highlighted = useMemo(() => highlightPython(code), [code]);

  return (
    <div className="relative group" style={{ borderRadius: 'var(--radius-md)' }}>
      {/* 복사 버튼 */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 flex items-center gap-1 text-[11px] px-2 py-1 rounded-md cursor-pointer border transition-all opacity-0 group-hover:opacity-100"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg-panel)',
          color: copied ? 'var(--color-success)' : 'var(--color-text-muted)',
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied!' : ''}
      </button>

      <pre
        className="overflow-x-auto text-[13px] leading-relaxed p-4 m-0"
        style={{
          fontFamily: 'var(--font-mono)',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-primary)',
        }}
      >
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}
