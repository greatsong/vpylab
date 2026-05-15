import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // PKCE 플로우: URL에 code 파라미터가 있으면 교환
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        // code를 세션으로 교환
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error('세션 교환 실패:', error.message);
      }

      // 세션 확인 후 이동 (재인증 흐름이면 원래 페이지로 복귀, 코드도 복원)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // 해시 기반 implicit 플로우 대비
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.get('access_token')) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

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
  }, [navigate]);

  return (
    <div
      className="h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-muted)' }}
    >
      로그인 처리 중...
    </div>
  );
}
