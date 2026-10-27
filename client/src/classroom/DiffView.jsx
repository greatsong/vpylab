export default function DiffView({ before = '', after = '', beforeLabel = '팀 확정 버전', afterLabel = '제안한 버전' }) {
  const left = before.split('\n'); const right = after.split('\n');
  const size = Math.max(left.length, right.length);
  return <div className="cr-diff" aria-label="팀 확정 코드와 제안 코드 비교">
    <div className="cr-diff-head"><span>{beforeLabel}</span><span>{afterLabel}</span></div>
    <div className="cr-diff-scroll">{Array.from({ length: Math.min(size, 500) }, (_, index) =>
      <div className={`cr-diff-row ${left[index] !== right[index] ? 'changed' : ''}`} key={index}>
        <pre><small>{index + 1}</small>{left[index] ?? ''}</pre><pre><small>{index + 1}</small>{right[index] ?? ''}</pre>
      </div>)}
      {size > 500 && <p className="cr-hint">앞의 500줄을 표시합니다. 전체 코드는 파일로 내려받을 수 있습니다.</p>}
    </div>
  </div>;
}
