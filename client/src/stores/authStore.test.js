import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'vpylab-auth',
  supabase: { auth: { getSession: mocks.getSession } },
}));

import useAuthStore from './authStore';

const githubUser = { id: 'student-a', app_metadata: { provider: 'github' } };

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user: githubUser, githubTokenExpired: false });
  mocks.getSession.mockResolvedValue({ data: { session: { user: githubUser } } });
});

describe('GitHub 연결에 쓰는 현재 계정 인증', () => {
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
