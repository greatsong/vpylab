import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase가 URL 해시에서 토큰을 자동으로 처리
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/', { replace: true });
      } else {
        // 세션이 없으면 해시에서 처리 시도
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.get('access_token')) {
          // Supabase가 자동으로 처리할 때까지 잠시 대기
          setTimeout(() => navigate('/', { replace: true }), 500);
        } else {
          navigate('/', { replace: true });
        }
      }
    });
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
