import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { requireSupabaseUser, requireTeamProjectAccess } from './require-supabase-user.js';

const originalFetch = globalThis.fetch;
const previousEnv = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
process.env.SUPABASE_URL = 'https://vpylab-auth-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
let projects, role, unavailable, queries;
const reply = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
});

globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  assert.equal(url.hostname, 'vpylab-auth-test.invalid');
  queries.push(url);
  if (url.pathname === '/auth/v1/user') {
    return new Headers(options.headers).get('authorization') === 'Bearer valid-test-session'
      ? reply({ id: 'user-a' }) : reply({ message: 'invalid session' }, 401);
  }
  if (unavailable) return reply({ message: 'database unavailable' }, 503);
  if (url.pathname.endsWith('/vpylab_projects')) {
    const id = url.searchParams.get('id')?.slice(3);
    return reply(id ? projects.filter(p => p.id === id) : projects);
  }
  if (url.pathname.endsWith('/vpylab_project_members')) {
    return reply(role ? [{ project_id: 'project-a', role }] : []);
  }
  throw new Error(`예상하지 않은 조회: ${url.pathname}`);
};

beforeEach(() => {
  projects = [{ id: 'project-a', github_repo: 'owner/test_repo' }];
  role = 'editor';
  unavailable = false;
  queries = [];
});

after(() => {
  globalThis.fetch = originalFetch;
  if (previousEnv.url === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = previousEnv.url;
  if (previousEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousEnv.key;
});

async function invoke(middleware, req) {
  const result = { status: 200, body: null, next: false };
  const res = {
    status(value) { result.status = value; return this; },
    json(value) { result.body = value; return this; },
  };
  await middleware(req, res, () => { result.next = true; });
  return result;
}

test('누락·잘못된 Supabase 로그인은 GitHub 작업 전에 거부한다', async () => {
  assert.equal((await invoke(requireSupabaseUser, { headers: {} })).status, 401);
  assert.equal((await invoke(requireSupabaseUser, { headers: { authorization: 'Bearer invalid' } })).status, 401);
  const req = { headers: { authorization: 'Bearer valid-test-session' } };
  assert.equal((await invoke(requireSupabaseUser, req)).next, true);
  assert.equal(req.supabaseUser.id, 'user-a');
});

for (const memberRole of ['owner', 'editor']) {
  test(`${memberRole}는 연결된 저장소에 쓸 수 있다`, async () => {
    role = memberRole;
    const req = { supabaseUser: { id: 'user-a' }, body: { projectId: 'project-a', repoFullName: 'OWNER/TEST_REPO' } };
    assert.equal((await invoke(requireTeamProjectAccess, req)).next, true);
    assert.equal(req.authorizedProjectId, 'project-a');
  });
}

test('viewer는 GitHub 토큰에 쓰기 권한이 있어도 프로젝트 쓰기를 거부한다', async () => {
  role = 'viewer';
  const result = await invoke(requireTeamProjectAccess, {
    supabaseUser: { id: 'user-a' }, body: { projectId: 'project-a', repoFullName: 'owner/test_repo' },
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'project_read_only');
});

test('다른 프로젝트 ID로 연결 저장소의 멤버 검사를 대신할 수 없다', async () => {
  const result = await invoke(requireTeamProjectAccess, {
    supabaseUser: { id: 'user-a' }, body: { projectId: 'project-a', repoFullName: 'other/repository' },
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'project_repo_mismatch');
});

test('repoFullName과 existingRepo를 다르게 보내 검사 대상을 바꿀 수 없다', async () => {
  const result = await invoke(requireTeamProjectAccess, {
    supabaseUser: { id: 'user-a' }, body: { repoFullName: 'me/personal', existingRepo: 'owner/test_repo' },
  });
  assert.equal(result.status, 400);
  assert.equal(result.next, false);
});

test('projectId만 있으면 DB 연결 저장소를 쓰고 미연결 프로젝트로 새 저장소를 만들지 않는다', async () => {
  const req = { supabaseUser: { id: 'user-a' }, body: { projectId: 'project-a' } };
  assert.equal((await invoke(requireTeamProjectAccess, req)).next, true);
  assert.equal(req.authorizedRepo, 'owner/test_repo');
  projects[0].github_repo = null;
  assert.equal((await invoke(requireTeamProjectAccess, req)).status, 409);
});

test('이전 이력 동기화의 existingRepo와 대소문자 변형도 멤버십을 확인한다', async () => {
  role = null;
  const result = await invoke(requireTeamProjectAccess, {
    supabaseUser: { id: 'user-a' }, body: { existingRepo: 'OWNER/TEST_REPO' },
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'not_project_member');
  const query = queries.find(url => url.pathname.endsWith('/vpylab_projects'));
  assert.equal(query.searchParams.get('github_repo'), 'ilike.OWNER/TEST\\_REPO');
});

test('프로젝트 권한 조회 실패는 개인 저장소로 간주해 통과시키지 않는다', async () => {
  unavailable = true;
  const result = await invoke(requireTeamProjectAccess, {
    supabaseUser: { id: 'user-a' }, body: { existingRepo: 'owner/test_repo' },
  });
  assert.equal(result.next, false);
  assert.equal(result.status, 500);
});

test('연결된 프로젝트가 없는 개인 저장소와 잘못된 경로를 구분한다', async () => {
  projects = [];
  assert.equal((await invoke(requireTeamProjectAccess, {
    supabaseUser: { id: 'user-a' }, body: { existingRepo: 'owner/personal' },
  })).next, true);
  assert.equal((await invoke(requireTeamProjectAccess, {
    supabaseUser: { id: 'user-a' }, body: { existingRepo: '../other/repo' },
  })).status, 400);
});
