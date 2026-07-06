-- VPyLab — Remix 출처(attribution) 비정규화
-- 목적: 원작 삭제 시 remix_from이 SET NULL로 사라져도
--       파생 작품에 "원작: 제목 by 작성자" 출처 표기를 유지합니다.
--       두 컬럼은 발행/Fork 시점의 스냅샷 값입니다.

ALTER TABLE public.vpylab_gallery
  ADD COLUMN IF NOT EXISTS remix_from_title text,
  ADD COLUMN IF NOT EXISTS remix_from_author text;

COMMENT ON COLUMN public.vpylab_gallery.remix_from_title IS
  'Remix 원작 제목 스냅샷. 원작이 삭제되어도 출처 표기를 유지하기 위해 발행/Fork 시점에 기록합니다.';

COMMENT ON COLUMN public.vpylab_gallery.remix_from_author IS
  'Remix 원작 작성자 표시명 스냅샷. 원작이 삭제되어도 출처 표기를 유지하기 위해 발행/Fork 시점에 기록합니다.';
