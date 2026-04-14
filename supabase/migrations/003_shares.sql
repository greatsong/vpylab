-- VPyLab 짧은 URL 공유 테이블
-- GlowScript처럼 /s/abc12345 형태로 코드 공유

CREATE TABLE IF NOT EXISTS public.vpylab_shares (
  id text PRIMARY KEY,                    -- nanoid 8자
  code text NOT NULL,
  title text NOT NULL DEFAULT '제목 없음',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- 비로그인도 가능
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.vpylab_shares ENABLE ROW LEVEL SECURITY;

-- 누구나 공유 링크로 조회 가능
CREATE POLICY "vpylab_shares_select_all" ON public.vpylab_shares
  FOR SELECT USING (true);

-- 누구나 공유 생성 가능 (비로그인 포함)
CREATE POLICY "vpylab_shares_insert_all" ON public.vpylab_shares
  FOR INSERT WITH CHECK (true);
