import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from './api';

const kindLabels = { commit: '커밋', push: '브랜치 변경', pull_request: '변경 제안 · PR', review: '동료 리뷰', issue: '문제 · 이슈', issue_comment: '이슈·PR 대화', review_comment: '코드에 남긴 의견' };
const actionLabels = { opened: '열림', created: '작성', submitted: '검토 제출', edited: '수정', deleted: '삭제', closed: '닫힘', reopened: '다시 열림', synchronize: '코드 갱신', snapshot: '가져온 기록', observed: '확인', pushed: '브랜치에 반영', dismissed: '검토 철회', ready_for_review: '검토 준비', converted_to_draft: '초안으로 변경', labeled: '분류', assigned: '담당 배정' };
const reviewLabels = { approved: '승인', changes_requested: '보완 요청', commented: '검토 의견', dismissed: '철회된 검토' };
const visibilityLabels = { private: '나만 보는 교사 기록', student: '대상 학생에게 전달', team: '팀에 공유' };
const syncLabels = { never: '아직 가져오지 않음', running: '기록을 가져오는 중', complete: '최근 가져오기 완료', partial: '일부 기록만 가져옴', failed: '가져오기 확인 필요' };
const dateText = (value) => value ? new Date(value).toLocaleString('ko-KR') : '시각 확인 필요';

function sourceLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function EvidenceReference({ event, id }) {
  const href = sourceLink(event?.url);
  return <span className="cr-evidence-reference">{href ? <a href={href} target="_blank" rel="noreferrer">{event.title || kindLabels[event.kind] || 'GitHub 기록'} ↗</a> : <span>{event?.title || `기록 ${id?.slice(0, 8) || ''}`}{event?.source === 'simulator' && ' · 모의 기록'}</span>}{event?.sha && <code>{event.sha.slice(0, 8)}</code>}</span>;
}

export function FeedbackRecord({ entry, events = [], name }) {
  return <article className="cr-feedback">
    <div className="cr-section-heading"><strong>{entry.studentId ? `${name?.(entry.studentId) || '학생'}의 관찰과 피드백` : '팀의 관찰과 피드백'}</strong><span className="cr-small-badge">{visibilityLabels[entry.visibility] || (entry.studentId ? visibilityLabels.student : visibilityLabels.team)}</span></div>
    <p>{entry.comment}</p>
    {Object.entries(entry.criteria || {}).map(([key, value]) => <p key={key}><b>{{ problem: '문제 정의', experiment: '실험', reasoning: '판단', collaboration: '협업', nextStep: '다음 실험' }[key]}</b> {value}</p>)}
    {entry.evidenceIds?.length > 0 && <div className="cr-feedback-evidence"><small>관찰의 근거</small>{entry.evidenceIds.map((id) => <EvidenceReference key={id} id={id} event={events.find((event) => event.id === id) || entry.evidence?.find((event) => event.id === id)} />)}</div>}
    <small>{dateText(entry.createdAt)}</small>
  </article>;
}

