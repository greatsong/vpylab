import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import useAuthStore from './authStore';

async function getCurrentUser() {
  const cachedUser = useAuthStore.getState().user;
  if (cachedUser?.id) return cachedUser;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

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

  // 저장된 코드 목록 조회 — 본인 코드 + 본인이 속한 팀 프로젝트 코드 (RLS가 정책상 알아서 OR 처리)
  fetchSavedCodes: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    set({ loading: true });

    // 1) 내 개인 코드
    const { data: ownCodes } = await supabase
      .from('vpylab_saved_code')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    // 2) 내가 멤버인 팀 코드 (RLS가 멤버십 통과한 행만 반환)
    const { data: memberRows } = await supabase
      .from('vpylab_project_members')
      .select('project_id')
      .eq('user_id', user.id);
    const projectIds = (memberRows || []).map(r => r.project_id);

    let teamCodes = [];
    if (projectIds.length > 0) {
      const { data } = await supabase
        .from('vpylab_saved_code')
        .select('*')
        .in('project_id', projectIds)
        .order('updated_at', { ascending: false });
      teamCodes = data || [];
    }

    // 합치고 중복 제거 (id 기준)
    const map = new Map();
    [...(ownCodes || []), ...teamCodes].forEach(c => map.set(c.id, c));
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
    );

    set({ savedCodes: merged, loading: false });
  },

  /**
   * 내부 헬퍼: code_id에 대한 revision을 1행 추가한다.
   * - parent_revision_id를 자동으로 직전 revision으로 연결
   * - projectId가 있으면 revision에도 함께 기록(팀 이력 RLS/조회용)
   */
  _createRevision: async ({ codeId, code, userId, message = '', source = 'manual', projectId = null }) => {
    // 최신 parent revision 찾기 (없으면 null = 첫 revision)
    const { data: parent } = await supabase
      .from('vpylab_code_revisions')
      .select('id')
      .eq('code_id', codeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('vpylab_code_revisions')
      .insert({
        code_id: codeId,
        parent_revision_id: parent?.id || null,
        author_id: userId,
        message: message.slice(0, 200),  // 너무 긴 메시지 차단
        code_snapshot: code,
        code_size: code.length,
        source,
        project_id: projectId,
      })
      .select()
      .single();

    if (error) {
      console.warn('[codeStore] revision 생성 실패:', error.message);
    }
    return { data, error };
  },

  /**
   * 코드 저장 (새로 만들기 또는 업데이트)
   * - manual 저장 시 vpylab_code_revisions에 스냅샷 1행을 함께 추가한다 (Phase 1).
   * - source: 'manual' | 'restore' | 'mission_submit' | 'github_pull'
   * - commitMessage: 학생이 입력한 저장 메시지 (예: "캐릭터 점프 추가")
   * - skipRevision: true면 revision을 만들지 않음 (자동저장 등에서 사용)
   */
  saveCode: async ({
    title,
    code,
    missionId = null,
    id = null,
    projectId = null,
    commitMessage = '',
    source = 'manual',
    skipRevision = false,
  }) => {
    const user = await getCurrentUser();
    if (!user) return { error: { message: '로그인이 필요합니다' } };

    let savedRow;
    let saveError;

    if (id) {
      // UPDATE — 팀 코드는 user_id 필터를 걸지 않음 (RLS가 멤버십 검사)
      const updatePayload = { title, code, mission_id: missionId, updated_at: new Date().toISOString() };
      if (projectId !== undefined && projectId !== null) updatePayload.project_id = projectId;

      let q = supabase
        .from('vpylab_saved_code')
        .update(updatePayload)
        .eq('id', id);
      if (!projectId) q = q.eq('user_id', user.id);

      const { data, error } = await q.select().single();
      savedRow = data;
      saveError = error;
    } else {
      const { data, error } = await supabase
        .from('vpylab_saved_code')
        .insert({
          user_id: user.id,
          title,
          code,
          mission_id: missionId,
          project_id: projectId,
        })
        .select()
        .single();
      savedRow = data;
      saveError = error;
    }

    if (saveError) return { data: null, error: saveError };

    // === revision 생성 (실패해도 저장 자체는 성공으로 간주) ===
    let revision = null;
    if (!skipRevision && savedRow) {
      const { data: createdRevision } = await get()._createRevision({
        codeId: savedRow.id,
        code,
        userId: user.id,
        message: commitMessage,
        source,
        projectId: savedRow.project_id || null,
      });
      revision = createdRevision || null;
    }

    get().fetchSavedCodes();
    return {
      data: revision ? { ...savedRow, _revision: revision } : savedRow,
      error: null,
    };
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
        // 기존 레코드 업데이트 (본인 소유분만)
        // count로 실제 갱신된 행 수를 확인하여 user_id 불일치 시 false-positive 'saved' 방지
        const { error, count } = await supabase
          .from('vpylab_saved_code')
          .update({ code, updated_at: new Date().toISOString() }, { count: 'exact' })
          .eq('id', currentId)
          .eq('user_id', user.id);

        if (error || count === 0) {
          set({ saveStatus: 'error' });
        } else {
          set({ saveStatus: 'saved' });
        }
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
