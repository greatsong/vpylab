import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import courses from '../../client/src/data/courses.js';
import { createStore, DEMO_USERS } from '../../server/classroom/store.js';
import { createClassroomApp } from '../../server/classroom/app.js';
import { createGitHubService } from '../../server/classroom/github.js';
import { rehearseRestore } from './backup.mjs';

// 실제 학생·GitHub·AI 인증을 사용하지 않는 로컬 HTTP 협업 경로 리허설입니다.
const root = fileURLToPath(new URL('../../', import.meta.url));
const runId = randomUUID();
const localRoot = join(root, '.local/project-path-review');
const directory = join(localRoot, runId);
const database = join(directory, 'classroom.sqlite');
const reportPath = join(root, 'docs/project-path-review/2026-10-28/rehearsal-results.json');
mkdirSync(directory, { recursive: true, mode: 0o700 });
mkdirSync(dirname(reportPath), { recursive: true });
const teacher = DEMO_USERS[0].id;
const hash = value => createHash('sha256').update(value).digest('hex');
const fixtureRoot = join(root, 'docs/project-path-review/2026-10-28/upstream');
const sourceFile = join(fixtureRoot, 'Demos_no_notebook/Bounce.py');
const licenseFile = join(fixtureRoot, 'LICENSE.txt');
const originalRemix = readFileSync(sourceFile, 'utf8');
const originalLicense = readFileSync(licenseFile, 'utf8');
assert.equal(hash(originalRemix), '0cc7bdb0451f6e93f62268ed32fa4b241ef0dd17228222aeeed0a2d50c57cee3', '공개 코드의 고정 버전 해시를 확인합니다.');
assert.equal(hash(originalLicense), 'c98185cf6ee6c6a0004398c332a14f5e12e45d884fe1a1bfefa7bc5ea9911357', '공개 라이선스의 고정 버전 해시를 확인합니다.');
const compatibilityRemix = originalRemix.replace('color.gray(0.7)', 'vector(0.7, 0.7, 0.7)');
assert.notEqual(compatibilityRemix, originalRemix, '교사의 호환성 수정 위치가 있어야 합니다.');
const lesson = courses.find(item => item.id === 'beg-shapes').lessons.find(item => item.id === 'beg-shapes-4');
const remixCommit = '3254f6e4b845fdf27d8730b66887a9806d1822b3';
const remixUrl = `https://github.com/vpython/vpython-jupyter/blob/${remixCommit}/Demos_no_notebook/Bounce.py`;
const report = {
  schemaVersion: 1, runId, startedAt: new Date().toISOString(), execution: 'local_express_http_sqlite_simulator',
  database, databasePolicy: '매 실행마다 UUID 디렉터리에 신규 SQLite 파일 생성. 기존 교실 DB를 열지 않음.',
  scope: {
    actors: '기존 로컬 DEMO 교사와 합성 학생 6명. createSession으로 발급한 합성 세션이며 실제 학생 로그인 검증 아님.',
    github: '명시적 GitHub simulator. 외부 읽기·쓰기 및 토큰 읽기 없음.',
    ai: 'AI optional/disabled 정책만 검사. 실제 AI 호출 없음.',
    runtime: '코드 전달·초안·협업·권한·보존 검사. Pyodide, 3D 렌더, 청감·음악적 품질, 실제 학생 수행·학습 효과는 검증하지 않음.',
  },
  source: { lesson: { id: lesson.id, courseId: 'beg-shapes', codeSha256: hash(lesson.code) }, remix: { url: remixUrl, commit: remixCommit, path: 'Demos_no_notebook/Bounce.py', codeSha256: hash(originalRemix), licensePath: 'LICENSE.txt', licenseSha256: hash(originalLicense), teacherChange: 'color.gray(0.7) -> vector(0.7, 0.7, 0.7)' } },
  apiCalls: [], checks: [], teams: [], externalAttempts: 0,
};
let store, service, server, origin;
let cookies = new Map();
const actors = [teacher, ...['creative', 'course', 'remix'].flatMap(key => [`${key}-a`, `${key}-b`])];

