-- VPyLab — code_revisions INSERT RLS 취약점 수정
--
-- 문제(3인 팀 플로우 시뮬레이션에서 발견):
--   012의 팀 insert 정책이 `project_id IS NULL OR can_edit_project(project_id)` 였다.
--   공격자가 project_id를 NULL로 두고 임의의 code_id(남의 코드)를 지정하면
--   `project_id IS NULL` 분기가 참이 되어, 코드 소유권/멤버십 검증 없이
--   남의 코드에 리비전(이력)을 위조 삽입할 수 있었다.
--
-- 수정:
--   팀 insert 정책은 project_id가 있고 편집 권한이 있을 때만 허용한다.
--   개인(project_id 없는) 리비전은 기존 `..._insert_own_code` 정책이
--   코드 소유권(sc.user_id = auth.uid())으로 계속 커버한다.
--   클라이언트(codeStore._createRevision)는 팀 리비전에 항상 project_id를
--   채우므로 정상 팀원 동작에는 영향이 없다.

DROP POLICY IF EXISTS "vpylab_code_revisions_team_insert" ON public.vpylab_code_revisions;

CREATE POLICY "vpylab_code_revisions_team_insert" ON public.vpylab_code_revisions
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND project_id IS NOT NULL
    AND public.vpylab_can_edit_project(project_id)
  );
