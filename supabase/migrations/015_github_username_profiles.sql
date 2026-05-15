-- VPyLab — GitHub collaborator 초대를 위한 프로필 확장
-- 목적: 팀원이 GitHub로 로그인했을 때 username을 저장해 owner가 저장소 권한 초대를
--       한 번에 보낼 수 있도록 합니다. GitHub 초대 수락은 GitHub 쪽에서 별도로 필요합니다.

ALTER TABLE public.vpylab_profiles
  ADD COLUMN IF NOT EXISTS github_username text;

CREATE INDEX IF NOT EXISTS idx_vpylab_profiles_github_username
  ON public.vpylab_profiles(github_username)
  WHERE github_username IS NOT NULL;

COMMENT ON COLUMN public.vpylab_profiles.github_username IS
  'GitHub OAuth에서 확인한 username. 팀 프로젝트 collaborator 초대 안내에 사용합니다.';

-- 같은 프로젝트 멤버끼리는 프로필(표시명, avatar, GitHub username)을 볼 수 있어야
-- 팀 목록과 GitHub 권한 안내가 동작합니다. RLS 자기참조를 피하려고 SECURITY DEFINER로 분리합니다.
CREATE OR REPLACE FUNCTION public.vpylab_shares_project_with_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vpylab_project_members target_member
    JOIN public.vpylab_project_members my_member
      ON my_member.project_id = target_member.project_id
    WHERE target_member.user_id = p_user_id
      AND my_member.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "vpylab_profiles_select_project_member" ON public.vpylab_profiles;

CREATE POLICY "vpylab_profiles_select_project_member" ON public.vpylab_profiles
  FOR SELECT USING (
    public.vpylab_shares_project_with_user(id)
  );

COMMENT ON FUNCTION public.vpylab_shares_project_with_user IS
  '프로젝트 공동 멤버의 프로필 조회를 허용하기 위한 RLS 헬퍼. GitHub username 표시와 팀 목록에 사용합니다.';
