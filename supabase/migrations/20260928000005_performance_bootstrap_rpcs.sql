-- Migration: Performance Optimization RPCs
-- 1. get_active_academic_term
-- 2. get_app_bootstrap
-- 3. get_dashboard_summary

-- 1. get_active_academic_term
CREATE OR REPLACE FUNCTION public.get_active_academic_term()
RETURNS TABLE (
  id uuid,
  academic_year text,
  semester_type text,
  is_active boolean,
  starts_on date,
  ends_on date
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    id,
    COALESCE(academic_year, '2026/2027') AS academic_year,
    COALESCE(semester_type, 'GANJIL') AS semester_type,
    COALESCE(is_active, true) AS is_active,
    starts_on,
    ends_on
  FROM public.academic_terms
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_academic_term() TO anon, authenticated;

-- 2. get_app_bootstrap
CREATE OR REPLACE FUNCTION public.get_app_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := LOWER(COALESCE(auth.email(), ''));
  v_prof record;
  v_auth_acc record;
  v_active_term record;
  v_is_owner boolean := false;
  v_must_change boolean := false;
  v_lecturer_id uuid := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  v_is_owner := (v_email = 'abhyy333@gmail.com');

  -- Get authorized account info
  SELECT user_id, role, lecturer_id, must_change_password, is_active, is_system_owner
  INTO v_auth_acc
  FROM public.authorized_accounts
  WHERE (user_id = v_uid OR LOWER(email) = v_email) AND is_active = true
  LIMIT 1;

  IF FOUND THEN
    v_must_change := COALESCE(v_auth_acc.must_change_password, false);
    v_lecturer_id := v_auth_acc.lecturer_id;
    IF COALESCE(v_auth_acc.is_system_owner, false) THEN
      v_is_owner := true;
    END IF;
  END IF;

  -- Get profile info
  SELECT id, email, name, full_name, role, avatar_url, is_active
  INTO v_prof
  FROM public.profiles
  WHERE id = v_uid
  LIMIT 1;

  -- Get active academic term
  SELECT id, academic_year, semester_type, is_active, starts_on, ends_on
  INTO v_active_term
  FROM public.academic_terms
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'authenticated', true,
    'user_id', v_uid,
    'email', v_email,
    'full_name', COALESCE(v_prof.full_name, v_prof.name, 'Pengguna'),
    'avatar_url', v_prof.avatar_url,
    'role', COALESCE(v_prof.role, v_auth_acc.role, CASE WHEN v_is_owner THEN 'ADMIN' ELSE 'DOSEN' END),
    'is_active', COALESCE(v_prof.is_active, v_auth_acc.is_active, true),
    'is_system_owner', v_is_owner,
    'lecturer_id', v_lecturer_id,
    'must_change_password', v_must_change,
    'academic_term', CASE WHEN v_active_term.id IS NOT NULL THEN jsonb_build_object(
      'id', v_active_term.id,
      'academic_year', COALESCE(v_active_term.academic_year, '2026/2027'),
      'semester_type', COALESCE(v_active_term.semester_type, 'GANJIL'),
      'is_active', COALESCE(v_active_term.is_active, true),
      'starts_on', v_active_term.starts_on,
      'ends_on', v_active_term.ends_on,
      'year', COALESCE(v_active_term.academic_year, '2026/2027'),
      'term', COALESCE(v_active_term.semester_type, 'GANJIL')
    ) ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_bootstrap() TO authenticated;

-- 3. get_dashboard_summary
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_term_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_term_id uuid := p_term_id;
  v_courses_count bigint := 0;
  v_schedulable_courses_count bigint := 0;
  v_lecturers_count bigint := 0;
  v_active_lecturers_count bigint := 0;
  v_rooms_count bigint := 0;
  v_offerings_count bigint := 0;
  v_unconfirmed_offerings_count bigint := 0;
  v_conflicts_count bigint := 0;
BEGIN
  -- If term_id is null, find active
  IF v_term_id IS NULL THEN
    SELECT id INTO v_term_id FROM public.academic_terms WHERE is_active = true ORDER BY created_at DESC LIMIT 1;
  END IF;

  SELECT COUNT(*) INTO v_courses_count FROM public.courses;
  SELECT COUNT(*) INTO v_schedulable_courses_count FROM public.courses WHERE is_active = true;

  SELECT COUNT(*) INTO v_lecturers_count FROM public.lecturers;
  SELECT COUNT(*) INTO v_active_lecturers_count FROM public.lecturers WHERE status = 'Aktif' OR status IS NULL;

  SELECT COUNT(*) INTO v_rooms_count FROM public.rooms;

  IF v_term_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_offerings_count FROM public.course_offerings WHERE academic_term_id = v_term_id;
    SELECT COUNT(*) INTO v_unconfirmed_offerings_count FROM public.course_offerings WHERE academic_term_id = v_term_id AND (is_verified = false OR is_verified IS NULL);
  ELSE
    SELECT COUNT(*) INTO v_offerings_count FROM public.course_offerings;
    SELECT COUNT(*) INTO v_unconfirmed_offerings_count FROM public.course_offerings WHERE is_verified = false OR is_verified IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schedule_conflicts') THEN
    IF v_term_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_conflicts_count FROM public.schedule_conflicts WHERE academic_term_id = v_term_id AND is_resolved = false;
    ELSE
      SELECT COUNT(*) INTO v_conflicts_count FROM public.schedule_conflicts WHERE is_resolved = false;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'totalCourses', v_courses_count,
    'schedulableCourses', v_schedulable_courses_count,
    'totalLecturers', v_lecturers_count,
    'activeLecturers', v_active_lecturers_count,
    'totalRooms', v_rooms_count,
    'totalOfferings', v_offerings_count,
    'unconfirmedOfferings', v_unconfirmed_offerings_count,
    'totalConflicts', v_conflicts_count,
    'resolvedConflicts', 0,
    'publishedPercentage', CASE WHEN v_offerings_count > 0 THEN 100 ELSE 0 END,
    'scheduleStatus', 'Ready',
    'availableRooms', v_rooms_count,
    'totalStudents', 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid) TO anon, authenticated;
