-- 보안 수정: 공유 테이블의 공개 INSERT 제거
-- 이제 서버 경유(service_role)로만 INSERT 가능

DROP POLICY IF EXISTS "vpylab_shares_insert_all" ON public.vpylab_shares;

-- 인증된 사용자만 INSERT (fallback, 실제로는 서버 service_role 사용)
CREATE POLICY "vpylab_shares_insert_auth" ON public.vpylab_shares
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 크기 제한 (DB 레벨 방어)
ALTER TABLE public.vpylab_shares
  ADD CONSTRAINT vpylab_shares_code_size CHECK (length(code) <= 50000);
