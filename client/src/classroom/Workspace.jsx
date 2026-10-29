import { useCallback, useEffect, useRef, useState } from 'react';
import CodeEditor from '../components/editor/CodeEditor';
import RuntimePanel from './RuntimePanel';
import EvidenceForm from './EvidenceForm';
import { emptyEvidence } from './evidence';
import DiffView from './DiffView';
import GitHubLearningPanel, { FeedbackRecord } from './GitHubLearningPanel';
import GitHubJobStatus from './GitHubJobStatus';
import PeerReviewTab from './PeerReview';
import useDraft from './useDraft';
import { downloadFile, request } from './api';
import missions from '../data/missions';
import { projectAppearance } from './curriculum';
import { gradeMission } from '../engine/grading-engine';

const dateText = (value) => value ? new Date(value).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const evidenceLabels = { hypothesis: '예상과 가설', observation: '실험과 관찰', reasoning: '판단한 이유', nextStep: '다음에 확인할 것', aiUse: 'AI 제안과 판단' };
const statusText = { loading: '초안을 여는 중', local: '이 기기에 보존됨', saving: '서버에 초안 보존 중', saved: '개인 초안 보존 완료', offline: '연결 대기 · 이 기기의 초안 유지' };

export default function Workspace(props) {
  const [initial, setInitial] = useState(null); const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    request(`/projects/${props.projectId}`, { userId: props.user.id, signal: abort.signal }).then(setInitial).catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, [props.projectId, props.user.id]);
  if (error) return <div className="cr-empty"><h2>프로젝트를 열지 못했습니다.</h2><p role="alert">{error}</p><a className="cr-button" href="#/">프로젝트 목록으로</a></div>;
  if (!initial) return <div className="cr-loading">안전하게 작업을 불러오는 중입니다…</div>;
  return <WorkingSession {...props} initial={initial} />;
}

function EvidenceView({ evidence }) {
  const entries = Object.entries(evidence || {}).filter(([key, value]) => evidenceLabels[key] && value);
  return entries.length ? <dl className="cr-evidence-view">{entries.map(([key, value]) => <div key={key}><dt>{evidenceLabels[key]}</dt><dd>{value}</dd></div>)}</dl> : <p className="cr-hint">아직 실험 기록이 없습니다.</p>;
}

