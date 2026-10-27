import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import useAppStore from '../stores/appStore';
import { request, setTokenProvider } from './api';
import CurriculumLibrary from './CurriculumLibrary';
import { curriculumCounts } from './curriculum';
import TeacherDashboard from './TeacherDashboard';

const Workspace = lazy(() => import('./Workspace.jsx'));
const DEFAULT_CODE = 'from vpython import *\n\n# 무엇을 바꾸고, 무엇을 관찰할까요?\nball = sphere(radius=0.6, color=color.cyan)\n';
const roleName = (role) => role === 'teacher' ? '교사' : '학생';
let authClient = null;

function useRoute() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const change = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return [route, (value) => { window.location.hash = value; }];
}

export default function ClassroomApp() {
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [route, navigate] = useRoute();
  const generation = useRef(0);
  const theme = useAppStore((state) => state.theme);
  const user = session?.user;

  const refresh = useCallback(async (actorId) => {
    const expected = generation.current;
    const data = await request('/bootstrap', { userId: actorId });
    if (expected === generation.current) setProjects(data.projects || []);
    return data;
  }, []);

  useEffect(() => {
    let live = true;
    const boot = async () => {
      try {
        let current = await request('/session');
        if (!current.localMode && import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
          const { createClient } = await import('@supabase/supabase-js');
          authClient ||= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { auth: { storageKey: 'vpylab-classroom-auth' } });
          setTokenProvider(async () => (await authClient.auth.getSession()).data.session?.access_token || null);
          current = await request('/session');
        }
        if (!live) return;
        setSession(current);
        if (current.user) await refresh(current.user.id);
      } catch (e) { if (live) setError(e.message || '교실 서버에 연결하지 못했습니다.'); }
    };
    boot();
    return () => { live = false; };
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => refresh(user.id).catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [user, refresh]);

  useEffect(() => {
    const changed = async (event) => {
      if (!user || event.detail?.expectedUserId !== user.id) return;
      const expected = ++generation.current;
      setSession((previous) => ({ ...previous, user: null }));
      setProjects([]); setCreate(null); window.location.hash = '/';
      setError('다른 창에서 로그인 계정이 바뀌었거나 세션이 만료되어 현재 작업 화면을 닫았습니다. 개인 초안은 이전 계정에 보존됩니다.');
      try {
        const actual = await request('/session');
        if (generation.current !== expected) return;
        setSession(actual);
        if (actual.user) await refresh(actual.user.id);
      } catch { /* 로그인 선택 화면에서 다시 연결할 수 있습니다. */ }
    };
    window.addEventListener('vpylab-classroom-session-changed', changed);
    return () => window.removeEventListener('vpylab-classroom-session-changed', changed);
  }, [user, refresh]);

  const switchUser = async (userId) => {
    generation.current += 1;
    setBusy(true); setError(''); setProjects([]); setCreate(null);
    setSession((previous) => ({ ...previous, user: null }));
    navigate('/');
    try {
      const data = await request('/session/local', { method: 'POST', body: { userId } });
      setSession((previous) => ({ ...previous, ...data }));
      await refresh(data.user.id);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    generation.current += 1;
    setBusy(true); setError('');
    setSession((previous) => ({ ...previous, user: null })); setProjects([]); setCreate(null); navigate('/');
    try { await request('/session', { method: 'DELETE' }); await authClient?.auth.signOut(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const createProject = async (input) => {
    const result = await request('/projects', { method: 'POST', userId: user.id, body: input });
    setCreate(null); navigate(`/projects/${result.project.id}`);
    try { await refresh(user.id); }
    catch { setError('프로젝트는 만들었습니다. 목록 갱신이 지연되고 있으며 다시 만들 필요는 없습니다.'); }
  };

  const join = async (event) => {
    event.preventDefault(); if (!joinCode.trim()) return;
    setBusy(true); setError('');
    try {
      const data = await request('/projects/join', { method: 'POST', userId: user.id, body: { inviteCode: joinCode.trim() } });
      await refresh(user.id); setJoinCode(''); navigate(`/projects/${data.project.id}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const startMaterial = (item) => setCreate({
    title: item.title,
    problem: item.description || item.title,
    code: item.code || DEFAULT_CODE,
    source: { kind: item.kind, id: item.id, title: item.title, ...(item.courseId ? { courseId: item.courseId } : {}) },
  });

  const projectId = route.startsWith('/projects/') ? route.split('/')[2] : null;
  return <div className="classroom-shell">
    <header className="cr-header"><a className="cr-brand" href="#/" aria-label="VPyLab 교실 홈"><span className="cr-brand-mark">V<span>Py</span></span><div>VPyLab<small>함께 생각하는 교실</small></div></a>
      <nav className="cr-main-nav" aria-label="주 메뉴"><a href="#/" className={route === '/' || projectId ? 'active' : ''}>프로젝트</a><a href="#/materials" className={route === '/materials' ? 'active' : ''}>수업 자료</a>{user?.role === 'teacher' && <a href="#/teacher" className={route === '/teacher' ? 'active' : ''}>교사 관찰실</a>}</nav>
      <div className="cr-header-actions"><span className="cr-preview-badge">새 교실 · 검토 중</span><button className="cr-icon-button" title="화면 테마 전환" aria-label="화면 테마 전환" onClick={() => useAppStore.getState().setTheme(theme === 'deep-dark' ? 'creative-light' : 'deep-dark')}>{theme === 'deep-dark' ? '☀' : '☾'}</button>
        {user && <><div className="cr-account"><span className="cr-avatar">{user.name?.slice(0, 1)}</span><span>{user.name}<small>{roleName(user.role)}</small></span></div><button className="cr-link-button" onClick={signOut} disabled={busy}>나가기</button></>}
      </div>
    </header>
    {session?.localMode && <div className="cr-local-strip"><span><i />로컬 테스트 교실 <small>운영 서비스와 분리되어 있습니다.</small></span><div>역할 바꾸기{(session.users || []).map((account) => <button key={account.id} disabled={busy || user?.id === account.id} onClick={() => switchUser(account.id)}>{account.name}</button>)}</div></div>}
    {error && <div className="cr-banner error" role="alert">{error}<button className="cr-link-button" onClick={() => setError('')}>닫기</button></div>}
    {!session && !error && <main className="cr-loading">교실을 준비하고 있습니다…</main>}
    {session && !user && <main className="cr-welcome"><div className="cr-welcome-art" aria-hidden="true"><span className="cr-orbit one" /><span className="cr-orbit two" /><span className="cr-orbit three" /><div className="cr-orbit-core">생각<br /><strong>→ 실험</strong></div><span className="cr-art-label label-one">가설</span><span className="cr-art-label label-two">관찰</span><span className="cr-art-label label-three">함께 검증</span></div>
      <div className="cr-welcome-copy"><span className="cr-eyebrow">A CLASSROOM FOR CREATIVE THINKERS</span><h1>생각을 만들고,<br />함께 검증하는 교실.</h1><p>코드로 실험하고, 서로의 관점을 나누고,<br />자신의 말로 발견을 설명합니다.</p><div className="cr-value-pills"><span>Python × 3D</span><span>팀의 변경과 리뷰</span><span>AI 사용은 선택</span></div>
        {session.localMode ? <div className="cr-signin-card"><h2>어떤 역할로 살펴볼까요?</h2><p>각 계정의 초안과 학습 기록은 분리됩니다.</p>{(session.users || []).map((account) => <button className="cr-signin-option" key={account.id} onClick={() => switchUser(account.id)} disabled={busy}><span className={`cr-avatar ${account.role}`}>{account.name.slice(0, 1)}</span><span><strong>{account.name}</strong><small>{account.role === 'teacher' ? '교사로 입장하기' : '학생으로 입장하기'}</small></span><span>→</span></button>)}</div>
          : <div className="cr-signin-card"><h2>교실에 로그인하기</h2><p>GitHub 로그인은 신원 확인에 사용합니다. 저장소 접근은 교사가 별도로 연결합니다.</p><button className="cr-button primary" disabled={!authClient} onClick={() => authClient.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${window.location.origin}/classroom.html` } })}>GitHub로 로그인</button>{!authClient && <p className="cr-hint">관리자의 로그인 연결 설정이 필요합니다.</p>}</div>}
      </div>
    </main>}
    {user && <main className={`cr-main ${projectId ? 'workspace-main' : ''}`}>
      {route === '/materials' ? <CurriculumLibrary onStart={startMaterial} /> : route === '/teacher' && user.role === 'teacher' ? <TeacherDashboard user={user} onOpen={(id, tab) => navigate(`/projects/${id}${tab === 'process' ? '/process' : ''}`)} /> : projectId ? <Suspense fallback={<div className="cr-loading">실험실을 여는 중입니다…</div>}><Workspace key={`${user.id}:${projectId}`} initialTab={route.split('/')[3] === 'process' ? 'process' : 'lab'} user={user} projectId={projectId} localMode={session.localMode} users={session.users || []} onRefresh={() => refresh(user.id)} /></Suspense> : <>
        <div className="cr-page-heading"><div><span className="cr-eyebrow">YOUR IDEAS, IN MOTION</span><h1>{user.role === 'teacher' ? '함께 자라는 프로젝트' : '오늘, 어떤 생각을 실험할까요?'}</h1><p>나의 초안은 안전하게. 팀의 변화는 함께 살펴보며.</p></div><button className="cr-button primary large" onClick={() => setCreate({})}><span>＋</span> 새 프로젝트</button></div>
        <div className="cr-home-grid"><section className="cr-project-section"><div className="cr-section-heading"><h2>우리의 작업실 <span>{projects.length}</span></h2><span>팀 확정 버전과 개인 초안을 분리합니다</span></div>
          <div className="cr-project-grid">{projects.map((project, index) => <button className="cr-project-card" key={project.id} onClick={() => navigate(`/projects/${project.id}`)}><div className="cr-project-card-top"><span className={`cr-project-symbol tone-${index % 3}`}>{['◈', '⌁', '∴'][index % 3]}</span><span className="cr-small-badge">{project.aiPolicy === 'disabled' ? 'AI 없이 탐구' : 'AI 선택 사용'}</span></div><h3>{project.title}</h3><p>{project.problem || '문제를 정의하고 첫 실험을 시작해보세요.'}</p><div className="cr-project-card-bottom"><span>{project.myRole === 'teacher' ? '교사' : project.myRole === 'owner' ? '프로젝트 리더' : project.myRole === 'viewer' ? '관찰자' : '팀원'} <b>·</b> v{project.version}</span><span>실험실 열기 ↗</span></div></button>)}</div>
          {!projects.length && <div className="cr-empty"><h3>첫 프로젝트를 시작해보세요.</h3><p>새로 만들거나 팀의 초대 코드로 참여할 수 있습니다.</p><button className="cr-button" onClick={() => setCreate({})}>프로젝트 만들기</button></div>}
        </section><aside className="cr-home-aside"><section className="cr-panel cr-join-panel"><span className="cr-section-kicker">BETTER TOGETHER</span><h2>팀에 합류하기</h2><p>팀장이 공유한 초대 코드를 입력하세요.</p><form onSubmit={join}><input aria-label="프로젝트 초대 코드" placeholder="초대 코드" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} maxLength={100} /><button className="cr-button primary" disabled={busy || !joinCode.trim()}>참여하기 →</button></form></section>
          <section className="cr-panel cr-learning-panel"><span className="cr-section-kicker">THINKING, MADE VISIBLE</span><h2>완성보다 중요한 과정</h2><ol><li><span>01</span><div><strong>무엇을 해결할까?</strong><p>문제와 성공 기준을 정합니다.</p></div></li><li><span>02</span><div><strong>왜 그렇게 생각했을까?</strong><p>예상과 실험 결과를 비교합니다.</p></div></li><li><span>03</span><div><strong>다르게 보면 어떨까?</strong><p>동료의 관점으로 검증합니다.</p></div></li></ol><p className="cr-hint">AI를 사용하지 않는 수업도 같은 흐름으로 진행합니다.</p></section></aside></div>
        <button className="cr-materials-banner" onClick={() => navigate('/materials')}><span className="cr-materials-icon">⌘</span><span><strong>배움의 재료가 필요하다면</strong><small>{curriculumCounts.courses}개 코스 · {curriculumCounts.lessons}개 차시 · {curriculumCounts.missions}개 미션 · {curriculumCounts.examples}개 예제</small></span><span>수업 자료 둘러보기 ↗</span></button>
      </>}
    </main>}
    {!projectId && <footer className="cr-footer"><span>VPyLab <b>·</b> 작은 실험이 큰 생각이 되는 곳</span><span>코드 AGPL v3 <b>·</b> 수업 자료 CC BY-NC-SA 4.0</span></footer>}
    {create && user && <ProjectDialog initial={create} onClose={() => setCreate(null)} onCreate={createProject} defaultCode={DEFAULT_CODE} />}
  </div>;
}

