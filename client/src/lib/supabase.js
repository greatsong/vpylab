import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// 환경변수가 없으면 createClient가 예외를 던져 앱 전체가 빈 화면이 된다.
// 자리표시 값으로 초기화해 코드 실행·미션·예제는 쓸 수 있게 하고, 로그인·저장·갤러리만 실패하게 둔다.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[VPyLab] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 없습니다. client/.env를 확인하세요. 로그인·저장·갤러리 기능은 동작하지 않습니다.');
}

export const supabase = createClient(supabaseUrl || 'http://localhost:54321', supabaseAnonKey || 'missing-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'vpylab-auth',
    // Web Locks 경쟁 조건 방지: 잠금 없이 즉시 실행
    lock: (name, acquireTimeout, fn) => fn(),
  },
});