function WorkingSession({ initial, user, projectId, localMode, users, onRefresh, initialTab = 'lab' }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState(initialTab);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveKind, setSaveKind] = useState(null);
  const [message, setMessage] = useState('');
  const [evidence, setEvidence] = useState(emptyEvidence);
  const [conflict, setConflict] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const [grade, setGrade] = useState(null);
  const mounted = useRef(true);
  const project = data.project;
  const canEdit = project.myRole !== 'viewer';
  const draftState = useDraft(user.id, projectId, initial.checkpoint, { readOnly: !canEdit });
  const { draft } = draftState;
  const canManage = ['teacher', 'owner'].includes(project.myRole);
  const name = (id) => data.members.find((member) => member.id === id)?.name || users.find((account) => account.id === id)?.name || '참여자';
  const material = project.source?.kind === 'mission' ? missions.find((item) => item.id === project.source.id) : null;

  const reload = useCallback(async () => {
    const result = await request(`/projects/${projectId}`, { userId: user.id });
    if (mounted.current) setData(result);
    return result;
  }, [projectId, user.id]);

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => { reload().catch(() => {}); }, 6000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [reload]);

  const perform = async (action, success) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await action();
      if (mounted.current) {
        try { await reload(); } catch { setError('작업은 저장됐지만 화면 갱신이 지연되고 있습니다. 같은 작업을 다시 제출할 필요는 없습니다.'); }
        if (success) setNotice(success);
      }
      return result;
    }
    catch (e) {
      if (mounted.current) {
        if (e.code === 'version_conflict') setConflict(e.current);
        setError(e.message);
      }
      return null;
    } finally { if (mounted.current) setBusy(false); }
  };

  const save = async (event) => {
    event.preventDefault(); if (!draft) return;
    const kind = saveKind;
    const payload = { code: draft.code, baseVersion: draft.baseVersion, evidence, ...(kind === 'proposal' ? { title: message } : { message }) };
    const result = await perform(() => request(`/projects/${projectId}/${kind === 'proposal' ? 'proposals' : 'checkpoints'}`, { method: 'POST', userId: user.id, body: payload }), kind === 'proposal' ? '변경 제안을 팀에 제출했습니다.' : '팀의 새 버전을 저장했습니다.');
    if (!result || !mounted.current) return;
    setNotice(kind === 'proposal' ? '변경 제안을 팀에 제출했습니다.' : '팀의 새 버전을 저장했습니다.');
    if (kind !== 'proposal') draftState.advanceBase(result.checkpoint.version);
    else setTab('review');
    setSaveKind(null); setMessage(''); setEvidence(emptyEvidence()); onRefresh();
  };

  const restore = (code, baseVersion, label) => {
    try { draftState.replace(code, baseVersion); setNotice(`개인 초안에 ${label} 내용을 불러왔습니다. 이전 초안은 복구 기록에 남겼습니다.`); setConflict(null); setTab('lab'); setRunResult(null); setGrade(null); }
    catch (e) { setError(e.message); }
  };

  const openSave = (kind) => {
    setSaveKind(kind); setMessage(''); setError('');
    if (runResult?.code === draft?.code) setEvidence((previous) => ({ ...previous, observation: previous.observation || `${runResult.status === 'completed' ? '실행 완료' : runResult.status === 'stopped' ? '실행 중지 후 관찰' : '오류 확인'}\n${runResult.output.filter((entry) => entry.type !== 'success').map((entry) => entry.text).join('\n').slice(0, 1800)}` }));
  };

  const checkMission = () => {
    if (!material || !runResult || runResult.code !== draft?.code || runResult.status === 'error') return;
    setGrade(gradeMission(material, draft.code));
  };

  if (!draft) return <div className="cr-loading">개인 초안을 복구하고 있습니다…</div>;
  const behind = draft.baseVersion < project.version;
  const look = projectAppearance(project);
  return <div className={`cr-workspace ${tab === 'lab' ? 'lab-mode' : ''}`}>
    <div className="cr-workspace-heading"><a className="cr-back" href="#/">← 프로젝트</a><h1><span>{project.title}</span><span className="cr-small-badge">v{project.version}</span></h1>
      <div className="cr-project-meta">{project.source && <span className="cr-source-chip" style={{ '--chip-accent': look.accent }} title={`수업 자료: ${project.source.title}`}><i aria-hidden="true">{look.icon}</i><span>{project.source.title}</span></span>}<span>{data.members.length}명의 참여자</span><b>·</b><span>{project.aiPolicy === 'disabled' ? 'AI 없이 탐구하는 수업' : 'AI 사용은 선택'}</span></div>
      <div className="cr-workspace-actions"><button className="cr-button" onClick={() => downloadFile('main.py', canEdit ? draft.code : project.code)}>코드 내려받기 ↓</button>{canEdit && <button className="cr-button primary" onClick={() => openSave('proposal')} disabled={busy}>변경 제안 ↗</button>}</div></div>
    <div className="cr-workspace-nav"><div className="cr-tabs" role="tablist" aria-label="프로젝트 활동">{[['problem', '01', '문제와 질문'], ['lab', '02', '제작과 실험'], ['review', '03', '함께 검토'], ['process', '04', 'GitHub 과정'], ['journal', '05', '기록과 성찰'], ['peer', '', '동료 리뷰'], ['team', '', '팀·연결']].map(([key, number, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><small>{number}</small>{label}{key === 'review' && <span>{data.proposals.filter((item) => item.state === 'open').length}</span>}</button>)}</div><div className={`cr-save-state state-${draftState.status}`} role="status"><i />{canEdit ? statusText[draftState.status] : '관찰자 · 읽기 전용'}</div></div>
    {(error || notice) && <div className={`cr-banner ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{error || notice}<button className="cr-link-button" onClick={() => { setError(''); setNotice(''); }}>닫기</button></div>}
    {draftState.storageError && <div className="cr-banner error" role="alert">{draftState.storageError}</div>}
    {draftState.error && canEdit && <div className="cr-banner warning">{draftState.error} <button className="cr-link-button" onClick={draftState.retry}>다시 연결</button></div>}
    {behind && canEdit && <div className="cr-banner warning">팀에 새 버전 v{project.version}이 있습니다. 내 초안은 그대로 보존되어 있습니다.<button className="cr-button small" onClick={() => setConflict(data.checkpoint)}>최신 코드와 비교</button></div>}
    {tab === 'problem' && <div className="cr-workspace-two-col"><ProblemPanel project={project} canManage={canManage} busy={busy} onSave={(body) => perform(() => request(`/projects/${projectId}/settings`, { method: 'PATCH', userId: user.id, body }), '문제와 수업 방식을 저장했습니다.')} /><IssuePanel issues={data.issues} jobs={data.jobs || []} name={name} canEdit={canEdit} busy={busy} onShowGitHub={() => setTab('team')} onPublish={(issue) => perform(() => request(`/projects/${projectId}/github/issues`, { method: 'POST', userId: user.id, body: { issueId: issue.id, title: issue.title, body: issue.body } }), '질문을 GitHub Issue 작업 대기열에 보존했습니다. GitHub 과정에서 반영 기록을 확인하세요.')}  onAdd={(body) => perform(() => request(`/projects/${projectId}/issues`, { method: 'POST', userId: user.id, body }), '질문을 남겼습니다.')} /></div>}
    {tab === 'lab' && <><div className="cr-lab-layout"><section className="cr-editor-panel"><div className="cr-editor-title"><span><i /> main.py <small>나의 개인 초안</small></span><span>기준 v{draft.baseVersion} · Python</span></div><div className="cr-editor"><CodeEditor readOnly={!canEdit} code={canEdit ? draft.code : project.code} onChange={canEdit ? (code) => { draftState.update(code); setGrade(null); } : () => {}} /></div><div className="cr-editor-footer"><span>팀 코드는 제안 반영 또는 명시적 저장으로만 바뀝니다.</span>{canEdit && <button className="cr-link-button" disabled={busy} onClick={() => openSave('checkpoint')}>팀 버전으로 저장</button>}</div></section><RuntimePanel key={projectId} code={canEdit ? draft.code : project.code} onRunResult={setRunResult} /></div>
      {material && <section className="cr-panel cr-mission-check"><div><h3>{material.title.ko}</h3><p>{material.description.ko}</p></div><button className="cr-button" disabled={!runResult || runResult.code !== draft.code || runResult.status === 'error'} onClick={checkMission}>학습 조건 확인</button>{grade && <div className={`cr-banner ${grade.passed ? 'success' : 'warning'}`}>{grade.message || `${grade.score}점 · ${grade.passed ? '조건을 만족했습니다.' : '결과를 확인해보세요.'}`}{grade.results?.map((item, index) => <p key={index}>{item.message}</p>)}</div>}</section>}
    </>}
    {tab === 'review' && <ReviewPanel data={data} user={user} name={name} busy={busy} canEdit={canEdit} onShowGitHub={() => setTab('team')} onReview={(proposalId, body) => perform(() => request(`/projects/${projectId}/proposals/${proposalId}/reviews`, { method: 'POST', userId: user.id, body }), '검토 의견을 남겼습니다.')} onMerge={(proposalId) => perform(() => request(`/projects/${projectId}/proposals/${proposalId}/merge`, { method: 'POST', userId: user.id, body: {} }), '검토한 제안을 팀 버전으로 반영했습니다.')} onOpen={(proposal) => restore(proposal.code, project.version, '제안 코드')} />}
    {tab === 'process' && <GitHubLearningPanel projectId={projectId} user={user} onRefresh={reload} />}
    {tab === 'journal' && <div className="cr-workspace-two-col"><section className="cr-panel"><div className="cr-section-heading"><h2>실험의 발자국</h2><button className="cr-button small" onClick={async () => { try { const result = await request(`/projects/${projectId}/export`, { userId: user.id }); downloadFile('vpylab-project.json', JSON.stringify(result, null, 2), 'application/json'); } catch (e) { setError(e.message); } }}>프로젝트 기록 내보내기</button></div><p className="cr-hint">버전을 복원해도 팀 코드는 바뀌지 않습니다. 먼저 개인 초안으로 열립니다.</p><div className="cr-timeline">{data.checkpoints.map((checkpoint) => <article key={checkpoint.id}><div className="cr-timeline-dot" /><div className="cr-timeline-head"><span>v{checkpoint.version}</span><strong>{checkpoint.message}</strong></div><p className="cr-hint">{name(checkpoint.authorId)} · {dateText(checkpoint.createdAt)}</p><EvidenceView evidence={checkpoint.evidence} />{canEdit && <button className="cr-button small" onClick={() => restore(checkpoint.code, project.version, `v${checkpoint.version} 버전`)}>이 버전을 초안으로 복원</button>}</article>)}</div></section><section className="cr-panel"><h2>교사의 질문과 피드백</h2>{data.feedback?.map((entry) => <FeedbackRecord key={entry.id} entry={entry} name={name} />)}{!data.feedback?.length && <p className="cr-empty small">아직 피드백이 없습니다.</p>}{user.role === 'teacher' && <><p className="cr-hint">피드백은 GitHub 과정 화면에서 근거를 연결해 작성합니다. 팀 전체, 학생 개인, 교사 비공개 범위를 고를 수 있습니다.</p><button className="cr-button" onClick={() => setTab('process')}>피드백 작성하기 ↗</button></>}
      {canEdit && <PersonalDrafts key={`${user.id}:${projectId}`} userId={user.id} projectId={projectId} busy={busy} onOpen={(entry) => restore(entry.code, entry.baseVersion, '이전 편집 창의 초안')} />}
      {canEdit && draftState.recoveries.length > 0 && <><h3>이 기기의 초안 복구 기록</h3><p className="cr-hint">코드를 교체하기 직전의 개인 초안입니다. 이 계정·이 프로젝트에만 표시됩니다.</p>{draftState.recoveries.map((entry, index) => <button className="cr-recovery" key={`${entry.archivedAt}-${index}`} onClick={() => restore(entry.code, project.version, '복구 초안')}>{dateText(entry.archivedAt)} · {entry.code.split('\n').length}줄 <span>복구 ↗</span></button>)}</>}
    </section></div>}
    {tab === 'peer' && <PeerReviewTab key={`${user.id}:${projectId}`} projectId={projectId} user={user} />}
    {tab === 'team' && <TeamPanel data={data} user={user} users={users} localMode={localMode} busy={busy} canManage={canManage} onShowProcess={() => setTab('process')} onAction={perform} onRestore={(code) => restore(code, project.version, 'GitHub 비교 코드')} />}
    {saveKind && <div className="cr-modal-backdrop"><section className="cr-modal wide" role="dialog" aria-modal="true" aria-labelledby="save-dialog-title"><div className="cr-section-heading"><span className="cr-section-kicker">생각과 실험 남기기</span><button className="cr-icon-button" onClick={() => setSaveKind(null)} disabled={busy} aria-label="닫기">×</button></div><h2 id="save-dialog-title">{saveKind === 'proposal' ? '변경을 제안하고, 함께 검토하기' : '실험을 팀 버전으로 저장하기'}</h2><p>{saveKind === 'proposal' ? '교실 안에서 함께 검토할 제안입니다. 팀 버전으로 반영한 뒤 팀·연결에서 GitHub PR로 보낼 수 있습니다.' : '팀의 확정 코드가 바뀝니다. 동료 검토가 필요하면 변경 제안을 이용하세요.'}</p><form onSubmit={save}><label className="cr-field"><span>{saveKind === 'proposal' ? '제안 제목' : '어떤 변화가 있었나요?'}</span><input disabled={busy} required maxLength={200} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="예: 속도를 바꿔 충돌 조건을 비교했어요" /></label><EvidenceForm disabled={busy} value={evidence} onChange={setEvidence} aiPolicy={project.aiPolicy} />{error && <div className="cr-banner error" role="alert">{error}</div>}<div className="cr-modal-actions"><button type="button" className="cr-button" disabled={busy} onClick={() => setSaveKind(null)}>계속 실험하기</button><button className="cr-button primary" disabled={busy || !message.trim()}>{busy ? '보존하는 중…' : saveKind === 'proposal' ? '팀에 제안하기 →' : '팀 버전으로 저장'}</button></div></form></section></div>}
    {conflict && <ConflictDialog current={conflict} draft={draft} onClose={() => setConflict(null)} onResolve={(code) => restore(code, conflict.version, '비교한 코드')} />}
  </div>;
}

function PersonalDrafts({ userId, projectId, busy, onOpen }) {
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const scope = `${userId}:${projectId}`;
  const current = response?.scope === scope ? response : null;

  useEffect(() => {
    let live = true;
    const abort = new AbortController();
    request(`/projects/${projectId}/drafts/list`, { userId, signal: abort.signal })
      .then(({ drafts }) => {
        if (!live) return;
        const ownDrafts = (Array.isArray(drafts) ? drafts : [])
          .filter((entry) => entry.userId === userId && entry.projectId === projectId && typeof entry.code === 'string' && Number.isSafeInteger(entry.baseVersion) && entry.baseVersion >= 0)
          .sort((first, second) => (Date.parse(second.updatedAt) || 0) - (Date.parse(first.updatedAt) || 0))
          .slice(0, 20);
        setResponse({ scope, drafts: ownDrafts, error: '' });
      }).catch((error) => {
        if (live && error.name !== 'AbortError') setResponse({ scope, drafts: [], error: error.message || '연결 상태를 확인해주세요.' });
      });
    return () => { live = false; abort.abort(); };
  }, [userId, projectId, scope, attempt]);

  return <section aria-label="이전 편집 창의 개인 초안">
    <div className="cr-section-heading"><h3>서버에 보존된 나의 초안</h3><button type="button" className="cr-link-button" disabled={!current} onClick={() => { setResponse(null); setAttempt((value) => value + 1); }}>목록 다시 불러오기</button></div>
    <p className="cr-hint">다른 편집 창에서 저장한 본인의 초안입니다. 최신 20개를 표시하며, 열기 전의 현재 초안도 복구 기록에 남습니다.</p>
    {!current ? <p className="cr-hint" role="status">개인 초안 목록을 불러오고 있습니다…</p> : current.error ? <p className="cr-banner warning" role="alert">초안 목록을 불러오지 못했습니다. {current.error}</p> : current.drafts.length ? current.drafts.map((entry, index) => <article className="cr-feedback" key={`${entry.clientId}-${index}`}>
      <strong>{Number.isFinite(Date.parse(entry.updatedAt)) ? dateText(entry.updatedAt) : '저장 시각 확인 필요'}</strong>
      <p className="cr-hint">기준 v{entry.baseVersion} · {entry.code.split('\n').length}줄</p>
      <button type="button" className="cr-button small" disabled={busy} onClick={() => onOpen(entry)}>이 초안을 열기</button>
    </article>) : <p className="cr-empty small">서버에 보존된 개인 초안이 아직 없습니다.</p>}
  </section>;
}

function ProblemPanel({ project, canManage, busy, onSave }) {
  const [form, setForm] = useState({ title: project.title, problem: project.problem, successCriteria: project.successCriteria, aiPolicy: project.aiPolicy });
  return <section className="cr-panel"><span className="cr-section-kicker">문제와 성공 기준</span><h2>우리 팀의 질문</h2><form onSubmit={(event) => { event.preventDefault(); onSave(form); }}>{[['problem', '해결하고 싶은 문제'], ['successCriteria', '성공했다고 판단할 기준']].map(([key, label]) => <label className="cr-field" key={key}><span>{label}</span><textarea rows={4} maxLength={2000} value={form[key]} readOnly={!canManage} placeholder="아직 작성하지 않았습니다." onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}<label className="cr-field"><span>수업의 AI 사용 방식</span><select value={form.aiPolicy} disabled={!canManage} onChange={(event) => setForm({ ...form, aiPolicy: event.target.value })}><option value="optional">AI 사용은 선택</option><option value="disabled">AI를 사용하지 않는 수업</option></select></label><p className="cr-hint">AI 없이도 제작·실험·리뷰·평가의 모든 과정을 진행할 수 있습니다.</p>{canManage && <button className="cr-button primary" disabled={busy}>문제와 수업 방식 저장</button>}</form></section>;
}

function IssuePanel({ issues, jobs, name, canEdit, busy, onAdd, onPublish, onShowGitHub }) {
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  return <section className="cr-panel"><span className="cr-section-kicker">질문으로 다음 실험 열기</span><h2>함께 풀어볼 질문</h2>
    <p className="cr-hint">질문을 남긴 뒤 GitHub Issue로 보내면 팀의 협업 기록으로 이어집니다.</p>
    {canEdit && <form className="cr-issue-form" onSubmit={async (event) => { event.preventDefault(); if (await onAdd({ title, body })) { setTitle(''); setBody(''); } }}><label className="cr-field"><span>질문 제목</span><input disabled={busy} required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="무엇이 궁금한가요?" /></label><label className="cr-field"><span>관찰한 상황과 시도</span><textarea disabled={busy} rows={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="재현 조건, 예상과 다른 결과를 함께 적어주세요." /></label><button className="cr-button" disabled={busy || !title.trim()}>질문 남기기 ＋</button></form>}
    {issues.map((issue) => {
      const job = jobs.find((item) => item.kind === 'issue' && item.issueId === issue.id);
      return <article className="cr-issue" key={issue.id}><span className="cr-issue-dot">○</span><div><h3>{issue.title}</h3><p>{issue.body}</p><small>{name(issue.authorId)} · {dateText(issue.createdAt)}</small>
        {canEdit && <button className="cr-link-button" disabled={busy || Boolean(job)} onClick={() => onPublish(issue)}>{job ? 'GitHub Issue 작업 보존됨' : '이 질문을 GitHub Issue로 보내기 ↗'}</button>}
        {job && <div className="cr-job-list"><div><GitHubJobStatus job={job} /></div><button className="cr-link-button" onClick={onShowGitHub}>GitHub 반영 상태와 원문 확인 →</button></div>}
      </div></article>;
    })}
    {!issues.length && <p className="cr-empty small">질문을 남기면 팀의 다음 실험이 됩니다.</p>}
  </section>;
}

function ReviewPanel({ data, user, name, busy, canEdit, onReview, onMerge, onOpen, onShowGitHub }) {
  const [selectedId, setSelectedId] = useState(null); const [comment, setComment] = useState('');
  const proposal = data.proposals.find((item) => item.id === selectedId) || data.proposals[0];
  return <><div className="cr-banner"><span>이곳의 제안·승인은 교실 안 팀 검토입니다. GitHub 리뷰는 PR에서 진행합니다.</span><button className="cr-button small" onClick={onShowGitHub}>팀 확정 버전을 GitHub로 보내기 →</button></div><div className="cr-review-layout"><aside className="cr-panel"><h2>팀의 변경 제안</h2><p className="cr-hint">무엇을 바꿨는지, 왜 바꿨는지 살펴봅니다.</p>{data.proposals.map((item) => <button className={`cr-proposal-item ${proposal?.id === item.id ? 'active' : ''}`} key={item.id} onClick={() => { setSelectedId(item.id); setComment(''); }}><span className={`cr-small-badge ${item.state === 'merged' ? 'mint' : ''}`}>{item.state === 'merged' ? '반영됨' : '검토 중'}</span><strong>{item.title}</strong><small>{name(item.authorId)} · 기준 v{item.baseVersion}</small></button>)}{!data.proposals.length && <p className="cr-empty small">제작과 실험 화면에서 첫 변경을 제안해보세요.</p>}</aside><section className="cr-panel">{proposal ? <><div className="cr-section-heading"><div><span className="cr-section-kicker">제안과 근거 검토하기</span><h2>{proposal.title}</h2><p>{name(proposal.authorId)}의 제안 · {dateText(proposal.createdAt)}</p></div>{canEdit && <button className="cr-button small" onClick={() => onOpen(proposal)}>초안에서 실행해보기 ↗</button>}</div><EvidenceView evidence={proposal.evidence} /><DiffView before={data.checkpoints.find((item) => item.version === proposal.baseVersion)?.code || ''} after={proposal.code} />
      <div className="cr-review-comments">{data.reviews.filter((item) => item.proposalId === proposal.id).map((review) => <article key={review.id}><strong>{name(review.authorId)} <span className="cr-small-badge">{review.decision === 'approve' ? '승인' : '보완 요청'}</span></strong><p>{review.comment || '검토 의견이 없습니다.'}</p></article>)}</div>
      {proposal.state === 'open' && <>{canEdit && proposal.authorId !== user.id ? <form onSubmit={(event) => event.preventDefault()}><label className="cr-field"><span>동료에게 남길 검토 의견</span><textarea disabled={busy} rows={3} maxLength={2000} placeholder="실행해본 조건, 좋은 점, 확인할 반례를 적어주세요." value={comment} onChange={(event) => setComment(event.target.value)} /></label><div className="cr-inline-actions"><button className="cr-button" disabled={busy} onClick={async () => { if (await onReview(proposal.id, { decision: 'request_changes', comment })) setComment(''); }}>보완 의견 남기기</button><button className="cr-button primary" disabled={busy} onClick={async () => { if (await onReview(proposal.id, { decision: 'approve', comment })) setComment(''); }}>검토 후 승인</button></div></form> : <p className="cr-hint">자신의 제안은 직접 승인할 수 없습니다. 다른 팀원의 의견을 기다려주세요.</p>}{canEdit && <div className="cr-merge-area"><p>다른 팀원의 승인 후 반영할 수 있습니다. 교사는 검토 후 직접 반영할 수 있습니다.</p><button className="cr-button primary" disabled={busy || proposal.baseVersion !== data.project.version} onClick={() => onMerge(proposal.id)}>팀 버전으로 반영 →</button>{proposal.baseVersion !== data.project.version && <p className="cr-hint">팀 코드가 바뀌었습니다. 최신 버전과 비교하고 새 제안을 만들어주세요.</p>}</div>}</>}
    </> : <div className="cr-empty"><span className="cr-empty-symbol">⇄</span><h3>함께 보면 더 나은 생각이 됩니다.</h3><p>변경 제안을 선택해 코드와 실험 근거를 비교하세요.</p></div>}</section></div></>;
}

function ConflictDialog({ current, draft, onClose, onResolve }) {
  const [merged, setMerged] = useState(draft.code); const [checked, setChecked] = useState(false);
  return <div className="cr-modal-backdrop"><section className="cr-modal extra-wide" role="dialog" aria-modal="true" aria-labelledby="conflict-title"><div className="cr-section-heading"><span className="cr-section-kicker">두 버전 비교하기</span><button className="cr-icon-button" onClick={onClose} aria-label="닫기">×</button></div><h2 id="conflict-title">서로의 변경을 비교해주세요.</h2><p>팀 최신 v{current.version}과 나의 기준 v{draft.baseVersion}이 다릅니다. 내 초안을 자동으로 덮지 않았습니다.</p><DiffView beforeLabel="팀 최신 버전" afterLabel="나의 개인 초안" before={current.code} after={draft.code} /><label className="cr-field"><span>두 변경을 합칠 코드</span><textarea className="cr-merge-editor" rows={10} value={merged} onChange={(event) => setMerged(event.target.value)} /></label><label className="cr-checkbox"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />두 버전의 변경을 확인하고 필요한 내용을 합쳤습니다.</label><p className="cr-hint">교체 직전의 초안은 이 기기의 복구 기록에 남습니다.</p><div className="cr-modal-actions"><button className="cr-button" onClick={onClose}>현재 초안 유지</button><button className="cr-button" onClick={() => onResolve(current.code)}>팀 최신 코드를 초안으로</button><button className="cr-button primary" disabled={!checked} onClick={() => onResolve(merged)}>합친 코드를 초안으로 저장</button></div></section></div>;
}

function TeamPanel({ data, user, users, localMode, busy, canManage, onAction, onRestore, onShowProcess }) {
  const [memberId, setMemberId] = useState(''); const [role, setRole] = useState('editor');
  const [github, setGithub] = useState(null); const [remote, setRemote] = useState(null); const [repositoryKey, setRepositoryKey] = useState('');
  const [title, setTitle] = useState('');
  const path = `/projects/${data.project.id}`;
  useEffect(() => {
    const abort = new AbortController();
    const load = () => request(`${path}/github`, { userId: user.id, signal: abort.signal }).then(setGithub).catch(() => {});
    load();
    const timer = setInterval(load, 4000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [path, user.id]);
  const fetchGithub = async () => { const result = await onAction(() => request(`${path}/github/fetch`, { method: 'POST', userId: user.id, body: {} })); if (result) { setRemote(result.remote || result); setGithub((previous) => ({ ...previous, ...result })); } };
  return <div className="cr-workspace-two-col"><section className="cr-panel"><span className="cr-section-kicker">우리 팀</span><h2>함께 만드는 사람들</h2><div className="cr-member-list">{data.members.map((member) => <div key={member.id}><span className="cr-avatar">{member.name.slice(0, 1)}</span><span><strong>{member.name}</strong><small>{member.systemRole === 'teacher' ? '교사' : member.role === 'owner' ? '프로젝트 리더' : member.role === 'viewer' ? '관찰자' : '편집자'}</small></span></div>)}</div>{canManage && <><div className="cr-invite"><span>프로젝트 초대 코드</span><strong>{data.project.inviteCode}</strong><button className="cr-button small" onClick={() => navigator.clipboard.writeText(data.project.inviteCode).catch(() => {})}>복사</button></div><p className="cr-hint">교사도 초대 코드로 참여해야 이 프로젝트를 관찰할 수 있습니다.</p><form onSubmit={(event) => { event.preventDefault(); onAction(() => request(`${path}/members`, { method: 'POST', userId: user.id, body: { userId: memberId, role } }), '팀 권한을 저장했습니다.'); }}><label className="cr-field"><span>참여자 권한 설정</span>{localMode ? <select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">계정을 선택하세요</option>{users.filter((account) => account.id !== data.project.ownerId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select> : <input value={memberId} placeholder="사용자 식별자" onChange={(event) => setMemberId(event.target.value)} />}</label><div className="cr-inline-actions"><select aria-label="팀 역할" value={role} onChange={(event) => setRole(event.target.value)}><option value="editor">편집자</option><option value="viewer">관찰자</option></select><button className="cr-button" disabled={busy || !memberId}>권한 저장</button></div></form></>}</section>
    <section className="cr-panel"><span className="cr-section-kicker">GitHub 연결과 반영 이력</span><h2>GitHub와 팀의 이력</h2><div className="cr-banner">{github?.mode === 'simulator' ? '로컬 협업 시뮬레이터입니다. 실제 GitHub에는 전송하지 않습니다.' : github?.authMethod === 'local_cli_test' ? '실제 비공개 테스트 저장소입니다. 현재 GitHub CLI 인증으로 검증하며, GitHub App 인증 검증과 구분합니다.' : github?.mode === 'live' ? 'GitHub App을 통해 연결합니다. 개인 초안은 외부로 전송되지 않습니다.' : 'GitHub 연결 전에도 모든 제작·실험·팀 검토를 사용할 수 있습니다.'}</div>
      {github?.binding && <p><strong>{github.binding.owner}/{github.binding.repo}</strong></p>}
      {canManage && user.role === 'teacher' && github?.mode !== 'simulator' && <><label className="cr-field"><span>교사가 등록한 저장소</span>{github?.repositories?.length ? <select value={repositoryKey} onChange={(event) => setRepositoryKey(event.target.value)}><option value="">저장소 선택</option>{github.repositories.map((repository) => <option key={repository.key} value={repository.key}>{repository.owner}/{repository.repo}</option>)}</select> : <input value={repositoryKey} placeholder={github?.mode === 'simulator' ? '예: classroom/team-project' : '서버에 등록된 저장소 키'} onChange={(event) => setRepositoryKey(event.target.value)} />}</label><button className="cr-button" disabled={busy || !repositoryKey.trim()} onClick={async () => { const result = await onAction(() => request(`${path}/github`, { method: 'PUT', userId: user.id, body: { repositoryKey } }), '프로젝트 저장소 연결을 확인했습니다.'); if (result) setGithub((previous) => ({ ...previous, ...result })); }}>저장소 연결</button></>}
      <p className="cr-hint">최신 코드 비교 → 팀 확정 버전으로 PR 제출 → GitHub에서 동료 리뷰·병합 → 과정 기록과 피드백 확인 순서로 진행합니다. 병합 뒤에도 가져온 코드를 먼저 개인 초안에서 살펴봅니다.</p><button className="cr-link-button" onClick={onShowProcess}>GitHub 리뷰 기록과 피드백 보기 →</button><div className="cr-inline-actions"><button className="cr-button" disabled={busy} onClick={fetchGithub}>최신 GitHub 코드 가져와 비교</button></div>
      {remote?.available && <><p className="cr-hint">최신 기준 {remote.sha?.slice(0, 12)} · 가져오기만으로 팀 코드나 개인 초안은 바뀌지 않습니다.</p><DiffView afterLabel="GitHub 기준 버전" before={data.project.code} after={remote.code} />{data.project.myRole !== 'viewer' && <button className="cr-button small" onClick={() => onRestore(remote.code)}>이 코드를 개인 초안에서 살펴보기</button>}{data.checkpoint.code === remote.code && <p className="cr-hint">팀 확정 버전과 GitHub 코드가 같습니다. 새로 보낼 변경이 없습니다.</p>}<label className="cr-field"><span>GitHub에 보낼 팀 확정 버전의 제안 제목</span><input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="동료가 이해할 수 있는 변경 설명" /></label><button className="cr-button primary" disabled={busy || !title.trim() || data.project.myRole === 'viewer' || data.checkpoint.code === remote.code} onClick={() => onAction(() => request(`${path}/github/proposals`, { method: 'POST', userId: user.id, body: { code: data.checkpoint.code, title, baseSha: remote.sha, checkpointId: data.checkpoint.id } }), 'GitHub 변경 제안을 작업 대기열에 보존했습니다.')}>팀 확정 버전을 GitHub PR로 제안 ↗</button></>}
      {github?.simulatedPulls?.length > 0 && <div className="cr-banner success">로컬 모의 PR {github.simulatedPulls.length}개가 생성되었습니다. 실제 GitHub 전송은 없습니다.</div>}<div className="cr-job-list"><h3>반영 상태</h3>{(github?.jobs || data.jobs || []).slice(0, 8).map((job) => <article key={job.id}><GitHubJobStatus job={job} /></article>)}{!(github?.jobs || data.jobs || []).length && <p className="cr-hint">아직 외부 반영 작업이 없습니다.</p>}</div>
    </section></div>;
}
