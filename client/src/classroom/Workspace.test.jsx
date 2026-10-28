import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Workspace from './Workspace';
import { request } from './api';
import { recoveryDrafts } from './draft-journal';
import missions from '../data/missions';
import { clearRegistry, registerObject } from '../engine/object-registry';

vi.mock('./api', () => ({ request: vi.fn(), downloadFile: vi.fn() }));
vi.mock('../components/editor/CodeEditor', () => ({
  default: ({ code, onChange, readOnly }) => <textarea aria-label="Python 코드" value={code} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} />,
}));
vi.mock('./RuntimePanel', () => ({ default: ({ code, onRunResult }) => <div aria-label="3D 실행 코드">{code}<button onClick={() => onRunResult({ code, status: 'completed', output: [] })}>테스트 실행 완료</button></div> }));

const actor = { id: 'student-a', name: '학생 가', role: 'student' };
const checkpoint = { id: 'checkpoint-0', code: '팀 시작 코드', version: 0, authorId: actor.id, message: '프로젝트 시작', evidence: {}, createdAt: '2026-10-28T00:00:00.000Z' };
let data;
let personalDrafts;
let githubJobs;
function responseFixture({ aiPolicy = 'optional', myRole = 'editor' } = {}) {
  return {
    project: { id: 'project-a', title: '충돌 조건 탐구', code: checkpoint.code, version: 0, aiPolicy, myRole, problem: '어떤 조건에서 충돌할까?', successCriteria: '다른 속도에서 비교하기', ownerId: actor.id, source: null },
    checkpoint: { ...checkpoint }, checkpoints: [{ ...checkpoint }],
    jobs: [], members: [{ ...actor, systemRole: 'student', role: myRole }], proposals: [], reviews: [], issues: [], feedback: [],
  };
}
function storage() {
  const entries = new Map();
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
}
async function openWorkspace() {
  const onRefresh = vi.fn();
  render(<Workspace user={actor} projectId="project-a" localMode users={[actor]} onRefresh={onRefresh} />);
  await screen.findByRole('textbox', { name: 'Python 코드' });
  return onRefresh;
}
const posts = () => request.mock.calls.filter(([, options]) => options?.method === 'POST');
function fillEvidence(dialog) {
  for (const [label, value] of [['예상과 가설', '속도가 크면 충돌할 것이다.'], ['실험과 관찰', '세 가지 속도에서 두 번 충돌했다.'], ['판단한 이유', '한 조건씩 바꾸어 비교했다.'], ['다음에 확인할 것', '물체 크기를 바꾸어 확인한다.']]) fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
}

