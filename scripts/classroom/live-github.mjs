import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from '../../server/classroom/store.js';
import { createClassroomApp } from '../../server/classroom/app.js';
import { createGitHubService } from '../../server/classroom/github.js';
import { rehearseRestore } from './backup.mjs';
import { verifyLocalLearning } from './live-github-assertions.mjs';

// 실제 GitHub를 쓰는 합성 수업 검증 전용입니다. 운영 설정·DB를 읽지 않습니다.
const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = resolve(root, '.local/github-live');
const statePath = resolve(directory, 'state.json');
const database = resolve(directory, 'classroom.sqlite');
const repository = { owner: 'greatsong', repo: 'vpylab-private-classroom-e2e-20261028', repositoryId: 1436391183, installationId: 1, key: 'private-live-test', branch: 'main', path: 'main.py' };
const backendPort = 4054, frontendPort = 4053;
const backendOrigin = `http://127.0.0.1:${backendPort}`;
const previewOrigin = `http://127.0.0.1:${frontendPort}`;
const command = process.argv[2];
if (!['--run', '--serve'].includes(command)) throw new Error('실제 비공개 시험: node scripts/classroom/live-github.mjs --run 또는 --serve');
mkdirSync(directory, { recursive: true, mode: 0o700 });
let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { runId: randomUUID(), outputs: {}, checks: [], repository };
assert.equal(state.repository.repositoryId, repository.repositoryId, '다른 저장소의 검증 상태를 재사용할 수 없습니다.');
const save = () => { writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 }); chmodSync(statePath, 0o600); };
const runLabel = `로컬 실검증 ${state.runId.slice(0, 8)}`;
const ghPath = `/repos/${repository.owner}/${repository.repo}`;
const execute = promisify(execFile);
let token;
try { token = (await execute('gh', ['auth', 'token', '--hostname', 'github.com', '--user', 'greatsong'], { maxBuffer: 8192 })).stdout.trim(); }
catch { throw new Error('기존 GitHub CLI 로그인을 사용할 수 없습니다. gh auth status로 상태를 확인해주세요.'); }
assert.ok(token && !/[\r\n]/.test(token), 'GitHub 인증을 확인해주세요.');
let lastWrite = 0;
const pause = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));
async function github(path, { method = 'GET', body, allowStatus } = {}) {
  assert.ok(path === '/user' || path === ghPath || path.startsWith(`${ghPath}/`), '테스트 저장소 밖의 GitHub 요청을 거부했습니다.');
  if (method !== 'GET') { await pause(Math.max(0, 1100 - (Date.now() - lastWrite))); lastWrite = Date.now(); }
  const response = await fetch(`https://api.github.com${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'VPyLab-Private-Local-Test', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok && response.status !== allowStatus) throw new Error(`비공개 시험 GitHub ${method} ${path.split('?')[0]}: HTTP ${response.status} (${String(data?.message || '').slice(0, 180)})`);
  return { status: response.status, data };
}
const account = (await github('/user')).data;
assert.equal(account.login, 'greatsong'); assert.equal(account.id, 6792460);
const metadata = (await github(ghPath)).data;
assert.equal(metadata.id, repository.repositoryId); assert.equal(metadata.private, true); assert.equal(metadata.owner.login, repository.owner);
assert.match(metadata.name, /^vpylab-private-classroom-e2e-/);
state.account = { login: account.login, id: account.id }; state.authMethod = 'local_cli_test';
state.limitations = ['현재 로그인한 GitHub 실계정 1개를 합성 학생 가에 연결했습니다. 실제 학생들의 Supabase 로그인 검증은 별도입니다.', 'GitHub App 설치·JWT·설치 토큰 범위·서로 다른 계정의 승인·Webhook 실수신은 검증하지 않습니다.', '실제 테스트 저장소만 사용하며 운영 서비스·원본 저장소에는 쓰지 않습니다.'];
save();

let runtime, server;
const cookies = new Map();
async function startBackend() {
  const store = createStore({ filename: database, localMode: true });
  // gh /user로 확인한 숫자 신원과 합성 학생을 명시적으로 연결합니다.
  store.db.prepare('DELETE FROM github_identities').run();
  store.db.prepare('INSERT INTO github_identities VALUES(?,?,?,?,?)').run('student-a', account.id, account.login, 'github_cli_test', new Date().toISOString());
  const service = createGitHubService({ store, localMode: true, config: { mode: 'live', repositories: [repository] }, installationTokenProvider: async (binding) => {
    assert.equal(binding.repositoryId, repository.repositoryId); assert.equal(binding.owner, repository.owner); assert.equal(binding.repo, repository.repo);
    return token;
  } });
  runtime = createClassroomApp({ store, localMode: true, githubService: service, allowedOrigins: [previewOrigin, backendOrigin] });
  server = runtime.app.listen(backendPort, '127.0.0.1');
  await new Promise((done, reject) => { server.once('listening', done); server.once('error', reject); });
  cookies.clear();
  for (const id of ['teacher', 'student-a', 'student-b']) cookies.set(id, `vpylab_v2_session=${store.createSession(id)}`);
}
async function closeBackend() {
  await Promise.all([runtime.githubService.stopWorker(), new Promise((done) => server.close(done))]);
  runtime.store.close();
}
async function api(userId, path, { method = 'GET', body, headers = {} } = {}) {
  // 재시작 리허설에서 종료한 서버의 keep-alive 소켓을 재사용하지 않습니다.
  const response = await fetch(`${backendOrigin}/api/v2${path}`, { method, signal: AbortSignal.timeout(90000), headers: { Connection: 'close', Origin: backendOrigin, Cookie: cookies.get(userId) || '', 'X-Classroom-User': userId, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(!['GET', 'HEAD'].includes(method) ? { 'Idempotency-Key': createHash('sha256').update(JSON.stringify([state.runId, userId, path, body])).digest('hex') } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
async function requireApi(userId, path, options, status = 200) {
  const response = await api(userId, path, options); assert.equal(response.status, status, `${path}: ${JSON.stringify(response.data)}`); return response.data;
}
let checkedStages = 0, resumedStages = 0;
function pass(name, details) { state.checks.push({ name, passed: true, verifiedAt: new Date().toISOString(), ...(details ? { details } : {}) }); save(); process.stdout.write(`통과: ${name}\n`); }
async function stage(key, name, action) {
  if (state.outputs[key] !== undefined) { resumedStages++; return state.outputs[key]; }
  const result = await action(); state.outputs[key] = result ?? true; checkedStages++; pass(name); return result;
}
async function drain(jobId) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = runtime.githubService.jobs(state.projectId).find((job) => job.id === jobId);
    if (current && ['succeeded', 'blocked', 'failed'].includes(current.state)) return current;
    await runtime.githubService.runOnce();
  }
  throw new Error('작업 대기열의 완료 상태를 확인하지 못했습니다.');
}
await startBackend();

async function runChecks() {
  const initial = await stage('initial', '실제 비공개 저장소 확인·초기 Python 파일 준비', async () => {
    const file = await github(`${ghPath}/contents/main.py`, { allowStatus: 404 });
    if (file.status === 404) await github(`${ghPath}/contents/main.py`, { method: 'PUT', body: { message: `${runLabel}: 합성 수업 시작`, content: Buffer.from('from vpython import *\n# 비공개 통합 검증 전용\nball = sphere(radius=0.5, color=color.blue)\n').toString('base64'), branch: 'main' } });
    const head = (await github(`${ghPath}/git/ref/heads/main`)).data.object.sha;
    const original = (await github(`${ghPath}/contents/main.py?ref=${head}`)).data;
    const readme = (await github(`${ghPath}/contents/README.md?ref=${head}`)).data;
    return { sha: head, code: Buffer.from(original.content, 'base64').toString('utf8'), readmeSha: readme.sha };
  });
  const created = await stage('project', '운영 DB와 분리한 로컬 프로젝트·실제 저장소 연결', async () => {
    const result = await requireApi('teacher', '/projects', { method: 'POST', body: { title: `실제 GitHub 협력 검증 · ${state.runId.slice(0, 8)}`, code: initial.code, aiPolicy: 'disabled', problem: '구의 반지름이 바뀌면 관찰 결과가 어떻게 달라질까요?', successCriteria: '조건을 한 가지씩 바꾸고 동료 의견을 원문 근거로 기록합니다.' } }, 201);
    for (const userId of ['student-a', 'student-b']) await requireApi('teacher', `/projects/${result.project.id}/members`, { method: 'POST', body: { userId, role: 'editor' } });
    const bound = await requireApi('teacher', `/projects/${result.project.id}/github`, { method: 'PUT', body: { repositoryKey: repository.key } });
    assert.equal(bound.authMethod, 'local_cli_test');
    return result.project;
  });
  state.projectId = created.id; save(); const path = `/projects/${created.id}`;
  const remote = await stage('fetch', '실제 GitHub SHA·코드 가져오기와 로컬 저장본 분리', async () => {
    const result = await requireApi('student-a', `${path}/github/fetch`, { method: 'POST', body: {} });
    assert.equal(result.remote.sha, initial.sha); assert.equal(result.remote.code, initial.code);
    assert.equal((await requireApi('student-a', path)).project.version, 0); return result.remote;
  });
  const issueTitle = `${runLabel}: 반지름이 달라지면 충돌 조건도 달라질까?`;
  const prTitle = `${runLabel}: 반지름 조건을 비교하는 실험`;
  const issue = await stage('issue', '학생 질문을 실제 GitHub Issue로 제출·중복 요청 복구', async () => {
    const local = await requireApi('student-a', `${path}/issues`, { method: 'POST', body: { title: issueTitle, body: '예상: 반지름을 키우면 같은 위치에서 더 일찍 접촉할 수 있습니다. 두 조건을 비교하겠습니다.' } }, 201);
    const body = { issueId: local.issue.id, title: local.issue.title, body: local.issue.body };
    const first = await requireApi('student-a', `${path}/github/issues`, { method: 'POST', body }, 202);
    const second = await requireApi('student-a', `${path}/github/issues`, { method: 'POST', body }, 202);
    assert.equal(first.job.id, second.job.id); const job = await drain(first.job.id); assert.equal(job.state, 'succeeded');
    const actual = (await github(`${ghPath}/issues/${job.result.number}`)).data;
    assert.equal(actual.title, issueTitle); assert.equal(actual.user.id, account.id);
    return { number: actual.number, url: actual.html_url, jobId: job.id };
  });
  const checkpoint = await stage('checkpoint', '합성 실험 근거와 팀 버전 저장', async () => {
    const code = 'from vpython import *\n# 가설: 반지름을 키우면 접촉 조건이 달라집니다.\nball = sphere(radius=0.8, color=color.cyan)\nprint("두 반지름 조건을 비교합니다")\n';
    const result = await requireApi('student-a', `${path}/checkpoints`, { method: 'POST', body: { code, baseVersion: 0, message: '반지름 0.5와 0.8을 비교하는 실험', evidence: { hypothesis: '반지름이 커지면 접촉이 빨라질 것이다.', observation: '같은 위치에서 두 반지름을 비교했다.', reasoning: '반지름 이외 조건은 유지했다.', nextStep: '동료가 제안하는 반례를 확인한다.' } } }, 201);
    return result.checkpoint;
  });
  const pull = await stage('pull', '팀 확정 버전을 실제 PR로 제안·main과 다른 파일 보존', async () => {
    const queued = await requireApi('student-a', `${path}/github/proposals`, { method: 'POST', body: { code: checkpoint.code, title: prTitle, baseSha: remote.sha, checkpointId: checkpoint.id } }, 202);
    const job = await drain(queued.job.id); assert.equal(job.state, 'succeeded');
    assert.equal((await github(`${ghPath}/git/ref/heads/main`)).data.object.sha, initial.sha);
    assert.equal((await github(`${ghPath}/contents/README.md?ref=${job.result.sha}`)).data.sha, initial.readmeSha);
    process.stdout.write(`실제 테스트 PR: ${job.result.url}\n`);
    return { number: job.result.number, url: job.result.url, sha: job.result.sha, jobId: job.id };
  });
  const reviewText = `${runLabel}: 질량이 같은 경우 외에도 결과가 유지되는지 비교하고 선택 이유를 설명해주세요.`;
  await stage('review', '실제 COMMENT 리뷰·이슈 대화·코드 줄 의견 작성', async () => {
    state.progress ||= {}; const progress = state.progress.review ||= {}; save();
    // 응답 유실 후 재개할 때도 고유 실험 표식의 기존 기록을 찾아 중복 생성을 막습니다.
    async function findExisting(endpoint, matches) {
      for (let page = 1; page <= 20; page++) {
        const items = (await github(`${endpoint}?per_page=100&page=${page}`)).data;
        assert.ok(Array.isArray(items), 'GitHub 대화 기록 목록이 아닙니다.');
        const found = items.find((item) => item.user?.id === account.id && matches(item));
        if (found) return found;
        if (items.length < 100) return null;
      }
      throw new Error('기존 시험 댓글을 모두 확인하지 못해 중복 방지를 위해 생성을 멈췄습니다.');
    }
    if (!progress.reviewId) {
      const endpoint = `${ghPath}/pulls/${pull.number}/reviews`;
      const existing = await findExisting(endpoint, (item) => item.body === reviewText && item.commit_id === pull.sha && item.state === 'COMMENTED');
      const review = existing || (await github(endpoint, { method: 'POST', body: { body: reviewText, event: 'COMMENT', commit_id: pull.sha } })).data;
      progress.reviewId = review.id; save();
    }
    const commentBody = `${runLabel}: 두 조건을 같은 시간 동안 비교했습니다.`;
    if (!progress.commentId) {
      const endpoint = `${ghPath}/issues/${issue.number}/comments`;
      const existing = await findExisting(endpoint, (item) => item.body === commentBody);
      const comment = existing || (await github(endpoint, { method: 'POST', body: { body: commentBody } })).data;
      progress.commentId = comment.id; save();
    }
    if (!progress.inlineId) {
      const endpoint = `${ghPath}/pulls/${pull.number}/comments`;
      const inlineBody = `${runLabel}: 이 줄의 반지름 이외 조건이 같은지도 확인해주세요.`;
      const existing = await findExisting(endpoint, (item) => item.body === inlineBody && item.path === 'main.py' && (item.commit_id === pull.sha || item.original_commit_id === pull.sha));
      const inline = existing || (await github(endpoint, { method: 'POST', body: { body: inlineBody, commit_id: pull.sha, path: 'main.py', side: 'RIGHT', line: 3 } })).data;
      progress.inlineId = inline.id; save();
    }
    return { reviewId: progress.reviewId, commentId: progress.commentId, commentBody, inlineId: progress.inlineId };
  });
  await stage('selfApproval', '동일 계정의 자기 PR 승인 거절 확인', async () => {
    const response = await github(`${ghPath}/pulls/${pull.number}/reviews`, { method: 'POST', body: { body: `${runLabel}: 자기 승인 차단 시험`, event: 'APPROVE', commit_id: pull.sha }, allowStatus: 422 });
    assert.equal(response.status, 422); assert.match(JSON.stringify(response.data), /own pull request/i); return { rejected: true };
  });
  await stage('learning', '실제 GitHub 6종 근거 수집·반복 수집 중복 방지', async () => {
    const result = await requireApi('teacher', `${path}/github/learning/sync`, { method: 'POST', body: {} }); assert.equal(result.sync.state, 'complete', JSON.stringify(result.sync));
    const before = (await requireApi('teacher', `${path}/learning`)).events.map((event) => event.id).sort();
    await requireApi('teacher', `${path}/github/learning/sync`, { method: 'POST', body: {} });
    assert.deepEqual((await requireApi('teacher', `${path}/learning`)).events.map((event) => event.id).sort(), before);
    return { count: before.length };
  });
  await stage('edited', '실제 댓글 수정 전후 원문 근거 보존', async () => {
    const comment = state.outputs.review;
    const amended = `${comment.commentBody}\n수정: 관찰 시간도 5초로 통일했습니다.`;
    await github(`${ghPath}/issues/comments/${comment.commentId}`, { method: 'PATCH', body: { body: amended } });
    await requireApi('teacher', `${path}/github/learning/sync`, { method: 'POST', body: {} });
    const events = (await requireApi('teacher', `${path}/learning`)).events;
    assert.ok(events.some((event) => event.body === comment.commentBody)); assert.ok(events.some((event) => event.body === amended)); return { preserved: true };
  });
  await stage('feedback', '실제 근거에 연결한 학생 피드백·공개 범위 검증', async () => verifyLocalLearning({ api, projectId: created.id, issueTitle, prTitle, reviewText, expectedGithubId: account.id, report: state.checks }));
  const draftCode = checkpoint.code + '# 개인 초안은 외부 병합 후에도 유지합니다.\n';
  await stage('merge', '테스트 PR 외부 병합 후 로컬 초안·팀 버전 보존', async () => {
    await requireApi('student-a', `${path}/drafts`, { method: 'PUT', body: { clientId: 'live-test-window', clientSequence: 1, baseVersion: checkpoint.version, code: draftCode } });
    const actual = (await github(`${ghPath}/pulls/${pull.number}`)).data;
    if (!actual.merged) { const merged = await github(`${ghPath}/pulls/${pull.number}/merge`, { method: 'PUT', body: { sha: pull.sha, merge_method: 'merge', commit_title: `${runLabel}: 테스트 저장소에서만 병합` } }); assert.equal(merged.data.merged, true); }
    await requireApi('teacher', `${path}/github/learning/sync`, { method: 'POST', body: {} });
    const fetched = await requireApi('student-a', `${path}/github/fetch`, { method: 'POST', body: {} }); assert.equal(fetched.remote.code, checkpoint.code);
    assert.equal((await requireApi('student-a', path)).project.version, checkpoint.version);
    assert.equal((await requireApi('student-a', `${path}/drafts?clientId=live-test-window`)).draft.code, draftCode); return fetched.remote;
  });
  await stage('conflict', '외부 커밋 후 오래된 기준의 PR 작업 차단·작성자 추측 금지', async () => {
    const base = state.outputs.merge;
    const next = await requireApi('student-a', `${path}/checkpoints`, { method: 'POST', body: { code: checkpoint.code + 'print("추가 조건")\n', baseVersion: checkpoint.version, message: '추가 조건을 비교하는 다음 실험' } }, 201);
    const queued = await requireApi('student-a', `${path}/github/proposals`, { method: 'POST', body: { code: next.checkpoint.code, title: `${runLabel}: 오래된 기준 충돌 시험`, baseSha: base.sha, checkpointId: next.checkpoint.id } }, 202);
    const parent = (await github(`${ghPath}/git/commits/${base.sha}`)).data;
    state.progress ||= {}; const progress = state.progress.conflict ||= {}; save();
    const externalMessage = `${runLabel}: 외부 변경·이름만으로 귀속하지 않는 커밋`;
    let currentSha = (await github(`${ghPath}/git/ref/heads/main`)).data.object.sha;
    if (!progress.externalSha) {
      if (currentSha !== base.sha) {
        // 이전 실행이 ref 이동 직후 끝났다면 같은 시험 커밋인지 확인하고 이어갑니다.
        const current = (await github(`${ghPath}/git/commits/${currentSha}`)).data;
        assert.ok(current.message === externalMessage && current.tree.sha === parent.tree.sha && current.parents?.length === 1 && current.parents[0].sha === base.sha && current.author?.name === '학생 나' && current.author?.email === 'student-b@example.invalid', 'main이 다른 작업으로 변경되어 외부 변경 시험을 안전하게 재개할 수 없습니다.');
        progress.externalSha = currentSha; save();
      } else {
        if (!progress.commitRequest) {
          const date = new Date().toISOString();
          // 작성 시각도 보존해 커밋 생성 응답이 유실되어도 같은 SHA를 재사용합니다.
          progress.commitRequest = { message: externalMessage, tree: parent.tree.sha, parents: [base.sha], author: { name: '학생 나', email: 'student-b@example.invalid', date }, committer: { name: 'VPyLab 로컬 검증', email: 'local-test@example.invalid', date } }; save();
        }
        assert.equal(progress.commitRequest.parents[0], base.sha); assert.equal(progress.commitRequest.tree, parent.tree.sha);
        const external = (await github(`${ghPath}/git/commits`, { method: 'POST', body: progress.commitRequest })).data;
        progress.externalSha = external.sha; save();
      }
    }
    currentSha = (await github(`${ghPath}/git/ref/heads/main`)).data.object.sha;
    assert.ok(currentSha === base.sha || currentSha === progress.externalSha, 'main의 다른 변경을 덮어쓰지 않도록 외부 변경 시험을 멈췄습니다.');
    if (currentSha !== progress.externalSha) await github(`${ghPath}/git/refs/heads/main`, { method: 'PATCH', body: { sha: progress.externalSha, force: false } });
    progress.refUpdated = true; save();
    const job = await drain(queued.job.id); assert.equal(job.state, 'blocked'); assert.match(job.lastError, /^github_base_conflict:/);
    assert.equal((await github(`${ghPath}/git/ref/heads/main`)).data.object.sha, progress.externalSha);
    await requireApi('teacher', `${path}/github/learning/sync`, { method: 'POST', body: {} });
    const found = (await requireApi('teacher', `${path}/learning`)).events.find((event) => event.kind === 'commit' && event.sha === progress.externalSha);
    assert.ok(found); assert.equal(found.githubAuthorId, null); assert.equal(found.authorUserId, null);
    return { jobId: queued.job.id, sha: progress.externalSha };
  });
  await stage('restart', 'DB 재시작 후 실제 GitHub 근거·피드백·초안 보존', async () => {
    const before = await requireApi('teacher', `${path}/learning`); await closeBackend(); await startBackend();
    const after = await requireApi('teacher', `${path}/learning`);
    assert.deepEqual(after.events.map((event) => event.id).sort(), before.events.map((event) => event.id).sort());
    assert.deepEqual(after.students[0].feedback.map((entry) => entry.id).sort(), before.students[0].feedback.map((entry) => entry.id).sort());
    assert.equal((await requireApi('student-a', `${path}/drafts?clientId=live-test-window`)).draft.code, draftCode);
    return { events: after.events.length, feedback: after.students[0].feedback.length };
  });
  await stage('backup', '실제 근거·비공개 메모를 포함한 백업·임시 복구 리허설', async () => { const result = await rehearseRestore(database); assert.equal(result.ok, true); return { counts: result.counts, fingerprint: result.fingerprint }; });
  await stage('credentialIsolation', 'GitHub 토큰의 DB·상태 파일·브라우저 응답 미포함', async () => {
    for (const file of [database, `${database}-wal`, `${database}-shm`, statePath]) if (existsSync(file)) assert.equal(readFileSync(file).includes(Buffer.from(token)), false, '인증은 서버 메모리에만 있어야 합니다.');
    for (const endpoint of [path, `${path}/learning`, `${path}/github`]) assert.equal(JSON.stringify(await requireApi('teacher', endpoint)).includes(token), false, '브라우저 API에 GitHub 토큰이 포함되면 안 됩니다.');
    return { filesAndResponsesContainToken: false };
  });
  delete state.failure; delete state.failedAt;
  state.completedAt ||= new Date().toISOString(); state.lastResumedAt = new Date().toISOString();
  state.previewUrl = `${previewOrigin}/classroom.html#/projects/${created.id}/process`; save();
  process.stdout.write(`실제 검증 결과: 누적 ${state.checks.length}개 확인 · 이번 실행 ${checkedStages}단계 검사 · 기존 ${resumedStages}단계 재사용\n최초 완료: ${state.completedAt}\n테스트 저장소: ${metadata.html_url}\n검토 화면: ${state.previewUrl}\n결과: ${statePath}\n`);
}

try { if (command === '--run') await runChecks(); else assert.ok(state.projectId, '먼저 --run으로 비공개 시험을 준비해주세요.'); }
catch (error) {
  const message = String(error?.stack || error).replaceAll(token, '[비공개 인증]');
  state.failedAt = new Date().toISOString(); state.failure = message; save();
  await closeBackend(); process.stderr.write(message + '\n'); process.exitCode = 1;
}
if (!process.exitCode) {
  runtime.githubService.startWorker();
  const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'vite.classroom.config.js'], { cwd: resolve(root, 'client'), stdio: 'inherit', env: { ...process.env, CLASSROOM_PREVIEW_PORT: String(frontendPort), CLASSROOM_API_PORT: String(backendPort) } });
  let closing = false;
  const close = async () => { if (closing) return; closing = true; frontend.kill('SIGTERM'); await closeBackend(); token = null; };
  frontend.on('error', () => { process.exitCode = 1; void close(); });
  frontend.on('exit', () => { void close(); });
  process.on('SIGINT', () => { void close(); }); process.on('SIGTERM', () => { void close(); });
  process.stdout.write(`로컬 실검증 서버 실행 중: ${previewOrigin}/classroom.html\n인증: GitHub CLI·테스트 저장소 한정, GitHub App 검증과 구분\n`);
}
