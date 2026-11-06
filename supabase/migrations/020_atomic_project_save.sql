-- 공동 작품의 본문과 저장 이력을 한 트랜잭션에서 저장합니다.
-- 편집을 시작한 코드와 현재 DB 코드가 다르면 최신 코드를 덮어쓰지 않습니다.
ALTER TABLE public.vpylab_code_revisions ADD COLUMN IF NOT EXISTS client_save_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS vpylab_revision_client_save_unique
  ON public.vpylab_code_revisions(code_id, author_id, client_save_id)
  WHERE client_save_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.vpylab_save_project_code(
  p_code_id uuid,
  p_project_id uuid,
  p_client_save_id uuid,
  p_expected_code text,
  p_code text,
  p_title text,
  p_message text DEFAULT '',
  p_source text DEFAULT 'manual',
  p_mission_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.vpylab_saved_code%ROWTYPE;
  saved_row public.vpylab_saved_code%ROWTYPE;
  revision_row public.vpylab_code_revisions%ROWTYPE;
  parent_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.vpylab_can_edit_project(p_project_id) THEN
    RAISE EXCEPTION 'project_write_forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_code IS NULL OR octet_length(p_code) > 102400 OR p_expected_code IS NULL OR p_client_save_id IS NULL THEN
    RAISE EXCEPTION '저장할 코드나 요청 정보가 올바르지 않습니다.' USING ERRCODE = 'PT400';
  END IF;
  IF p_source NOT IN ('manual', 'restore', 'github_pull', 'mission_submit') OR p_source IS NULL THEN
    RAISE EXCEPTION '저장 기록의 종류가 올바르지 않습니다.' USING ERRCODE = 'PT400';
  END IF;

  SELECT * INTO current_row FROM public.vpylab_saved_code
    WHERE id = p_code_id AND project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_code_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO revision_row FROM public.vpylab_code_revisions
    WHERE code_id = p_code_id AND author_id = auth.uid() AND client_save_id = p_client_save_id;
  IF FOUND THEN
    IF revision_row.code_snapshot IS DISTINCT FROM p_code
      OR revision_row.source IS DISTINCT FROM p_source
      OR revision_row.message IS DISTINCT FROM left(coalesce(p_message, ''), 200) THEN
      RAISE EXCEPTION '같은 저장 요청 번호에 다른 내용을 보낼 수 없습니다.' USING ERRCODE = 'PT409';
    END IF;
    RETURN jsonb_build_object('saved', to_jsonb(current_row) || jsonb_build_object('code', revision_row.code_snapshot),
      'revision', to_jsonb(revision_row), 'already_saved', true,
      'superseded', current_row.code IS DISTINCT FROM revision_row.code_snapshot, 'latest_code', current_row.code);
  END IF;
  IF current_row.code IS DISTINCT FROM p_expected_code THEN
    RAISE EXCEPTION 'saved_code_conflict' USING ERRCODE = 'PT409';
  END IF;

  SELECT id INTO parent_id FROM public.vpylab_code_revisions
    WHERE code_id = p_code_id ORDER BY created_at DESC, id DESC LIMIT 1;
  UPDATE public.vpylab_saved_code SET
    code = p_code, mission_id = coalesce(p_mission_id, current_row.mission_id), updated_at = clock_timestamp()
    WHERE id = p_code_id AND project_id = p_project_id RETURNING * INTO saved_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_write_forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.vpylab_code_revisions
    (code_id, project_id, parent_revision_id, author_id, code_snapshot, code_size, message, source, client_save_id, created_at)
    VALUES (p_code_id, p_project_id, parent_id, auth.uid(), p_code, length(p_code), left(coalesce(p_message, ''), 200), p_source, p_client_save_id, clock_timestamp())
    RETURNING * INTO revision_row;
  RETURN jsonb_build_object('saved', to_jsonb(saved_row), 'revision', to_jsonb(revision_row));
END;
$$;

REVOKE ALL ON FUNCTION public.vpylab_save_project_code(uuid, uuid, uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vpylab_save_project_code(uuid, uuid, uuid, text, text, text, text, text, text) TO authenticated;

-- 이전 클라이언트·자동저장·projectId 생략도 공동 코드 직접 덮어쓰기를 허용하지 않습니다.
CREATE OR REPLACE FUNCTION public.vpylab_guard_project_code_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- 프로젝트 삭제로 FK가 해제되는 경우에는 이미 공동 작품이 아니므로 허용합니다.
  IF OLD.project_id IS NOT NULL AND NEW.project_id IS NULL
    AND OLD.code IS NOT DISTINCT FROM NEW.code
    AND public.vpylab_project_owner_id(OLD.project_id) IS NULL THEN
    RETURN NEW;
  END IF;
  IF current_user IN ('authenticated', 'anon')
    AND (OLD.project_id IS NOT NULL OR NEW.project_id IS NOT NULL)
    AND (OLD.code IS DISTINCT FROM NEW.code OR OLD.project_id IS DISTINCT FROM NEW.project_id
      OR OLD.id IS DISTINCT FROM NEW.id OR OLD.mission_id IS DISTINCT FROM NEW.mission_id) THEN
    RAISE EXCEPTION '공동 작품 저장 방식이 바뀌었습니다. 편집 중 코드를 복사해 보관한 뒤 화면을 새로고침해주세요.' USING ERRCODE = 'PT409';
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgname = 'vpylab_guard_project_code_update'
      AND tgrelid = 'public.vpylab_saved_code'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER vpylab_guard_project_code_update
      BEFORE UPDATE ON public.vpylab_saved_code
      FOR EACH ROW EXECUTE FUNCTION public.vpylab_guard_project_code_update();
  END IF;
END;
$$;
