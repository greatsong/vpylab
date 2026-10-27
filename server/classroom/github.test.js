import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createStore } from './store.js';
import { createClassroomApp } from './app.js';
import { classifyGitHubResponse, createAppJwt, createGitHubService, verifyGitHubSignature } from './github.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const teacher = { id: 'teacher', name: '선생님', role: 'teacher' };
const student = { id: 'student-a', name: '학생 가', role: 'student' };
const BASE = 'a'.repeat(40), NEXT = 'b'.repeat(40), COMMIT = 'c'.repeat(40);
const repository = { key: 'class-team', owner: 'classroom', repo: 'team-one', installationId: 123, repositoryId: 456, branch: 'main', path: 'main.py' };
const reply = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const signature = (body, secret = 'test-secret') => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

function fixture({ mode = 'simulator', filename = ':memory:', mock } = {}) {
  const store = createStore({ filename, localMode: true });
  const project = store.listProjects(teacher)[0];
  let clock = Date.now() + 1000;
  const config = { mode, repositories: [repository], appId: 'Iv1.test', privateKey, webhookSecret: 'test-secret' };
  const service = createGitHubService({ store, localMode: true, config, fetchImpl: mock?.fetch, now: () => clock, pause: async delay => { clock += delay; } });
  return { store, service, project, config, now: () => clock, advance: delay => { clock += delay; } };
}

function githubMock({ remoteSha = BASE, remoteCode = 'print("GitHub 최신")', privateRepository = true, losePullResponse = false, loseIssueResponse = false } = {}) {
  const calls = [], branches = new Map(), pulls = [], issues = [], files = new Map([[remoteSha, remoteCode]]);
  let failure = null;
  const state = { remoteSha, remoteCode, privateRepository, calls, branches, pulls, issues, failNext(predicate, response) { failure = { predicate, response }; } };
  state.fetch = async (url, options) => {
    const parsedUrl = new URL(url), path = parsedUrl.pathname, method = options.method, body = options.body ? JSON.parse(options.body) : null;
    const call = { path, method, body, query: parsedUrl.searchParams, headers: options.headers }; calls.push(call);
    if (failure?.predicate(call)) { const response = failure.response; failure = null; return response; }
    if (path === '/app/installations/123/access_tokens') return reply({ token: 'server-memory-only-test-token', expires_at: new Date(Date.now() + 3_600_000).toISOString() }, 201);
    if (method === 'GET' && path === '/repos/classroom/team-one') return reply({ id: 456, name: 'team-one', owner: { login: 'classroom' }, private: state.privateRepository });
    const root = '/repos/classroom/team-one';
    if (method === 'GET' && path === `${root}/git/ref/heads/main`) return reply({ object: { sha: state.remoteSha } });
    if (method === 'GET' && path.startsWith(`${root}/contents/`)) {
      const ref = parsedUrl.searchParams.get('ref');
      const code = files.get(ref) ?? (ref === state.remoteSha ? state.remoteCode : null);
      if (code === null) return reply({}, 404);
      return reply({ type: 'file', encoding: 'base64', content: Buffer.from(code).toString('base64'), size: Buffer.byteLength(code), sha: 'd'.repeat(40) });
    }
    if (method === 'GET' && path === `${root}/pulls`) return reply(pulls);
    if (method === 'GET' && path.startsWith(`${root}/git/ref/heads/vpylab/`)) {
      const branch = path.slice(`${root}/git/ref/heads/`.length);
      return branches.has(branch) ? reply({ object: { sha: branches.get(branch) } }) : reply({}, 404);
    }
    if (method === 'GET' && path.startsWith(`${root}/git/commits/`)) return reply({ tree: { sha: 'e'.repeat(40) }, parents: [{ sha: BASE }] });
    if (method === 'POST' && path === `${root}/git/trees`) { files.set(COMMIT, body.tree[0].content); return reply({ sha: 'f'.repeat(40) }, 201); }
    if (method === 'POST' && path === `${root}/git/commits`) return reply({ sha: COMMIT }, 201);
    if (method === 'POST' && path === `${root}/git/refs`) {
      const branch = body.ref.slice('refs/heads/'.length);
      if (branches.has(branch)) return reply({}, 422);
      branches.set(branch, body.sha); return reply({ object: { sha: body.sha } }, 201);
    }
    if (method === 'POST' && path === `${root}/pulls`) {
      const pull = { number: pulls.length + 1, html_url: 'https://github.com/classroom/team-one/pull/1', state: 'open', head: { sha: COMMIT } }; pulls.push(pull);
      if (losePullResponse) { losePullResponse = false; throw new Error('모의 응답 유실'); }
      return reply(pull, 201);
    }
    if (method === 'POST' && path === `${root}/issues`) {
      const issue = { number: 3, html_url: 'https://github.com/classroom/team-one/issues/3', body: body.body }; issues.push(issue);
      if (loseIssueResponse) { loseIssueResponse = false; throw new Error('모의 Issue 응답 유실'); }
      return reply(issue, 201);
    }
    if (method === 'GET' && path === `${root}/issues/3`) return reply(issues[0] || { number: 3, body: '다른 Issue' });
    throw new Error(`예상하지 않은 모의 API: ${method} ${path}`);
  };
  return state;
}

