import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PeerReviewTab, { PeerReviewAdmin } from './PeerReview';
import { validatePeerReview } from './peer-review-rules';
import { request } from './api';

vi.mock('./api', () => ({ request: vi.fn() }));
vi.mock('../components/editor/CodeEditor', () => ({ default: ({ code, readOnly }) => <textarea aria-label="대상 팀 코드" value={code} readOnly={readOnly} onChange={() => {}} /> }));
vi.mock('./RuntimePanel', () => ({ default: ({ code }) => <div aria-label="3D 실행 코드">{code}</div> }));

const teacher = { id: 'teacher', name: '선생님', role: 'teacher' };
const student = { id: 'student-a', name: '학생 가', role: 'student' };
const like = '빛이 음악에 맞춰 바뀌는 부분이 인상적이었어요. 박자마다 색이 달라져서 무대처럼 느껴졌어요.';
const wish = '카메라가 조금 더 천천히 돌면 행성의 움직임이 더 잘 보일 것 같아요.';
const projects = [{ id: 'team-a', title: '학생 가 팀', memberCount: 2 }, { id: 'team-b', title: '학생 나 팀', memberCount: 2 }, { id: 'demo', title: '예시 프로젝트', memberCount: 3 }];
const roundFixture = () => ({ id: 'round-1', title: '1차 동료 리뷰', state: 'open', reviewsPerTeam: 1, createdAt: '2026-10-30T01:00:00.000Z', closedAt: null,
  projects: [{ id: 'team-a', title: '학생 가 팀', studentCount: 1, assigned: 1, written: 0, received: 0 }, { id: 'team-b', title: '학생 나 팀', studentCount: 1, assigned: 1, written: 0, received: 0 }, { id: 'demo', title: '예시 프로젝트', studentCount: 2, assigned: 1, written: 0, received: 0 }],
  assignments: [{ id: 'as-1', reviewerProjectId: 'team-a', reviewerTitle: '학생 가 팀', targetProjectId: 'team-b', targetTitle: '학생 나 팀', reviewCount: 0 }, { id: 'as-2', reviewerProjectId: 'team-b', reviewerTitle: '학생 나 팀', targetProjectId: 'demo', targetTitle: '예시 프로젝트', reviewCount: 0 }, { id: 'as-3', reviewerProjectId: 'demo', reviewerTitle: '예시 프로젝트', targetProjectId: 'team-a', targetTitle: '학생 가 팀', reviewCount: 0 }],
  reviews: [] });
const puts = (method) => request.mock.calls.filter(([, options]) => options?.method === method);

describe('동료 리뷰 규칙', () => {
  it('두 칸 모두 20~1000자여야 하며 공백만으로는 채울 수 없다', () => {
    expect(validatePeerReview({ like: '', wish })).toContain('I like — 좋았던 점 칸을 적어주세요');
    expect(validatePeerReview({ like: '좋았어요', wish })).toContain('20자 이상');
    expect(validatePeerReview({ like, wish: ' '.repeat(30) })).toContain('I wish — 이렇게 되면 더 좋겠어요 칸을 적어주세요');
    expect(validatePeerReview({ like, wish: '가'.repeat(1001) })).toContain('1000자까지');
    expect(validatePeerReview({ like, wish })).toBe('');
  });
});

