-- VPyLab — 팀 공동 프로젝트(Phase 2, Plan C)
-- 목적: 학생들이 같은 코드 베이스를 여러 명이 공유/편집하고, 모든 저장 시점이
--       Phase 1의 vpylab_code_revisions에 누구의 작업인지 함께 누적되도록 한다.

-- ========================================
-- 1. vpylab_projects — 팀 프로젝트
-- ========================================
CREATE TABLE IF NOT EXISTS public.vpylab_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '제목 없는 프로젝트',
  description text DEFAULT '',

  -- 짧은 초대 코드 (8자) — 팀원이 입력해서 합류
  invite_code text UNIQUE NOT NULL DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 8),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========================================
-- 2. vpylab_project_members — 팀원
-- ========================================
CREATE TABLE IF NOT EXISTS public.vpylab_project_members (
  project_id uuid NOT NULL REFERENCES public.vpylab_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor'
    CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- ========================================
-- 3. vpylab_saved_code: project_id 컬럼 추가
--    NULL이면 개인 코드(기존과 동일), 값이 있으면 팀 코드.
-- ========================================
ALTER TABLE public.vpylab_saved_code
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.vpylab_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vpylab_saved_code_project
  ON public.vpylab_saved_code(project_id) WHERE project_id IS NOT NULL;

-- ========================================
-- 4. vpylab_code_revisions: project_id 컬럼 추가 (RLS 단순화 + 조회 최적화)
-- ========================================
ALTER TABLE public.vpylab_code_revisions
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.vpylab_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vpylab_code_revisions_project
  ON public.vpylab_code_revisions(project_id) WHERE project_id IS NOT NULL;

-- ========================================
-- 5. 인덱스
-- ========================================
CREATE INDEX IF NOT EXISTS idx_vpylab_projects_owner ON public.vpylab_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_vpylab_project_members_user ON public.vpylab_project_members(user_id);

-- ========================================
-- 6. RLS 활성화
-- ========================================
ALTER TABLE public.vpylab_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpylab_project_members ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 7. RLS — vpylab_projects
-- ========================================

-- 본인이 owner이거나 멤버이면 조회 가능
CREATE POLICY "vpylab_projects_select_member" ON public.vpylab_projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.vpylab_project_members m
      WHERE m.project_id = vpylab_projects.id
        AND m.user_id = auth.uid()
    )
  );

-- 인증된 사용자라면 자기 자신이 owner인 프로젝트를 만들 수 있음
CREATE POLICY "vpylab_projects_insert_self" ON public.vpylab_projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- 메타데이터는 owner만 수정 (제목/설명/초대코드 재발급)
CREATE POLICY "vpylab_projects_update_owner" ON public.vpylab_projects
  FOR UPDATE USING (owner_id = auth.uid());

-- 삭제는 owner만
CREATE POLICY "vpylab_projects_delete_owner" ON public.vpylab_projects
  FOR DELETE USING (owner_id = auth.uid());

-- ========================================
-- 8. RLS — vpylab_project_members
-- ========================================

-- 같은 프로젝트의 멤버끼리는 서로 보임
CREATE POLICY "vpylab_project_members_select_co" ON public.vpylab_project_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.vpylab_project_members me
      WHERE me.project_id = vpylab_project_members.project_id
        AND me.user_id = auth.uid()
    )
  );

-- 본인 자신을 멤버로 추가하는 것을 허용 (초대 코드 검증은 클라이언트/서버 로직에서)
-- + owner는 누구든 추가 가능
CREATE POLICY "vpylab_project_members_insert" ON public.vpylab_project_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.vpylab_projects p
      WHERE p.id = vpylab_project_members.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- 역할 변경은 owner만
CREATE POLICY "vpylab_project_members_update_owner" ON public.vpylab_project_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.vpylab_projects p
      WHERE p.id = vpylab_project_members.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- 본인은 스스로 나갈 수 있음. owner는 누구든 내보낼 수 있음. owner 자신은 나갈 수 없음(역할 양도 후 가능).