async function setupLive(mock = githubMock()) {
  const f = fixture({ mode: 'live', mock });
  f.service.bind(f.project.id, teacher, repository.key);
  await f.service.fetchRemote(f.project.id, teacher);
  return { ...f, mock };
}

function proposalInput(remote, overrides = {}) { return { code: 'print("제안")', title: '가설을 검증하는 변경', message: '속도 조건을 바꾸고 관찰했습니다.', baseSha: remote.sha, ...overrides }; }

test('GitHub App JWT는 RS256으로 서명하고 짧은 만료와 시계 오차를 반영한다', () => {
  const now = Date.now(), jwt = createAppJwt({ appId: 'Iv1.classroom', privateKey, now });
  const [header, payload, signed] = jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'RS256');
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(claims.iss, 'Iv1.classroom'); assert.equal(claims.iat, Math.floor(now / 1000) - 60);
  assert.ok(claims.exp <= Math.floor(now / 1000) + 600);
  assert.ok(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signed, 'base64url')));
});

test('공식 Webhook HMAC 예제를 검증하고 변조·누락·잘못된 길이를 거부한다', () => {
  const body = Buffer.from('Hello, World!');
  assert.ok(verifyGitHubSignature(body, 'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17', "It's a Secret to Everybody"));
  assert.equal(verifyGitHubSignature(Buffer.from('변조'), signature(body), 'test-secret'), false);
  assert.equal(verifyGitHubSignature(body, 'sha256=aa', 'test-secret'), false);
  assert.equal(verifyGitHubSignature(body, signature(body), ''), false);
});

test('로컬 저장·GitHub 제안은 분리되며 모의 PR은 기본 브랜치를 바꾸지 않는다', async t => {
  const { store, service, project } = fixture(); t.after(() => store.close());
  const original = service.status(project.id, teacher).remote;
  store.saveCheckpoint(project.id, student, { baseVersion: project.version, code: '새 팀 저장본', message: '관찰 결과' });
  const saved = await service.runOnce(); assert.equal(saved.state, 'succeeded'); assert.equal(saved.result.localOnly, true);
  const input = proposalInput(original), first = service.enqueueProposal(project.id, student, input);
  assert.equal(service.enqueueProposal(project.id, student, input).id, first.id);
  const result = await service.runOnce(); assert.equal(result.state, 'succeeded'); assert.equal(result.result.simulated, true);
  assert.equal(service.status(project.id, teacher).remote.sha, original.sha);
  assert.equal(store.getProject(project.id).code, '새 팀 저장본');
  assert.equal(service.status(project.id, teacher).simulatedPulls.length, 1);
  assert.equal(await service.runOnce(), null);
});

test('제안 대기 중 외부 커밋이 생기면 덮어쓰지 않고 충돌로 중지한다', async t => {
  const { store, service, project } = fixture(); t.after(() => store.close());
  const remote = service.status(project.id, teacher).remote;
  service.enqueueProposal(project.id, student, proposalInput(remote));
  service.simulatePush(project.id, teacher, { baseSha: remote.sha, code: '팀원의 외부 변경' });
  const result = await service.runOnce(); assert.equal(result.state, 'blocked'); assert.match(result.lastError, /^github_base_conflict:/);
  assert.equal(service.status(project.id, teacher).remote.code, '팀원의 외부 변경');
  assert.equal(service.status(project.id, teacher).simulatedPulls.length, 0);
});

