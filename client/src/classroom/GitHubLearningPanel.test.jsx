import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GitHubLearningPanel from './GitHubLearningPanel';
import { request } from './api';

vi.mock('./api', () => ({ request: vi.fn() }));
const teacher = { id: 'teacher', name: '선생님', role: 'teacher' };
const student = { id: 'student-a', name: '학생 가', role: 'student' };
const event = { id: 'github-evidence-a', projectId: 'project-a', kind: 'review', action: 'submitted', title: '충돌 조건을 다시 확인해요', body: '속도를 한 번 더 바꾸면 어떨까요?', githubAuthorId: 910000002, githubAuthorLogin: 'student-a-demo', authorUserId: student.id, authorName: student.name, url: 'https://github.com/classroom/team/pull/3#pullrequestreview-4', source: 'webhook', occurredAt: '2026-10-28T00:00:00Z' };
let data;
function fixture() {
  return { mode: 'simulator', sync: { state: 'complete', lastSyncedAt: '2026-10-28T00:00:00Z' }, hasMore: false, events: [event], students: [
    { userId: student.id, name: student.name, identity: { githubId: 910000002, login: 'student-a-demo', source: 'local_demo' }, prompts: ['동료 의견을 다음 실험에 어떻게 반영했나요?'], summary: { signals: [{ criterion: 'collaboration', label: '동료와 검토', observation: '리뷰 의견에서 새로운 조건을 제안했습니다.', evidenceIds: [event.id] }] }, feedback: [] },
    { userId: 'student-b', name: '학생 나', identity: null, prompts: ['어떤 조건을 비교해보고 싶나요?'], summary: { signals: [] }, feedback: [] },
  ] };
}
const posts = () => request.mock.calls.filter(([, options]) => options?.method === 'POST');
async function open(user = teacher) {
  render(<GitHubLearningPanel projectId="project-a" user={user} onRefresh={vi.fn()} />);
  await screen.findByText('협력 과정 기록');
}