function persist() {
  const counts = { apiCalls: report.apiCalls.length, checks: report.checks.length, passed: 0, observedGaps: 0, failed: 0 };
  for (const check of report.checks) {
    if (check.result === 'passed') counts.passed++;
    else if (check.result === 'observed_gap') counts.observedGaps++;
    else counts.failed++;
  }
  report.counts = counts;
  writeFileSync(join(directory, 'rehearsal-results.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
}

function verify(scope, name, condition, details = {}, classification = 'workflow') {
  report.checks.push({ number: report.checks.length + 1, scope, name, classification, result: condition ? classification === 'gap' ? 'observed_gap' : 'passed' : 'failed', ...details });
  if (!condition) {
    persist();
    assert.ok(condition, `${scope}: ${name} ${JSON.stringify(details)}`);
  }
}

async function start() {
  store = createStore({ filename: database, localMode: true });
  for (const id of actors.filter(id => id !== teacher)) store.ensureUser({ id, name: `합성 ${id}`, role: 'student' });
  cookies = new Map(actors.map(id => [id, `vpylab_v2_session=${store.createSession(id)}`]));
  service = createGitHubService({ store, localMode: true, config: { mode: 'simulator' }, fetchImpl: async () => { report.externalAttempts++; throw new Error('리허설의 외부 네트워크 요청은 허용하지 않습니다.'); } });
  const runtime = createClassroomApp({ store, localMode: true, githubService: service });
  server = runtime.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  report.loopbackOrigins ||= [];
  report.loopbackOrigins.push(origin);
}

async function close() {
  if (service) await service.stopWorker();
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve()));
  if (store) store.close();
  service = server = store = null;
}

