import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createStore } from '../../server/classroom/store.js';
import { createClassroomApp } from '../../server/classroom/app.js';
import { createGitHubService } from '../../server/classroom/github.js';

// 기존 실검증 DB·운영 설정과 분리한 두 실계정 검증입니다. 인증은 메모리에만 보관합니다.
export const TEST_REPOSITORY = Object.freeze({ owner: 'greatsong', repo: 'vpylab-private-classroom-e2e-20261028', repositoryId: 1436391183, installationId: 1, key: 'private-two-account-test', branch: 'main', path: 'main.py' });
export const AUTHOR = Object.freeze({ login: 'greatsong', id: 6792460 });
const repositoryPath = `/repos/${TEST_REPOSITORY.owner}/${TEST_REPOSITORY.repo}`;
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const help = '사용법: node scripts/classroom/two-account-github.mjs [--check|--run] --reviewer 두번째GitHub아이디\n--check(기본): 두 계정·저장소·기준 SHA 읽기 전용 확인\n--run: 격리한 로컬 교실에서 PR·다른 계정의 COMMENT/APPROVE·학생별 근거·피드백 검증. PR은 열린 채 유지합니다.\n이미 gh에 로그인된 계정만 사용합니다. 로그인 전환·권한 변경·자동 병합은 하지 않습니다.';

function failure(code, message) { return Object.assign(new Error(message), { code }); }
function ensure(condition, code, message) { if (!condition) throw failure(code, message); }
export function parseArguments(args) {
  let command = '--check', reviewer = null, selected = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--help') return { command: '--help' };
    if (['--check', '--run'].includes(argument) && !selected) { command = argument; selected = true; }
    else if (argument === '--reviewer' && reviewer === null) reviewer = args[++index];
    else throw failure('invalid_arguments', help);
  }
  ensure(typeof reviewer === 'string' && /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(reviewer), 'reviewer_required', `두 번째 GitHub 아이디가 필요합니다. 계정을 추측하거나 로그인하지 않습니다.\n${help}`);
  ensure(reviewer.toLowerCase() !== AUTHOR.login, 'different_account_required', 'PR 작성자 greatsong과 다른 GitHub 아이디를 --reviewer로 지정해주세요.');
  return { command, reviewer };
}

