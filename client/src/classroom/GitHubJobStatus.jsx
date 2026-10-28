const stateLabels = { queued: '대기', pending: '대기', processing: '처리 중', running: '처리 중', done: '완료', succeeded: '완료', blocked: '확인 필요', failed: '실패' };
const kindLabels = { checkpoint: '팀 버전 보존', issue: 'GitHub Issue', proposal: 'GitHub PR' };
const linkLabels = { issue: 'Issue 열기 ↗', proposal: 'PR 열기 ↗' };

function sourceLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export default function GitHubJobStatus({ job }) {
  const href = sourceLink(job.result?.url);
  return <>
    <span className="cr-small-badge">{stateLabels[job.state] || '상태 확인 중'}</span>
    <span>{kindLabels[job.kind] || 'GitHub 작업'}</span>
    {job.lastError && <small>{job.lastError}</small>}
    {['blocked', 'failed'].includes(job.state) && <small>다시 전송하지 말고 교사와 반영 상태를 확인해주세요.</small>}
    {href && <a href={href} target="_blank" rel="noreferrer">{linkLabels[job.kind] || 'GitHub 기록 열기 ↗'}</a>}
  </>;
}
