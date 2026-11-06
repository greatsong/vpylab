import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), session: vi.fn(), capture: vi.fn(), navigate: vi.fn(), signOut: vi.fn(), endMismatch: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { exchangeCodeForSession: mocks.exchange, getSession: mocks.session, signOut: mocks.signOut } } }));
vi.mock('../stores/authStore', () => ({ default: { getState: () => ({ captureOAuthSession: mocks.capture, endMismatchedOAuth: mocks.endMismatch }) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
import AuthCallback from './AuthCallback';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.capture.mockReset();
  mocks.endMismatch.mockResolvedValue({ error: null });
  localStorage.clear();
  window.history.replaceState({}, '', '/auth/callback?code=test-code');
  mocks.session.mockResolvedValue({ data: { session: { provider_token: 'test-previous-google' } } });
});

describe('OAuth 완료 시 토큰 발급자 확인', () => {
  it('다른 GitHub 사용자로 재인증되면 그 세션을 종료하고 원래 프로젝트를 열지 않는다', async () => {
    localStorage.setItem('vpylab-oauth-return-code', 'print("미저장 작품")');
    localStorage.setItem('vpylab-oauth-return-project-id', 'original-project');
    localStorage.setItem('vpylab-oauth-return-action', 'projects');
    mocks.capture.mockReturnValue({ accountMismatch: true });
    mocks.exchange.mockResolvedValue({ data: { session: { user: { id: 'different-user' } } }, error: null });
    render(<AuthCallback />);
    await waitFor(() => expect(mocks.endMismatch).toHaveBeenCalledOnce());
    expect(mocks.navigate).toHaveBeenCalledWith('/sandbox', { replace: true, state: { restoredCode: 'print("미저장 작품")' } });
  });

  it('계정 불일치 세션 종료 실패 시 Sandbox로 이동하지 않는다', async () => {
    mocks.capture.mockReturnValue({ accountMismatch: true });
    mocks.exchange.mockResolvedValue({ data: { session: { user: { id: 'different-user' } } }, error: null });
    mocks.endMismatch.mockResolvedValue({ error: { message: 'network failure' } });
    const view = render(<AuthCallback />);
    await waitFor(() => expect(view.getByRole('alert')).toHaveTextContent('세션 정리'));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('이미 다른 사용자에게 연결된 identity 오류를 연결 안내에 전달한다', async () => {
    window.history.replaceState({}, '', '/auth/callback?error=server_error&error_code=identity_already_exists');
    render(<AuthCallback />);
    await waitFor(() => expect(mocks.capture).toHaveBeenCalledWith(null, { errorCode: 'identity_already_exists' }));
  });
  it('코드 교환 실패 시 이전 로그인 세션을 새 GitHub 인증으로 기록하지 않는다', async () => {
    mocks.exchange.mockResolvedValue({ data: { session: null }, error: { message: '교환 실패' } });
    render(<AuthCallback />);
    await waitFor(() => expect(mocks.capture).toHaveBeenCalledWith(null));
  });

  it('코드 교환 성공 시 실제 교환 결과의 세션만 기록한다', async () => {
    const exchanged = { user: { id: 'student-a' }, provider_token: 'test-new-github' };
    mocks.exchange.mockResolvedValue({ data: { session: exchanged }, error: null });
    render(<AuthCallback />);
    await waitFor(() => expect(mocks.capture).toHaveBeenCalledWith(exchanged));
  });

  it.each(['?error=access_denied', '#error=access_denied'])('OAuth 취소 URL에서도 이전 세션을 인증으로 기록하지 않는다 (%s)', async suffix => {
    window.history.replaceState({}, '', `/auth/callback${suffix}`);
    render(<AuthCallback />);
    await waitFor(() => expect(mocks.capture).toHaveBeenCalledWith(null));
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('implicit 성공 콜백은 Supabase가 처리한 세션을 기록한다', async () => {
    const session = { user: { id: 'student-a' }, access_token: 'test-app-session', provider_token: 'test-github' };
    window.history.replaceState({}, '', '/auth/callback#access_token=test-app-session');
    mocks.session.mockResolvedValue({ data: { session } });
    render(<AuthCallback />);
    await waitFor(() => expect(mocks.capture).toHaveBeenCalledWith(session));
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
});