describe('교사 관찰실의 동료 리뷰 구역', () => {
  let rounds;
  beforeEach(() => {
    rounds = []; request.mockReset();
    request.mockImplementation(async (path, options) => {
      if (path === '/peer-reviews/rounds' && !options?.method) return { rounds };
      if (path === '/peer-reviews/rounds' && options.method === 'POST') {
        if (options.body.title === '실패하는 라운드') throw Object.assign(new Error('서로 검토할 프로젝트를 두 개 이상 선택해주세요.'), { code: 'peer_review_projects_required', status: 422 });
        const round = { ...roundFixture(), title: options.body.title, reviewsPerTeam: options.body.reviewsPerTeam }; rounds = [round, ...rounds]; return { round };
      }
      if (path === '/peer-reviews/rounds/round-1/assignments/as-1' && options.method === 'PATCH') { const round = roundFixture(); round.assignments[0].targetProjectId = options.body.targetProjectId; round.assignments[0].targetTitle = '예시 프로젝트'; return { round }; }
      if (path === '/peer-reviews/rounds/round-1/close' && options.method === 'POST') return { round: { ...roundFixture(), state: 'closed', closedAt: '2026-10-30T02:00:00.000Z' } };
      throw new Error(`예상하지 못한 요청: ${path}`);
    });
  });
  afterEach(() => cleanup());

  it('제목·검토 팀 수·프로젝트 선택으로 라운드를 만들고 배정 표와 제출 현황을 보여준다', async () => {
    render(<PeerReviewAdmin user={teacher} projects={projects} />);
    expect(await screen.findByText('아직 연 라운드가 없습니다. 왼쪽에서 첫 라운드를 만들어보세요.')).toBeInTheDocument();
    const form = screen.getByRole('form', { name: '동료 리뷰 라운드 만들기' });
    const submit = within(form).getByRole('button', { name: /라운드 열고 배정하기/ });
    fireEvent.change(within(form).getByLabelText('라운드 제목'), { target: { value: '1차 동료 리뷰' } });
    expect(submit).toBeDisabled();
    fireEvent.click(within(form).getByLabelText(/학생 가 팀/));
    expect(submit).toBeDisabled();
    fireEvent.click(within(form).getByLabelText(/학생 나 팀/));
    fireEvent.click(within(form).getByLabelText(/예시 프로젝트/));
    fireEvent.change(within(form).getByLabelText('팀마다 검토할 팀 수'), { target: { value: '2' } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await screen.findByRole('status');
    expect(puts('POST')).toHaveLength(1);
    expect(puts('POST')[0]).toMatchObject(['/peer-reviews/rounds', { method: 'POST', userId: teacher.id, body: { title: '1차 동료 리뷰', reviewsPerTeam: 2, projectIds: ['team-a', 'team-b', 'demo'] } }]);
    expect(screen.getByLabelText('학생 가 팀의 검토 대상')).toHaveValue('team-b');
    expect(within(screen.getByLabelText('학생 가 팀의 검토 대상')).queryByRole('option', { name: '학생 가 팀' })).toBeNull();
    const status = screen.getAllByRole('table')[1];
    expect(within(status).getByRole('row', { name: /학생 나 팀 1명 1팀 0건 0건/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /승인|거절|별점|점수/ })).toBeNull();
    expect(document.querySelector('input[type="range"], input[type="radio"]')).toBeNull();
    expect(within(form).getByLabelText('라운드 제목')).toHaveValue('');
  });

  it('서버 오류를 알리고 폼 입력을 지우지 않으며 배정 교체와 마감을 요청한다', async () => {
    rounds = [roundFixture()];
    render(<PeerReviewAdmin user={teacher} projects={projects} />);
    expect(await screen.findByLabelText('학생 가 팀의 검토 대상')).toHaveValue('team-b');
    const form = screen.getByRole('form', { name: '동료 리뷰 라운드 만들기' });
    fireEvent.change(within(form).getByLabelText('라운드 제목'), { target: { value: '실패하는 라운드' } });
    fireEvent.click(within(form).getByLabelText(/학생 가 팀/)); fireEvent.click(within(form).getByLabelText(/학생 나 팀/));
    fireEvent.click(within(form).getByRole('button', { name: /라운드 열고 배정하기/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('서로 검토할 프로젝트를 두 개 이상 선택해주세요.');
    expect(within(form).getByLabelText('라운드 제목')).toHaveValue('실패하는 라운드');
    fireEvent.change(screen.getByLabelText('학생 가 팀의 검토 대상'), { target: { value: 'demo' } });
    await waitFor(() => expect(puts('PATCH')).toHaveLength(1));
    expect(puts('PATCH')[0]).toMatchObject(['/peer-reviews/rounds/round-1/assignments/as-1', { method: 'PATCH', userId: teacher.id, body: { targetProjectId: 'demo' } }]);
    expect(await screen.findByLabelText('학생 가 팀의 검토 대상')).toHaveValue('demo');
    fireEvent.click(screen.getByRole('button', { name: '라운드 닫기' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '라운드 닫기' })).toBeNull());
    expect(puts('POST').some(([path]) => path === '/peer-reviews/rounds/round-1/close')).toBe(true);
    expect(screen.getByText('마감')).toBeInTheDocument();
  });
});

describe('교사가 부적절한 리뷰를 숨기고 다시 보이게 한다', () => {
  afterEach(() => cleanup());
  it('숨기기 버튼이 교사 전용 경로를 부르고 숨김 표시로 바뀐다', async () => {
    const round = roundFixture(); round.assignments[0].reviewCount = 1;
    round.reviews = [{ id: 'rv-1', assignmentId: 'as-1', reviewerProjectId: 'team-a', targetProjectId: 'team-b', authorId: 'student-a', authorName: '학생 가', like, wish, updatedAt: '2026-10-30T01:30:00.000Z', hidden: false, hiddenAt: null }];
    request.mockReset();
    request.mockImplementation(async (path, options) => {
      if (path === '/peer-reviews/rounds') return { rounds: [round] };
      if (path === '/peer-reviews/reviews/rv-1/hide' && options.method === 'POST') return { round: { ...round, reviews: [{ ...round.reviews[0], hidden: true, hiddenAt: '2026-10-30T02:00:00.000Z' }] } };
      throw new Error(`예상하지 못한 요청: ${path}`);
    });
    render(<PeerReviewAdmin user={teacher} projects={projects} />);
    fireEvent.click(await screen.findByRole('button', { name: '숨기기' }));
    expect(await screen.findByRole('button', { name: '보이기' })).toBeInTheDocument();
    expect(screen.getByText('숨김')).toBeInTheDocument();
    expect(request.mock.calls.some(([path, options]) => path === '/peer-reviews/reviews/rv-1/hide' && options?.method === 'POST' && options.userId === teacher.id)).toBe(true);
    expect(screen.queryByRole('button', { name: /승인|거절|별점|점수/ })).toBeNull();
  });
});

describe('학생 작업 공간의 동료 리뷰 탭', () => {
  let data; let myReview; let delayedFirst;
  beforeEach(() => {
    myReview = null; delayedFirst = null; request.mockReset();
    data = { projectId: 'team-a', canWrite: true, assignments: [{ id: 'as-1', roundId: 'round-1', roundTitle: '1차 동료 리뷰', roundState: 'open', targetProjectId: 'team-b', targetTitle: '학생 나 팀', teamReviewCount: 0, myReview: null }, { id: 'as-2', roundId: 'round-1', roundTitle: '1차 동료 리뷰', roundState: 'open', targetProjectId: 'demo', targetTitle: '예시 프로젝트', teamReviewCount: 0, myReview: null }], received: [{ id: 'rv-9', roundTitle: '1차 동료 리뷰', roundState: 'open', reviewerTeam: '예시 프로젝트', like: '공이 튀는 움직임이 자연스러워서 보기 좋았어요.', wish: '배경에 별을 더 넣으면 밤하늘 느낌이 날 것 같아요.', updatedAt: '2026-10-30T01:00:00.000Z' }] };
    request.mockImplementation(async (path, options) => {
      if (path === '/projects/team-a/peer-reviews') return { ...data, assignments: data.assignments.map((item) => item.id === 'as-1' ? { ...item, myReview } : item) };
      if (path === '/peer-reviews/assignments/as-1/target') { const result = { assignment: data.assignments[0], target: { id: 'team-b', title: '학생 나 팀', problem: '행성이 별 주위를 돕니다.', successCriteria: '카메라가 끊기지 않습니다.', code: 'planet = sphere()', version: 3, updatedAt: '2026-10-30T00:30:00.000Z' }, myReview }; return delayedFirst ? delayedFirst.promise.then(() => result) : result; }
      if (path === '/peer-reviews/assignments/as-2/target') return { assignment: data.assignments[1], target: { id: 'demo', title: '예시 프로젝트', problem: '물체의 움직임을 관찰합니다.', successCriteria: '조건을 바꿔 비교합니다.', code: 'ball = sphere(color=color.blue)', version: 0, updatedAt: '2026-10-30T00:10:00.000Z' }, myReview: null };
      if (path === '/peer-reviews/assignments/as-2/review' && options.method === 'PUT') return { review: { id: 'rv-2', ...options.body, updatedAt: '2026-10-30T02:00:00.000Z' } };
      if (path === '/peer-reviews/assignments/as-1/review' && options.method === 'PUT') {
        if (options.body.wish.includes('서버 거부')) throw Object.assign(new Error('닫힌 라운드에는 리뷰를 쓸 수 없습니다.'), { code: 'peer_review_round_closed', status: 409 });
        if (options.body.wish.includes('대상 교체')) { data.assignments[0].targetProjectId = 'demo'; data.assignments[0].targetTitle = '예시 프로젝트'; throw Object.assign(new Error('선생님이 검토 대상 팀을 바꿨습니다. 새 대상 팀의 저장본을 다시 읽고 리뷰를 보내주세요.'), { code: 'peer_review_target_changed', status: 409, targetProjectId: 'demo' }); }
        myReview = { id: 'rv-1', ...options.body, updatedAt: '2026-10-30T02:00:00.000Z' }; return { review: myReview };
      }
      throw new Error(`예상하지 못한 요청: ${path}`);
    });
  });
  afterEach(() => cleanup());

  it('배정된 팀의 코드를 읽기 전용으로 열고 실행해 본 뒤 두 칸을 채워 보낸다', async () => {
    render(<PeerReviewTab projectId="team-a" user={student} />);
    fireEvent.click(await screen.findByRole('button', { name: /학생 나 팀/ }));
    const editor = await screen.findByRole('textbox', { name: '대상 팀 코드' });
    expect(editor).toHaveAttribute('readonly'); expect(editor).toHaveValue('planet = sphere()');
    expect(screen.getByText('행성이 별 주위를 돕니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('3D 실행 코드')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '실행해 보기 ▶' }));
    expect(screen.getByLabelText('3D 실행 코드')).toHaveTextContent('planet = sphere()');
    expect(screen.getByText('예: “빛이 음악에 맞춰 바뀌는 부분이 인상적이었어요.”')).toBeInTheDocument();
    const form = screen.getByRole('form', { name: '동료 리뷰 작성' });
    fireEvent.change(within(form).getByLabelText('I like — 좋았던 점'), { target: { value: '좋았어요' } });
    fireEvent.change(within(form).getByLabelText('I wish — 이렇게 되면 더 좋겠어요'), { target: { value: wish } });
    fireEvent.click(within(form).getByRole('button', { name: '리뷰 보내기 →' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('I like — 좋았던 점 칸은 20자 이상 적어주세요.');
    expect(puts('PUT')).toHaveLength(0);
    fireEvent.change(within(form).getByLabelText('I like — 좋았던 점'), { target: { value: `  ${like}  ` } });
    expect(within(form).queryByRole('alert')).toBeNull();
    fireEvent.click(within(form).getByRole('button', { name: '리뷰 보내기 →' }));
    expect(await within(form).findByRole('status')).toHaveTextContent('리뷰를 보냈습니다.');
    expect(puts('PUT')).toHaveLength(1);
    expect(puts('PUT')[0]).toMatchObject(['/peer-reviews/assignments/as-1/review', { method: 'PUT', userId: student.id, body: { like, wish, targetProjectId: 'team-b' } }]);
    expect(within(form).getByRole('button', { name: '리뷰 고쳐서 저장' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('작성함')).toBeInTheDocument());
    const received = screen.getByRole('group', { name: '우리 팀이 받은 리뷰' });
    expect(within(received).getByText('예시 프로젝트 팀이 남긴 리뷰')).toBeInTheDocument();
    expect(within(received).getByText(/배경에 별을 더 넣으면/)).toBeInTheDocument();
    expect(within(received).queryByText(/학생 나|학생 가/)).toBeNull();
    expect(screen.getByText(/선생님에게는 쓴 사람의 이름이 보입니다/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /승인|거절|별점|점수/ })).toBeNull();
    expect(document.querySelector('input[type="range"], input[type="radio"]')).toBeNull();
  });

  it('서버가 거부하면 오류를 보여주고 입력을 유지하며, 마감된 라운드에서는 쓸 수 없다', async () => {
    render(<PeerReviewTab projectId="team-a" user={student} />);
    fireEvent.click(await screen.findByRole('button', { name: /학생 나 팀/ }));
    const form = await screen.findByRole('form', { name: '동료 리뷰 작성' });
    fireEvent.change(within(form).getByLabelText('I like — 좋았던 점'), { target: { value: like } });
    fireEvent.change(within(form).getByLabelText('I wish — 이렇게 되면 더 좋겠어요'), { target: { value: `${wish} 서버 거부` } });
    fireEvent.click(within(form).getByRole('button', { name: '리뷰 보내기 →' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('닫힌 라운드에는 리뷰를 쓸 수 없습니다.');
    expect(within(form).getByLabelText('I like — 좋았던 점')).toHaveValue(like);
    cleanup();
    data.assignments[0].roundState = 'closed'; myReview = { id: 'rv-1', like, wish, updatedAt: '2026-10-30T02:00:00.000Z' };
    render(<PeerReviewTab projectId="team-a" user={student} />);
    fireEvent.click(await screen.findByRole('button', { name: /학생 나 팀/ }));
    const closedForm = await screen.findByRole('form', { name: '동료 리뷰 작성' });
    expect(within(closedForm).getByText(/이 라운드는 마감되어/)).toBeInTheDocument();
    expect(within(closedForm).getByLabelText('I like — 좋았던 점')).toHaveValue(like);
    expect(within(closedForm).getByLabelText('I like — 좋았던 점')).toBeDisabled();
    expect(within(closedForm).queryByRole('button', { name: /리뷰/ })).toBeNull();
  });

  it('배정 A를 열고 바로 B를 열면 늦게 온 A의 응답을 버리고 B의 코드와 폼만 보여준다', async () => {
    delayedFirst = (() => { let resolve; const promise = new Promise((accept) => { resolve = accept; }); return { promise, resolve }; })();
    render(<PeerReviewTab projectId="team-a" user={student} />);
    fireEvent.click(await screen.findByRole('button', { name: /학생 나 팀/ }));
    fireEvent.click(screen.getByRole('button', { name: /예시 프로젝트/ }));
    expect(await screen.findByRole('textbox', { name: '대상 팀 코드' })).toHaveValue('ball = sphere(color=color.blue)');
    await act(async () => { delayedFirst.resolve(); });
    expect(screen.getByRole('textbox', { name: '대상 팀 코드' })).toHaveValue('ball = sphere(color=color.blue)');
    expect(screen.getByRole('heading', { name: '예시 프로젝트' })).toBeInTheDocument();
    const form = screen.getByRole('form', { name: '동료 리뷰 작성' });
    fireEvent.change(within(form).getByLabelText('I like — 좋았던 점'), { target: { value: like } });
    fireEvent.change(within(form).getByLabelText('I wish — 이렇게 되면 더 좋겠어요'), { target: { value: wish } });
    fireEvent.click(within(form).getByRole('button', { name: '리뷰 보내기 →' }));
    await within(form).findByRole('status');
    expect(puts('PUT')[0][0]).toBe('/peer-reviews/assignments/as-2/review');
    expect(puts('PUT')[0][1].body.targetProjectId).toBe('demo');
  });

  it('교사가 검토 대상을 바꿨으면 409를 알리고 입력을 지키며 새 대상의 저장본을 다시 연다', async () => {
    render(<PeerReviewTab projectId="team-a" user={student} />);
    fireEvent.click(await screen.findByRole('button', { name: /학생 나 팀/ }));
    const form = await screen.findByRole('form', { name: '동료 리뷰 작성' });
    fireEvent.change(within(form).getByLabelText('I like — 좋았던 점'), { target: { value: like } });
    fireEvent.change(within(form).getByLabelText('I wish — 이렇게 되면 더 좋겠어요'), { target: { value: `${wish} 대상 교체` } });
    fireEvent.click(within(form).getByRole('button', { name: '리뷰 보내기 →' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('선생님이 검토 대상 팀을 바꿨습니다.');
    expect(within(form).getByLabelText('I like — 좋았던 점')).toHaveValue(like);
    expect(puts('PUT')).toHaveLength(1);
    expect(request.mock.calls.filter(([path]) => path === '/peer-reviews/assignments/as-1/target')).toHaveLength(2);
  });
});
