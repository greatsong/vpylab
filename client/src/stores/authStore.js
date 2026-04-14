import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  authModalOpen: false,

  setAuthModalOpen: (open) => set({ authModalOpen: open }),

  // 세션 초기화 (App 마운트 시 호출)
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, loading: false });
        get().fetchProfile(session.user.id);
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }

    // 인증 상태 변화 리스너
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        set({ user: session.user });
        await get().upsertProfile(session.user);
        get().fetchProfile(session.user.id);
        // localStorage 진행률 서버 동기화
        const { default: useAppStore } = await import('./appStore');
        useAppStore.getState().syncProgressToServer();
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null });
      }
    });
  },

  // 프로필 조회
  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('vpylab_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) set({ profile: data });
  },

  // 프로필 upsert (첫 로그인 시)
  upsertProfile: async (user) => {
    const displayName = user.user_metadata?.full_name
      || user.user_metadata?.name
      || user.email?.split('@')[0]
      || '';
    const avatarUrl = user.user_metadata?.avatar_url || null;

    await supabase.from('vpylab_profiles').upsert({
      id: user.id,
      display_name: displayName,
      avatar_url: avatarUrl,
    }, { onConflict: 'id', ignoreDuplicates: true });
  },

  // Google 로그인
  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) console.error('Google 로그인 오류:', error.message);
  },

  // GitHub 로그인 (public_repo scope으로 갤러리 발행 지원)
  signInWithGitHub: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'public_repo',
      },
    });
    if (error) console.error('GitHub 로그인 오류:', error.message);
  },

  // GitHub provider_token 추출 (갤러리 발행 시 사용)
  getGitHubToken: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    // Supabase는 provider_token을 세션에 포함시킴
    return session?.provider_token || null;
  },

  // GitHub 로그인 여부 확인
  isGitHubUser: () => {
    const user = get().user;
    return user?.app_metadata?.provider === 'github'
      || user?.identities?.some(i => i.provider === 'github');
  },

  // 로그아웃
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },

  // 프로필 업데이트
  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return;
    const { data, error } = await supabase
      .from('vpylab_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (!error && data) set({ profile: data });
    return { data, error };
  },

  // 초대 코드로 학급 참가
  joinClass: async (inviteCode) => {
    const user = get().user;
    if (!user) return { error: { message: '로그인이 필요합니다' } };

    const { data: cls } = await supabase
      .from('vpylab_classes')
      .select('id')
      .eq('invite_code', inviteCode)
      .single();

    if (!cls) return { error: { message: '유효하지 않은 초대 코드입니다' } };

    return get().updateProfile({ class_id: cls.id });
  },

  // 역할 확인 헬퍼
  isTeacher: () => {
    const profile = get().profile;
    return profile?.role === 'teacher' || profile?.role === 'admin';
  },
}));

export default useAuthStore;