describe('교실 작업 화면의 사용자 흐름', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage()); vi.stubGlobal('sessionStorage', storage()); sessionStorage.setItem('vpylab:v2:client', 'ui-test-tab');
    data = responseFixture(); personalDrafts = []; githubJobs = null; request.mockReset();
    request.mockImplementation(async (path, options) => {
      if (path === '/projects/project-a/drafts/list') return { drafts: personalDrafts };
      if (path.includes('/drafts')) return { draft: options?.method === 'PUT' ? options.body : null, checkpoint: data.checkpoint };
      if (path === '/projects/project-a/proposals') return { proposal: { id: 'proposal-1', state: 'open', ...options.body, authorId: actor.id } };
      if (path === '/projects/project-a/checkpoints') return { checkpoint: { ...checkpoint, ...options.body, id: 'checkpoint-1', version: 1 } };
      if (path === '/projects/project-a/github') return { mode: 'live', authMethod: 'local_cli_test', binding: { owner: 'classroom', repo: 'team' }, jobs: githubJobs || data.jobs };
      if (path === '/projects/project-a') return data;
      throw new Error(`예상하지 못한 요청: ${path}`);
    });
  });
  afterEach(() => { cleanup(); clearRegistry(); vi.unstubAllGlobals(); });

  it('함수 미션은 같은 장면을 직접 만드는 코드 대신 함수 사용 조건도 확인한다', async () => {
    const mission = missions.find(item => item.id === 'CT-3');
    data.project.source = { kind: 'mission', id: mission.id };
    await openWorkspace();
    for (const x of [0, -2, 2]) registerObject('sphere', { pos: [x, 0, 0], emissive: true });
    fireEvent.change(screen.getByRole('textbox', { name: 'Python 코드' }), { target: { value: 'sphere()\nsphere(pos=vector(-2,0,0))\nsphere(pos=vector(2,0,0))' } });
    fireEvent.click(screen.getByRole('button', { name: '테스트 실행 완료' }));
    fireEvent.click(screen.getByRole('button', { name: '학습 조건 확인' }));
    expect(screen.getByText('코드를 더 완성해 보세요.')).toBeInTheDocument();
    expect(screen.getByText(/스탬프\(\) 함수를 정의하세요/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Python 코드' }), { target: { value: mission.solutionCode } });
    fireEvent.click(screen.getByRole('button', { name: '테스트 실행 완료' }));
    fireEvent.click(screen.getByRole('button', { name: '학습 조건 확인' }));
    expect(screen.getByText(/100점 · 조건을 만족했습니다/)).toBeInTheDocument();
  });

  it('공개 작업 요약의 질문 참조로 이미 전송한 Issue를 구분한다', async () => {
    data.issues = [{ id: 'issue-a', title: '비교 조건', body: '같은 거리에서 비교해요.', authorId: actor.id }];
    data.jobs = [{ id: 'job-a', kind: 'issue', state: 'pending', issueId: 'issue-a' }];
    await openWorkspace();
    fireEvent.click(screen.getByRole('tab', { name: /문제와 질문/ }));
    expect(screen.getByRole('button', { name: 'GitHub Issue 작업 보존됨' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /이 질문을 GitHub Issue로 보내기/ })).toBeNull();
    expect(posts()).toHaveLength(0);
  });


  it('교실 안 검토에서 GitHub 제출 화면으로 이동해도 개인 초안을 유지하고 외부 제출은 하지 않는다', async () => {
    await openWorkspace();
    fireEvent.change(screen.getByRole('textbox', { name: 'Python 코드' }), { target: { value: '아직 공유하지 않은 나의 코드' } });
    fireEvent.click(screen.getByRole('tab', { name: /함께 검토/ }));
    expect(screen.getByText(/이곳의 제안·승인은 교실 안 팀 검토/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '팀 확정 버전을 GitHub로 보내기 →' }));
    expect(screen.getByRole('tab', { name: '팀·연결' })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('classroom/team');
    expect(posts()).toHaveLength(0);
    fireEvent.click(screen.getByRole('tab', { name: /제작과 실험/ }));
    expect(screen.getByRole('textbox', { name: 'Python 코드' })).toHaveValue('아직 공유하지 않은 나의 코드');
    expect(data.checkpoint.code).toBe('팀 시작 코드');
  });

  it('차단된 질문의 중복 전송을 막고 반영 화면에서 Issue와 PR 원문을 구분한다', async () => {
    data.issues = [{ id: 'issue-a', title: '비교 조건', body: '같은 거리에서 비교해요.', authorId: actor.id }];
    githubJobs = [
      { id: 'job-issue', kind: 'issue', state: 'blocked', issueId: 'issue-a', lastError: '전송 결과를 확인해야 합니다.', result: { url: 'https://github.com/classroom/team/issues/1' } },
      { id: 'job-pr', kind: 'proposal', state: 'succeeded', result: { url: 'https://github.com/classroom/team/pull/2' } },
      { id: 'job-invalid', kind: 'issue', state: 'succeeded', result: { url: 'javascript:alert(1)' } },
    ];
    data.jobs = githubJobs.map((job) => ({ id: job.id, kind: job.kind, state: job.state, issueId: job.issueId, lastError: job.lastError }));
    await openWorkspace();
    fireEvent.click(screen.getByRole('tab', { name: /문제와 질문/ }));
    expect(screen.getByText('확인 필요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GitHub Issue 작업 보존됨' })).toBeDisabled();
    expect(screen.getByText('다시 전송하지 말고 교사와 반영 상태를 확인해주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Issue 열기 ↗' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'GitHub 반영 상태와 원문 확인 →' }));
    await screen.findByText('classroom/team');
    expect(screen.getByRole('link', { name: 'Issue 열기 ↗' })).toHaveAttribute('href', 'https://github.com/classroom/team/issues/1');
    expect(screen.getByRole('link', { name: 'PR 열기 ↗' })).toHaveAttribute('href', 'https://github.com/classroom/team/pull/2');
    expect(screen.getAllByRole('link').some(link => link.getAttribute('href')?.startsWith('javascript:'))).toBe(false);
    expect(posts()).toHaveLength(0);
  });

  it('GitHub 코드 비교는 개인 초안을 유지하고 PR에는 확정한 팀 버전만 보낸다', async () => {
    const original = request.getMockImplementation();
    const sha = 'a'.repeat(40);
    request.mockImplementation(async (path, options) => {
      if (path === '/projects/project-a/github/fetch') return { remote: { available: true, sha, code: 'GitHub의 이전 코드' } };
      if (path === '/projects/project-a/github/proposals') return { job: { id: 'job-pr', state: 'pending' } };
      return original(path, options);
    });
    await openWorkspace();
    fireEvent.change(screen.getByRole('textbox', { name: 'Python 코드' }), { target: { value: '개인에게만 보이는 미완성 코드' } });
    fireEvent.click(screen.getByRole('tab', { name: '팀·연결' }));
    await screen.findByText('classroom/team');
    fireEvent.click(screen.getByRole('button', { name: '최신 GitHub 코드 가져와 비교' }));
    await screen.findByText(/최신 기준 aaaaaaaaaaaa/);
    fireEvent.change(screen.getByLabelText('GitHub에 보낼 팀 확정 버전의 제안 제목'), { target: { value: '확정 실험을 함께 검토해요' } });
    fireEvent.click(screen.getByRole('button', { name: '팀 확정 버전을 GitHub PR로 제안 ↗' }));
    await waitFor(() => expect(posts().some(([path]) => path.endsWith('/github/proposals'))).toBe(true));
    expect(posts().find(([path]) => path.endsWith('/github/proposals'))[1].body).toEqual({ code: checkpoint.code, title: '확정 실험을 함께 검토해요', baseSha: sha, checkpointId: checkpoint.id });
    fireEvent.click(screen.getByRole('tab', { name: /제작과 실험/ }));
    expect(screen.getByRole('textbox', { name: 'Python 코드' })).toHaveValue('개인에게만 보이는 미완성 코드');
    expect(data.checkpoint.code).toBe('팀 시작 코드');
  });

  it.each(['disabled', 'optional'])('AI 정책 %s에서도 가설·관찰·판단을 포함한 변경 제안을 제출한다', async (aiPolicy) => {
    data = responseFixture({ aiPolicy }); await openWorkspace();
    fireEvent.change(screen.getByRole('textbox', { name: 'Python 코드' }), { target: { value: 'sphere(radius=2)' } });
    fireEvent.click(screen.getByRole('button', { name: '변경 제안 ↗' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('제안 제목'), { target: { value: '크기를 바꾼 충돌 비교' } });
    fillEvidence(dialog);
    if (aiPolicy === 'disabled') expect(within(dialog).queryByLabelText('AI 제안과 나의 판단')).toBeNull();
    else {
      fireEvent.click(within(dialog).getByText(/AI를 사용했다면 기록하기/));
      fireEvent.change(within(dialog).getByLabelText('AI 제안과 나의 판단'), { target: { value: '반지름 변경 제안을 실행해 검증했다.' } });
    }
    fireEvent.click(within(dialog).getByRole('button', { name: '팀에 제안하기 →' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toMatchObject(['/projects/project-a/proposals', { method: 'POST', userId: actor.id, body: { title: '크기를 바꾼 충돌 비교', code: 'sphere(radius=2)', baseVersion: 0, evidence: { hypothesis: '속도가 크면 충돌할 것이다.', observation: '세 가지 속도에서 두 번 충돌했다.', reasoning: '한 조건씩 바꾸어 비교했다.', nextStep: '물체 크기를 바꾸어 확인한다.', aiUse: aiPolicy === 'optional' ? '반지름 변경 제안을 실행해 검증했다.' : '' } } }]);
  });

  it('팀 저장 성공 후 목록 갱신만 실패하면 재제출 없이 완료 처리하고 기준을 갱신한다', async () => {
    const onRefresh = await openWorkspace();
    fireEvent.change(screen.getByRole('textbox', { name: 'Python 코드' }), { target: { value: '검증한 팀 코드' } });
    let committed = false;
    request.mockImplementation(async (path, options) => {
      if (path.includes('/drafts')) return { draft: options?.method === 'PUT' ? options.body : null, checkpoint };
      if (path.endsWith('/checkpoints')) { committed = true; return { checkpoint: { ...checkpoint, ...options.body, id: 'checkpoint-1', version: 1 } }; }
      if (committed) throw new Error('화면 갱신 연결 실패');
      return data;
    });
    fireEvent.click(screen.getByRole('button', { name: '팀 버전으로 저장' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('어떤 변화가 있었나요?'), { target: { value: '세 조건에서 충돌을 확인했다.' } });
    fillEvidence(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: '팀 버전으로 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('alert')).toHaveTextContent('작업은 저장됐지만 화면 갱신이 지연');
    expect(screen.getByText('기준 v1 · Python')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Python 코드' })).toHaveValue('검증한 팀 코드');
    expect(posts()).toHaveLength(1);
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('관찰자는 팀 코드만 읽고 편집·제안·개인 초안 전송을 할 수 없다', async () => {
    data = responseFixture({ myRole: 'viewer' });
    await openWorkspace();
    const editor = screen.getByRole('textbox', { name: 'Python 코드' });
    expect(editor).toHaveAttribute('readonly');
    expect(editor).toHaveValue('팀 시작 코드');
    expect(screen.queryByRole('button', { name: '변경 제안 ↗' })).toBeNull();
    expect(screen.queryByRole('button', { name: '팀 버전으로 저장' })).toBeNull();
    fireEvent.change(editor, { target: { value: '관찰자 변경 시도' } });
    expect(editor).toHaveValue('팀 시작 코드');
    fireEvent.click(screen.getByRole('tab', { name: /기록과 성찰/ }));
    expect(screen.queryByRole('region', { name: '이전 편집 창의 개인 초안' })).toBeNull();
    expect(request.mock.calls.some(([path]) => path.includes('/drafts'))).toBe(false);
    expect(posts()).toHaveLength(0);
  });

  it('본인의 이전 편집 창 초안을 열면서 현재 입력을 복구 기록에 남긴다', async () => {
    data.project.version = 4; data.checkpoint.version = 4;
    personalDrafts = [{ userId: actor.id, projectId: 'project-a', clientId: 'yesterday-tab', code: '어제 작성한 코드\n관찰 기록', baseVersion: 2, clientSequence: 12, updatedAt: '2026-10-27T12:00:00.000Z' }];
    await openWorkspace();
    fireEvent.change(screen.getByRole('textbox', { name: 'Python 코드' }), { target: { value: '오늘 작성 중인 코드' } });
    fireEvent.click(screen.getByRole('tab', { name: /기록과 성찰/ }));
    const region = screen.getByRole('region', { name: '이전 편집 창의 개인 초안' });
    const open = await within(region).findByRole('button', { name: '이 초안을 열기' });
    expect(within(region).getByText('기준 v2 · 2줄')).toBeInTheDocument();
    const options = request.mock.calls.find(([path]) => path === '/projects/project-a/drafts/list')[1];
    expect(options.userId).toBe(actor.id);
    expect(options.signal.aborted).toBe(false);
    fireEvent.click(open);
    expect(await screen.findByRole('textbox', { name: 'Python 코드' })).toHaveValue('어제 작성한 코드\n관찰 기록');
    expect(screen.getByText('기준 v2 · Python')).toBeInTheDocument();
    expect(recoveryDrafts(localStorage, [actor.id, 'project-a', 'ui-test-tab']).some((entry) => entry.code === '오늘 작성 중인 코드')).toBe(true);
    expect(options.signal.aborted).toBe(true);
    expect(posts()).toHaveLength(0);
  });

  it('초안 목록 오류를 알려주고 재시도로 본인 목록을 다시 연다', async () => {
    const original = request.getMockImplementation(); let listAttempts = 0;
    personalDrafts = [{ userId: actor.id, projectId: 'project-a', clientId: 'old-tab', code: '복구할 코드', baseVersion: 0, updatedAt: '2026-10-27T12:00:00.000Z' }];
    request.mockImplementation((path, options) => {
      if (path === '/projects/project-a/drafts/list' && listAttempts++ === 0) return Promise.reject(new Error('서버 연결 실패'));
      return original(path, options);
    });
    await openWorkspace();
    fireEvent.click(screen.getByRole('tab', { name: /기록과 성찰/ }));
    const region = screen.getByRole('region', { name: '이전 편집 창의 개인 초안' });
    expect(await within(region).findByRole('alert')).toHaveTextContent('서버 연결 실패');
    fireEvent.click(within(region).getByRole('button', { name: '목록 다시 불러오기' }));
    expect(await within(region).findByRole('button', { name: '이 초안을 열기' })).toBeEnabled();
    expect(within(region).queryByRole('alert')).toBeNull();
  });

  it('다른 계정과 프로젝트의 초안을 제외하고 최신 본인 초안 20개만 표시한다', async () => {
    personalDrafts = Array.from({ length: 24 }, (_, index) => ({ userId: actor.id, projectId: 'project-a', clientId: `tab-${index}`, code: `나의 코드 ${index}`, baseVersion: index, updatedAt: `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00.000Z` }));
    personalDrafts.push({ userId: 'student-b', projectId: 'project-a', clientId: 'other-account', code: '다른 학생 코드', baseVersion: 999, updatedAt: '2026-10-28T12:00:00.000Z' });
    personalDrafts.push({ userId: actor.id, projectId: 'project-b', clientId: 'other-project', code: '다른 프로젝트 코드', baseVersion: 998, updatedAt: '2026-10-28T12:00:00.000Z' });
    await openWorkspace(); fireEvent.click(screen.getByRole('tab', { name: /기록과 성찰/ }));
    const region = screen.getByRole('region', { name: '이전 편집 창의 개인 초안' });
    await waitFor(() => expect(within(region).getAllByRole('button', { name: '이 초안을 열기' })).toHaveLength(20));
    expect(within(region).queryByText('기준 v999 · 1줄')).toBeNull();
    expect(within(region).queryByText('기준 v998 · 1줄')).toBeNull();
    expect(within(region).getByText('기준 v23 · 1줄')).toBeInTheDocument();
    expect(within(region).queryByText('기준 v0 · 1줄')).toBeNull();
  });
});
