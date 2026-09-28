-- Migration: Secure Schedule Draft RPCs (clear_schedule_draft & delete_schedule_draft)
-- Security: SECURITY DEFINER, SET search_path = '', private.require_admin() authorization
-- Admin and System Owner (role = 'ADMIN') authorized, broad RLS direct deletes bypassed via secure RPCs.

-- Ensure private schema exists
CREATE SCHEMA IF NOT EXISTS private;

-- Ensure private.require_admin() exists and validates admin privilege
CREATE OR REPLACE FUNCTION private.require_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  -- 1. Check authorized_accounts table
  SELECT EXISTS (
    SELECT 1 FROM public.authorized_accounts
    WHERE (user_id = auth.uid() OR LOWER(email) = LOWER(COALESCE(auth.email(), '')))
      AND is_active = true
      AND role = 'ADMIN'
  ) INTO v_is_admin;

  -- 2. Check profiles table
  IF NOT v_is_admin THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'ADMIN'
    ) INTO v_is_admin;
  END IF;

  -- 3. Check system owner email fallback
  IF NOT v_is_admin THEN
    IF LOWER(COALESCE(auth.email(), '')) = 'abhyy333@gmail.com' THEN
      v_is_admin := true;
    END IF;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION private.require_admin() TO authenticated;


