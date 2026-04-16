import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useCodeShareStore = create((set, get) => ({
  // 공유된 코드 목록
  sharedCodes: [],
  loading: false,

  // 학생 UI 상태
  unreadCount: 0,
  panelOpen: false,

  // 교사 상태
  teacherClasses: [],
  selectedClassId: null,
  sendModalOpen: false,

  // 토스트 트리거
  lastReceivedAt: null,

  // Realtime 구독 참조
  _subscription: null,

  // ── 초기화 ──
  initialize: async (user, profile) => {
    if (!user || !profile) return;

    const isTeacher = profile.role === 'teacher' || profile.role === 'admin';

    if (isTeacher) {
      // 교사: 학급 목록 로드
      const { data: classes } = await supabase
        .from('vpylab_classes')
        .select('id, name')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      const teacherClasses = classes || [];
      const selectedClassId = teacherClasses.length === 1 ? teacherClasses[0].id : null;

      set({ teacherClasses, selectedClassId });

      // 선택된 학급의 전송 기록 로드 + 구독
      if (selectedClassId) {
        get().fetchSharedCodes(selectedClassId);
        get().subscribeToChanges(selectedClassId);
      }
    } else if (profile.class_id) {
      // 학생: 자기 학급의 코드 로드 + 구독
      get().fetchSharedCodes(profile.class_id);
      get().subscribeToChanges(profile.class_id);
    }
  },

  // ── 코드 목록 조회 ──
  fetchSharedCodes: async (classId) => {
    set({ loading: true });
    const { data } = await supabase
      .from('vpylab_code_shares')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: true });

    set({ sharedCodes: data || [], loading: false });
  },

  // ── 교사: 코드 전송 ──
  sendCode: async ({ classId, code, title }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: '로그인이 필요합니다' };

    // 오늘 해당 학급의 seq 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: existing } = await supabase
      .from('vpylab_code_shares')
      .select('seq')
      .eq('class_id', classId)
      .gte('created_at', today.toISOString())
      .order('seq', { ascending: false })
      .limit(1);

    const seq = (existing && existing.length > 0) ? existing[0].seq + 1 : 1;

    const { data, error } = await supabase
      .from('vpylab_code_shares')
      .insert({
        class_id: classId,
        teacher_id: user.id,
        title,
        code,
        seq,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    // 로컬 상태 즉시 반영 (교사 본인)
    set((state) => ({
      sharedCodes: [...state.sharedCodes, data],
    }));

    return { data };
  },

  // ── 교사: 전송창 비우기 ──
  clearCodes: async (classId) => {
    const { error } = await supabase
      .from('vpylab_code_shares')
      .delete()
      .eq('class_id', classId);

    if (!error) {
      set({ sharedCodes: [], unreadCount: 0 });
    }
    return { error };
  },

  // ── 제목 자동 생성 (YYMMDD + 2자리 순번) ──
  generateTitle: () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = yy + mm + dd;

    // 오늘 이미 보낸 코드 수 기반 순번
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = get().sharedCodes.filter(
      (c) => new Date(c.created_at) >= todayStart
    ).length;
    const seq = String(todayCount + 1).padStart(2, '0');

    return datePrefix + seq;
  },

  // ── Realtime 구독 ──
  subscribeToChanges: (classId) => {
    // 기존 구독 정리
    const prev = get()._subscription;
    if (prev) supabase.removeChannel(prev);

    const channel = supabase
      .channel(`code-shares-${classId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vpylab_code_shares',
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          const state = get();
          // 이미 로컬에 있으면 무시 (교사 본인이 보낸 것)
          if (state.sharedCodes.some((c) => c.id === payload.new.id)) return;
          set({
            sharedCodes: [...state.sharedCodes, payload.new],
            unreadCount: state.panelOpen ? state.unreadCount : state.unreadCount + 1,
            lastReceivedAt: Date.now(),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'vpylab_code_shares',
          filter: `class_id=eq.${classId}`,
        },
        () => {
          set({ sharedCodes: [], unreadCount: 0 });
        }
      )
      .subscribe();

    set({ _subscription: channel });
  },

  // ── 구독 해제 ──
  unsubscribe: () => {
    const channel = get()._subscription;
    if (channel) supabase.removeChannel(channel);
    set({ _subscription: null });
  },

  // ── UI 상태 ──
  setPanelOpen: (open) => set({ panelOpen: open, unreadCount: open ? 0 : get().unreadCount }),
  setSendModalOpen: (open) => set({ sendModalOpen: open }),
  setSelectedClassId: (id) => {
    set({ selectedClassId: id, sharedCodes: [] });
    if (id) {
      get().fetchSharedCodes(id);
      get().subscribeToChanges(id);
    }
  },
}));

export default useCodeShareStore;
