-- VPyLab: 후속 보강 (2026-11-05 점검). 좋아요 사용자 비공개, 요약 뷰, 함수 권한.

BEGIN;

-- 갤러리 관리자 수정 정책도 헬퍼로 바꿉니다(프로필과 갤러리 사이의 재귀 제거).
DROP POLICY IF EXISTS "gallery_update_admin" ON public.vpylab_gallery;
CREATE POLICY "gallery_update_admin" ON public.vpylab_gallery
  FOR UPDATE USING (public.vpylab_is_admin());

-- ========================================
-- 5. 좋아요를 누른 사용자 목록 비공개
--    앱은 본인의 좋아요 여부만 조회합니다(galleryStore.checkIfLiked). 개수는 like_count를 사용합니다.
-- ========================================
DROP POLICY IF EXISTS "likes_select" ON public.vpylab_gallery_likes;
CREATE POLICY "likes_select" ON public.vpylab_gallery_likes
  FOR SELECT USING (auth.uid() = user_id);

-- 앱은 좋아요를 vpylab_toggle_like로만 바꿉니다. 직접 쓰면 like_count와 어긋나므로 정책을 없앱니다.
DROP POLICY IF EXISTS "likes_insert" ON public.vpylab_gallery_likes;
DROP POLICY IF EXISTS "likes_delete_own" ON public.vpylab_gallery_likes;

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
