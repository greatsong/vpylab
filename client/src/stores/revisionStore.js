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
  restoring: false,

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
   * - 현재 저장본과 미저장 편집본을 이력으로 보관한 뒤 vpylab_saved_code.code를 바꾸고
   * - source='restore'로 새 revision을 1행 추가한다 (git revert와 동일한 흐름)
   * - onRestored 콜백에 복원된 코드 텍스트를 전달 (에디터에 반영하기 위함)
   */
  restoreRevision: async (revisionId, { currentCode, currentCodeId, onRestored } = {}) => {
    if (get().restoring) return { error: { message: '이미 복원 중입니다. 잠시 기다려주세요.' } };
    set({ restoring: true });
    let resumeAutoSave;
    let restored = false;
    try {
      resumeAutoSave = await useCodeStore.getState().pauseAutoSave();
      const snapshot = await get().fetchRevisionSnapshot(revisionId);
      if (!snapshot) return { error: { message: '복원할 버전을 찾지 못했습니다' } };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { error: { message: '로그인이 필요합니다' } };

      // 목록에서 다른 작품을 복원해 에디터를 교체할 때도 현재 편집본은 원래 작품 이력에 보관합니다.
      const differentEditor = currentCodeId !== undefined && currentCodeId !== snapshot.code_id;
      if (differentEditor && typeof currentCode === 'string') {
        if (!currentCodeId) return { error: { message: '현재 편집 중인 코드를 먼저 저장한 뒤 다른 작품을 복원해주세요.' } };
        const { data: editorRow, error: editorError } = await supabase
          .from('vpylab_saved_code').select('id, code, project_id').eq('id', currentCodeId).single();
        if (editorError || !editorRow) return { error: { message: '현재 편집본의 저장 위치를 확인하지 못해 복원하지 않았습니다.' } };
        if (editorRow.code !== currentCode) {
          const { data, error } = await useCodeStore.getState()._createRevision({
            codeId: currentCodeId, code: currentCode, userId: user.id,
            message: '다른 작품 복원 전 편집본 보관', source: 'manual', projectId: editorRow.project_id || null, skipParentLookup: true,
          });
          if (error || !data?.id) return { error: { message: '현재 편집본을 보관하지 못해 복원하지 않았습니다. 코드 저장 후 다시 시도해주세요.' } };
        }
      }

      const { data: currentRow, error: readError } = await supabase
        .from('vpylab_saved_code')
        .select('id, title, code, project_id, updated_at')
        .eq('id', snapshot.code_id)
        .single();
      if (readError || !currentRow) {
        return { error: readError || { message: '현재 코드를 확인하지 못해 복원하지 않았습니다.' } };
      }

      // 다른 멤버의 최신 저장본과 내 미저장 편집본이 다를 수 있으므로 둘 다 보관합니다.
      const backups = new Set([currentRow.code, differentEditor ? undefined : currentCode]);
      for (const code of backups) {
        if (typeof code !== 'string' || code === snapshot.code_snapshot) continue;
        try {
          const { data, error } = await useCodeStore.getState()._createRevision({
            codeId: snapshot.code_id,
            code,
            userId: user.id,
            message: code === currentRow.code ? '복원 전 저장본 보관' : '복원 전 편집본 보관',
            source: 'manual',
            projectId: currentRow.project_id || snapshot.project_id || null,
            skipParentLookup: true,
          });
          if (error || !data?.id) {
            return { error: { message: '현재 코드의 보관에 실패해 복원하지 않았습니다. 코드 저장 후 다시 시도해주세요.' } };
          }
        } catch {
          return { error: { message: '현재 코드의 보관에 실패해 복원하지 않았습니다. 코드 저장 후 다시 시도해주세요.' } };
        }
      }

      // 보관 중 다른 멤버가 저장했다면 덮어쓰지 않고 다시 확인하도록 합니다.
      let codeRow;
      let warning = '';
      const shortId = revisionId.slice(0, 8);
      if (currentRow.project_id) {
        const result = await useCodeStore.getState().saveCode({
          id: snapshot.code_id, projectId: currentRow.project_id, title: currentRow.title,
          expectedCode: currentRow.code, code: snapshot.code_snapshot,
          source: 'restore', commitMessage: `이전 버전으로 복원 (${shortId})`,
        });
        if (result.error) return { error: result.error };
        if (result.data?._superseded) return { error: { code: 'saved_code_conflict', latestCode: result.data._latestCode,
          message: '이 복원 요청은 이미 반영됐지만 이후 다른 저장이 추가됐습니다. 편집본을 유지했으니 최신 코드와 비교해주세요.' } };
        codeRow = result.data;
        restored = true;
      } else {
      let query = supabase
        .from('vpylab_saved_code')
        .update({
          code: snapshot.code_snapshot,
          updated_at: new Date().toISOString(),
        })
        .eq('id', snapshot.code_id);
      if (currentRow.updated_at) query = query.eq('updated_at', currentRow.updated_at);
      const { data, error: updateError } = await query.select('id, project_id').maybeSingle();
      codeRow = data;

      if (updateError) {
        console.warn('[revisionStore] restore update 실패:', updateError.message);
        return { error: updateError };
      }
      if (!codeRow) return { error: { message: '다른 저장이 먼저 반영되었습니다. 최신 코드를 확인한 뒤 다시 복원해주세요.' } };
      restored = true;

      // 본문 복원 후 이력 추가만 실패했다면 실제 복원 결과와 경고를 함께 전달합니다.
      try {
        const { data, error } = await useCodeStore.getState()._createRevision({
          codeId: snapshot.code_id,
          code: snapshot.code_snapshot,
          userId: user.id,
          message: `이전 버전으로 복원 (${shortId})`,
          source: 'restore',
          projectId: snapshot.project_id || codeRow.project_id || null,
          skipParentLookup: true,
        });
        if (error || !data?.id) warning = '코드는 복원됐지만 복원 이력을 추가하지 못했습니다. 코드 저장으로 이력을 다시 남겨주세요.';
      } catch {
        warning = '코드는 복원됐지만 복원 이력을 추가하지 못했습니다. 코드 저장으로 이력을 다시 남겨주세요.';
      }
      }

      // 3) UI 갱신
      // 목록 갱신 실패가 이미 완료한 본문 복원과 에디터 반영을 막지 않게 합니다.
      const { default: projectStore } = await import('./projectStore');
      if (projectStore.getState().activeCodeId === snapshot.code_id) {
        projectStore.setState({ activeCodeSnapshot: snapshot.code_snapshot });
      }
      if (onRestored) onRestored(snapshot.code_snapshot);
      try {
        await get().fetchRevisions(snapshot.code_id);
        await useCodeStore.getState().fetchSavedCodes();
      } catch {
        warning = [warning, '코드는 복원됐지만 목록을 갱신하지 못했습니다. 이력을 다시 열어주세요.'].filter(Boolean).join('\n');
      }
      return { data: codeRow, error: null, warning };
    } catch (error) {
      return { error: { message: error.message || '복원 중 오류가 발생했습니다. 다시 시도해주세요.' } };
    } finally {
      resumeAutoSave?.(restored);
      set({ restoring: false });
    }
  },

  /**
   * 패널 닫기 + 상태 초기화
   */
  closePanel: () => set({ panelOpen: false, revisions: [], activeCodeId: null }),
}));

export default useRevisionStore;
