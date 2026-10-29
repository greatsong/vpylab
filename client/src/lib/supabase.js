import { createClient } from '@supabase/supabase-js';

// 교실 LAN 모드처럼 Supabase 설정이 없는 빌드에서는 즉시 실패하는 자리 표시 주소를 씁니다.
// createClient는 빈 URL이면 예외를 던져 앱 전체가 멈추므로, 세션은 localStorage만 읽고
// 네트워크 요청은 연결 거부로 바로 끝나게 합니다.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim() || 'http://127.0.0.1:1';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim() || 'lan-mode-no-supabase';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'vpylab-auth',
    // Web Locks 경쟁 조건 방지: 잠금 없이 즉시 실행
    lock: (name, acquireTimeout, fn) => fn(),
  },
});
