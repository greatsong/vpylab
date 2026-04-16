-- 교사 → 학생 실시간 코드 전송 테이블
CREATE TABLE IF NOT EXISTS public.vpylab_code_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.vpylab_classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  code text NOT NULL,
  seq integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_vpylab_code_shares_class ON public.vpylab_code_shares(class_id);
CREATE INDEX IF NOT EXISTS idx_vpylab_code_shares_teacher ON public.vpylab_code_shares(teacher_id);
CREATE INDEX IF NOT EXISTS idx_vpylab_code_shares_created ON public.vpylab_code_shares(created_at DESC);

-- RLS 활성화
ALTER TABLE public.vpylab_code_shares ENABLE ROW LEVEL SECURITY;

-- 학생: 자기 class_id의 코드만 조회 가능
CREATE POLICY "code_shares_select_student" ON public.vpylab_code_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vpylab_profiles p
      WHERE p.id = auth.uid() AND p.class_id = vpylab_code_shares.class_id
    )
  );

-- 교사: 자기가 보낸 코드 조회
CREATE POLICY "code_shares_select_teacher" ON public.vpylab_code_shares
  FOR SELECT USING (teacher_id = auth.uid());

-- 교사: 자기 학급에 코드 전송
CREATE POLICY "code_shares_insert_teacher" ON public.vpylab_code_shares
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.vpylab_classes c
      WHERE c.id = vpylab_code_shares.class_id AND c.teacher_id = auth.uid()
    )
  );

-- 교사: 자기 학급의 코드 삭제 (비우기)
CREATE POLICY "code_shares_delete_teacher" ON public.vpylab_code_shares
  FOR DELETE USING (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.vpylab_classes c
      WHERE c.id = vpylab_code_shares.class_id AND c.teacher_id = auth.uid()
    )
  );

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.vpylab_code_shares;