async function api(actor, path, { method = 'GET', body, key, expected = 200, scope = 'shared', name, classification = 'workflow' } = {}) {
  const url = new URL(`/api/v2${path}`, origin);
  assert.equal(url.origin, origin);
  const mutation = !['GET', 'HEAD'].includes(method);
  const response = await fetch(url, {
    method,
    headers: { Origin: origin, Cookie: cookies.get(actor), 'X-Classroom-User': actor, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(mutation ? { 'Idempotency-Key': key || randomUUID() } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  report.apiCalls.push({ number: report.apiCalls.length + 1, scope, actor, method, path, status: response.status, idempotencyReplayed: response.headers.get('idempotency-replayed') === 'true' });
  verify(scope, name || `${method} ${path}`, response.status === expected, { expectedStatus: expected, actualStatus: response.status, ...(response.status >= 400 ? { code: data.code } : {}) }, classification);
  return { status: response.status, data, replayed: response.headers.get('idempotency-replayed') === 'true' };
}

const request = (team, actor, path, options = {}) => api(actor, `/projects/${team.projectId}${path}`, { scope: team.key, ...options });
const evidence = (name, extra = {}) => ({ hypothesis: `${name}: 한 조건을 바꾸면 표시나 움직임이 달라집니다.`, observation: `${name}: 이 HTTP 리허설은 실제 실행 결과를 관찰한 것으로 주장하지 않습니다.`, reasoning: `${name}: 바꾼 값과 유지한 값을 구분합니다.`, nextStep: '학생 수업에서는 전후 실행과 설명을 확인합니다.', ...extra });

async function drain(jobId) {
  for (let index = 0; index < 100; index++) {
    const row = store.db.prepare('SELECT project_id,state FROM github_jobs WHERE id=?').get(jobId);
    if (row && ['succeeded', 'failed', 'blocked'].includes(row.state)) return service.jobs(row.project_id).find(job => job.id === jobId);
    const result = await service.runOnce();
    if (!result) break;
  }
  throw new Error(`모의 GitHub 작업이 종료되지 않았습니다: ${jobId}`);
}

const creativeCode = `from vpython import *\n\ngap = 0.5\nsphere(pos=vector(-2, 0, 0), radius=0.4, color=color.red)\nsphere(pos=vector(0, 0, 0), radius=0.4, color=color.green)\nsphere(pos=vector(2, 0, 0), radius=0.4, color=color.blue)\nplay_sound(262, 0.25)\nsleep(gap)\nplay_sound(330, 0.25)\nsleep(gap)\nplay_sound(392, 0.25)\n`;
const remixProblem = `공개 원작을 보존하고 학생별로 한 조건의 변화가 반사에 미치는 영향을 비교합니다.\n원문 URL: ${remixUrl}\ncommit: ${remixCommit}\n파일: Demos_no_notebook/Bounce.py\n코드 SHA-256: ${hash(originalRemix)}\n라이선스: upstream LICENSE.txt 원문 보존, SHA-256 ${hash(originalLicense)}\n원작: 장면·벽·공·반사 반복문 전부.\n교사 변경: color.gray(0.7)를 vector(0.7, 0.7, 0.7)로 1회 호환성 수정. 학생 기여로 계산하지 않음.\n학생 변경: A는 ball.p의 x 값 하나, B는 공의 radius 값 하나를 각각 비교하고 두 변경을 통합. 원작의 반복문·복합 조건·물리식은 교사 제공 범위이며 이번 입문 작성 과제가 아님.`;
const teams = [
  { key: 'creative', title: '합성 1팀 순수 창작 세 음 안내', a: 'creative-a', b: 'creative-b', aiPolicy: 'disabled', code: creativeCode, source: null, problem: '새로 만드는 세 도형·세 음 안내 시안. gap 하나를 바꾸어 간격을 비교한다. 교사 제공 기술 골격과 학생의 설계·비교를 구분한다.', codeA: creativeCode.replace('gap = 0.5', 'gap = 0.3'), codeA2: creativeCode.replace('gap = 0.5', 'gap = 0.4'), codeB: creativeCode.replace('radius=0.4', 'radius=0.6'), merge: code => code.replace('radius=0.4', 'radius=0.6') },
  { key: 'course', title: '합성 2팀 수업 코드 신호등 변형', a: 'course-a', b: 'course-b', aiPolicy: 'optional', code: lesson.code, source: { kind: 'lesson', id: lesson.id, title: lesson.title.ko, courseId: 'beg-shapes' }, problem: 'beg-shapes-4 원문 목표를 유지하며 위치 간격과 크기만 바꾸어 안내등을 비교한다. 원문 도형 생성은 학생의 새 기여가 아니다.', codeA: lesson.code.replace('vector(0, 1.2, 0)', 'vector(0, 1.4, 0)'), codeA2: lesson.code.replace('vector(0, 1.2, 0)', 'vector(0, 1.4, 0)').replace('vector(0, -0.8, 0)', 'vector(0, -1.0, 0)'), codeB: lesson.code.replace('radius=0.45', 'radius=0.55'), merge: code => code.replace('radius=0.45', 'radius=0.55') },
  { key: 'remix', title: '합성 3팀 공개 Bounce 리믹스', a: 'remix-a', b: 'remix-b', aiPolicy: 'disabled', code: 'from vpython import *\n# 교사가 원문을 별도 버전으로 보존한 뒤 호환성 골격을 제공합니다.\n', source: null, problem: remixProblem, codeA: compatibilityRemix.replace('vector (-0.15, -0.23, +0.27)', 'vector (-0.30, -0.23, +0.27)'), codeA2: compatibilityRemix.replace('vector (-0.15, -0.23, +0.27)', 'vector (-0.20, -0.23, +0.27)'), codeB: compatibilityRemix.replace('radius = 0.4', 'radius = 0.5'), merge: code => code.replace('radius = 0.4', 'radius = 0.5') },
];

async function createTeam(team) {
  if (team.key === 'remix') {
    await api(team.a, '/projects', { method: 'POST', scope: team.key, body: { title: '지원되지 않는 공개 출처 검사', code: team.code, source: { kind: 'public_remix', url: remixUrl, sha: remixCommit, license: 'upstream LICENSE.txt' } }, expected: 422, classification: 'gap', name: '공개 리믹스 전용 source 계약은 미지원(422); 다른 kind로 가장하지 않음' });
  }
  const created = await api(team.a, '/projects', { method: 'POST', scope: team.key, expected: 201, body: { title: team.title, problem: team.problem, successCriteria: '한 조건 비교·동료 질문·변경 이유 설명. API 저장 성공을 학습 효과나 실행 성공으로 판정하지 않는다.', code: team.code, aiPolicy: team.aiPolicy, source: team.source } });
  team.projectId = created.data.project.id;
  for (const actor of [team.b, teacher]) await api(actor, '/projects/join', { method: 'POST', scope: team.key, body: { inviteCode: created.data.project.inviteCode } });
  const settings = await request(team, teacher, '/settings', { method: 'PATCH', body: { problem: team.problem, successCriteria: '좌표·값 변경과 전후 결과를 설명하고, 동료의 의견에 근거로 답한다.' } });
  verify(team.key, '초대받은 교사의 수업 설정 권한', settings.data.project.myRole === 'teacher');
  let current = (await request(team, team.a, '')).data;
  verify(team.key, '세 경로 출처와 AI 정책을 서로 구분', JSON.stringify(current.project.source) === JSON.stringify(team.source) && current.project.aiPolicy === team.aiPolicy);
  verify(team.key, '초기 v0 코드 원문 보존', current.checkpoint.version === 0 && current.checkpoint.code === team.code);
  if (team.key === 'remix') {
    verify(team.key, '공개 출처와 원작·교사·두 학생의 변경 범위를 문제 본문에 정확히 보존', current.project.source === null && current.project.problem === remixProblem && [remixUrl, remixCommit, 'Demos_no_notebook/Bounce.py', hash(originalRemix), 'LICENSE.txt', hash(originalLicense), '원작:', '교사 변경:', 'A는 ball.p의 x 값 하나', 'B는 공의 radius 값 하나'].every(value => current.project.problem.includes(value)));
    const raw = await request(team, teacher, '/checkpoints', { method: 'POST', expected: 201, body: { code: originalRemix, baseVersion: current.project.version, message: `공개 원문 보존 ${remixCommit}`, evidence: evidence('교사 원문 보존', { reasoning: remixProblem }) } });
    team.rawCheckpointId = raw.data.checkpoint.id;
    const compatible = await request(team, teacher, '/checkpoints', { method: 'POST', expected: 201, body: { code: compatibilityRemix, baseVersion: raw.data.checkpoint.version, message: '교사의 호환성 한 줄 수정: color.gray 호출을 vector 값으로', evidence: evidence('교사 호환성 제공', { reasoning: '원본 파일은 변경하지 않으며 이 변경을 학생 기여로 귀속하지 않습니다.' }) } });
    team.compatibilityCheckpointId = compatible.data.checkpoint.id;
    verify(team.key, '교사 호환성 수정이 한 줄이며 원문은 별도 보존', originalRemix.split('\n').filter((line, index) => line !== compatibilityRemix.split('\n')[index]).length === 1 && compatible.data.checkpoint.authorId === teacher);
    current = (await request(team, team.a, '')).data;
  }
  team.initialVersion = current.project.version;
  team.initialCode = current.project.code;
  const remote = await request(team, team.a, '/github/fetch', { method: 'POST', body: {} });
  verify(team.key, '명시적 GitHub 모의 연결이며 외부 URL 없음', remote.data.mode === 'simulator' && remote.data.authMethod === 'simulator' && remote.data.remote.simulated === true);
  team.remoteSha = remote.data.remote.sha;
  report.teams.push({ key: team.key, title: team.title, projectId: team.projectId, actors: [team.a, team.b], aiPolicy: team.aiPolicy, source: team.source, initialVersion: team.initialVersion, initialCodeSha256: hash(team.initialCode), ...(team.key === 'remix' ? { rawCheckpointId: team.rawCheckpointId, compatibilityCheckpointId: team.compatibilityCheckpointId, provenanceFallback: 'source:null + 문제 본문에 URL/commit/파일/license/원작·교사·학생 기여 수동 기록' } : {}) });
}

async function collaborationPath(team) {
  const firstDraft = { code: team.codeA, baseVersion: team.initialVersion, clientId: `${team.key}-window-a`, clientSequence: 1 };
  const secondDraft = { code: team.codeB, baseVersion: team.initialVersion, clientId: `${team.key}-window-b`, clientSequence: 1 };
  await request(team, team.a, '/drafts', { method: 'PUT', body: firstDraft });
  await request(team, team.b, '/drafts', { method: 'PUT', body: secondDraft });
  const da = (await request(team, team.a, `/drafts?clientId=${firstDraft.clientId}`)).data.draft;
  const db = (await request(team, team.b, `/drafts?clientId=${secondDraft.clientId}`)).data.draft;
  verify(team.key, '같은 팀의 개인 초안도 학생별로 분리', da.userId === team.a && db.userId === team.b && da.code === team.codeA && db.code === team.codeB && da.code !== db.code);
  const listA = (await request(team, team.a, '/drafts/list')).data.drafts;
  verify(team.key, '내 초안 목록은 동료 개인 초안을 포함하지 않음', listA.every(draft => draft.userId === team.a) && !listA.some(draft => draft.userId === team.b));
  const issue = (await request(team, team.a, '/issues', { method: 'POST', expected: 201, body: { title: `${team.title}: 바꿀 값과 고정 조건`, body: `${team.problem}\n작성자/검토자 교대: A 첫 제안, B 검토; 다음 B 제안, A 검토.\n가설·조건 비교·도움 축소를 수업에서 확인합니다.` } })).data.issue;
  team.issue = issue;
  const proposal = (await request(team, team.a, '/proposals', { method: 'POST', expected: 201, body: { title: 'A의 첫 작은 변경', code: team.codeA, baseVersion: team.initialVersion, evidence: evidence('첫 변경') } })).data.proposal;
  await request(team, team.a, `/proposals/${proposal.id}/reviews`, { method: 'POST', expected: 403, body: { decision: 'approve', comment: '자기 승인은 거절되어야 합니다.' } });
  await request(team, team.a, `/proposals/${proposal.id}/merge`, { method: 'POST', expected: 403, body: {} });
  await request(team, team.b, `/proposals/${proposal.id}/reviews`, { method: 'POST', expected: 201, body: { decision: 'request_changes', comment: '바꾼 값 하나와 고정한 조건을 분리해 설명하고, 비교할 두 번째 조건을 추가해주세요.' } });
  await request(team, team.a, `/proposals/${proposal.id}/merge`, { method: 'POST', expected: 403, body: {} });
  await request(team, team.a, `/proposals/${proposal.id}`, { method: 'PATCH', expected: 404, body: { code: team.codeA2 }, classification: 'gap', name: '기존 제안의 코드 수정 API가 없어 새 제안이 필요함' });
  const revised = (await request(team, team.a, '/proposals', { method: 'POST', expected: 201, body: { title: `A 보완안 · 이전 ${proposal.id}`, code: team.codeA2, baseVersion: team.initialVersion, evidence: evidence('보완 변경', { reasoning: `이전 제안 ${proposal.id}의 B 질문에 답합니다. 바꾼 값과 고정값을 분리했습니다. 이는 수동 연결이며 supersedes 필드는 없습니다.` }) } })).data.proposal;
  await request(team, team.b, `/proposals/${revised.id}/reviews`, { method: 'POST', expected: 201, body: { decision: 'approve', comment: `이전 ${proposal.id}의 질문과 보완 설명을 비교했습니다. 실제 수업에서는 제안 코드의 두 조건 실행을 확인하고 승인합니다.` } });
  const mergeKey = randomUUID();
  const merged = await request(team, team.a, `/proposals/${revised.id}/merge`, { method: 'POST', body: {}, key: mergeKey });
  const repeated = await request(team, team.a, `/proposals/${revised.id}/merge`, { method: 'POST', body: {}, key: mergeKey });
  verify(team.key, '병합 응답 재전송은 새 버전이나 중복 병합을 만들지 않음', repeated.replayed && repeated.data.checkpoint.id === merged.data.checkpoint.id && repeated.data.checkpoint.version === merged.data.checkpoint.version);
  await request(team, team.b, '/proposals', { method: 'POST', expected: 409, body: { title: 'B의 오래된 기준 제안', code: team.codeB, baseVersion: team.initialVersion, evidence: evidence('오래된 초안') } });
  const preservedB = (await request(team, team.b, `/drafts?clientId=${secondDraft.clientId}`)).data.draft;
  verify(team.key, '기준 충돌 뒤에도 B의 개인 초안과 원래 기준 보존', preservedB.code === team.codeB && preservedB.baseVersion === team.initialVersion);
  team.combinedCode = team.merge(team.codeA2);
  await request(team, team.b, '/drafts', { method: 'PUT', body: { ...secondDraft, code: team.combinedCode, baseVersion: merged.data.checkpoint.version, clientSequence: 2 } });
  const roleSwap = (await request(team, team.b, '/proposals', { method: 'POST', expected: 201, body: { title: 'B의 통합 변경 · A의 반영 내용을 유지', code: team.combinedCode, baseVersion: merged.data.checkpoint.version, evidence: evidence('역할 교대', { reasoning: `A 보완 제안 ${revised.id}의 변경을 지키면서 B 값을 합쳤습니다.` }) } })).data.proposal;
  await request(team, team.a, `/proposals/${roleSwap.id}/reviews`, { method: 'POST', expected: 201, body: { decision: 'approve', comment: '내 반영 내용이 남아 있고 B의 한 조건 변경이 구분됩니다. 다음 수업에서 전후 결과 설명을 확인합니다.' } });
  const finalMerge = await request(team, team.b, `/proposals/${roleSwap.id}/merge`, { method: 'POST', body: {} });
  team.finalCheckpointId = finalMerge.data.checkpoint.id;
  team.finalVersion = finalMerge.data.checkpoint.version;
  team.oldProposalId = proposal.id;
  const detail = (await request(team, teacher, '')).data;
  verify(team.key, '역할 교대 후 두 학생의 체크포인트·리뷰 작성자 구분', [team.a, team.b].every(actor => detail.checkpoints.some(item => item.authorId === actor) && detail.reviews.some(item => item.authorId === actor)));
  verify(team.key, '두 작은 변경이 함께 반영되고 v0 출발 코드는 유지', detail.project.code === team.combinedCode && detail.checkpoints.find(item => item.version === 0)?.code === team.code && detail.project.version === team.initialVersion + 2);
  if (team.key === 'remix') verify(team.key, '공개 원문과 교사 호환성 체크포인트를 학생 기여와 구분', detail.checkpoints.find(item => item.id === team.rawCheckpointId)?.code === originalRemix && detail.checkpoints.find(item => item.id === team.compatibilityCheckpointId)?.code === compatibilityRemix && detail.checkpoints.filter(item => [team.rawCheckpointId, team.compatibilityCheckpointId].includes(item.id)).every(item => item.authorId === teacher));
  const ownA = (await request(team, teacher, `/student-evidence/${team.a}`)).data;
  const ownB = (await request(team, teacher, `/student-evidence/${team.b}`)).data;
  verify(team.key, '학생별 로컬 체크포인트·리뷰 근거가 실제 존재하고 해당 작성자의 상세 이력과 정확히 일치', [
    [ownA, team.a], [ownB, team.b],
  ].every(([own, actor]) => own.checkpoints.length > 0 && own.reviews.length > 0 && isDeepStrictEqual(own.checkpoints, detail.checkpoints.filter(item => item.authorId === actor)) && isDeepStrictEqual(own.reviews, detail.reviews.filter(item => item.authorId === actor))));
  await request(team, team.b, `/student-evidence/${team.a}`, { expected: 403 });
  const exported = (await request(team, teacher, '/export')).data;
  verify(team.key, '내보내기는 출처와 체크포인트·제안·리뷰의 ID·작성자·본문·버전을 전체 보존', exported.schemaVersion === 2 && isDeepStrictEqual(exported.project.source, team.source) && exported.proposals.length === 3 && exported.reviews.length === 3 && isDeepStrictEqual(exported.checkpoints, detail.checkpoints) && isDeepStrictEqual(exported.proposals, detail.proposals) && isDeepStrictEqual(exported.reviews, detail.reviews) && exported.checkpoints.some(item => item.version === 0 && item.code === team.code));
  if (team.key === 'remix') verify(team.key, '내보낸 리믹스 v1 원문·v2 교사 호환성 코드와 수동 출처 본문을 정확히 보존', exported.project.source === null && exported.project.problem === remixProblem && exported.checkpoints.some(item => item.id === team.rawCheckpointId && item.version === 1 && item.code === originalRemix && item.authorId === teacher) && exported.checkpoints.some(item => item.id === team.compatibilityCheckpointId && item.version === 2 && item.code === compatibilityRemix && item.authorId === teacher));
}

async function githubAndFeedback(team) {
  const issueJob = (await request(team, team.a, '/github/issues', { method: 'POST', expected: 202, body: { issueId: team.issue.id, title: team.issue.title, body: team.issue.body } })).data.job;
  const issueResult = await drain(issueJob.id);
  verify(team.key, '등록된 질문을 모의 GitHub Issue로 처리', issueResult.state === 'succeeded' && issueResult.result?.simulated === true);
  const pullJob = (await request(team, team.b, '/github/proposals', { method: 'POST', expected: 202, body: { code: team.combinedCode, title: `${team.title}: 검토한 팀 확정 버전`, baseSha: team.remoteSha, checkpointId: team.finalCheckpointId } })).data.job;
  const pullResult = await drain(pullJob.id);
  verify(team.key, '최신 팀 체크포인트를 모의 PR과 연결', pullResult.state === 'succeeded' && pullResult.result?.simulated === true && store.getJobs(team.projectId).find(item => item.id === pullJob.id).payload.checkpointId === team.finalCheckpointId);
  await request(team, teacher, '/github/learning/sync', { method: 'POST', body: {} });
  const learning = (await request(team, teacher, '/learning')).data;
  const issueEvent = learning.events.find(item => item.kind === 'issue' && item.metadata?.jobId === issueJob.id);
  const pullEvent = learning.events.find(item => item.kind === 'pull_request' && item.metadata?.jobId === pullJob.id);
  verify(team.key, '합성 GitHub 작성자를 추정하지 않고 실제 서버 제출 요청자를 귀속', issueEvent?.requestedByUserId === team.a && pullEvent?.requestedByUserId === team.b && issueEvent.source === 'simulator' && pullEvent.source === 'simulator' && issueEvent.authorUserId === null && pullEvent.authorUserId === null);
  const studentLearning = (await request(team, team.a, '/learning')).data;
  verify(team.key, '학생의 학습 요약은 자기 학생 항목만 반환', studentLearning.students.length === 1 && studentLearning.students[0].userId === team.a);
  const ownA = (await request(team, teacher, `/student-evidence/${team.a}`)).data;
  const ownB = (await request(team, teacher, `/student-evidence/${team.b}`)).data;
  verify(team.key, '모의 Issue·PR의 요청자에 따라 학생별 근거를 분리', ownA.events.some(item => item.id === issueEvent.id) && !ownA.events.some(item => item.id === pullEvent.id) && ownB.events.some(item => item.id === pullEvent.id) && !ownB.events.some(item => item.id === issueEvent.id));
  await request(team, teacher, '/feedback', { method: 'POST', expected: 422, body: { studentId: team.a, comment: '로컬 제안 ID를 근거로 선택 시도', visibility: 'student', evidenceIds: [team.oldProposalId] }, classification: 'gap', name: '교사 evidenceIds는 로컬 제안 ID를 지원하지 않음(422)' });
  team.feedback = {};
  for (const visibility of ['private', 'student', 'team']) {
    const result = await request(team, teacher, '/feedback', { method: 'POST', expected: 201, body: { ...(visibility !== 'team' ? { studentId: team.a } : {}), comment: `${team.key}-${visibility}-${runId}: 근거와 다음 질문. 실제 학생 학습 관찰 아님.`, visibility, evidenceIds: [issueEvent.id], criteria: { reasoning: '설명과 실제 실행은 후속 학생 파일럿에서 확인' } } });
    team.feedback[visibility] = result.data.feedback.id;
    verify(team.key, `${visibility} 교사 기록이 모의 GitHub 근거 스냅샷을 보존`, result.data.feedback.evidence?.some(item => item.id === issueEvent.id));
  }
  for (const actor of [teacher, team.a, team.b]) {
    for (const suffix of ['', '/export', '/learning']) {
      const payload = (await request(team, actor, suffix)).data;
      const text = JSON.stringify(payload);
      verify(team.key, `${actor} ${suffix || '/detail'} 공개 범위별 응답 필터`, (actor === teacher ? text.includes(team.feedback.private) : !text.includes(team.feedback.private)) && (actor === teacher || actor === team.a ? text.includes(team.feedback.student) : !text.includes(team.feedback.student)) && text.includes(team.feedback.team));
    }
  }
  const updated = report.teams.find(item => item.key === team.key);
  Object.assign(updated, { finalVersion: team.finalVersion, finalCheckpointId: team.finalCheckpointId, finalCodeSha256: hash(team.combinedCode), issueId: team.issue.id, feedbackIds: team.feedback, simulatorIssueJobId: issueJob.id, simulatorPullJobId: pullJob.id, simulatorEvidenceIds: [issueEvent.id, pullEvent.id], localProposalCount: 3, localReviewCount: 3 });
}

async function isolation() {
  for (const team of teams) {
    for (const actor of [team.a, team.b]) {
      const projects = (await api(actor, '/projects', { scope: team.key })).data.projects;
      verify(team.key, `${actor} 프로젝트 목록에 다른 팀·기본 DEMO 프로젝트 없음`, projects.length === 1 && projects[0].id === team.projectId);
      for (const other of teams.filter(item => item.key !== team.key)) {
        for (const suffix of ['', '/drafts/list', '/learning', `/student-evidence/${other.a}`, '/export']) await api(actor, `/projects/${other.projectId}${suffix}`, { scope: 'cross-team', expected: 403, name: `${actor} → ${other.key}${suffix || '/detail'} 접근 차단` });
      }
    }
    const members = (await request(team, team.a, '')).data.members;
    verify(team.key, '팀 구성원은 해당 학생 둘과 초대받은 교사뿐', members.length === 3 && [teacher, team.a, team.b].every(actor => members.some(item => item.id === actor)));
  }
}

async function gapProbes() {
  const createProbe = async label => {
    const created = (await api('creative-a', '/projects', { method: 'POST', scope: 'gap-probe', expected: 201, body: { title: `독립 우회 검사 ${label}`, code: 'from vpython import *\nball = sphere()\n', aiPolicy: 'disabled' } })).data.project;
    for (const actor of ['creative-b', teacher]) await api(actor, '/projects/join', { method: 'POST', scope: 'gap-probe', body: { inviteCode: created.inviteCode } });
    return { key: 'gap-probe', projectId: created.id };
  };
  const empty = await createProbe('빈 검토');
  const emptyProposal = (await request(empty, 'creative-a', '/proposals', { method: 'POST', expected: 201, body: { title: '빈 검토가 가능한가', code: 'sphere(radius=0.7)', baseVersion: 0, evidence: {} } })).data.proposal;
  await request(empty, 'creative-b', `/proposals/${emptyProposal.id}/reviews`, { method: 'POST', expected: 201, body: { decision: 'approve', comment: '' }, classification: 'gap', name: '실행 근거나 의견 없는 빈 승인도 허용됨' });
  const direct = await createProbe('직접 팀 저장');
  await request(direct, 'creative-b', '/checkpoints', { method: 'POST', expected: 201, body: { code: 'sphere(radius=0.8)', baseVersion: 0, message: '편집자의 동료 승인 없는 팀 저장', evidence: {} }, classification: 'gap', name: 'editor는 제안·승인 없이 직접 팀 체크포인트를 저장할 수 있음' });
  const teacherOverride = await createProbe('교사 직접 반영');
  const teacherProposal = (await request(teacherOverride, 'creative-a', '/proposals', { method: 'POST', expected: 201, body: { title: '미승인 제안', code: 'sphere(radius=0.9)', baseVersion: 0, evidence: {} } })).data.proposal;
  await request(teacherOverride, teacher, `/proposals/${teacherProposal.id}/merge`, { method: 'POST', body: {}, classification: 'gap', name: '교사는 동료 승인 없이 미승인 학생 제안을 반영할 수 있음(설계된 예외)' });
  const privateCode = await createProbe('체크포인트 없는 외부 제안');
  const fetched = (await request(privateCode, 'creative-a', '/github/fetch', { method: 'POST', body: {} })).data;
  await request(privateCode, 'creative-a', '/github/proposals', { method: 'POST', expected: 409, body: { code: 'print("확정되지 않은 합성 개인 코드")', title: 'checkpointId 없이 임의 코드 전송 시도', baseSha: fetched.remote.sha }, name: 'GitHub PR API는 checkpointId 없는 개인 코드 전송을 거부함' });
}

async function restartAndBackup() {
  const before = {};
  for (const team of teams) before[team.key] = (await request(team, teacher, '/export')).data;
  await close();
  await start();
  for (const team of teams) {
    const after = (await request(team, teacher, '/export')).data;
    verify(team.key, 'DB 재시작 후 출처·코드·버전·제안·리뷰·교사 기록 보존', JSON.stringify(after.project) === JSON.stringify(before[team.key].project) && JSON.stringify(after.checkpoints) === JSON.stringify(before[team.key].checkpoints) && JSON.stringify(after.proposals) === JSON.stringify(before[team.key].proposals) && JSON.stringify(after.reviews) === JSON.stringify(before[team.key].reviews) && JSON.stringify(after.feedback) === JSON.stringify(before[team.key].feedback));
    const draft = (await request(team, team.b, `/drafts?clientId=${team.key}-window-b`)).data.draft;
    verify(team.key, '재시작 후 통합한 B 초안과 기준 버전 보존', draft.code === team.combinedCode && draft.clientSequence === 2 && draft.baseVersion === team.finalVersion - 1);
    const own = (await request(team, team.a, '/learning')).data;
    verify(team.key, '재시작 후 학생 피드백 공개 범위 유지', JSON.stringify(own).includes(team.feedback.student) && !JSON.stringify(own).includes(team.feedback.private));
  }
  const backup = await rehearseRestore(database);
  verify('recovery', '독립 DB 백업·임시 복구·쓰기·내용 지문 일치', backup.ok === true && backup.temporaryRestoreOnly === true && backup.cleanedUp === true);
  report.backup = backup;
}

try {
  await start();
  const health = await api(teacher, '/health');
  verify('shared', '테스트 서버는 로컬 SQLite와 명시 simulator', health.data.localMode === true && health.data.githubMode === 'simulator' && health.data.storage === 'sqlite');
  verify('shared', '추가한 학생은 지정한 합성 6명뿐', actors.length === 7 && store.users().length === DEMO_USERS.length + 6);
  for (const team of teams) { await createTeam(team); await collaborationPath(team); await githubAndFeedback(team); process.stdout.write(`${team.key}: 협업·권한·모의 GitHub·교사 피드백 경로 완료\n`); }
  await isolation();
  await gapProbes();
  await restartAndBackup();
  verify('sources', '공개 원문·라이선스 파일을 변경하지 않음', hash(readFileSync(sourceFile)) === report.source.remix.codeSha256 && hash(readFileSync(licenseFile)) === report.source.remix.licenseSha256);
  verify('network', '외부 네트워크 요청·토큰 읽기·운영 서비스 변경 없음', report.externalAttempts === 0);
  report.completedAt = new Date().toISOString();
  report.outcome = 'completed_with_explicit_product_gaps';
} catch (error) {
  report.outcome = 'failed';
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  await close();
  report.closedAt = new Date().toISOString();
  persist();
  process.stdout.write(JSON.stringify({ outcome: report.outcome, ...report.counts, externalAttempts: report.externalAttempts, reportPath, database }, null, 2) + '\n');
  if (report.failure) process.stderr.write(report.failure.stack + '\n');
}
