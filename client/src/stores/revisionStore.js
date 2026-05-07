/**
 * VPyLab — 코드 이력(Revision) 스토어
 * Phase 1 (Plan C): 학생이 수동 저장할 때마다 누적되는 코드 스냅샷을 조회/복원한다.
 *
 * 정책:
 * - 자동저장은 revision을 생성하지 않는다 (codeStore.autoSave 참고)
 * - 수동 저장(saveCode source='manual') / 복원(source='restore')만 누적
 * - revision은 immutable — 삭제/수정 API를 제공하지 않는다
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import useCodeStore from './codeStore';

const useRevisionStore = create((set, get) => ({
  revisions: [],          // 현재 열린 코드의 revision 목록 (최신순)
  loading: false,
  panelOpen: false,
  activeCodeId: null,     // 타임라인을 보고 있는 code_id

  setPanelOpen: (open) => set({ panelOpen: open }),

  /**
   * 특정 코드의 revision 목록 로드
   */
  fetchRevisions: async (codeId) => {
    if (!codeId) {
      set({ revisions: [], activeCodeId: null });
      return [];
    }
    set({ loading: true, activeCodeId: codeId });

    const { data, error } = await supabase
      .from('vpylab_code_revisions')
      .select('id, code_id, project_id, parent_revision_id, author_id, message, code_size, source, github_commit_sha, created_at')
      .eq('code_id', codeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[revisionStore] fetch 실패:', error.message);
      set({ revisions: [], loading: false });
      return [];
    }

    set({ revisions: data || [], loading: false });
    return data || [];
  },

  /**
   * 단일 revision의 코드 스냅샷을 가져온다 (목록에는 무거운 code_snapshot을 빼두었기 때문)
   */
  fetchRevisionSnapshot: async (revisionId) => {
    const { data, error } = await supabase
      .from('vpylab_code_revisions')
      .select('id, code_id, project_id, code_snapshot, message, created_at')
      .eq('id', revisionId)
      .single();

    if (error) {
      console.warn('[revisionStore] snapshot 실패:', error.message);
      return null;
    }
    return data;
  },

  /**
   * revision을 현재 상태로 복원한다.
   * - vpylab_saved_code.code를 스냅샷으로 덮어쓰고
   * - source='restore'로 새 revision을 1행 추가한다 (git revert와 동일한 흐름)
   * - onRestored 콜백에 복원된 코드 텍스트를 전달 (에디터에 반영하기 위함)
   */
  restoreRevision: async (revisionId, { onRestored } = {}) => {
    const snapshot = await get().fetchRevisionSnapshot(revisionId);
    if (!snapshot) return { error: { message: '복원할 버전을 찾지 못했습니다' } };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: '로그인이 필요합니다' } };

    // 1) 현재 code 행을 스냅샷으로 덮어쓰기
    const { data: codeRow, error: updateError } = await supabase
      .from('vpylab_saved_code')
      .update({
        code: snapshot.code_snapshot,
        updated_at: new Date().toISOString(),
      })
      .eq('id', snapshot.code_id)
      .select('id, project_id')
      .single();

    if (updateError) {
      console.warn('[revisionStore] restore update 실패:', updateError.message);
      return { error: updateError };
    }

    // 2) 'restore' source의 새 revision 추가 (이력 유지)
    const shortId = revisionId.slice(0, 8);
    await useCodeStore.getState()._createRevision({
      codeId: snapshot.code_id,
      code: snapshot.code_snapshot,
      userId: user.id,
      message: `이전 버전으로 복원 (${shortId})`,
      source: 'restore',
      projectId: snapshot.project_id || codeRow.project_id || null,
    });

    // 3) UI 갱신
    await get().fetchRevisions(snapshot.code_id);
    useCodeStore.getState().fetchSavedCodes();

    if (onRestored) onRestored(snapshot.code_snapshot);
    return { data: codeRow, error: null };
  },

  /**
   * 패널 닫기 + 상태 초기화
   */
  closePanel: () => set({ panelOpen: false, revisions: [], activeCodeId: null }),
}));

export default useRevisionStore;
