import { supabase } from './supabase';
import { toast } from '../components/ui/Toast';

export const OWNER_EMAIL = 'abhyy333@gmail.com';

/**
 * Strict admin verification.
 * Access fails closed: any missing/mismatched/disabled authorization returns false.
 */
export async function verifyAdmin(): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;
    const cleanEmail = user?.email?.trim().toLowerCase();
    if (!user?.id || !cleanEmail) return false;

    const [{ data: profile, error: profileError }, { data: authAcc, error: authError }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('authorized_accounts')
          .select('role, is_active, user_id, is_system_owner')
          .eq('email', cleanEmail)
          .maybeSingle(),
      ]);

    if (profileError || authError || !profile || !authAcc) return false;
    if (profile.is_active === false || authAcc.is_active === false) return false;
    if (profile.role !== 'ADMIN' || authAcc.role !== 'ADMIN') return false;
    if (authAcc.user_id && authAcc.user_id !== user.id) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * System Owner verification is also strict; email alone is not sufficient.
 */
export async function verifyOwnerAdmin(): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.email) return false;
    if (session.user.email.trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      return false;
    }

    return await verifyAdmin();
  } catch {
    return false;
  }
}

export function isSystemOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}

export async function assertAdmin(actionName: string = 'mengubah data'): Promise<void> {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    const msg = `Akses ditolak. Akun ini tidak memiliki hak Administrator aktif untuk ${actionName}.`;
    toast.error(msg);
    throw new Error(msg);
  }
}

export async function assertOwnerAdmin(actionName: string = 'mengubah data'): Promise<void> {
  return assertAdmin(actionName);
}
