-- VPyLab — GitHub 동기화(Phase 3, Plan C)
-- 목적: 학생/팀이 "이 버전을 GitHub로 보내기"를 누르면 학생(또는 팀)의 GitHub 레포에
--       Python 코드를 commit. 일상 저장은 Supabase에 누적되고, 명시적 push 시점만 GitHub에 반영.

-- ========================================
-- 1. vpylab_saved_code: GitHub 동기화 메타데이터
-- ========================================
ALTER TABLE public.vpylab_saved_code
  ADD COLUMN IF NOT EXISTS github_repo text,        -- 예: "alice/vpylab-game-abc123"
  ADD COLUMN IF NOT EXISTS github_branch text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS github_last_pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS github_last_pushed_revision_id uuid
    REFERENCES public.vpylab_code_revisions(id) ON DELETE SET NULL;

-- ========================================
-- 2. vpylab_projects: 팀 프로젝트도 동일하게
-- ========================================
ALTER TABLE public.vpylab_projects
  ADD COLUMN IF NOT EXISTS github_repo text,
  ADD COLUMN IF NOT EXISTS github_branch text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS github_last_pushed_at timestamptz;

-- ========================================
-- 3. vpylab_code_revisions: GitHub commit SHA 추적
--    push가 끝난 revision은 sha를 채워서 "이 시점까지 GitHub와 동기화됨"을 표시.
-- ========================================
ALTER TABLE public.vpylab_code_revisions
  ADD COLUMN IF NOT EXISTS github_commit_sha text;

-- ========================================
-- 4. 인덱스
-- ========================================
CREATE INDEX IF NOT EXISTS idx_vpylab_saved_code_github
  ON public.vpylab_saved_code(github_repo) WHERE github_repo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vpylab_projects_github
  ON public.vpylab_projects(github_repo) WHERE github_repo IS NOT NULL;

COMMENT ON COLUMN public.vpylab_saved_code.github_repo IS
  'VPyLab Phase 3: 학생 GitHub 레포(owner/repo). NULL이면 아직 GitHub로 보낸 적 없음.';
COMMENT ON COLUMN public.vpylab_code_revisions.github_commit_sha IS
  'VPyLab Phase 3: 이 revision이 GitHub로 push된 경우 commit SHA. NULL이면 아직 push되지 않음.';
