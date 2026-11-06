import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import projects from './projects.js';
import sync from './sync.js';

const nativeFetch = globalThis.fetch;
const priorUrl = process.env.SUPABASE_URL, priorKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_URL = 'https://github-route-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
let server, base, mode, calls, patches, newer;
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  const method = options.method || 'GET';
  if (url.hostname === '127.0.0.1') return nativeFetch(input, options);
  calls.push({ url, method, body: options.body ? JSON.parse(options.body) : null });
  if (url.hostname === 'github-route-test.invalid') {
    if (url.pathname === '/auth/v1/user') return response({ id: 'user-a' });
    if (url.pathname.endsWith('/vpylab_projects')) return response(mode === 'linked-project' ? [{ id: 'project-a', github_repo: 'maintainer/team' }] : []);
    if (url.pathname.endsWith('/vpylab_project_members')) return response([{ project_id: 'project-a', role: 'owner' }]);
    if (url.pathname.endsWith('/vpylab_gallery')) return response([]);
    if (url.pathname.endsWith('/vpylab_code_revisions')) {
      if (mode === 'revision-unavailable') return response({ message: 'fixture read failure' }, 400);
      if (mode === 'revision-missing') return response([]);
      if (url.searchParams.has('id')) return response([{ id: 'revision-a', code_id: 'code-a', created_at: '2026-11-06T00:00:00Z' }]);
      return response([{ id: newer ? 'revision-b' : 'revision-a', created_at: '2026-11-06T00:00:01Z' }]);
    }
    throw new Error(`알 수 없는 fixture 조회: ${url.pathname}`);
  }
  assert.equal(url.hostname, 'api.github.com');
  const path = url.pathname;
  if (path === '/user') return response({ login: 'collaborator' });
  if (path === '/user/repos') return response({ name: 'new-test-repo', default_branch: 'master' }, 201);
  if (/^\/repos\/[^/]+\/[^/]+$/.test(path)) {
    if (mode === 'repo-unavailable' || mode === 'new-master') return response({ message: 'Not Found' }, 404);
    if (mode === 'repo-forbidden') return response({ message: 'Forbidden' }, 403);
    return response({ full_name: path.slice('/repos/'.length), permissions: { push: true }, default_branch: ['existing-master', 'master-pages', 'pages-source-mismatch'].includes(mode) ? 'master' : 'main' });
  }
  if (path.includes('/contents/')) {
    if (method === 'PUT') return response({ commit: { sha: 'legacy-commit' } });
    if (mode === 'contents-unavailable') return response({ message: 'temporary failure' }, 500);
    if (path.endsWith('/history.md')) return response({ sha: 'history-sha', content: Buffer.from('# history\n\n').toString('base64') });
    return response({ message: 'Not Found' }, 404);
  }
  if (path.includes('/git/ref/heads/')) return response({ object: { sha: 'head-sha' } });
  if (path.endsWith('/pages') && method === 'GET') return response({ status: 'built', source: { branch: mode === 'pages-source-mismatch' ? 'main' : 'master', path: '/' } });
  if (path.endsWith('/pages/builds')) return response({ status: 'queued' }, 201);
  if (path.includes('/git/commits/') && method === 'GET') return response({ tree: { sha: 'base-tree' } });
  if (path.endsWith('/git/trees')) return response({ sha: 'new-tree' }, 201);
  if (path.endsWith('/git/commits')) return response({ sha: 'new-commit' }, 201);
  if (path.includes('/git/refs/heads/') && method === 'PATCH') {
    patches++;
    assert.equal(JSON.parse(options.body).force, false);
    if (mode === 'conflict-newer' && patches === 1) {
      newer = true;
      return response({ message: 'Not fast forward' }, 409);
    }
    return response({ object: { sha: 'new-commit' } });
  }
  throw new Error(`알 수 없는 GitHub fixture: ${method} ${path}`);
};

