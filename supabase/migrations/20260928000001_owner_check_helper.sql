-- Migration: Helper function private.is_system_owner()
CREATE OR REPLACE FUNCTION private.is_system_owner()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_owner boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM public.authorized_accounts
    WHERE (user_id = auth.uid() OR LOWER(email) = LOWER(COALESCE(auth.email(), '')))
      AND is_active = true
      AND role = 'ADMIN'
      AND is_system_owner = true
  ) INTO v_is_owner;

  -- Fallback for primary owner email
  IF NOT v_is_owner THEN
    IF LOWER(COALESCE(auth.email(), '')) = 'abhyy333@gmail.com' THEN
      v_is_owner := true;
    END IF;
  END IF;

  RETURN v_is_owner;
END;
$$;

GRANT EXECUTE ON FUNCTION private.is_system_owner() TO authenticated;
