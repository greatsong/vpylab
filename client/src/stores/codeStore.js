import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useCodeStore = create((set, get) => ({
  savedCodes: [],
  loading: false,
  panelOpen: false,

  // 자동 저장 상태
  currentCodeId: null,      // 현재 작업 중인 코드 레코드 ID
  saveStatus: 'idle',       // 'idle' | 'saving' | 'saved' | 'error'
  _saveTimer: null,

  setPanelOpen: (open) => set({ panelOpen: open }),
  setCurrentCodeId: (id) => set({ currentCodeId: id }),

  // 저장된 코드 목록 조회
  fetchSavedCodes: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    set({ loading: true });
    const { data } = await supabase
      .from('vpylab_saved_code')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    set({ savedCodes: data || [], loading: false });
  },

  // 코드 저장 (새로 만들기 또는 업데이트)
  saveCode: async ({ title, code, missionId = null, id = null }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: '로그인이 필요합니다' } };

    if (id) {
      const { data, error } = await supabase
        .from('vpylab_saved_code')
        .update({ title, code, mission_id: missionId, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (!error) get().fetchSavedCodes();
      return { data, error };
    } else {
      const { data, error } = await supabase
        .from('vpylab_saved_code')
        .insert({ user_id: user.id, title, code, mission_id: missionId })
        .select()
        .single();
      if (!error) get().fetchSavedCodes();
      return { data, error };
    }
  },

  /**
   * 자동 저장 (2초 debounce)
   * - currentCodeId가 있으면 업데이트, 없으면 새 레코드 생성
   * - 로그인 사용자만 동작
   */
  autoSave: (code, { title = '제목 없음', missionId = null } = {}) => {
    const { _saveTimer } = get();
    if (_saveTimer) clearTimeout(_saveTimer);

    const timer = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      set({ saveStatus: 'saving' });

      const currentId = get().currentCodeId;

      if (currentId) {
        // 기존 레코드 업데이트
        const { error } = await supabase
          .from('vpylab_saved_code')
          .update({ code, updated_at: new Date().toISOString() })
          .eq('id', currentId)
          .eq('user_id', user.id);

        set({ saveStatus: error ? 'error' : 'saved' });
      } else {
        // 새 레코드 생성
        const { data, error } = await supabase
          .from('vpylab_saved_code')
          .insert({ user_id: user.id, title, code, mission_id: missionId })
          .select()
          .single();

        if (!error && data) {
          set({ currentCodeId: data.id, saveStatus: 'saved' });
        } else {
          set({ saveStatus: 'error' });
        }
      }
    }, 2000);

    set({ _saveTimer: timer, saveStatus: 'idle' });
  },

  // 자동 저장 타이머 정리
  clearAutoSave: () => {
    const { _saveTimer } = get();
    if (_saveTimer) clearTimeout(_saveTimer);
    set({ _saveTimer: null, currentCodeId: null, saveStatus: 'idle' });
  },

  /**
   * 미션용: mission_id로 가장 최근 저장된 코드 로드
   */
  loadMissionCode: async (missionId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('vpylab_saved_code')
      .select('*')
      .eq('user_id', user.id)
      .eq('mission_id', missionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      set({ currentCodeId: data.id });
      return data.code;
    }
    return null;
  },

  // 코드 삭제
  deleteCode: async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('vpylab_saved_code')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    get().fetchSavedCodes();
  },

  // 미션 제출 기록
  submitMission: async ({ missionId, code, score, passed, gradingDetails }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('vpylab_submissions')
      .insert({
        user_id: user.id,
        mission_id: missionId,
        code,
        score,
        passed,
        grading_details: gradingDetails,
      })
      .select()
      .single();

    return { data, error };
  },

  // 내 제출 기록 조회
  fetchMySubmissions: async (missionId = null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('vpylab_submissions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (missionId) query = query.eq('mission_id', missionId);

    const { data } = await query;
    return data || [];
  },
}));

export default useCodeStore;