CREATE POLICY "vpylab_project_members_delete" ON public.vpylab_project_members
  FOR DELETE USING (
    (
      user_id = auth.uid()
      AND role <> 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.vpylab_projects p
      WHERE p.id = vpylab_project_members.project_id
        AND p.owner_id = auth.uid()
        AND vpylab_project_members.role <> 'owner'
    )
  );

-- ========================================
-- 9. RLS 확장 — vpylab_saved_code (팀원 접근 허용)
--    개인 코드 정책(기존)과 OR 조합되어, project_id가 있으면 팀원도 접근 가능.
-- ========================================

-- 팀원: 코드 조회
CREATE POLICY "vpylab_saved_code_team_select" ON public.vpylab_saved_code
  FOR SELECT USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vpylab_project_members m
      WHERE m.project_id = vpylab_saved_code.project_id
        AND m.user_id = auth.uid()
    )
  );

-- 팀원(editor/owner): 코드 수정
CREATE POLICY "vpylab_saved_code_team_update" ON public.vpylab_saved_code
  FOR UPDATE USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vpylab_project_members m
      WHERE m.project_id = vpylab_saved_code.project_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'editor')
    )
  );

-- 팀원: 새 코드 추가 (insert) — 이 경우 user_id는 본인이어야 함
CREATE POLICY "vpylab_saved_code_team_insert" ON public.vpylab_saved_code
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.vpylab_project_members m
        WHERE m.project_id = vpylab_saved_code.project_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'editor')
      )
    )
  );

-- 삭제는 기존 정책(본인만) 유지 — 팀 코드 삭제는 owner가 프로젝트 자체를 정리하는 흐름.

-- ========================================
-- 10. RLS 확장 — vpylab_code_revisions (팀원 이력 조회/생성)
-- ========================================

-- 팀원: 팀 프로젝트의 revision 조회
CREATE POLICY "vpylab_code_revisions_team_select" ON public.vpylab_code_revisions
  FOR SELECT USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vpylab_project_members m
      WHERE m.project_id = vpylab_code_revisions.project_id
        AND m.user_id = auth.uid()
    )
  );

-- 팀원(editor/owner): 본인 명의로 revision 추가
CREATE POLICY "vpylab_code_revisions_team_insert" ON public.vpylab_code_revisions
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.vpylab_project_members m
        WHERE m.project_id = vpylab_code_revisions.project_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'editor')
      )
    )
  );

-- ========================================
-- 11. updated_at 트리거
-- ========================================
CREATE TRIGGER vpylab_projects_updated_at
  BEFORE UPDATE ON public.vpylab_projects
  FOR EACH ROW EXECUTE FUNCTION public.vpylab_update_updated_at();

-- ========================================
-- 12. owner는 자동으로 멤버로 등록되도록 트리거
-- ========================================
CREATE OR REPLACE FUNCTION public.vpylab_projects_add_owner_as_member()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.vpylab_project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER vpylab_projects_add_owner_member
  AFTER INSERT ON public.vpylab_projects
  FOR EACH ROW EXECUTE FUNCTION public.vpylab_projects_add_owner_as_member();

-- ========================================
-- 13. 초대 코드로 합류 — RPC 함수
--    클라이언트가 직접 join 시도하는 것보다 안전하게,
--    invite_code → project_id 조회 후 본인을 editor로 추가.
-- ========================================
CREATE OR REPLACE FUNCTION public.vpylab_join_project_by_invite(p_invite_code text)
RETURNS uuid AS $$
DECLARE
  v_project_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  SELECT id INTO v_project_id
  FROM public.vpylab_projects
  WHERE invite_code = p_invite_code;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION '초대 코드를 찾을 수 없습니다';
  END IF;

  INSERT INTO public.vpylab_project_members (project_id, user_id, role)
  VALUES (v_project_id, v_user_id, 'editor')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN v_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.vpylab_projects IS
  'VPyLab Phase 2: 팀 공동 프로젝트. 초대 코드로 멤버 합류.';
COMMENT ON TABLE public.vpylab_project_members IS
  'VPyLab Phase 2: 프로젝트 멤버십(owner/editor/viewer 역할).';
