import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Lecturer, LecturerAvailability, LecturerCourseAssignment } from '../types';
import { parseSupabaseError, normalizeNameForComparison } from '../lib/utils';
import { verifyOwnerAdmin, assertOwnerAdmin } from '../lib/authGuard';

export const lecturersService = {
  async getLecturers(filters?: { search?: string; kbkId?: string; status?: string }): Promise<Lecturer[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const isOwner = await verifyOwnerAdmin();

    if (!isOwner) {
      // GUEST READ ONLY: Use guest_lecturers view with safe fields only!
      // NO email, phone, NIP, profile_id, private records exposed
      const [lectRes, kbkRes] = await Promise.all([
        supabase.from('guest_lecturers').select('*').order('name', { ascending: true }),
        supabase.from('guest_kbk').select('id, name, code'),
      ]);

      if (lectRes.error) {
        console.error('Error fetching guest lecturers:', lectRes.error);
        throw new Error(parseSupabaseError(lectRes.error));
      }

      const kbkMap = new Map((kbkRes.data || []).map((k: any) => [k.id, k]));

      let results: Lecturer[] = (lectRes.data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        code: row.lecturer_code || '',
        lecturer_code: row.lecturer_code || '',
        kbk_id: row.kbk_id,
        kbk: kbkMap.get(row.kbk_id) || null,
        expertise: row.expertise,
        status: row.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
        offerings_count: 0,
        total_sks: 0,
      }));

      if (filters?.kbkId && filters.kbkId !== 'all') {
        results = results.filter((l) => l.kbk_id === filters.kbkId);
      }

      if (filters?.status && filters.status !== 'all') {
        results = results.filter((l) => l.status === filters.status);
      }

      if (filters?.search) {
        const s = filters.search.toLowerCase().trim();
        results = results.filter(
          (l) =>
            (l.name && l.name.toLowerCase().includes(s)) ||
            (l.lecturer_code && l.lecturer_code.toLowerCase().includes(s))
        );
      }

      return results;
    }

    // OWNER ADMIN: Query full lecturers table
    let query = supabase
      .from('lecturers')
      .select(`
        *,
        kbk:kbk_id ( id, name, code ),
        profile:profile_id ( id, role ),
        course_offering_lecturers (
          course_offering_id,
          lecturer_id,
          assignment_role,
          course_offering:course_offering_id (
            id,
            class_code,
            course:course_id ( id, name, code, effective_sks, semester )
          )
        )
      `)
      .order('name', { ascending: true });

    if (filters?.kbkId && filters.kbkId !== 'all') {
      query = query.eq('kbk_id', filters.kbkId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching lecturers:', error);
      throw new Error(parseSupabaseError(error));
    }

    let results: Lecturer[] = (data || []).map((row: any) => {
      const offerings = row.course_offering_lecturers || [];
      const totalSks = offerings.reduce((acc: number, item: any) => {
        return acc + (item.course_offering?.course?.effective_sks || 0);
      }, 0);

      const codeVal = row.lecturer_code || row.code || '';

      return {
        ...row,
        code: codeVal,
        lecturer_code: codeVal,
        status: row.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
        offerings_count: offerings.length,
        total_sks: totalSks,
      };
    });

    if (filters?.status && filters.status !== 'all') {
      results = results.filter((l) => l.status === filters.status);
    }

    if (filters?.search) {
      const s = filters.search.toLowerCase().trim();
      results = results.filter(
        (l) =>
          (l.name && l.name.toLowerCase().includes(s)) ||
          (l.lecturer_code && l.lecturer_code.toLowerCase().includes(s)) ||
          (l.nip && l.nip.includes(s))
      );
    }

    return results;
  },

  async getLecturerById(id: string): Promise<{
    lecturer: Lecturer;
    assignedOfferings: any[];
    availability: LecturerAvailability[];
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const { data: lecturer, error: lErr } = await supabase
      .from('lecturers')
      .select(`
        *,
        kbk:kbk_id ( id, name, code ),
        profile:profile_id ( id, role )
      `)
      .eq('id', id)
      .single();

    if (lErr) throw new Error(parseSupabaseError(lErr));

    const { data: assignments, error: aErr } = await supabase
      .from('course_offering_lecturers')
      .select(`
        course_offering_id,
        lecturer_id,
        assignment_role,
        course_offering:course_offering_id (
          id,
          class_code,
          expected_students,
          academic_term:academic_term_id ( id, academic_year, semester_type ),
          course:course_id ( id, name, code, effective_sks, semester )
        )
      `)
      .eq('lecturer_id', id);

    if (aErr) console.warn('Assignments error:', aErr);

    const { data: availability, error: avErr } = await supabase
      .from('lecturer_availability')
      .select('*')
      .eq('lecturer_id', id)
      .order('day_of_week', { ascending: true });

    if (avErr) console.warn('Availability error:', avErr);

    return {
      lecturer: {
        ...lecturer,
        code: lecturer.lecturer_code || lecturer.code,
        lecturer_code: lecturer.lecturer_code || lecturer.code,
      },
      assignedOfferings: assignments || [],
      availability: availability || [],
    };
  },

  async checkSimilarLecturerNames(name: string, excludeId?: string): Promise<Lecturer[]> {
    if (!name || !name.trim()) return [];
    try {
      const all = await this.getLecturers();
      const targetNormalized = normalizeNameForComparison(name);
      return all.filter((l) => {
        if (excludeId && l.id === excludeId) return false;
        const norm = normalizeNameForComparison(l.name);
        return norm === targetNormalized || (norm.length > 5 && targetNormalized.includes(norm));
      });
    } catch {
      return [];
    }
  },

  async createLecturer(data: {
    name: string;
    lecturer_code?: string;
    kbk_id?: string;
    nip?: string;
    email?: string;
    phone?: string;
  }): Promise<Lecturer> {
    await assertOwnerAdmin('menambah dosen');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (!data.name || !data.name.trim()) {
      throw new Error('Nama dosen wajib diisi.');
    }

    const payload: Record<string, any> = {
      name: data.name.trim(),
      lecturer_code: data.lecturer_code?.trim().toUpperCase() || null,
      kbk_id: data.kbk_id || null,
      nip: data.nip?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
    };

    const { data: created, error } = await supabase
      .from('lecturers')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error, 'lecturer_code'));
    }

    return created;
  },

  async updateLecturer(
    id: string,
    data: {
      name: string;
      lecturer_code?: string;
      kbk_id?: string;
      nip?: string;
      email?: string;
      phone?: string;
    }
  ): Promise<Lecturer> {
    await assertOwnerAdmin('mengubah data dosen');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (!data.name || !data.name.trim()) {
      throw new Error('Nama dosen wajib diisi.');
    }

    const payload: Record<string, any> = {
      name: data.name.trim(),
      lecturer_code: data.lecturer_code?.trim().toUpperCase() || null,
      kbk_id: data.kbk_id || null,
      nip: data.nip?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
    };

    const { data: updated, error } = await supabase
      .from('lecturers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error, 'lecturer_code'));
    }

    return updated;
  },

  /**
   * Update status dosen (Aktif / Nonaktif)
   */
  async updateLecturerStatus(id: string, status: 'Aktif' | 'Nonaktif'): Promise<Lecturer> {
    await assertOwnerAdmin('mengubah status aktif dosen');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const { data, error } = await supabase
      .from('lecturers')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating lecturer status:', error);
      throw new Error(parseSupabaseError(error));
    }

    return data;
  },

  /**
   * Cek dependensi akademik dosen (course_offering_lecturers, lecturer_availability)
   */
  async checkLecturerDependencies(id: string): Promise<{ inUse: boolean; offeringCount: number; availabilityCount: number }> {
    if (!isSupabaseConfigured()) {
      return { inUse: false, offeringCount: 0, availabilityCount: 0 };
    }

    try {
      const [offeringRes, availRes] = await Promise.all([
        supabase
          .from('course_offering_lecturers')
          .select('course_offering_id', { count: 'exact', head: true })
          .eq('lecturer_id', id),
        supabase
          .from('lecturer_availability')
          .select('id', { count: 'exact', head: true })
          .eq('lecturer_id', id),
      ]);

      const offeringCount = offeringRes.count || 0;
      const availabilityCount = availRes.count || 0;
      const inUse = offeringCount > 0 || availabilityCount > 0;

      return { inUse, offeringCount, availabilityCount };
    } catch (e) {
      console.error('Error checking lecturer dependencies:', e);
      return { inUse: false, offeringCount: 0, availabilityCount: 0 };
    }
  },

  async deleteLecturer(id: string): Promise<void> {
    await assertOwnerAdmin('menghapus dosen');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    // 8. HARD DELETE DOSEN: check dependency first
    const { inUse } = await this.checkLecturerDependencies(id);
    if (inUse) {
      throw new Error('Dosen tidak dapat dihapus karena sudah digunakan pada data akademik. Anda dapat menonaktifkan dosen ini.');
    }

    const { error } = await supabase.from('lecturers').delete().eq('id', id);
    if (error) {
      console.error('Technical error delete lecturer:', error);
      throw new Error(parseSupabaseError(error, 'lecturer_delete'));
    }
  },

  async getLecturerByProfileId(profileId: string): Promise<Lecturer | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('lecturers')
      .select(`
        *,
        kbk:kbk_id ( id, name, code )
      `)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) {
      console.warn('Lecturer by profileId lookup error:', error);
      return null;
    }

    return data;
  },

  /**
   * Mengambil data dosen yang terhubung dengan akun login pengguna (via profile_id, authorized_accounts, atau email)
   */
  async getLecturerForUser(userId: string, email?: string): Promise<Lecturer | null> {
    if (!isSupabaseConfigured()) return null;

    // 1. Cek langsung lecturers.profile_id
    if (userId) {
      const { data: byProfile } = await supabase
        .from('lecturers')
        .select('*, kbk:kbk_id ( id, name, code )')
        .eq('profile_id', userId)
        .maybeSingle();

      if (byProfile) return byProfile;
    }

    // 2. Cek authorized_accounts (lecturer_id)
    if (userId || email) {
      try {
        let authQuery = supabase
          .from('authorized_accounts')
          .select('lecturer_id')
          .not('lecturer_id', 'is', null);

        if (userId && email) {
          authQuery = authQuery.or(`user_id.eq.${userId},email.eq.${email.trim().toLowerCase()}`);
        } else if (userId) {
          authQuery = authQuery.eq('user_id', userId);
        } else if (email) {
          authQuery = authQuery.eq('email', email.trim().toLowerCase());
        }

        const { data: authAcc } = await authQuery.maybeSingle();
        if (authAcc?.lecturer_id) {
          const { data: byAuthAcc } = await supabase
            .from('lecturers')
            .select('*, kbk:kbk_id ( id, name, code )')
            .eq('id', authAcc.lecturer_id)
            .maybeSingle();

          if (byAuthAcc) {
            // Tautkan profile_id agar lookup berikutnya lebih cepat
            if (userId && !byAuthAcc.profile_id) {
              supabase.from('lecturers').update({ profile_id: userId }).eq('id', byAuthAcc.id).then();
            }
            return byAuthAcc;
          }
        }
      } catch (e) {
        console.warn('authorized_accounts lookup notice:', e);
      }
    }

    // 3. Cek pencocokan lecturers.email
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const { data: byEmail } = await supabase
        .from('lecturers')
        .select('*, kbk:kbk_id ( id, name, code )')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (byEmail) {
        if (userId && !byEmail.profile_id) {
          supabase.from('lecturers').update({ profile_id: userId }).eq('id', byEmail.id).then();
        }
        return byEmail;
      }
    }

    return null;
  },

  async getLecturerByEmail(email: string): Promise<Lecturer | null> {
    if (!isSupabaseConfigured() || !email) return null;
    return this.getLecturerForUser('', email);
  },

  /**
   * Update profil mandiri oleh dosen (hanya field terbatas yang diizinkan)
   */
  async updateLecturerSelfProfile(
    lecturerId: string,
    data: {
      phone?: string;
      expertise?: string;
      room_office?: string;
      consultation_hours?: string;
    }
  ): Promise<Lecturer> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const payload: Record<string, any> = {};
    if (data.phone !== undefined) payload.phone = data.phone?.trim() || null;
    if (data.expertise !== undefined) payload.expertise = data.expertise?.trim() || null;
    if (data.room_office !== undefined) payload.room_office = data.room_office?.trim() || null;
    if (data.consultation_hours !== undefined) payload.consultation_hours = data.consultation_hours?.trim() || null;

    const { data: updated, error } = await supabase
      .from('lecturers')
      .update(payload)
      .eq('id', lecturerId)
      .select('*, kbk:kbk_id ( id, name, code )')
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error));
    }

    return updated;
  },

  async getStats() {
    if (!isSupabaseConfigured()) {
      return { total: 0, active: 0, highLoad: 0, available: 0 };
    }

    try {
      const isOwner = await verifyOwnerAdmin();
      const table = isOwner ? 'lecturers' : 'guest_lecturers';

      let { data: lecturers, error } = await supabase
        .from(table)
        .select('id, status');

      if (error) {
        const guestRes = await supabase
          .from('guest_lecturers')
          .select('id, status');
        lecturers = guestRes.data || [];
      }

      const list = lecturers || [];
      const total = list.length;
      const active = list.filter((l) => (l.status || '').toLowerCase() === 'aktif').length;
      const highLoad = 0;
      const available = active;

      return { total, active, highLoad, available };
    } catch (err) {
      console.warn('Failed to get lecturer stats:', err);
      return { total: 0, active: 0, highLoad: 0, available: 0 };
    }
  },

  /**
   * Mengambil data penugasan dosen pengampu mata kuliah secara real-time
   * dari view lecturer_course_assignments
   */
  async getLecturerCourseAssignments(filters?: {
    semester?: string | number;
    semesterType?: string;
    academicYear?: string;
    search?: string;
  }): Promise<LecturerCourseAssignment[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      let query = supabase
        .from('lecturer_course_assignments')
        .select('*')
        .order('semester', { ascending: true })
        .order('course_name', { ascending: true })
        .order('class_code', { ascending: true })
        .order('lecturer_name', { ascending: true });

      if (filters?.semester && filters.semester !== 'all') {
        query = query.eq('semester', Number(filters.semester));
      }
      if (filters?.academicYear && filters.academicYear !== 'all') {
        query = query.eq('academic_year', filters.academicYear);
      }
      if (filters?.semesterType && filters.semesterType !== 'all') {
        query = query.ilike('semester_type', `%${filters.semesterType}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Query lecturer_course_assignments view notice, using joined tables fallback:', error);
        return await this.fallbackGetLecturerCourseAssignments(filters);
      }

      let results = (data || []) as LecturerCourseAssignment[];

      if (filters?.search && filters.search.trim()) {
        const s = filters.search.toLowerCase().trim();
        results = results.filter((item) => {
          const cName = (item.course_name || '').toLowerCase();
          const cCode = (item.course_code || '').toLowerCase();
          const lCode = (item.lecturer_code || '').toLowerCase();
          const lName = (item.lecturer_name || '').toLowerCase();
          return cName.includes(s) || cCode.includes(s) || lCode.includes(s) || lName.includes(s);
        });
      }

      return results;
    } catch (err) {
      console.warn('Exception fetching lecturer_course_assignments view:', err);
      return await this.fallbackGetLecturerCourseAssignments(filters);
    }
  },

  /**
   * Fallback real-time query apabila view belum dibuat atau perlu resolusi langsung
   */
  async fallbackGetLecturerCourseAssignments(filters?: {
    semester?: string | number;
    semesterType?: string;
    academicYear?: string;
    search?: string;
  }): Promise<LecturerCourseAssignment[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      const { data, error } = await supabase
        .from('course_offering_lecturers')
        .select(`
          course_offering_id,
          lecturer_id,
          assignment_role,
          course_offering:course_offering_id (
            id,
            class_code,
            academic_term:academic_term_id ( id, academic_year, semester_type ),
            course:course_id ( id, code, name, semester, effective_sks )
          ),
          lecturer:lecturer_id ( id, name, lecturer_code, nip )
        `);

      if (error) {
        console.error('Fallback query error:', error);
        return [];
      }

      let rows: LecturerCourseAssignment[] = (data || []).map((row: any) => ({
        semester: row.course_offering?.course?.semester || 1,
        course_code: row.course_offering?.course?.code || '',
        course_name: row.course_offering?.course?.name || '',
        class_code: row.course_offering?.class_code || '',
        effective_sks: row.course_offering?.course?.effective_sks || 0,
        lecturer_code: row.lecturer?.lecturer_code || null,
        lecturer_name: row.lecturer?.name || '',
        nip: row.lecturer?.nip || null,
        assignment_role: row.assignment_role || 'PENGAMPU',
        academic_year: row.course_offering?.academic_term?.academic_year || null,
        semester_type: row.course_offering?.academic_term?.semester_type || null,
      }));

      // Sort: semester ASC, course_name ASC, class_code ASC, lecturer_name ASC
      rows.sort((a, b) => {
        if (a.semester !== b.semester) return a.semester - b.semester;
        const cCmp = (a.course_name || '').localeCompare(b.course_name || '');
        if (cCmp !== 0) return cCmp;
        const clCmp = (a.class_code || '').localeCompare(b.class_code || '');
        if (clCmp !== 0) return clCmp;
        return (a.lecturer_name || '').localeCompare(b.lecturer_name || '');
      });

      if (filters?.semester && filters.semester !== 'all') {
        rows = rows.filter((r) => r.semester === Number(filters.semester));
      }
      if (filters?.academicYear && filters.academicYear !== 'all') {
        rows = rows.filter((r) => r.academic_year === filters.academicYear);
      }
      if (filters?.semesterType && filters.semesterType !== 'all') {
        rows = rows.filter((r) =>
          (r.semester_type || '').toLowerCase().includes(String(filters.semesterType).toLowerCase())
        );
      }
      if (filters?.search && filters.search.trim()) {
        const s = filters.search.toLowerCase().trim();
        rows = rows.filter((item) => {
          const cName = (item.course_name || '').toLowerCase();
          const cCode = (item.course_code || '').toLowerCase();
          const lCode = (item.lecturer_code || '').toLowerCase();
          const lName = (item.lecturer_name || '').toLowerCase();
          return cName.includes(s) || cCode.includes(s) || lCode.includes(s) || lName.includes(s);
        });
      }

      return rows;
    } catch (e) {
      console.error('Failed fallbackGetLecturerCourseAssignments:', e);
      return [];
    }
  },

  async getAcademicYears(): Promise<string[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data } = await supabase
        .from('academic_terms')
        .select('academic_year')
        .order('academic_year', { ascending: false });
      if (data && data.length > 0) {
        const set = new Set<string>();
        data.forEach((d: any) => {
          if (d.academic_year) set.add(d.academic_year);
        });
        return Array.from(set);
      }
      return [];
    } catch {
      return [];
    }
  },
};
