import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useCodeStore = create((set, get) => ({
  savedCodes: [],
  loading: false,
  panelOpen: false,

  setPanelOpen: (open) => set({ panelOpen: open }),

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
      // 기존 코드 업데이트
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
      // 새 코드 저장
      const { data, error } = await supabase
        .from('vpylab_saved_code')
        .insert({ user_id: user.id, title, code, mission_id: missionId })
        .select()
        .single();
      if (!error) get().fetchSavedCodes();
      return { data, error };
    }
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
