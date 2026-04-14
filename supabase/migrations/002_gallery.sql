-- VPy Lab 갤러리 스키마 마이그레이션
-- 날짜: 2026-04-14
-- 목적: 학생 작품 갤러리 + 좋아요 + Remix(영감) 관계

-- ========================================
-- 1. 갤러리 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS public.vpylab_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  code text NOT NULL,
  thumbnail text,                    -- base64 JPEG (3D 뷰포트 캡처)
  category text DEFAULT 'free'
    CHECK (category IN ('CT','CR','MA','SC','AR','SN','free')),
  is_public boolean DEFAULT true,
  is_featured boolean DEFAULT false,  -- 관리자 추천
  view_count integer DEFAULT 0,
  like_count integer DEFAULT 0,
  remix_count integer DEFAULT 0,
  remix_from uuid REFERENCES public.vpylab_gallery(id) ON DELETE SET NULL,
  github_url text,                   -- https://user.github.io/repo/
  github_repo text,                  -- user/repo-name
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========================================
-- 2. 좋아요 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS public.vpylab_gallery_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gallery_id uuid NOT NULL REFERENCES public.vpylab_gallery(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, gallery_id)  -- 사용자당 작품 1개 좋아요만
);

-- ========================================
-- 3. 인덱스
-- ========================================
CREATE INDEX IF NOT EXISTS idx_gallery_public_created
  ON public.vpylab_gallery(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_user
  ON public.vpylab_gallery(user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_category
  ON public.vpylab_gallery(category);
CREATE INDEX IF NOT EXISTS idx_gallery_featured
  ON public.vpylab_gallery(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_gallery_remix_from
  ON public.vpylab_gallery(remix_from) WHERE remix_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gallery_likes_user
  ON public.vpylab_gallery_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_likes_gallery
  ON public.vpylab_gallery_likes(gallery_id);

-- ========================================
-- 4. RLS 활성화
-- ========================================
ALTER TABLE public.vpylab_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpylab_gallery_likes ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 5. RLS 정책 — 갤러리
-- ========================================

-- 공개 작품은 누구나 읽기 (비로그인 포함)
CREATE POLICY "gallery_select_public" ON public.vpylab_gallery
  FOR SELECT USING (is_public = true);

-- 본인 비공개 작품도 읽기
CREATE POLICY "gallery_select_own" ON public.vpylab_gallery
  FOR SELECT USING (auth.uid() = user_id);

-- 로그인 사용자만 발행
CREATE POLICY "gallery_insert" ON public.vpylab_gallery
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인 작품만 수정
CREATE POLICY "gallery_update_own" ON public.vpylab_gallery
  FOR UPDATE USING (auth.uid() = user_id);

-- 본인 작품만 삭제
CREATE POLICY "gallery_delete_own" ON public.vpylab_gallery
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- 6. RLS 정책 — 좋아요
-- ========================================

-- 누구나 좋아요 수 읽기 (공개 작품)
CREATE POLICY "likes_select" ON public.vpylab_gallery_likes
  FOR SELECT USING (true);

-- 로그인 사용자만 좋아요 추가
CREATE POLICY "likes_insert" ON public.vpylab_gallery_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인 좋아요만 삭제
CREATE POLICY "likes_delete_own" ON public.vpylab_gallery_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- 7. updated_at 자동 갱신 (기존 함수 재사용)
-- ========================================
CREATE TRIGGER vpylab_gallery_updated_at
  BEFORE UPDATE ON public.vpylab_gallery
  FOR EACH ROW EXECUTE FUNCTION public.vpylab_update_updated_at();

-- ========================================
-- 8. 조회수 증가 RPC (보안: 본인 작품은 카운트 안 함)
-- ========================================
CREATE OR REPLACE FUNCTION public.vpylab_increment_view(work_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.vpylab_gallery
  SET view_count = view_count + 1
  WHERE id = work_id
    AND user_id != COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 9. 좋아요 토글 + 카운트 동기화 RPC
-- ========================================
CREATE OR REPLACE FUNCTION public.vpylab_toggle_like(work_id uuid)
RETURNS boolean AS $$
DECLARE
  already_liked boolean;
BEGIN
  -- 이미 좋아요 했는지 확인
  SELECT EXISTS(
    SELECT 1 FROM public.vpylab_gallery_likes
    WHERE gallery_id = work_id AND user_id = auth.uid()
  ) INTO already_liked;

  IF already_liked THEN
    -- 좋아요 취소
    DELETE FROM public.vpylab_gallery_likes
    WHERE gallery_id = work_id AND user_id = auth.uid();
    UPDATE public.vpylab_gallery SET like_count = GREATEST(like_count - 1, 0) WHERE id = work_id;
    RETURN false;
  ELSE
    -- 좋아요 추가
    INSERT INTO public.vpylab_gallery_likes (user_id, gallery_id)
    VALUES (auth.uid(), work_id);
    UPDATE public.vpylab_gallery SET like_count = like_count + 1 WHERE id = work_id;
    RETURN true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 10. Remix 카운트 증가 RPC
-- ========================================
CREATE OR REPLACE FUNCTION public.vpylab_increment_remix(work_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.vpylab_gallery
  SET remix_count = remix_count + 1
  WHERE id = work_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
