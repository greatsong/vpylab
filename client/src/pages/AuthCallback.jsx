import { useUiText } from "../i18n/ui-text";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import useAuthStore from '../stores/authStore';

export default function AuthCallback() {
  const ui = useUiText();
  const navigate = useNavigate();
  const [callbackError, setCallbackError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      // PKCE 플로우: URL에 code 파라미터가 있으면 교환
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      let callbackFailed = ['error', 'error_code', 'error_description'].some(key => params.has(key) || hashParams.has(key));
      let exchangedSession = null;

      if (code) {
        // code를 세션으로 교환
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        exchangedSession = data?.session;
        callbackFailed ||= !!error || !exchangedSession;
        if (error) console.error(ui("세션 교환 실패:"), error.message);
      }

      // 세션 확인 후 이동 (재인증 흐름이면 원래 페이지로 복귀, 코드도 복원)
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // 해시 기반 implicit 플로우 대비
        if (hashParams.get('access_token')) {
          await new Promise(r => setTimeout(r, 500));
          ({ data: { session } } = await supabase.auth.getSession());
        }
      }
      // 실패한 OAuth 뒤 남아 있는 이전 세션의 토큰에 새 provider를 붙이지 않습니다.
      const errorCode = params.get('error_code') || hashParams.get('error_code');
      const capture = useAuthStore.getState().captureOAuthSession;
      const completedSession = callbackFailed ? null : (code ? exchangedSession : session);
      const captureResult = errorCode ? capture(completedSession, { errorCode }) : capture(completedSession);

      // 재인증 시 저장해둔 returnPath / returnCode 복원
      let returnPath = '/';
      let returnCode = null;
      let returnAction = null;
      let returnProjectId = null;
      try {
        returnPath = localStorage.getItem('vpylab-oauth-return-path') || '/';
        returnCode = localStorage.getItem('vpylab-oauth-return-code');
        returnAction = localStorage.getItem('vpylab-oauth-return-action');
        returnProjectId = localStorage.getItem('vpylab-oauth-return-project-id');
        localStorage.removeItem('vpylab-oauth-return-path');
        localStorage.removeItem('vpylab-oauth-return-code');
        localStorage.removeItem('vpylab-oauth-return-action');
        localStorage.removeItem('vpylab-oauth-return-project-id');
      } catch { /* ignore */ }

      if (captureResult?.accountMismatch) {
        // 다른 사용자의 세션으로 원래 프로젝트를 여는 일을 막고 편집 중 코드는 보존합니다.
        const { error } = await useAuthStore.getState().endMismatchedOAuth();
        if (error) {
          setCallbackError(ui("로그인 세션 정리를 완료하지 못했습니다. 새로고침한 뒤 원래 계정으로 로그인해주세요."));
          return;
        }
        navigate('/sandbox', { replace: true, state: returnCode != null ? { restoredCode: returnCode } : undefined });
        return;
      }

      // returnCode가 있으면 navigate state로 전달 → Sandbox가 받아서 에디터 복원
      if (returnCode != null) {
        navigate(returnPath, { replace: true, state: { restoredCode: returnCode, returnAction, returnProjectId } });
      } else {
        navigate(returnPath, {
          replace: true,
          state: returnAction ? { returnAction, returnProjectId } : undefined,
        });
      }
    };

    handleCallback();
  }, [navigate, ui]);

  return (
    <div
      className="h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-muted)' }}
    >
      {callbackError ? <div role="alert"><p>{ui(callbackError)}</p><button onClick={() => window.location.reload()}>{ui("새로고침")}</button></div> : ui("로그인 처리 중...")}
    </div>
  );
}
