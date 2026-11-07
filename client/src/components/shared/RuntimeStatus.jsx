/** Python 준비 상태만 표시해 엔진을 기다리는 동안에도 코드와 안내를 볼 수 있습니다. */
export default function RuntimeStatus({ status, progress = 0, message = '', onRetry, locale = 'ko' }) {
  const ko = locale === 'ko';
  const label = status === 'ready' ? (ko ? '준비됨' : 'Ready')
    : status === 'running' ? (ko ? '실행 중' : 'Running')
      : status === 'stopping' ? (ko ? '실행 정리 중…' : 'Finishing previous run…')
        : status === 'error' ? (ko ? 'Python 준비 실패' : 'Python could not start')
          : status === 'loading' ? `${ko ? 'Python 준비 중' : 'Preparing Python'} · ${Math.round(progress)}%`
            : (ko ? 'Python 준비 전' : 'Python not ready');
  return (
    <span className="inline-flex items-center gap-2" role="status" title={message}>
      <span>{label}</span>
      {status === 'loading' && <progress aria-label={ko ? 'Python 준비 진행률' : 'Python preparation progress'} max="100" value={progress} className="h-1 w-14" />}
      {(status === 'error' || status === 'idle') && <button type="button" onClick={onRetry} className="underline cursor-pointer bg-transparent border-0 p-0" style={{ color: 'var(--color-accent)' }}>{ko ? '다시 준비' : 'Retry'}</button>}
    </span>
  );
}
