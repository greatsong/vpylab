import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), session: vi.fn(), capture: vi.fn(), navigate: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { exchangeCodeForSession: mocks.exchange, getSession: mocks.session } } }));
vi.mock('../stores/authStore', () => ({ default: { getState: () => ({ captureOAuthSession: mocks.capture }) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
import AuthCallback from './AuthCallback';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.replaceState({}, '', '/auth/callback?code=test-code');
  mocks.session.mockResolvedValue({ data: { session: { provider_token: 'test-previous-google' } } });
});

describe('OAuth 완료 시 토큰 발급자 확인', () => {
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
