/**
 * VPyLab — GitHub 동기화 클라이언트 스토어 (Phase 3, Plan C)
 *
 * 사용 흐름:
 *   1) 학생/팀이 코드 저장 후 "GitHub로 보내기" 버튼 클릭
 *   2) 이 스토어가 GitHub OAuth 토큰 확보 (authStore.getGitHubToken)
 *   3) 서버 /api/sync/github 호출 → main.py + history.md commit
 *   4) 응답으로 받은 repo 정보를 vpylab_saved_code(또는 vpylab_projects)에 저장
 *
 * 처음 동기화 시 새 GitHub 레포가 만들어지고, 이후엔 같은 레포에 누적 commit.
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import useAuthStore from './authStore';

// 다른 스토어와 동일한 VITE_API_URL을 사용 (Vercel 환경변수 컨벤션)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4034';

const useGithubSyncStore = create((set) => ({
  syncing: false,
  lastSyncedAt: null,
  lastError: null,
  lastResult: null,    // { repoFullName, repoUrl, commitSha }

  /**
   * 코드 한 건을 GitHub로 push.
   *
   * @param {object} args
   * @param {string} args.code             — 보낼 Python 코드
   * @param {string} args.title            — 코드/프로젝트 제목
   * @param {string} [args.message]        — commit 메시지
   * @param {string} [args.codeId]         — vpylab_saved_code.id (기록 갱신용)
   * @param {string} [args.projectId]      — vpylab_projects.id (팀 프로젝트 push 시)
   * @param {string} [args.revisionId]     — 어떤 revision을 push했는지 추적
   * @param {'manual'|'restore'|'mission_submit'} [args.source]
   * @param {boolean} [args.isTeam]        — 팀 push 여부 (레포 prefix 다름)
   */
  pushToGitHub: async (args) => {
    set({ syncing: true, lastError: null });
    try {
      const token = await useAuthStore.getState().getGitHubToken();
      if (!token) {
        throw new Error('GitHub 로그인이 필요합니다. 우측 상단에서 GitHub 계정으로 다시 로그인해주세요.');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      // 기존 레포 확인 — 코드 또는 프로젝트에 github_repo가 있으면 재사용
      let existingRepo = null;
      if (args.projectId) {
        const { data } = await supabase
          .from('vpylab_projects')
          .select('github_repo')
          .eq('id', args.projectId)
          .maybeSingle();
        existingRepo = data?.github_repo || null;
      } else if (args.codeId) {
        const { data } = await supabase
          .from('vpylab_saved_code')
          .select('github_repo')
          .eq('id', args.codeId)
          .maybeSingle();
        existingRepo = data?.github_repo || null;
      }

      // 작성자 표시명 (history.md용)
      const authorLabel = useAuthStore.getState().profile?.display_name
        || user.email?.split('@')[0]
        || user.id.slice(0, 8);

      const resp = await fetch(`${API_BASE}/api/sync/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: args.code,
          title: args.title,
          message: args.message || '',
          existingRepo,
          githubToken: token,
          revisionId: args.revisionId || null,
          codeId: args.codeId || null,
          projectId: args.projectId || null,
          source: args.source || 'manual',
          authorLabel,
          repoKind: args.isTeam ? 'team' : 'personal',
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json.error || `GitHub 동기화 실패 (${resp.status})`);
      }

      const result = {
        repoFullName: json.repoFullName,
        repoUrl: json.repoUrl,
        commitSha: json.commitSha,
        isNewRepo: json.isNewRepo,
      };

      // === DB 메타데이터 갱신 ===
      const nowIso = new Date().toISOString();
      if (args.projectId) {
        await supabase
          .from('vpylab_projects')
          .update({
            github_repo: result.repoFullName,
            github_last_pushed_at: nowIso,
          })
          .eq('id', args.projectId);
      }
      if (args.codeId) {
        const updatePayload = {
          github_repo: result.repoFullName,
          github_last_pushed_at: nowIso,
        };
        if (args.revisionId) updatePayload.github_last_pushed_revision_id = args.revisionId;
        await supabase
          .from('vpylab_saved_code')
          .update(updatePayload)
          .eq('id', args.codeId);
      }
      // revision에 commit SHA 기록
      if (args.revisionId && result.commitSha) {
        await supabase
          .from('vpylab_code_revisions')
          .update({ github_commit_sha: result.commitSha })
          .eq('id', args.revisionId);
      }

      set({
        syncing: false,
        lastSyncedAt: nowIso,
        lastResult: result,
        lastError: null,
      });
      return { data: result, error: null };
    } catch (e) {
      set({ syncing: false, lastError: e.message });
      return { data: null, error: { message: e.message } };
    }
  },

  reset: () => set({ lastResult: null, lastError: null, lastSyncedAt: null }),
}));

export default useGithubSyncStore;