/** GitHub 기록은 관찰의 근거이며 저장 횟수를 성적이나 능력으로 환산하지 않습니다. */
export default function GitHubLearningPanel({ projectId, user, onRefresh }) {
  const [response, setResponse] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [scope, setScope] = useState('team');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const live = useRef(true);
  const requestSequence = useRef(0);
  const path = `/projects/${projectId}`;
  const key = `${projectId}:${user.id}`;
  const data = response?.key === key ? response.data : null;
  const isTeacher = user.role === 'teacher';

  const load = useCallback(async (signal) => {
    const sequence = ++requestSequence.current;
    const result = await request(`${path}/learning`, { userId: user.id, signal });
    if (live.current && sequence === requestSequence.current) { setResponse({ key, data: result }); setError(''); }
    return result;
  }, [key, path, user.id]);

  useEffect(() => {
    live.current = true;
    const abort = new AbortController();
    const refresh = () => load(abort.signal).catch((failure) => { if (live.current && failure.name !== 'AbortError') setError(failure.message); });
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { live.current = false; abort.abort(); clearInterval(timer); };
  }, [load]);

  const action = async (suffix, body) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request(`${path}${suffix}`, { method: 'POST', userId: user.id, body });
      if (!live.current) return result;
      try { await load(); } catch { setError('작업은 저장됐지만 기록 화면을 갱신하지 못했습니다. 같은 작업을 다시 제출할 필요는 없습니다.'); }
      return result;
    } catch (failure) { if (live.current) setError(failure.message); return null; }
    finally { if (live.current) setBusy(false); }
  };

  const student = data?.students?.find((item) => item.userId === selectedStudent) || data?.students?.[0];
  const events = data?.events || [];
  const visibleEvents = scope === 'mine' ? events.filter((event) => event.authorUserId === user.id || event.requestedByUserId === user.id) : events;
  const toggleEvidence = (id) => setSelectedIds((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : previous.length < 20 ? [...previous, id] : previous);
  const names = (id) => data?.students?.find((item) => item.userId === id)?.name || (id === user.id ? user.name : '팀');

  return <section className="cr-learning-process" aria-label="GitHub 협력 과정과 학생 피드백">
    <div className="cr-panel cr-process-intro">
      <div className="cr-section-heading"><div><span className="cr-section-kicker">FROM COLLABORATION TO REFLECTION</span><h2>GitHub의 협력을, 다음 배움의 근거로</h2></div><span className="cr-small-badge">{data?.mode === 'simulator' ? '로컬 모의 기록' : data?.mode === 'live' ? 'GitHub 연결' : '연결 확인 중'}</span></div>
      <p>문제를 이슈로 정의하고 → PR로 해결안을 제안하고 → 동료 의견을 검토하고 → 커밋과 다음 실험으로 이어갑니다.</p>
      <p className="cr-hint">기록이 없는 활동도 있습니다. 커밋 수로 기여도나 사고력을 평가하지 않으며, AI 사용 여부와 관계없이 학생의 설명과 함께 살펴봅니다.</p>
      <div className="cr-inline-actions"><button className="cr-button" disabled={busy} onClick={async () => { const result = await action('/github/learning/sync', {}); if (result) setNotice('GitHub 기록을 가져왔습니다. 수집 범위와 빠진 기록 안내도 함께 확인해주세요.'); }}>{busy ? '처리 중…' : 'GitHub 과정 기록 가져오기'}</button>{isTeacher && data?.mode === 'simulator' && <button className="cr-button" disabled={busy} onClick={async () => { const result = await action('/github/learning/simulate', {}); if (result) setNotice('모의 협력 기록을 추가했습니다. 실제 GitHub에는 기록하지 않았습니다.'); }}>모의 협력 기록으로 살펴보기</button>}<button className="cr-link-button" disabled={busy} onClick={() => load().catch((failure) => setError(failure.message))}>화면 새로고침</button></div>
      {data && <p className="cr-hint">{syncLabels[data.sync?.state] || '수집 상태 확인 중'}{data.sync?.lastSyncedAt && ` · ${dateText(data.sync.lastSyncedAt)}`}</p>}
      {(data?.hasMore || data?.sync?.partial || data?.sync?.error || data?.coverageNotice) && <p className="cr-banner warning">{data?.coverageNotice || data?.sync?.error || '일부 기록만 표시되어 있습니다. 전체 활동을 확인한 결과로 해석하지 마세요.'}</p>}
      {notice && <p className="cr-banner success" role="status">{notice}</p>}
      {error && <p className="cr-banner error" role="alert">{error}</p>}
    </div>
    {!data ? !error && <p className="cr-loading">GitHub의 협력 근거를 불러오고 있습니다…</p> : <div className="cr-process-grid">
      <section className="cr-panel"><div className="cr-section-heading"><h2>협력 과정 기록</h2><label className="cr-process-filter"><span className="sr-only">기록 범위</span><select aria-label="기록 범위" value={scope} onChange={(event) => setScope(event.target.value)}><option value="team">팀 전체</option><option value="mine">내가 남긴 기록</option></select></label></div>
        <p className="cr-hint">GitHub 작성자와 VPyLab에서 제출한 사람을 구분합니다. 검증할 수 없는 작성자는 팀의 미연결 기록으로 남습니다.{isTeacher && ' 피드백에 연결할 근거를 최대 20개 선택하세요.'}</p>
        {!visibleEvents.length && <p className="cr-empty small">아직 확인된 기록이 없습니다. GitHub 기록을 가져오거나 모의 기록으로 흐름을 살펴보세요.</p>}
        <div className="cr-timeline cr-github-timeline">{visibleEvents.map((event) => <article key={event.id}><div className="cr-timeline-dot" /><div className="cr-event-meta"><span className="cr-small-badge">{kindLabels[event.kind] || '협력 기록'}</span>{event.source === 'simulator' && <span className="cr-small-badge">모의</span>}<small>{actionLabels[event.action] || '상태 변경'}</small>{event.kind === 'review' && reviewLabels[String(event.metadata?.state || '').toLowerCase()] && <span className="cr-small-badge">{reviewLabels[String(event.metadata.state).toLowerCase()]}</span>}</div><h3>{event.title || kindLabels[event.kind] || 'GitHub 기록'}</h3><p className="cr-hint">{event.authorName || event.githubAuthorLogin || '작성자 미연결'}{!event.authorUserId && ' · 학생 계정 미연결'} · {dateText(event.occurredAt)}</p>{event.requestedByUserId && <p className="cr-hint">VPyLab 제출자: {event.requestedByName || '참여자'} · GitHub의 실제 작성자와 별도로 기록합니다.</p>}
          {event.metadata?.path && <p className="cr-hint"><code>{event.metadata.path}{event.metadata.line && `:${event.metadata.line}`}</code></p>}
          {event.body && <details className="cr-event-body"><summary>기록 내용 읽기</summary><p>{event.body}</p></details>}
          <EvidenceReference event={event} id={event.id} />
          {isTeacher && <label className="cr-checkbox"><input type="checkbox" checked={selectedIds.includes(event.id)} disabled={busy || (!selectedIds.includes(event.id) && selectedIds.length >= 20)} onChange={() => toggleEvidence(event.id)} />피드백 근거로 선택: {event.title || kindLabels[event.kind] || 'GitHub 기록'}</label>}
        </article>)}</div>
      </section>
      <section className="cr-panel cr-student-evidence"><span className="cr-section-kicker">FEEDBACK WITH EVIDENCE</span><h2>{isTeacher ? '학생별 관찰과 개별 기록' : '나의 과정과 다음 질문'}</h2>
        {isTeacher && <label className="cr-field"><span>관찰할 학생</span><select disabled={busy} value={student?.userId || ''} onChange={(event) => { setSelectedStudent(event.target.value); setSelectedIds([]); }}><option value="" disabled>참여 학생을 선택하세요</option>{(data.students || []).map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}</select></label>}
        {student ? <><p className="cr-hint">{student.identity ? `GitHub @${student.identity.login || student.identity.githubId} · ${student.identity.source === 'local_demo' ? '로컬 테스트용 연결' : '검증된 계정 연결'}` : 'GitHub 계정이 아직 연결되지 않았습니다. 이름만으로 활동을 추측하여 귀속하지 않습니다.'}</p>
          <details className="cr-learning-detail"><summary>영역별 GitHub 근거 살펴보기</summary><div className="cr-evidence-signals">{student.summary?.signals?.map((signal) => <div key={signal.criterion || signal.label}><strong>{signal.label}</strong><p>{signal.observation}</p>{signal.evidenceIds?.map((id) => <EvidenceReference key={id} id={id} event={events.find((event) => event.id === id)} />)}</div>)}</div></details>
          <details className="cr-learning-detail" open={!isTeacher}><summary>다음에 함께 생각할 질문</summary><ul className="cr-next-questions">{(student.prompts || []).map((prompt) => <li key={prompt}>{prompt}</li>)}</ul><p className="cr-hint">기록을 바탕으로 제안한 질문입니다. 능력 판정이나 자동 성적이 아닙니다.</p></details>
          {isTeacher && <TeacherEvidenceForm key={student.userId} draftScope={[user.id, projectId, student.userId]} student={student} selectedIds={selectedIds} events={events} busy={busy} onSave={async (body) => { const result = await action('/feedback', body); if (result) { setSelectedIds([]); setNotice(body.visibility === 'private' ? '작성 교사만 보는 개별 관찰 기록을 보존했습니다.' : '근거를 연결한 피드백을 보존했습니다.'); Promise.resolve(onRefresh?.()).catch(() => {}); } return result; }} />}
          <h3>관찰 기록과 전달된 피드백</h3>{!student.feedback?.length && <p className="cr-hint">아직 이 학생의 기록이 없습니다.</p>}{student.feedback?.map((entry) => <FeedbackRecord key={entry.id} entry={entry} events={events} name={names} />)}
        </> : <p className="cr-empty small">참여 학생이 있으면 학생별 관찰 근거와 피드백을 볼 수 있습니다.</p>}
      </section>
    </div>}
  </section>;
}

