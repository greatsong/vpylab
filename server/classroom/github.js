import { createHash, createHmac, sign, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { HttpError } from './store.js';

const MAX_CODE_BYTES = 50 * 1024;
const encodePath = value => value.split('/').map(encodeURIComponent).join('/');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const iso = milliseconds => new Date(milliseconds).toISOString();
const parse = value => JSON.parse(value || '{}');
const fail = (status, code, message, extra) => new HttpError(status, code, message, extra);

export class GitHubError extends Error {
  constructor(code, message, { status = 502, retryAt = null, permanent = false, uncertain = false } = {}) {
    super(message); Object.assign(this, { code, status, retryAt, permanent, uncertain });
  }
}

export function verifyGitHubSignature(rawBody, signature, secret) {
  if (!secret || !Buffer.isBuffer(rawBody) || !/^sha256=[a-f\d]{64}$/i.test(signature || '')) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(signature.slice(7), 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function createAppJwt({ appId, privateKey, now = Date.now() }) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: Math.floor(now / 1000) - 60, exp: Math.floor(now / 1000) + 540, iss: String(appId) })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

export function githubConfigFromEnv(env = process.env) {
  let repositories = [];
  try { repositories = JSON.parse(env.CLASSROOM_GITHUB_REPOSITORIES || '[]'); } catch { throw new Error('CLASSROOM_GITHUB_REPOSITORIES JSON 형식이 올바르지 않습니다.'); }
  return { mode: env.CLASSROOM_GITHUB_MODE, appId: env.CLASSROOM_GITHUB_APP_ID, privateKey: env.CLASSROOM_GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n'), webhookSecret: env.CLASSROOM_GITHUB_WEBHOOK_SECRET, repositories };
}

function validBinding(input) {
  if (!input || !/^[\w.-]+$/.test(input.owner || '') || !/^[\w.-]+$/.test(input.repo || '') || !Number.isSafeInteger(Number(input.installationId)) || Number(input.installationId) <= 0 || !Number.isSafeInteger(Number(input.repositoryId)) || Number(input.repositoryId) <= 0) throw fail(400, 'invalid_repository_config', '서버의 GitHub 저장소 설정을 확인해주세요.');
  const branch = input.branch || 'main', path = input.path || 'main.py';
  if (!/^[\w./-]+$/.test(branch) || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/') || branch.endsWith('.') || branch.includes('//') || !/^[\w./-]+\.py$/.test(path) || path.split('/').some(part => !part || part === '..' || part.startsWith('.'))) throw fail(400, 'invalid_repository_config', '기본 브랜치와 Python 파일 경로를 확인해주세요.');
  return { key: String(input.key || `${input.owner}/${input.repo}`), owner: input.owner, repo: input.repo, branch, path, installationId: Number(input.installationId), repositoryId: Number(input.repositoryId), projectId: input.projectId || null, allowPublic: input.allowPublic === true };
}

export function classifyGitHubResponse(response, now = Date.now(), body = null) {
  const retryAfter = response.headers.get('retry-after');
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (response.status === 429 || ((response.status === 403) && (retryAfter !== null || remaining === '0' || /rate limit|abuse/i.test(body?.message || '')))) {
    const delay = retryAfter === null ? NaN : Number(retryAfter);
    const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
    const retryAt = Number.isFinite(delay) ? now + Math.max(1, delay) * 1000 : Math.max(now + 60_000, Number.isFinite(reset) ? reset + 1000 : 0);
    return new GitHubError('rate_limited', 'GitHub 요청 제한으로 대기 중입니다.', { status: 429, retryAt });
  }
  if (response.status === 401 || response.status === 403) return new GitHubError('github_auth_required', 'GitHub App 설치·권한을 교사가 확인해야 합니다.', { status: 503, permanent: true });
  if (response.status === 404) return new GitHubError('github_not_found', '연결된 GitHub 저장소 또는 파일을 찾을 수 없습니다.', { status: 404, permanent: true });
  if (response.status >= 500) return new GitHubError('github_unavailable', 'GitHub 응답이 지연되고 있습니다. 저장한 작업은 보존됩니다.');
  return new GitHubError('github_rejected', 'GitHub에서 요청을 거부했습니다. 저장소 설정과 변경 사항을 확인해주세요.', { status: response.status, permanent: true });
}

export function createGitHubAppClient({ config, fetchImpl = fetch, now = Date.now, pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) }) {
  const tokenCache = new Map();
  let lastMutation = -Infinity;
  let requestChain = Promise.resolve();
  function request(path, options = {}) {
    const result = requestChain.then(() => performRequest(path, options));
    requestChain = result.catch(() => {});
    return result;
  }
  async function performRequest(path, { method = 'GET', body, token, allow404 = false, guard } = {}) {
    if (method !== 'GET') { const delay = 1000 - (now() - lastMutation); if (delay > 0) await pause(delay); lastMutation = now(); }
    guard?.();
    let response;
    try {
      response = await fetchImpl(`https://api.github.com${path}`, { method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'VPyLab-Classroom', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20_000), redirect: 'error' });
    } catch { throw new GitHubError('github_network', 'GitHub 연결이 끊겼습니다. 저장한 작업은 보존됩니다.', { uncertain: method !== 'GET' }); }
    if (allow404 && response.status === 404) return null;
    if (!response.ok) { let errorBody; try { errorBody = await response.json(); } catch {} throw classifyGitHubResponse(response, now(), errorBody); }
    return response.status === 204 ? null : response.json();
  }
  async function tokenFor(binding) {
    if (!config.appId || !config.privateKey) throw new GitHubError('github_offline', 'GitHub App 설정이 없습니다. 로컬 저장은 계속 사용할 수 있습니다.', { permanent: true, status: 503 });
    const key = `${binding.installationId}:${binding.repositoryId}`;
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > now() + 60_000) return cached.token;
    let jwt;
    try { jwt = createAppJwt({ ...config, now: now() }); } catch { throw new GitHubError('github_auth_required', 'GitHub App 개인 키 설정을 확인해주세요.', { permanent: true, status: 503 }); }
    const result = await request(`/app/installations/${binding.installationId}/access_tokens`, { method: 'POST', token: jwt, body: { repository_ids: [binding.repositoryId], permissions: { contents: 'write', issues: 'write', pull_requests: 'write' } } });
    tokenCache.set(key, { token: result.token, expiresAt: Date.parse(result.expires_at) });
    return result.token;
  }
  const root = binding => `/repos/${encodeURIComponent(binding.owner)}/${encodeURIComponent(binding.repo)}`;
  async function api(binding, path, options) {
    const token = await tokenFor(binding);
    try { return await request(`${root(binding)}${path}`, { ...options, token }); }
    catch (error) { if (error.code === 'github_auth_required') tokenCache.delete(`${binding.installationId}:${binding.repositoryId}`); throw error; }
  }
  async function validateRepository(binding) {
    const repository = await api(binding, '');
    if (repository.id !== binding.repositoryId || repository.owner?.login?.toLowerCase() !== binding.owner.toLowerCase() || repository.name?.toLowerCase() !== binding.repo.toLowerCase()) throw new GitHubError('repository_binding_mismatch', '서버에 등록된 저장소 식별자와 GitHub 응답이 다릅니다.', { permanent: true, status: 403 });
    if (!repository.private && !binding.allowPublic) throw new GitHubError('private_repository_required', '학생 프로젝트는 비공개 저장소로 연결해주세요.', { permanent: true, status: 403 });
    return repository;
  }
  async function readFile(binding, ref) {
    const file = await api(binding, `/contents/${encodePath(binding.path)}?ref=${encodeURIComponent(ref)}`, { allow404: true });
    if (!file) return { code: '', missing: true, fileSha: null };
    if (file.type !== 'file' || file.encoding !== 'base64' || file.size > MAX_CODE_BYTES) throw new GitHubError('remote_file_too_large', 'GitHub Python 파일은 50KB 이하여야 합니다.', { permanent: true, status: 422 });
    const bytes = Buffer.from(file.content || '', 'base64');
    if (bytes.length > MAX_CODE_BYTES || bytes.toString('utf8').includes('\uFFFD')) throw new GitHubError('remote_file_invalid', 'UTF-8 Python 파일을 확인해주세요.', { permanent: true, status: 422 });
    return { code: bytes.toString('utf8'), fileSha: file.sha, missing: false };
  }
  async function head(binding) { return (await api(binding, `/git/ref/heads/${encodePath(binding.branch)}`)).object.sha; }
  async function fetchRemote(binding) {
    await validateRepository(binding);
    const sha = await head(binding);
    return { sha, ...await readFile(binding, sha), fetchedAt: iso(now()), available: true };
  }
  async function publishProposal(binding, job, progress, saveProgress, guard) {
    await validateRepository(binding);
    const { code, baseSha, title, message } = job.payload;
    const branch = `vpylab/proposal-${job.id}-${sha256(code).slice(0, 10)}`;
    // 고유 브랜치의 기존 PR 조회로 응답 유실 후 재시도에도 중복 PR을 만들지 않습니다.
    const pulls = await api(binding, `/pulls?state=all&head=${encodeURIComponent(`${binding.owner}:${branch}`)}&base=${encodeURIComponent(binding.branch)}&per_page=100`);
    if (pulls.length) return { number: pulls[0].number, url: pulls[0].html_url, branch, sha: pulls[0].head.sha, state: pulls[0].state };
    const currentSha = await head(binding);
    if (currentSha !== baseSha) throw new GitHubError('github_base_conflict', 'GitHub 기본 브랜치가 변경되었습니다. 최신 코드를 가져와 비교한 후 새 제안을 만들어주세요.', { permanent: true, status: 409 });
    let ref = await api(binding, `/git/ref/heads/${encodePath(branch)}`, { allow404: true });
    if (ref) {
      const commit = await api(binding, `/git/commits/${ref.object.sha}`);
      const file = await readFile(binding, ref.object.sha);
      if (commit.parents?.[0]?.sha !== baseSha || file.code !== code) throw new GitHubError('proposal_branch_conflict', '제안 브랜치가 외부에서 변경되었습니다. 새 제안으로 다시 제출해주세요.', { permanent: true, status: 409 });
    } else {
      if (!progress.commitSha) {
        const base = await api(binding, `/git/commits/${baseSha}`);
        const tree = await api(binding, '/git/trees', { method: 'POST', guard, body: { base_tree: base.tree.sha, tree: [{ path: binding.path, mode: '100644', type: 'blob', content: code }] } });
        const commit = await api(binding, '/git/commits', { method: 'POST', guard, body: { message: message || title, tree: tree.sha, parents: [baseSha] } });
        progress.commitSha = commit.sha; saveProgress(progress);
      }
      try { ref = await api(binding, '/git/refs', { method: 'POST', guard, body: { ref: `refs/heads/${branch}`, sha: progress.commitSha } }); }
      catch (error) { if (error.code !== 'github_rejected' || error.status !== 422) throw error; ref = await api(binding, `/git/ref/heads/${encodePath(branch)}`); if (ref.object.sha !== progress.commitSha) throw new GitHubError('proposal_branch_conflict', '제안 브랜치가 이미 존재합니다.', { permanent: true, status: 409 }); }
    }
    if (await head(binding) !== baseSha) throw new GitHubError('github_base_conflict', 'GitHub 기본 브랜치가 변경되었습니다. 최신 코드와 비교해주세요.', { permanent: true, status: 409 });
    const provenance = job.payload.checkpointId ? `\n팀 저장본: ${job.payload.checkpointId} (v${job.payload.checkpointVersion})` : '';
    const pull = await api(binding, '/pulls', { method: 'POST', guard, body: { title, head: branch, base: binding.branch, body: `${message || ''}\n\nVPyLab 학습 제안 · 작업 ${job.id}\n기준 커밋: ${baseSha}${provenance}` } });
    return { number: pull.number, url: pull.html_url, branch, sha: ref.object.sha, state: pull.state };
  }
  async function createIssue(binding, job, progress, saveProgress, guard) {
    if (progress.issue) return progress.issue;
    await validateRepository(binding);
    // Issue API에는 원자적 중복 방지 키가 없으므로 전송 여부 불명 상태는 수동 확인합니다.
    if (progress.issueSending) throw new GitHubError('github_issue_uncertain', 'Issue 생성 응답이 유실되었습니다. GitHub에서 생성 여부를 교사가 확인해주세요.', { permanent: true, uncertain: true });
    progress.issueSending = true; saveProgress(progress);
    let issue;
    try { issue = await api(binding, '/issues', { method: 'POST', guard, body: { title: job.payload.title, body: `${job.payload.body || ''}\n\n<!-- vpylab-job:${job.id} -->` } }); }
    catch (error) { if (error.code === 'github_unavailable') error.uncertain = true; if (!error.uncertain) { progress.issueSending = false; saveProgress(progress); } throw error; }
    progress.issue = { number: issue.number, url: issue.html_url }; saveProgress(progress); return progress.issue;
  }
  async function reconcileIssue(binding, job, number) {
    await validateRepository(binding);
    const issue = await api(binding, `/issues/${number}`);
    if (issue.pull_request || !issue.body?.includes(`<!-- vpylab-job:${job.id} -->`)) throw new GitHubError('github_issue_mismatch', '이 작업으로 생성한 GitHub Issue가 아닙니다.', { permanent: true, status: 409 });
    return { number: issue.number, url: issue.html_url };
  }
  return { fetchRemote, publishProposal, createIssue, reconcileIssue };
}

