/**
 * VPyLab — 팀 공동 프로젝트 스토어
 * Phase 2 (Plan C):
 * - 학생 N명이 같은 코드 베이스를 공유
 * - 누가 저장해도 vpylab_code_revisions에 자기 author_id로 누적 → "누가 언제 무엇을 했는지" 한눈에
 * - Realtime: 다른 멤버의 저장이 즉시 반영되도록 vpylab_saved_code 변경을 구독
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import useCodeStore from './codeStore';
import useAuthStore from './authStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4034';

async function buildProjectPageHtml(code, title) {
  const { generateStandaloneHTML } = await import('../utils/export-html');
  return generateStandaloneHTML(code, title || 'VPyLab');
}

async function parseApiJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

const useProjectStore = create((set, get) => ({
  // 내가 owner거나 멤버인 프로젝트 목록
  myProjects: [],
  loadingProjects: false,
  projectCreationStatus: null,

  // 현재 활성화된 팀 프로젝트(에디터에서 열고 있는)
  activeProject: null,        // { id, owner_id, title, description, invite_code, ... }
  activeMembers: [],          // [{ user_id, role, joined_at, profile? }]
  activeCodeId: null,         // vpylab_saved_code.id (이 프로젝트의 코드)
  loadingActive: false,

  // 다른 멤버가 코드를 저장했음을 알리는 신호 (UI 토스트용)
  lastRemoteUpdate: null,     // { byUserId, at, codeId } | null

  _channel: null,

  // -------------------------------------------------
  // 1) 내 프로젝트 목록
  // -------------------------------------------------
  fetchMyProjects: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ myProjects: [] });
      return [];
    }
    set({ loadingProjects: true });

    // 내가 멤버인 모든 프로젝트
    const { data: memberRows } = await supabase
      .from('vpylab_project_members')
      .select('project_id, role')
      .eq('user_id', user.id);

    const projectIds = (memberRows || []).map(r => r.project_id);
    if (projectIds.length === 0) {
      set({ myProjects: [], loadingProjects: false });
      return [];
    }

    const { data: projects, error } = await supabase
      .from('vpylab_projects')
      .select('id, owner_id, title, description, invite_code, github_repo, github_last_pushed_at, created_at, updated_at')
      .in('id', projectIds)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[projectStore] fetchMyProjects 실패:', error.message);
      set({ myProjects: [], loadingProjects: false });
      return [];
    }

    // 내 역할 매핑
    const roleByProject = Object.fromEntries((memberRows || []).map(r => [r.project_id, r.role]));
    const enriched = (projects || []).map(p => ({ ...p, my_role: roleByProject[p.id] }));

    set({ myProjects: enriched, loadingProjects: false });
    return enriched;
  },

  // -------------------------------------------------
  // 2) 새 프로젝트 만들기 (Phase 4-A 통합 흐름)
  //    1) 서버: GitHub 레포 + 첫 commit + Pages 활성화
  //    2) 클라이언트: vpylab_projects + vpylab_saved_code + 첫 revision INSERT
  //    3) 활성 프로젝트로 전환
  // -------------------------------------------------
  createProject: async ({ title, description = '', initialCode = '# 새 작품' }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: '로그인이 필요합니다' } };

    const githubToken = await useAuthStore.getState().getGitHubToken();
    if (!githubToken) {
      return { error: { message: 'GitHub 로그인이 필요합니다. 우측 상단에서 GitHub로 로그인해주세요.' } };
    }

    set({ loadingProjects: true, projectCreationStatus: '실행 페이지 HTML을 준비하는 중입니다.' });

    let reservedProjectId = null;
    let reservedCodeId = null;
    let createdRepoFullName = null;
    try {
      const authorLabel = useAuthStore.getState().profile?.display_name
        || user.email?.split('@')[0]
        || user.id.slice(0, 8);
      const htmlContent = await buildProjectPageHtml(initialCode, title);

      // === 1) Supabase에 프로젝트를 먼저 예약 ===
      // GitHub 레포를 먼저 만들면 DB/RLS 실패 시 고아 public repo가 남을 수 있습니다.
      set({ projectCreationStatus: 'VPyLab 프로젝트 공간을 예약하는 중입니다.' });
      const { data: project, error: projErr } = await supabase
        .from('vpylab_projects')
        .insert({
          owner_id: user.id,
          title,
          description,
        })
        .select()
        .single();
      if (projErr) throw new Error(`Supabase project 실패: ${projErr.message}`);
      reservedProjectId = project.id;

      set({ projectCreationStatus: '첫 코드를 저장하고 이력을 만드는 중입니다.' });
      const { data: codeRow, error: codeErr } = await supabase
        .from('vpylab_saved_code')
        .insert({
          user_id: user.id,
          title,
          code: initialCode,
          project_id: project.id,
        })
        .select()
        .single();
      if (codeErr) throw new Error(`Supabase code 실패: ${codeErr.message}`);
      reservedCodeId = codeRow.id;

      const { error: revisionErr } = await supabase.from('vpylab_code_revisions').insert({
        code_id: codeRow.id,
        author_id: user.id,
        project_id: project.id,
        message: '🌱 프로젝트 생성',
        code_snapshot: initialCode,
        code_size: initialCode.length,
        source: 'manual',
      });
      if (revisionErr) throw new Error(`Supabase revision 실패: ${revisionErr.message}`);

      // === 2) 서버에 GitHub 셋업 요청 ===
      set({ projectCreationStatus: 'GitHub 저장소와 Pages 실행 페이지를 만드는 중입니다.' });
      const ghRes = await fetch(`${API_BASE}/api/projects/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, code: initialCode, htmlContent, githubToken, authorLabel,
          isTeam: false,  // 만든 직후엔 1명. 멤버 추가 시점에 README가 갱신되도록 추후 보강.
        }),
      });
      const gh = await ghRes.json();
      if (!ghRes.ok) {
        createdRepoFullName = gh.repoFullName || null;
        throw new Error(gh.error || `GitHub 셋업 실패 (${ghRes.status})`);
      }
      createdRepoFullName = gh.repoFullName;

      set({ projectCreationStatus: 'GitHub 연결 정보를 VPyLab에 반영하는 중입니다.' });
      const nowIso = new Date().toISOString();
      const { error: projectUpdateErr } = await supabase
        .from('vpylab_projects')
        .update({
          github_repo: gh.repoFullName,
          github_last_pushed_at: nowIso,
        })
        .eq('id', project.id);
      if (projectUpdateErr) throw new Error(`Supabase project 갱신 실패: ${projectUpdateErr.message}`);

      const { error: codeUpdateErr } = await supabase
        .from('vpylab_saved_code')
        .update({
          github_repo: gh.repoFullName,
          github_last_pushed_at: nowIso,
        })
        .eq('id', codeRow.id);
      if (codeUpdateErr) throw new Error(`Supabase code 갱신 실패: ${codeUpdateErr.message}`);

      // === 3) 결과 반환 ===
      const enriched = {
        ...project,
        my_role: 'owner',
        github_repo: gh.repoFullName,
        repoUrl: gh.repoUrl,
        pagesUrl: gh.pagesUrl,
        pagesActivated: gh.pagesActivated,
        codeId: codeRow.id,
      };
      set({ loadingProjects: false, projectCreationStatus: '프로젝트 목록을 갱신하는 중입니다.' });
      await get().fetchMyProjects();
      set({ projectCreationStatus: null });
      return { data: enriched, error: null };
    } catch (e) {
      set({ loadingProjects: false, projectCreationStatus: null });
      // GitHub 셋업 전/중 실패하면 예약해둔 DB 행은 정리합니다.
      // GitHub 레포 삭제 권한(delete_repo)은 요청하지 않으므로, GitHub 생성 이후 실패는 안내로 남깁니다.
      if (reservedProjectId) {
        await supabase.from('vpylab_projects').delete().eq('id', reservedProjectId);
      }
      if (reservedCodeId) {
        useCodeStore.getState().setCurrentCodeId(null);
      }
      const suffix = createdRepoFullName
        ? `\n\n주의: GitHub에 ${createdRepoFullName} 레포가 만들어졌을 수 있습니다. GitHub에서 직접 확인해주세요.`
        : '';
      return { error: { message: `${e.message}${suffix}` } };
    }
  },

  // -------------------------------------------------
  // 3) 초대 코드로 합류 (RPC)
  // -------------------------------------------------
  joinByInviteCode: async (inviteCode) => {
    const trimmed = (inviteCode || '').trim().toLowerCase();
    if (!trimmed) return { error: { message: '초대 코드를 입력해주세요' } };

    const { data, error } = await supabase.rpc('vpylab_join_project_by_invite', {
      p_invite_code: trimmed,
    });

    if (error) {
      return { error: { message: error.message || '합류에 실패했습니다' } };
    }

    await get().fetchMyProjects();
    return { data: { projectId: data }, error: null };
  },

  // -------------------------------------------------
  // 4) 활성 프로젝트 열기 (멤버 목록 로드 + Realtime 구독)
  // -------------------------------------------------
  openProject: async (projectId) => {
    if (!projectId) return;
    set({ loadingActive: true });

    const { data: project } = await supabase
      .from('vpylab_projects')
      .select('id, owner_id, title, description, invite_code, github_repo, github_last_pushed_at, created_at, updated_at')
      .eq('id', projectId)
      .single();

    const { data: members } = await supabase
      .from('vpylab_project_members')
      .select('user_id, role, joined_at')
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true });

    // 멤버 표시명: vpylab_profiles에서 display_name 가져오기 (실패해도 무시)
    let memberWithProfile = members || [];
    if (members && members.length > 0) {
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('vpylab_profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      memberWithProfile = members.map(m => ({ ...m, profile: byId[m.user_id] || null }));
    }

    // 이 프로젝트의 코드 1건 (가장 최근에 업데이트된 것)
    const { data: codeRow } = await supabase
      .from('vpylab_saved_code')
      .select('id, title, code, updated_at, user_id')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    set({
      activeProject: project || null,
      activeMembers: memberWithProfile,
      activeCodeId: codeRow?.id || null,
      loadingActive: false,
    });

    // Realtime 구독 (다른 멤버의 저장을 받기 위해)
    get()._subscribeRealtime(projectId);

    return { project, code: codeRow };
  },

  closeProject: () => {
    get()._unsubscribeRealtime();
    set({
      activeProject: null,
      activeMembers: [],
      activeCodeId: null,
      lastRemoteUpdate: null,
    });
  },

  // -------------------------------------------------
  // 5) 멤버 관리
  // -------------------------------------------------
  removeMember: async (projectId, userId) => {
    const { error } = await supabase
      .from('vpylab_project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (!error) {
      const filtered = get().activeMembers.filter(m => m.user_id !== userId);
      set({ activeMembers: filtered });
    }
    return { error };
  },

  setMemberRole: async (projectId, userId, role) => {
    const { error } = await supabase
      .from('vpylab_project_members')
      .update({ role })
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (!error) {
      const updated = get().activeMembers.map(m =>
        m.user_id === userId ? { ...m, role } : m,
      );
      set({ activeMembers: updated });
    }
    return { error };
  },

  leaveProject: async (projectId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: '로그인이 필요합니다' } };

    const { error } = await supabase
      .from('vpylab_project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', user.id);
    if (!error) {
      get().closeProject();
      await get().fetchMyProjects();
    }
    return { error };
  },

  regenerateInviteCode: async (projectId) => {
    // RLS는 owner만 update 허용
    const newCode = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
      .replace(/-/g, '')
      .slice(0, 8)
      .toLowerCase();
    const { data, error } = await supabase
      .from('vpylab_projects')
      .update({ invite_code: newCode })
      .eq('id', projectId)
      .select()
      .single();
    if (!error && data) {
      set({ activeProject: { ...get().activeProject, invite_code: data.invite_code } });
    }
    return { data, error };
  },

  inviteGithubCollaborator: async ({ username }) => {
    const { activeProject } = get();
    if (!activeProject?.github_repo) {
      return { error: { message: 'GitHub 저장소 연결 정보가 없습니다.' } };
    }
    const githubToken = await useAuthStore.getState().getGitHubToken();
    if (!githubToken) {
      return { error: { message: 'GitHub 로그인이 만료되었습니다. 저장소 소유자 계정으로 다시 로그인해주세요.' } };
    }

    try {
      const response = await fetch(`${API_BASE}/api/projects/collaborators/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: activeProject.github_repo,
          username,
          githubToken,
        }),
      });
      const result = await parseApiJson(response);
      if (!response.ok) {
        return { error: { message: result.error || `GitHub collaborator 초대 실패 (${response.status})` } };
      }
      return { data: result, error: null };
    } catch (e) {
      return { error: { message: `GitHub collaborator 초대 실패: ${e.message}` } };
    }
  },

  deleteProject: async (projectId) => {
    const { error } = await supabase
      .from('vpylab_projects')
      .delete()
      .eq('id', projectId);
    if (!error) {
      get().closeProject();
      await get().fetchMyProjects();
    }
    return { error };
  },

  // -------------------------------------------------
  // 6) Realtime — 다른 멤버의 코드 저장 알림
  // -------------------------------------------------
  _subscribeRealtime: (projectId) => {
    get()._unsubscribeRealtime();

    const channel = supabase
      .channel(`vpylab-project:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vpylab_saved_code',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          // 본인이 만든 변경은 자기 화면을 덮어쓰지 않도록 무시 (현재 편집 중인 코드 보호)
          // user_id 필드가 payload에 없을 수 있어 신중히 처리
          const byMe = payload.new?.user_id && user?.id === payload.new.user_id;
          if (byMe) return;

          set({
            lastRemoteUpdate: {
              byUserId: payload.new?.user_id || null,
              at: new Date().toISOString(),
              codeId: payload.new?.id || null,
            },
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vpylab_code_revisions',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          // revision 패널이 열려 있다면 자동 갱신을 위해 신호만
          set({ lastRemoteUpdate: { ...(get().lastRemoteUpdate || {}), at: new Date().toISOString(), kind: 'revision' } });
        },
      )
      .subscribe();

    set({ _channel: channel });
  },

  _unsubscribeRealtime: () => {
    const ch = get()._channel;
    if (ch) {
      supabase.removeChannel(ch);
      set({ _channel: null });
    }
  },

  /**
   * 프로젝트 컨텍스트에서 저장 + GitHub commit 한 묶음
   * - Supabase: vpylab_saved_code update + vpylab_code_revisions insert (codeStore 위임)
   * - GitHub:   POST /api/projects/commit 으로 main.py + history.md + index.html 갱신
   * - revision에 commit SHA 박아 "✓ GitHub" 배지 표시
   *
   * 반환: { ok, commitSha, commitUrl, repoUrl, pagesUrl, nthCommit, error }
   */
  saveAndPush: async ({ code, message }) => {
    const { activeProject, activeCodeId } = get();
    if (!activeProject || !activeCodeId) {
      return { error: { message: '활성 프로젝트가 없습니다.' } };
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: '로그인이 필요합니다' } };

    const githubToken = await useAuthStore.getState().getGitHubToken();
    if (!githubToken) {
      return { error: { message: 'GitHub 로그인이 만료되었습니다. 다시 로그인해주세요.' } };
    }
    if (!activeProject.github_repo) {
      return { error: { message: '이 프로젝트는 GitHub 저장소와 아직 연결되지 않았습니다. 새 프로젝트를 다시 만들거나 저장소 연결을 확인해주세요.' } };
    }

    // 1) GitHub 쓰기 권한 먼저 확인
    // 팀 초대 코드 합류와 GitHub collaborator 권한은 별도라서, 권한 없는 상태에서
    // Supabase revision만 생기고 GitHub commit이 실패하는 흐름을 막습니다.
    try {
      const accessResponse = await fetch(`${API_BASE}/api/projects/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: activeProject.github_repo,
          githubToken,
        }),
      });
      const accessResult = await parseApiJson(accessResponse);
      if (!accessResponse.ok) {
        return { error: { message: accessResult.error || `GitHub 권한 확인 실패 (${accessResponse.status})` } };
      }
    } catch (e) {
      return { error: { message: `GitHub 권한 확인 실패: ${e.message}` } };
    }

    // 2) Supabase 저장 + revision 생성 (codeStore가 처리)
    const { data: saved, error: saveErr } = await useCodeStore.getState().saveCode({
      title: activeProject.title,
      code,
      id: activeCodeId,
      projectId: activeProject.id,
      commitMessage: message || '',
      source: 'manual',
    });
    if (saveErr) return { error: saveErr };

    // 방금 만든 revision을 우선 사용하고, 구버전 반환값이면 1건 조회로 보완
    let lastRev = saved?._revision || null;
    if (!lastRev) {
      const { data } = await supabase
        .from('vpylab_code_revisions')
        .select('id')
        .eq('code_id', activeCodeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      lastRev = data;
    }

    // 3) 서버에 GitHub commit 요청
    const authorLabel = useAuthStore.getState().profile?.display_name
      || user.email?.split('@')[0]
      || user.id.slice(0, 8);

    let commitResult;
    try {
      const htmlContent = await buildProjectPageHtml(code, activeProject.title);
      const r = await fetch(`${API_BASE}/api/projects/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: activeProject.github_repo,
          code,
          htmlContent,
          title: activeProject.title,
          message: message || `📝 ${new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })} 저장`,
          githubToken,
          authorLabel,
          source: 'manual',
          revisionId: lastRev?.id || null,
          updateIndex: true,
        }),
      });
      commitResult = await parseApiJson(r);
      if (!r.ok) throw new Error(commitResult.error || `GitHub commit 실패 (${r.status})`);
    } catch (e) {
      return { error: { message: e.message } };
    }

    // 4) revision에 commit SHA 박기 + project last_pushed_at 갱신
    const nowIso = new Date().toISOString();
    if (lastRev?.id && commitResult.commitSha) {
      await supabase.from('vpylab_code_revisions')
        .update({ github_commit_sha: commitResult.commitSha })
        .eq('id', lastRev.id);
    }
    await supabase.from('vpylab_projects')
      .update({ github_last_pushed_at: nowIso })
      .eq('id', activeProject.id);
    await supabase.from('vpylab_saved_code')
      .update({
        github_last_pushed_at: nowIso,
        github_last_pushed_revision_id: lastRev?.id || null,
      })
      .eq('id', activeCodeId);

    // 5) 누적 commit 카운트 (revision 중 github_commit_sha 있는 것)
    const { count: nthCommit } = await supabase
      .from('vpylab_code_revisions')
      .select('id', { count: 'exact', head: true })
      .eq('code_id', activeCodeId)
      .not('github_commit_sha', 'is', null);

    return {
      data: {
        commitSha: commitResult.commitSha,
        pageCommitSha: commitResult.pageCommitSha,
        commitUrl: commitResult.commitUrl,
        pageCommitUrl: commitResult.pageCommitUrl,
        repoUrl: commitResult.repoUrl,
        pagesUrl: commitResult.pagesUrl,
        pagesStatus: commitResult.pagesStatus,
        pagesBuildRequested: commitResult.pagesBuildRequested,
        pagesWarning: commitResult.pagesWarning,
        nthCommit: nthCommit || 1,
        savedCodeId: saved?.id,
      },
      error: null,
    };
  },

  /**
   * 외부에서 호출: 다른 멤버의 변경을 현재 에디터에 받아오기
   * 사용 시점: lastRemoteUpdate 토스트의 "최신으로 가져오기" 버튼
   */
  pullLatest: async () => {
    const codeId = get().activeCodeId;
    if (!codeId) return null;
    const { data } = await supabase
      .from('vpylab_saved_code')
      .select('id, code')
      .eq('id', codeId)
      .single();
    if (data) {
      // codeStore에 currentCodeId 갱신은 외부에서 처리. 여기서는 코드 텍스트만 반환.
      useCodeStore.getState().setCurrentCodeId(data.id);
      set({ lastRemoteUpdate: null });
      return data.code;
    }
    return null;
  },
}));

export default useProjectStore;