function TeacherEvidenceForm({ student, draftScope, selectedIds, events, busy, onSave }) {
  const scope = JSON.stringify(draftScope);
  const storageKey = `vpylab:v2:teacher-note:${scope}`;
  const [initial] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved?.scope === scope && typeof saved.comment === 'string' && saved.comment.length <= 2000 && visibilityLabels[saved.visibility]) return saved; }
    catch { /* 기기 저장소를 사용할 수 없어도 서버 기록은 가능합니다. */ }
    return { comment: '', visibility: 'private' };
  });
  const [comment, setComment] = useState(initial.comment);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [draftError, setDraftError] = useState('');
  const preserve = (nextComment, nextVisibility) => {
    try { localStorage.setItem(storageKey, JSON.stringify({ scope, comment: nextComment, visibility: nextVisibility })); setDraftError(''); }
    catch { setDraftError('작성 중 메모를 이 기기에 보존하지 못했습니다. 화면을 떠나기 전에 서버에 기록을 저장해주세요.'); }
  };
  return <form className="cr-teacher-evidence-form" onSubmit={async (event) => {
    event.preventDefault();
    if (await onSave({ studentId: visibility === 'team' ? undefined : student.userId, comment, visibility, evidenceIds: selectedIds })) { setComment(''); try { localStorage.removeItem(storageKey); } catch { /* 서버의 확정 기록은 보존되어 있습니다. */ } }
  }}><h3>근거를 연결해 기록하기</h3><p className="cr-hint">교사 개인 관찰은 기본 비공개입니다. 전달 범위를 직접 선택하며, 이 내용은 GitHub에 게시되지 않습니다.</p>
    <label className="cr-field"><span>기록 공개 범위</span><select disabled={busy} value={visibility} onChange={(event) => { setVisibility(event.target.value); preserve(comment, event.target.value); }}>{Object.entries(visibilityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <div className="cr-selected-evidence"><strong>선택한 GitHub 근거 {selectedIds.length}개</strong>{selectedIds.map((id) => <EvidenceReference key={id} id={id} event={events.find((event) => event.id === id)} />)}{!selectedIds.length && <p className="cr-hint">왼쪽에서 근거를 선택하거나, 수업 중 직접 관찰한 내용만 기록할 수 있습니다.</p>}</div>
    <label className="cr-field"><span>관찰한 사실과 다음 피드백</span><textarea required disabled={busy} rows={5} maxLength={2000} value={comment} onChange={(event) => { setComment(event.target.value); preserve(event.target.value, visibility); }} placeholder="어떤 이슈·리뷰·수정에서 무엇을 관찰했나요? 학생에게 어떤 질문을 이어갈까요?" /></label>
    <p className="cr-hint">작성 중 메모는 이 기기에 교사·프로젝트·학생별로 임시 보존됩니다. 아래 버튼으로 저장하기 전에는 전달되지 않습니다. 근거 선택은 다시 확인해주세요.</p>
    {draftError && <p className="cr-banner warning" role="alert">{draftError}</p>}
    <button className="cr-button primary" disabled={busy || !comment.trim()}>{busy ? '보존하는 중…' : visibility === 'private' ? '교사 개인 기록 보존' : '선택한 범위로 피드백 전달'}</button>
  </form>;
}