-- =========================================================================
-- 1. RPC: clear_schedule_draft
-- =========================================================================
CREATE OR REPLACE FUNCTION public.clear_schedule_draft(
  p_version_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target record;
  v_deleted_count integer := 0;
  v_new_revision integer;
  v_type text;
  v_audit_table_exists boolean;
BEGIN
  -- 1. Authorization: Require valid admin
  PERFORM private.require_admin();

  -- 2. Lock target schedule_version FOR UPDATE
  SELECT * INTO v_target
  FROM public.schedule_versions
  WHERE id = p_version_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRAFT_NOT_FOUND';
  END IF;

  -- 3. Validation: status must be DRAFT
  IF v_target.status != 'DRAFT' THEN
    RAISE EXCEPTION 'ONLY_DRAFT_CAN_BE_CLEARED';
  END IF;

  v_type := UPPER(COALESCE(v_target.type, 'LECTURE'));

  -- 4. Delete entries based on schedule type
  IF v_type = 'UTS' OR v_type = 'UAS' THEN
    DELETE FROM public.exam_entries
    WHERE schedule_version_id = p_version_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  ELSE
    -- Lecture / Regular schedule
    DELETE FROM public.schedule_entries
    WHERE schedule_version_id = p_version_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;

  -- Clean associated conflicts and suggestions for this draft
  DELETE FROM public.schedule_conflicts
  WHERE schedule_version_id = p_version_id;

  DELETE FROM public.schedule_suggestions
  WHERE schedule_version_id = p_version_id;

  -- 5. Increment revision and update timestamp (preserving scope and workflow configs)
  v_new_revision := COALESCE(v_target.revision, 1) + 1;

  UPDATE public.schedule_versions
  SET
    revision = v_new_revision,
    updated_at = now()
  WHERE id = p_version_id;

  -- 6. Audit log if audit_logs table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) INTO v_audit_table_exists;

  IF v_audit_table_exists THEN
    BEGIN
      INSERT INTO public.audit_logs (
        action,
        details,
        created_at
      ) VALUES (
        'CLEAR_DRAFT_ALLOCATIONS',
        jsonb_build_object(
          'schedule_type', v_type,
          'deleted_entries', v_deleted_count,
          'version_number', v_target.version_number,
          'version_id', p_version_id,
          'deleted_by', auth.uid(),
          'user_id', auth.uid()
        ),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_new_revision;
END;
$$;

-- Grant execution to authenticated role
GRANT EXECUTE ON FUNCTION public.clear_schedule_draft(uuid) TO authenticated;


-- =========================================================================
-- 2. RPC: delete_schedule_draft
-- =========================================================================
CREATE OR REPLACE FUNCTION public.delete_schedule_draft(
  p_version_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target record;
  v_type text;
  v_deleted_schedule_entries integer := 0;
  v_deleted_exam_entries integer := 0;
  v_audit_table_exists boolean;
BEGIN
  -- 1. Authorization: Require valid admin
  PERFORM private.require_admin();

  -- 2. Lock target schedule_version FOR UPDATE
  SELECT * INTO v_target
  FROM public.schedule_versions
  WHERE id = p_version_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRAFT_NOT_FOUND';
  END IF;

  -- 3. Validation: status must be DRAFT
  IF v_target.status != 'DRAFT' THEN
    RAISE EXCEPTION 'ONLY_DRAFT_CAN_BE_DELETED';
  END IF;

  -- 4. Publication protection: verify no publication points to this draft
  IF EXISTS (
    SELECT 1 FROM public.schedule_publications
    WHERE schedule_version_id = p_version_id
  ) THEN
    RAISE EXCEPTION 'ACTIVE_PUBLICATION_CANNOT_BE_DELETED';
  END IF;

  -- 5. Handle source_version_id relation safely in backend
  UPDATE public.schedule_versions
  SET source_version_id = NULL
  WHERE source_version_id = p_version_id;

  v_type := UPPER(COALESCE(v_target.type, 'LECTURE'));

  -- 6. Dependency cleanup for this draft
  DELETE FROM public.schedule_entries
  WHERE schedule_version_id = p_version_id;
  GET DIAGNOSTICS v_deleted_schedule_entries = ROW_COUNT;

  DELETE FROM public.exam_entries
  WHERE schedule_version_id = p_version_id;
  GET DIAGNOSTICS v_deleted_exam_entries = ROW_COUNT;

  DELETE FROM public.schedule_conflicts
  WHERE schedule_version_id = p_version_id;

  DELETE FROM public.schedule_suggestions
  WHERE schedule_version_id = p_version_id;

  -- Delete optimization runs associated ONLY with this version
  DELETE FROM public.optimization_runs
  WHERE schedule_version_id = p_version_id;

  -- 7. Audit log before/during deletion
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) INTO v_audit_table_exists;

  IF v_audit_table_exists THEN
    BEGIN
      INSERT INTO public.audit_logs (
        action,
        details,
        created_at
      ) VALUES (
        'DELETE_DRAFT',
        jsonb_build_object(
          'title', v_target.title,
          'type', v_type,
          'version_number', v_target.version_number,
          'deleted_schedule_entries', v_deleted_schedule_entries,
          'deleted_exam_entries', v_deleted_exam_entries,
          'actor', auth.uid()
        ),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 8. Delete target draft schedule_version
  DELETE FROM public.schedule_versions
  WHERE id = p_version_id;

  RETURN jsonb_build_object(
    'ok', true,
    'version_id', p_version_id
  );
END;
$$;

-- Grant execution to authenticated role
GRANT EXECUTE ON FUNCTION public.delete_schedule_draft(uuid) TO authenticated;


-- =========================================================================
-- 3. RPC: delete_schedule_version_admin
-- =========================================================================
CREATE OR REPLACE FUNCTION public.delete_schedule_version_admin(
  p_version_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target record;
  v_type text;
  v_deleted_schedule_entries integer := 0;
  v_deleted_exam_entries integer := 0;
  v_audit_table_exists boolean;
BEGIN
  -- 1. Authorization: Require valid admin
  PERFORM private.require_admin();

  -- 2. Lock target schedule_version FOR UPDATE
  SELECT * INTO v_target
  FROM public.schedule_versions
  WHERE id = p_version_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERSION_NOT_FOUND';
  END IF;

  -- 3. Release publication pointer if this version is actively published
  DELETE FROM public.schedule_publications
  WHERE schedule_version_id = p_version_id;

  -- 4. Clean orphan source_version_id references
  UPDATE public.schedule_versions
  SET source_version_id = NULL
  WHERE source_version_id = p_version_id;

  v_type := UPPER(COALESCE(v_target.type, 'LECTURE'));

  -- 5. Delete child data
  DELETE FROM public.schedule_entries
  WHERE schedule_version_id = p_version_id;
  GET DIAGNOSTICS v_deleted_schedule_entries = ROW_COUNT;

  DELETE FROM public.exam_entries
  WHERE schedule_version_id = p_version_id;
  GET DIAGNOSTICS v_deleted_exam_entries = ROW_COUNT;

  DELETE FROM public.schedule_conflicts
  WHERE schedule_version_id = p_version_id;

  DELETE FROM public.schedule_suggestions
  WHERE schedule_version_id = p_version_id;

  DELETE FROM public.optimization_runs
  WHERE schedule_version_id = p_version_id;

  -- 6. Audit log
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) INTO v_audit_table_exists;

  IF v_audit_table_exists THEN
    BEGIN
      INSERT INTO public.audit_logs (
        action,
        details,
        created_at
      ) VALUES (
        'DELETE_VERSION_ADMIN',
        jsonb_build_object(
          'title', v_target.title,
          'status', v_target.status,
          'type', v_type,
          'version_number', v_target.version_number,
          'deleted_schedule_entries', v_deleted_schedule_entries,
          'deleted_exam_entries', v_deleted_exam_entries,
          'actor', auth.uid()
        ),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 7. Delete version row
  DELETE FROM public.schedule_versions
  WHERE id = p_version_id;

  RETURN jsonb_build_object(
    'ok', true,
    'version_id', p_version_id
  );
END;
$$;

-- Grant execution to authenticated role
GRANT EXECUTE ON FUNCTION public.delete_schedule_version_admin(uuid) TO authenticated;
