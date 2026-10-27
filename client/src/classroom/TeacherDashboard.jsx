import { useEffect, useState } from 'react';
import { request } from './api';

export default function TeacherDashboard({ user, onOpen }) {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    request('/teacher', { userId: user.id, signal: abort.signal }).then(setData).catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, [user.id]);
  return <section><div className="cr-page-heading"><div><span className="cr-eyebrow">OBSERVE THE THINKING</span><h1>교사 관찰실</h1><p>누가 더 많이 저장했는지보다, 어떻게 생각이 바뀌었는지 살펴봅니다.</p></div></div>
    {error && <div className="cr-banner error" role="alert">{error}</div>}
    {!data && !error ? <div className="cr-loading">학습 기록을 모으는 중입니다…</div> : data && <>
      <div className="cr-criteria">{(data.criteria || []).map((criterion, index) => <div key={criterion}><span>0{index + 1}</span><strong>{criterion}</strong></div>)}</div>
      <div className="cr-banner">AI 사용 여부는 평가 항목이 아닙니다. 관찰된 증거와 학생의 설명을 함께 살펴보세요.</div>
      <div className="cr-teacher-projects">{data.projects.map((project) => <article className="cr-panel" key={project.id}><div className="cr-section-heading"><div><span className="cr-small-badge">{project.aiPolicy === 'disabled' ? 'AI 없이 탐구' : 'AI 선택 사용'}</span><h2>{project.title}</h2></div><button className="cr-button" onClick={() => onOpen(project.id)}>과정 살펴보기 ↗</button></div><p>{project.problem}</p><div className="cr-activity-counts"><span>참여자 <b>{project.memberCount}</b></span><span>확정 버전 <b>v{project.version}</b></span><span>질문 <b>{project.issueCount}</b></span><span>변경 제안 <b>{project.proposalCount}</b></span><span>동료 검토 <b>{project.reviewCount}</b></span></div>
        {project.reflections?.length ? <div className="cr-observations">{project.reflections.slice(0, 3).map((entry) => <div key={entry.checkpointId}><span>v{entry.version}</span><div><strong>관찰</strong><p>{entry.observation || '아직 관찰 기록이 없습니다.'}</p><strong>다음 실험</strong><p>{entry.nextStep || '아직 다음 실험을 적지 않았습니다.'}</p></div></div>)}</div> : <div className="cr-empty small">아직 실험 기록이 없습니다. 첫 가설과 관찰을 남기도록 안내해주세요.</div>}
      </article>)}</div>{!data.projects.length && <div className="cr-empty">프로젝트를 만들거나 초대받은 뒤 학습 과정을 볼 수 있습니다.</div>}
    </>}
  </section>;
}
