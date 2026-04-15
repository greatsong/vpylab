-- 006: 갤러리 협업 기능 확장
-- author_alias 컬럼 추가 + 갤러리용 프로필 공개 SELECT 정책

-- 1. vpylab_gallery에 author_alias 컬럼 추가
ALTER TABLE public.vpylab_gallery ADD COLUMN IF NOT EXISTS author_alias text DEFAULT '익명';

-- 2. vpylab_profiles에 갤러리용 공개 SELECT 정책 추가
-- 공개 작품을 발행한 사용자의 프로필은 누구나 조회 가능
CREATE POLICY "vpylab_profiles_select_gallery" ON public.vpylab_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vpylab_gallery g
      WHERE g.user_id = vpylab_profiles.id AND g.is_public = true
    )
  );

-- 3. 기존 갤러리 데이터에 author_alias 백필
UPDATE public.vpylab_gallery g
SET author_alias = COALESCE(
  (SELECT p.display_name FROM public.vpylab_profiles p WHERE p.id = g.user_id),
  '익명'
)
WHERE g.author_alias IS NULL OR g.author_alias = '익명';
