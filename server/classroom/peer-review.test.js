import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, DEMO_USERS } from './store.js';
import { createClassroomApp } from './app.js';
import { planRoundRobin, normalizePeerReviewText } from './peer-review.js';
import { summarizeLearningEvidence } from './learning-feedback.js';

const [teacher, studentA, studentB] = DEMO_USERS;
const like = '빛이 음악에 맞춰 바뀌는 부분이 인상적이었어요. 박자마다 색이 달라져서 무대처럼 느껴졌어요.';
const wish = '카메라가 조금 더 천천히 돌면 행성의 움직임이 더 잘 보일 것 같아요.';

/** 로컬 모드 저장소. 예시 프로젝트 1개와 동료 리뷰 시험용 팀 2개(학생 가 팀, 학생 나 팀)가 시드됩니다. */
function fixture() {
  const store = createStore({ localMode: true });
  const demo = store.listProjects(teacher)[0];
  const teamA = store.listProjects(studentA).find((project) => project.ownerId === studentA.id);
  const teamB = store.listProjects(studentB).find((project) => project.ownerId === studentB.id);
  return { store, demo, teamA, teamB };
}

async function httpFixture(t) {
  const runtime = createClassroomApp({ localMode: true });
  const server = runtime.app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await runtime.githubService.stopWorker(); await new Promise((resolve) => server.close(resolve)); runtime.store.close(); });
  const apiFor = (userId) => {
    const cookie = 'vpylab_v2_session=' + runtime.store.createSession(userId);
    return async (path, { method = 'GET', body, headers = {} } = {}) => {
      const response = await fetch(origin + '/api/v2' + path, { method, headers: { origin, cookie, 'X-Classroom-User': userId, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
  };
  const demo = runtime.store.listProjects(teacher)[0];
  const teamA = runtime.store.listProjects(studentA).find((project) => project.ownerId === studentA.id);
  const teamB = runtime.store.listProjects(studentB).find((project) => project.ownerId === studentB.id);
  return { ...runtime, apiFor, demo, teamA, teamB };
}

test('순환 배정은 자기 팀을 피하고 팀 수가 N+1보다 적으면 가능한 만큼만 배정한다', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const pairs = planRoundRobin(ids, 2);
  assert.equal(pairs.length, 8);
  assert.ok(pairs.every((pair) => pair.reviewerProjectId !== pair.targetProjectId));
  assert.deepEqual(pairs.filter((pair) => pair.reviewerProjectId === 'a').map((pair) => pair.targetProjectId), ['b', 'c']);
  assert.deepEqual(pairs.filter((pair) => pair.reviewerProjectId === 'd').map((pair) => pair.targetProjectId), ['a', 'b']);
  for (const id of ids) assert.equal(pairs.filter((pair) => pair.targetProjectId === id).length, 2, `${id} 팀이 받는 수`);
  const few = planRoundRobin(['a', 'b'], 5);
  assert.deepEqual(few, [{ reviewerProjectId: 'a', targetProjectId: 'b' }, { reviewerProjectId: 'b', targetProjectId: 'a' }]);
  assert.deepEqual(planRoundRobin(['only'], 1), []);
  assert.equal(planRoundRobin(['a', 'a', 'b'], 1).length, 2);
});

test('like·wish 본문은 20~1000자 사이여야 하고 앞뒤 공백은 세지 않는다', () => {
  assert.equal(normalizePeerReviewText(undefined, 'I like').error, 'peer_review_text_required');
  assert.equal(normalizePeerReviewText('   ', 'I like').error, 'peer_review_text_required');
  assert.equal(normalizePeerReviewText('좋았어요', 'I like').error, 'peer_review_text_too_short');
  assert.equal(normalizePeerReviewText(' ' + '가'.repeat(19) + ' ', 'I like').error, 'peer_review_text_too_short');
  assert.equal(normalizePeerReviewText('가'.repeat(1001), 'I wish').error, 'peer_review_text_too_long');
  assert.equal(normalizePeerReviewText('  ' + like + '  ', 'I like').text, like);
});

test('교사는 라운드를 만들면 순환 배정이 자동으로 생기고 배정을 바꾸거나 라운드를 닫을 수 있다', () => {
  const { store, demo, teamA, teamB } = fixture();
  try {
    assert.throws(() => store.createPeerReviewRound(studentA, { title: '학생 시도', reviewsPerTeam: 1, projectIds: [teamA.id, teamB.id] }), (error) => error.code === 'teacher_required');
    assert.throws(() => store.createPeerReviewRound(teacher, { title: '하나뿐', reviewsPerTeam: 1, projectIds: [teamA.id] }), (error) => error.code === 'peer_review_projects_required');
    assert.throws(() => store.createPeerReviewRound(teacher, { title: '범위 밖', reviewsPerTeam: 0, projectIds: [teamA.id, teamB.id] }), (error) => error.code === 'invalid_reviews_per_team');
    const stranger = store.createProject(store.ensureUser({ id: 'other-class', name: '다른 학급 학생', role: 'student' }), { title: '다른 학급 프로젝트', code: '' });
    assert.throws(() => store.createPeerReviewRound(teacher, { title: '참여하지 않은 팀', reviewsPerTeam: 1, projectIds: [teamA.id, stranger.id] }), (error) => error.code === 'access_denied');

    const round = store.createPeerReviewRound(teacher, { title: '1차 동료 리뷰', reviewsPerTeam: 1, projectIds: [demo.id, teamA.id, teamB.id] });
    assert.equal(round.state, 'open');
    assert.equal(round.assignments.length, 3);
    assert.ok(round.assignments.every((item) => item.reviewerProjectId !== item.targetProjectId));
    assert.deepEqual(round.projects.map((project) => [project.assigned, project.written, project.received]), [[1, 0, 0], [1, 0, 0], [1, 0, 0]]);
    const aReviewsB = round.assignments.find((item) => item.reviewerProjectId === teamA.id);
    assert.equal(aReviewsB.targetProjectId, teamB.id);

    // 배정 교체: 자기 팀·라운드 밖 프로젝트·중복은 거부하고, 다른 팀으로는 바꿀 수 있다.
    assert.throws(() => store.replacePeerReviewAssignment(round.id, aReviewsB.id, teacher, teamA.id), (error) => error.code === 'peer_review_self_assignment');
    assert.throws(() => store.replacePeerReviewAssignment(round.id, aReviewsB.id, teacher, stranger.id), (error) => error.code === 'peer_review_target_outside_round');
    assert.throws(() => store.replacePeerReviewAssignment(round.id, aReviewsB.id, studentA, demo.id), (error) => error.code === 'teacher_required');
    const replaced = store.replacePeerReviewAssignment(round.id, aReviewsB.id, teacher, demo.id);
    assert.equal(replaced.assignments.find((item) => item.id === aReviewsB.id).targetProjectId, demo.id);
    store.replacePeerReviewAssignment(round.id, aReviewsB.id, teacher, teamB.id);

    // 리뷰가 이미 있는 배정은 바꾸지 못한다.
    store.writePeerReview(aReviewsB.id, studentA, { like, wish });
    assert.throws(() => store.replacePeerReviewAssignment(round.id, aReviewsB.id, teacher, demo.id), (error) => error.code === 'peer_review_already_written');

    const closed = store.closePeerReviewRound(round.id, teacher);
    assert.equal(closed.state, 'closed'); assert.ok(closed.closedAt);
    assert.throws(() => store.replacePeerReviewAssignment(round.id, aReviewsB.id, teacher, demo.id), (error) => error.code === 'peer_review_round_closed');
    assert.equal(store.peerReviewRounds(teacher).length, 1);
    assert.throws(() => store.peerReviewRounds(studentA), (error) => error.code === 'teacher_required');
  } finally { store.close(); }
});

test('학생은 배정된 팀의 최신 저장본만 읽고 미배정 프로젝트·닫힌 라운드·관찰자·교사 작성은 거부한다', () => {
  const { store, demo, teamA, teamB } = fixture();
  try {
    store.saveCheckpoint(teamB.id, studentB, { code: '학생 나 팀의 최신 코드', baseVersion: 0, message: '카메라 회전 추가', evidence: {} });
    store.saveDraft(teamB.id, studentB, { code: '아직 공유하지 않은 초안', baseVersion: 1, clientSequence: 1 }, 'tab');
    store.addFeedback(teamB.id, teacher, { comment: '학생 나 팀에게만 전달하는 교사 피드백', visibility: 'team' });
    const round = store.createPeerReviewRound(teacher, { title: '1차', reviewsPerTeam: 1, projectIds: [teamA.id, teamB.id] });
    const aReviewsB = round.assignments.find((item) => item.reviewerProjectId === teamA.id), bReviewsA = round.assignments.find((item) => item.reviewerProjectId === teamB.id);

    const target = store.peerReviewTarget(aReviewsB.id, studentA);
    assert.equal(target.target.code, '학생 나 팀의 최신 코드'); assert.equal(target.target.version, 1); assert.equal(target.target.title, teamB.title);
    assert.deepEqual(Object.keys(target.target).sort(), ['code', 'id', 'problem', 'successCriteria', 'title', 'updatedAt', 'version']);
    assert.ok(!JSON.stringify(target).includes('아직 공유하지 않은 초안')); assert.ok(!JSON.stringify(target).includes('교사 피드백'));
    assert.throws(() => store.peerReviewTarget(bReviewsA.id, studentA), (error) => error.code === 'peer_review_not_assigned' && error.status === 403);
    assert.throws(() => store.peerReviewTarget('missing', studentA), (error) => error.status === 404);
    assert.equal(store.peerReviewTarget(bReviewsA.id, teacher).target.code, teamA.code);

    assert.throws(() => store.writePeerReview(bReviewsA.id, studentA, { like, wish }), (error) => error.code === 'peer_review_not_assigned');
    assert.throws(() => store.writePeerReview(aReviewsB.id, teacher, { like, wish }), (error) => error.code === 'student_required');
    const viewer = store.ensureUser({ id: 'viewer-a', name: '관찰 학생', role: 'student' });
    store.addMember(teamA.id, studentA, viewer.id, 'viewer');
    assert.throws(() => store.writePeerReview(aReviewsB.id, viewer, { like, wish }), (error) => error.code === 'access_denied');
    assert.equal(store.peerReviewTarget(aReviewsB.id, viewer).target.version, 1, '관찰자도 배정된 코드는 읽을 수 있다');

    const first = store.writePeerReview(aReviewsB.id, studentA, { like, wish });
    assert.equal(first.like, like);
    const edited = store.writePeerReview(aReviewsB.id, studentA, { like: like + ' 다시 보니 더 좋았어요.', wish });
    assert.equal(edited.id, first.id, '한 배정에 작성자마다 하나만 남고 제출 뒤에도 고칠 수 있다');
    assert.equal(store.projectPeerReviews(teamB.id, studentB).received.length, 1);

    store.closePeerReviewRound(round.id, teacher);
    assert.throws(() => store.writePeerReview(aReviewsB.id, studentA, { like, wish }), (error) => error.code === 'peer_review_round_closed' && error.status === 409);
    assert.equal(store.peerReviewTarget(aReviewsB.id, studentA).target.version, 1, '닫힌 뒤에도 읽기는 가능하다');
  } finally { store.close(); }
});

test('받은 리뷰의 작성자는 팀 이름으로만 보이고 개인 이름은 교사만 본다', () => {
  const { store, teamA, teamB } = fixture();
  try {
    const round = store.createPeerReviewRound(teacher, { title: '1차', reviewsPerTeam: 1, projectIds: [teamA.id, teamB.id] });
    store.writePeerReview(round.assignments.find((item) => item.reviewerProjectId === teamA.id).id, studentA, { like, wish });
    const asStudent = store.projectPeerReviews(teamB.id, studentB);
    assert.equal(asStudent.received.length, 1); assert.equal(asStudent.received[0].reviewerTeam, teamA.title);
    assert.equal(asStudent.received[0].authorName, undefined); assert.equal(asStudent.received[0].authorId, undefined);
    assert.ok(!Object.keys(asStudent.received[0]).some((key) => key.startsWith('author')), '학생에게는 작성자 식별 정보가 없다');
    const asTeacher = store.projectPeerReviews(teamB.id, teacher);
    assert.equal(asTeacher.received[0].authorName, studentA.name);
    assert.equal(store.peerReviewRoundDetail(round.id, teacher).reviews[0].authorName, studentA.name);
    assert.deepEqual(store.peerReviewRoundDetail(round.id, teacher).projects.map((project) => [project.written, project.received]), [[1, 0], [0, 1]]);
    assert.throws(() => store.projectPeerReviews(teamB.id, studentA), (error) => error.code === 'access_denied', '다른 팀이 받은 리뷰는 볼 수 없다');
  } finally { store.close(); }
});

test('학생이 쓴 동료 리뷰는 협업 영역의 교실 안 근거로 세어 학생별 근거 화면에 나타난다', () => {
  const { store, teamA, teamB } = fixture();
  try {
    const round = store.createPeerReviewRound(teacher, { title: '1차', reviewsPerTeam: 1, projectIds: [teamA.id, teamB.id] });
    const assignment = round.assignments.find((item) => item.reviewerProjectId === teamA.id);
    const before = store.studentEvidence(teamA.id, teacher, studentA.id, []);
    assert.equal(before.summary.localEvidenceCounts.peerReviews, 0);
    assert.equal(before.summary.signals.find((signal) => signal.criterion === 'collaboration').localEvidence, '동료 리뷰 0건');
    store.writePeerReview(assignment.id, studentA, { like, wish });
    const after = store.studentEvidence(teamA.id, teacher, studentA.id, []);
    assert.equal(after.summary.localEvidenceCounts.peerReviews, 1);
    assert.equal(after.summary.evidenceCount, 0, 'GitHub 근거 수와 섞지 않는다');
    const collaboration = after.summary.signals.find((signal) => signal.criterion === 'collaboration');
    assert.equal(collaboration.localEvidence, '동료 리뷰 1건'); assert.equal(collaboration.localEvidenceIds.length, 1);
    assert.ok(after.summary.signals.filter((signal) => signal.criterion !== 'collaboration').every((signal) => signal.localEvidence === undefined));
    assert.equal(after.peerReviews.length, 1); assert.equal(after.peerReviews[0].targetTitle, teamB.title); assert.equal(after.peerReviews[0].like, like);
    assert.equal(store.studentEvidence(teamB.id, teacher, studentB.id, []).summary.localEvidenceCounts.peerReviews, 0, '받은 리뷰는 쓴 학생의 근거다');
    assert.equal(summarizeLearningEvidence([], {}).localEvidenceCounts.peerReviews, 0);
    assert.equal(after.summary.score, undefined);
  } finally { store.close(); }
});

test('HTTP: 교사가 라운드를 열면 학생 가가 학생 나 팀을 읽고 리뷰를 쓰며 길이·권한·닫힌 라운드를 상태 코드로 구분한다', async (t) => {
  const { apiFor, store, demo, teamA, teamB } = await httpFixture(t);
  const tc = apiFor(teacher.id), a = apiFor(studentA.id), b = apiFor(studentB.id);
  assert.equal((await a('/peer-reviews/rounds')).status, 403);
  assert.equal((await a('/peer-reviews/rounds', { method: 'POST', body: { title: '학생 시도', reviewsPerTeam: 1, projectIds: [teamA.id, teamB.id] } })).status, 403);
  for (const body of [{ title: '', reviewsPerTeam: 1, projectIds: [teamA.id, teamB.id] }, { title: '1차', reviewsPerTeam: '1', projectIds: [teamA.id, teamB.id] }, { title: '1차', reviewsPerTeam: 1, projectIds: 'not-a-list' }, { title: '1차', reviewsPerTeam: 1, projectIds: [teamA.id] }]) assert.equal((await tc('/peer-reviews/rounds', { method: 'POST', body })).status, 422);
  const created = await tc('/peer-reviews/rounds', { method: 'POST', body: { title: '1차 동료 리뷰', reviewsPerTeam: 1, projectIds: [teamA.id, teamB.id] } });
  assert.equal(created.status, 201); assert.equal(created.data.round.assignments.length, 2);
  const roundId = created.data.round.id;
  const mine = await a(`/projects/${teamA.id}/peer-reviews`);
  assert.equal(mine.status, 200); assert.equal(mine.data.canWrite, true); assert.equal(mine.data.assignments.length, 1); assert.equal(mine.data.assignments[0].targetTitle, teamB.title); assert.equal(mine.data.assignments[0].myReview, null);
  const assignmentId = mine.data.assignments[0].id, otherAssignmentId = created.data.round.assignments.find((item) => item.reviewerProjectId === teamB.id).id;
  assert.equal((await a(`/projects/${teamB.id}/peer-reviews`)).status, 403, '다른 팀의 배정 목록은 볼 수 없다');
  const target = await a(`/peer-reviews/assignments/${assignmentId}/target`);
  assert.equal(target.status, 200); assert.equal(target.data.target.id, teamB.id); assert.equal(target.data.target.code, teamB.code); assert.equal(target.data.target.inviteCode, undefined);
  assert.equal((await a(`/peer-reviews/assignments/${otherAssignmentId}/target`)).status, 403);
  assert.equal((await a('/peer-reviews/assignments/missing/target')).status, 404);
  for (const [body, code] of [[{ like: '짧아요', wish }, 'peer_review_text_too_short'], [{ like, wish: '' }, 'peer_review_text_required'], [{ like }, 'peer_review_text_required'], [{ like: '가'.repeat(1001), wish }, 'peer_review_text_too_long'], [{ like: 42, wish }, 'invalid_input']]) {
    const rejected = await a(`/peer-reviews/assignments/${assignmentId}/review`, { method: 'PUT', body }); assert.equal(rejected.status, 422, code); assert.equal(rejected.data.code, code);
  }
  const written = await a(`/peer-reviews/assignments/${assignmentId}/review`, { method: 'PUT', body: { like: `  ${like}  `, wish } });
  assert.equal(written.status, 200); assert.equal(written.data.review.like, like);
  assert.equal((await a(`/peer-reviews/assignments/${otherAssignmentId}/review`, { method: 'PUT', body: { like, wish } })).status, 403);
  assert.equal((await tc(`/peer-reviews/assignments/${assignmentId}/review`, { method: 'PUT', body: { like, wish } })).status, 403);
  const edited = await a(`/peer-reviews/assignments/${assignmentId}/review`, { method: 'PUT', body: { like, wish: wish + ' 그리고 소리도 함께 넣어 보면 좋겠어요.' } });
  assert.equal(edited.status, 200); assert.equal(edited.data.review.id, written.data.review.id);
  const receivedByB = await b(`/projects/${teamB.id}/peer-reviews`);
  assert.equal(receivedByB.data.received.length, 1); assert.equal(receivedByB.data.received[0].reviewerTeam, teamA.title); assert.equal(receivedByB.data.received[0].authorName, undefined);
  const detail = await tc(`/peer-reviews/rounds/${roundId}`);
  assert.equal(detail.status, 200); assert.equal(detail.data.round.reviews[0].authorName, studentA.name);
  assert.deepEqual(detail.data.round.projects.map((project) => [project.title, project.written, project.received]), [[teamA.title, 1, 0], [teamB.title, 0, 1]]);
  assert.equal((await a(`/peer-reviews/rounds/${roundId}`)).status, 403);
  const swapped = await tc(`/peer-reviews/rounds/${roundId}/assignments/${otherAssignmentId}`, { method: 'PATCH', body: { targetProjectId: demo.id } });
  assert.equal(swapped.status, 422, '라운드 밖 프로젝트로는 바꿀 수 없다');
  assert.equal((await tc(`/peer-reviews/rounds/${roundId}/assignments/${otherAssignmentId}`, { method: 'PATCH', body: { targetProjectId: teamB.id } })).status, 422);
  assert.equal((await a(`/peer-reviews/rounds/${roundId}/close`, { method: 'POST', body: {} })).status, 403);
  const closed = await tc(`/peer-reviews/rounds/${roundId}/close`, { method: 'POST', body: {} });
  assert.equal(closed.status, 200); assert.equal(closed.data.round.state, 'closed');
  const late = await a(`/peer-reviews/assignments/${assignmentId}/review`, { method: 'PUT', body: { like, wish } });
  assert.equal(late.status, 409); assert.equal(late.data.code, 'peer_review_round_closed');
  assert.equal((await a(`/projects/${teamA.id}/peer-reviews`)).data.assignments[0].roundState, 'closed');
  const evidence = await tc(`/projects/${teamA.id}/student-evidence/${studentA.id}`);
  assert.equal(evidence.status, 200); assert.equal(evidence.data.summary.localEvidenceCounts.peerReviews, 1);
  assert.equal((await tc('/peer-reviews/rounds')).data.rounds.length, 1);
  const exported = await b(`/projects/${teamB.id}/export`);
  assert.equal(exported.data.peerReviews.received.length, 1); assert.equal(exported.data.peerReviews.received[0].authorName, undefined);
  assert.equal(store.getJobs(teamA.id).length, 0, '동료 리뷰는 GitHub 작업을 만들지 않는다');
});

test('동료 리뷰 테이블은 기존 DB에 그대로 얹히고 재시작 후에도 라운드·배정·리뷰가 유지된다', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vpylab-peer-review-')), filename = join(directory, 'state.sqlite');
  let store;
  try {
    store = createStore({ filename, localMode: true });
    for (const table of ['peer_review_rounds', 'peer_review_assignments', 'peer_reviews']) store.db.exec(`DROP TABLE ${table}`);
    store.close();
    store = createStore({ filename, localMode: true });
    const teamA = store.listProjects(studentA).find((project) => project.ownerId === studentA.id), teamB = store.listProjects(studentB).find((project) => project.ownerId === studentB.id);
    assert.equal(store.listProjects(teacher).length, 3, '시드 프로젝트는 다시 만들지 않는다');
    const round = store.createPeerReviewRound(teacher, { title: '재시작 전', reviewsPerTeam: 1, projectIds: [teamA.id, teamB.id] });
    const review = store.writePeerReview(round.assignments.find((item) => item.reviewerProjectId === teamA.id).id, studentA, { like, wish });
    store.close();
    store = createStore({ filename, localMode: true });
    const detail = store.peerReviewRoundDetail(round.id, teacher);
    assert.equal(detail.title, '재시작 전'); assert.equal(detail.assignments.length, 2); assert.equal(detail.reviews[0].id, review.id);
    assert.equal(store.listProjects(teacher).length, 3);
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
});
