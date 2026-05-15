/**
 * VPyLab — 팀 공동 프로젝트 스토어
 * Phase 2 (Plan C):
 * - 학생 N명이 같은 코드 베이스를 공유
 * - 누가 저장해도 vpylab_code_revisions에 자기 author_id로 누적 → "누가 언제 무엇을 했는지" 한눈에
 * - Realtime: 다른 멤버의 저장이 즉시 보이도록 revision author_id 기준으로 알림
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import useCodeStore from './codeStore';
import useAuthStore from './authStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4034';
const GITHUB_SYNC_FAST_WAIT_MS = 3500;
const GITHUB_RECORD_FAST_WAIT_MS = 800;
const GITHUB_SYNC_TIMEOUT_MS = 45000;
const GITHUB_SETUP_TIMEOUT_MS = 90000;
const AUTH_TIMEOUT_MS = 10000;
const GITHUB_AUTH_TIMEOUT_MS = 3000;
const SUPABASE_TIMEOUT_MS = 15000;
const SUPABASE_WRITE_TIMEOUT_MS = 30000;
const GITHUB_SYNC_RETRY_BASE_MS = 60_000;
const GITHUB_SYNC_RETRY_MAX_MS = 30 * 60_000;
const GITHUB_SYNC_PENDING_STORAGE_KEY = 'vpylab:github-sync-pending:v1';
const GITHUB_SYNC_MAX_PENDING_JOBS = 50;
const GITHUB_SYNC_FORCE_RETRYABLE_BLOCKED_CODES = new Set([
  'github_auth_required',
  'github_2fa_required',
  'github_permission_required',
  'github_repo_unavailable',
]);
const githubSyncChains = new Map();
const githubSyncInFlightJobs = new Map();

function normalizeError(error) {
  if (!error) return { message: '알 수 없는 오류', status: null, code: null };
  if (typeof error === 'string') return { message: error, status: null, code: null };
  return {
    message: error.message || String(error),
    status: error.status || null,
    code: error.code || error.errorCode || null,
  };
}

function classifyGithubSyncError(error) {
  const { message, status, code } = normalizeError(error);
  if (
    code === 'github_auth_required'
    || status === 401
    || /GitHub (인증|로그인)|GitHub 재로그인|저장 권한 연결/.test(message)
  ) {
    return {
      code: 'github_auth_required',
      blocked: true,
      message: 'GitHub 재로그인이 필요합니다. VPyLab 저장은 완료됐고 GitHub 반영만 보류했습니다.',
    };
  }

  if (
    code === 'github_2fa_required'
    || /2FA|two[-\s]?factor|2단계 인증|2요소 인증|restricted from account actions/i.test(message)
  ) {
    return {
      code: 'github_2fa_required',
      blocked: true,
      message: 'GitHub 계정에 2단계 인증(2FA)을 켜야 합니다. VPyLab 저장은 완료됐고 GitHub 반영만 보류했습니다.',
    };
  }

  if (
    code === 'github_write_permission_required'
    || code === 'github_admin_permission_required'
    || status === 403
    || /쓰기 권한|권한 부족|collaborator|Collaborators|초대.*수락/i.test(message)
  ) {
    return {
      code: 'github_permission_required',
      blocked: true,
      message: 'GitHub collaborator 초대 수락 또는 쓰기 권한 확인이 필요합니다. VPyLab 저장은 완료됐고 GitHub 반영만 보류했습니다.',
    };
  }

  if (
    code === 'missing_repo'
    || status === 404
    || /저장소를 찾을 수 없|not found/i.test(message)
  ) {
    return {
      code: 'github_repo_unavailable',
      blocked: true,
      message: 'GitHub 저장소를 확인할 수 없습니다. 저장소 연결 정보를 다시 확인해주세요.',
    };
  }

  if (
    code === 'github_content_too_large'
    || status === 413
    || /너무 큽니다|too large/i.test(message)
  ) {
    return {
      code: 'github_content_too_large',
      blocked: true,
      message: 'GitHub에 올리기에는 코드나 HTML이 너무 큽니다. VPyLab 저장은 완료됐고 GitHub 반영만 보류했습니다.',
    };
  }

  if (
    code === 'invalid_voyage_entry'
    || code === 'missing_voyage_entry'
    || code === 'github_invalid_pending_job'
    || code === 'github_job_user_mismatch'
    || status === 400
  ) {
    return {
      code: code || 'github_invalid_request',
      blocked: true,
      message: code === 'github_job_user_mismatch'
        ? '다른 로그인 계정의 GitHub 대기 작업입니다. 해당 계정으로 로그인하면 다시 시도할 수 있습니다.'
        : 'GitHub 반영 요청 형식을 확인해야 합니다. VPyLab 저장은 완료됐고 GitHub 반영만 보류했습니다.',
    };
  }

  return {
    code: code || 'github_retryable',
    blocked: false,
    message,
  };
}

function getGithubRetryDelayMs(attempts) {
  const exponent = Math.min(Math.max(attempts - 1, 0), 6);
  return Math.min(GITHUB_SYNC_RETRY_BASE_MS * (2 ** exponent), GITHUB_SYNC_RETRY_MAX_MS);
}

function waitForPending(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ pending: true }), ms);
  });
}

function withTimeout(promise, timeoutMs, message) {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout])
    .finally(() => clearTimeout(timerId));
}

async function getCurrentUserForSave(message = '로그인 확인이 지연되고 있습니다.') {
  const cachedUser = useAuthStore.getState().user;
  if (cachedUser?.id) return cachedUser;

  const { data: { user } } = await withTimeout(
    supabase.auth.getUser(),
    AUTH_TIMEOUT_MS,
    message,
  );
  return user;
}

async function getGithubTokenForSave(message = 'GitHub 인증 확인이 지연되고 있습니다.') {
  try {
    const token = await withTimeout(
      useAuthStore.getState().getGitHubToken(),
      GITHUB_AUTH_TIMEOUT_MS,
      message,
    );
    return { token, error: null };
  } catch (error) {
    console.warn('[projectStore] GitHub 토큰 확인 실패:', error.message);
    return { token: null, error };
  }
}

function getPendingGithubJobs() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GITHUB_SYNC_PENDING_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((job) => job?.id && job?.projectId) : [];
  } catch {
    return [];
  }
}

function setPendingGithubJobs(jobs) {
  if (typeof window === 'undefined') return;
  try {
    const limited = jobs
      .filter((job) => job?.id && job?.projectId)
      .slice(-GITHUB_SYNC_MAX_PENDING_JOBS);
    window.localStorage.setItem(GITHUB_SYNC_PENDING_STORAGE_KEY, JSON.stringify(limited));
  } catch (error) {
    console.warn('[projectStore] GitHub 대기열 저장 실패:', error.message);
  }
}

function upsertPendingGithubJob(job) {
  const jobs = getPendingGithubJobs();
  const nextJob = {
    ...job,
    attempts: job.attempts || 0,
    updatedAt: new Date().toISOString(),
  };
  setPendingGithubJobs([
    ...jobs.filter((item) => item.id !== nextJob.id),
    nextJob,
  ]);
}

function removePendingGithubJob(jobId) {
  setPendingGithubJobs(getPendingGithubJobs().filter((job) => job.id !== jobId));
}

function markPendingGithubJobFailed(jobId, error) {
  const jobs = getPendingGithubJobs();
  const failure = classifyGithubSyncError(error);
  setPendingGithubJobs(jobs.map((job) => (
    job.id === jobId
      ? {
          ...job,
          attempts: (job.attempts || 0) + 1,
          blocked: failure.blocked,
          lastError: failure.message,
          lastErrorCode: failure.code,
          nextRetryAt: failure.blocked
            ? null
            : new Date(Date.now() + getGithubRetryDelayMs((job.attempts || 0) + 1)).toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : job
  )));
}

function blockPendingGithubJob(job, error) {
  upsertPendingGithubJob(job);
  markPendingGithubJobFailed(job.id, error);
}

function enqueueProjectGithubSync(projectId, task) {
  const previous = githubSyncChains.get(projectId) || Promise.resolve();
  const next = previous.catch(() => null).then(task);
  let tracked;
  tracked = next.finally(() => {
    if (githubSyncChains.get(projectId) === tracked) {
      githubSyncChains.delete(projectId);
    }
  }).catch(() => null);
  githubSyncChains.set(projectId, tracked);
  return next;
}

function enqueuePendingGithubJob(job, task) {
  if (githubSyncInFlightJobs.has(job.id)) {
    return githubSyncInFlightJobs.get(job.id);
  }
  const inFlight = enqueueProjectGithubSync(
    job.projectId,
    () => withTimeout(
      Promise.resolve().then(task),
      GITHUB_SYNC_TIMEOUT_MS + SUPABASE_TIMEOUT_MS,
      'GitHub 반영이 제한 시간을 넘었습니다. 대기열에 남겨두고 다음에 다시 시도합니다.',
    ),
  )
    .finally(() => {
      githubSyncInFlightJobs.delete(job.id);
    });
  githubSyncInFlightJobs.set(job.id, inFlight);
  return inFlight;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = GITHUB_SYNC_TIMEOUT_MS) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`요청이 ${Math.round(timeoutMs / 1000)}초 안에 끝나지 않았습니다.`);
    }
    throw error;
  } finally {
    clearTimeout(timerId);
  }
}

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

async function fetchProfilesForMembers(userIds) {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('vpylab_profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds),
      SUPABASE_TIMEOUT_MS,
      '멤버 프로필 조회가 15초 안에 끝나지 않았습니다.',
    );

    if (error) {
      console.warn('[projectStore] 멤버 프로필 조회 실패:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn('[projectStore] 멤버 프로필 조회 실패:', e.message);
    return [];
  }
}

async function fetchMemberGithubUsernames(projectId) {
  const { data: { session } } = await withTimeout(
    supabase.auth.getSession(),
    8000,
    'GitHub 사용자명 확인을 위한 로그인 조회가 8초 안에 끝나지 않았습니다.',
  ).catch((e) => {
    console.warn('[projectStore] GitHub 사용자명 세션 조회 실패:', e.message);
    return { data: { session: null } };
  });
  if (!session?.access_token) return {};

  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/projects/members/github-usernames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, accessToken: session.access_token }),
    }, 8000);
    const result = await parseApiJson(response);
    if (!response.ok) {
      console.warn('[projectStore] GitHub 사용자명 조회 실패:', result.error || response.status);
      return {};
    }
    return result.githubUsernames || {};
  } catch (e) {
    console.warn('[projectStore] GitHub 사용자명 조회 실패:', e.message);
    return {};
  }
}

const useProjectStore = create((set, get) => ({
  // 내가 owner거나 멤버인 프로젝트 목록
  myProjects: [],
  loadingProjects: false,
  projectCreationStatus: null,
  projectSaveStatus: null,
  githubSetupStatusById: {},  // { [projectId]: { state, message, repoFullName?, error? } }

  // 현재 활성화된 팀 프로젝트(에디터에서 열고 있는)
  activeProject: null,        // { id, owner_id, title, description, invite_code, ... }
  activeMembers: [],          // [{ user_id, role, joined_at, profile? }]
  activeCodeId: null,         // vpylab_saved_code.id (이 프로젝트의 코드)
  loadingActive: false,

  // 다른 멤버가 코드를 저장했음을 알리는 신호 (UI 토스트용)
  lastRemoteUpdate: null,     // { byUserId, at, codeId, revisionId, kind } | null

  _channel: null,

  // -------------------------------------------------
  // 1) 내 프로젝트 목록
  // -------------------------------------------------
  fetchMyProjects: async () => {
    const user = await getCurrentUserForSave('로그인 확인이 지연되고 있습니다.').catch(() => null);
    if (!user) {
      set({ myProjects: [] });
      return [];
    }
    set({ loadingProjects: true });

    try {
      // 내가 멤버인 모든 프로젝트
      const { data: memberRows, error: memberError } = await withTimeout(
        supabase
          .from('vpylab_project_members')
          .select('project_id, role')
          .eq('user_id', user.id),
        SUPABASE_TIMEOUT_MS,
        '프로젝트 목록 조회가 15초 안에 끝나지 않았습니다.',
      );
      if (memberError) throw memberError;

      const projectIds = (memberRows || []).map(r => r.project_id);
      if (projectIds.length === 0) {
        set({ myProjects: [], loadingProjects: false });
        return [];
      }

      const { data: projects, error } = await withTimeout(
        supabase
          .from('vpylab_projects')
          .select('id, owner_id, title, description, invite_code, github_repo, github_last_pushed_at, created_at, updated_at')
          .in('id', projectIds)
          .order('updated_at', { ascending: false }),
        SUPABASE_TIMEOUT_MS,
        '프로젝트 상세 조회가 15초 안에 끝나지 않았습니다.',
      );

      if (error) throw error;

      const { data: allMemberRows } = await withTimeout(
        supabase
          .from('vpylab_project_members')
          .select('project_id')
          .in('project_id', projectIds),
        SUPABASE_TIMEOUT_MS,
        '프로젝트 멤버 수 조회가 15초 안에 끝나지 않았습니다.',
      ).catch(() => ({ data: memberRows || [] }));

      // 내 역할 매핑
      const roleByProject = Object.fromEntries((memberRows || []).map(r => [r.project_id, r.role]));
      const memberCountByProject = (allMemberRows || []).reduce((acc, row) => {
        acc[row.project_id] = (acc[row.project_id] || 0) + 1;
        return acc;
      }, {});
      const enriched = (projects || []).map(p => ({
        ...p,
        my_role: roleByProject[p.id],
        member_count: memberCountByProject[p.id] || 1,
      }));

      set({ myProjects: enriched, loadingProjects: false });
      return enriched;
    } catch (e) {
      console.warn('[projectStore] fetchMyProjects 실패:', e.message);
      set({ myProjects: [], loadingProjects: false });
      return [];
    }
  },

  // -------------------------------------------------
  // 2) 새 프로젝트 만들기
  //    1) Supabase 프로젝트 + 첫 코드 + 첫 revision을 먼저 저장
  //    2) 사용자는 바로 프로젝트를 열 수 있음
  //    3) 요청한 경우에만 GitHub 레포/Pages 준비를 뒤에서 이어서 처리
  // -------------------------------------------------
  createProject: async ({
    title,
    description = '',
    initialCode = '# 새 작품',
    repoName = '',
    setupGithub = false,
  }) => {
    // 단계별 timing 진단 — 브라우저 콘솔에 [createProject] +Xms (총 Yms): 단계로 남깁니다.
    // 다음 학생 시연에서 어느 단계가 몇 초 걸렸는지 즉시 식별 가능.
    const t0 = performance.now();
    let lastT = t0;
    const step = (label) => {
      const now = performance.now();
      console.log(`[createProject] +${Math.round(now - lastT)}ms (총 ${Math.round(now - t0)}ms): ${label}`);
      lastT = now;
    };

    const user = await getCurrentUserForSave();
    if (!user) return { error: { message: '로그인이 필요합니다' } };
    step('auth 사용자 조회');

    let githubToken = null;
    let githubTokenError = null;
    if (setupGithub) {
      const tokenResult = await getGithubTokenForSave('GitHub 로그인 확인이 지연되고 있습니다.');
      githubToken = tokenResult.token;
      githubTokenError = tokenResult.error;
      step(githubToken ? 'GitHub 토큰 확인' : 'GitHub 토큰 없음');
    } else {
      step('GitHub 셋업 생략');
    }
    const shouldStartGithubSetup = setupGithub && !!githubToken;

    set({ loadingProjects: true, projectCreationStatus: 'VPyLab 프로젝트 공간을 만드는 중입니다.' });

    let reservedProjectId = null;
    let reservedCodeId = null;
    try {
      const authorLabel = useAuthStore.getState().profile?.display_name
        || user.email?.split('@')[0]
        || user.id.slice(0, 8);

      // === 1) Supabase에 프로젝트를 먼저 예약 ===
      // GitHub 레포를 먼저 만들면 DB/RLS 실패 시 고아 public repo가 남을 수 있습니다.
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
      step('Supabase project insert');

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
      step('Supabase code insert');

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
      step('Supabase revision insert');

      const enriched = {
        ...project,
        my_role: 'owner',
        member_count: 1,
        githubSetupPending: shouldStartGithubSetup,
        codeId: codeRow.id,
        code: {
          id: codeRow.id,
          title: codeRow.title,
          code: codeRow.code,
          updated_at: codeRow.updated_at,
          user_id: codeRow.user_id,
        },
      };
      const ownerMember = {
        user_id: user.id,
        role: 'owner',
        joined_at: project.created_at,
        profile: useAuthStore.getState().profile || {
          id: user.id,
          display_name: authorLabel,
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      };

      get()._unsubscribeRealtime();
      set((state) => ({
        myProjects: [enriched, ...state.myProjects.filter((p) => p.id !== project.id)],
        activeProject: enriched,
        activeMembers: [ownerMember],
        activeCodeId: codeRow.id,
        lastRemoteUpdate: null,
        loadingProjects: false,
        githubSetupStatusById: setupGithub
          ? {
            ...state.githubSetupStatusById,
            [project.id]: {
              state: shouldStartGithubSetup ? 'pending' : 'error',
              message: shouldStartGithubSetup
                ? 'GitHub 저장소와 Pages 실행 페이지를 준비하는 중입니다.'
                : 'VPyLab 프로젝트는 만들었습니다. GitHub 연결은 재로그인 후 프로젝트 카드에서 다시 시도해주세요.',
              error: shouldStartGithubSetup ? null : githubTokenError?.message || 'GitHub 토큰을 확인할 수 없습니다.',
              authExpired: !shouldStartGithubSetup,
            },
          }
          : state.githubSetupStatusById,
      }));
      set({ projectCreationStatus: null });
      get()._subscribeRealtime(project.id);
      step(shouldStartGithubSetup
        ? 'UI 즉시 진입 가능 (이후 GitHub 셋업은 백그라운드)'
        : 'UI 즉시 진입 가능');

      if (shouldStartGithubSetup) {
        get()._startGithubSetup({
          projectId: project.id,
          codeId: codeRow.id,
          title,
          description,
          code: initialCode,
          repoName,
          githubToken,
          authorLabel,
          authorId: user.id,
          isTeam: false,
        });
      }

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
      return { error: { message: e.message } };
    }
  },

  _startGithubSetup: async ({
    projectId,
    codeId,
    title,
    description = '',
    code,
    repoName = '',
    githubToken,
    authorLabel,
    authorId = null,
    isTeam = false,
  }) => {
    set((state) => ({
      githubSetupStatusById: {
        ...state.githubSetupStatusById,
        [projectId]: {
          state: 'pending',
          message: 'GitHub 저장소와 Pages 실행 페이지를 준비하는 중입니다.',
        },
      },
    }));

    try {
      const htmlContent = await buildProjectPageHtml(code, title);
      const ghRes = await fetchWithTimeout(`${API_BASE}/api/projects/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          code,
          htmlContent,
          repoName,
          githubToken,
          authorLabel,
          isTeam,
        }),
      }, GITHUB_SETUP_TIMEOUT_MS);
      const gh = await parseApiJson(ghRes);
      if (!ghRes.ok) {
        const error = new Error(gh.error || `GitHub 셋업 실패 (${ghRes.status})`);
        error.status = ghRes.status;
        error.code = gh.code;
        throw error;
      }

      const nowIso = new Date().toISOString();
      const { error: projectUpdateErr } = await supabase
        .from('vpylab_projects')
        .update({
          github_repo: gh.repoFullName,
          github_last_pushed_at: nowIso,
        })
        .eq('id', projectId);
      if (projectUpdateErr) throw new Error(`Supabase project 갱신 실패: ${projectUpdateErr.message}`);

      const { error: codeUpdateErr } = await supabase
        .from('vpylab_saved_code')
        .update({
          github_repo: gh.repoFullName,
          github_last_pushed_at: nowIso,
        })
        .eq('id', codeId);
      if (codeUpdateErr) throw new Error(`Supabase code 갱신 실패: ${codeUpdateErr.message}`);

      set((state) => ({
        activeProject: state.activeProject?.id === projectId
          ? {
            ...state.activeProject,
            github_repo: gh.repoFullName,
            github_last_pushed_at: nowIso,
          }
          : state.activeProject,
        myProjects: state.myProjects.map((p) => (
          p.id === projectId
            ? {
              ...p,
              github_repo: gh.repoFullName,
              github_last_pushed_at: nowIso,
              repoUrl: gh.repoUrl,
              pagesUrl: gh.pagesUrl,
              pagesActivated: gh.pagesActivated,
              githubSetupPending: false,
            }
            : p
        )),
        githubSetupStatusById: {
          ...state.githubSetupStatusById,
          [projectId]: {
            state: 'success',
            message: 'GitHub 저장소와 Pages 실행 페이지가 준비되었습니다.',
            repoFullName: gh.repoFullName,
            pagesUrl: gh.pagesUrl,
          },
        },
      }));

      const { data: latestRevision } = await supabase
        .from('vpylab_code_revisions')
        .select('id, message, code_snapshot, created_at')
        .eq('code_id', codeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestRevision?.id && latestRevision.code_snapshot && latestRevision.code_snapshot !== code) {
        const syncJob = {
          id: `code:${latestRevision.id}`,
          kind: 'code',
          projectId,
          codeId,
          repoFullName: gh.repoFullName,
          title,
          message: latestRevision.message || '',
          authorId,
          revisionId: latestRevision.id,
          createdAt: new Date().toISOString(),
        };
        upsertPendingGithubJob(syncJob);
        enqueuePendingGithubJob(syncJob, () => (
          get()._runGithubSyncJob(syncJob, { codeOverride: latestRevision.code_snapshot })
        ))
          .then(() => removePendingGithubJob(syncJob.id))
          .catch((error) => {
            console.warn('[projectStore] GitHub 준비 직후 최신 코드 반영 실패:', error.message);
            markPendingGithubJobFailed(syncJob.id, error);
          });
      }

      get().fetchMyProjects();
    } catch (e) {
      console.warn('[projectStore] GitHub 프로젝트 준비 실패:', e.message);
      const setupFailure = classifyGithubSyncError(e);
      const authExpired = setupFailure.code === 'github_auth_required';
      if (authExpired) {
        useAuthStore.getState().markGitHubTokenExpired?.();
      }
      set((state) => ({
        activeProject: state.activeProject?.id === projectId
          ? { ...state.activeProject, githubSetupPending: false }
          : state.activeProject,
        myProjects: state.myProjects.map((p) => (
          p.id === projectId ? { ...p, githubSetupPending: false } : p
        )),
        githubSetupStatusById: {
          ...state.githubSetupStatusById,
          [projectId]: {
            state: 'error',
            message: authExpired
              ? 'GitHub 재로그인이 필요합니다. 재로그인 후 프로젝트 카드에서 다시 연결해주세요.'
              : setupFailure.blocked
                ? setupFailure.message
                : 'GitHub 저장소 준비에 실패했습니다.',
            error: e.message,
            code: e.code || setupFailure.code,
            authExpired,
          },
        },
      }));
    }
  },

  // -------------------------------------------------
  // 3) 기존 프로젝트를 GitHub에 연결하거나 실패한 연결을 다시 시도
  //    VPyLab 프로젝트/코드는 이미 있으므로 최신 코드를 가져와 setup 루틴만 다시 시작합니다.
  // -------------------------------------------------
  connectGithubProject: async (projectId, { repoName = '' } = {}) => {
    const user = await getCurrentUserForSave();
    if (!user) return { error: { message: '로그인이 필요합니다' } };
    if (!projectId) return { error: { message: '프로젝트 ID가 없습니다.' } };

    const { token: githubToken } = await getGithubTokenForSave('GitHub 로그인 확인이 지연되고 있습니다.');
    if (!githubToken) {
      return { error: { message: 'GitHub 로그인이 필요합니다. 우측 상단에서 GitHub로 로그인해주세요.' } };
    }

    const { data: project, error: projectError } = await supabase
      .from('vpylab_projects')
      .select('id, owner_id, title, description, github_repo')
      .eq('id', projectId)
      .single();
    if (projectError || !project) {
      return { error: { message: projectError?.message || '프로젝트를 찾을 수 없습니다.' } };
    }
    if (project.owner_id !== user.id) {
      return { error: { message: 'GitHub 저장소 연결은 프로젝트 소유자만 할 수 있습니다.' } };
    }
    if (project.github_repo) {
      return { error: { message: '이미 GitHub 저장소가 연결된 프로젝트입니다.' } };
    }

    const { data: codeRow, error: codeError } = await supabase
      .from('vpylab_saved_code')
      .select('id, code')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (codeError) {
      return { error: { message: codeError.message || '프로젝트 코드를 불러오지 못했습니다.' } };
    }
    if (!codeRow?.code) {
      return { error: { message: 'GitHub에 올릴 프로젝트 코드가 없습니다.' } };
    }

    const authorLabel = useAuthStore.getState().profile?.display_name
      || user.email?.split('@')[0]
      || user.id.slice(0, 8);

    set((state) => ({
      activeProject: state.activeProject?.id === projectId
        ? { ...state.activeProject, githubSetupPending: true }
        : state.activeProject,
      myProjects: state.myProjects.map((p) => (
        p.id === projectId ? { ...p, githubSetupPending: true } : p
      )),
      githubSetupStatusById: {
        ...state.githubSetupStatusById,
        [projectId]: {
          state: 'pending',
          message: 'GitHub 저장소와 Pages 실행 페이지를 연결하는 중입니다.',
        },
      },
    }));

    get()._startGithubSetup({
      projectId,
      codeId: codeRow.id,
      title: project.title,
      description: project.description || '',
      code: codeRow.code,
      repoName,
      githubToken,
      authorLabel,
      authorId: user.id,
      isTeam: false,
    });

    return { data: { projectId }, error: null };
  },

  // -------------------------------------------------
  // 4) 초대 코드로 합류 (RPC)
  // -------------------------------------------------
  joinByInviteCode: async (inviteCode) => {
    const trimmed = (inviteCode || '').trim().toLowerCase();
    if (!trimmed) return { error: { message: '초대 코드를 입력해주세요' } };

    let result;
    try {
      result = await withTimeout(
        supabase.rpc('vpylab_join_project_by_invite', {
          p_invite_code: trimmed,
        }),
        SUPABASE_TIMEOUT_MS,
        '초대 코드 합류가 15초 안에 끝나지 않았습니다. 네트워크를 확인한 뒤 다시 시도해주세요.',
      );
    } catch (e) {
      return { error: { message: e.message || '합류에 실패했습니다' } };
    }

    const { data, error } = result;

    if (error) {
      return { error: { message: error.message || '합류에 실패했습니다' } };
    }

    get().fetchMyProjects().catch((e) => {
      console.warn('[projectStore] 프로젝트 목록 갱신 실패:', e.message);
    });
    return { data: { projectId: data }, error: null };
  },

  // -------------------------------------------------
  // 4) 활성 프로젝트 열기 (멤버 목록 로드 + Realtime 구독)
  // -------------------------------------------------
  openProject: async (projectId) => {
    if (!projectId) return { error: { message: '프로젝트 ID가 없습니다.' } };
    set({ loadingActive: true });

    const { data: project, error: projectError } = await withTimeout(
      supabase
        .from('vpylab_projects')
        .select('id, owner_id, title, description, invite_code, github_repo, github_last_pushed_at, created_at, updated_at')
        .eq('id', projectId)
        .single(),
      SUPABASE_TIMEOUT_MS,
      '프로젝트 조회가 15초 안에 끝나지 않았습니다. 네트워크를 확인한 뒤 다시 시도해주세요.',
    ).catch((e) => ({ data: null, error: e }));
    if (projectError || !project) {
      set({ loadingActive: false });
      return { error: { message: projectError?.message || '프로젝트를 찾을 수 없습니다.' } };
    }

    const { data: members } = await withTimeout(
      supabase
        .from('vpylab_project_members')
        .select('user_id, role, joined_at')
        .eq('project_id', projectId)
        .order('joined_at', { ascending: true }),
      SUPABASE_TIMEOUT_MS,
      '프로젝트 멤버 조회가 15초 안에 끝나지 않았습니다.',
    ).catch((e) => {
      console.warn('[projectStore] 프로젝트 멤버 조회 실패:', e.message);
      return { data: [] };
    });

    // 멤버 표시명: vpylab_profiles에서 display_name 가져오기 (실패해도 무시)
    let memberWithProfile = members || [];
    if (members && members.length > 0) {
      const userIds = members.map(m => m.user_id);
      const profiles = await fetchProfilesForMembers(userIds);
      const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      memberWithProfile = members.map(m => ({ ...m, profile: byId[m.user_id] || null }));

      let currentUser = useAuthStore.getState().user;
      if (!currentUser) {
        currentUser = await getCurrentUserForSave().catch(() => null);
      }
      if (project.github_repo && project.owner_id === currentUser?.id) {
        const githubUsernames = await fetchMemberGithubUsernames(projectId);
        memberWithProfile = memberWithProfile.map((member) => {
          const githubUsername = githubUsernames[member.user_id];
          if (!githubUsername || member.profile?.github_username) return member;
          return {
            ...member,
            profile: {
              ...(member.profile || { id: member.user_id }),
              github_username: githubUsername,
            },
          };
        });
      }
    }

    // 이 프로젝트의 코드 1건 (가장 최근에 업데이트된 것)
    const { data: codeRow, error: codeError } = await withTimeout(
      supabase
        .from('vpylab_saved_code')
        .select('id, title, code, updated_at, user_id')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      SUPABASE_TIMEOUT_MS,
      '프로젝트 코드 조회가 15초 안에 끝나지 않았습니다. 네트워크를 확인한 뒤 다시 시도해주세요.',
    ).catch((e) => ({ data: null, error: e }));
    if (codeError) {
      set({ loadingActive: false });
      return { error: { message: codeError.message || '프로젝트 코드를 불러오지 못했습니다.' } };
    }
    if (!codeRow?.code) {
      set({ loadingActive: false });
      return { error: { message: '이 프로젝트에 연결된 코드가 없습니다. 저장소의 main.py 또는 프로젝트 생성을 확인해주세요.' } };
    }

    set({
      activeProject: project || null,
      activeMembers: memberWithProfile,
      activeCodeId: codeRow?.id || null,
      loadingActive: false,
      lastRemoteUpdate: null,
    });

    // Realtime 구독 (다른 멤버의 저장을 받기 위해)
    get()._subscribeRealtime(projectId);
    get().flushPendingGithubSync(projectId).catch((error) => {
      console.warn('[projectStore] GitHub 대기열 확인 실패:', error.message);
    });

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

  clearRemoteUpdate: () => set({ lastRemoteUpdate: null }),

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
    const user = await getCurrentUserForSave().catch(() => null);
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

  inviteGithubCollaborators: async ({ usernames }) => {
    const { activeProject } = get();
    if (!activeProject?.github_repo) {
      return { error: { message: 'GitHub 저장소 연결 정보가 없습니다.' } };
    }
    const safeUsernames = Array.from(new Set((usernames || [])
      .map((username) => String(username || '').trim().replace(/^@/, ''))
      .filter(Boolean)));
    if (safeUsernames.length === 0) {
      return { error: { message: 'GitHub 사용자명을 확인해주세요.' } };
    }
    const { token: githubToken } = await getGithubTokenForSave('GitHub 로그인 확인이 지연되고 있습니다.');
    if (!githubToken) {
      return { error: { message: 'GitHub 로그인이 만료되었습니다. 저장소 소유자 계정으로 다시 로그인해주세요.' } };
    }

    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/projects/collaborators/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: activeProject.github_repo,
          usernames: safeUsernames,
          githubToken,
        }),
      }, 20000);
      const result = await parseApiJson(response);
      if (!response.ok) {
        return {
          data: result,
          error: {
            message: result.error || `GitHub collaborator 초대 실패 (${response.status})`,
            code: result.code || null,
            status: response.status,
          },
        };
      }
      return { data: result, error: null };
    } catch (e) {
      return { error: { message: `GitHub collaborator 초대 실패: ${e.message}`, code: e.code || null, status: e.status || null } };
    }
  },

  inviteGithubCollaborator: async ({ username }) => {
    const { data, error } = await get().inviteGithubCollaborators({ usernames: [username] });
    if (error) return { error };

    const invited = data?.invited?.[0];
    const failed = data?.failed?.[0];
    if (!invited && failed) {
      return { error: { message: failed.error || 'GitHub collaborator 초대 실패' } };
    }

    return {
      data: {
        ...data,
        username: invited?.username || username,
        invitationUrl: invited?.invitationUrl || null,
        alreadyCollaborator: !!invited?.alreadyCollaborator,
      },
      error: null,
    };
  },

  // -------------------------------------------------
  // GitHub 보류 초대 목록 조회
  //   "초대했는데 저장이 안 됐나?" 착각을 막기 위해 owner가 패널을 열 때마다
  //   지금 보류 중인 초대를 보여줍니다. 또한 invitee가 수락하면 자동으로 목록에서 빠짐.
  // -------------------------------------------------
  fetchPendingCollaborators: async ({ repoFullName } = {}) => {
    const target = repoFullName || get().activeProject?.github_repo;
    if (!target) return { error: { message: 'GitHub 저장소 연결 정보가 없습니다.', code: 'missing_repo' } };

    const { token: githubToken } = await getGithubTokenForSave('GitHub 로그인 확인이 지연되고 있습니다.');
    if (!githubToken) {
      return { error: { message: 'GitHub 로그인이 만료되었습니다. 다시 로그인해주세요.', code: 'github_auth_required' } };
    }

    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/projects/collaborators/pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: target, githubToken }),
      }, 15000);
      const result = await parseApiJson(response);
      if (!response.ok) {
        return {
          error: {
            message: result.error || `보류 초대 조회 실패 (${response.status})`,
            code: result.code || null,
            status: response.status,
          },
        };
      }
      return { data: result, error: null };
    } catch (e) {
      return { error: { message: `보류 초대 조회 실패: ${e.message}`, code: e.code || null, status: e.status || null } };
    }
  },

  // -------------------------------------------------
  // GitHub 보류 초대 취소
  //   owner가 잘못 초대한 경우 "취소" 버튼으로 즉시 무효화.
  //   GitHub Settings → Access에 들어가지 않아도 앱 안에서 해결.
  // -------------------------------------------------
  cancelGithubInvitation: async ({ invitationId, repoFullName } = {}) => {
    const target = repoFullName || get().activeProject?.github_repo;
    if (!target) return { error: { message: 'GitHub 저장소 연결 정보가 없습니다.', code: 'missing_repo' } };

    const { token: githubToken } = await getGithubTokenForSave('GitHub 로그인 확인이 지연되고 있습니다.');
    if (!githubToken) {
      return { error: { message: 'GitHub 로그인이 만료되었습니다. 다시 로그인해주세요.', code: 'github_auth_required' } };
    }

    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/projects/collaborators/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: target, invitationId, githubToken }),
      }, 15000);
      const result = await parseApiJson(response);
      if (!response.ok) {
        return {
          error: {
            message: result.error || `초대 취소 실패 (${response.status})`,
            code: result.code || null,
            status: response.status,
          },
        };
      }
      return { data: result, error: null };
    } catch (e) {
      return { error: { message: `초대 취소 실패: ${e.message}`, code: e.code || null, status: e.status || null } };
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
          event: 'INSERT',
          schema: 'public',
          table: 'vpylab_code_revisions',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          const user = useAuthStore.getState().user;
          const authorId = payload.new?.author_id || null;
          if (authorId && user?.id === authorId) return;
          const message = payload.new?.message || '';
          const updateKind = message.startsWith('기록:') ? 'record' : 'code';

          set({
            lastRemoteUpdate: {
              byUserId: authorId,
              at: payload.new?.created_at || new Date().toISOString(),
              codeId: payload.new?.code_id || get().activeCodeId || null,
              revisionId: payload.new?.id || null,
              kind: updateKind,
              message,
            },
          });
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

  _runGithubSyncJob: async (job, { codeOverride } = {}) => {
    if (!job?.projectId || !job?.codeId || !job?.repoFullName) {
      const error = new Error('GitHub 반영 대기 정보가 올바르지 않습니다.');
      error.code = 'github_invalid_pending_job';
      throw error;
    }

    const githubToken = await withTimeout(
      useAuthStore.getState().getGitHubToken(),
      AUTH_TIMEOUT_MS,
      'GitHub 인증 확인이 지연되고 있습니다.',
    );
    if (!githubToken) {
      throw new Error('GitHub 저장 권한 연결 또는 GitHub 재로그인이 필요합니다.');
    }

    const user = await getCurrentUserForSave();
    if (!user) throw new Error('로그인이 필요합니다');
    if (job.authorId && job.authorId !== user.id) {
      const error = new Error('이 GitHub 대기 작업은 다른 로그인 계정의 저장입니다.');
      error.code = 'github_job_user_mismatch';
      throw error;
    }

    const authorLabel = useAuthStore.getState().profile?.display_name
      || user.email?.split('@')[0]
      || user.id.slice(0, 8);

    if (job.kind === 'record') {
      const r = await fetchWithTimeout(`${API_BASE}/api/projects/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: job.repoFullName,
          projectId: job.projectId,
          codeId: job.codeId,
          title: job.title,
          message: job.message || '기록',
          githubToken,
          authorLabel,
          source: 'manual',
          revisionId: job.revisionId || null,
          recordOnly: true,
          updateIndex: false,
          voyageEntry: job.voyageEntry,
        }),
      }, GITHUB_SYNC_TIMEOUT_MS);
      const commitResult = await parseApiJson(r);
      if (!r.ok) {
        const error = new Error(commitResult.error || `GitHub 기록 저장 실패 (${r.status})`);
        error.status = r.status;
        error.code = commitResult.code || null;
        throw error;
      }

      const nowIso = new Date().toISOString();
      const commitSha = commitResult.voyageEntry?.commitSha || commitResult.commitSha || null;
      if (job.revisionId && commitSha) {
        await withTimeout(
          supabase.from('vpylab_code_revisions')
            .update({ github_commit_sha: commitSha })
            .eq('id', job.revisionId),
          SUPABASE_TIMEOUT_MS,
          'GitHub 커밋 표시 갱신이 지연되고 있습니다.',
        );
      }
      await withTimeout(
        supabase.from('vpylab_projects')
          .update({ github_last_pushed_at: nowIso })
          .eq('id', job.projectId),
        SUPABASE_TIMEOUT_MS,
        '프로젝트 GitHub 반영 시각 갱신이 지연되고 있습니다.',
      );
      await withTimeout(
        supabase.from('vpylab_saved_code')
          .update({
            github_last_pushed_at: nowIso,
            github_last_pushed_revision_id: job.revisionId || null,
          })
          .eq('id', job.codeId),
        SUPABASE_TIMEOUT_MS,
        '코드 GitHub 반영 시각 갱신이 지연되고 있습니다.',
      );

      set((state) => (
        state.activeProject?.id === job.projectId
          ? { activeProject: { ...state.activeProject, github_last_pushed_at: nowIso } }
          : {}
      ));

      const { count: nthCommit } = await withTimeout(
        supabase
          .from('vpylab_code_revisions')
          .select('id', { count: 'exact', head: true })
          .eq('code_id', job.codeId),
        SUPABASE_TIMEOUT_MS,
        '기록 개수 조회가 지연되고 있습니다.',
      );

      const repoUrl = commitResult.repoUrl || `https://github.com/${job.repoFullName}`;
      const recordPath = commitResult.voyageEntry?.path || null;

      return {
        recordOnly: true,
        commitSha,
        commitUrl: commitResult.voyageEntry?.commitUrl || commitResult.commitUrl,
        repoUrl,
        recordUrl: recordPath ? `${repoUrl}/blob/main/${recordPath}` : null,
        nthCommit: nthCommit || 1,
        savedCodeId: job.codeId,
        pagesWarning: '코드는 바꾸지 않고 항해 일지만 남겼습니다.',
        voyageEntry: commitResult.voyageEntry,
      };
    }

    let code = codeOverride;
    if (!code && job.revisionId) {
      const { data, error } = await withTimeout(
        supabase
          .from('vpylab_code_revisions')
          .select('code_snapshot')
          .eq('id', job.revisionId)
          .maybeSingle(),
        SUPABASE_TIMEOUT_MS,
        'GitHub 반영용 코드 스냅샷 조회가 지연되고 있습니다.',
      );
      if (error) throw error;
      code = data?.code_snapshot || '';
    }
    if (!code) throw new Error('GitHub에 반영할 코드 스냅샷을 찾을 수 없습니다.');

    const htmlContent = await buildProjectPageHtml(code, job.title);
    const r = await fetchWithTimeout(`${API_BASE}/api/projects/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoFullName: job.repoFullName,
        projectId: job.projectId,
        codeId: job.codeId,
        code,
        htmlContent,
        title: job.title,
        message: job.message || `📝 ${new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })} 저장`,
        githubToken,
        authorLabel,
        source: 'manual',
        revisionId: job.revisionId || null,
        updateIndex: true,
      }),
    }, GITHUB_SYNC_TIMEOUT_MS);
    const commitResult = await parseApiJson(r);
    if (!r.ok) {
      const error = new Error(commitResult.error || `GitHub commit 실패 (${r.status})`);
      error.status = r.status;
      error.code = commitResult.code || null;
      throw error;
    }

    const nowIso = new Date().toISOString();
    if (!commitResult.staleRevision && job.revisionId && commitResult.commitSha) {
      await withTimeout(
        supabase.from('vpylab_code_revisions')
          .update({ github_commit_sha: commitResult.commitSha })
          .eq('id', job.revisionId),
        SUPABASE_TIMEOUT_MS,
        'GitHub 커밋 표시 갱신이 지연되고 있습니다.',
      );
      await withTimeout(
        supabase.from('vpylab_projects')
          .update({ github_last_pushed_at: nowIso })
          .eq('id', job.projectId),
        SUPABASE_TIMEOUT_MS,
        '프로젝트 GitHub 반영 시각 갱신이 지연되고 있습니다.',
      );
      await withTimeout(
        supabase.from('vpylab_saved_code')
          .update({
            github_last_pushed_at: nowIso,
            github_last_pushed_revision_id: job.revisionId || null,
          })
          .eq('id', job.codeId),
        SUPABASE_TIMEOUT_MS,
        '코드 GitHub 반영 시각 갱신이 지연되고 있습니다.',
      );

      set((state) => (
        state.activeProject?.id === job.projectId
          ? { activeProject: { ...state.activeProject, github_last_pushed_at: nowIso } }
          : {}
      ));
    }

    const { count: nthCommit } = await withTimeout(
      supabase
        .from('vpylab_code_revisions')
        .select('id', { count: 'exact', head: true })
        .eq('code_id', job.codeId)
        .not('github_commit_sha', 'is', null),
      SUPABASE_TIMEOUT_MS,
      'GitHub 반영 횟수 조회가 지연되고 있습니다.',
    );

    return {
      commitSha: commitResult.commitSha,
      pageCommitSha: commitResult.pageCommitSha,
      commitUrl: commitResult.commitUrl,
      pageCommitUrl: commitResult.pageCommitUrl,
      repoUrl: commitResult.repoUrl,
      pagesUrl: commitResult.pagesUrl,
      pagesStatus: commitResult.pagesStatus,
      pagesBuildRequested: commitResult.pagesBuildRequested,
      pagesWarning: commitResult.pagesWarning,
      staleRevision: commitResult.staleRevision,
      nthCommit: nthCommit || 1,
      savedCodeId: job.codeId,
    };
  },

  flushPendingGithubSync: async (projectId = null, { force = false } = {}) => {
    const now = Date.now();
    const jobs = getPendingGithubJobs()
      .filter((job) => !projectId || job.projectId === projectId)
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

    if (jobs.length === 0) return { started: 0, skipped: 0 };

    const { token: githubToken } = await getGithubTokenForSave();
    if (!githubToken) {
      return { started: 0, skipped: jobs.length, reason: 'github_auth_required' };
    }
    const currentUser = await getCurrentUserForSave().catch(() => null);
    if (!currentUser?.id) {
      return { started: 0, skipped: jobs.length, reason: 'login_required' };
    }

    const runnableJobs = jobs.filter((job) => {
      if (githubSyncInFlightJobs.has(job.id)) return false;
      if (job.authorId && job.authorId !== currentUser.id) return false;
      if (job.blocked && !force && job.lastErrorCode !== 'github_auth_required') return false;
      if (
        job.blocked
        && force
        && !GITHUB_SYNC_FORCE_RETRYABLE_BLOCKED_CODES.has(job.lastErrorCode)
      ) {
        return false;
      }
      if (!force && job.nextRetryAt && Date.parse(job.nextRetryAt) > now) return false;
      return true;
    });

    runnableJobs.forEach((job) => {
      const runnableJob = {
        ...job,
        blocked: false,
        lastErrorCode: null,
        nextRetryAt: null,
        updatedAt: new Date().toISOString(),
      };
      upsertPendingGithubJob(runnableJob);
      enqueuePendingGithubJob(runnableJob, () => get()._runGithubSyncJob(runnableJob))
        .then(() => removePendingGithubJob(job.id))
        .catch((error) => {
          console.warn('[projectStore] GitHub 대기 반영 실패:', error.message);
          markPendingGithubJobFailed(job.id, error);
        });
    });

    return { started: runnableJobs.length, skipped: jobs.length - runnableJobs.length };
  },

  /**
   * 프로젝트 컨텍스트에서 저장 + GitHub commit 한 묶음
   * - Supabase: vpylab_saved_code update + vpylab_code_revisions insert (codeStore 위임)
   * - GitHub:   POST /api/projects/commit 으로 main.py + history.md + index.html 갱신
   * - revision에 commit SHA 박아 "✓ GitHub" 배지 표시
   *
   * 반환: { ok, commitSha, commitUrl, repoUrl, pagesUrl, nthCommit, error }
   */
  saveAndPush: async ({ code, message, revisionMessage = '', voyageEntry = null }) => {
    const fail = (messageText) => {
      set({ projectSaveStatus: null });
      return { error: { message: messageText } };
    };
    const failWithError = (error) => {
      set({ projectSaveStatus: null });
      return { error };
    };
    set({ projectSaveStatus: '저장 준비 중입니다.' });

    const { activeProject, activeCodeId } = get();
    if (!activeProject || !activeCodeId) {
      return fail('활성 프로젝트가 없습니다.');
    }
    const user = await getCurrentUserForSave();
    if (!user) return fail('로그인이 필요합니다');

    const finishLocalCodeSave = async ({ saved, warning, pendingGitHub = false }) => {
      const { count: revisionCount } = await withTimeout(
        supabase
          .from('vpylab_code_revisions')
          .select('id', { count: 'exact', head: true })
          .eq('code_id', activeCodeId),
        SUPABASE_TIMEOUT_MS,
        '저장 횟수 조회가 지연되고 있습니다.',
      ).catch(() => ({ count: 1 }));

      set({ projectSaveStatus: null });
      return {
        data: {
          localOnly: !pendingGitHub,
          pendingGitHub,
          nthCommit: revisionCount || 1,
          savedCodeId: saved?.id,
          pagesWarning: warning,
          voyageEntry: voyageEntry ? { localOnly: true } : null,
        },
        error: null,
      };
    };

    if (!activeProject.github_repo) {
      const githubPending = Boolean(activeProject.githubSetupPending)
        || get().githubSetupStatusById[activeProject.id]?.state === 'pending';
      set({
        projectSaveStatus: githubPending
          ? 'GitHub 저장소 준비 전이라 VPyLab 이력에 먼저 저장하는 중입니다.'
          : 'VPyLab 코드와 revision을 저장하는 중입니다.',
      });
      const { data: saved, error: saveErr } = await withTimeout(
        useCodeStore.getState().saveCode({
          title: activeProject.title,
          code,
          id: activeCodeId,
          projectId: activeProject.id,
          commitMessage: revisionMessage || message || '',
          source: 'manual',
          skipParentLookup: true,
        }),
        SUPABASE_WRITE_TIMEOUT_MS,
        'VPyLab 코드 저장이 30초 안에 끝나지 않았습니다. 네트워크가 느린 상태입니다. 잠시 후 다시 저장해주세요.',
      );
      if (saveErr) return failWithError(saveErr);

      return finishLocalCodeSave({
        saved,
        pendingGitHub: githubPending,
        warning: githubPending
            ? 'GitHub 저장소가 준비 중이라 이번 저장은 VPyLab 이력에 먼저 남겼습니다.'
            : 'GitHub 미연결 프로젝트라 VPyLab 이력에 저장했습니다. 나중에 프로젝트 카드에서 GitHub 연결을 시작할 수 있습니다.',
      });
    }

    // 1) VPyLab 저장 + revision 생성.
    // GitHub 연결/권한 문제는 학생의 저장 자체를 막지 않고, GitHub 반영만 보류합니다.
    set({ projectSaveStatus: 'VPyLab 코드와 revision을 저장하는 중입니다.' });
    const { data: saved, error: saveErr } = await withTimeout(
      useCodeStore.getState().saveCode({
        title: activeProject.title,
        code,
        id: activeCodeId,
        projectId: activeProject.id,
        commitMessage: revisionMessage || message || '',
        source: 'manual',
        skipParentLookup: true,
      }),
      SUPABASE_WRITE_TIMEOUT_MS,
      'VPyLab 코드 저장이 30초 안에 끝나지 않았습니다. 네트워크가 느린 상태입니다. 잠시 후 다시 저장해주세요.',
    );
    if (saveErr) return failWithError(saveErr);

    // 방금 만든 revision을 우선 사용하고, 구버전 반환값이면 1건 조회로 보완
    let lastRev = saved?._revision || null;
    if (!lastRev) {
      const { data } = await withTimeout(
        supabase
          .from('vpylab_code_revisions')
          .select('id')
          .eq('code_id', activeCodeId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        SUPABASE_TIMEOUT_MS,
        '방금 저장한 이력 조회가 지연되고 있습니다.',
      );
      lastRev = data;
    }

    const syncJob = {
      id: `code:${lastRev?.id || `${activeProject.id}:${Date.now()}`}`,
      kind: 'code',
      projectId: activeProject.id,
      codeId: activeCodeId,
      repoFullName: activeProject.github_repo,
      title: activeProject.title,
      message: message || '',
      authorId: user.id,
      revisionId: lastRev?.id || null,
      createdAt: new Date().toISOString(),
    };

    const { token: githubToken, error: githubTokenError } = await getGithubTokenForSave();
    if (!githubToken) {
      blockPendingGithubJob(
        syncJob,
        githubTokenError || new Error('GitHub 저장 권한 연결 또는 GitHub 재로그인이 필요합니다.'),
      );
      return finishLocalCodeSave({
        saved,
        pendingGitHub: false,
        warning: 'VPyLab에는 저장했습니다. GitHub 반영은 재로그인 후 프로젝트를 다시 열거나 저장하면 재시도됩니다.',
      });
    }

    await get().flushPendingGithubSync(activeProject.id, { force: true }).catch((error) => {
      console.warn('[projectStore] 이전 GitHub 대기 작업 재시도 실패:', error.message);
    });

    upsertPendingGithubJob(syncJob);
    set({ projectSaveStatus: 'GitHub 반영을 백그라운드에서 시작하는 중입니다.' });
    const githubSyncTask = enqueuePendingGithubJob(syncJob, () => (
      get()._runGithubSyncJob(syncJob, { codeOverride: code })
    ))
      .then((data) => {
        removePendingGithubJob(syncJob.id);
        return { data };
      })
      .catch((error) => {
        console.warn('[projectStore] GitHub 코드 반영 실패:', error.message);
        markPendingGithubJobFailed(syncJob.id, error);
        return { error };
      });

    const syncResult = await Promise.race([
      githubSyncTask,
      waitForPending(GITHUB_SYNC_FAST_WAIT_MS),
    ]);

    if (syncResult?.data) {
      set({ projectSaveStatus: null });
      return { data: syncResult.data, error: null };
    }

    if (syncResult?.error) {
      const failure = classifyGithubSyncError(syncResult.error);
      return finishLocalCodeSave({
        saved,
        pendingGitHub: !failure.blocked,
        warning: failure.blocked
          ? failure.message
          : `VPyLab에는 저장했습니다. GitHub 반영만 보류했습니다: ${failure.message}`,
      });
    }

    return finishLocalCodeSave({
      saved,
      pendingGitHub: true,
      warning: 'VPyLab에는 저장했습니다. GitHub 반영은 백그라운드에서 계속 진행 중입니다.',
    });
  },

  /**
   * 기록만 남기기
   * - 최신 코드 행은 덮어쓰지 않습니다.
   * - Supabase에는 현재 코드 스냅샷을 revision으로 남겨 누가 기록했는지 보이게 합니다.
   * - GitHub 연결 프로젝트라면 docs/voyage/YYYY-MM-DD.md만 갱신합니다.
   */
  recordProjectNote: async ({ currentCode = '', message, revisionMessage = '', voyageEntry }) => {
    const fail = (messageText) => {
      set({ projectSaveStatus: null });
      return { error: { message: messageText } };
    };
    const failWithError = (error) => {
      set({ projectSaveStatus: null });
      return { error };
    };

    set({ projectSaveStatus: '기록 준비 중입니다.' });

    const { activeProject, activeCodeId } = get();
    if (!activeProject || !activeCodeId) {
      return fail('활성 프로젝트가 없습니다.');
    }
    if (!voyageEntry) {
      return fail('기록 내용이 없습니다.');
    }

    const user = await getCurrentUserForSave();
    if (!user) return fail('로그인이 필요합니다');

    set({ projectSaveStatus: 'VPyLab 이력에 기록을 남기는 중입니다.' });
    const { data: revision, error: revisionError } = await withTimeout(
      useCodeStore.getState()._createRevision({
        codeId: activeCodeId,
        code: currentCode,
        userId: user.id,
        message: revisionMessage || message || '',
        source: 'manual',
        projectId: activeProject.id,
        skipParentLookup: true,
      }),
      SUPABASE_WRITE_TIMEOUT_MS,
      'VPyLab 기록 저장이 30초 안에 끝나지 않았습니다. 네트워크가 느린 상태입니다. 잠시 후 다시 기록해주세요.',
    );
    if (revisionError) return failWithError(revisionError);

    const finishLocalRecord = async (warning, { pendingGitHub = false } = {}) => {
      const { count: revisionCount } = await withTimeout(
        supabase
          .from('vpylab_code_revisions')
          .select('id', { count: 'exact', head: true })
          .eq('code_id', activeCodeId),
        SUPABASE_TIMEOUT_MS,
        '기록 횟수 조회가 지연되고 있습니다.',
      ).catch(() => ({ count: 1 }));

      set({ projectSaveStatus: null });
      return {
        data: {
          recordOnly: true,
          localOnly: true,
          pendingGitHub,
          nthCommit: revisionCount || 1,
          savedCodeId: activeCodeId,
          pagesWarning: warning,
          voyageEntry: { localOnly: true },
        },
        error: null,
      };
    };

    if (!activeProject.github_repo) {
      return finishLocalRecord('코드는 바꾸지 않고 VPyLab 이력에 기록만 남겼습니다.');
    }

    const syncJob = {
      id: `record:${revision?.id || `${activeProject.id}:${Date.now()}`}`,
      kind: 'record',
      projectId: activeProject.id,
      codeId: activeCodeId,
      repoFullName: activeProject.github_repo,
      title: activeProject.title,
      message: message || '기록',
      authorId: user.id,
      revisionId: revision?.id || null,
      voyageEntry,
      createdAt: new Date().toISOString(),
    };

    const { token: githubToken, error: githubTokenError } = await getGithubTokenForSave();
    if (!githubToken) {
      blockPendingGithubJob(
        syncJob,
        githubTokenError || new Error('GitHub 저장 권한 연결 또는 GitHub 재로그인이 필요합니다.'),
      );
      return finishLocalRecord(
        'VPyLab에는 기록했습니다. GitHub 항해 일지는 재로그인 후 프로젝트를 다시 열거나 기록하면 재시도됩니다.',
        { pendingGitHub: false },
      );
    }

    await get().flushPendingGithubSync(activeProject.id, { force: true }).catch((error) => {
      console.warn('[projectStore] 이전 GitHub 대기 기록 재시도 실패:', error.message);
    });

    upsertPendingGithubJob(syncJob);
    set({ projectSaveStatus: 'GitHub 항해 일지 반영을 백그라운드에서 시작하는 중입니다.' });
    const githubSyncTask = enqueuePendingGithubJob(syncJob, () => (
      get()._runGithubSyncJob(syncJob)
    ))
      .then((data) => {
        removePendingGithubJob(syncJob.id);
        return { data };
      })
      .catch((error) => {
        console.warn('[projectStore] GitHub 항해 일지 반영 실패:', error.message);
        markPendingGithubJobFailed(syncJob.id, error);
        return { error };
      });

    const syncResult = await Promise.race([
      githubSyncTask,
      waitForPending(GITHUB_RECORD_FAST_WAIT_MS),
    ]);

    if (syncResult?.data) {
      set({ projectSaveStatus: null });
      return { data: syncResult.data, error: null };
    }

    if (syncResult?.error) {
      const failure = classifyGithubSyncError(syncResult.error);
      return finishLocalRecord(
        failure.blocked
          ? failure.message.replace('VPyLab 저장은 완료됐고', 'VPyLab 기록은 완료됐고')
          : `VPyLab에는 기록했습니다. GitHub 항해 일지 반영만 보류했습니다: ${failure.message}`,
        { pendingGitHub: !failure.blocked },
      );
    }

    return finishLocalRecord(
      'VPyLab에는 기록했습니다. GitHub 항해 일지는 백그라운드에서 계속 반영 중입니다.',
      { pendingGitHub: true },
    );
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
