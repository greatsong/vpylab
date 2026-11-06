import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signInWithOAuth: vi.fn(), linkIdentity: vi.fn(), signOut: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'vpylab-auth',
  supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange,
    signInWithOAuth: mocks.signInWithOAuth, linkIdentity: mocks.linkIdentity, signOut: mocks.signOut } },
}));

import useAuthStore from './authStore';

const originalProfileActions = { upsertProfile: useAuthStore.getState().upsertProfile, fetchProfile: useAuthStore.getState().fetchProfile, _cleanupStoresOnSignOut: useAuthStore.getState()._cleanupStoresOnSignOut };

const githubUser = { id: 'student-a', app_metadata: { provider: 'github' } };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useAuthStore.setState({ user: githubUser, githubTokenExpired: false, githubAuthError: '' });
  mocks.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  mocks.linkIdentity.mockResolvedValue({ data: {}, error: null });
  mocks.getSession.mockResolvedValue({ data: { session: { user: githubUser } } });
});

describe('GitHub 연결에 쓰는 현재 계정 인증', () => {
  it('로그아웃 listener가 지연되거나 종료가 실패해도 다른 계정의 개인 상태와 저장 인증을 정리한다', async () => {
    const cleanup = vi.fn().mockResolvedValue();
    useAuthStore.setState({ user: githubUser, profile: { display_name: '다른 계정' }, _cleanupStoresOnSignOut: cleanup });
    localStorage.setItem('vpylab-auth', 'test-session');
    localStorage.setItem('vpylab-auth-user', 'test-user');
    localStorage.setItem('vpylab-github-auth', 'test-github');
    mocks.signOut.mockResolvedValue({ error: { message: 'network failure' } });
    const result = await useAuthStore.getState().endMismatchedOAuth();
    expect(result.error.message).toBe('network failure');
    expect(cleanup).toHaveBeenCalledOnce();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
    expect(localStorage.getItem('vpylab-auth')).toBeNull();
    expect(localStorage.getItem('vpylab-auth-user')).toBeNull();
    expect(localStorage.getItem('vpylab-github-auth')).toBeNull();
  });
  it('Google 로그인 중에는 기존 계정에 identity를 연결하고 다른 계정으로 로그인하지 않는다', async () => {
    useAuthStore.setState({ user: { id: 'google-user', app_metadata: { provider: 'google' } } });
    await useAuthStore.getState().signInWithGitHub({ returnCode: 'print("작품")', returnProjectId: 'project-a', returnPath: '/sandbox' });
    expect(mocks.linkIdentity).toHaveBeenCalledWith(expect.objectContaining({ provider: 'github', options: expect.objectContaining({ scopes: 'public_repo' }) }));
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(localStorage.getItem('vpylab-oauth-link-user')).toBe('google-user');
    expect(localStorage.getItem('vpylab-oauth-return-code')).toBe('print("작품")');
    expect(useAuthStore.getState().user.id).toBe('google-user');
  });

  it('GitHub 로그인과 기존 GitHub 사용자의 재인증은 OAuth를 유지한다', async () => {
    for (const user of [null, githubUser]) {
      useAuthStore.setState({ user });
      await useAuthStore.getState().signInWithGitHub();
    }
    expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(2);
    expect(mocks.linkIdentity).not.toHaveBeenCalled();
  });

  it('재인증도 원래 사용자 ID를 확인하고 이전 복귀 정보를 새 요청에 섞지 않는다', async () => {
    localStorage.setItem('vpylab-oauth-return-project-id', 'old-project');
    localStorage.setItem('vpylab-oauth-return-code', 'old-code');
    await useAuthStore.getState().signInWithGitHub({ returnPath: '/sandbox' });
    expect(localStorage.getItem('vpylab-oauth-link-user')).toBe(githubUser.id);
    expect(localStorage.getItem('vpylab-oauth-return-project-id')).toBeNull();
    expect(localStorage.getItem('vpylab-oauth-return-code')).toBeNull();
  });

  it('네트워크 예외도 기존 계정과 편집 중 코드를 유지하고 안내한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    useAuthStore.setState({ user: { id: 'google-user', app_metadata: { provider: 'google' } } });
    mocks.linkIdentity.mockRejectedValue(new Error('network failure'));
    const result = await useAuthStore.getState().signInWithGitHub({ returnCode: 'unsaved' });
    expect(result.error.message).toBe('network failure');
    expect(useAuthStore.getState().user.id).toBe('google-user');
    expect(useAuthStore.getState().githubAuthError).toContain('작품');
    expect(localStorage.getItem('vpylab-oauth-return-code')).toBeNull();
  });

  it('계정 연결 미지원이나 거부 시 다른 계정으로 자동 전환하지 않고 오류를 표시한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    useAuthStore.setState({ user: { id: 'google-user', app_metadata: { provider: 'google' } } });
    mocks.linkIdentity.mockResolvedValue({ data: null, error: { code: 'manual_linking_disabled', message: 'disabled' } });
    const result = await useAuthStore.getState().signInWithGitHub();
    expect(result.error.code).toBe('manual_linking_disabled');
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(useAuthStore.getState().githubAuthError).toContain('계정 연결');
    expect(useAuthStore.getState().user.id).toBe('google-user');
    expect(localStorage.getItem('vpylab-oauth-provider')).toBeNull();
  });

  it('계정 연결 완료의 사용자 ID가 달라지면 토큰을 연결 완료로 기록하지 않는다', () => {
    localStorage.setItem('vpylab-oauth-provider', 'github');
    localStorage.setItem('vpylab-oauth-link-user', 'google-user');
    useAuthStore.getState().captureOAuthSession({ user: githubUser, provider_token: 'test-other-user' });
    expect(localStorage.getItem('vpylab-github-auth')).toBeNull();
    expect(useAuthStore.getState().githubAuthError).toContain('계정');
  });
  it('실제 앱의 저장 키에서 같은 계정의 GitHub 인증을 찾는다', async () => {
    localStorage.setItem('vpylab-auth', JSON.stringify({ user: githubUser, provider_token: 'test-current-token' }));
    expect(await useAuthStore.getState().getGitHubToken()).toBe('test-current-token');
  });

  it('다른 앱의 Supabase 저장 키를 읽어 GitHub 인증으로 사용하지 않는다', async () => {
    localStorage.setItem('sb-unrelated-auth-token', JSON.stringify({ user: githubUser, provider_token: 'test-other-app' }));
    expect(await useAuthStore.getState().getGitHubToken()).toBeNull();
  });

  it('다른 사용자 또는 로그아웃 상태의 저장 인증은 재사용하지 않는다', async () => {
    localStorage.setItem('vpylab-auth', JSON.stringify({ user: { id: 'student-b' }, provider_token: 'test-other-account' }));
    expect(await useAuthStore.getState().getGitHubToken()).toBeNull();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    localStorage.setItem('vpylab-auth', JSON.stringify({ user: githubUser, provider_token: 'test-old-session' }));
    expect(await useAuthStore.getState().getGitHubToken()).toBeNull();
  });

  it('현재 세션의 인증을 우선하고 Google 인증은 GitHub에 쓰지 않는다', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: githubUser, provider_token: 'test-session-token' } } });
    expect(await useAuthStore.getState().getGitHubToken()).toBe('test-session-token');
    const googleUser = { id: 'student-a', app_metadata: { provider: 'google' } };
    mocks.getSession.mockResolvedValue({ data: { session: { user: googleUser, provider_token: 'test-google-token' } } });
    expect(await useAuthStore.getState().getGitHubToken()).toBeNull();
  });

  it('만료 처리는 앱의 provider_token만 지우며 로그인 정보와 다른 앱을 보존한다', () => {
    localStorage.setItem('vpylab-auth', JSON.stringify({ user: githubUser, access_token: 'test-app-session', provider_token: 'test-expired' }));
    const unrelated = JSON.stringify({ provider_token: 'test-unrelated' });
    localStorage.setItem('sb-unrelated-auth-token', unrelated);
    useAuthStore.getState().markGitHubTokenExpired();
    expect(JSON.parse(localStorage.getItem('vpylab-auth'))).toEqual({ user: githubUser, access_token: 'test-app-session' });
    expect(localStorage.getItem('sb-unrelated-auth-token')).toBe(unrelated);
    expect(useAuthStore.getState().githubTokenExpired).toBe(true);
  });

  it('GitHub가 연결된 Google 로그인 토큰은 GitHub에 전달하지 않는다', async () => {
    for (const provider of ['google', 'github']) {
      const linked = { ...githubUser, app_metadata: { provider, providers: ['google', 'github'] }, identities: [{ provider: 'google' }, { provider: 'github' }] };
      mocks.getSession.mockResolvedValue({ data: { session: { user: linked, provider_token: 'test-google-token' } } });
      localStorage.setItem('vpylab-auth', JSON.stringify({ user: linked, provider_token: 'test-google-token' }));
      expect(await useAuthStore.getState().getGitHubToken()).toBeNull();
    }
  });

  it('GitHub OAuth에서 확인한 연결 계정 토큰은 세션 갱신 후에도 같은 사용자에게만 제공한다', async () => {
    const linked = { ...githubUser, identities: [{ provider: 'google' }, { provider: 'github' }] };
    localStorage.setItem('vpylab-oauth-provider', 'github');
    useAuthStore.getState().captureOAuthSession({ user: linked, provider_token: 'test-confirmed-github' });
    // StrictMode에서 완료 처리가 반복되어도 기록을 지우지 않습니다.
    useAuthStore.getState().captureOAuthSession({ user: linked });
    mocks.getSession.mockResolvedValue({ data: { session: { user: linked } } });
    expect(await useAuthStore.getState().getGitHubToken()).toBe('test-confirmed-github');
    mocks.getSession.mockResolvedValue({ data: { session: { user: { ...linked, id: 'student-b' } } } });
    expect(await useAuthStore.getState().getGitHubToken()).toBeNull();
  });

  it('Google OAuth 완료와 토큰 만료 시 별도 보관한 GitHub 인증을 지운다', async () => {
    localStorage.setItem('vpylab-oauth-provider', 'github');
    useAuthStore.getState().captureOAuthSession({ user: githubUser, provider_token: 'test-github' });
    useAuthStore.getState().markGitHubTokenExpired();
    expect(localStorage.getItem('vpylab-github-auth')).toBeNull();
    localStorage.setItem('vpylab-oauth-provider', 'google');
    useAuthStore.getState().captureOAuthSession({ user: githubUser, provider_token: 'test-google' });
    expect(localStorage.getItem('vpylab-github-auth')).toBeNull();
  });
});


afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  useAuthStore.setState(originalProfileActions);
});

describe('로그인 알림과 DB 요청의 교착 방지', () => {
  it('로그인 알림은 DB 요청을 기다리지 않고 반환하며 다음 작업에서 동기화한다', async () => {
    vi.useFakeTimers();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    let callback;
    const unsubscribe = vi.fn();
    mocks.onAuthStateChange.mockImplementation((listener) => {
      callback = listener;
      return { data: { subscription: { unsubscribe } } };
    });
    let finishProfile;
    const profileRequest = new Promise(resolve => { finishProfile = resolve; });
    const upsert = vi.fn().mockReturnValue(profileRequest);
    const fetchProfile = vi.fn().mockResolvedValue();
    useAuthStore.setState({ upsertProfile: upsert, fetchProfile });
    const cleanup = useAuthStore.getState().initialize();
    await Promise.resolve();

    // SDK가 콜백을 await해도 즉시 빠져나와 인증 잠금을 해제할 수 있어야 한다.
    expect(callback('SIGNED_IN', { user: githubUser })).toBeUndefined();
    expect(upsert).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    expect(upsert).toHaveBeenCalledWith(githubUser);
    expect(fetchProfile).not.toHaveBeenCalled();

    // 진행 중 계정이 바뀌면 이전 계정의 프로필/진행률 요청을 이어가지 않는다.
    useAuthStore.setState({ user: null });
    finishProfile();
    await Promise.resolve();
    expect(fetchProfile).not.toHaveBeenCalled();
    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('StrictMode 정리 후에는 예약된 DB 요청을 실행하지 않는다', async () => {
    vi.useFakeTimers();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    let callback;
    mocks.onAuthStateChange.mockImplementation((listener) => {
      callback = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    const upsert = vi.fn().mockResolvedValue();
    useAuthStore.setState({ upsertProfile: upsert });
    const cleanup = useAuthStore.getState().initialize();
    await Promise.resolve();
    callback('SIGNED_IN', { user: githubUser });
    cleanup();
    await vi.runAllTimersAsync();
    expect(upsert).not.toHaveBeenCalled();
  });
});
