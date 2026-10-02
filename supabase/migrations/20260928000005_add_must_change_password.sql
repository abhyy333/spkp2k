-- Add must_change_password column to authorized_accounts if it doesn't exist
ALTER TABLE public.authorized_accounts
ADD COLUMN IF NOT EXISTS must_change_password boolean
NOT NULL
DEFAULT false;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