test('서버 allowlist·역할·저장소 식별자로 repository binding을 제한한다', async t => {
  const f = await setupLive(); t.after(() => f.store.close());
  assert.throws(() => f.service.bind(f.project.id, teacher, 'attacker/private'), { code: 'repository_not_allowed' });
  assert.throws(() => f.service.bind(f.project.id, student, repository.key), { code: 'access_denied' });
  f.store.addMember(f.project.id, teacher, student.id, 'viewer');
  assert.throws(() => f.service.enqueueProposal(f.project.id, student, proposalInput(f.service.status(f.project.id, teacher).remote)), { code: 'access_denied' });
  const state = f.store.getGithub(f.project.id); f.store.setGithub(f.project.id, { ...state, binding: { ...state.binding, repositoryId: 999 } });
  assert.throws(() => f.service.enqueueProposal(f.project.id, teacher, proposalInput(state.remote)), { code: 'repository_binding_required' });
});

test('외부 GitHub 코드는 비교본으로 가져오고 팀 저장본을 보존한다', async t => {
  const f = await setupLive(); t.after(() => f.store.close());
  const original = f.store.getProject(f.project.id).code;
  f.mock.remoteSha = NEXT; f.mock.remoteCode = 'print("GitHub 직접 수정")';
  const status = await f.service.fetchRemote(f.project.id, student);
  assert.equal(status.remote.sha, NEXT); assert.equal(status.remote.code, 'print("GitHub 직접 수정")');
  assert.equal(f.store.getProject(f.project.id).code, original);
  const tokenCall = f.mock.calls.find(call => call.path.includes('/access_tokens'));
  assert.deepEqual(tokenCall.body, { repository_ids: [456], permissions: { contents: 'write', issues: 'write', pull_requests: 'write' } });
  assert.equal(JSON.stringify(status).includes('server-memory-only-test-token'), false);
  assert.equal(JSON.stringify(f.store.getGithub(f.project.id)).includes('privateKey'), false);
});

test('실제 어댑터는 새 브랜치와 PR만 생성하고 main ref를 PATCH하지 않는다', async t => {
  const f = await setupLive(); t.after(() => f.store.close());
  f.service.enqueueProposal(f.project.id, student, proposalInput(f.service.status(f.project.id, teacher).remote));
  const result = await f.service.runOnce();
  assert.equal(result.state, 'succeeded'); assert.equal(result.result.number, 1);
  assert.equal(f.mock.pulls.length, 1); assert.equal(f.mock.remoteSha, BASE);
  assert.ok(f.mock.calls.filter(call => call.path.endsWith('/git/refs')).every(call => call.body.ref.startsWith('refs/heads/vpylab/proposal-')));
  assert.equal(f.mock.calls.some(call => ['PATCH', 'PUT', 'DELETE'].includes(call.method)), false);
  assert.equal(f.mock.calls.find(call => call.method === 'POST' && call.path.endsWith('/git/trees')).body.base_tree, 'e'.repeat(40));
  assert.deepEqual(f.mock.calls.find(call => call.method === 'POST' && call.path.endsWith('/git/commits')).body.parents, [BASE]);
});

