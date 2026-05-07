-- VPyLab — 갤러리와 프로젝트 연결
-- 목적: 갤러리 작품이 어느 VPyLab 프로젝트/GitHub 저장소에서 발행되었는지 추적합니다.

ALTER TABLE public.vpylab_gallery
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.vpylab_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_revision_id uuid REFERENCES public.vpylab_code_revisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS github_last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_vpylab_gallery_project
  ON public.vpylab_gallery(project_id) WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vpylab_gallery_source_revision
  ON public.vpylab_gallery(source_revision_id) WHERE source_revision_id IS NOT NULL;

COMMENT ON COLUMN public.vpylab_gallery.project_id IS
  '이 갤러리 작품이 발행된 VPyLab 프로젝트. 프로젝트가 삭제되면 NULL로 남겨 공개 작품은 유지합니다.';

COMMENT ON COLUMN public.vpylab_gallery.source_revision_id IS
  '갤러리 발행 시점의 코드 revision. 이후 프로젝트가 바뀌어도 발행 버전을 추적하기 위한 값입니다.';
