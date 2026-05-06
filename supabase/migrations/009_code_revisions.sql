-- VPyLab — 코드 이력(Revision) 시스템
-- Phase 1 (Plan C): 학생이 수동 저장할 때마다 코드 스냅샷을 누적하여 git log 스타일 이력 제공
-- 자동저장은 vpylab_saved_code.code 덮어쓰기를 유지(이력 폭발 방지)하고,
-- 명시적 "저장" 액션과 "복원" 액션만 revision을 생성한다.

-- ========================================
-- 1. vpylab_code_revisions 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS public.vpylab_code_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.vpylab_saved_code(id) ON DELETE CASCADE,
  parent_revision_id uuid REFERENCES public.vpylab_code_revisions(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- git commit message에 해당
  message text NOT NULL DEFAULT '',

  -- 코드 스냅샷 (Phase 1은 단순화를 위해 전체 스냅샷 저장; 추후 diff 압축 가능)
  code_snapshot text NOT NULL,
  code_size integer NOT NULL DEFAULT 0,

  -- 'manual' | 'restore' | 'github_pull' | 'mission_submit'
  -- (자동저장은 revision을 만들지 않음 — 의도적)
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'restore', 'github_pull', 'mission_submit')),

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========================================
-- 2. 인덱스
-- ========================================
CREATE INDEX IF NOT EXISTS idx_vpylab_code_revisions_code
  ON public.vpylab_code_revisions(code_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vpylab_code_revisions_author
  ON public.vpylab_code_revisions(author_id);

-- ========================================
-- 3. RLS
-- ========================================
ALTER TABLE public.vpylab_code_revisions ENABLE ROW LEVEL SECURITY;

-- 본인이 만든 revision은 모두 조회 가능
CREATE POLICY "vpylab_code_revisions_select_own_author" ON public.vpylab_code_revisions
  FOR SELECT USING (author_id = auth.uid());

-- 본인이 소유한 코드의 revision은 모두 조회 가능
-- (Phase 2에서 팀 멤버도 조회할 수 있도록 정책 추가 예정)
CREATE POLICY "vpylab_code_revisions_select_own_code" ON public.vpylab_code_revisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vpylab_saved_code sc
      WHERE sc.id = vpylab_code_revisions.code_id
        AND sc.user_id = auth.uid()
    )
  );

-- 본인이 소유한 코드에만 revision 추가 가능
CREATE POLICY "vpylab_code_revisions_insert_own_code" ON public.vpylab_code_revisions
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.vpylab_saved_code sc
      WHERE sc.id = vpylab_code_revisions.code_id
        AND sc.user_id = auth.uid()
    )
  );

-- revision은 immutable (UPDATE/DELETE 정책을 만들지 않음 = 모두 차단)
-- 단, 코드 삭제 시 ON DELETE CASCADE로 함께 정리됨

-- ========================================
-- 4. 보조: 코드별 최신 revision 뷰 (UI용)
-- ========================================
CREATE OR REPLACE VIEW public.vpylab_code_revision_summary AS
SELECT
  code_id,
  COUNT(*)::int AS revision_count,
  MAX(created_at) AS latest_revision_at
FROM public.vpylab_code_revisions
GROUP BY code_id;

COMMENT ON TABLE public.vpylab_code_revisions IS
  'VPyLab Phase 1: 학생 코드 이력(수동 저장/복원 시점 스냅샷). 자동저장은 포함하지 않음.';