test('원격 기준 SHA가 바뀌면 Git 데이터 쓰기 전에 실제 어댑터가 중지한다', async t => {
  const f = await setupLive(); t.after(() => f.store.close());
  f.service.enqueueProposal(f.project.id, student, proposalInput(f.service.status(f.project.id, teacher).remote));
  f.mock.remoteSha = NEXT;
  const result = await f.service.runOnce(); assert.equal(result.state, 'blocked'); assert.match(result.lastError, /^github_base_conflict:/);
  assert.equal(f.mock.calls.some(call => call.method === 'POST' && /\/(git|pulls)\//.test(call.path)), false);
});

test('PR 생성 응답 유실 후 재시도는 기존 PR을 찾아 중복 없이 복구한다', async t => {
  const mock = githubMock({ losePullResponse: true }), f = await setupLive(mock); t.after(() => f.store.close());
  f.service.enqueueProposal(f.project.id, student, proposalInput(f.service.status(f.project.id, teacher).remote));
  const first = await f.service.runOnce(); assert.equal(first.state, 'pending'); assert.equal(mock.pulls.length, 1);
  f.advance(61_000); const second = await f.service.runOnce();
  assert.equal(second.state, 'succeeded'); assert.equal(second.result.number, 1);
  assert.equal(mock.calls.filter(call => call.method === 'POST' && call.path.endsWith('/pulls')).length, 1);
});

test('rate limit는 Retry-After·reset·secondary-limit에 맞춰 인증 실패와 구분한다', () => {
  const now = Date.now();
  assert.equal(classifyGitHubResponse(reply({}, 429, { 'retry-after': '120' }), now).retryAt, now + 120_000);
  const reset = Math.floor(now / 1000) + 300;
  assert.equal(classifyGitHubResponse(reply({}, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }), now).retryAt, reset * 1000 + 1000);
  assert.equal(classifyGitHubResponse(reply({}, 403), now, { message: 'You have exceeded a secondary rate limit' }).code, 'rate_limited');
  assert.equal(classifyGitHubResponse(reply({}, 403), now).code, 'github_auth_required');
  assert.equal(classifyGitHubResponse(reply({}, 401), now).permanent, true);
});

test('outbox는 제한 해제 전 재호출하지 않고 대기 후 복구한다', async t => {
  const f = await setupLive(); t.after(() => f.store.close());
  f.service.enqueueProposal(f.project.id, student, proposalInput(f.service.status(f.project.id, teacher).remote));
  f.mock.failNext(call => call.path === '/repos/classroom/team-one', reply({}, 429, { 'retry-after': '120' }));
  const failedAt = f.now(), first = await f.service.runOnce();
  assert.equal(first.state, 'pending'); assert.match(first.lastError, /^rate_limited:/); assert.equal(Date.parse(first.availableAt), failedAt + 120_000);
  const count = f.mock.calls.length; assert.equal(await f.service.runOnce(), null); assert.equal(f.mock.calls.length, count);
  f.advance(120_001); const final = await f.service.runOnce(); assert.equal(final.state, 'succeeded');
});

test('GitHub 인증 장애는 교사 조치 대기로 멈추고 학생 저장은 계속된다', async t => {
  const f = await setupLive(); t.after(() => f.store.close());
  f.service.enqueueProposal(f.project.id, student, proposalInput(f.service.status(f.project.id, teacher).remote));
  f.mock.failNext(call => call.path === '/repos/classroom/team-one', reply({}, 401));
  const result = await f.service.runOnce(); assert.equal(result.state, 'blocked'); assert.match(result.lastError, /^github_auth_required:/);
  f.store.saveCheckpoint(f.project.id, student, { baseVersion: 0, code: '장애 중에도 보존', message: '가설 기록' });
  const checkpoint = await f.service.runOnce(); assert.equal(checkpoint.state, 'succeeded'); assert.equal(f.store.getProject(f.project.id).code, '장애 중에도 보존');
});

test('서버 재시작 후에도 pending outbox와 모의 저장소가 복구된다', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'vpylab-github-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = join(directory, 'classroom.sqlite'), first = fixture({ filename });
  const remote = first.service.status(first.project.id, teacher).remote;
  const job = first.service.enqueueProposal(first.project.id, student, proposalInput(remote)); first.store.close();
  const second = fixture({ filename }); t.after(() => second.store.close());
  const result = await second.service.runOnce(); assert.equal(result.id, job.id); assert.equal(result.state, 'succeeded');
  assert.equal(second.service.status(first.project.id, teacher).simulatedPulls.length, 1);
});

test('Webhook은 서명 확인 후 연결된 저장소·설치·브랜치만 갱신하고 전송 ID를 중복 처리하지 않는다', async t => {
  const f = await setupLive(); t.after(() => f.store.close());
  const body = Buffer.from(JSON.stringify({ repository: { id: 456 }, installation: { id: 123 }, ref: 'refs/heads/main' }));
  const headers = { 'x-github-delivery': 'delivery-1', 'x-github-event': 'push', 'x-hub-signature-256': signature(body) };
  assert.throws(() => f.service.webhook(body, { ...headers, 'x-hub-signature-256': 'sha256=aa' }), { code: 'invalid_webhook_signature' });
  const first = f.service.webhook(body, headers); assert.equal(first.matched, 1); assert.equal(first.duplicate, false);
  assert.equal(f.service.webhook(body, headers).duplicate, true);
  assert.equal(f.store.getGithub(f.project.id).remote.stale, true);
  const modified = Buffer.from(JSON.stringify({ repository: { id: 999 }, installation: { id: 123 }, ref: 'refs/heads/main' }));
  assert.throws(() => f.service.webhook(modified, { ...headers, 'x-hub-signature-256': signature(modified) }), { code: 'webhook_delivery_conflict' });
  assert.equal(f.service.webhook(modified, { ...headers, 'x-github-delivery': 'delivery-2', 'x-hub-signature-256': signature(modified) }).matched, 0);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS total FROM github_webhook_deliveries').get().total, 2);
});

