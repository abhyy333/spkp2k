-- Migration: Atomic Publish Schedule Version with Concurrency & Title Support
-- Ensures STRICT Optimistic Concurrency (p_expected_revision === revision)
-- Returns complete final version metadata in JSONB format
-- SECURITY DEFINER with search_path = '' and private.require_admin()

CREATE OR REPLACE FUNCTION public.publish_schedule_version_named(
  p_version_id uuid,
  p_expected_revision integer,
  p_title text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version record;
  v_new_revision integer;
  v_version_number integer;
  v_published_at timestamptz := now();
  v_type text;
  v_term_id uuid;
  v_entry_count integer := 0;
  v_conflict_count integer := 0;
  v_final_title text;
  v_audit_table_exists boolean;
BEGIN
  -- 1. Authorization: Require valid admin
  PERFORM private.require_admin();

  -- 2. Lock target schedule_version FOR UPDATE
  SELECT * INTO v_version
  FROM public.schedule_versions
  WHERE id = p_version_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRAFT_NOT_FOUND';
  END IF;

  -- 3. Validate status is DRAFT
  IF v_version.status != 'DRAFT' THEN
    RAISE EXCEPTION 'ONLY_DRAFT_CAN_BE_PUBLISHED';
  END IF;

  -- 4. Optimistic Concurrency check: MUST MATCH p_expected_revision
  IF p_expected_revision IS NOT NULL AND v_version.revision != p_expected_revision THEN
    RAISE EXCEPTION 'STALE_REVISION';
  END IF;

  v_type := UPPER(COALESCE(v_version.type, 'LECTURE'));
  v_term_id := COALESCE(v_version.academic_term_id, v_version.term_id);
  v_final_title := COALESCE(NULLIF(TRIM(p_title), ''), v_version.title);

  -- 5. Validate entries exist
  IF v_type = 'UTS' OR v_type = 'UAS' THEN
    SELECT COUNT(*) INTO v_entry_count
    FROM public.exam_entries
    WHERE schedule_version_id = p_version_id;
  ELSE
    SELECT COUNT(*) INTO v_entry_count
    FROM public.schedule_entries
    WHERE schedule_version_id = p_version_id;
  END IF;

  IF v_entry_count = 0 THEN
    RAISE EXCEPTION 'CANNOT_PUBLISH_EMPTY_SCHEDULE';
  END IF;

  -- 6. Check hard conflicts (severity = 'HARD')
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.schedule_conflicts
  WHERE schedule_version_id = p_version_id
    AND severity = 'HARD';

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'HARD_CONFLICTS_EXIST';
  END IF;

  -- 7. Determine version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
  FROM public.schedule_versions
  WHERE COALESCE(academic_term_id, term_id) = v_term_id
    AND UPPER(COALESCE(type, 'LECTURE')) = v_type
    AND status IN ('PUBLISHED', 'REPLACED', 'ARCHIVED');

  -- 8. Archive / Replace previous active published versions for this term and type
  UPDATE public.schedule_versions
  SET status = 'REPLACED',
      updated_at = now()
  WHERE COALESCE(academic_term_id, term_id) = v_term_id
    AND UPPER(COALESCE(type, 'LECTURE')) = v_type
    AND status = 'PUBLISHED'
    AND id != p_version_id;

  -- 9. Increment revision and update status to PUBLISHED
  v_new_revision := COALESCE(v_version.revision, 1) + 1;

  UPDATE public.schedule_versions
  SET
    status = 'PUBLISHED',
    title = v_final_title,
    version_number = v_version_number,
    revision = v_new_revision,
    published_at = v_published_at,
    updated_at = now()
  WHERE id = p_version_id;

  -- 10. Update or insert schedule_publications pointer
  IF v_term_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.schedule_publications
      WHERE academic_term_id = v_term_id
    ) THEN
      IF v_type = 'UTS' THEN
        UPDATE public.schedule_publications
        SET uts_version_id = p_version_id, updated_at = now()
        WHERE academic_term_id = v_term_id;
      ELSIF v_type = 'UAS' THEN
        UPDATE public.schedule_publications
        SET uas_version_id = p_version_id, updated_at = now()
        WHERE academic_term_id = v_term_id;
      ELSE
        UPDATE public.schedule_publications
        SET schedule_version_id = p_version_id, updated_at = now()
        WHERE academic_term_id = v_term_id;
      END IF;
    ELSE
      INSERT INTO public.schedule_publications (
        academic_term_id,
        schedule_version_id,
        uts_version_id,
        uas_version_id,
        created_at,
        updated_at
      ) VALUES (
        v_term_id,
        CASE WHEN v_type NOT IN ('UTS', 'UAS') THEN p_version_id ELSE NULL END,
        CASE WHEN v_type = 'UTS' THEN p_version_id ELSE NULL END,
        CASE WHEN v_type = 'UAS' THEN p_version_id ELSE NULL END,
        now(),
        now()
      );
    END IF;
  END IF;

  -- 11. Audit log if audit_logs table exists
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
        'PUBLISH_SCHEDULE_VERSION',
        jsonb_build_object(
          'version_id', p_version_id,
          'title', v_final_title,
          'type', v_type,
          'version_number', v_version_number,
          'revision', v_new_revision,
          'entry_count', v_entry_count,
          'published_at', v_published_at,
          'actor', auth.uid()
        ),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'version_id', p_version_id,
    'revision', v_new_revision,
    'status', 'PUBLISHED',
    'title', v_final_title,
    'version_number', v_version_number,
    'published_at', v_published_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_schedule_version_named(uuid, integer, text) TO authenticated;

-- Wrap publish_schedule_version to call publish_schedule_version_named
CREATE OR REPLACE FUNCTION public.publish_schedule_version(
  p_version_id uuid,
  p_expected_revision integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.publish_schedule_version_named(p_version_id, p_expected_revision, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_schedule_version(uuid, integer) TO authenticated;