function ProjectDialog({ initial, onClose, onCreate, defaultCode }) {
  const [form, setForm] = useState({ title: initial.title || '', problem: initial.problem || '', successCriteria: '', code: initial.code || defaultCode, source: initial.source || null, aiPolicy: 'optional' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { await onCreate(form); } catch (e) { setError(e.message); setSaving(false); } };
  return <div className="cr-modal-backdrop"><section className="cr-modal" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title"><div className="cr-section-heading"><span className="cr-section-kicker">START WITH A QUESTION</span><button className="cr-icon-button" onClick={onClose} disabled={saving} aria-label="닫기">×</button></div><h2 id="project-dialog-title">새 프로젝트</h2><p>좋은 질문 하나에서 실험이 시작됩니다.</p><form onSubmit={submit}>
    <label className="cr-field"><span>프로젝트 이름</span><input autoFocus required maxLength={100} placeholder="예: 우리 학교의 안전한 이동 경로" value={form.title} onChange={change('title')} /></label>
    <label className="cr-field"><span>해결하고 싶은 문제</span><textarea maxLength={2000} rows={3} placeholder="누구에게 어떤 문제가 있나요? 어떤 제약이 있나요?" value={form.problem} onChange={change('problem')} /></label>
    <label className="cr-field"><span>성공했다고 판단할 기준</span><textarea maxLength={2000} rows={2} placeholder="무엇을 관찰하거나 측정하면 될까요?" value={form.successCriteria} onChange={change('successCriteria')} /></label>
    <label className="cr-field"><span>수업의 AI 사용 방식</span><select value={form.aiPolicy} onChange={change('aiPolicy')}><option value="optional">AI 사용은 선택 · 사용한 경우 판단 기록</option><option value="disabled">AI를 사용하지 않는 수업</option></select></label>
    {form.source && <div className="cr-banner">수업 자료 「{form.source.title}」의 코드로 시작합니다.</div>}{error && <div className="cr-banner error" role="alert">{error}</div>}
    <div className="cr-modal-actions"><button type="button" className="cr-button" disabled={saving} onClick={onClose}>취소</button><button className="cr-button primary" disabled={saving || !form.title.trim()}>{saving ? '만드는 중…' : '프로젝트 시작하기 →'}</button></div>
  </form></section></div>;
}
