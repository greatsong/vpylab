-- VPyLab: 비로그인 프로필 전체 노출과 role 자가 변경 차단 (2026-11-05 점검)
--
-- 운영에는 저장소에 없는 정책 vpylab_profiles_select_public(USING true)이 있어서 anon이 전체 행을 읽었습니다.
-- 이 파일은 프로필 표의 정책을 모두 지운 뒤 앱이 필요로 하는 정책만 다시 만듭니다.
-- 적용 뒤 anon이 읽을 수 있는 프로필은 공개 작품을 낸 학생의 id, display_name, avatar_url뿐입니다.

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
-- 3. role과 class_id 자가 변경 차단
--    기존 UPDATE 정책은 행만 확인해서 본인이 role을 admin으로, class_id를 다른 학급으로 바꿀 수 있었습니다.
--    vpylab_set_user_role은 SECURITY DEFINER라 current_user가 API 역할이 아니므로 통과합니다.
--    운영에서 class_id가 있는 프로필은 0건입니다. 초대 코드 조회는 RLS로 이미 동작하지 않습니다.
--    학급 가입을 다시 열 때는 초대 코드를 확인하는 SECURITY DEFINER RPC를 추가합니다.
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
      NEW.class_id := NULL;
    ELSIF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.class_id IS DISTINCT FROM OLD.class_id THEN
      RAISE EXCEPTION 'role과 class_id는 직접 변경할 수 없습니다' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vpylab_profiles_guard_role ON public.vpylab_profiles;
CREATE TRIGGER vpylab_profiles_guard_role
  BEFORE INSERT OR UPDATE ON public.vpylab_profiles
  FOR EACH ROW EXECUTE FUNCTION public.vpylab_profiles_guard_role();

-- ========================================
-- 4. 프로젝트 멤버 직접 INSERT 금지
--    기존 정책은 자신이나 임의의 사용자를 프로젝트에 넣을 수 있어서 위의 프로필 제한을 우회합니다.
--    앱은 소유자 트리거와 초대 RPC(모두 SECURITY DEFINER)로만 멤버를 추가합니다.
-- ========================================
DROP POLICY IF EXISTS "vpylab_project_members_insert" ON public.vpylab_project_members;

COMMIT;

NOTIFY pgrst, 'reload schema';
