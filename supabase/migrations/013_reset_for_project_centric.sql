-- VPyLab — Phase 4-A: 프로젝트 중심 모델로 전환 전 테스트 데이터 리셋
-- 사용자 확인: 기존 데이터는 모두 테스트용 → 안전하게 삭제 가능.
-- 스키마는 유지하고 행만 비운다.

DELETE FROM public.vpylab_code_revisions;
DELETE FROM public.vpylab_saved_code;
DELETE FROM public.vpylab_project_members;
DELETE FROM public.vpylab_projects;
DELETE FROM public.vpylab_submissions;

-- (vpylab_classes / vpylab_profiles는 사용자 계정 메타라 보존)
-- (vpylab_gallery / vpylab_shares 등 별도 기능은 보존)

COMMENT ON TABLE public.vpylab_projects IS
  'VPyLab Phase 4-A부터: 프로젝트 = GitHub 레포 1:1 매핑. owner_id 단독이면 개인, 다수면 팀.';
