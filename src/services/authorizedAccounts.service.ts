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
      let { data, error } = await supabase
        .from('authorized_accounts')
        .select('email, role, is_active, must_change_password')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error && (error.code === '42703' || error.message?.includes('must_change_password'))) {
        const fallbackRes = await supabase
          .from('authorized_accounts')
          .select('email, role, is_active')
          .eq('email', cleanEmail)
          .maybeSingle();
        data = fallbackRes.data ? { ...fallbackRes.data, must_change_password: false } : null;
        error = fallbackRes.error;
      }

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
      const fetchAuthorized = async () => {
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

        const { data, error } = await query;
        if (error && (error.code === '42703' || error.message?.includes('must_change_password'))) {
          // Fallback without must_change_password
          let fallbackQuery = supabase
            .from('authorized_accounts')
            .select(`
              email,
              role,
              lecturer_id,
              user_id,
              is_active,
              is_system_owner,
              created_by,
              created_at,
              updated_at,
              claimed_at
            `)
            .order('created_at', { ascending: true });

          if (roleFilter) {
            fallbackQuery = fallbackQuery.eq('role', roleFilter);
          }

          const fallbackRes = await fallbackQuery;
          if (fallbackRes.error) {
            throw fallbackRes.error;
          }
          return (fallbackRes.data || []).map(row => ({ ...row, must_change_password: false }));
        }

        if (error) {
          throw error;
        }

        return data || [];
      };

      const [data, { data: lecturersData, error: lecturersError }] = await Promise.all([
        fetchAuthorized(),
        supabase
          .from('lecturers')
          .select('id, name, lecturer_code, nip, email, status, kbk_id'),
      ]);

      if (lecturersError) {
        console.error('Error fetching lecturers for authorized accounts:', lecturersError);
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

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-account', {
        body: {
          email: cleanEmail,
          full_name: payload.fullName || (payload.role === 'ADMIN' ? 'Administrator' : 'Dosen'),
          role: payload.role,
          lecturer_id: payload.lecturerId || null,
        }
      });

      if (error || (data && data.error)) {
        const errObj = error || data;
        let msg = errObj.message || '';
        const code = errObj.error || errObj.code;

        if (code === 'EMAIL_ALREADY_EXISTS' || msg.includes('EMAIL_ALREADY_EXISTS')) {
          msg = 'Email sudah terdaftar.';
        } else if (code === 'LECTURER_ALREADY_LINKED' || msg.includes('LECTURER_ALREADY_LINKED')) {
          msg = 'Dosen tersebut sudah memiliki akun.';
        } else if (code === 'UNAUTHORIZED' || msg.includes('UNAUTHORIZED')) {
          msg = 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
        } else if (code === 'LECTURER_REQUIRED' || msg.includes('LECTURER_REQUIRED')) {
          msg = 'Dosen pengampu wajib dipilih.';
        } else {
          msg = msg || 'Akun gagal dibuat. Silakan coba lagi.';
        }
        throw new Error(msg);
      }

      return {
        email: data.email || cleanEmail,
        temporaryPassword: data.temporary_password || '',
        userId: data.user_id || '',
      };
    } catch (err: any) {
      console.error('Failed to create account:', err);
      throw err;
    }
  },

  async updateLecturerLoginEmail(lecturerId: string, email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    if (!lecturerId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Masukkan alamat email yang valid.');
    }
    const { data, error } = await supabase.functions.invoke('admin-create-account', {
      body: {
        action: 'UPDATE_LECTURER_EMAIL',
        lecturer_id: lecturerId,
        email: cleanEmail,
      },
    });
    const code = data?.code || data?.error;
    if (error || !data?.success) {
      const messageByCode: Record<string, string> = {
        SAME_EMAIL: 'Alamat email baru sama dengan email yang sudah terdaftar.',
        EMAIL_ALREADY_EXISTS: 'Email sudah digunakan akun lain.',
        ACCOUNT_NOT_FOUND: 'Akun dosen belum ditemukan.',
        AUTH_ACCOUNT_MISMATCH: 'Email akun Auth dan otorisasi tidak cocok. Hubungi pengelola sistem.',
        FORBIDDEN: 'Hanya Administrator yang boleh mengganti email login.',
        AUTH_EMAIL_UPDATE_FAILED: 'Tidak dapat memperbarui email login di Supabase Auth.',
        EMAIL_UPDATE_FAILED: 'Gagal menyimpan perubahan email login.',
        INVALID_EMAIL: 'Alamat email tidak valid.',
      };
      throw new Error(messageByCode[code] || data?.message || error?.message || 'Gagal mengubah email login dosen.');
    }
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

    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          email: cleanEmail,
        }
      });

      if (error || (data && data.error)) {
        const errObj = error || data;
        let msg = errObj.message || '';
        const code = errObj.error || errObj.code;

        if (code === 'USER_NOT_FOUND' || msg.includes('USER_NOT_FOUND')) {
          msg = `Akun untuk ${cleanEmail} tidak ditemukan di sistem.`;
        } else if (code === 'UNAUTHORIZED' || msg.includes('UNAUTHORIZED')) {
          msg = 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
        } else {
          msg = msg || 'Gagal mereset kata sandi. Silakan coba lagi.';
        }
        throw new Error(msg);
      }

      return {
        email: data.email || cleanEmail,
        temporaryPassword: data.temporary_password || '',
      };
    } catch (err: any) {
      console.error('Failed to reset password:', err);
      throw err;
    }
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

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const currentEmail = currentUser?.email?.trim().toLowerCase() || '';
    if (!isActive && currentEmail && cleanEmail === currentEmail) {
      throw new Error('Anda tidak dapat menonaktifkan akun yang sedang digunakan.');
    }

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

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const currentEmail = currentUser?.email?.trim().toLowerCase() || '';
    if (currentEmail && cleanEmail === currentEmail) {
      throw new Error('Anda tidak dapat menghapus otorisasi akun yang sedang digunakan.');
    }

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
