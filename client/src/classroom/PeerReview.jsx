import { useCallback, useEffect, useRef, useState } from 'react';
import CodeEditor from '../components/editor/CodeEditor';
import RuntimePanel from './RuntimePanel';
import { request } from './api';
import { fields, PEER_REVIEW_MAX, PEER_REVIEW_MIN, validatePeerReview } from './peer-review-rules';

// 팀 간 동료 리뷰. 설계 원칙(바꾸지 않음): 배정은 교사가 하고, 학생은 "I like / I wish" 두 칸의 긍정적 피드백만 씁니다.
// 점수·별점·승인/거절 버튼은 두지 않습니다.
const dateText = (value) => value ? new Date(value).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

// 좁은 화면에서는 검토 화면이 먼저 보이도록 받은 리뷰를 접어 둡니다.
const narrowScreen = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 900px)').matches;

function ReceivedReviews({ received, isTeacher }) {
  const [open] = useState(() => !narrowScreen());
  return <details className="cr-peer-received" open={open} aria-label="우리 팀이 받은 리뷰">
    <summary><h3>받은 리뷰 <span className="cr-small-badge">{received.length}</span></h3></summary>
    <p className="cr-hint">다른 팀이 우리 팀의 저장본을 읽고 남긴 I like / I wish입니다. 작성 팀의 이름으로만 표시합니다.</p>
    {received.map((review) => <article className="cr-feedback" key={review.id}>
      <div className="cr-section-heading"><strong>{review.reviewerTeam} 팀이 남긴 리뷰{isTeacher && review.authorName ? ` · ${review.authorName}` : ''}</strong><span className="cr-small-badge">{review.hidden ? '숨김' : review.roundTitle}</span></div>
      <p><b>I like</b> {review.like}</p>
      <p><b>I wish</b> {review.wish}</p>
      <small>{dateText(review.updatedAt)}</small>
    </article>)}
    {!received.length && <p className="cr-empty small">아직 받은 리뷰가 없습니다. 다른 팀의 리뷰가 제출되면 이곳에 나타납니다.</p>}
  </details>;
}

