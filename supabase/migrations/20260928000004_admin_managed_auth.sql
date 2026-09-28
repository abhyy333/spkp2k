-- Migration: Admin-Managed Authentication & Password Management
-- Security: SECURITY DEFINER, SET search_path = '', private.require_admin() authorization
-- Allows Admin to create accounts and reset passwords server-side securely.

-- 1. Ensure column must_change_password exists on authorized_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'authorized_accounts'
      AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE public.authorized_accounts
      ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Helper function to generate secure temporary password
CREATE OR REPLACE FUNCTION private.generate_temp_password()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  v_result text := 'JTE-';
  v_i integer;
BEGIN
  -- Generate 4 random chars
  FOR v_i IN 1..4 LOOP
    v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
  END LOOP;
  v_result := v_result || '-';
  -- Generate another 4 random chars
  FOR v_i IN 1..4 LOOP
    v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
  END LOOP;
  RETURN v_result;
END;
$$;

-- 3. RPC: admin_create_account
CREATE OR REPLACE FUNCTION public.admin_create_account(
  p_email text,
  p_role text,
  p_lecturer_id uuid DEFAULT NULL,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_email text;
  v_clean_role text;
  v_temp_password text;
  v_user_id uuid;
  v_existing_user_id uuid;
  v_name text;
  v_lecturer_record record;
BEGIN
  -- 1. Require Admin Authorization
  PERFORM private.require_admin();

  -- 2. Clean inputs
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
  v_clean_role := UPPER(TRIM(COALESCE(p_role, 'DOSEN')));

  IF v_clean_email = '' OR POSITION('@' IN v_clean_email) = 0 THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;

  IF v_clean_role NOT IN ('ADMIN', 'DOSEN') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;

  -- 3. Check duplicate active authorized account
  IF EXISTS (
    SELECT 1 FROM public.authorized_accounts
    WHERE LOWER(email) = v_clean_email AND is_active = true
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS';
  END IF;

  -- 4. Dosen mapping validation
  IF v_clean_role = 'DOSEN' THEN
    IF p_lecturer_id IS NULL THEN
      RAISE EXCEPTION 'LECTURER_REQUIRED';
    END IF;

    SELECT id, name, email INTO v_lecturer_record
    FROM public.lecturers
    WHERE id = p_lecturer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'LECTURER_NOT_FOUND';
    END IF;

    -- Check if lecturer is already linked to another active account
    IF EXISTS (
      SELECT 1 FROM public.authorized_accounts
      WHERE lecturer_id = p_lecturer_id
        AND LOWER(email) != v_clean_email
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'LECTURER_ALREADY_LINKED';
    END IF;
  END IF;

  -- Determine display name
  v_name := COALESCE(NULLIF(TRIM(p_full_name), ''), v_lecturer_record.name, CASE WHEN v_clean_role = 'ADMIN' THEN 'Administrator' ELSE 'Dosen' END);

  -- 5. Generate secure temporary password
  v_temp_password := private.generate_temp_password();

  -- 6. Check existing user in auth.users
  SELECT id INTO v_existing_user_id
  FROM auth.users
  WHERE LOWER(email) = v_clean_email;

  IF v_existing_user_id IS NOT NULL THEN
    v_user_id := v_existing_user_id;
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', v_name, 'name', v_name),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      role,
      aud,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_clean_email,
      extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name, 'name', v_name),
      'authenticated',
      'authenticated',
      now(),
      now()
    );

    -- Insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
      'email',
      now(),
      now(),
      now()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 7. Upsert public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    name,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_clean_email,
    v_name,
    v_name,
    v_clean_role,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = true,
    updated_at = now();

  -- 8. Upsert public.authorized_accounts
  INSERT INTO public.authorized_accounts (
    email,
    role,
    lecturer_id,
    user_id,
    is_active,
    must_change_password,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_clean_email,
    v_clean_role,
    CASE WHEN v_clean_role = 'DOSEN' THEN p_lecturer_id ELSE NULL END,
    v_user_id,
    true,
    true,
    auth.uid(),
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    lecturer_id = CASE WHEN EXCLUDED.role = 'DOSEN' THEN EXCLUDED.lecturer_id ELSE NULL END,
    user_id = EXCLUDED.user_id,
    is_active = true,
    must_change_password = true,
    updated_at = now();

  -- 9. Update lecturers table if DOSEN
  IF v_clean_role = 'DOSEN' AND p_lecturer_id IS NOT NULL THEN
    UPDATE public.lecturers
    SET profile_id = v_user_id,
        email = v_clean_email
    WHERE id = p_lecturer_id;
  END IF;

  -- 10. Audit Log
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    BEGIN
      INSERT INTO public.audit_logs (
        action,
        details,
        created_at
      ) VALUES (
        'CREATE_ACCOUNT',
        jsonb_build_object(
          'target_user_id', v_user_id,
          'target_email', v_clean_email,
          'role', v_clean_role,
          'lecturer_id', p_lecturer_id,
          'actor_id', auth.uid()
        ),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'email', v_clean_email,
    'role', v_clean_role,
    'temporary_password', v_temp_password
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_account(text, text, uuid, text) TO authenticated;

-- 4. RPC: admin_reset_password
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_target_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_email text;
  v_temp_password text;
  v_user_id uuid;
BEGIN
  -- 1. Require Admin Authorization
  PERFORM private.require_admin();

  v_clean_email := LOWER(TRIM(COALESCE(p_target_email, '')));
  IF v_clean_email = '' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;

  -- Get auth user id
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = v_clean_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  -- 2. Generate new temporary password
  v_temp_password := private.generate_temp_password();

  -- 3. Update auth.users password
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = v_user_id;

  -- 4. Update authorized_accounts
  UPDATE public.authorized_accounts
  SET must_change_password = true,
      updated_at = now()
  WHERE LOWER(email) = v_clean_email;

  -- 5. Audit Log (NO PASSWORD stored)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    BEGIN
      INSERT INTO public.audit_logs (
        action,
        details,
        created_at
      ) VALUES (
        'RESET_PASSWORD',
        jsonb_build_object(
          'target_user_id', v_user_id,
          'target_email', v_clean_email,
          'actor_id', auth.uid()
        ),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'email', v_clean_email,
    'temporary_password', v_temp_password
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_password(text) TO authenticated;

-- 5. RPC: complete_password_change
CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  UPDATE public.authorized_accounts
  SET must_change_password = false,
      updated_at = now()
  WHERE user_id = auth.uid()
     OR LOWER(email) = LOWER(COALESCE(auth.email(), ''));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;
