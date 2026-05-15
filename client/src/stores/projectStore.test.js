import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authState: {
    user: { id: 'user-a', email: 'student@example.com' },
    profile: { display_name: '학생 A' },
    getGitHubToken: vi.fn(),
  },
  codeState: {
    saveCode: vi.fn(),
    _createRevision: vi.fn(),
    setCurrentCodeId: vi.fn(),
  },
  supabaseFrom: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    from: (...args) => mocks.supabaseFrom(...args),
  },
}));

vi.mock('./authStore', () => ({
  default: {
    getState: () => mocks.authState,
  },
}));

vi.mock('./codeStore', () => ({
  default: {
    getState: () => mocks.codeState,
  },
}));

vi.mock('../utils/export-html', () => ({
  generateStandaloneHTML: vi.fn((code, title) => `<html><title>${title}</title><body>${code}</body></html>`),
}));

const { default: useProjectStore } = await import('./projectStore');

function installMemoryStorage() {
  const store = new Map();
  const storage = {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => store.clear()),
    getItem: vi.fn((key) => store.get(key) ?? null),
    key: vi.fn((index) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key) => store.delete(key)),
    setItem: vi.fn((key, value) => store.set(key, String(value))),
  };
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
  return storage;
}

function mockRevisionCount(count = 1) {
  const chain = makeResolvedChain({ count });
  mocks.supabaseFrom.mockImplementation((table) => {
    if (table !== 'vpylab_code_revisions') {
      throw new Error(`unexpected table: ${table}`);
    }
    return {
      select: vi.fn(() => chain),
    };
  });
}

