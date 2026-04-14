-- 갤러리 제목 검색 성능 개선
-- ilike('%...%') 쿼리를 위한 trigram 인덱스

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_vpylab_gallery_title_trgm
  ON public.vpylab_gallery USING gin (title gin_trgm_ops);

-- 카테고리 + 공개 여부 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_vpylab_gallery_category_public
  ON public.vpylab_gallery (category, is_public)
  WHERE is_public = true;
