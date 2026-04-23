import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import useCodeShareStore from '../../stores/codeShareStore';

export default function CodeSharePanel({ onClose, onReplaceCode, onAppendCode }) {
  const { t } = useI18n();
  const sharedCodes = useCodeShareStore((s) => s.sharedCodes);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedId, setExpandedId] = useState(
    sharedCodes.length > 0 ? sharedCodes[sharedCodes.length - 1].id : null
  );

  const handleCopy = async (item) => {
    await navigator.clipboard.writeText(item.code);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  };

  return (
    <div
      className="fixed right-0 top-0 h-full z-50 flex flex-col"
      style={{
        width: '340px',
        backgroundColor: 'var(--color-bg-panel)',
        borderLeft: '1px solid var(--color-border)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
      }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center gap-2 px-4 flex-shrink-0"
        style={{ backgroundColor: 'var(--color-accent)', height: '44px' }}
      >
        <span className="text-lg">📬</span>
        <span className="text-sm font-semibold text-white flex-1">
          {t('codeShare.mailbox')}
        </span>
        <span className="text-xs text-white/70">{sharedCodes.length}{t('codeShare.count')}</span>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer border-none text-white text-sm"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        >
          ✕
        </button>
      </div>

      {/* 코드 목록 */}
      <div className="flex-1 overflow-y-auto">
        {sharedCodes.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-3xl mb-3 opacity-30">📭</div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t('codeShare.noSharedCodes')}
            </p>
          </div>
        ) : (
          sharedCodes.map((item, i) => {
            const isExpanded = expandedId === item.id;
            const isNewest = i === sharedCodes.length - 1;
            return (
              <div
                key={item.id}
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                {/* 아이템 헤더 */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full flex items-center gap-2.5 px-4 py-3 cursor-pointer border-none text-left"
                  style={{ backgroundColor: 'transparent', fontFamily: 'inherit' }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      backgroundColor: isNewest ? 'var(--color-error, #FF6B6B)' : 'var(--color-accent)',
                      color: 'white',
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {item.title}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {formatTime(item.created_at)}
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>

                {/* 펼쳐진 내용 */}
                {isExpanded && (
                  <>
                    {/* 코드 미리보기 */}
                    <div className="px-4 pb-2">
                      <pre
                        className="rounded-lg text-xs overflow-auto"
                        style={{
                          backgroundColor: '#1E1E1E',
                          color: '#D4D4D4',
                          fontFamily: "'JetBrains Mono', monospace",
                          lineHeight: 1.6,
                          padding: '10px 12px',
                          maxHeight: '180px',
                          whiteSpace: 'pre',
                          margin: 0,
                        }}
                      >
                        {item.code}
                      </pre>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-1.5 px-4 pb-3">
                      <button
                        onClick={() => handleCopy(item)}
                        className="flex-1 py-1.5 rounded-md text-xs font-semibold cursor-pointer flex items-center justify-center gap-1"
                        style={{
                          border: '1px solid var(--color-border)',
                          backgroundColor: copiedId === item.id ? '#DCFCE7' : 'var(--color-bg-secondary)',
                          color: copiedId === item.id ? '#065F46' : 'var(--color-text-primary)',
                          fontFamily: 'inherit',
                        }}
                      >
                        {copiedId === item.id ? `✓ ${t('codeShare.copied')}` : `📋 ${t('codeShare.copy')}`}
                      </button>
                      <button
                        onClick={() => { onReplaceCode(item.code); onClose(); }}
                        className="flex-1 py-1.5 rounded-md text-xs font-semibold cursor-pointer flex items-center justify-center gap-1"
                        style={{
                          border: '1px solid var(--color-accent)',
                          backgroundColor: 'var(--color-bg-secondary)',
                          color: 'var(--color-accent)',
                          fontFamily: 'inherit',
                        }}
                      >
                        🔄 {t('codeShare.replace')}
                      </button>
                      <button
                        onClick={() => { onAppendCode(item.code); onClose(); }}
                        className="flex-1 py-1.5 rounded-md text-xs font-semibold cursor-pointer flex items-center justify-center gap-1"
                        style={{
                          border: 'none',
                          backgroundColor: 'var(--color-accent)',
                          color: 'white',
                          fontFamily: 'inherit',
                        }}
                      >
                        📥 {t('codeShare.append')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
