import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir } from '../project-paths.mjs';

// 실행 중인 연수 서버에만 접속합니다. 실제 계정·토큰·DB 파일은 읽지 않습니다.
const apiOrigin = 'http://127.0.0.1:4094';
const uiOrigin = 'http://127.0.0.1:4093';
const runId = `training-${randomUUID()}`;
const output = join(projectDir('vpylab-teacher-training'), 'validation', 'collaboration-validation.json');
const cookies = new Map();
const checks = [];
const requests = [];
let projectId = null;

function check(id, condition, detail = {}) {
  assert.ok(condition, id);
  checks.push({ id, passed: true, ...detail });
}

async function localFetch(url, options = {}) {
  const parsed = new URL(url);
  assert.ok([apiOrigin, uiOrigin].includes(parsed.origin), '로컬 연수 서버 외의 주소는 요청할 수 없습니다.');
  assert.equal(parsed.hostname, '127.0.0.1');
  // GitHub 관련 경로는 상태 읽기만 허용합니다. 원격 제안·이슈 전송을 하지 않습니다.
  if (parsed.pathname.includes('/github')) assert.equal(options.method || 'GET', 'GET');
  return fetch(parsed, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
}

async function api(actor, path, { method = 'GET', body, expected = 200, operation = '' } = {}) {
  const headers = { Origin: uiOrigin };
  if (actor) {
    assert.ok(cookies.has(actor), '해당 연습 역할의 로그인 상태가 필요합니다.');
    headers.Cookie = cookies.get(actor);
    headers['X-Classroom-User'] = actor;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    assert.ok(operation, '변경 요청의 단계를 구별하는 키가 필요합니다.');
    headers['Idempotency-Key'] = createHash('sha256').update(JSON.stringify([runId, actor, path, operation, body])).digest('hex');
  }
  const response = await localFetch(`${apiOrigin}/api/v2${path}`, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  requests.push({ actor: actor || 'anonymous', method, path, status: response.status, expectedStatus: expected });
  assert.equal(response.status, expected, `${method} ${path}: ${data.code || response.status}`);
  return { data, replayed: response.headers.get('Idempotency-Replayed') === 'true', cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

function feedbackIds(data) {
  return [...new Set((data.feedback || []).map(item => item.id))].sort();
}

function snapshot(detail) {
  return { code: detail.project.code, version: detail.project.version, checkpoints: detail.checkpoints.length, proposals: detail.proposals.length, reviews: detail.reviews.length };
}

function report(success, extra = {}) {
  return {
    schema: 1, runId, testedAt: new Date().toISOString(), success,
    environment: { apiOrigin, uiOrigin, localMode: true, githubMode: 'offline', externalGitHubWriteRequestsInThisRun: 0 },
    scope: '별도 연수 DB의 새 합성 검증 프로젝트에서 실제 HTTP API·역할 세션·저장·검토·반영·피드백 필터를 확인했습니다.',
    limitation: '실제 교사·학생의 수행이나 교육 효과를 측정한 자료가 아니며, 실제 GitHub PR·리뷰 또는 브라우저·음향 실행 검증을 대신하지 않습니다.',
    projectId, projectUrl: projectId ? `${uiOrigin}/classroom.html#/projects/${projectId}` : null,
    checksPassed: checks.length, httpRequests: requests.length, checks, requests, ...extra,
  };
}

async function main() {
  const health = (await api(null, '/health')).data;
  check('local_server_healthy_and_github_offline', health.ok && health.localMode === true && health.githubMode === 'offline');
  const ready = (await api(null, '/readiness')).data;
  check('database_and_local_auth_ready', ready.ok && ready.checks.database === 'ok' && ready.checks.authentication === 'local');
  const metadataResponse = await localFetch(`${uiOrigin}/api/training-info`);
  assert.equal(metadataResponse.status, 200);
  const metadata = await metadataResponse.json();
  check('training_metadata_disables_external_github_writes', metadata.mode === 'offline' && metadata.externalGitHubWrites === false && Boolean(metadata.projects?.math?.id && metadata.projects?.science?.id));

  for (const actor of ['teacher', 'student-a', 'student-b']) {
    const login = await api(null, '/session/local', { method: 'POST', body: { userId: actor }, operation: `login-${actor}` });
    check(`role_session_${actor}`, Boolean(login.cookie) && login.data.user.id === actor);
    cookies.set(actor, login.cookie);
    check(`role_session_readback_${actor}`, (await api(actor, '/session')).data.user.id === actor);
  }

  const originals = {};
  for (const key of ['math', 'science']) originals[key] = snapshot((await api('teacher', `/projects/${metadata.projects[key].id}`)).data);

  const originalCode = [
    'from vpython import *', 'scene.background = color.white', 'scene.range = 4',
    'radius = 0.6', 'shade = color.blue',
    'sphere(pos=vector(0, 0, 0), radius=radius, color=shade)',
    'print("반지름:", radius)', 'print("검증용 색 변경 실험")', '',
  ].join('\n');
  const changedCode = originalCode.replace('shade = color.blue', 'shade = color.cyan');
  const projectInput = {
    title: '검증용 · 연수짝검토', code: originalCode, aiPolicy: 'disabled',
    problem: `합성 API 검증입니다. 실제 연수자 수행이 아닙니다. ${runId}`,
    successCriteria: '색 한 줄만 바꾸고 위치·반지름을 유지하며 동료 검토와 피드백 범위를 확인합니다.',
    source: { kind: 'reference', id: 'teacher-training-first-light-validation', title: '연수용 첫 실행 예제의 합성 검증 사본' },
  };
  const created = await api('teacher', '/projects', { method: 'POST', body: projectInput, expected: 201, operation: 'create-project' });
  projectId = created.data.project.id;
  check('separate_synthetic_project_created', Boolean(projectId) && !Object.values(metadata.projects).some(project => project.id === projectId));
  const replayedProject = await api('teacher', '/projects', { method: 'POST', body: projectInput, expected: 201, operation: 'create-project' });
  check('project_creation_replay_has_no_duplicate', replayedProject.replayed && replayedProject.data.project.id === projectId);
  const path = `/projects/${projectId}`;

  for (const actor of ['student-a', 'student-b']) {
    const members = (await api('teacher', `${path}/members`, { method: 'POST', body: { userId: actor, role: 'editor' }, operation: `add-${actor}` })).data.members;
    check(`editor_membership_${actor}`, members.some(member => member.id === actor && member.role === 'editor'));
  }

  const draftInput = { code: changedCode, baseVersion: 0, clientSequence: 1, clientId: `validation-${runId}` };
  const savedDraft = (await api('student-a', `${path}/drafts`, { method: 'PUT', body: draftInput, operation: 'save-draft' })).data.draft;
  check('personal_draft_saved', savedDraft.code === changedCode && savedDraft.baseVersion === 0 && savedDraft.clientSequence === 1);
  const ownDrafts = (await api('student-a', `${path}/drafts/list`)).data.drafts;
  check('personal_draft_readback', ownDrafts.some(draft => draft.code === changedCode && draft.userId === 'student-a'));
  check('other_editor_cannot_list_personal_draft', (await api('student-b', `${path}/drafts/list`)).data.drafts.length === 0);
  const beforeProposal = (await api('student-b', path)).data;
  check('draft_does_not_replace_team_version', beforeProposal.project.version === 0 && beforeProposal.project.code === originalCode);

  const issue = (await api('student-a', `${path}/issues`, { method: 'POST', body: { title: '색만 바꾸면 크기와 위치는 유지될까?', body: '합성 검증 질문입니다. shade 한 줄과 radius·pos 조건을 대조합니다.' }, expected: 201, operation: 'add-local-question' })).data.issue;
  check('local_question_preserved_without_external_issue', issue.authorId === 'student-a' && issue.projectId === projectId);

  const proposalInput = {
    title: '색 한 줄만 청록으로 변경', code: changedCode, baseVersion: 0,
    evidence: {
      hypothesis: '합성 예시: shade만 바꾸면 반지름과 위치는 유지될 것이다.',
      observation: 'API 저장 검증: 코드 두 사본에서 shade 한 줄만 다르다. 화면 실행은 별도 통합 검증으로 확인한다.',
      reasoning: 'radius와 pos가 같은 코드이며 색 변수의 값만 바꾸었다.',
      nextStep: '검토자가 기준 코드와 수정 코드를 대조하고 의견을 남긴다.', aiUse: 'AI 미사용 경로의 합성 예시',
    },
  };
  const proposal = (await api('student-a', `${path}/proposals`, { method: 'POST', body: proposalInput, expected: 201, operation: 'proposal-a' })).data.proposal;
  check('proposal_keeps_author_and_evidence', proposal.authorId === 'student-a' && proposal.code === changedCode && proposal.evidence.hypothesis === proposalInput.evidence.hypothesis);
  const unmerged = (await api('student-a', path)).data;
  check('proposal_does_not_replace_team_version', unmerged.project.version === 0 && unmerged.project.code === originalCode && unmerged.proposals.length === 1);
  const selfReview = (await api('student-a', `${path}/proposals/${proposal.id}/reviews`, { method: 'POST', body: { decision: 'approve', comment: '검증용 자기 승인 시도' }, expected: 403, operation: 'self-approve-denied' })).data;
  check('self_approval_denied', selfReview.code === 'self_review');
  const noReviewMerge = (await api('student-a', `${path}/proposals/${proposal.id}/merge`, { method: 'POST', body: {}, expected: 403, operation: 'merge-without-review-denied' })).data;
  check('merge_without_peer_approval_denied', noReviewMerge.code === 'review_required');

  const changeReview = (await api('student-b', `${path}/proposals/${proposal.id}/reviews`, { method: 'POST', body: { decision: 'request_changes', comment: '검증용 보완 요청: 위치·반지름 고정 조건을 기준 코드에서 다시 확인해 주세요.' }, expected: 201, operation: 'peer-request-changes' })).data.review;
  check('other_editor_request_changes_preserved', changeReview.authorId === 'student-b' && changeReview.decision === 'request_changes');
  const requestedMerge = (await api('student-a', `${path}/proposals/${proposal.id}/merge`, { method: 'POST', body: {}, expected: 403, operation: 'merge-after-change-request-denied' })).data;
  check('unresolved_change_request_prevents_merge', requestedMerge.code === 'review_required');
  const approval = (await api('student-b', `${path}/proposals/${proposal.id}/reviews`, { method: 'POST', body: { decision: 'approve', comment: '검증용 재검토: 두 코드의 radius와 pos, 기존 설명에서 고정 조건을 확인해 보완 요청을 해제합니다. 실제 화면 실행 검증과는 구별합니다.' }, expected: 201, operation: 'peer-approve' })).data.review;
  check('peer_latest_approval_preserved', approval.authorId === 'student-b' && approval.decision === 'approve');
  const merged = await api('student-a', `${path}/proposals/${proposal.id}/merge`, { method: 'POST', body: {}, operation: 'merge-after-approval' });
  check('approved_proposal_merges_team_version', merged.data.project.version === 1 && merged.data.project.code === changedCode && merged.data.proposal.state === 'merged');
  check('merged_checkpoint_preserves_proposal_author', merged.data.checkpoint.authorId === 'student-a' && merged.data.checkpoint.evidence.reasoning === proposalInput.evidence.reasoning);
  const mergedReplay = await api('student-a', `${path}/proposals/${proposal.id}/merge`, { method: 'POST', body: {}, operation: 'merge-after-approval' });
  check('successful_merge_replay_has_no_extra_checkpoint', mergedReplay.replayed && mergedReplay.data.checkpoint.id === merged.data.checkpoint.id && mergedReplay.data.project.version === 1);
  const afterMerge = (await api('teacher', path)).data;
  check('checkpoint_history_and_reviews_remain', afterMerge.checkpoints.length === 2 && afterMerge.reviews.length === 2 && afterMerge.reflections.length === 1 && afterMerge.proposals.length === 1);

  const feedbackInputs = [
    { label: 'student-a', studentId: 'student-a', visibility: 'student', comment: '합성 개별 피드백 A: 색 한 줄과 고정 조건을 구분했습니다. 다른 한 조건도 비교해 볼까요?' },
    { label: 'student-b', studentId: 'student-b', visibility: 'student', comment: '합성 개별 피드백 B: 기준 코드와 대조한 검토 근거를 남겼습니다. 다음에는 반례를 하나 제안해 보세요.' },
    { label: 'teacher-private-a', studentId: 'student-a', visibility: 'private', comment: '합성 교사 개인 메모: 실제 관찰 기록이 아니며 학생 화면에서 제외되는지 검사합니다.' },
    { label: 'team', visibility: 'team', comment: '합성 팀 피드백: 다음 실험에서도 한 조건씩 바꾸고 동료가 재현할 정보를 남깁니다.' },
  ];
  const feedback = [];
  for (const input of feedbackInputs) {
    const { label, ...body } = input;
    body.evidenceIds = [];
    body.criteria = { collaboration: '제안·검토·보완 판단을 구별한 합성 연수 예시' };
    const result = await api('teacher', `${path}/feedback`, { method: 'POST', body, expected: 201, operation: `feedback-${label}` });
    feedback.push(result.data.feedback);
    check(`feedback_saved_${label}`, result.data.feedback.visibility === body.visibility && result.data.feedback.comment === body.comment);
    if (label === 'student-a') {
      const replay = await api('teacher', `${path}/feedback`, { method: 'POST', body, expected: 201, operation: `feedback-${label}` });
      check('feedback_replay_has_no_duplicate', replay.replayed && replay.data.feedback.id === result.data.feedback.id);
    }
  }

  for (const actor of ['teacher', 'student-a', 'student-b']) {
    const expected = feedback.filter(item => actor === 'teacher' || item.visibility === 'team' || item.visibility === 'student' && item.studentId === actor).map(item => item.id).sort();
    for (const suffix of ['', '/export']) {
      const data = (await api(actor, `${path}${suffix}`)).data;
      check(`feedback_scope_${actor}_${suffix ? 'export' : 'detail'}`, JSON.stringify(feedbackIds(data)) === JSON.stringify(expected));
    }
    const learning = (await api(actor, `${path}/learning`)).data;
    const ownFeedbackIds = [...new Set(learning.students.flatMap(student => student.feedback.map(item => item.id)))].sort();
    check(`feedback_scope_${actor}_learning`, JSON.stringify(ownFeedbackIds) === JSON.stringify(expected));
    check(`learning_is_local_only_${actor}`, learning.mode === 'offline' && learning.events.length === 0 && (actor === 'teacher' ? learning.students.length === 2 : learning.students.length === 1 && learning.students[0].userId === actor));
  }

  const evidenceA = (await api('student-a', `${path}/student-evidence/student-a`)).data;
  const evidenceB = (await api('student-b', `${path}/student-evidence/student-b`)).data;
  check('student_a_keeps_own_checkpoint_and_reflection', evidenceA.checkpoints.length === 1 && evidenceA.reflections.length === 1 && evidenceA.checkpoints[0].authorId === 'student-a');
  check('student_b_keeps_own_peer_reviews', evidenceB.reviews.length === 2 && evidenceB.reviews.every(review => review.authorId === 'student-b'));
  for (const [actor, other] of [['student-a', 'student-b'], ['student-b', 'student-a']]) {
    check(`student_evidence_cross_access_denied_${actor}`, (await api(actor, `${path}/student-evidence/${other}`, { expected: 403 })).data.code === 'student_evidence_denied');
  }
  check('student_cannot_write_teacher_feedback', (await api('student-a', `${path}/feedback`, { method: 'POST', body: { comment: '검증용 권한 거절 요청', visibility: 'team' }, expected: 403, operation: 'student-feedback-denied' })).data.code === 'teacher_required');

  let github;
  const deadline = Date.now() + 15000;
  do {
    github = (await api('teacher', `${path}/github`)).data;
    if (github.jobs.every(job => !['pending', 'running'].includes(job.state))) break;
    await new Promise(resolve => setTimeout(resolve, 300));
  } while (Date.now() < deadline);
  check('github_stays_offline_without_binding', github.mode === 'offline' && !github.binding && github.repositories.length === 0);
  check('local_checkpoint_worker_succeeded', github.jobs.length === 1 && github.jobs[0].kind === 'checkpoint' && github.jobs[0].state === 'succeeded' && github.jobs[0].result?.localOnly === true);
  check('no_remote_issue_or_pull_job_created', github.jobs.every(job => job.kind === 'checkpoint') && github.simulatedPulls.length === 0 && github.simulatedIssues.length === 0);

  for (const key of ['math', 'science']) {
    const after = snapshot((await api('teacher', `/projects/${metadata.projects[key].id}`)).data);
    check(`existing_${key}_practice_project_unchanged`, JSON.stringify(after) === JSON.stringify(originals[key]));
  }
  check('all_http_requests_remained_on_loopback', requests.every(request => request.path.startsWith('/')));
  const result = report(true, {
    originalPracticeProjectsPreserved: Object.fromEntries(['math', 'science'].map(key => [key, metadata.projects[key].id])),
    proposalId: proposal.id, checkpointId: merged.data.checkpoint.id,
    feedback: feedback.map(({ id, studentId, visibility }) => ({ id, studentId, visibility })),
    checkpointJob: { kind: github.jobs[0].kind, state: github.jobs[0].state, localOnly: github.jobs[0].result.localOnly },
    externalWriteEvidence: '하네스는 loopback 주소만 허용하고 /github 경로는 GET만 허용했습니다. 서버 health·연수 metadata·작업 원장을 읽어 GitHub offline, 외부반영 꺼짐, checkpoint localOnly를 확인했습니다.',
  });
  mkdirSync(join(projectDir('vpylab-teacher-training'), 'validation'), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ success: true, checksPassed: checks.length, httpRequests: requests.length, projectUrl: result.projectUrl, externalGitHubWriteRequests: 0, output }));
}

main().catch(error => {
  mkdirSync(join(projectDir('vpylab-teacher-training'), 'validation'), { recursive: true });
  writeFileSync(output, JSON.stringify(report(false, { failure: String(error.message).slice(0, 400) }), null, 2) + '\n');
  console.error(JSON.stringify({ success: false, checksPassed: checks.length, projectId, failure: String(error.message).slice(0, 200), output }));
  process.exitCode = 1;
});
