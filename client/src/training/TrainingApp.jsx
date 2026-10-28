import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import sixProgram from '@teacher-training/program.json';
import threeAi from '@teacher-training/variants/three-ai.json';
import threeNoAi from '@teacher-training/variants/three-no-ai.json';
import AiPracticeSupport from './AiPracticeSupport.jsx';
import CollaborationSteps from './CollaborationSteps.jsx';
import common from '@teacher-training/common/activities.json';
import mathematics from '@teacher-training/math/activities.json';
import science from '@teacher-training/science/activities.json';
import { loadTraining, newTraining, persistTraining } from './storage.js';
import '../index.css';
import '../classroom/classroom.css';
import '../month-projects/month-projects.css';
import './training.css';

const RuntimePanel = lazy(() => import('../classroom/RuntimePanel.jsx'));
const sources = import.meta.glob('@teacher-training/{common,math,science}/*.py', { eager: true, query: '?raw', import: 'default' });
const activities = [...common, ...mathematics, ...science];
function sourceFor(activity) {
  const entry = Object.entries(sources).find(([path]) => path.endsWith(`/${activity.codeFile}`));
  return entry?.[1] || '';
}
function download(content, name, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const programs = [{ ...sixProgram, id: 'intro-6', shortTitle: '6차시 · 입문', sessionCount: 6, planSession: 6 }, threeNoAi, threeAi];
const courseUrl = id => id === 'intro-6' ? '/training.html' : `/training.html?course=${id}`;
const tabs = [{ id: 'overview', title: '연수 안내' }, { id: 'practice', title: '실습 워크북' }, { id: 'plan', title: '나의 수업안' }, { id: 'resources', title: '강사·인쇄 자료' }];
const planFields = [['subject', '교과'], ['grade', '학교급·학년'], ['goal', '학생이 이해할 교과 개념'], ['question', '실행 전에 던질 예측 질문'], ['provided', '교사가 제공할 코드와 도움'], ['studentChange', '학생이 수정할 1~3줄'], ['control', '바꿀 조건과 유지할 조건'], ['evidence', '비교할 두 결과와 관찰 방법'], ['support', '처음 줄 발판과 거둘 시점'], ['assessment', '학생의 이해를 확인할 질문'], ['nextClass', '실제 수업에 적용할 다음 행동']];
const shortPlanFields = [
  ['goal', '대상·교과 개념·예측 질문'],
  ['studentChange', '제공 코드·학생이 수정할 1~3줄'],
  ['control', '비교 조건 A·B·고정 조건'],
  ['support', '처음 줄 발판·거둘 기준'],
  ['evidence', '소리·색 외에 확인할 수치·모형의 한계'],
  ['assessment', '짝 재현·이해 확인 기준'],
];
function LessonPlanFields({ fields, plan, onChange }) {
  return <div className="tr-record-grid">{fields.map(([key, title]) => <label className="tr-field" key={key}>{title}<textarea aria-label={title} rows={key === 'subject' || key === 'grade' ? 1 : 3} value={plan[key] || ''} onChange={event => onChange(key, event.target.value)} /></label>)}</div>;
}
const labels = { prediction: '실행 전 예상', observation: '실행 후 관찰', reasoning: '판단한 이유', peer: '짝이 남긴 검토', nextStep: '다음에 확인할 것' };
const cameras = { default: [0, 0, 15] };
function initialTraining(program) {
  try { return loadTraining(localStorage, program) || newTraining(program); }
  catch { return newTraining(program); }
}

function Practice({ activity, value, onChange, aiPolicy, session, program, previousValue }) {
  const original = sourceFor(activity);
  const code = typeof value.code === 'string' ? value.code : original;
  const [hintCount, setHintCount] = useState(0);
  const [message, setMessage] = useState('');
  const onResult = useCallback(result => onChange({ run: { status: result.status, code: result.code, output: result.output.slice(-30), durationMs: result.durationMs, at: new Date().toISOString() } }), [onChange]);
  const reset = () => { onChange({ code: original, previousCode: code }); setMessage('기본 코드로 돌아왔습니다. 복원 전 코드도 되돌릴 수 있습니다.'); };
  return <>
    <div className="tr-activity-heading"><div><span className="tr-kicker">{activity.concepts.join(' · ')}</span><h2>{activity.title}</h2><p>{activity.subtitle}</p></div><span className="tr-code-size">{original.trimEnd().split('\n').length}줄 · 수정 1~3줄</span></div>
    <div className="tr-task"><strong>이번에 바꿀 부분</strong><p>{activity.editTask}</p></div>
    <label className="tr-field tr-card">실행 전 예상<p>{activity.prediction}</p><textarea aria-label="실행 전 예상" value={value.prediction || ''} onChange={event => onChange({ prediction: event.target.value })} rows={2} placeholder="먼저 결과를 예상하고, 실행해서 비교해 보세요." /></label>
    {program.id === 'three-ai' && <AiPracticeSupport activity={activity} session={session} value={value} previousValue={previousValue} onChange={onChange} />}
    <div className="tr-practice-grid">
      <section className="tr-code-panel" aria-label="코드 읽기와 수정">
        <div className="tr-panel-heading"><h3>읽고, 한 줄 바꾸기</h3><button className="cr-button small" onClick={() => download(code, `${activity.id}.py`)}>코드 받기 ↓</button></div>
        <label className="tr-field">Python 코드<textarea aria-label="Python 코드" value={code} onChange={event => onChange({ code: event.target.value })} spellCheck="false" className="tr-editor" /></label>
        <div className="tr-inline"><button className="cr-button small" onClick={reset}>기본 코드로 돌아가기</button>{typeof value.previousCode === 'string' && <button className="cr-button small" onClick={() => { onChange({ code: value.previousCode, previousCode: code }); setMessage('복원 전 코드를 되돌렸습니다.'); }}>복원 전 코드 되돌리기</button>}</div>
        {message && <p className="tr-save" role="status">{message}</p>}
        <div className="tr-hints"><h3>막힐 때 한 단계씩</h3>{(activity.hints || []).slice(0, hintCount).map((hint, index) => <p key={index}><b>힌트 {index + 1}</b> {hint}</p>)}<button className="cr-button small" disabled={hintCount >= activity.hints.length} onClick={() => setHintCount(count => count + 1)}>{hintCount ? '다음 힌트 보기' : '첫 힌트 보기'}</button></div>
        <details className="tr-details"><summary>자주 만나는 오류</summary>{activity.commonErrors.map((error, index) => <div key={index}><strong>{error.symptom}</strong><p>{error.fix}</p></div>)}</details>
      </section>
      <div className="tr-runtime month-shell"><Suspense fallback={<div className="tr-card">실행 화면을 준비합니다…</div>}><RuntimePanel code={code} initialCameraPosition={cameras.default} preserveDirectionOnCenter onRunResult={onResult} /></Suspense></div>
    </div>
    <section className="tr-card tr-observation"><div className="tr-panel-heading"><div><span className="tr-kicker">예상 → 실행 → 비교 → 설명</span><h3>나의 작은 실험 기록</h3></div><span className="tr-note">이 기기에 저장 · 성취 점수 아님</span></div><p>{activity.prediction}</p><div className="tr-record-grid">{Object.entries(labels).filter(([key]) => key !== 'prediction').map(([key, title]) => <label key={key} className="tr-field">{title}<textarea aria-label={title} value={value[key] || ''} onChange={event => onChange({ [key]: event.target.value })} rows={3} placeholder={key === 'peer' ? activity.pairCheck : ''} /></label>)}</div><details className="tr-details"><summary>비교할 관찰 예시와 모형의 가정</summary><p>{activity.expected}</p><ul>{activity.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul><p>{activity.scaffolding}</p></details>{aiPolicy === 'optional' && program.id !== 'three-ai' && <details className="tr-details"><summary>AI를 선택해서 쓸 때의 질문</summary><p>{activity.aiOptional}</p><p>받은 설명을 그대로 채택하기 전에 같은 코드로 직접 확인하고, 받은 도움을 기록합니다.</p></details>}</section>
  </>;
}

function TrainingCourse({ program }) {
  const [tab, setTab] = useState('overview');
  const [sessionNumber, setSessionNumber] = useState(1);
  const [activityId, setActivityId] = useState('first-light');
  const [state, setState] = useState(() => initialTraining(program));
  const [storageOkay, setStorageOkay] = useState(true);
  const [classroom, setClassroom] = useState(null);
  const session = program.sessions[sessionNumber - 1];
  const activity = activities.find(item => item.id === activityId) || activities[0];
  useEffect(() => { let saved = false; try { saved = persistTraining(localStorage, state, program); } catch { /* 저장을 막은 브라우저도 실습을 계속합니다. */ } queueMicrotask(() => setStorageOkay(saved)); }, [state, program]);
  useEffect(() => { const abort = new AbortController(); fetch('/api/training-info', { signal: abort.signal }).then(response => response.ok ? response.json() : null).then(setClassroom).catch(() => {}); return () => abort.abort(); }, []);
  const recordKey = program.sessionCount === 3 ? `${sessionNumber}:${activityId}` : activityId;
  const previousRecord = state.activities[`${sessionNumber - 1}:${activityId}`];
  const activityValue = state.activities[recordKey] || (typeof previousRecord?.code === 'string' ? { code: previousRecord.code } : {});
  const updateActivity = useCallback(patch => setState(previous => ({ ...previous, activities: { ...previous.activities, [recordKey]: { ...(typeof previous.activities[`${sessionNumber - 1}:${activityId}`]?.code === 'string' ? { code: previous.activities[`${sessionNumber - 1}:${activityId}`].code } : {}), ...(previous.activities[recordKey] || {}), activityId, sessionNumber, ...patch } } })), [recordKey, activityId, sessionNumber]);
  const chooseSession = number => { const next = program.sessions[number - 1]; setSessionNumber(number); setActivityId(previous => next.activities.includes(previous) ? previous : next.activities[0] || 'first-light'); if (!next.activities.length) setTab('plan'); };
  const chooseTab = id => { if (id === 'plan') chooseSession(program.planSession); if (id === 'practice' && !session.activities.length) chooseSession(1); setTab(id); };
  const exportRecords = () => {
    const records = Object.fromEntries(Object.entries(state.activities).map(([id, value]) => {
      const item = activities.find(candidate => candidate.id === (value.activityId || id));
      return [id, { ...value, code: typeof value.code === 'string' ? value.code : item ? sourceFor(item) : '', codeFile: item?.codeFile }];
    }));
    download(JSON.stringify({ ...state, courseId: program.id, sessionCount: program.sessionCount, activities: records, exportedAt: new Date().toISOString(), title: program.title, notice: '개인의 연수 실습·성찰 기록입니다. 자동 평가 결과가 아닙니다.' }, null, 2), 'vpylab-my-training.json', 'application/json');
  };
  const short = program.sessionCount === 3;
  const corePlanFields = short ? shortPlanFields.map(([key, label]) => [key, key === 'evidence' && program.id === 'three-ai' ? '실행 수치·AI 주장 검증·도움 채택/거절 근거' : label]) : planFields;
  const extraPlanFields = short ? planFields.filter(([key]) => !shortPlanFields.some(([core]) => core === key)) : [];
  const updatePlan = (key, value) => setState(previous => ({ ...previous, plan: { ...previous.plan, [key]: value } }));
  const exportPlan = () => download(`# VPyLab으로 만드는 나의 1차시 수업\n\n연수 과정: ${program.shortTitle}\n\n${[...corePlanFields, ...extraPlanFields].map(([key, label]) => `## ${label}\n\n${state.plan[key] || '(작성할 내용)'}\n`).join('\n')}${program.id === 'three-ai' ? `\n## AI 도움과 검증의 경계\n\n${state.plan.aiBoundary || '(받은 도움과 직접 판단한 부분)'}\n` : ''}\nAI 사용 방식: ${state.aiPolicy === 'optional' ? '선택 사용' : '미사용'}\n`, 'vpylab-my-lesson-plan.md');
  return <div className="classroom-shell tr-shell">
    <header className="tr-header"><a href={courseUrl(program.id)} className="tr-brand"><img src="/brand/vpylab-mark.svg" alt="" />VPyLab <span>교사 연수</span></a><div><label className="tr-course-picker">연수 과정<select aria-label="연수 과정 선택" value={program.id} onChange={event => window.location.assign(courseUrl(event.target.value))}>{programs.map(item => <option key={item.id} value={item.id}>{item.shortTitle}</option>)}</select></label><button className="cr-button small" onClick={exportRecords}>내 연수 기록 받기 ↓</button></div></header>
    <nav className="tr-tabs" aria-label="연수 메뉴">{tabs.map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => chooseTab(item.id)}>{item.title}</button>)}</nav>
    <main className="tr-main">
      {!storageOkay && <p role="alert" className="tr-alert">이 브라우저에 기록을 저장하지 못했습니다. 창을 닫기 전에 내 연수 기록을 내려받아 주세요.</p>}
      {tab === 'overview' && <>
        <section className="tr-hero"><div><span className="tr-kicker">{program.duration}</span><h1>{program.title}</h1><p>{program.subtitle}</p><p>{program.promise}</p><button className="cr-button primary" onClick={() => { chooseSession(1); setTab('practice'); }}>1차시 시작하기 →</button></div><div className="tr-hero-art" aria-hidden="true"><span className="tr-orb one" /><span className="tr-orb two" /><span className="tr-orb three" /><div className="tr-hero-code">radius = 0.6<br /><b>0.6 → 0.9</b><small>한 줄의 변화, 하나의 질문</small></div></div></section>
        <div className="tr-intro-grid"><section className="tr-card"><span className="tr-kicker">처음 오셔도 괜찮습니다</span><h2>먼저 읽고, 작게 바꿉니다.</h2><p>짧은 준비 코드를 제공합니다. 숫자나 색을 한 번에 하나만 바꾸며, 결과를 예상하고 짝에게 이유를 설명합니다.</p><ul><li>{program.sessionCount === 3 ? '첫 코드는 8줄, 선택 실습은 15~17줄' : '첫 코드는 8줄, 모든 실습은 8~24줄'}</li><li>설치 없이 이 브라우저의 실행 화면 이용</li><li>교사 제공 코드와 참가자 수정 부분 구분</li><li>소리 없이도 색·좌표·수치로 관찰</li></ul></section><section className="tr-card"><span className="tr-kicker">연수에서 가져갈 것</span><h2>작은 실험과 나의 수업안</h2><ul>{program.outcomes.map((item, index) => <li key={index}>{item}</li>)}</ul></section></div>
        <section className="tr-card"><div className="tr-panel-heading"><h2>{program.sessionCount === 3 ? '세 차시의 흐름' : '여섯 차시의 흐름'}</h2><span className="tr-note">차시당 50분 · 휴식 별도</span></div><div className="tr-session-cards">{program.sessions.map(item => <button key={item.id} onClick={() => { chooseSession(item.id); if (item.activities.length) setTab('practice'); }}><span>{item.id}차시</span><h3>{item.title}</h3><p>{item.question}</p><small>{item.evidence}</small></button>)}</div></section>
        <section className="tr-card"><h2>시작 전 준비</h2><ul><li>노트북·키보드와 인터넷을 준비하고 브라우저 확대율을 확인합니다.</li><li>1차시에서 Python 준비가 끝난 뒤 실행을 눌러 파란 구를 확인합니다.</li><li>음악 실습은 작은 음량으로 시작합니다. 음소거해도 모든 질문에 참여할 수 있습니다.</li><li>짝 활동은 한 명이 구현하고 다른 사람이 재현·검토한 뒤 역할을 바꿉니다.</li></ul>{program.policyLocked ? <p className="tr-policy-fixed">{program.id === 'three-ai' ? 'AI 사용 과정 · 본인의 예상, 받은 도움, 직접 검증한 근거를 함께 남깁니다.' : 'AI 미사용 과정 · 준비 코드, 세 단계 힌트, 손추적과 짝 질문으로 진행합니다.'}</p> : <label className="tr-field tr-ai-policy">이번 연수의 AI 사용 방식<select aria-label="AI 사용 방식" value={state.aiPolicy} onChange={event => setState(previous => ({ ...previous, aiPolicy: event.target.value }))}><option value="disabled">AI 미사용</option><option value="optional">AI 선택 사용</option></select></label>}<p className="tr-note">두 3차시 과정은 같은 목표와 완성 기준을 사용합니다. AI 사용형은 각자의 AI 도구에서 받은 설명을 이 워크북에서 직접 검증합니다.</p></section>
      </>}
      {tab === 'practice' && <div className="tr-workspace"><aside className="tr-session-nav"><span className="tr-kicker">실습 순서</span>{program.sessions.map(item => <button key={item.id} aria-current={sessionNumber === item.id ? 'step' : undefined} onClick={() => chooseSession(item.id)}><span>{String(item.id).padStart(2, '0')}</span><b>{item.title}</b>{state.completed.includes(item.id) && <small>확인함</small>}</button>)}<p>{program.routeNote || '3차시는 공통 실습 후 교과 선택 실습 하나를 고릅니다. 중력은 선택 확장입니다.'}</p></aside><div className="tr-session-body"><section className="tr-session-intro"><span className="tr-kicker">{session.id}차시 · 50분</span><h1>{session.title}</h1><p>{session.goal}</p><details className="tr-details"><summary>이번 차시 50분 진행 보기</summary><ol className="tr-timeline">{session.timeline.map((item, index) => <li key={index}><b>{item.minutes}분</b>{item.action}</li>)}</ol></details>{session.subjectChoiceNote && <p className="tr-choice-note">{session.subjectChoiceNote}</p>}{session.supportSteps && <details className="tr-details"><summary>{session.supportTitle}</summary><ol>{session.supportSteps.map((text, index) => <li key={index}>{text}</li>)}</ol></details>}{session.collaborationSteps && <details className="tr-details"><summary>이번 차시의 협력 과정</summary><ol>{session.collaborationSteps.map((text, index) => <li key={index}>{text}</li>)}</ol></details>}<div className="tr-activity-tabs" role="group" aria-label="실습 선택">{session.activities.map(id => { const item = activities.find(candidate => candidate.id === id); return item && <button key={id} aria-pressed={activity.id === id} onClick={() => setActivityId(id)}>{item.title}{!item.core && <small>{item.id === 'science-motion' ? '교과 선택' : '선택 확장'}</small>}</button>; })}</div></section><Practice key={recordKey} previousValue={previousRecord} session={session} program={program} activity={activity} value={activityValue} onChange={updateActivity} aiPolicy={state.aiPolicy} />{sessionNumber === (program.sessionCount === 3 ? 3 : 5) && <CollaborationSteps program={program} classroom={classroom} activity={activity} value={activityValue} />}<section className="tr-card tr-checkout"><h3>이번 차시의 확인 근거</h3><p>{session.evidence}</p>{session.evidenceChecklist && <ul>{session.evidenceChecklist.map((item, index) => <li key={index}>{item}</li>)}</ul>}<label><input type="checkbox" checked={state.completed.includes(sessionNumber)} onChange={event => setState(previous => ({ ...previous, completed: event.target.checked ? [...new Set([...previous.completed, sessionNumber])] : previous.completed.filter(number => number !== sessionNumber) }))} />내가 설명하고 짝이 재현했는지 확인했습니다.</label><small>{state.completed.length}/{program.sessionCount} 차시 자기 확인 · 자동 평가 아님</small><button className="cr-button" onClick={() => sessionNumber === program.sessionCount ? chooseTab('plan') : chooseSession(sessionNumber + 1)}>{sessionNumber === program.sessionCount ? '수업안 작성으로 →' : '다음 차시 →'}</button></section></div></div>}
      {tab === 'plan' && <><div className="tr-page-heading"><span className="tr-kicker">{program.planSession}차시 · {program.sessionCount === 3 ? '짝 실습 후 수업 설계' : '50분'}</span><h1>내 교과의 한 차시로 바꾸기</h1><p>학생이 바꿀 1~3줄과 교과 질문을 먼저 정합니다. 짝에게 3분 동안 시연한 뒤 보완하세요. {program.sessionCount === 3 && '3차시에서 교실의 짝 검토를 먼저 마치고, 같은 예제로 수업안을 작성합니다.'}</p></div><section className="tr-card">{short && <p className="tr-note">12분에는 이미 실행한 예제로 아래 핵심 6칸만 짧게 채웁니다. 세부 항목은 연수 뒤에 보완합니다. 기존에 작성한 내용은 각 칸과 보완 항목에 보존됩니다.</p>}<LessonPlanFields fields={corePlanFields} plan={state.plan} onChange={updatePlan} />{short && <details className="tr-details"><summary>연수 뒤 보완할 항목·기존 세부 기록</summary><LessonPlanFields fields={extraPlanFields} plan={state.plan} onChange={updatePlan} /></details>}{program.id === 'three-ai' && <details className="tr-details"><summary>AI 도움 범위의 추가 기록</summary><LessonPlanFields fields={[['aiBoundary', 'AI에게 맡긴 일과 직접 판단한 일']]} plan={state.plan} onChange={updatePlan} /></details>}<div className="tr-inline"><button className="cr-button primary" onClick={exportPlan}>나의 수업안 받기 ↓</button><button className="cr-button" onClick={exportRecords}>코드·실험 기록 함께 받기 ↓</button><button className="cr-button" onClick={() => setState(previous => ({ ...previous, completed: [...new Set([...previous.completed, program.planSession])] }))}>시연·짝 피드백 확인하기</button></div><p className="tr-note">다음 수업 전에 학생용 부분 코드로 직접 실행하고, 공용 기기에서는 기록을 먼저 내려받아 보관하세요.</p></section></>}
      {tab === 'resources' && <><div className="tr-page-heading"><span className="tr-kicker">강사와 참가자를 위한 자료</span><h1>연수를 운영하고, 수업으로 이어가기</h1><p>단계별 대본·오류 지원·실습 코드·활동지와 교육적 검토를 묶었습니다.</p></div><div className="tr-resource-grid"><a className="tr-card" href={`/training-materials/${program.sessionCount === 3 ? program.id + '-instructor.pdf' : 'instructor-guide.pdf'}`} target="_blank" rel="noreferrer"><span>강사용 PDF</span><h2>{program.shortTitle} 운영안</h2><p>분 단위 진행, 첫 설명 문장, 흔한 오류, 발판과 과정 확인 기준</p><b>열기 ↗</b></a><a className="tr-card" href={`/training-materials/${program.sessionCount === 3 ? program.id + '-workbook.pdf' : 'participant-workbook.pdf'}`} target="_blank" rel="noreferrer"><span>참가자용 PDF</span><h2>실습 워크북·활동지</h2><p>짧은 코드, 한 줄 수정 과제, 예상·관찰·짝 검토, 수업안 빈 양식</p><b>열기 ↗</b></a><a className="tr-card" href="/training-materials/vpylab-teacher-training-kit.zip"><span>전체 자료 ZIP</span><h2>연수 자료 한 번에 받기</h2><p>모든 코드, 강사안·활동지, 교육 검토와 검증 기록</p><b>내려받기 ↓</b></a></div><section className="tr-card"><h2>초보자를 위한 운영 기준</h2><ul><li>첫 차시는 준비 코드를 제공하고 숫자·색 한 줄만 바꿉니다.</li><li>반복문은 세 번만 손으로 추적한 뒤 실행합니다.</li><li>설명과 재현이 되면 힌트를 줄이고, 선택 확장으로 넘어갑니다.</li><li>코드 양·PR 개수보다 예상·조건 통제·이유·동료 의견 반영을 확인합니다.</li><li>AI 미사용과 선택 사용에 같은 질문과 완성 기준을 적용합니다.</li></ul></section><section className="tr-card"><h2>준비된 실행 환경</h2><p>VPyLab의 실제 Python·3D·소리 실행기를 사용합니다. 실습 기록은 이 브라우저에 저장되며, 연수용 협력 교실은 별도 로컬 DB를 사용합니다.</p><a className="cr-button" href="/classroom.html" target="_blank" rel="noreferrer">연수용 협력 교실 ↗</a><p className="tr-note">학교에서 연수를 운영할 때는 강사가 참가자 계정·테스트 저장소·학교 네트워크·실행 기기를 먼저 확인합니다. 이 로컬 자료의 실행 시험은 실제 교사 대상 연수 효과 검증과 구별합니다.</p></section><section className="tr-card"><h2>참고한 교수 원칙과 문법 안내</h2><ul>{program.references.map(reference => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.title} ↗</a></li>)}</ul><p>{program.notice}</p></section></>}
    </main><footer className="tr-footer"><span>VPyLab · 교사와 함께 만드는 작은 실험</span><span>{state.completed.length}/{program.sessionCount} 차시 자기 확인</span></footer>
  </div>;
}

export default function TrainingApp() {
  const id = new URLSearchParams(window.location.search).get('course');
  const program = programs.find(item => item.id === id) || programs[0];
  return <TrainingCourse key={program.id} program={program} />;
}