function makeResolvedChain(result) {
  const promise = Promise.resolve(result);
  const chain = {
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    maybeSingle: vi.fn(() => promise),
    single: vi.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  return chain;
}

function mockGithubSyncSupabase({ count = 1, codeSnapshot = 'print("retry")' } = {}) {
  mocks.supabaseFrom.mockImplementation((table) => ({
    select: vi.fn((columns) => {
      if (table === 'vpylab_code_revisions' && columns === 'code_snapshot') {
        return makeResolvedChain({ data: { code_snapshot: codeSnapshot }, error: null });
      }
      return makeResolvedChain({ count, data: [], error: null });
    }),
    update: vi.fn(() => makeResolvedChain({ data: null, error: null })),
  }));
}

function jsonResponse(ok, status, body) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function waitForCondition(assertion, timeoutMs = 1000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      return assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

describe('projectStore saveAndPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMemoryStorage();
    mockRevisionCount();
    mocks.authState.user = { id: 'user-a', email: 'student@example.com' };
    mocks.authState.profile = { display_name: '학생 A' };
    mocks.authState.getGitHubToken = vi.fn().mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn());
    mocks.codeState.saveCode = vi.fn().mockResolvedValue({
      data: {
        id: 'code-1',
        project_id: 'project-1',
        _revision: { id: 'revision-1' },
      },
      error: null,
    });
    useProjectStore.setState({
      activeProject: {
        id: 'project-1',
        title: '팀 프로젝트',
        github_repo: 'owner/repo',
      },
      activeMembers: [],
      activeCodeId: 'code-1',
      projectSaveStatus: null,
      lastRemoteUpdate: null,
    });
  });

  it('GitHub 토큰이 없어도 VPyLab 저장을 성공 처리하고 대기 작업을 blocked로 남긴다', async () => {
    const result = await useProjectStore.getState().saveAndPush({
      code: 'print("hello")',
      message: '저장',
    });

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      localOnly: true,
      pendingGitHub: false,
      savedCodeId: 'code-1',
    });
    expect(mocks.codeState.saveCode).toHaveBeenCalledWith(expect.objectContaining({
      id: 'code-1',
      projectId: 'project-1',
      code: 'print("hello")',
    }));

    const jobs = JSON.parse(localStorage.getItem('vpylab:github-sync-pending:v1'));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: 'code:revision-1',
      blocked: true,
      lastErrorCode: 'github_auth_required',
      authorId: 'user-a',
      projectId: 'project-1',
      repoFullName: 'owner/repo',
      revisionId: 'revision-1',
    });
  });

  it('GitHub 토큰 확인 오류가 나도 저장 결과를 실패로 바꾸지 않는다', async () => {
    mocks.authState.getGitHubToken = vi.fn().mockRejectedValue(
      new Error('GitHub 인증 확인이 지연되고 있습니다.'),
    );

    const result = await useProjectStore.getState().saveAndPush({
      code: 'print("still saved")',
      message: '토큰 지연',
    });

    expect(result.error).toBeNull();
    expect(result.data.localOnly).toBe(true);
    expect(result.data.pagesWarning).toContain('VPyLab에는 저장했습니다');

    const jobs = JSON.parse(localStorage.getItem('vpylab:github-sync-pending:v1'));
    expect(jobs[0].lastErrorCode).toBe('github_auth_required');
  });

  it('GitHub 403 권한 없음은 VPyLab 저장 성공 후 permission blocked로 멈춘다', async () => {
    mockGithubSyncSupabase();
    mocks.authState.getGitHubToken = vi.fn().mockResolvedValue('gh-token');
    fetch.mockResolvedValueOnce(jsonResponse(false, 403, {
      error: 'GitHub 쓰기 권한이 없습니다. collaborator 초대를 수락해야 합니다.',
      code: 'github_write_permission_required',
    }));

    const result = await useProjectStore.getState().saveAndPush({
      code: 'print("permission")',
      message: '권한 테스트',
    });

    expect(result.error).toBeNull();
    expect(result.data.localOnly).toBe(true);
    expect(result.data.pendingGitHub).toBe(false);
    expect(result.data.pagesWarning).toContain('collaborator');

    const jobs = JSON.parse(localStorage.getItem('vpylab:github-sync-pending:v1'));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      blocked: true,
      lastErrorCode: 'github_permission_required',
      authorId: 'user-a',
      attempts: 1,
      nextRetryAt: null,
    });
  });

  it('GitHub 2FA 요구는 VPyLab 저장 성공 후 2FA blocked로 멈춘다', async () => {
    mockGithubSyncSupabase();
    mocks.authState.getGitHubToken = vi.fn().mockResolvedValue('gh-token');
    fetch.mockResolvedValueOnce(jsonResponse(false, 403, {
      error: 'GitHub 코드 반영이 GitHub 계정의 2단계 인증(2FA) 요구 때문에 막혔습니다.',
      code: 'github_2fa_required',
    }));

    const result = await useProjectStore.getState().saveAndPush({
      code: 'print("2fa")',
      message: '2FA 테스트',
    });

    expect(result.error).toBeNull();
    expect(result.data.localOnly).toBe(true);
    expect(result.data.pendingGitHub).toBe(false);
    expect(result.data.pagesWarning).toContain('2단계 인증');

    const jobs = JSON.parse(localStorage.getItem('vpylab:github-sync-pending:v1'));
    expect(jobs[0]).toMatchObject({
      blocked: true,
      lastErrorCode: 'github_2fa_required',
      authorId: 'user-a',
      attempts: 1,
      nextRetryAt: null,
    });
  });

  it('GitHub 404 repo 접근 불가는 VPyLab 저장 성공 후 repo blocked로 멈춘다', async () => {
    mockGithubSyncSupabase();
    mocks.authState.getGitHubToken = vi.fn().mockResolvedValue('gh-token');
    fetch.mockResolvedValueOnce(jsonResponse(false, 404, {
      error: 'GitHub 저장소를 찾을 수 없거나 이 GitHub 계정에 접근 권한이 없습니다.',
      code: 'repo_not_accessible',
    }));

    const result = await useProjectStore.getState().saveAndPush({
      code: 'print("missing repo")',
      message: '저장소 테스트',
    });

    expect(result.error).toBeNull();
    expect(result.data.localOnly).toBe(true);
    expect(result.data.pendingGitHub).toBe(false);

    const jobs = JSON.parse(localStorage.getItem('vpylab:github-sync-pending:v1'));
    expect(jobs[0]).toMatchObject({
      blocked: true,
      lastErrorCode: 'github_repo_unavailable',
      authorId: 'user-a',
      attempts: 1,
      nextRetryAt: null,
    });
  });

  it('권한 수정 후 GitHub 성공 응답이면 pending job을 제거하고 GitHub 결과를 반환한다', async () => {
    mockGithubSyncSupabase({ count: 1 });
    mocks.authState.getGitHubToken = vi.fn().mockResolvedValue('gh-token');
    fetch.mockResolvedValueOnce(jsonResponse(true, 200, {
      commitSha: 'abc123',
      pageCommitSha: 'def456',
      commitUrl: 'https://github.com/owner/repo/commit/abc123',
      pageCommitUrl: 'https://github.com/owner/repo/commit/def456',
      repoUrl: 'https://github.com/owner/repo',
      pagesUrl: 'https://owner.github.io/repo/',
      pagesStatus: 'built',
    }));

    const result = await useProjectStore.getState().saveAndPush({
      code: 'print("after collaborator accepted")',
      message: '권한 수정 후 저장',
    });

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      commitSha: 'abc123',
      pageCommitSha: 'def456',
      repoUrl: 'https://github.com/owner/repo',
      pagesUrl: 'https://owner.github.io/repo/',
      savedCodeId: 'code-1',
    });
    expect(JSON.parse(localStorage.getItem('vpylab:github-sync-pending:v1'))).toEqual([]);
  });

  it('계정이 다른 pending job은 자동 재시도하지 않는다', async () => {
    mockGithubSyncSupabase();
    mocks.authState.getGitHubToken = vi.fn().mockResolvedValue('gh-token');
    localStorage.setItem('vpylab:github-sync-pending:v1', JSON.stringify([{
      id: 'code:other-user-revision',
      kind: 'code',
      projectId: 'project-1',
      codeId: 'code-1',
      repoFullName: 'owner/repo',
      title: '팀 프로젝트',
      message: '다른 계정 저장',
      authorId: 'user-b',
      revisionId: 'other-user-revision',
      blocked: true,
      lastErrorCode: 'github_permission_required',
      createdAt: new Date().toISOString(),
    }]));

    const result = await useProjectStore.getState().flushPendingGithubSync('project-1', { force: true });

    expect(result).toEqual({ started: 0, skipped: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('vpylab:github-sync-pending:v1'))[0]).toMatchObject({
      id: 'code:other-user-revision',
      authorId: 'user-b',
      lastErrorCode: 'github_permission_required',
    });
  });

  it('깨진 pending job은 retryable 루프 대신 blocked로 고정한다', async () => {
    mockGithubSyncSupabase();
    mocks.authState.getGitHubToken = vi.fn().mockResolvedValue('gh-token');
    localStorage.setItem('vpylab:github-sync-pending:v1', JSON.stringify([{
      id: 'code:broken',
      kind: 'code',
      projectId: 'project-1',
      title: '팀 프로젝트',
      authorId: 'user-a',
      createdAt: new Date().toISOString(),
    }]));

    const result = await useProjectStore.getState().flushPendingGithubSync('project-1', { force: true });

    expect(result).toEqual({ started: 1, skipped: 0 });
    await waitForCondition(() => {
      const [job] = JSON.parse(localStorage.getItem('vpylab:github-sync-pending:v1'));
      expect(job).toMatchObject({
        blocked: true,
        lastErrorCode: 'github_invalid_pending_job',
        nextRetryAt: null,
      });
    });
  });

  it('같은 pending job이 동시에 요청되면 하나의 GitHub 요청을 공유한다', async () => {
    mockGithubSyncSupabase({ count: 1 });
    mocks.authState.getGitHubToken = vi.fn().mockResolvedValue('gh-token');
    const response = deferred();
    fetch.mockReturnValue(response.promise);

    const first = useProjectStore.getState().saveAndPush({
      code: 'print("same revision")',
      message: '동시 저장',
    });
    const second = useProjectStore.getState().saveAndPush({
      code: 'print("same revision")',
      message: '동시 저장',
    });

    await waitForCondition(() => expect(fetch).toHaveBeenCalledTimes(1));
    response.resolve(jsonResponse(true, 200, {
      commitSha: 'shared123',
      repoUrl: 'https://github.com/owner/repo',
      pagesUrl: 'https://owner.github.io/repo/',
    }));

    const results = await Promise.all([first, second]);

    expect(results[0].error).toBeNull();
    expect(results[1].error).toBeNull();
    expect(results[0].data.commitSha).toBe('shared123');
    expect(results[1].data.commitSha).toBe('shared123');
    expect(JSON.parse(localStorage.getItem('vpylab:github-sync-pending:v1'))).toEqual([]);
  });
});