/** 학생 작업 공간의 "동료 리뷰" 탭. 배정된 팀의 저장본을 읽기 전용으로 보고 실행해 본 뒤 두 칸을 씁니다. */
export default function PeerReviewTab({ projectId, user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [target, setTarget] = useState(null);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({ like: '', wish: '' });
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const path = `/projects/${projectId}/peer-reviews`;

  const load = useCallback(async (signal) => {
    const result = await request(path, { userId: user.id, signal });
    if (live.current) { setData(result); setError(''); }
    return result;
  }, [path, user.id]);

  useEffect(() => {
    live.current = true;
    const abort = new AbortController();
    load(abort.signal).catch((failure) => { if (live.current && failure.name !== 'AbortError') setError(failure.message); });
    return () => { live.current = false; abort.abort(); };
  }, [load]);

  // 배정 A를 열고 바로 B를 열면 응답이 역순으로 올 수 있습니다. 마지막으로 연 배정의 응답만 화면에 반영합니다.
  const openSequence = useRef(0);
  const selectedRef = useRef(null);
  const fetchTarget = async (assignmentId, { keepForm = false } = {}) => {
    const sequence = ++openSequence.current;
    try {
      const result = await request(`/peer-reviews/assignments/${assignmentId}/target`, { userId: user.id });
      if (!live.current || sequence !== openSequence.current || result.assignment?.id !== assignmentId) return;
      setTarget(result);
      if (!keepForm) setForm({ like: result.myReview?.like || '', wish: result.myReview?.wish || '' });
    } catch (failure) { if (live.current && sequence === openSequence.current) setError(failure.message); }
  };
  const open = (assignment) => {
    if (busy) return;
    selectedRef.current = assignment.id;
    setSelectedId(assignment.id); setTarget(null); setRunning(false); setFormError(''); setNotice(''); setError('');
    fetchTarget(assignment.id);
  };

  const submit = async (event) => {
    event.preventDefault();
    const problem = validatePeerReview(form);
    if (problem) { setFormError(problem); return; }
    // 제출 중 다른 배정으로 바꾸어도 결과는 제출을 시작한 배정에만 반영합니다.
    const assignmentId = selectedId, targetProjectId = target?.target?.id, wasEdit = Boolean(target?.myReview);
    setBusy(true); setFormError(''); setNotice('');
    try {
      const result = await request(`/peer-reviews/assignments/${assignmentId}/review`, { method: 'PUT', userId: user.id, body: { like: form.like.trim(), wish: form.wish.trim(), targetProjectId } });
      if (!live.current) return;
      setTarget((previous) => previous?.assignment?.id === assignmentId ? { ...previous, myReview: result.review } : previous);
      if (selectedRef.current === assignmentId) setNotice(wasEdit ? '리뷰를 고쳐서 저장했습니다.' : '리뷰를 보냈습니다. 제출 뒤에도 자기 리뷰는 고칠 수 있습니다.');
      try { await load(); } catch { /* 목록 갱신은 다음 열람 때 다시 시도합니다. */ }
    } catch (failure) {
      if (!live.current) return;
      setFormError(failure.message);
      // 교사가 검토 대상을 바꾼 경우 새 대상 팀의 저장본을 다시 열되, 적어 둔 글은 지우지 않습니다.
      if (failure.code === 'peer_review_target_changed') { try { await load(); } catch { /* 아래에서 대상만 다시 엽니다. */ } fetchTarget(assignmentId, { keepForm: true }); }
    } finally { if (live.current) setBusy(false); }
  };

  const assignment = data?.assignments.find((item) => item.id === selectedId) || null;
  const closed = assignment?.roundState === 'closed';
  const canWrite = Boolean(data?.canWrite) && !closed;
  return <div className="cr-peer-layout">
    <aside className="cr-panel">
      <span className="cr-section-kicker">팀 간 동료 리뷰</span><h2>검토할 팀</h2>
      <p className="cr-hint">선생님이 배정한 팀의 저장본을 읽고 실행해 본 뒤, 좋았던 점과 바라는 점을 남깁니다. 점수나 등급은 없습니다.</p>
      {error && <p className="cr-banner error" role="alert">{error}</p>}
      {!data && !error && <p className="cr-loading">배정을 불러오는 중입니다…</p>}
      {data?.assignments.map((item) => <button type="button" className={`cr-proposal-item ${selectedId === item.id ? 'active' : ''}`} key={item.id} disabled={busy} onClick={() => open(item)}>
        <span className={`cr-small-badge ${item.myReview ? 'mint' : ''}`}>{item.roundState === 'closed' ? '마감' : item.myReview ? '작성함' : '작성 전'}</span>
        <strong>{item.targetTitle}</strong>
        <small>{item.roundTitle} · 우리 팀 리뷰 {item.teamReviewCount}건</small>
      </button>)}
      {data && !data.assignments.length && <p className="cr-empty small">아직 배정된 팀이 없습니다. 선생님이 라운드를 열면 이곳에 나타납니다.</p>}
      {data && <ReceivedReviews received={data.received} isTeacher={user.role === 'teacher'} />}
    </aside>
    <section className="cr-panel">
      {!assignment ? <div className="cr-empty"><span className="cr-empty-symbol">👀</span><h3>다른 팀의 작품을 먼저 살펴보세요.</h3><p>왼쪽에서 검토할 팀을 고르면 코드와 문제, 성공 기준을 읽을 수 있습니다.</p></div>
        : !target ? <p className="cr-loading">대상 팀의 저장본을 여는 중입니다…</p> : <>
          <div className="cr-section-heading"><div><span className="cr-section-kicker">{assignment.roundTitle}{closed ? ' · 마감된 라운드' : ''}</span><h2>{target.target.title}</h2><p className="cr-hint">팀 저장본 v{target.target.version} · {dateText(target.target.updatedAt)} · 읽기 전용</p></div>
            <button type="button" className="cr-button" onClick={() => setRunning((value) => !value)}>{running ? '실행 화면 닫기' : '실행해 보기 ▶'}</button></div>
          <dl className="cr-evidence-view"><div><dt>해결하려는 문제</dt><dd>{target.target.problem || '아직 적지 않았습니다.'}</dd></div><div><dt>성공했다고 판단할 기준</dt><dd>{target.target.successCriteria || '아직 적지 않았습니다.'}</dd></div></dl>
          <div className={`cr-peer-lab ${running ? 'running' : ''}`}>
            <section className="cr-editor-panel"><div className="cr-editor-title"><span><i /> main.py <small>{target.target.title}의 팀 저장본</small></span><span>읽기 전용</span></div><div className="cr-editor"><CodeEditor readOnly code={target.target.code} onChange={() => {}} /></div></section>
            {running && <RuntimePanel key={`${assignment.id}:${target.target.version}`} code={target.target.code} />}
          </div>
          <form className="cr-peer-form" onSubmit={submit} aria-label="동료 리뷰 작성">
            <h3>{target.myReview ? '내가 남긴 리뷰 고치기' : '리뷰 남기기'}</h3>
            {closed && <p className="cr-banner warning">이 라운드는 마감되어 더는 쓰거나 고칠 수 없습니다. 남긴 리뷰는 그대로 보존됩니다.</p>}
            {data && !data.canWrite && !closed && <p className="cr-banner warning">{user.role === 'teacher' ? '동료 리뷰는 검토 팀의 학생이 작성합니다. 교사는 읽기만 합니다.' : '관찰자는 리뷰를 읽을 수만 있습니다.'}</p>}
            {canWrite && <p className="cr-hint cr-peer-notice">상대 팀에는 우리 팀 이름으로만 보이지만, 선생님에게는 쓴 사람의 이름이 보입니다. 팀원 각자 한 건씩 쓸 수 있고, 보내면 바로 상대 팀에 보입니다.</p>}
            {target.myReview?.hidden && <p className="cr-banner warning">선생님이 이 리뷰를 상대 팀에게 보이지 않도록 숨겼습니다. 내용을 고쳐 다시 저장하면 선생님이 확인합니다.</p>}
            <div className="cr-peer-fields">{fields.map(({ key, label, guide, example }) => {
              const id = `peer-${key}-${assignment.id}`, length = form[key].trim().length;
              return <div className="cr-field cr-peer-field" key={key}>
                <label htmlFor={id}><span>{label}</span></label>
                <p className="cr-hint">{guide}</p>
                <p className="cr-peer-example">예: “{example}”</p>
                <textarea id={id} rows={5} maxLength={PEER_REVIEW_MAX} disabled={busy || !canWrite} readOnly={!canWrite} value={form[key]} onChange={(event) => { setForm({ ...form, [key]: event.target.value }); setFormError(''); }} />
                <small className={`cr-peer-counter ${length && length < PEER_REVIEW_MIN ? 'short' : ''}`}>{length}/{PEER_REVIEW_MAX}자 · {PEER_REVIEW_MIN}자 이상</small>
              </div>;
            })}</div>
            {formError && <p className="cr-banner error" role="alert">{formError}</p>}
            {notice && <p className="cr-banner success" role="status">{notice}</p>}
            {canWrite && <div className="cr-inline-actions"><button className="cr-button primary" disabled={busy}>{busy ? '보내는 중…' : target.myReview ? '리뷰 고쳐서 저장' : '리뷰 보내기 →'}</button>{target.myReview && <small className="cr-hint">마지막 저장 {dateText(target.myReview.updatedAt)}</small>}</div>}
          </form>
        </>}
    </section>
  </div>;
}

/** 교사 관찰실의 "동료 리뷰" 구역. 라운드를 만들고 순환 배정을 바꾸고 제출 현황을 본 뒤 라운드를 닫습니다. */
export function PeerReviewAdmin({ user, projects }) {
  const [rounds, setRounds] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ title: '', reviewsPerTeam: 1, projectIds: [] });
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const live = useRef(true);

  const load = useCallback(async (signal) => {
    const result = await request('/peer-reviews/rounds', { userId: user.id, signal });
    if (live.current) { setRounds(result.rounds || []); setError(''); }
    return result;
  }, [user.id]);

  useEffect(() => {
    live.current = true;
    const abort = new AbortController();
    load(abort.signal).catch((failure) => { if (live.current && failure.name !== 'AbortError') setError(failure.message); });
    return () => { live.current = false; abort.abort(); };
  }, [load]);

  const act = async (work, success) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await work();
      if (!live.current) return null;
      if (result?.round) setRounds((previous) => { const list = previous || []; return list.some((item) => item.id === result.round.id) ? list.map((item) => item.id === result.round.id ? result.round : item) : [result.round, ...list]; });
      if (success) setNotice(success);
      return result;
    } catch (failure) { if (live.current) setError(failure.message); return null; }
    finally { if (live.current) setBusy(false); }
  };

  const create = async (event) => {
    event.preventDefault();
    if (form.projectIds.length < 2) { setError('서로 검토할 프로젝트를 두 개 이상 선택해주세요.'); return; }
    const result = await act(() => request('/peer-reviews/rounds', { method: 'POST', userId: user.id, body: { title: form.title.trim(), reviewsPerTeam: Number(form.reviewsPerTeam), projectIds: form.projectIds } }), '라운드를 열고 순환 배정을 만들었습니다. 배정 표에서 검토 팀을 바꿀 수 있습니다.');
    if (result) { setSelectedId(result.round.id); setForm({ title: '', reviewsPerTeam: 1, projectIds: [] }); }
  };

  const toggleProject = (id) => setForm((previous) => ({ ...previous, projectIds: previous.projectIds.includes(id) ? previous.projectIds.filter((value) => value !== id) : [...previous.projectIds, id] }));
  const round = rounds?.find((item) => item.id === selectedId) || rounds?.[0] || null;
  const studentTotal = round ? round.projects.reduce((total, project) => total + project.studentCount, 0) : 0;
  return <section className="cr-panel cr-peer-admin" aria-label="팀 간 동료 리뷰 관리">
    <div className="cr-section-heading"><div><span className="cr-section-kicker">팀 간 동료 리뷰</span><h2>동료 리뷰</h2></div></div>
    <p className="cr-hint">배정은 교사가 합니다. 학생은 배정된 팀의 저장본을 읽고 실행해 본 뒤 “I like / I wish” 두 칸을 씁니다. 점수·등급·승인 판정은 없습니다.</p>
    {error && <p className="cr-banner error" role="alert">{error}</p>}
    {notice && <p className="cr-banner success" role="status">{notice}</p>}
    <div className="cr-peer-admin-grid">
      <form className="cr-peer-round-form" onSubmit={create} aria-label="동료 리뷰 라운드 만들기">
        <h3>라운드 만들기</h3>
        <label className="cr-field"><span>라운드 제목</span><input required maxLength={120} disabled={busy} value={form.title} placeholder="예: 1차 동료 리뷰 · 빛과 소리" onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <div className="cr-field"><label htmlFor="peer-round-per-team"><span>팀마다 검토할 팀 수</span></label><input id="peer-round-per-team" type="number" min={1} max={10} disabled={busy} value={form.reviewsPerTeam} onChange={(event) => setForm({ ...form, reviewsPerTeam: event.target.value })} /><small className="cr-hint">i번 팀이 i+1…i+N번 팀을 검토합니다. 팀 수가 N+1보다 적으면 가능한 만큼만 배정합니다.</small></div>
        <fieldset className="cr-peer-projects"><legend>포함할 프로젝트 <span className="cr-small-badge">{form.projectIds.length}개 선택</span></legend>
          {projects.map((project) => <label className="cr-checkbox" key={project.id}><input type="checkbox" disabled={busy} checked={form.projectIds.includes(project.id)} onChange={() => toggleProject(project.id)} />{project.title}<small>· 참여자 {project.memberCount}</small></label>)}
          {!projects.length && <p className="cr-hint">참여 중인 프로젝트가 있어야 라운드를 만들 수 있습니다.</p>}
        </fieldset>
        <button className="cr-button primary" disabled={busy || !form.title.trim() || form.projectIds.length < 2}>{busy ? '만드는 중…' : '라운드 열고 배정하기 →'}</button>
      </form>
      <div className="cr-peer-rounds">
        <h3>라운드 <span className="cr-small-badge">{rounds?.length ?? 0}</span></h3>
        {!rounds && !error && <p className="cr-hint">라운드를 불러오는 중입니다…</p>}
        {rounds?.map((item) => <button type="button" className={`cr-proposal-item ${round?.id === item.id ? 'active' : ''}`} key={item.id} onClick={() => setSelectedId(item.id)}><span className={`cr-small-badge ${item.state === 'closed' ? '' : 'mint'}`}>{item.state === 'closed' ? '마감' : '진행 중'}</span><strong>{item.title}</strong><small>팀 {item.projects.length} · 팀마다 {item.reviewsPerTeam}팀 검토 · 리뷰 {item.reviews.length}건</small></button>)}
        {rounds && !rounds.length && <p className="cr-empty small">아직 연 라운드가 없습니다. 왼쪽에서 첫 라운드를 만들어보세요.</p>}
      </div>
    </div>
    {round && <div className="cr-peer-round-detail">
      <div className="cr-section-heading"><div><h3>{round.title}</h3><p className="cr-hint">{round.state === 'closed' ? `마감 ${dateText(round.closedAt)}` : `진행 중 · ${dateText(round.createdAt)}에 열림`} · 학생 {studentTotal}명</p></div>{round.state === 'open' && <button type="button" className="cr-button" disabled={busy} onClick={() => act(() => request(`/peer-reviews/rounds/${round.id}/close`, { method: 'POST', userId: user.id, body: {} }), '라운드를 닫았습니다. 학생은 더는 쓸 수 없고 받은 리뷰는 계속 볼 수 있습니다.')}>라운드 닫기</button>}</div>
      <h4>배정 표</h4>
      <p className="cr-hint">검토 팀 → 대상 팀. 드롭다운으로 대상 팀을 바꿀 수 있습니다. 리뷰가 이미 작성된 배정과 마감된 라운드는 바꿀 수 없습니다.</p>
      <div className="cr-peer-table-wrap"><table className="cr-peer-table"><thead><tr><th>검토 팀</th><th>대상 팀</th><th>작성된 리뷰</th></tr></thead><tbody>
        {round.assignments.map((assignment) => <tr key={assignment.id}><td>{assignment.reviewerTitle}</td><td>
          <select aria-label={`${assignment.reviewerTitle}의 검토 대상`} value={assignment.targetProjectId} disabled={busy || round.state !== 'open' || assignment.reviewCount > 0} onChange={(event) => act(() => request(`/peer-reviews/rounds/${round.id}/assignments/${assignment.id}`, { method: 'PATCH', userId: user.id, body: { targetProjectId: event.target.value } }), '검토 대상을 바꿨습니다.')}>
            {round.projects.filter((project) => project.id !== assignment.reviewerProjectId).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select></td><td>{assignment.reviewCount}건</td></tr>)}
      </tbody></table></div>
      <h4>제출 현황</h4>
      <div className="cr-peer-table-wrap"><table className="cr-peer-table"><thead><tr><th>팀</th><th>학생</th><th>검토할 팀</th><th>쓴 리뷰</th><th>받은 리뷰</th></tr></thead><tbody>
        {round.projects.map((project) => <tr key={project.id}><td>{project.title}</td><td>{project.studentCount}명</td><td>{project.assigned}팀</td><td>{project.written}건</td><td>{project.received}건</td></tr>)}
      </tbody></table></div>
      <h4>작성된 리뷰 <span className="cr-small-badge">{round.reviews.length}</span></h4>
      <p className="cr-hint">학생에게는 작성 팀의 이름만 보이고, 개인 이름은 교사만 봅니다. 부적절한 리뷰는 ‘숨기기’로 상대 팀에게 보이지 않게 할 수 있습니다.</p>
      {round.reviews.map((review) => { const assignment = round.assignments.find((item) => item.id === review.assignmentId); return <article className={`cr-feedback ${review.hidden ? 'hidden-review' : ''}`} key={review.id}><div className="cr-section-heading"><strong>{assignment?.reviewerTitle || '검토 팀'} → {assignment?.targetTitle || '대상 팀'}</strong><span className="cr-inline-actions"><span className="cr-small-badge">{review.authorName}</span>{review.hidden && <span className="cr-small-badge">숨김</span>}<button type="button" className="cr-button small" disabled={busy} onClick={() => act(() => request(`/peer-reviews/reviews/${review.id}/${review.hidden ? 'unhide' : 'hide'}`, { method: 'POST', userId: user.id, body: {} }), review.hidden ? '리뷰를 다시 상대 팀에게 보이게 했습니다.' : '리뷰를 숨겼습니다. 상대 팀의 받은 리뷰와 학습 근거 집계에서 빠집니다.')}>{review.hidden ? '보이기' : '숨기기'}</button></span></div><p><b>I like</b> {review.like}</p><p><b>I wish</b> {review.wish}</p><small>{dateText(review.updatedAt)}{review.hidden && ` · 숨김 ${dateText(review.hiddenAt)}`}</small></article>; })}
      {!round.reviews.length && <p className="cr-empty small">아직 작성된 리뷰가 없습니다.</p>}
    </div>}
  </section>;
}