export function createGitHubService({ store, localMode = false, config = githubConfigFromEnv(), fetchImpl, now = Date.now, pause } = {}) {
  const mode = config.mode || (localMode ? 'simulator' : 'offline');
  if (!['simulator', 'offline', 'live'].includes(mode) || (!localMode && mode === 'simulator')) throw new Error('GitHub simulator는 로컬 수업 실험 모드에서만 사용할 수 있습니다.');
  const repositories = (config.repositories || []).map(validBinding);
  const client = createGitHubAppClient({ config, fetchImpl, now, pause });
  const db = store.db;
  db.exec(`CREATE TABLE IF NOT EXISTS github_job_progress(job_id TEXT PRIMARY KEY REFERENCES github_jobs(id),data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS github_webhook_deliveries(id TEXT PRIMARY KEY,digest TEXT NOT NULL,event TEXT NOT NULL,received_at TEXT NOT NULL);`);
  let timer, busy = false;
  const idleWaiters = [];
  function publicBinding(binding) { if (!binding) return null; const { key, owner, repo, branch, path, repositoryId } = binding; return { key, owner, repo, branch, path, repositoryId }; }
  function ensureState(projectId) {
    const existing = store.getGithub(projectId);
    if (existing) return existing;
    const project = store.getProject(projectId);
    if (!project) throw fail(404, 'project_not_found', '프로젝트를 찾을 수 없습니다.');
    const state = { mode, binding: null, remote: null };
    if (mode === 'simulator') { state.binding = { key: 'simulator', owner: 'local-classroom', repo: `team-${projectId.slice(0, 8)}`, branch: 'main', path: 'main.py' }; state.remote = { sha: sha256(`initial:${projectId}:${project.code}`).slice(0, 40), code: project.code, available: true, fetchedAt: iso(now()), simulated: true }; state.simulatedPulls = []; state.simulatedIssues = []; }
    return store.setGithub(projectId, state);
  }
  function trustedBinding(projectId) {
    const state = ensureState(projectId);
    if (mode === 'simulator') return state.binding;
    const binding = repositories.find(candidate => candidate.key === state.binding?.key && (!candidate.projectId || candidate.projectId === projectId));
    if (!binding || binding.repositoryId !== state.binding?.repositoryId) throw new GitHubError('repository_binding_required', '교사가 서버에 허용된 GitHub 저장소를 연결해야 합니다.', { permanent: true, status: 409 });
    return binding;
  }
  function assertOnline() { if (mode === 'offline') throw new GitHubError('github_offline', 'GitHub 연결을 기다리고 있습니다. 초안과 팀 저장본은 로컬 서버에 보존됩니다.', { permanent: true, status: 503 }); }
  const service = {
    mode,
    status(projectId, actor) {
      store.accessProject(projectId, actor);
      const state = ensureState(projectId);
      return { mode, binding: publicBinding(state.binding), remote: state.remote, lastEvent: state.lastEvent || null, simulatedPulls: state.simulatedPulls || [], simulatedIssues: state.simulatedIssues || [], jobs: service.jobs(projectId), repositories: repositories.filter(binding => !binding.projectId || binding.projectId === projectId).map(publicBinding) };
    },
    jobs(projectId) { return store.getJobs(projectId).map(({ payload, ...job }) => ({ ...job, result: parse(db.prepare('SELECT data FROM github_job_progress WHERE job_id=?').get(job.id)?.data).result || null })); },
    bind(projectId, actor, key) {
      store.accessProject(projectId, actor, { manage: true });
      if (actor.role !== 'teacher') throw fail(403, 'teacher_required', '팀 GitHub 저장소는 교사만 연결할 수 있습니다.');
      if (mode === 'simulator') throw fail(409, 'simulator_binding', '로컬 모의 저장소가 이미 연결되어 있습니다.');
      const binding = repositories.find(candidate => candidate.key === key && (!candidate.projectId || candidate.projectId === projectId));
      if (!binding) throw fail(403, 'repository_not_allowed', '서버에 허용된 팀 저장소만 연결할 수 있습니다.');
      db.prepare("UPDATE github_jobs SET state='blocked',last_error=?,updated_at=? WHERE project_id=? AND kind!='checkpoint' AND state IN ('pending','running')").run('repository_binding_changed: 저장소 연결이 변경되어 기존 요청을 중지했습니다.', iso(now()), projectId);
      store.setGithub(projectId, { mode, binding, remote: null });
      return service.status(projectId, actor);
    },
    async fetchRemote(projectId, actor) {
      store.accessProject(projectId, actor); assertOnline();
      const binding = trustedBinding(projectId), state = ensureState(projectId);
      const remote = mode === 'simulator' ? { ...state.remote, fetchedAt: iso(now()) } : await client.fetchRemote(binding);
      // 외부 코드 가져오기는 비교본만 갱신합니다. 팀 저장본은 버전 검사를 거쳐 별도로 반영합니다.
      const currentState = ensureState(projectId);
      if (currentState.binding?.key !== state.binding?.key || currentState.binding?.repositoryId !== state.binding?.repositoryId) throw new GitHubError('repository_binding_changed', '가져오는 동안 저장소 연결이 변경되었습니다. 다시 시도해주세요.', { permanent: true, status: 409 });
      store.setGithub(projectId, { ...currentState, mode, remote });
      return service.status(projectId, actor);
    },
    enqueueProposal(projectId, actor, input) {
      store.accessProject(projectId, actor, { write: true });
      const state = ensureState(projectId);
      let checkpoint = null;
      if (input.checkpointId !== undefined) {
        checkpoint = store.checkpoints(projectId).find(candidate => candidate.id === input.checkpointId);
        if (!checkpoint || checkpoint.code !== input.code) throw fail(409, 'checkpoint_binding_mismatch', '이 프로젝트에 확정된 동일 저장본만 GitHub 제안으로 보낼 수 있습니다.');
      }
      input = { ...input, message: input.message ?? checkpoint?.message ?? '' };
      if (typeof input.code !== 'string' || Buffer.byteLength(input.code) > MAX_CODE_BYTES || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200 || typeof input.message !== 'string' || input.message.length > 10_000 || !/^[a-f\d]{40}$/i.test(input.baseSha || '')) throw fail(400, 'invalid_github_proposal', '제목, 설명, 기준 커밋과 50KB 이하 코드를 확인해주세요.');
      if (state.remote?.sha !== input.baseSha) throw fail(409, 'github_base_conflict', '먼저 GitHub 최신 코드를 가져와 비교해주세요.');
      if (state.remote.code === input.code) throw fail(409, 'nothing_to_publish', 'GitHub 코드와 이미 같습니다. 변경한 팀 저장본을 확정한 뒤 제안해주세요.');
      const binding = trustedBinding(projectId);
      const dedupeKey = `github-proposal:${projectId}:${sha256(JSON.stringify([binding.key, input.baseSha, input.code, input.title, input.message]))}`;
      return store.enqueueJob({ projectId, kind: 'proposal', payload: { code: input.code, title: input.title.trim(), message: input.message, baseSha: input.baseSha, authorId: actor.id, checkpointId: checkpoint?.id || null, checkpointVersion: checkpoint?.version ?? null, bindingKey: binding.key, repositoryId: binding.repositoryId || null }, dedupeKey });
    },
    enqueueIssue(projectId, actor, input) {
      store.accessProject(projectId, actor, { write: true });
      if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200 || typeof input.body !== 'string' || input.body.length > 20_000 || typeof input.issueId !== 'string' || input.issueId.length > 100) throw fail(400, 'invalid_github_issue', 'Issue 제목과 설명을 확인해주세요.');
      const issue = store.issues(projectId).find(candidate => candidate.id === input.issueId);
      if (!issue || issue.title !== input.title || issue.body !== input.body) throw fail(409, 'issue_binding_mismatch', '프로젝트에 저장된 문제 정의만 GitHub Issue로 내보낼 수 있습니다.');
      const binding = trustedBinding(projectId);
      return store.enqueueJob({ projectId, kind: 'issue', payload: { ...input, bindingKey: binding.key, repositoryId: binding.repositoryId || null, authorId: actor.id }, dedupeKey: `github-issue:${projectId}:${input.issueId}:${binding.key}` });
    },
    simulatePush(projectId, actor, input) {
      store.accessProject(projectId, actor, { manage: true });
      if (mode !== 'simulator') throw fail(404, 'simulator_only', '모의 저장소에서만 사용할 수 있습니다.');
      const state = ensureState(projectId);
      if (input.baseSha !== state.remote.sha) throw fail(409, 'github_base_conflict', '모의 저장소의 최신 커밋이 변경되었습니다.');
      if (typeof input.code !== 'string' || Buffer.byteLength(input.code) > MAX_CODE_BYTES) throw fail(400, 'invalid_code', '50KB 이하 코드를 입력해주세요.');
      store.setGithub(projectId, { ...state, remote: { ...state.remote, sha: sha256(`${state.remote.sha}:${input.code}`).slice(0, 40), code: input.code, fetchedAt: iso(now()) } });
      return service.status(projectId, actor);
    },
    retry(projectId, jobId, actor) {
      store.accessProject(projectId, actor, { manage: true });
      const job = store.getJobs(projectId).find(candidate => candidate.id === jobId);
      if (!job || !['blocked', 'failed'].includes(job.state)) throw fail(409, 'job_not_retryable', '교사의 확인이 필요한 작업만 다시 시도할 수 있습니다.');
      if (job.lastError?.startsWith('github_issue_uncertain') || job.lastError?.startsWith('github_network') && job.kind === 'issue') throw fail(409, 'manual_issue_check_required', '중복 생성을 막기 위해 GitHub에서 Issue 생성 여부를 먼저 확인해주세요.');
      db.prepare("UPDATE github_jobs SET state='pending',attempts=0,available_at=?,updated_at=? WHERE id=?").run(iso(now()), iso(now()), job.id);
      return service.jobs(projectId).find(candidate => candidate.id === job.id);
    },
    async reconcileIssue(projectId, jobId, actor, number) {
      store.accessProject(projectId, actor, { manage: true });
      if (actor.role !== 'teacher') throw fail(403, 'teacher_required', 'GitHub 응답 유실 확인은 교사만 할 수 있습니다.');
      const job = store.getJobs(projectId).find(candidate => candidate.id === jobId);
      if (!job || job.kind !== 'issue' || job.state !== 'blocked' || !Number.isSafeInteger(number) || number < 1 || mode !== 'live') throw fail(409, 'issue_reconciliation_unavailable', '확인이 필요한 GitHub Issue 작업과 번호를 선택해주세요.');
      const binding = trustedBinding(projectId);
      if (job.payload.bindingKey !== binding.key || job.payload.repositoryId !== binding.repositoryId) throw fail(409, 'repository_binding_changed', '이 작업의 저장소 연결이 변경되었습니다.');
      const result = await client.reconcileIssue(binding, job, number);
      const progress = parse(db.prepare('SELECT data FROM github_job_progress WHERE job_id=?').get(job.id)?.data);
      db.prepare('INSERT INTO github_job_progress VALUES(?,?) ON CONFLICT(job_id) DO UPDATE SET data=excluded.data').run(job.id, JSON.stringify({ ...progress, issue: result, result }));
      db.prepare("UPDATE github_jobs SET state='succeeded',last_error=NULL,updated_at=? WHERE id=? AND state='blocked'").run(iso(now()), job.id);
      return service.jobs(projectId).find(candidate => candidate.id === job.id);
    },
    async runOnce() {
      if (busy) return null; busy = true;
      try {
        const job = store.transaction(() => {
          db.prepare("UPDATE github_jobs SET state='pending',available_at=?,updated_at=? WHERE state='running' AND updated_at<?").run(iso(now()), iso(now()), iso(now() - 5 * 60_000));
          const row = db.prepare("SELECT * FROM github_jobs WHERE state='pending' AND available_at<=? ORDER BY created_at,id LIMIT 1").get(iso(now()));
          if (!row) return null;
          db.prepare("UPDATE github_jobs SET state='running',attempts=attempts+1,updated_at=? WHERE id=? AND state='pending'").run(iso(now()), row.id);
          return { id: row.id, projectId: row.project_id, kind: row.kind, payload: parse(row.payload), attempts: row.attempts + 1, createdAt: row.created_at };
        });
        if (!job) return null;
        const progress = parse(db.prepare('SELECT data FROM github_job_progress WHERE job_id=?').get(job.id)?.data);
        const saveProgress = data => db.prepare('INSERT INTO github_job_progress VALUES(?,?) ON CONFLICT(job_id) DO UPDATE SET data=excluded.data').run(job.id, JSON.stringify(data));
        try {
          let result;
          if (job.kind === 'checkpoint') result = { localOnly: true, message: '팀 저장본이 보존되었습니다. GitHub 반영은 별도 제안으로 진행합니다.' };
          else {
            assertOnline(); const binding = trustedBinding(job.projectId);
            const guard = () => {
              const currentBinding = trustedBinding(job.projectId);
              const currentJob = db.prepare('SELECT state FROM github_jobs WHERE id=?').get(job.id);
              if (job.payload.bindingKey !== currentBinding.key || job.payload.repositoryId !== (currentBinding.repositoryId || null) || currentJob?.state !== 'running') throw new GitHubError('repository_binding_changed', '저장소 연결이 변경되어 기존 요청을 중지했습니다.', { permanent: true, status: 409 });
            };
            guard();
            if (mode === 'simulator') {
              const state = ensureState(job.projectId);
              if (job.kind === 'proposal') {
                const existing = (state.simulatedPulls || []).find(pull => pull.jobId === job.id);
                if (existing) result = existing;
                else { if (state.remote.sha !== job.payload.baseSha) throw new GitHubError('github_base_conflict', '모의 GitHub 기본 브랜치가 변경되었습니다. 최신 코드와 비교해주세요.', { permanent: true, status: 409 }); result = { jobId: job.id, number: (state.simulatedPulls || []).length + 1, title: job.payload.title, baseSha: job.payload.baseSha, branch: `vpylab/proposal-${job.id}`, state: 'open', simulated: true, url: null }; store.setGithub(job.projectId, { ...state, simulatedPulls: [...state.simulatedPulls || [], result] }); }
              } else if (job.kind === 'issue') { result = { jobId: job.id, number: (state.simulatedIssues || []).length + 1, title: job.payload.title, simulated: true, url: null }; store.setGithub(job.projectId, { ...state, simulatedIssues: [...state.simulatedIssues || [], result] }); }
              else throw new GitHubError('unknown_job', '지원되지 않는 GitHub 작업입니다.', { permanent: true });
            } else if (job.kind === 'proposal') result = await client.publishProposal(binding, job, progress, saveProgress, guard);
            else if (job.kind === 'issue') result = await client.createIssue(binding, job, progress, saveProgress, guard);
            else throw new GitHubError('unknown_job', '지원되지 않는 GitHub 작업입니다.', { permanent: true });
          }
          saveProgress({ ...progress, result });
          db.prepare("UPDATE github_jobs SET state='succeeded',last_error=NULL,updated_at=? WHERE id=?").run(iso(now()), job.id);
        } catch (error) {
          const known = error instanceof GitHubError;
          const blocked = known && (error.permanent || error.uncertain && job.kind === 'issue');
          const state = blocked ? 'blocked' : job.attempts >= 8 ? 'failed' : 'pending';
          const availableAt = error.retryAt || now() + Math.min(3_600_000, 60_000 * 2 ** Math.min(job.attempts - 1, 6));
          db.prepare('UPDATE github_jobs SET state=?,available_at=?,last_error=?,updated_at=? WHERE id=?').run(state, iso(availableAt), `${known ? error.code : 'github_internal'}: ${known ? error.message : 'GitHub 작업을 처리하지 못했습니다. 로컬 저장본은 보존됩니다.'}`, iso(now()), job.id);
        }
        return service.jobs(job.projectId).find(candidate => candidate.id === job.id);
      } finally { busy = false; for (const resolve of idleWaiters.splice(0)) resolve(); }
    },
    startWorker({ intervalMs = 1000 } = {}) { if (!timer) { timer = setInterval(() => { service.runOnce().catch(() => {}); }, intervalMs); timer.unref?.(); } return service; },
    stopWorker() { clearInterval(timer); timer = null; return busy ? new Promise(resolve => idleWaiters.push(resolve)) : Promise.resolve(); },
    webhook(rawBody, headers) {
      if (!verifyGitHubSignature(rawBody, headers['x-hub-signature-256'], config.webhookSecret)) throw fail(401, 'invalid_webhook_signature', 'GitHub Webhook 서명을 확인할 수 없습니다.');
      const deliveryId = headers['x-github-delivery'], event = headers['x-github-event'];
      if (typeof deliveryId !== 'string' || !/^[\w-]{1,128}$/.test(deliveryId) || typeof event !== 'string' || event.length > 100) throw fail(400, 'invalid_webhook', 'Webhook 전송 정보를 확인해주세요.');
      let payload; try { payload = JSON.parse(rawBody.toString('utf8')); } catch { throw fail(400, 'invalid_webhook_json', 'Webhook JSON 형식이 올바르지 않습니다.'); }
      return store.transaction(() => {
        const digest = sha256(rawBody), existing = db.prepare('SELECT digest FROM github_webhook_deliveries WHERE id=?').get(deliveryId);
        if (existing) { if (existing.digest !== digest) throw fail(409, 'webhook_delivery_conflict', '같은 전송 ID의 본문이 변경되었습니다.'); return { accepted: true, duplicate: true }; }
        db.prepare('INSERT INTO github_webhook_deliveries VALUES(?,?,?,?)').run(deliveryId, digest, event, iso(now()));
        let matched = 0;
        if (['push', 'pull_request', 'installation', 'installation_repositories'].includes(event)) {
          if (['push', 'pull_request'].includes(event) && !Number.isSafeInteger(payload.repository?.id)) return { accepted: true, duplicate: false, matched: 0 };
          for (const row of db.prepare('SELECT project_id,data FROM github_bindings').all()) {
            const state = parse(row.data), binding = repositories.find(candidate => candidate.key === state.binding?.key && (!candidate.projectId || candidate.projectId === row.project_id));
            if (!binding || binding.installationId !== payload.installation?.id || payload.repository && binding.repositoryId !== payload.repository.id) continue;
            if (event === 'push' && payload.ref !== `refs/heads/${binding.branch}`) continue;
            matched++;
            const revoked = (event === 'installation' && ['deleted', 'suspend'].includes(payload.action)) || (event === 'installation_repositories' && payload.repositories_removed?.some(repository => repository.id === binding.repositoryId));
            store.setGithub(row.project_id, { ...state, remote: state.remote ? { ...state.remote, available: !revoked, stale: true } : null, lastEvent: { event, action: payload.action || null, receivedAt: iso(now()), revoked } });
            if (revoked) db.prepare("UPDATE github_jobs SET state='blocked',last_error=?,updated_at=? WHERE project_id=? AND kind!='checkpoint' AND state IN ('pending','running')").run('github_auth_required: GitHub App 설치가 중지되거나 저장소 권한이 회수되었습니다.', iso(now()), row.project_id);
          }
        }
        return { accepted: true, duplicate: false, matched };
      });
    },
  };
  return service;
}