test('기본 설정은 simulator가 명확하며 운영에서는 simulator를 허용하지 않는다', t => {
  const store = createStore({ localMode: true }); t.after(() => store.close());
  assert.equal(createGitHubService({ store, localMode: true, config: {} }).mode, 'simulator');
  assert.equal(createGitHubService({ store, localMode: false, config: {} }).mode, 'offline');
  assert.throws(() => createGitHubService({ store, localMode: false, config: { mode: 'simulator' } }));
});

test('비공개 기본 정책과 50KB 한도를 적용한다', async t => {
  const mock = githubMock({ privateRepository: false }), f = fixture({ mode: 'live', mock }); t.after(() => f.store.close());
  f.service.bind(f.project.id, teacher, repository.key);
  await assert.rejects(f.service.fetchRemote(f.project.id, teacher), { code: 'private_repository_required' });
  const sim = fixture(); t.after(() => sim.store.close());
  assert.throws(() => sim.service.enqueueProposal(sim.project.id, student, proposalInput(sim.service.status(sim.project.id, teacher).remote, { code: 'x'.repeat(51 * 1024) })), { code: 'invalid_github_proposal' });
});

test('HTTP 경로는 세션 권한을 검사하고 원본 Webhook 본문을 CSRF 전에 검증한다', async t => {
  const f = fixture();
  const { app } = createClassroomApp({ store: f.store, localMode: true, githubService: f.service });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); f.store.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`, base = `${origin}/api/v2`;
  const unauthenticated = await fetch(`${base}/projects/${f.project.id}/github`); assert.equal(unauthenticated.status, 401);
  const login = await fetch(`${base}/session/local`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ userId: student.id }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const statusResponse = await fetch(`${base}/projects/${f.project.id}/github`, { headers: { cookie } });
  const status = await statusResponse.json(); assert.equal(status.mode, 'simulator');
  const queued = await fetch(`${base}/projects/${f.project.id}/github/proposals`, { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body: JSON.stringify(proposalInput(status.remote)) });
  assert.equal(queued.status, 202); assert.equal((await queued.json()).job.state, 'pending');
  const raw = Buffer.from('{"zen":"학생의 새 가설"}');
  const delivered = await fetch(`${base}/github/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-github-delivery': 'http-test', 'x-github-event': 'ping', 'x-hub-signature-256': signature(raw) }, body: raw });
  assert.equal(delivered.status, 202); assert.equal((await delivered.json()).accepted, true);
  const modified = await fetch(`${base}/github/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-github-delivery': 'http-test-bad', 'x-github-event': 'ping', 'x-hub-signature-256': signature(raw) }, body: Buffer.from('{}') });
  assert.equal(modified.status, 401);
});

test('Issue 응답 유실은 중복 생성 없이 중지하고 교사가 실제 작업 표식으로 복구한다', async t => {
  const mock = githubMock({ loseIssueResponse: true }), f = await setupLive(mock); t.after(() => f.store.close());
  const issue = f.store.addIssue(f.project.id, student, { title: '마찰을 포함하면?', body: '현재 가설을 검증할 다음 실험입니다.' });
  assert.throws(() => f.service.enqueueIssue(f.project.id, student, { issueId: issue.id, title: '조작한 제목', body: issue.body }), { code: 'issue_binding_mismatch' });
  const job = f.service.enqueueIssue(f.project.id, student, { issueId: issue.id, title: issue.title, body: issue.body });
  const result = await f.service.runOnce(); assert.equal(result.state, 'blocked'); assert.equal(mock.issues.length, 1);
  assert.throws(() => f.service.retry(f.project.id, job.id, teacher), { code: 'manual_issue_check_required' });
  const reconciled = await f.service.reconcileIssue(f.project.id, job.id, teacher, 3);
  assert.equal(reconciled.state, 'succeeded'); assert.equal(reconciled.result.number, 3);
  assert.equal(mock.calls.filter(call => call.method === 'POST' && call.path.endsWith('/issues')).length, 1);
});

test('설치의 저장소 접근 회수는 GitHub 작업만 멈추고 로컬 저장을 보존한다', async t => {
  const f = await setupLive(); t.after(() => f.store.close());
  const job = f.service.enqueueProposal(f.project.id, student, proposalInput(f.service.status(f.project.id, teacher).remote));
  const raw = Buffer.from(JSON.stringify({ action: 'removed', installation: { id: 123 }, repositories_removed: [{ id: 456 }] }));
  const result = f.service.webhook(raw, { 'x-github-event': 'installation_repositories', 'x-github-delivery': 'installation-removed', 'x-hub-signature-256': signature(raw) });
  assert.equal(result.matched, 1); assert.equal(f.service.jobs(f.project.id).find(candidate => candidate.id === job.id).state, 'blocked');
  assert.equal(f.service.status(f.project.id, teacher).remote.available, false);
  f.store.saveCheckpoint(f.project.id, student, { baseVersion: 0, code: '권한 회수 중 보존', message: '실험 기록' });
  const saved = await f.service.runOnce(); assert.equal(saved.result.localOnly, true); assert.equal(saved.state, 'succeeded');
});

test('worker 종료는 실행중인 원격 요청과 outbox 결과 기록이 끝날 때까지 기다린다', async t => {
  const f = await setupLive(); t.after(() => f.store.close());
  f.service.enqueueProposal(f.project.id, student, proposalInput(f.service.status(f.project.id, teacher).remote));
  let release;
  f.mock.failNext(call => call.path === '/repos/classroom/team-one', new Promise(resolve => { release = resolve; }));
  const running = f.service.runOnce();
  let stopped = false; const stop = f.service.stopWorker().then(() => { stopped = true; });
  await Promise.resolve(); assert.equal(stopped, false);
  release(reply({ id: 456, name: 'team-one', owner: { login: 'classroom' }, private: true }));
  const job = await running; await stop;
  assert.equal(job.state, 'succeeded'); assert.equal(stopped, true);
});

test('운영 offline 모드의 GitHub 작업은 사유를 표시하고 로컬 저장은 성공한다', async t => {
  const f = await setupLive(); t.after(() => f.store.close());
  const offline = createGitHubService({ store: f.store, localMode: false, config: { mode: 'offline', repositories: [repository] } });
  offline.enqueueProposal(f.project.id, student, proposalInput(offline.status(f.project.id, teacher).remote));
  const blocked = await offline.runOnce(); assert.equal(blocked.state, 'blocked'); assert.match(blocked.lastError, /^github_offline:/);
  f.store.saveCheckpoint(f.project.id, student, { baseVersion: 0, code: '오프라인 보존', message: '실험 기록' });
  const saved = await offline.runOnce(); assert.equal(saved.state, 'succeeded'); assert.equal(saved.result.localOnly, true);
});

test('checkpoint 출처를 지정한 GitHub 제안은 같은 프로젝트의 같은 코드만 받는다', t => {
  const { store, service, project } = fixture(); t.after(() => store.close());
  const remote = service.status(project.id, teacher).remote;
  const checkpoint = store.saveCheckpoint(project.id, student, { baseVersion: 0, code: 'print("새로 확정한 실험")', message: '확정 저장본 설명' });
  const input = { code: checkpoint.code, title: '확정 저장본 제안', baseSha: remote.sha, checkpointId: checkpoint.id };
  const job = service.enqueueProposal(project.id, student, input);
  assert.equal(job.payload.checkpointId, checkpoint.id); assert.equal(job.payload.checkpointVersion, checkpoint.version); assert.equal(job.payload.message, checkpoint.message);
  assert.throws(() => service.enqueueProposal(project.id, student, { ...input, code: '저장하지 않은 코드' }), { code: 'checkpoint_binding_mismatch' });
  const another = store.createProject(teacher, { title: '다른 팀', code: checkpoint.code });
  assert.throws(() => service.enqueueProposal(another.id, teacher, input), { code: 'checkpoint_binding_mismatch' });
});

test('GitHub 비교본과 동일한 코드는 빈 PR 작업을 만들지 않고 명시적으로 거부한다', t => {
  const { store, service, project } = fixture(); t.after(() => store.close());
  const remote = service.status(project.id, teacher).remote;
  assert.throws(() => service.enqueueProposal(project.id, student, proposalInput(remote, { code: remote.code })), { status: 409, code: 'nothing_to_publish' });
  const checkpoint = store.checkpoint(project.id);
  assert.throws(() => service.enqueueProposal(project.id, student, { code: checkpoint.code, title: '이미 같은 저장본', baseSha: remote.sha, checkpointId: checkpoint.id }), { status: 409, code: 'nothing_to_publish' });
  assert.equal(service.jobs(project.id).length, 0);
});
