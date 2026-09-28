import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Student } from '../types';
import { parseSupabaseError } from '../lib/utils';

export const studentsService = {
  async getStudents(filters?: {
    search?: string;
    batchYear?: number | string;
    kbkId?: string;
    status?: string;
  }): Promise<Student[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    let query = supabase
      .from('students')
      .select(`
        *,
        kbk:kbk_id ( id, name, code ),
        profile:profile_id ( id, role )
      `)
      .order('cohort', { ascending: false, nullsFirst: false })
      .order('nim', { ascending: true });

    if (filters?.batchYear && filters.batchYear !== 'all') {
      query = query.eq('cohort', Number(filters.batchYear));
    }
    if (filters?.kbkId && filters.kbkId !== 'all') {
      query = query.eq('kbk_id', filters.kbkId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching students:', error);
      throw new Error(parseSupabaseError(error));
    }

    // Safely attempt to fetch class assignments summary without crashing if permissions are restricted
    const assignmentsMap: Record<string, { count: number; totalSks: number }> = {};
    try {
      const { data: assignments, error: aErr } = await supabase
        .from('class_assignments')
        .select(`
          student_id,
          course_offering:course_offering_id (
            course:course_id ( effective_sks )
          )
        `);
      if (!aErr && assignments) {
        assignments.forEach((a: any) => {
          if (!a?.student_id) return;
          if (!assignmentsMap[a.student_id]) {
            assignmentsMap[a.student_id] = { count: 0, totalSks: 0 };
          }
          assignmentsMap[a.student_id].count += 1;
          assignmentsMap[a.student_id].totalSks += (a.course_offering?.course?.effective_sks || 0);
        });
      }
    } catch {
      // Permission restricted or table not available to current role
    }

    let results: Student[] = (data || []).map((row: any) => {
      const studentName = row.full_name || row.name || 'Mahasiswa';
      const cohortVal = row.cohort ?? row.batch_year ?? 2024;
      const assignInfo = assignmentsMap[row.id] || { count: 0, totalSks: 0 };

      return {
        ...row,
        name: studentName,
        full_name: studentName,
        batch_year: cohortVal,
        cohort: cohortVal,
        status: row.profile_id ? 'Aktif' : 'Terdaftar',
        class_assignments_count: assignInfo.count,
        total_sks: assignInfo.totalSks,
      };
    });

    if (filters?.search) {
      const s = filters.search.toLowerCase().trim();
      results = results.filter(
        (st) =>
          (st.full_name && st.full_name.toLowerCase().includes(s)) ||
          (st.name && st.name.toLowerCase().includes(s)) ||
          (st.nim && st.nim.toLowerCase().includes(s))
      );
    }

    return results;
  },

  async getStudentById(id: string): Promise<{
    student: Student;
    classAssignments: any[];
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const { data: student, error: sErr } = await supabase
      .from('students')
      .select(`
        *,
        kbk:kbk_id ( id, name, code ),
        profile:profile_id ( id, role )
      `)
      .eq('id', id)
      .single();

    if (sErr) throw new Error(parseSupabaseError(sErr));

    // strictly NO KRS! class_assignments only!
    const { data: assignments, error: aErr } = await supabase
      .from('class_assignments')
      .select(`
        id,
        locked,
        assignment_source,
        course_offering:course_offering_id (
          id,
          class_code,
          course:course_id ( id, name, code, effective_sks, semester )
        )
      `)
      .eq('student_id', id);

    if (aErr) console.warn('Assignments error:', aErr);

    const studentName = student.full_name || student.name;
    const cohortVal = student.cohort ?? student.batch_year ?? 2024;

    return {
      student: {
        ...student,
        name: studentName,
        full_name: studentName,
        batch_year: cohortVal,
        cohort: cohortVal,
      },
      classAssignments: (assignments || []).map((a: any) => ({
        ...a,
        course_offering: {
          ...a.course_offering,
          class_name: a.course_offering?.class_code,
        },
      })),
    };
  },

  async createStudent(data: {
    nim: string;
    full_name: string;
    cohort: number;
    kbk_id?: string | null;
  }): Promise<Student> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (!data.nim || !data.nim.trim()) {
      throw new Error('NIM wajib diisi.');
    }
    if (!data.full_name || !data.full_name.trim()) {
      throw new Error('Nama lengkap mahasiswa wajib diisi.');
    }
    if (!data.cohort || data.cohort < 2000 || data.cohort > 2100) {
      throw new Error('Tahun angkatan tidak valid.');
    }

    const payload: Record<string, any> = {
      nim: data.nim.trim().toUpperCase(),
      full_name: data.full_name.trim(),
      cohort: Number(data.cohort),
      kbk_id: data.kbk_id || null, // KBK boleh kosong untuk mahasiswa semester awal
    };

    const { data: created, error } = await supabase
      .from('students')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error, 'student_nim'));
    }

    return created;
  },

  async updateStudent(
    id: string,
    data: {
      nim: string;
      full_name: string;
      cohort: number;
      kbk_id?: string | null;
    }
  ): Promise<Student> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (!data.nim || !data.nim.trim()) {
      throw new Error('NIM wajib diisi.');
    }
    if (!data.full_name || !data.full_name.trim()) {
      throw new Error('Nama lengkap mahasiswa wajib diisi.');
    }

    const payload: Record<string, any> = {
      nim: data.nim.trim().toUpperCase(),
      full_name: data.full_name.trim(),
      cohort: Number(data.cohort),
      kbk_id: data.kbk_id || null,
    };

    const { data: updated, error } = await supabase
      .from('students')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error, 'student_nim'));
    }

    return updated;
  },

  async deleteStudent(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) {
      throw new Error(parseSupabaseError(error));
    }
  },

  async getStudentByProfileId(profileId: string): Promise<Student | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        kbk:kbk_id ( id, name, code )
      `)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) {
      console.warn('Student by profileId lookup error:', error);
      return null;
    }

    return data
      ? {
          ...data,
          name: data.full_name || data.name,
          full_name: data.full_name || data.name,
          cohort: data.cohort ?? data.batch_year ?? 2024,
          batch_year: data.cohort ?? data.batch_year ?? 2024,
        }
      : null;
  },

  async getStats() {
    if (!isSupabaseConfigured()) {
      return { total: 0, activeBatches: 0, activeStudents: 0 };
    }

    try {
      const { data, error } = await supabase.from('students').select('id, cohort, profile_id');
      if (error) throw error;

      const total = data?.length || 0;
      const batches = new Set(data?.map((s: any) => s.cohort).filter(Boolean)).size;
      const activeStudents = total;

      return {
        total,
        activeBatches: batches,
        activeStudents,
      };
    } catch (err) {
      console.error('Failed to get student stats:', err);
      return { total: 0, activeBatches: 0, activeStudents: 0 };
    }
  },
};
