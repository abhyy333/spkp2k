import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CourseOffering, CourseOfferingLecturer } from '../types';
import { parseSupabaseError } from '../lib/utils';
import { verifyOwnerAdmin, assertOwnerAdmin } from '../lib/authGuard';

export interface LecturerAssignmentInput {
  lecturer_id: string;
  assignment_role: 'PENGAMPU' | 'KOORDINATOR' | string;
}

export const courseOfferingsService = {
  async getOfferings(filters?: {
    termId?: string;
    courseId?: string;
    kbkId?: string;
    semester?: number | string;
    classCode?: string;
    lecturerId?: string;
    confirmedStatus?: 'all' | 'confirmed' | 'unconfirmed';
    search?: string;
  }): Promise<CourseOffering[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const isOwner = await verifyOwnerAdmin();

      if (!isOwner) {
        // GUEST READ ONLY: Use guest_course_offerings, guest_course_offering_lecturers, guest_courses, guest_lecturers
        let guestQuery = supabase
          .from('guest_course_offerings')
          .select('*')
          .order('class_code', { ascending: true });

        if (filters?.termId && filters.termId !== 'all') {
          guestQuery = guestQuery.eq('academic_term_id', filters.termId);
        }
        if (filters?.courseId && filters.courseId !== 'all') {
          guestQuery = guestQuery.eq('course_id', filters.courseId);
        }
        if (filters?.classCode && filters.classCode !== 'all') {
          guestQuery = guestQuery.eq('class_code', filters.classCode);
        }
        if (filters?.confirmedStatus === 'confirmed') {
          guestQuery = guestQuery.eq('assignment_confirmed', true);
        } else if (filters?.confirmedStatus === 'unconfirmed') {
          guestQuery = guestQuery.eq('assignment_confirmed', false);
        }

        const [offeringsRes, colRes, coursesRes, lectRes] = await Promise.all([
          guestQuery,
          supabase.from('guest_course_offering_lecturers').select('*'),
          supabase.from('guest_courses').select('id, name, code, effective_sks, semester, course_type, activity_type, kbk_id'),
          supabase.from('guest_lecturers').select('id, name, lecturer_code'),
        ]);

        if (offeringsRes.error) {
          console.error('Error fetching guest offerings:', offeringsRes.error);
          throw new Error(parseSupabaseError(offeringsRes.error));
        }

        const courseMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c]));
        const lectMap = new Map((lectRes.data || []).map((l: any) => [l.id, l]));

        // Group lecturers by offering id
        const colByOffering = new Map<string, any[]>();
        (colRes.data || []).forEach((col: any) => {
          const arr = colByOffering.get(col.course_offering_id) || [];
          arr.push({
            ...col,
            lecturer: lectMap.get(col.lecturer_id) || null,
          });
          colByOffering.set(col.course_offering_id, arr);
        });

        let results: CourseOffering[] = (offeringsRes.data || []).map((row: any) => {
          const mappedLecturers = colByOffering.get(row.id) || [];
          return {
            ...row,
            class_name: row.class_code || row.class_name,
            course: courseMap.get(row.course_id) || null,
            lecturers: mappedLecturers,
            course_offering_lecturers: mappedLecturers,
          };
        });

        if (filters?.semester && filters.semester !== 'all') {
          results = results.filter((o) => o.course?.semester === Number(filters.semester));
        }
        if (filters?.kbkId && filters.kbkId !== 'all') {
          results = results.filter((o) => o.course?.kbk_id === filters.kbkId);
        }
        if (filters?.lecturerId && filters.lecturerId !== 'all') {
          results = results.filter((o) =>
            o.lecturers?.some((l) => l.lecturer_id === filters.lecturerId)
          );
        }
        if (filters?.search) {
          const s = filters.search.toLowerCase().trim();
          results = results.filter((o) => {
            const cName = o.course?.name?.toLowerCase() || '';
            const cCode = o.course?.code?.toLowerCase() || '';
            const cls = o.class_code?.toLowerCase() || '';
            const lNames = o.lecturers?.map((l) => l.lecturer?.name?.toLowerCase() || '').join(' ') || '';
            return cName.includes(s) || cCode.includes(s) || cls.includes(s) || lNames.includes(s);
          });
        }

        return results;
      }

      // OWNER ADMIN: Query full course_offerings table
      let query = supabase
        .from('course_offerings')
        .select(`
          *,
          academic_term:academic_term_id ( id, academic_year, semester_type, is_active ),
          course:course_id (
            id,
            name,
            code,
            effective_sks,
            semester,
            course_type,
            activity_type,
            kbk_id,
            kbk:kbk_id ( id, name, code )
          ),
          course_offering_lecturers (
            course_offering_id,
            lecturer_id,
            assignment_role,
            lecturer:lecturer_id ( id, name, lecturer_code, nip )
          )
        `)
        .order('class_code', { ascending: true });

      if (filters?.termId && filters.termId !== 'all') {
        query = query.eq('academic_term_id', filters.termId);
      }
      if (filters?.courseId && filters.courseId !== 'all') {
        query = query.eq('course_id', filters.courseId);
      }
      if (filters?.classCode && filters.classCode !== 'all') {
        query = query.eq('class_code', filters.classCode);
      }
      if (filters?.confirmedStatus === 'confirmed') {
        query = query.eq('assignment_confirmed', true);
      } else if (filters?.confirmedStatus === 'unconfirmed') {
        query = query.eq('assignment_confirmed', false);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching course offerings:', error);
        throw new Error(parseSupabaseError(error));
      }

      let results: CourseOffering[] = (data || []).map((row: any) => {
        const mappedLecturers = (row.course_offering_lecturers || []).map((col: any) => ({
          ...col,
          lecturer: col.lecturer
            ? {
                ...col.lecturer,
                code: col.lecturer.lecturer_code || '',
              }
            : null,
        }));

        return {
          ...row,
          class_name: row.class_code || row.class_name,
          lecturers: mappedLecturers,
          course_offering_lecturers: mappedLecturers,
        };
      });

      // In-memory filters for nested fields
      if (filters?.semester && filters.semester !== 'all') {
        results = results.filter((o) => o.course?.semester === Number(filters.semester));
      }
      if (filters?.kbkId && filters.kbkId !== 'all') {
        results = results.filter((o) => o.course?.kbk_id === filters.kbkId);
      }
      if (filters?.lecturerId && filters.lecturerId !== 'all') {
        results = results.filter((o) =>
          o.lecturers?.some((l) => l.lecturer_id === filters.lecturerId)
        );
      }
      if (filters?.search) {
        const s = filters.search.toLowerCase().trim();
        results = results.filter((o) => {
          const cName = o.course?.name?.toLowerCase() || '';
          const cCode = o.course?.code?.toLowerCase() || '';
          const cls = o.class_code?.toLowerCase() || '';
          const lNames = o.lecturers?.map((l) => l.lecturer?.name?.toLowerCase() || '').join(' ') || '';
          return cName.includes(s) || cCode.includes(s) || cls.includes(s) || lNames.includes(s);
        });
      }

      return results;
    } catch (err: any) {
      console.error('getOfferings error:', err);
      throw err;
    }
  },

  async getOfferingById(id: string): Promise<CourseOffering> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const { data, error } = await supabase
      .from('course_offerings')
      .select(`
        *,
        academic_term:academic_term_id ( id, academic_year, semester_type ),
        course:course_id (
          id,
          name,
          code,
          effective_sks,
          semester,
          course_type,
          activity_type,
          kbk_id,
          kbk:kbk_id ( id, name, code )
        ),
        course_offering_lecturers (
          course_offering_id,
          lecturer_id,
          assignment_role,
          lecturer:lecturer_id ( id, name, lecturer_code, nip )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw new Error(parseSupabaseError(error));

    return {
      ...data,
      class_name: data.class_code || data.class_name,
      lecturers: (data.course_offering_lecturers || []).map((col: any) => ({
        ...col,
        lecturer: col.lecturer
          ? {
              ...col.lecturer,
              code: col.lecturer.lecturer_code || '',
            }
          : null,
      })),
    };
  },

  async createOffering(
    data: {
      course_id: string;
      academic_term_id: string;
      class_code: string;
      expected_students?: number;
      required_room_type?: string;
      include_uts?: boolean;
      include_uas?: boolean;
      assignment_confirmed?: boolean;
    },
    lecturers: LecturerAssignmentInput[] = []
  ): Promise<CourseOffering> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (!data.course_id) throw new Error('Mata kuliah wajib dipilih.');
    if (!data.academic_term_id) throw new Error('Periode akademik wajib ditentukan.');
    if (!data.class_code || !data.class_code.trim()) throw new Error('Kode kelas wajib diisi (contoh: A, B, INTER).');

    const expected = Number(data.expected_students ?? 40);
    if (expected < 0) throw new Error('Jumlah mahasiswa tidak boleh negatif.');

    // Fetch course for effective_sks
    const { data: courseData } = await supabase
      .from('courses')
      .select('effective_sks')
      .eq('id', data.course_id)
      .single();

    const effSks = courseData?.effective_sks ?? 3;

    const payload: Record<string, any> = {
      course_id: data.course_id,
      academic_term_id: data.academic_term_id,
      class_code: data.class_code.trim().toUpperCase(),
      effective_sks: effSks,
      expected_students: expected,
      required_room_type: data.required_room_type || 'Ruang Kuliah Teori',
      include_uts: data.include_uts ?? true,
      include_uas: data.include_uas ?? true,
      assignment_confirmed: data.assignment_confirmed ?? false,
    };

    const { data: created, error } = await supabase
      .from('course_offerings')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error, 'class_code'));
    }

    // Insert lecturers if provided
    if (lecturers.length > 0) {
      const lecturerRows = lecturers.map((l) => ({
        course_offering_id: created.id,
        lecturer_id: l.lecturer_id,
        assignment_role: l.assignment_role || 'PENGAMPU',
      }));

      const { error: lErr } = await supabase
        .from('course_offering_lecturers')
        .insert(lecturerRows);

      if (lErr) console.warn('Lecturer assignment insert notice:', lErr);
    }

    return this.getOfferingById(created.id);
  },

  async updateOffering(
    id: string,
    data: {
      class_code?: string;
      expected_students?: number;
      required_room_type?: string;
      include_uts?: boolean;
      include_uas?: boolean;
      assignment_confirmed?: boolean;
    },
    lecturers?: LecturerAssignmentInput[]
  ): Promise<CourseOffering> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const payload: Record<string, any> = {};
    if (data.class_code !== undefined) payload.class_code = data.class_code.trim().toUpperCase();
    if (data.expected_students !== undefined) {
      const expected = Number(data.expected_students);
      if (expected < 0) throw new Error('Jumlah mahasiswa tidak boleh negatif.');
      payload.expected_students = expected;
    }
    if (data.required_room_type !== undefined) payload.required_room_type = data.required_room_type;
    if (data.include_uts !== undefined) payload.include_uts = data.include_uts;
    if (data.include_uas !== undefined) payload.include_uas = data.include_uas;
    if (data.assignment_confirmed !== undefined) payload.assignment_confirmed = data.assignment_confirmed;

    const { error } = await supabase
      .from('course_offerings')
      .update(payload)
      .eq('id', id);

    if (error) {
      throw new Error(parseSupabaseError(error, 'class_code'));
    }

    // Update lecturers if provided
    if (lecturers !== undefined) {
      // Delete existing assignments
      await supabase.from('course_offering_lecturers').delete().eq('course_offering_id', id);

      if (lecturers.length > 0) {
        const lecturerRows = lecturers.map((l) => ({
          course_offering_id: id,
          lecturer_id: l.lecturer_id,
          assignment_role: l.assignment_role || 'PENGAMPU',
        }));
        await supabase.from('course_offering_lecturers').insert(lecturerRows);
      }
    }

    return this.getOfferingById(id);
  },

  async confirmOfferingAssignment(id: string, confirmed = true): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('course_offerings')
      .update({ assignment_confirmed: confirmed })
      .eq('id', id);

    if (error) throw new Error(parseSupabaseError(error));
  },

  async deleteOffering(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    // Delete related lecturers first to be clean
    await supabase.from('course_offering_lecturers').delete().eq('course_offering_id', id);
    // Delete class_assignments if any
    await supabase.from('class_assignments').delete().eq('course_offering_id', id);

    const { error } = await supabase.from('course_offerings').delete().eq('id', id);
    if (error) {
      throw new Error(parseSupabaseError(error));
    }
  },

  async getOfferingsStats(termId?: string) {
    if (!isSupabaseConfigured()) {
      return { total: 0, confirmed: 0, needsReview: 0, totalStudents: 0 };
    }

    try {
      let query = supabase
        .from('course_offerings')
        .select('id, expected_students, assignment_confirmed');

      if (termId && termId !== 'all') {
        query = query.eq('academic_term_id', termId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const total = data?.length || 0;
      const confirmed = data?.filter((o: any) => o.assignment_confirmed).length || 0;
      const needsReview = total - confirmed;
      const totalStudents = data?.reduce((acc: number, o: any) => acc + (o.expected_students || 0), 0) || 0;

      return { total, confirmed, needsReview, totalStudents };
    } catch {
      return { total: 0, confirmed: 0, needsReview: 0, totalStudents: 0 };
    }
  },
};