describe('GitHub의 근거를 연결하는 교사·학생 과정 화면', () => {
  beforeEach(() => {
    data = fixture(); request.mockReset();
    const entries = new Map();
    vi.stubGlobal('localStorage', { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) });
    request.mockImplementation(async (path, options) => {
      if (path === '/projects/project-a/learning') return data;
      if (path === '/projects/project-a/feedback') return { feedback: { id: 'feedback-a', ...options.body } };
      if (path.startsWith('/projects/project-a/github/learning/')) return { events: data.events, sync: data.sync };
      throw new Error(`예상하지 못한 요청: ${path}`);
    });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('원문 근거를 고르고 기본 비공개 교사 개인 기록으로 저장하며 GitHub에는 게시하지 않는다', async () => {
    await open();
    expect(screen.getByLabelText('기록 공개 범위')).toHaveValue('private');
    fireEvent.click(screen.getByLabelText(`피드백 근거로 선택: ${event.title}`));
    fireEvent.change(screen.getByLabelText('관찰한 사실과 다음 피드백'), { target: { value: '반례를 스스로 제안했습니다. 다음 실험의 조건 통제를 물어봅니다.' } });
    fireEvent.click(screen.getByRole('button', { name: '교사 개인 기록 보존' }));
    await screen.findByText('작성 교사만 보는 개별 관찰 기록을 보존했습니다.');
    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toMatchObject(['/projects/project-a/feedback', { userId: teacher.id, body: { studentId: student.id, visibility: 'private', evidenceIds: [event.id], comment: '반례를 스스로 제안했습니다. 다음 실험의 조건 통제를 물어봅니다.' } }]);
    expect(screen.getByLabelText('관찰한 사실과 다음 피드백')).toHaveValue('');
  });

  it('대상 학생에게 전달할 피드백의 범위를 명시적으로 선택한다', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('기록 공개 범위'), { target: { value: 'student' } });
    fireEvent.change(screen.getByLabelText('관찰한 사실과 다음 피드백'), { target: { value: '동료의 반례를 확인한 결과도 설명해주세요.' } });
    fireEvent.click(screen.getByRole('button', { name: '선택한 범위로 피드백 전달' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0][1].body).toMatchObject({ studentId: student.id, visibility: 'student' });
  });

  it('저장 응답을 기다리는 동안 본문·공개 범위·학생·근거를 고정하여 다음 메모 유실을 막는다', async () => {
    await open();
    let resolveSave;
    request.mockImplementation((path) => path.endsWith('/feedback') ? new Promise((resolve) => { resolveSave = resolve; }) : Promise.resolve(data));
    fireEvent.change(screen.getByLabelText('관찰한 사실과 다음 피드백'), { target: { value: '지금 보존할 메모' } });
    fireEvent.click(screen.getByRole('button', { name: '교사 개인 기록 보존' }));
    await waitFor(() => expect(resolveSave).toBeTypeOf('function'));
    for (const label of ['관찰한 사실과 다음 피드백', '기록 공개 범위', '관찰할 학생', `피드백 근거로 선택: ${event.title}`]) expect(screen.getByLabelText(label)).toBeDisabled();
    resolveSave({ feedback: { id: 'slow-save', ...posts()[0][1].body } });
    await waitFor(() => expect(screen.getByLabelText('관찰한 사실과 다음 피드백')).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText('관찰한 사실과 다음 피드백'), { target: { value: '다음에 쓸 새 메모' } });
    expect(screen.getByLabelText('관찰한 사실과 다음 피드백')).toHaveValue('다음에 쓸 새 메모');
    expect(posts()).toHaveLength(1);
  });

  it('관찰 학생을 바꾸면 이전 학생의 작성 중 메모와 선택 근거를 넘기지 않는다', async () => {
    await open();
    fireEvent.click(screen.getByLabelText(`피드백 근거로 선택: ${event.title}`));
    fireEvent.change(screen.getByLabelText('관찰한 사실과 다음 피드백'), { target: { value: '학생 가에게 쓴 아직 전달하지 않은 메모' } });
    fireEvent.change(screen.getByLabelText('관찰할 학생'), { target: { value: 'student-b' } });
    expect(screen.getByLabelText('관찰한 사실과 다음 피드백')).toHaveValue('');
    expect(screen.getByLabelText(`피드백 근거로 선택: ${event.title}`)).not.toBeChecked();
    expect(screen.getByText(/GitHub 계정이 아직 연결되지 않았습니다/)).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('관찰할 학생'), { target: { value: student.id } });
    expect(screen.getByLabelText('관찰한 사실과 다음 피드백')).toHaveValue('학생 가에게 쓴 아직 전달하지 않은 메모');
    expect(posts()).toHaveLength(0);
  });

  it('학생은 본인의 다음 질문과 전달된 피드백만 보고 교사 기록 양식은 볼 수 없다', async () => {
    data.students = [data.students[0]];
    data.students[0].feedback = [{ id: 'shared-feedback', studentId: student.id, visibility: 'student', comment: '다음 실험의 변수를 설명해주세요.', evidenceIds: [event.id], createdAt: event.occurredAt }];
    await open(student);
    expect(screen.getByText('나의 과정과 다음 질문')).toBeInTheDocument();
    expect(screen.getByText('동료 의견을 다음 실험에 어떻게 반영했나요?')).toBeInTheDocument();
    expect(screen.getByText('다음 실험의 변수를 설명해주세요.')).toBeInTheDocument();
    expect(screen.queryByLabelText('관찰할 학생')).toBeNull();
    expect(screen.queryByLabelText('기록 공개 범위')).toBeNull();
    expect(screen.queryByRole('button', { name: '모의 협력 기록으로 살펴보기' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('수집이 불완전한 사실과 계정 미연결을 표시하고 외부 URL을 실행 가능한 링크로 만들지 않는다', async () => {
    data.sync = { state: 'partial', partial: true }; data.hasMore = true; data.coverageNotice = '일부 페이지만 수집되어 활동이 누락될 수 있습니다.';
    data.events = [{ ...event, id: 'unknown', title: '미연결 기록', authorUserId: null, authorName: null, githubAuthorLogin: 'unknown', url: 'javascript:alert(1)' }];
    await open();
    expect(screen.getByText(data.coverageNotice)).toBeInTheDocument();
    expect(screen.getByText(/unknown · 학생 계정 미연결/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /미연결 기록/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('기록 범위'), { target: { value: 'mine' } });
    expect(screen.queryByRole('heading', { name: '미연결 기록' })).toBeNull();
  });

  it('서버 저장 성공 후 화면 갱신이 실패해도 작성 내용을 비우고 같은 피드백을 다시 전송하지 않는다', async () => {
    await open(); let committed = false;
    request.mockImplementation(async (path, options) => {
      if (path.endsWith('/feedback')) { committed = true; return { feedback: { id: 'saved', ...options.body } }; }
      if (committed) throw new Error('응답 지연');
      return data;
    });
    fireEvent.change(screen.getByLabelText('관찰한 사실과 다음 피드백'), { target: { value: '보존한 개별 관찰' } });
    fireEvent.click(screen.getByRole('button', { name: '교사 개인 기록 보존' }));
    await screen.findByText(/작업은 저장됐지만 기록 화면을 갱신하지 못했습니다/);
    expect(screen.getByLabelText('관찰한 사실과 다음 피드백')).toHaveValue('');
    expect(posts()).toHaveLength(1);
    expect(screen.getByRole('button', { name: '교사 개인 기록 보존' })).toBeDisabled();
  });
});
