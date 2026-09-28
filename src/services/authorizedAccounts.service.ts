import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthorizedAccount, Lecturer } from '../types';
import { parseSupabaseError } from '../lib/utils';
import { OWNER_EMAIL } from '../lib/authGuard';

export const authorizedAccountsService = {
  /**
   * Memeriksa apakah suatu alamat email telah diotorisasi
   */
  async checkAuthorization(email: string): Promise<{
    authorized: boolean;
    role?: 'ADMIN' | 'DOSEN';
    isActive?: boolean;
    mustChangePassword?: boolean;
    message?: string;
  }> {
    if (!isSupabaseConfigured()) {
      return { authorized: true, role: 'ADMIN', isActive: true, mustChangePassword: false };
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === OWNER_EMAIL.toLowerCase()) {
      return { authorized: true, role: 'ADMIN', isActive: true, mustChangePassword: false };
    }

    try {
      const { data, error } = await supabase
        .from('authorized_accounts')
        .select('email, role, is_active, must_change_password')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error || !data || !data.is_active) {
        return {
          authorized: false,
          message: 'Akun ini tidak memiliki otorisasi. Silakan hubungi Administrator Jurusan.',
        };
      }

      return {
        authorized: true,
        role: data.role as 'ADMIN' | 'DOSEN',
        isActive: true,
        mustChangePassword: Boolean(data.must_change_password),
      };
    } catch (err: any) {
      console.warn('Exception during authorization check:', err);
      return {
        authorized: false,
        message: 'Gagal memeriksa status otorisasi akun.',
      };
    }
  },

  /**
   * Mengambil daftar authorized accounts (ADMIN / DOSEN) beserta relasi dosen
   */
  async getAuthorizedAccounts(roleFilter?: 'ADMIN' | 'DOSEN'): Promise<AuthorizedAccount[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      let query = supabase
        .from('authorized_accounts')
        .select(`
          email,
          role,
          lecturer_id,
          user_id,
          is_active,
          is_system_owner,
          must_change_password,
          created_by,
          created_at,
          updated_at,
          claimed_at
        `)
        .order('created_at', { ascending: true });

      if (roleFilter) {
        query = query.eq('role', roleFilter);
      }

      const [{ data, error }, { data: lecturersData }] = await Promise.all([
        query,
        supabase
          .from('lecturers')
          .select('id, name, lecturer_code, code, nip, email, status, kbk_id'),
      ]);

      if (error) {
        console.error('Error fetching authorized_accounts:', error);
        throw new Error(parseSupabaseError(error));
      }

      const lecturersMap = new Map<string, Lecturer>();
      const lecturersByEmail = new Map<string, Lecturer>();
      if (lecturersData) {
        for (const l of lecturersData) {
          if (l.id) lecturersMap.set(l.id, l as Lecturer);
          if (l.email) lecturersByEmail.set(l.email.trim().toLowerCase(), l as Lecturer);
        }
      }

      const accounts: AuthorizedAccount[] = (data || []).map((row: any) => {
        const isOwner =
          Boolean(row.is_system_owner) ||
          row.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

        const cleanEmail = row.email ? String(row.email).trim().toLowerCase() : '';
        const mappedLecturer = row.lecturer_id
          ? lecturersMap.get(row.lecturer_id) || lecturersByEmail.get(cleanEmail) || null
          : lecturersByEmail.get(cleanEmail) || null;

        return {
          email: row.email,
          role: row.role,
          lecturer_id: row.lecturer_id || mappedLecturer?.id || null,
          user_id: row.user_id || null,
          is_active: Boolean(row.is_active),
          is_system_owner: isOwner,
          must_change_password: Boolean(row.must_change_password),
          created_by: row.created_by || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
          claimed_at: row.claimed_at || null,
          lecturer: mappedLecturer,
          profile: null,
        };
      });

      // Sort: System Owner first, then ADMIN first, then email
      accounts.sort((a, b) => {
        if (a.is_system_owner && !b.is_system_owner) return -1;
        if (!a.is_system_owner && b.is_system_owner) return 1;
        if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
        if (a.role !== 'ADMIN' && b.role === 'ADMIN') return 1;
        return a.email.localeCompare(b.email);
      });

      return accounts;
    } catch (err: any) {
      console.error('Failed to get authorized accounts:', err);
      throw err;
    }
  },

  /**
   * MEMBUAT AKUN BARU SERVER-SIDE OLEH ADMIN
   * Menghasilkan kata sandi sementara yang hanya ditampilkan sekali
   */
  async createAccount(payload: {
    email: string;
    role: 'ADMIN' | 'DOSEN';
    lecturerId?: string | null;
    fullName?: string;
  }): Promise<{
    email: string;
    temporaryPassword: string;
    userId: string;
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const cleanEmail = payload.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Format alamat email tidak valid.');
    }

    if (payload.role === 'DOSEN' && !payload.lecturerId) {
      throw new Error('Dosen pengampu wajib dipilih.');
    }

    const { data, error } = await supabase.rpc('admin_create_account', {
      p_email: cleanEmail,
      p_role: payload.role,
      p_lecturer_id: payload.lecturerId || null,
      p_full_name: payload.fullName || null,
    });

    if (error) {
      let msg = error.message || '';
      if (msg.includes('EMAIL_ALREADY_EXISTS')) {
        msg = `Email ${cleanEmail} sudah terdaftar dengan akun aktif.`;
      } else if (msg.includes('LECTURER_ALREADY_LINKED')) {
        msg = 'Dosen tersebut sudah memiliki akun terdaftar.';
      } else if (msg.includes('LECTURER_REQUIRED')) {
        msg = 'Dosen pengampu wajib dipilih untuk akun Dosen.';
      } else {
        msg = parseSupabaseError(error);
      }
      throw new Error(msg);
    }

    return {
      email: data.email || cleanEmail,
      temporaryPassword: data.temporary_password,
      userId: data.user_id,
    };
  },

  /**
   * RESET KATA SANDI SERVER-SIDE OLEH ADMIN
   * Menghasilkan kata sandi sementara baru dan mewajibkan ganti sandi saat login
   */
  async resetPassword(targetEmail: string): Promise<{
    email: string;
    temporaryPassword: string;
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Alamat email wajib diisi.');
    }

    const { data, error } = await supabase.rpc('admin_reset_password', {
      p_target_email: cleanEmail,
    });

    if (error) {
      let msg = error.message || '';
      if (msg.includes('USER_NOT_FOUND')) {
        msg = `Akun untuk ${cleanEmail} belum dibuat di sistem.`;
      } else {
        msg = parseSupabaseError(error);
      }
      throw new Error(msg);
    }

    return {
      email: data.email || cleanEmail,
      temporaryPassword: data.temporary_password,
    };
  },

  /**
   * SELESAIKAN GANTI KATA SANDI MANDATORI
   */
  async completePasswordChange(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.rpc('complete_password_change');
    if (error) {
      console.warn('complete_password_change error:', error);
    }
  },

  /**
   * Backward compatibility helpers for adding admin / lecturer
   */
  async addAdmin(email: string, fullName?: string) {
    return this.createAccount({
      email,
      role: 'ADMIN',
      fullName,
    });
  },

  async addLecturerAccount(email: string, lecturerId: string) {
    return this.createAccount({
      email,
      role: 'DOSEN',
      lecturerId,
    });
  },

  /**
   * Mengubah status aktif / nonaktif akun otorisasi berdasarkan email
   */
  async setStatus(email: string, isActive: boolean, isSystemOwner?: boolean): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const cleanEmail = email.trim().toLowerCase();

    if (isSystemOwner || cleanEmail === OWNER_EMAIL.toLowerCase()) {
      throw new Error('System Owner tidak boleh dinonaktifkan.');
    }

    const { error } = await supabase
      .from('authorized_accounts')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('email', cleanEmail);

    if (error) {
      throw new Error(parseSupabaseError(error));
    }
  },

  /**
   * Menghapus record otorisasi berdasarkan email
   */
  async deleteAuthorizedAccount(email: string, isSystemOwner?: boolean): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const cleanEmail = email.trim().toLowerCase();

    if (isSystemOwner || cleanEmail === OWNER_EMAIL.toLowerCase()) {
      throw new Error('System Owner tidak boleh dihapus.');
    }

    const { error } = await supabase
      .from('authorized_accounts')
      .delete()
      .eq('email', cleanEmail);

    if (error) {
      throw new Error(parseSupabaseError(error));
    }
  },
};