export function createGitHubRouter({ store, requireActor, localMode = false, service = createGitHubService({ store, localMode }) }) {
  const router = express.Router();
  router.use('/projects/:id/github', requireActor);
  router.get('/projects/:id/github', (req, res) => res.json(service.status(req.params.id, req.actor)));
  router.put('/projects/:id/github', (req, res) => res.json(service.bind(req.params.id, req.actor, req.body?.repositoryKey)));
  router.post('/projects/:id/github/fetch', async (req, res) => res.json(await service.fetchRemote(req.params.id, req.actor)));
  router.post('/projects/:id/github/proposals', (req, res) => res.status(202).json({ job: service.enqueueProposal(req.params.id, req.actor, req.body || {}) }));
  router.post('/projects/:id/github/issues', (req, res) => res.status(202).json({ job: service.enqueueIssue(req.params.id, req.actor, req.body || {}) }));
  router.post('/projects/:id/github/simulate-push', (req, res) => res.json(service.simulatePush(req.params.id, req.actor, req.body || {})));
  router.post('/projects/:id/github/jobs/:jobId/retry', (req, res) => res.json({ job: service.retry(req.params.id, req.params.jobId, req.actor) }));
  router.post('/projects/:id/github/jobs/:jobId/reconcile-issue', async (req, res) => res.json({ job: await service.reconcileIssue(req.params.id, req.params.jobId, req.actor, req.body?.number) }));
  return router;
}

// express.json 및 세션/CSRF 미들웨어보다 먼저 이 라우터를 연결해야 원본 바이트를 검증합니다.
export function createGitHubWebhookRouter({ service }) {
  const router = express.Router();
  router.post('/github/webhook', express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => res.status(202).json(service.webhook(req.body, req.headers)));
  return router;
}
