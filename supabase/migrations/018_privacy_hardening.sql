-- VPyLab: 학생 개인정보 노출 차단과 권한 상승 차단 (2026-11-05 점검)
--
-- 이 파일은 아직 운영 DB에 적용하지 않았습니다. 적용 전에 아래를 확인합니다.
--   1. 운영에서는 비로그인 anon 키로 vpylab_profiles 115행이 모두 읽힙니다.
--      001~017을 그대로 적용한 DB에서는 같은 요청이 재귀 오류로 실패하므로 운영 정책은 저장소와 다릅니다.
--      그래서 이름을 추측하지 않고 vpylab_profiles의 정책을 모두 지운 뒤 다시 만듭니다.
--   2. 적용 뒤 anon이 읽을 수 있는 프로필은 공개 작품을 낸 학생의 id, display_name, avatar_url뿐입니다.
--
-- 되돌리기가 필요하면 적용 전에 아래 조회 결과를 저장해 둡니다.
--   select * from pg_policies where tablename = 'vpylab_profiles';

BEGIN;

-- ========================================
-- 1. RLS 재귀를 피하는 헬퍼
--    프로필 정책이 다른 표를 직접 읽으면 001의 교사 정책처럼 재귀 오류가 납니다.
-- ========================================
CREATE OR REPLACE FUNCTION public.vpylab_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vpylab_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.vpylab_is_class_teacher(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vpylab_classes c
    WHERE c.id = p_class_id AND c.teacher_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.vpylab_profiles tp
    WHERE tp.id = auth.uid()
      AND tp.role IN ('teacher', 'admin')
      AND tp.class_id = p_class_id
  );
$$;

CREATE OR REPLACE FUNCTION public.vpylab_has_public_work(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vpylab_gallery g
    WHERE g.user_id = p_user_id AND g.is_public = true
  );
$$;

-- ========================================
-- 2. vpylab_profiles 정책 재작성
-- ========================================
ALTER TABLE public.vpylab_profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vpylab_profiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.vpylab_profiles', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "vpylab_profiles_select_own" ON public.vpylab_profiles
  FOR SELECT USING (auth.uid() = id);

-- 갤러리 작성자 표시(galleryStore.attachProfiles)에 필요합니다.
CREATE POLICY "vpylab_profiles_select_public_author" ON public.vpylab_profiles
  FOR SELECT USING (public.vpylab_has_public_work(id));

-- 팀 목록(projectStore.fetchProfilesForMembers)에 필요합니다.
CREATE POLICY "vpylab_profiles_select_project_member" ON public.vpylab_profiles
  FOR SELECT USING (public.vpylab_shares_project_with_user(id));

-- 학급 관리(ClassManager, StudentProgress)에 필요합니다.
CREATE POLICY "vpylab_profiles_select_class_teacher" ON public.vpylab_profiles
  FOR SELECT USING (class_id IS NOT NULL AND public.vpylab_is_class_teacher(class_id));

-- 관리자 사용자 목록(UserManagement)에 필요합니다.
CREATE POLICY "vpylab_profiles_select_admin" ON public.vpylab_profiles
  FOR SELECT USING (public.vpylab_is_admin());

CREATE POLICY "vpylab_profiles_insert" ON public.vpylab_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "vpylab_profiles_update" ON public.vpylab_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 비로그인 화면이 읽는 열은 attachProfiles의 세 열뿐입니다.
REVOKE SELECT ON public.vpylab_profiles FROM anon;
GRANT SELECT (id, display_name, avatar_url) ON public.vpylab_profiles TO anon;

-- ========================================
-- 3. 역할 자가 변경 차단
--    기존 UPDATE 정책은 행만 확인해서 본인이 role을 admin으로 바꿀 수 있었습니다.
--    vpylab_set_user_role은 SECURITY DEFINER라 current_user가 API 역할이 아니므로 통과합니다.
-- ========================================
CREATE OR REPLACE FUNCTION public.vpylab_profiles_guard_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := 'student';
    ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'role은 직접 변경할 수 없습니다' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vpylab_profiles_guard_role ON public.vpylab_profiles;
CREATE TRIGGER vpylab_profiles_guard_role
  BEFORE INSERT OR UPDATE ON public.vpylab_profiles
  FOR EACH ROW EXECUTE FUNCTION public.vpylab_profiles_guard_role();

-- 갤러리 관리자 수정 정책도 헬퍼로 바꿉니다(프로필과 갤러리 사이의 재귀 제거).
DROP POLICY IF EXISTS "gallery_update_admin" ON public.vpylab_gallery;
CREATE POLICY "gallery_update_admin" ON public.vpylab_gallery
  FOR UPDATE USING (public.vpylab_is_admin());

-- ========================================
-- 4. 초대 코드 없이 프로젝트에 들어가는 경로 차단
--    기존 정책은 user_id = auth.uid()이면 어느 프로젝트에도 자신을 넣을 수 있었습니다.
--    앱은 초대 RPC(vpylab_join_project_by_invite)와 소유자 트리거로만 멤버를 추가합니다.
-- ========================================
DROP POLICY IF EXISTS "vpylab_project_members_insert" ON public.vpylab_project_members;
CREATE POLICY "vpylab_project_members_insert" ON public.vpylab_project_members
  FOR INSERT WITH CHECK (
    public.vpylab_project_owner_id(project_id) = auth.uid()
  );

-- ========================================
-- 5. 좋아요를 누른 사용자 목록 비공개
--    앱은 본인의 좋아요 여부만 조회합니다(galleryStore.checkIfLiked). 개수는 like_count를 사용합니다.
-- ========================================
DROP POLICY IF EXISTS "likes_select" ON public.vpylab_gallery_likes;
CREATE POLICY "likes_select" ON public.vpylab_gallery_likes
  FOR SELECT USING (auth.uid() = user_id);

-- ========================================
-- 6. 뷰가 RLS를 우회하지 않게 변경
--    앱은 이 뷰를 사용하지 않습니다. 소유자 권한으로 실행되어 anon에게 전체 코드 id가 보였습니다.
-- ========================================
ALTER VIEW public.vpylab_code_revision_summary SET (security_invoker = true);
REVOKE ALL ON public.vpylab_code_revision_summary FROM anon;

-- ========================================
-- 7. SECURITY DEFINER 함수 정리
-- ========================================
ALTER FUNCTION public.vpylab_increment_view(uuid) SET search_path = public;
ALTER FUNCTION public.vpylab_toggle_like(uuid) SET search_path = public;
ALTER FUNCTION public.vpylab_increment_remix(uuid) SET search_path = public;
ALTER FUNCTION public.vpylab_set_user_role(uuid, text) SET search_path = public;
ALTER FUNCTION public.vpylab_projects_add_owner_as_member() SET search_path = public;
ALTER FUNCTION public.vpylab_join_project_by_invite(text) SET search_path = public;

-- 로그인이 필요한 RPC는 anon이 호출하지 못하게 합니다. 조회수(vpylab_increment_view)는 비로그인도 사용합니다.
REVOKE EXECUTE ON FUNCTION public.vpylab_toggle_like(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.vpylab_increment_remix(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.vpylab_set_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.vpylab_join_project_by_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vpylab_toggle_like(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vpylab_increment_remix(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vpylab_set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vpylab_join_project_by_invite(text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
