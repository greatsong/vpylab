/**
 * VPyLab — Supabase 인증 검증 미들웨어
 *
 * GitHub 프록시 엔드포인트(레포 생성/커밋/발행 등)에 VPyLab 로그인(Supabase)을
 * 요구하기 위한 공통 미들웨어. GitHub 토큰과 별개로, 요청자가 VPyLab에
 * 로그인한 사용자임을 서버에서 검증한다.
 *
 * 계약(클라이언트와 합의):
 *   - 요청 헤더: `Authorization: Bearer <supabase access_token>`
 *   - 토큰 없음/무효 → 401 { error: '로그인이 필요합니다.', code: 'auth_required' }
 *   - projectId가 body에 있는 요청은 vpylab_project_members 멤버십 확인,
 *     멤버가 아니면 → 403 { error: '프로젝트 멤버가 아닙니다.', code: 'not_project_member' }
 *   - 검증된 user 객체는 req.supabaseUser 로 후속 핸들러에 전달
 */
import { createClient } from '@supabase/supabase-js';

let _serviceClient = null;

/** Supabase service role 클라이언트 (lazy 초기화 — 서버 기동 시 env 미설정이어도 크래시 방지) */
function getServiceClient() {
  if (_serviceClient) return _serviceClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정');
  }
  _serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serviceClient;
}

/** Authorization 헤더에서 Bearer 토큰 추출 */
function extractBearerToken(req) {
  const header = req.headers?.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Supabase access token 검증 미들웨어.
 * 성공 시 req.supabaseUser 에 검증된 user 객체를 담는다.
 */
export async function requireSupabaseUser(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: '로그인이 필요합니다.', code: 'auth_required' });
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (e) {
    console.error('[auth] Supabase 설정 오류:', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    const user = data?.user;
    if (error || !user) {
      return res.status(401).json({ error: '로그인이 필요합니다.', code: 'auth_required' });
    }
    req.supabaseUser = user;
    return next();
  } catch (e) {
    console.error('[auth] 토큰 검증 실패:', e.message);
    return res.status(401).json({ error: '로그인이 필요합니다.', code: 'auth_required' });
  }
}

/**
 * 팀 프로젝트 접근 권한 검증 미들웨어 (requireSupabaseUser 이후에 사용).
 *
 * body의 projectId 또는 repoFullName으로 대상 팀 프로젝트를 판별한 뒤,
 * 팀 프로젝트라면 요청자가 그 멤버인지 확인한다.
 *
 * 중요: projectId만 신뢰하면, 클라이언트가 projectId를 생략하고 repoFullName만
 * 보내 멤버십 검사를 우회할 수 있다(추방된 사용자가 팀 repo에 계속 커밋 등).
 * 따라서 projectId가 없어도 repoFullName이 팀 프로젝트(vpylab_projects.github_repo)에
 * 연결돼 있으면 그 프로젝트의 멤버십을 강제한다.
 * 어느 프로젝트에도 연결되지 않은 개인 repo(하위 호환)만 통과시킨다.
 */
export async function requireTeamProjectAccess(req, res, next) {
  if (!req.supabaseUser) {
    return res.status(401).json({ error: '로그인이 필요합니다.', code: 'auth_required' });
  }

  const projectId = req.body?.projectId || null;
  const repoFullName = req.body?.repoFullName || null;

  try {
    const supabase = getServiceClient();

    // 대상 팀 프로젝트 판별: projectId 우선, 없으면 repoFullName으로 역조회
    let targetProjectId = projectId;
    if (!targetProjectId && repoFullName) {
      const { data: projRows, error: projErr } = await supabase
        .from('vpylab_projects')
        .select('id')
        .eq('github_repo', repoFullName)
        .limit(1);
      if (projErr) {
        console.error('[auth] repo→프로젝트 역조회 실패:', projErr.message);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
      if (projRows && projRows.length > 0) targetProjectId = projRows[0].id;
    }

    // 팀 프로젝트가 아니면(개인 repo/저장) 통과
    if (!targetProjectId) return next();

    // 멤버십 확인
    const { data: membership, error } = await supabase
      .from('vpylab_project_members')
      .select('project_id')
      .eq('project_id', targetProjectId)
      .eq('user_id', req.supabaseUser.id)
      .maybeSingle();

    if (error) {
      console.error('[auth] 프로젝트 멤버십 조회 실패:', error.message);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
    if (!membership) {
      return res.status(403).json({ error: '프로젝트 멤버가 아닙니다.', code: 'not_project_member' });
    }
    return next();
  } catch (e) {
    console.error('[auth] 팀 프로젝트 접근 검증 오류:', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
