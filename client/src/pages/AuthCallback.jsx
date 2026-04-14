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

      // 세션 확인 후 홈으로 이동
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/', { replace: true });
      } else {
        // 해시 기반 implicit 플로우 대비
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.get('access_token')) {
          await new Promise(r => setTimeout(r, 500));
        }
        navigate('/', { replace: true });
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
