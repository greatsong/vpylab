import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClassroomApp from './ClassroomApp';
import { request } from './api';

vi.mock('./api', () => ({ request: vi.fn(), setTokenProvider: vi.fn(), downloadFile: vi.fn() }));
vi.mock('../stores/appStore', () => ({ default: Object.assign((selector) => selector({ theme: 'creative-light' }), { getState: () => ({ setTheme: vi.fn() }) }) }));
vi.mock('../components/editor/CodeEditor', () => ({ default: ({ code, readOnly, onChange }) => <textarea aria-label="Python 코드" value={code} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} /> }));
vi.mock('./RuntimePanel', () => ({ default: ({ code }) => <div aria-label="3D 실행 코드">{code}</div> }));

const accounts = [{ id: 'student-a', name: '학생 가', role: 'student' }, { id: 'student-b', name: '학생 나', role: 'student' }];
const deferred = () => { let resolve; const promise = new Promise((accept) => { resolve = accept; }); return { promise, resolve }; };
function storage() { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; }

describe('교실 계정 전환', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage()); vi.stubGlobal('sessionStorage', storage()); sessionStorage.setItem('vpylab:v2:client', 'account-test-tab');
    window.history.replaceState(null, '', '/#/projects/project-a'); request.mockReset();
  });
  afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); vi.unstubAllGlobals(); });

  it('계정을 바꾸는 즉시 이전 학생 코드를 숨기고 늦은 목록 응답도 새 계정에 적용하지 않는다', async () => {
    const previousBootstrap = deferred(); const nextSession = deferred();
    const initialCheckpoint = { id: 'checkpoint-a', code: '팀 코드', version: 0, evidence: {} };
    const project = { id: 'project-a', title: '학생 가 비공개 프로젝트', code: '팀 코드', version: 0, aiPolicy: 'disabled', myRole: 'editor', source: null };
    request.mockImplementation(async (path, options) => {
      if (path === '/session') return { user: accounts[0], localMode: true, users: accounts };
      if (path === '/session/local') return nextSession.promise;
      if (path === '/bootstrap') return options?.userId === accounts[0].id ? previousBootstrap.promise : { projects: [{ ...project, id: 'project-b', title: '학생 나 프로젝트' }] };
      if (path === '/projects/project-a') return { project, checkpoint: initialCheckpoint, checkpoints: [initialCheckpoint], members: [{ ...accounts[0], systemRole: 'student' }], proposals: [], reviews: [], issues: [], feedback: [] };
      if (path.includes('/drafts')) return { checkpoint: initialCheckpoint, draft: { code: '학생 가의 비공개 개인 코드', baseVersion: 0, clientSequence: 3 } };
      throw new Error(`예상하지 못한 요청: ${path}`);
    });
    render(<ClassroomApp />);
    expect(await screen.findByRole('textbox', { name: 'Python 코드' })).toHaveValue('학생 가의 비공개 개인 코드');
    fireEvent.click(screen.getByRole('button', { name: '학생 나', exact: true }));
    expect(screen.queryByRole('textbox', { name: 'Python 코드' })).toBeNull();
    expect(screen.queryByText('학생 가의 비공개 개인 코드')).toBeNull();
    await act(async () => { nextSession.resolve({ user: accounts[1], localMode: true, users: accounts }); });
    expect(await screen.findByText('학생 나 프로젝트')).toBeInTheDocument();
    await act(async () => { previousBootstrap.resolve({ projects: [project] }); });
    await waitFor(() => expect(screen.queryByText('학생 가 비공개 프로젝트')).toBeNull());
    expect(screen.getByText('학생 나 프로젝트')).toBeInTheDocument();
  });

  it('현재 계정의 세션 변경 이벤트를 받으면 이전 작업을 즉시 숨기고 실제 계정으로 동기화한다', async () => {
    const nextSession = deferred();
    const checkpoint = { id: 'checkpoint-a', code: '팀 코드', version: 0, evidence: {} };
    const project = { id: 'project-a', title: '이전 학생의 프로젝트', code: checkpoint.code, version: 0, aiPolicy: 'disabled', myRole: 'editor', source: null };
    let sessionRequests = 0;
    request.mockImplementation(async (path, options) => {
      if (path === '/session') return ++sessionRequests === 1 ? { user: accounts[0], localMode: true, users: accounts } : nextSession.promise;
      if (path === '/bootstrap') return { projects: options?.userId === accounts[1].id ? [{ ...project, id: 'project-b', title: '실제 로그인 계정의 프로젝트' }] : [project] };
      if (path === '/projects/project-a') return { project, checkpoint, checkpoints: [checkpoint], members: [{ ...accounts[0], systemRole: 'student' }], proposals: [], reviews: [], issues: [], feedback: [] };
      if (path.includes('/drafts')) return { checkpoint, draft: { code: '이전 학생의 개인 작업', baseVersion: 0, clientSequence: 3 } };
      throw new Error(`예상하지 못한 요청: ${path}`);
    });
    render(<ClassroomApp />);
    expect(await screen.findByRole('textbox', { name: 'Python 코드' })).toHaveValue('이전 학생의 개인 작업');

    fireEvent(window, new CustomEvent('vpylab-classroom-session-changed', { detail: { expectedUserId: accounts[1].id } }));
    expect(screen.getByRole('textbox', { name: 'Python 코드' })).toHaveValue('이전 학생의 개인 작업');
    expect(sessionRequests).toBe(1);

    fireEvent(window, new CustomEvent('vpylab-classroom-session-changed', { detail: { expectedUserId: accounts[0].id } }));
    expect(screen.queryByRole('textbox', { name: 'Python 코드' })).toBeNull();
    expect(screen.queryByText('이전 학생의 개인 작업')).toBeNull();
    expect(screen.queryByText('이전 학생의 프로젝트')).toBeNull();
    expect(sessionRequests).toBe(2);

    await act(async () => { nextSession.resolve({ user: accounts[1], localMode: true, users: accounts }); });
    expect(await screen.findByText('실제 로그인 계정의 프로젝트')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Python 코드' })).toBeNull();
    expect(request.mock.calls.filter(([path]) => path === '/bootstrap').at(-1)[1].userId).toBe(accounts[1].id);
    expect(window.location.hash).toBe('#/');
  });

  it('프로젝트 생성 성공 뒤 목록 갱신이 실패해도 대화상자를 닫고 생성한 프로젝트로 이동한다', async () => {
    window.history.replaceState(null, '', '/#/');
    let createdProject = null;
    request.mockImplementation(async (path, options) => {
      if (path === '/session') return { user: accounts[0], localMode: true, users: accounts };
      if (path === '/bootstrap') {
        if (createdProject) throw new Error('목록 응답 지연');
        return { projects: [] };
      }
      if (path === '/projects' && options?.method === 'POST') {
        createdProject = { ...options.body, id: 'created-once', ownerId: accounts[0].id, version: 0, myRole: 'owner' };
        return { project: createdProject };
      }
      const checkpoint = createdProject && { id: 'created-checkpoint', code: createdProject.code, version: 0, evidence: {} };
      if (path === '/projects/created-once') return { project: createdProject, checkpoint, checkpoints: [checkpoint], members: [{ ...accounts[0], systemRole: 'student' }], proposals: [], reviews: [], issues: [], feedback: [] };
      if (path.includes('/drafts')) return { checkpoint, draft: null };
      throw new Error(`예상하지 못한 요청: ${path}`);
    });
    render(<ClassroomApp />);
    fireEvent.click(await screen.findByRole('button', { name: /새 프로젝트/ }));
    expect(screen.getByRole('dialog', { name: '새 프로젝트' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '프로젝트 이름' }), { target: { value: '한 번만 생성한 실험' } });
    fireEvent.click(screen.getByRole('button', { name: /프로젝트 시작하기/ }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '새 프로젝트' })).toBeNull());
    expect(await screen.findByRole('heading', { name: /한 번만 생성한 실험/ })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/projects/created-once');
    expect(screen.getByRole('alert')).toHaveTextContent('프로젝트는 만들었습니다. 목록 갱신이 지연되고 있으며 다시 만들 필요는 없습니다.');
    expect(screen.queryByRole('button', { name: /프로젝트 시작하기/ })).toBeNull();
    expect(request.mock.calls.filter(([path, options]) => path === '/projects' && options?.method === 'POST')).toHaveLength(1);
  });
});