export function cliEnvironment(env = process.env) {
  // gh가 --user 대신 공통 환경 토큰을 선택하지 않도록 자식 프로세스에서만 제거합니다.
  const copy = { ...env };
  for (const key of ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN']) delete copy[key];
  return copy;
}
async function existingToken(login) {
  try {
    const { stdout } = await promisify(execFile)('gh', ['auth', 'token', '--hostname', 'github.com', '--user', login], { env: cliEnvironment(), timeout: 15000, maxBuffer: 8192 });
    const token = stdout.trim();
    ensure(/^[\x21-\x7e]{1,4096}$/.test(token), 'credential_unavailable', '기존 GitHub CLI 인증을 확인해주세요.');
    return token;
  } catch { throw failure('credential_unavailable', `${login}의 기존 GitHub CLI 로그인을 사용할 수 없습니다. 비밀값을 채팅에 보내지 말고 해당 계정으로 로컬 gh 로그인을 준비해주세요.`); }
}

export function createRequester({ token, fetchImpl = fetch, allowWrites = false, pause = milliseconds => new Promise(done => setTimeout(done, milliseconds)) }) {
  let lastWrite = 0;
  return async function request(path, { method = 'GET', body } = {}) {
    ensure(path === '/user' || path === repositoryPath || path.startsWith(`${repositoryPath}/`), 'repository_not_allowed', '허용한 비공개 시험 저장소 밖의 요청을 차단했습니다.');
    ensure(method === 'GET' || allowWrites && method === 'POST' && new RegExp(`^${repositoryPath}/pulls/[1-9][0-9]*/reviews$`).test(path), 'write_not_allowed', '이 요청에서는 해당 GitHub 쓰기를 허용하지 않습니다.');
    if (method !== 'GET') { await pause(Math.max(0, 1100 - (Date.now() - lastWrite))); lastWrite = Date.now(); }
    let response;
    try { response = await fetchImpl(`https://api.github.com${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'VPyLab-Two-Account-Local-Test', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch { throw failure(method === 'GET' ? 'github_read_failed' : 'github_write_uncertain', method === 'GET' ? 'GitHub 읽기 요청에 실패했습니다. 외부 쓰기는 재시도하지 않았습니다.' : 'GitHub 전송 결과를 확인할 수 없습니다. 고유 표식으로 재조회한 뒤에만 이어갈 수 있습니다.'); }
    // 응답의 원문 오류·헤더에는 인증 관련 정보가 있을 수 있으므로 출력·저장하지 않습니다.
    ensure(response.ok, method === 'GET' ? 'github_read_rejected' : response.status >= 500 ? 'github_write_uncertain' : 'github_write_rejected', `GitHub ${method} 요청이 HTTP ${response.status}로 완료되지 않았습니다. 자동 재전송은 하지 않습니다.`);
    try { return await response.json(); }
    catch { throw failure(method === 'GET' ? 'github_response_invalid' : 'github_write_uncertain', 'GitHub JSON 응답을 확인할 수 없습니다. 쓰기는 자동 재전송하지 않습니다.'); }
  };
}

export async function preflight({ reviewer, tokenFor = existingToken, requestFor = createRequester }) {
  const accounts = {};
  for (const [role, login] of [['author', AUTHOR.login], ['reviewer', reviewer]]) {
    const token = await tokenFor(login), request = requestFor({ token });
    const account = await request('/user');
    ensure(account.login?.toLowerCase() === login.toLowerCase() && Number.isSafeInteger(account.id) && account.id > 0, 'github_identity_mismatch', `${role}의 GitHub 숫자 신원이 지정한 계정과 일치하지 않습니다.`);
    if (role === 'author') ensure(account.id === AUTHOR.id, 'github_identity_mismatch', 'greatsong의 고정 숫자 사용자 ID가 다릅니다.');
    const metadata = await request(repositoryPath);
    ensure(metadata.id === TEST_REPOSITORY.repositoryId && metadata.private === true && metadata.owner?.login?.toLowerCase() === TEST_REPOSITORY.owner && metadata.name === TEST_REPOSITORY.repo, 'repository_mismatch', '허용한 비공개 저장소의 ID·소유자·이름을 확인할 수 없습니다.');
    ensure(metadata.permissions?.pull === true && metadata.permissions?.push === true, 'repository_permission_required', `${login}에게 비공개 시험 저장소의 읽기·쓰기 역할이 필요합니다. 하니스는 초대·권한 변경을 하지 않습니다.`);
    const head = await request(`${repositoryPath}/git/ref/heads/main`);
    ensure(/^[a-f\d]{40}$/i.test(head.object?.sha || ''), 'repository_head_invalid', 'main 기준 SHA를 확인할 수 없습니다.');
    accounts[role] = { token, request, login: account.login, id: account.id, headSha: head.object.sha, permissions: { pull: true, push: true } };
  }
  ensure(accounts.author.id !== accounts.reviewer.id, 'different_account_required', '서로 다른 숫자 사용자 ID를 가진 두 계정이 필요합니다.');
  ensure(accounts.author.headSha === accounts.reviewer.headSha, 'repository_changed', '계정 확인 중 main이 변경되었습니다. 읽기 전용 확인을 다시 실행해주세요.');
  return accounts;
}

export async function findMarkedReview(request, { number, marker, authorId, sha, state }) {
  let found = null;
  for (let page = 1; page <= 20; page++) {
    const items = await request(`${repositoryPath}/pulls/${number}/reviews?per_page=100&page=${page}`);
    ensure(Array.isArray(items), 'review_list_invalid', '리뷰 목록을 확인할 수 없습니다.');
    for (const item of items.filter(candidate => candidate.body?.includes(marker))) {
      ensure(item.user?.id === authorId && item.commit_id === sha && item.state === state, 'review_marker_conflict', '같은 시험 표식의 작성자·SHA·리뷰 상태가 다릅니다. 재전송을 중단했습니다.');
      ensure(!found || found.id === item.id, 'duplicate_review', '같은 시험 표식의 리뷰가 여러 개입니다. 자동 처리를 중단했습니다.');
      found = item;
    }
    if (items.length < 100) return found;
  }
  throw failure('review_history_incomplete', '기존 리뷰를 전부 확인하지 못해 중복 방지를 위해 중단했습니다.');
}

export async function ensureReview({ request, number, authorId, sha, event, marker, text, journal, save }) {
  const expected = { number, marker, authorId, sha, state: event === 'APPROVE' ? 'APPROVED' : 'COMMENTED' };
  const existing = await findMarkedReview(request, expected);
  if (existing) { journal.result = { id: existing.id, url: existing.html_url, authorId, sha, state: existing.state }; journal.phase = 'confirmed'; save(); return journal.result; }
  ensure(!journal.phase, 'review_needs_reconciliation', '전송 이력이 있으나 GitHub에서 리뷰를 찾지 못했습니다. 자동 재전송하지 않습니다. 교사가 원문을 확인해주세요.');
  journal.phase = 'sending'; save();
  let review;
  try { review = await request(`${repositoryPath}/pulls/${number}/reviews`, { method: 'POST', body: { event, commit_id: sha, body: `${text}\n\n${marker}` } }); }
  catch (error) { journal.phase = error.code === 'github_write_rejected' ? 'rejected' : 'uncertain'; save(); throw error; }
  ensure(review.user?.id === authorId && review.commit_id === sha && review.state === expected.state && review.body?.includes(marker), 'review_response_mismatch', '실제 리뷰의 작성자·SHA·상태를 확인하지 못했습니다. 자동 재전송하지 않습니다.');
  journal.result = { id: review.id, url: review.html_url, authorId, sha, state: review.state }; journal.phase = 'confirmed'; save();
  return journal.result;
}

// 서비스 자체의 PR 생성만 허용하며 main 변경·병합·Issue 전송·임의 URL을 막습니다.
export function guardedServiceFetch(fetchImpl = fetch) {
  return async (url, options = {}) => {
    const parsed = new URL(url), method = options.method || 'GET';
    ensure(parsed.origin === 'https://api.github.com' && (parsed.pathname === repositoryPath || parsed.pathname.startsWith(`${repositoryPath}/`)), 'repository_not_allowed', '서비스의 시험 저장소 밖 요청을 차단했습니다.');
    if (method !== 'GET') {
      const path = parsed.pathname.slice(repositoryPath.length), body = JSON.parse(options.body || '{}');
      const permitted = method === 'POST' && (
        path === '/git/trees' && body.tree?.length === 1 && body.tree[0].path === 'main.py' ||
        path === '/git/commits' && body.parents?.length === 1 ||
        path === '/git/refs' && /^refs\/heads\/vpylab\/proposal-[a-f\d-]+-[a-f\d]{10}$/.test(body.ref || '') ||
        path === '/pulls' && body.base === 'main' && /^vpylab\/proposal-[a-f\d-]+-[a-f\d]{10}$/.test(body.head || '')
      );
      ensure(permitted, 'write_not_allowed', '시험 서비스의 허용되지 않은 GitHub 쓰기를 차단했습니다.');
    }
    return fetchImpl(url, options);
  };
}

async function runTrialUnlocked(accounts, { directory, port = 4064, fetchImpl = fetch, output }) {
  mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
  const statePath = resolve(directory, 'state.json'), database = resolve(directory, 'classroom.sqlite');
  const identities = Object.fromEntries(Object.entries(accounts).map(([role, account]) => [role, { login: account.login, id: account.id }]));
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { schema: 1, runId: randomUUID(), repository: TEST_REPOSITORY, identities, outputs: {}, reviews: {}, checks: [] };
  ensure(state.schema === 1 && state.repository.repositoryId === TEST_REPOSITORY.repositoryId && state.identities.author.id === identities.author.id && state.identities.reviewer.id === identities.reviewer.id, 'state_identity_mismatch', '저장된 시험의 저장소·두 계정 숫자 ID가 다릅니다. 기존 상태를 자동 덮어쓰지 않습니다.');
  const save = () => { const temporary = `${statePath}.${process.pid}.tmp`; writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 }); chmodSync(temporary, 0o600); renameSync(temporary, statePath); };
  const pass = (name, details) => { state.checks.push({ name, passed: true, verifiedAt: new Date().toISOString(), ...(details ? { details } : {}) }); save(); output(`통과: ${name}\n`); };
  const stage = async (key, name, action) => { if (state.outputs[key] !== undefined) return state.outputs[key]; const result = await action(); state.outputs[key] = result ?? true; pass(name); return state.outputs[key]; };
  save();
  const store = createStore({ filename: database, localMode: true });
  for (const file of [database, `${database}-wal`, `${database}-shm`]) if (existsSync(file)) chmodSync(file, 0o600);
  store.transaction(() => {
    store.db.prepare('DELETE FROM github_identities').run();
    for (const [userId, account] of [['student-a', accounts.author], ['student-b', accounts.reviewer]]) store.db.prepare('INSERT INTO github_identities VALUES(?,?,?,?,?)').run(userId, account.id, account.login, 'github_cli_test', new Date().toISOString());
  });
  const service = createGitHubService({ store, localMode: true, config: { mode: 'live', repositories: [TEST_REPOSITORY] }, fetchImpl: guardedServiceFetch(fetchImpl), installationTokenProvider: async binding => {
    ensure(binding.repositoryId === TEST_REPOSITORY.repositoryId && binding.owner === TEST_REPOSITORY.owner && binding.repo === TEST_REPOSITORY.repo, 'repository_mismatch', '시험 저장소 연결을 확인해주세요.'); return accounts.author.token;
  } });
  let origin;
  const runtime = createClassroomApp({ store, localMode: true, githubService: service, allowedOrigins: [] });
  const server = runtime.app.listen(port, '127.0.0.1');
  const cookies = new Map(['teacher', 'student-a', 'student-b'].map(id => [id, `vpylab_v2_session=${store.createSession(id)}`]));
  async function api(userId, path, { method = 'GET', body, key } = {}, expected = 200) {
    const response = await fetch(`${origin}/api/v2${path}`, { method, signal: AbortSignal.timeout(90000), headers: { Origin: origin, Cookie: cookies.get(userId), 'X-Classroom-User': userId, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'Idempotency-Key': createHash('sha256').update(JSON.stringify([state.runId, userId, path, key || '', body])).digest('hex') } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    let data; try { data = await response.json(); } catch { throw failure('local_response_invalid', '격리한 로컬 교실의 JSON 응답을 확인하지 못했습니다.'); }
    ensure(response.status === expected, 'local_assertion_failed', `격리한 로컬 교실 ${method} 요청: HTTP ${expected} 예상, ${response.status} 수신 (${typeof data.code === 'string' ? data.code.replace(/[^a-z_]/g, '') : 'no_code'}).`);
    return data;
  }
  const githubA = accounts.author.request;
  const githubB = createRequester({ token: accounts.reviewer.token, allowWrites: true, fetchImpl });
  try {
    await new Promise((done, reject) => { server.once('listening', done); server.once('error', () => reject(failure('local_port_unavailable', '격리한 localhost 포트를 사용할 수 없습니다. 기존 서버를 종료하지 않습니다.'))); });
    origin = `http://127.0.0.1:${server.address().port}`;
    const initial = await stage('initial', 'main 코드·기준 SHA 읽기', async () => {
      const head = await githubA(`${repositoryPath}/git/ref/heads/main`);
      const file = await githubA(`${repositoryPath}/contents/main.py?ref=${head.object.sha}`);
      ensure(file.type === 'file' && file.encoding === 'base64' && file.size <= 50 * 1024, 'remote_file_invalid', '기존 main.py는 UTF-8 50KB 이하 파일이어야 합니다. 초기화·main 수정은 하지 않습니다.');
      const bytes = Buffer.from(file.content || '', 'base64'), code = bytes.toString('utf8');
      ensure(bytes.length <= 50 * 1024 && !code.includes('\uFFFD'), 'remote_file_invalid', 'main.py 인코딩·크기를 확인해주세요.');
      return { sha: head.object.sha, code };
    });
    const project = await stage('project', '분리된 교실·두 숫자 GitHub 신원 연결', async () => {
      const result = await api('teacher', '/projects', { method: 'POST', body: { title: `두 실계정 협력 검증 · ${state.runId.slice(0, 8)}`, code: initial.code, aiPolicy: 'disabled', problem: '반지름만 바꾸면 관찰 결과가 어떻게 달라지는가?', successCriteria: '동료의 반례를 검토하고 선택 이유를 근거와 연결한다.' } }, 201);
      for (const userId of ['student-a', 'student-b']) await api('teacher', `/projects/${result.project.id}/members`, { method: 'POST', body: { userId, role: 'editor' } });
      await api('teacher', `/projects/${result.project.id}/github`, { method: 'PUT', body: { repositoryKey: TEST_REPOSITORY.key } });
      return result.project;
    });
    state.projectId = project.id; save(); const path = `/projects/${project.id}`;
    const remote = await stage('fetch', '개인 초안과 분리한 GitHub 코드 가져오기', async () => {
      const result = await api('student-a', `${path}/github/fetch`, { method: 'POST', body: {} }); assert.equal(result.remote.sha, initial.sha); return result.remote;
    });
    const checkpoint = await stage('checkpoint', '학생 가의 실험·확정 저장본', async () => {
      const result = await api('student-a', `${path}/checkpoints`, { method: 'POST', body: { code: 'from vpython import *\n# 두 실계정 합성 협업 시험: 반지름만 바꿔 비교합니다.\nball = sphere(radius=0.65, color=color.cyan)\nprint("동료 검토 전후의 관찰을 비교합니다")\n', baseVersion: 0, message: `두 실계정 시험 ${state.runId}`, evidence: { hypothesis: '반지름이 커지면 접촉 조건이 달라질 것이다.', observation: '다른 조건을 유지하고 반지름을 비교했다.', reasoning: '변인을 하나로 제한했다.', nextStep: '동료가 제시한 반례를 확인한다.' } } }, 201);
      return result.checkpoint;
    });
    const pull = await stage('pull', '학생 가의 PR 생성·같은 확정본 중복 제출 방지', async () => {
      const body = { code: checkpoint.code, title: `두 실계정 협력 시험 ${state.runId}`, message: `<!-- vpylab-two-account:${state.runId} -->\n반지름만 바꾼 실험을 동료가 검토합니다.`, baseSha: remote.sha, checkpointId: checkpoint.id };
      const first = await api('student-a', `${path}/github/proposals`, { method: 'POST', body }, 202);
      const replay = await api('student-a', `${path}/github/proposals`, { method: 'POST', body, key: 'distinct-request-same-checkpoint' }, 202);
      assert.equal(first.job.id, replay.job.id);
      let job = service.jobs(project.id).find(item => item.id === first.job.id);
      // 한 번만 실행합니다. 지연된 네트워크 작업을 자동으로 반복 실행하지 않습니다.
      if (job.state === 'pending' && job.attempts === 0) { for (let index = 0; index < 20 && job.attempts === 0; index++) { await service.runOnce(); job = service.jobs(project.id).find(item => item.id === first.job.id); } }
      if (job.state !== 'succeeded') {
        // 서비스 고유 브랜치가 복구 표식입니다. 찾지 못해도 POST를 재전송하지 않습니다.
        const branch = `vpylab/proposal-${first.job.id}-${createHash('sha256').update(checkpoint.code).digest('hex').slice(0, 10)}`;
        const matches = await githubA(`${repositoryPath}/pulls?state=all&head=${encodeURIComponent(`${TEST_REPOSITORY.owner}:${branch}`)}&base=main&per_page=100`);
        ensure(Array.isArray(matches) && matches.length === 1 && matches[0].user?.id === accounts.author.id, 'pull_needs_reconciliation', 'PR 작업이 완료되지 않았습니다. 고유 브랜치의 PR을 찾지 못해 자동 재시도하지 않습니다. 상태 파일과 GitHub 원문을 확인해주세요.');
        const actual = matches[0], file = await githubA(`${repositoryPath}/contents/main.py?ref=${actual.head.sha}`), commit = await githubA(`${repositoryPath}/git/commits/${actual.head.sha}`);
        ensure(Buffer.from(file.content || '', 'base64').toString('utf8') === checkpoint.code && commit.parents?.[0]?.sha === remote.sha && actual.body?.includes(`<!-- vpylab-two-account:${state.runId} -->`), 'pull_marker_conflict', '복구할 PR의 코드·기준 SHA·고유 표식이 달라 자동 처리를 중단했습니다.');
        return { number: actual.number, url: actual.html_url, sha: actual.head.sha, jobId: first.job.id, recovered: true };
      }
      return { number: job.result.number, url: job.result.url, sha: job.result.sha, jobId: job.id };
    });
    async function verifyPull() {
      const actual = await githubA(`${repositoryPath}/pulls/${pull.number}`);
      ensure(actual.user?.id === accounts.author.id && actual.head?.sha === pull.sha && actual.base?.ref === 'main' && actual.base?.repo?.id === TEST_REPOSITORY.repositoryId && actual.state === 'open' && actual.merged === false, 'pull_changed', 'PR 작성자·head SHA·대상 저장소·열린 상태가 달라 검토를 중단했습니다.');
      ensure((await githubA(`${repositoryPath}/git/ref/heads/main`)).object.sha === initial.sha, 'main_changed', '시험 중 main SHA가 변경되어 검토를 중단했습니다.');
    }
    await verifyPull();
    for (const event of ['COMMENT', 'APPROVE']) {
      await verifyPull();
      state.reviews[event] ||= {}; save();
      await ensureReview({ request: githubB, number: pull.number, authorId: accounts.reviewer.id, sha: pull.sha, event, marker: `<!-- vpylab-two-account:${state.runId}:${event} -->`, text: event === 'COMMENT' ? '동료 검토: 반지름 이외의 조건을 같게 유지했는지 확인해주세요. 관찰 시간을 통일하면 설명을 비교하기 좋겠습니다.' : '동료 승인: 변경 코드와 기준 SHA를 확인했습니다. 반지름 한 변인을 비교하는 합성 시험 PR을 승인합니다.', journal: state.reviews[event], save });
    }
    pass('다른 실계정의 COMMENT·APPROVE와 숫자 작성자 ID·동일 head SHA', { pull, reviewerId: accounts.reviewer.id, reviews: state.reviews });
    await stage('evidenceAndFeedback', '실제 작성·리뷰 근거의 두 학생 귀속·교사 비공개·개별 피드백', async () => {
      const first = await api('teacher', `${path}/github/learning/sync`, { method: 'POST', body: {} });
      ensure(first.sync.state === 'complete', 'learning_sync_incomplete', 'GitHub 기록 수집 범위가 완전하지 않습니다. 실제 리뷰를 확인할 수 있도록 다시 읽기 수집해야 합니다.');
      const learning = await api('teacher', `${path}/learning`), ids = learning.events.map(item => item.id).sort();
      await api('teacher', `${path}/github/learning/sync`, { method: 'POST', body: {} });
      assert.deepEqual((await api('teacher', `${path}/learning`)).events.map(item => item.id).sort(), ids);
      const pullEvents = learning.events.filter(item => item.kind === 'pull_request' && item.metadata?.number === pull.number);
      const reviewEvents = learning.events.filter(item => item.kind === 'review' && Object.values(state.reviews).some(review => item.url === review.result.url));
      ensure(pullEvents.length > 0 && reviewEvents.length === 2, 'learning_evidence_missing', '시험 PR과 두 리뷰를 수집한 근거에서 찾을 수 없습니다.');
      for (const item of pullEvents) { assert.equal(item.githubAuthorId, accounts.author.id); assert.equal(item.authorUserId, 'student-a'); }
      for (const item of reviewEvents) { assert.equal(item.githubAuthorId, accounts.reviewer.id); assert.equal(item.authorUserId, 'student-b'); assert.equal(item.sha, pull.sha); }
      const evidence = {};
      for (const [userId, account] of [['student-a', accounts.author], ['student-b', accounts.reviewer]]) {
        evidence[userId] = await api(userId, `${path}/student-evidence/${userId}`);
        assert.equal(evidence[userId].githubIdentity.githubId, account.id); assert.equal(evidence[userId].githubIdentity.source, 'github_cli_test');
        assert.ok(evidence[userId].events.length > 0);
        for (const item of evidence[userId].events) assert.ok(item.githubAuthorId === account.id || item.requestedByUserId === userId);
      }
      for (const review of reviewEvents) { assert.ok(evidence['student-b'].events.some(item => item.id === review.id)); assert.ok(!evidence['student-a'].events.some(item => item.id === review.id)); }
      await api('student-a', `${path}/student-evidence/student-b`, {}, 403); await api('student-b', `${path}/student-evidence/student-a`, {}, 403);
      const feedback = [];
      for (const userId of ['student-a', 'student-b']) {
        const evidenceIds = [userId === 'student-a' ? pullEvents[0].id : reviewEvents[0].id];
        for (const visibility of ['private', 'student', 'team']) {
          const body = { studentId: userId, visibility, evidenceIds, comment: `두 실계정 ${state.runId} ${userId} ${visibility}: 근거와 선택 이유를 연결하고 다음 실험을 제안해주세요.` };
          const created = await api('teacher', `${path}/feedback`, { method: 'POST', body }, 201);
          assert.deepEqual((await api('teacher', `${path}/feedback`, { method: 'POST', body }, 201)).feedback, created.feedback);
          feedback.push(created.feedback);
        }
      }
      const feedbackIds = new Set(feedback.map(item => item.id));
      for (const userId of ['teacher', 'student-a', 'student-b']) for (const suffix of ['', '/export', '/learning']) {
        const result = await api(userId, `${path}${suffix}`), actual = suffix === '/learning' ? result.students.flatMap(item => item.feedback) : result.feedback;
        const expected = feedback.filter(item => userId === 'teacher' || item.visibility === 'team' || item.visibility === 'student' && item.studentId === userId).map(item => item.id).sort();
        assert.deepEqual([...new Set(actual.filter(item => feedbackIds.has(item.id)).map(item => item.id))].sort(), expected);
      }
      return { pullEvidenceIds: pullEvents.map(item => item.id), reviewEvidenceIds: reviewEvents.map(item => item.id), studentAEvents: evidence['student-a'].events.length, studentBEvents: evidence['student-b'].events.length, feedback: feedback.map(item => ({ id: item.id, studentId: item.studentId, visibility: item.visibility })) };
    });
    await verifyPull();
    await stage('credentialIsolation', '두 자격증명의 상태·DB·로컬 응답 미포함', async () => {
      for (const account of Object.values(accounts)) {
        for (const file of [statePath, database, `${database}-wal`, `${database}-shm`]) if (existsSync(file)) assert.equal(readFileSync(file).includes(Buffer.from(account.token)), false);
        for (const suffix of ['', '/learning', '/export']) assert.equal(JSON.stringify(await api('teacher', `${path}${suffix}`)).includes(account.token), false);
      }
      return { tokensPersisted: false };
    });
    state.completedAt ||= new Date().toISOString(); state.lastVerifiedAt = new Date().toISOString(); delete state.failure; save();
    output(`두 실계정 검증 완료: ${state.checks.length}개 확인\nPR(열린 상태 유지): ${pull.url}\n로컬 결과: .local/github-two-account/state.json\nGitHub App·Supabase OAuth·Webhook·학교 실수업은 별도 검증입니다.\n`);
  } catch (error) {
    state.failure = { code: typeof error.code === 'string' ? error.code.replace(/[^a-z_]/g, '') : 'local_assertion_failed', at: new Date().toISOString() }; save();
    throw error;
  } finally {
    await service.stopWorker();
    await new Promise(done => server.close(done));
    store.close();
  }
}

// 옵션 주입은 코드의 로컬 모의 테스트용이며 CLI·환경 변수에서 열지 않습니다.
export async function runTrial(accounts, { directory = resolve(projectRoot, '.local/github-two-account'), port = 4064, fetchImpl = fetch, output = value => process.stdout.write(value) } = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
  const lockPath = resolve(directory, 'run.lock');
  let lock;
  try { lock = openSync(lockPath, 'wx', 0o600); }
  catch { throw failure('trial_already_locked', '같은 시험의 실행 잠금이 있습니다. 중복 실행을 중단했습니다. 실행 프로세스와 상태를 확인한 뒤 잠금을 수동 정리해주세요.'); }
  try { writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + '\n'); await runTrialUnlocked(accounts, { directory, port, fetchImpl, output }); }
  finally { closeSync(lock); unlinkSync(lockPath); }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.command === '--help') { process.stdout.write(help + '\n'); return; }
  const accounts = await preflight({ reviewer: args.reviewer });
  process.stdout.write(JSON.stringify({ checkedAt: new Date().toISOString(), mode: args.command.slice(2), repository: `${TEST_REPOSITORY.owner}/${TEST_REPOSITORY.repo}`, repositoryId: TEST_REPOSITORY.repositoryId, private: true, author: { login: accounts.author.login, id: accounts.author.id }, reviewer: { login: accounts.reviewer.login, id: accounts.reviewer.id }, baseSha: accounts.author.headSha, permissionCheck: '두 계정의 저장소 pull·push 역할 확인. 개별 토큰의 리뷰 쓰기 범위는 실제 POST에서 확인합니다.', externalWrites: args.command === '--run', limitations: ['기존 GitHub CLI 자격증명을 합성 학생 두 명에 명시 연결합니다. Supabase OAuth 인증 검증이 아닙니다.', 'GitHub App installationId 1은 로컬 테스트용 자리표시자입니다. App 설치·Webhook 수신 검증이 아닙니다.'] }, null, 2) + '\n');
  if (args.command === '--run') await runTrial(accounts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    // 외부 CLI stderr·GitHub 원문·오류 스택은 노출하지 않습니다.
    const safeCode = typeof error.code === 'string' ? error.code.replace(/[^a-z_]/g, '') : 'local_assertion_failed';
    process.stderr.write(`${safeCode}: ${error.code && safeCode ? error.message : '로컬 검증이 실패했습니다. 상태 파일의 단계와 검증 조건을 확인해주세요.'}\n`); process.exitCode = 1;
  });
}