before(async () => {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/projects', projects);
  app.use('/sync', sync);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => { mode = 'normal'; calls = []; patches = 0; newer = false; });
after(async () => {
  globalThis.fetch = nativeFetch;
  if (priorUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = priorUrl;
  if (priorKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = priorKey;
  await new Promise(resolve => server.close(resolve));
});
async function post(path, body) {
  const res = await nativeFetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer test-session' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
const legacy = () => ({ code: 'print("new")', title: '검증 작품', existingRepo: 'maintainer/team', githubToken: 'test-github' });
const current = () => ({ code: 'print("new")', title: '검증 작품', repoFullName: 'maintainer/team', githubToken: 'test-github', updateIndex: false, codeId: 'code-a', revisionId: 'revision-a' });

test('개인 이력 전송도 원래 저장소 소유자를 유지한다', async () => {
  const result = await post('/sync/github', legacy());
  assert.equal(result.status, 200);
  assert.equal(result.body.repoFullName, 'maintainer/team');
  assert(calls.some(call => call.method === 'PUT' && call.url.pathname === '/repos/maintainer/team/contents/main.py'));
  assert(!calls.some(call => call.url.pathname.startsWith('/repos/collaborator/')));
});
test('기존 저장소가 없거나 권한이 없으면 같은 이름의 새 저장소를 만들지 않는다', async () => {
  for (const [fixture, status] of [['repo-unavailable', 404], ['repo-forbidden', 403]]) {
    mode = fixture;
    assert.equal((await post('/sync/github', legacy())).status, status);
  }
  assert(!calls.some(call => call.method === 'POST'));
});
test('파일 읽기 500을 빈 파일로 취급해 덮어쓰지 않는다', async () => {
  mode = 'contents-unavailable';
  assert.equal((await post('/sync/github', legacy())).status, 500);
  assert(!calls.some(call => call.method === 'PUT'));
});
test('기존 master 브랜치와 신규 저장소의 기본 브랜치를 유지한다', async () => {
  mode = 'existing-master';
  assert.equal((await post('/sync/github', legacy())).status, 200);
  for (const call of calls.filter(call => call.method === 'PUT')) assert.equal(call.body.branch, 'master');
  calls = []; mode = 'new-master';
  assert.equal((await post('/sync/github', { ...legacy(), existingRepo: undefined })).status, 200);
  const created = calls.find(call => call.url.pathname === '/user/repos');
  assert(/^[a-z0-9-]+$/.test(created.body.name));
  for (const call of calls.filter(call => call.method === 'PUT')) assert.equal(call.body.branch, 'master');
});
test('두 저장소 매개변수가 다르면 어떤 GitHub 쓰기도 하지 않는다', async () => {
  const result = await post('/sync/github', { ...legacy(), repoFullName: 'me/personal' });
  assert.equal(result.status, 400);
  assert(!calls.some(call => call.url.hostname === 'api.github.com'));
});
test('저장 이력 조회 실패 시 이전 코드의 GitHub 반영을 보류한다', async () => {
  mode = 'revision-unavailable';
  const result = await post('/projects/commit', current());
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'revision_check_unavailable');
  assert(!calls.some(call => ['PATCH', 'POST', 'PUT'].includes(call.method)));
});
test('없어진 저장 이력은 일시 장애와 구분해 영구 재시도하지 않는다', async () => {
  mode = 'revision-missing';
  const result = await post('/projects/commit', current());
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'revision_not_found');
  assert.equal(patches, 0);
});
test('팀 저장소의 이전 sync 경로는 새 코드 저장 경로로 안내한다', async () => {
  mode = 'linked-project';
  const result = await post('/sync/github', { ...legacy(), projectId: 'project-a' });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'project_sync_required');
  assert(!calls.some(call => call.url.hostname === 'api.github.com'));
});
test('프로젝트 코드·이력·Pages도 저장소의 master 브랜치를 함께 사용한다', async () => {
  mode = 'master-pages';
  const result = await post('/projects/commit', { ...current(), updateIndex: true });
  assert.equal(result.status, 200);
  assert.equal(result.body.pagesActivated, true);
  const refs = calls.filter(call => call.url.pathname.includes('/git/ref'));
  assert(refs.length > 0);
  assert(refs.every(call => call.url.pathname.endsWith('/master')));
  assert(calls.filter(call => call.url.pathname.includes('/contents/')).every(call => call.url.searchParams.get('ref') === 'master'));
});
test('Pages 소스 브랜치가 다르면 코드 저장은 유지하고 실행 페이지 경고를 표시한다', async () => {
  mode = 'pages-source-mismatch';
  const result = await post('/projects/commit', { ...current(), updateIndex: true });
  assert.equal(result.status, 200);
  assert(result.body.commitSha);
  assert.match(result.body.pagesWarning, /브랜치/);
  assert(!calls.some(call => call.url.pathname.endsWith('/pages/builds')));
});
test('충돌 재시도 중 더 최신 이력이 생기면 이전 코드로 두 번째 ref 갱신을 하지 않는다', async () => {
  mode = 'conflict-newer';
  const result = await post('/projects/commit', current());
  assert.equal(result.status, 200);
  assert.equal(result.body.staleRevision, true);
  assert.equal(patches, 1);
});
test('코드가 문자열이 아니면 외부 API 전에 400을 반환한다', async () => {
  assert.equal((await post('/projects/commit', { ...current(), code: { source: 'invalid' } })).status, 400);
  assert(!calls.some(call => call.url.hostname === 'api.github.com'));
});
