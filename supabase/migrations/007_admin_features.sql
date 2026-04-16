-- 007_admin_features.sql
-- 관리자 핵심 기능: (1) 갤러리 추천 RLS (2) 사용자 역할 변경 RPC

-- ============================================================
-- 1. 갤러리 is_featured — admin만 수정 가능
-- ============================================================
-- 기존 gallery_update_own 정책은 본인 작품만 수정 가능.
-- admin은 어떤 작품이든 수정(주로 is_featured 토글)할 수 있어야 함.
CREATE POLICY "gallery_update_admin" ON public.vpylab_gallery
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.vpylab_profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- 2. 사용자 역할 변경 RPC — admin 전용
-- ============================================================
-- admin이 다른 사용자를 teacher/student로 변경할 수 있는 함수.
-- admin→admin 부여는 불가 (최초 admin은 DB에서 직접 설정).
CREATE OR REPLACE FUNCTION public.vpylab_set_user_role(target_user_id uuid, new_role text)
RETURNS void AS $$
BEGIN
  -- 호출자가 admin인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.vpylab_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- student 또는 teacher만 허용
  IF new_role NOT IN ('student', 'teacher') THEN
    RAISE EXCEPTION 'Invalid role: only student or teacher allowed';
  END IF;

  -- 자기 자신의 역할은 변경 불가
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change own role';
  END IF;

  UPDATE public.vpylab_profiles
  SET role = new_role, updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
