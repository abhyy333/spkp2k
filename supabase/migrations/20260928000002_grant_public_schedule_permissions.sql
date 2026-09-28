-- Migration: Grant public permissions for published schedule and exam views and underlying tables
-- Fixes permission denied for table schedule_entries (error 42501) for anon and authenticated roles

-- 0. Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 1. Grant SELECT on views
GRANT SELECT ON public.current_published_schedule TO anon, authenticated;
GRANT SELECT ON public.current_published_exams TO anon, authenticated;

-- 2. Grant SELECT on underlying tables required for current_published_schedule and current_published_exams
GRANT SELECT ON public.schedule_entries TO anon, authenticated;
GRANT SELECT ON public.exam_entries TO anon, authenticated;
GRANT SELECT ON public.schedule_versions TO anon, authenticated;
GRANT SELECT ON public.course_offerings TO anon, authenticated;
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT SELECT ON public.lecturers TO anon, authenticated;
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT SELECT ON public.academic_terms TO anon, authenticated;
GRANT SELECT ON public.schedule_publications TO anon, authenticated;
GRANT SELECT ON public.exam_sessions TO anon, authenticated;
GRANT SELECT ON public.course_offering_lecturers TO anon, authenticated;
GRANT SELECT ON public.time_slots TO anon, authenticated;

-- Future tables default grant
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;

-- 3. Ensure RLS Policies allow SELECT for anon and authenticated on these tables
DO $$
BEGIN
  -- schedule_entries RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schedule_entries') THEN
    ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for schedule_entries" ON public.schedule_entries;
    CREATE POLICY "Public select for schedule_entries" ON public.schedule_entries
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- exam_entries RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exam_entries') THEN
    ALTER TABLE public.exam_entries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for exam_entries" ON public.exam_entries;
    CREATE POLICY "Public select for exam_entries" ON public.exam_entries
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- schedule_versions RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schedule_versions') THEN
    ALTER TABLE public.schedule_versions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for schedule_versions" ON public.schedule_versions;
    CREATE POLICY "Public select for schedule_versions" ON public.schedule_versions
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- course_offerings RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'course_offerings') THEN
    ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for course_offerings" ON public.course_offerings;
    CREATE POLICY "Public select for course_offerings" ON public.course_offerings
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- courses RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'courses') THEN
    ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for courses" ON public.courses;
    CREATE POLICY "Public select for courses" ON public.courses
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- lecturers RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lecturers') THEN
    ALTER TABLE public.lecturers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for lecturers" ON public.lecturers;
    CREATE POLICY "Public select for lecturers" ON public.lecturers
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- rooms RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rooms') THEN
    ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for rooms" ON public.rooms;
    CREATE POLICY "Public select for rooms" ON public.rooms
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- academic_terms RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'academic_terms') THEN
    ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for academic_terms" ON public.academic_terms;
    CREATE POLICY "Public select for academic_terms" ON public.academic_terms
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- schedule_publications RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schedule_publications') THEN
    ALTER TABLE public.schedule_publications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for schedule_publications" ON public.schedule_publications;
    CREATE POLICY "Public select for schedule_publications" ON public.schedule_publications
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- course_offering_lecturers RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'course_offering_lecturers') THEN
    ALTER TABLE public.course_offering_lecturers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for course_offering_lecturers" ON public.course_offering_lecturers;
    CREATE POLICY "Public select for course_offering_lecturers" ON public.course_offering_lecturers
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- time_slots RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'time_slots') THEN
    ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for time_slots" ON public.time_slots;
    CREATE POLICY "Public select for time_slots" ON public.time_slots
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- exam_sessions RLS SELECT
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exam_sessions') THEN
    ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for exam_sessions" ON public.exam_sessions;
    CREATE POLICY "Public select for exam_sessions" ON public.exam_sessions
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- 4. SECURITY DEFINER RPC Functions: Bypass any caller table-level privilege limits
CREATE OR REPLACE FUNCTION public.get_current_published_schedule(
  p_academic_term_id uuid DEFAULT NULL
)
RETURNS SETOF public.current_published_schedule
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.current_published_schedule
  WHERE (p_academic_term_id IS NULL OR academic_term_id = p_academic_term_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_current_published_schedule(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_current_published_exams(
  p_academic_term_id uuid DEFAULT NULL,
  p_type text DEFAULT NULL
)
RETURNS SETOF public.current_published_exams
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.current_published_exams
  WHERE (p_academic_term_id IS NULL OR academic_term_id = p_academic_term_id)
    AND (p_type IS NULL OR type = p_type);
$$;

GRANT EXECUTE ON FUNCTION public.get_current_published_exams(uuid, text) TO anon, authenticated;
