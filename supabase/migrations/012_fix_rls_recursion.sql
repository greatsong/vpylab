-- VPyLab — RLS 자기참조 무한재귀 핫픽스 (010_team_projects 후속)
--
-- 증상: vpylab_saved_code INSERT/SELECT 시 500 Internal Server Error.
-- 원인: vpylab_project_members.select_co 정책이 EXISTS 서브쿼리로 자기 자신을 조회 →
--      Postgres가 서브쿼리에도 다시 RLS를 적용하면서 무한재귀.
--      vpylab_saved_code/vpylab_code_revisions의 팀 정책이 vpylab_project_members를
--      참조하는 순간 같은 재귀에 진입 → 500.
--
-- 수정: 멤버십 검사를 SECURITY DEFINER 헬퍼 함수로 분리 (RLS bypass) → 자기참조 끊김.

-- ========================================
-- 1. 헬퍼 함수 (SECURITY DEFINER로 RLS bypass)
-- ========================================

-- 현재 사용자가 해당 프로젝트의 멤버인지
CREATE OR REPLACE FUNCTION public.vpylab_is_project_member(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vpylab_project_members
    WHERE project_id = p_id AND user_id = auth.uid()
  );
$$;

-- 현재 사용자가 해당 프로젝트에서 편집 가능한지(owner/editor)
CREATE OR REPLACE FUNCTION public.vpylab_can_edit_project(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vpylab_project_members
    WHERE project_id = p_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  );
$$;

-- 프로젝트 owner_id 조회 (RLS 우회)
CREATE OR REPLACE FUNCTION public.vpylab_project_owner_id(p_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT owner_id FROM public.vpylab_projects WHERE id = p_id;
$$;

-- ========================================
-- 2. vpylab_project_members 정책 재작성 (자기참조 제거)
-- ========================================
DROP POLICY IF EXISTS "vpylab_project_members_select_co" ON public.vpylab_project_members;
DROP POLICY IF EXISTS "vpylab_project_members_insert" ON public.vpylab_project_members;
DROP POLICY IF EXISTS "vpylab_project_members_update_owner" ON public.vpylab_project_members;
DROP POLICY IF EXISTS "vpylab_project_members_delete" ON public.vpylab_project_members;

CREATE POLICY "vpylab_project_members_select_co" ON public.vpylab_project_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.vpylab_is_project_member(project_id)
  );

CREATE POLICY "vpylab_project_members_insert" ON public.vpylab_project_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.vpylab_project_owner_id(project_id) = auth.uid()
  );

CREATE POLICY "vpylab_project_members_update_owner" ON public.vpylab_project_members
  FOR UPDATE USING (
    public.vpylab_project_owner_id(project_id) = auth.uid()
  );

CREATE POLICY "vpylab_project_members_delete" ON public.vpylab_project_members
  FOR DELETE USING (
    (user_id = auth.uid() AND role <> 'owner')
    OR (
      public.vpylab_project_owner_id(project_id) = auth.uid()
      AND role <> 'owner'
    )
  );

-- ========================================
-- 3. vpylab_projects 정책 재작성
-- ========================================
DROP POLICY IF EXISTS "vpylab_projects_select_member" ON public.vpylab_projects;

CREATE POLICY "vpylab_projects_select_member" ON public.vpylab_projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR public.vpylab_is_project_member(id)
  );

-- ========================================
-- 4. vpylab_saved_code 팀 정책 재작성
-- ========================================
DROP POLICY IF EXISTS "vpylab_saved_code_team_select" ON public.vpylab_saved_code;
DROP POLICY IF EXISTS "vpylab_saved_code_team_update" ON public.vpylab_saved_code;
DROP POLICY IF EXISTS "vpylab_saved_code_team_insert" ON public.vpylab_saved_code;

CREATE POLICY "vpylab_saved_code_team_select" ON public.vpylab_saved_code
  FOR SELECT USING (
    project_id IS NOT NULL
    AND public.vpylab_is_project_member(project_id)
  );

CREATE POLICY "vpylab_saved_code_team_update" ON public.vpylab_saved_code
  FOR UPDATE USING (
    project_id IS NOT NULL
    AND public.vpylab_can_edit_project(project_id)
  );

CREATE POLICY "vpylab_saved_code_team_insert" ON public.vpylab_saved_code
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      project_id IS NULL
      OR public.vpylab_can_edit_project(project_id)
    )
  );

-- ========================================
-- 5. vpylab_code_revisions 팀 정책 재작성
-- ========================================
DROP POLICY IF EXISTS "vpylab_code_revisions_team_select" ON public.vpylab_code_revisions;
DROP POLICY IF EXISTS "vpylab_code_revisions_team_insert" ON public.vpylab_code_revisions;

CREATE POLICY "vpylab_code_revisions_team_select" ON public.vpylab_code_revisions
  FOR SELECT USING (
    project_id IS NOT NULL
    AND public.vpylab_is_project_member(project_id)
  );

CREATE POLICY "vpylab_code_revisions_team_insert" ON public.vpylab_code_revisions
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND (
      project_id IS NULL
      OR public.vpylab_can_edit_project(project_id)
    )
  );

COMMENT ON FUNCTION public.vpylab_is_project_member IS
  'RLS 자기참조 회피용 SECURITY DEFINER 헬퍼. 012_fix_rls_recursion에서 추가.';
