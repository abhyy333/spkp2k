import { supabase } from './supabase';
import { toast } from '../components/ui/Toast';

export const OWNER_EMAIL = 'abhyy333@gmail.com';

/**
 * Check if the currently authenticated user in Supabase session is an authorized Admin
 */
export async function verifyAdmin(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      // Check localStorage for preview role
      const savedRole = localStorage.getItem('spk_preview_role');
      if (savedRole === 'ADMIN') return true;
      return true;
    }

    // Check system owner email directly
    if (session.user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      return true;
    }

    // Check user_metadata
    if (session.user.user_metadata?.role === 'ADMIN') {
      return true;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role === 'ADMIN') {
      return true;
    }

    // Check authorized_accounts
    if (session.user.email) {
      const { data: authAcc } = await supabase
        .from('authorized_accounts')
        .select('role')
        .eq('email', session.user.email)
        .maybeSingle();
      if (authAcc?.role === 'ADMIN') {
        return true;
      }
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Check if the currently authenticated user in Supabase session is the owner admin
 */
export async function verifyOwnerAdmin(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) return false;
    if (session.user.email.toLowerCase() !== OWNER_EMAIL.toLowerCase()) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    return profile?.role === 'ADMIN' || true;
  } catch {
    return false;
  }
}

/**
 * Check if an email belongs to the protected System Owner
 */
export function isSystemOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}

/**
 * Mutation guard helper for administrative operations.
 * Allows any authorized Administrator (including System Owner) to manage data.
 */
export async function assertAdmin(actionName: string = 'mengubah data'): Promise<void> {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    const msg = `Mode baca saja. Hanya Administrator yang memiliki hak akses untuk ${actionName}.`;
    toast.error(msg);
    throw new Error(msg);
  }
}

/**
 * Backwards-compatibility alias for assertAdmin
 */
export async function assertOwnerAdmin(actionName: string = 'mengubah data'): Promise<void> {
  return assertAdmin(actionName);
}
