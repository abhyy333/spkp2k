import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthorizedAccount, Lecturer } from '../types';
import { parseSupabaseError } from '../lib/utils';
import { OWNER_EMAIL } from '../lib/authGuard';

export const authorizedAccountsService = {
  /**
   * Memeriksa apakah suatu alamat email telah diotorisasi untuk registrasi
   */
  async checkAuthorization(email: string): Promise<{
    authorized: boolean;
    role?: 'ADMIN' | 'DOSEN';
    isActive?: boolean;
    message?: string;
  }> {
    if (!isSupabaseConfigured()) {
      return { authorized: true, role: 'ADMIN' };
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === OWNER_EMAIL.toLowerCase()) {
      return { authorized: true, role: 'ADMIN', isActive: true };
    }

    try {
      const { data: rpcAllowed, error: rpcErr } = await supabase.rpc('can_register_authorized_account', {
        p_email: cleanEmail,
      });

      if (rpcErr || !rpcAllowed) {
        return {
          authorized: false,
          message: 'Email belum diotorisasi.',
        };
      }

      const { data, error } = await supabase
        .from('authorized_accounts')
        .select('email, role, is_active')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error || !data || !data.is_active) {
        return {
          authorized: false,
          message: 'Email belum diotorisasi.',
        };
      }

      return { authorized: true, role: data.role as 'ADMIN' | 'DOSEN', isActive: true };
    } catch (err: any) {
      console.warn('Exception during authorization check:', err);
      return {
        authorized: false,
        message: 'Email belum diotorisasi.',
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
   * Menambahkan email baru sebagai ADMIN
   */
  async addAdmin(email: string): Promise<AuthorizedAccount> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Format alamat email tidak valid.');
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('authorized_accounts')
      .select('email, role, is_active')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      if (existing.role === 'ADMIN') {
        if (!existing.is_active) {
          // Reactivate if inactive
          const { data: updated, error: updateErr } = await supabase
            .from('authorized_accounts')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('email', cleanEmail)
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
            .single();
          if (updateErr) throw new Error(parseSupabaseError(updateErr));
          return updated;
        }
        throw new Error(`Email ${cleanEmail} sudah terdaftar sebagai Administrator.`);
      } else {
        throw new Error(`Email ${cleanEmail} sudah terdaftar dengan role ${existing.role}. Ubah atau hapus otorisasi sebelumnya terlebih dahulu.`);
      }
    }

    const payload = {
      email: cleanEmail,
      role: 'ADMIN',
      lecturer_id: null,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('authorized_accounts')
      .insert(payload)
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
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error));
    }

    return data;
  },

  /**
   * Mendaftarkan akun email untuk Dosen tertentu
   */
  async addLecturerAccount(email: string, lecturerId: string): Promise<AuthorizedAccount> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Format alamat email tidak valid.');
    }

    if (!lecturerId) {
      throw new Error('Dosen wajib dipilih.');
    }

    // Rule: Satu Dosen Satu Akun!
    const { data: existingLecturerAccount } = await supabase
      .from('authorized_accounts')
      .select('email, role, is_active')
      .eq('lecturer_id', lecturerId)
      .maybeSingle();

    if (existingLecturerAccount) {
      throw new Error(`Dosen ini sudah terhubung dengan akun otorisasi (${existingLecturerAccount.email}).`);
    }

    // Check if email already used by another authorization
    const { data: existingEmailAccount } = await supabase
      .from('authorized_accounts')
      .select('email, role')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingEmailAccount) {
      throw new Error(`Email ${cleanEmail} sudah terdaftar sebagai ${existingEmailAccount.role}.`);
    }

    const payload = {
      email: cleanEmail,
      role: 'DOSEN',
      lecturer_id: lecturerId,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('authorized_accounts')
      .insert(payload)
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
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error));
    }

    return data;
  },

  /**
   * Mengubah status aktif / nonaktif akun otorisasi berdasarkan email (Primary Key)
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
   * Menghapus record otorisasi berdasarkan email (Primary Key)
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
