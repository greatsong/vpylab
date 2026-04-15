import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'vpylab-auth',
    // Web Locks 경쟁 조건 방지: 잠금 없이 즉시 실행
    lock: (name, acquireTimeout, fn) => fn(),
  },
});
