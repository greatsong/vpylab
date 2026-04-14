-- VPy Lab 스키마 마이그레이션
-- 대상: pythink2 Supabase 프로젝트 (fipdcjhtfslinfmalwjn)
-- 날짜: 2026-04-14

-- ========================================
-- 1. 테이블 생성 (순서 중요: classes → user_profiles → saved_code → submissions)
-- ========================================

-- classes: 학급
CREATE TABLE IF NOT EXISTS public.vpylab_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  teacher_id uuid NOT NULL REFERENCES auth.users(id),
  invite_code text UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  created_at timestamptz DEFAULT now()
);

-- user_profiles: 사용자 프로필 (auth.users 확장)
CREATE TABLE IF NOT EXISTS public.vpylab_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  avatar_url text,
  class_id uuid REFERENCES public.vpylab_classes(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- saved_code: 저장된 코드
CREATE TABLE IF NOT EXISTS public.vpylab_saved_code (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '제목 없음',
  code text NOT NULL,
  mission_id text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- submissions: 미션 제출 기록
CREATE TABLE IF NOT EXISTS public.vpylab_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id text NOT NULL,
  code text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  grading_details jsonb,
  created_at timestamptz DEFAULT now()
);

-- ========================================
-- 2. 인덱스
-- ========================================
CREATE INDEX IF NOT EXISTS idx_vpylab_saved_code_user ON public.vpylab_saved_code(user_id);
CREATE INDEX IF NOT EXISTS idx_vpylab_submissions_user ON public.vpylab_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_vpylab_submissions_mission ON public.vpylab_submissions(mission_id);
CREATE INDEX IF NOT EXISTS idx_vpylab_profiles_class ON public.vpylab_profiles(class_id);
CREATE INDEX IF NOT EXISTS idx_vpylab_classes_teacher ON public.vpylab_classes(teacher_id);

-- ========================================
-- 3. RLS 활성화
-- ========================================
ALTER TABLE public.vpylab_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpylab_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpylab_saved_code ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpylab_submissions ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. RLS 정책
-- ========================================

-- vpylab_profiles: 본인만 수정, 같은 학급 교사가 읽기 가능
CREATE POLICY "vpylab_profiles_select_own" ON public.vpylab_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "vpylab_profiles_select_teacher" ON public.vpylab_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vpylab_profiles tp
      WHERE tp.id = auth.uid()
        AND tp.role IN ('teacher', 'admin')
        AND tp.class_id IS NOT NULL
        AND tp.class_id = vpylab_profiles.class_id
    )
  );

CREATE POLICY "vpylab_profiles_insert" ON public.vpylab_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "vpylab_profiles_update" ON public.vpylab_profiles
  FOR UPDATE USING (auth.uid() = id);

-- vpylab_saved_code: 본인만 CRUD
CREATE POLICY "vpylab_saved_code_all" ON public.vpylab_saved_code
  FOR ALL USING (auth.uid() = user_id);

-- vpylab_submissions: 본인 읽기/쓰기, 교사는 담당 학급 학생 제출 읽기
CREATE POLICY "vpylab_submissions_select_own" ON public.vpylab_submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "vpylab_submissions_insert" ON public.vpylab_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vpylab_submissions_select_teacher" ON public.vpylab_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vpylab_profiles tp
      JOIN public.vpylab_profiles sp ON sp.class_id = tp.class_id
      WHERE tp.id = auth.uid()
        AND tp.role IN ('teacher', 'admin')
        AND sp.id = vpylab_submissions.user_id
    )
  );

-- vpylab_classes: 교사만 생성/수정, 학급 구성원 읽기
CREATE POLICY "vpylab_classes_select" ON public.vpylab_classes
  FOR SELECT USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.vpylab_profiles p
      WHERE p.id = auth.uid() AND p.class_id = vpylab_classes.id
    )
  );

CREATE POLICY "vpylab_classes_insert" ON public.vpylab_classes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vpylab_profiles p
      WHERE p.id = auth.uid() AND p.role IN ('teacher', 'admin')
    )
  );

CREATE POLICY "vpylab_classes_update" ON public.vpylab_classes
  FOR UPDATE USING (teacher_id = auth.uid());

-- ========================================
-- 5. updated_at 자동 갱신 트리거
-- ========================================
CREATE OR REPLACE FUNCTION public.vpylab_update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vpylab_profiles_updated_at
  BEFORE UPDATE ON public.vpylab_profiles
  FOR EACH ROW EXECUTE FUNCTION public.vpylab_update_updated_at();

CREATE TRIGGER vpylab_saved_code_updated_at
  BEFORE UPDATE ON public.vpylab_saved_code
  FOR EACH ROW EXECUTE FUNCTION public.vpylab_update_updated_at();
