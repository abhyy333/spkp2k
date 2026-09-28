import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Course, CourseOffering, CourseType } from '../types';
import { parseSupabaseError } from '../lib/utils';
import { verifyOwnerAdmin, assertOwnerAdmin } from '../lib/authGuard';

export const coursesService = {
  async getCourses(filters?: {
    search?: string;
    semester?: number | string;
    category?: string;
    courseType?: string;
    kbkId?: string;
    curriculumId?: string;
    status?: string;
  }): Promise<Course[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const isOwner = await verifyOwnerAdmin();

    if (!isOwner) {
      // GUEST READ ONLY: Use guest_courses view with guest_kbk and guest_curriculums
      let guestQuery = supabase
        .from('guest_courses')
        .select('*')
        .order('semester', { ascending: true })
        .order('code', { ascending: true, nullsFirst: false });

      if (filters?.semester && filters.semester !== 'all') {
        guestQuery = guestQuery.eq('semester', Number(filters.semester));
      }
      const targetType =
        filters?.courseType && filters.courseType !== 'all'
          ? filters.courseType
          : filters?.category && filters.category !== 'all'
          ? filters.category.toUpperCase()
          : null;

      if (targetType) {
        guestQuery = guestQuery.eq('course_type', targetType);
      }
      if (filters?.kbkId && filters.kbkId !== 'all') {
        guestQuery = guestQuery.eq('kbk_id', filters.kbkId);
      }
      if (filters?.curriculumId && filters.curriculumId !== 'all') {
        guestQuery = guestQuery.eq('curriculum_id', filters.curriculumId);
      }

      const [coursesRes, kbkRes, currRes] = await Promise.all([
        guestQuery,
        supabase.from('guest_kbk').select('id, name, code'),
        supabase.from('guest_curriculums').select('id, name, year'),
      ]);

      if (coursesRes.error) {
        console.error('Error fetching guest courses:', coursesRes.error);
        throw new Error(parseSupabaseError(coursesRes.error));
      }

      const kbkMap = new Map((kbkRes.data || []).map((k: any) => [k.id, k]));
      const currMap = new Map((currRes.data || []).map((c: any) => [c.id, c]));

      let results: Course[] = (coursesRes.data || []).map((row: any) => ({
        ...row,
        effective_sks: row.effective_sks ?? row.sks ?? 0,
        sks: row.effective_sks ?? row.sks ?? 0,
        course_type: row.course_type || 'WAJIB',
        category: row.course_type === 'WAJIB' ? 'Wajib' : 'Pilihan',
        offerings_count: 0,
        kbk: kbkMap.get(row.kbk_id) || null,
        curriculum: currMap.get(row.curriculum_id) || null,
      }));

      if (filters?.search) {
        const s = filters.search.toLowerCase().trim();
        results = results.filter(
          (c) =>
            (c.name && c.name.toLowerCase().includes(s)) ||
            (c.code && c.code.toLowerCase().includes(s))
        );
      }

      if (filters?.status && filters.status !== 'all') {
        if (filters.status === 'schedulable') {
          results = results.filter((c) => c.is_schedulable && c.activity_type !== 'KKN');
        } else if (filters.status === 'unschedulable') {
          results = results.filter((c) => !c.is_schedulable || c.activity_type === 'KKN');
        }
      }

      return results;
    }

    // OWNER ADMIN: Query full courses table
    let query = supabase
      .from('courses')
      .select(`
        *,
        kbk:kbk_id ( id, name, code ),
        curriculum:curriculum_id ( id, name, year ),
        course_offerings ( id )
      `)
      .order('semester', { ascending: true })
      .order('code', { ascending: true, nullsFirst: false });

    if (filters?.semester && filters.semester !== 'all') {
      query = query.eq('semester', Number(filters.semester));
    }
    const targetType =
      filters?.courseType && filters.courseType !== 'all'
        ? filters.courseType
        : filters?.category && filters.category !== 'all'
        ? filters.category.toUpperCase()
        : null;

    if (targetType) {
      query = query.eq('course_type', targetType);
    }
    if (filters?.kbkId && filters.kbkId !== 'all') {
      query = query.eq('kbk_id', filters.kbkId);
    }
    if (filters?.curriculumId && filters.curriculumId !== 'all') {
      query = query.eq('curriculum_id', filters.curriculumId);
    }

    const { data: rawData, error } = await query;
    if (error) {
      console.error('Error fetching courses:', error);
      throw new Error(parseSupabaseError(error));
    }

    // 12. COURSE MASTER FILTER: metadata->>'master_catalog' = 'true'
    let data = rawData || [];
    const hasMasterCatalogFlag = data.some(
      (r: any) => r.metadata?.master_catalog === 'true' || r.metadata?.master_catalog === true
    );
    if (hasMasterCatalogFlag) {
      data = data.filter(
        (r: any) => r.metadata?.master_catalog === 'true' || r.metadata?.master_catalog === true
      );
    }

    let results: Course[] = data.map((row: any) => ({
      ...row,
      effective_sks: row.effective_sks ?? row.sks ?? 0,
      sks: row.effective_sks ?? row.sks ?? 0,
      course_type: row.course_type || 'WAJIB',
      category: row.course_type === 'WAJIB' ? 'Wajib' : 'Pilihan',
      offerings_count: row.course_offerings?.length || 0,
    }));

    if (filters?.search) {
      const s = filters.search.toLowerCase().trim();
      results = results.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(s)) ||
          (c.code && c.code.toLowerCase().includes(s))
      );
    }

    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'schedulable') {
        results = results.filter((c) => c.is_schedulable && c.activity_type !== 'KKN');
      } else if (filters.status === 'unschedulable') {
        results = results.filter((c) => !c.is_schedulable || c.activity_type === 'KKN');
      }
    }

    // Sort: semester ASC, lalu kurikulum (2022, 2026), lalu code ASC
    results.sort((a, b) => {
      if ((a.semester || 0) !== (b.semester || 0)) {
        return (a.semester || 0) - (b.semester || 0);
      }
      const yearA = a.curriculum?.year || 0;
      const yearB = b.curriculum?.year || 0;
      if (yearA !== yearB) {
        return yearA - yearB;
      }
      return (a.code || '').localeCompare(b.code || '');
    });

    return results;
  },

  async getCourseById(id: string): Promise<{
    course: Course;
    offerings: CourseOffering[];
  }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const { data: course, error: cErr } = await supabase
      .from('courses')
      .select(`
        *,
        kbk:kbk_id ( id, name, code ),
        curriculum:curriculum_id ( id, name, year )
      `)
      .eq('id', id)
      .single();

    if (cErr) throw new Error(parseSupabaseError(cErr));

    const { data: offerings, error: oErr } = await supabase
      .from('course_offerings')
      .select(`
        *,
        course_offering_lecturers (
          course_offering_id,
          lecturer_id,
          assignment_role,
          lecturer:lecturer_id ( id, name, lecturer_code, nip )
        )
      `)
      .eq('course_id', id)
      .order('class_code', { ascending: true });

    if (oErr) console.warn('Offerings fetch notice:', oErr);

    return {
      course: {
        ...course,
        effective_sks: course.effective_sks ?? course.sks ?? 0,
        sks: course.effective_sks ?? course.sks ?? 0,
      },
      offerings: (offerings || []).map((o: any) => ({
        ...o,
        class_name: o.class_code || o.class_name,
        lecturers: (o.course_offering_lecturers || []).map((col: any) => ({
          ...col,
          lecturer: col.lecturer
            ? {
                ...col.lecturer,
                code: col.lecturer.lecturer_code || '',
              }
            : null,
        })),
      })),
    };
  },

  async createCourse(data: Partial<Course>): Promise<Course> {
    await assertOwnerAdmin('menambah mata kuliah');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    // Validation
    if (!data.name || !data.name.trim()) {
      throw new Error('Nama mata kuliah wajib diisi.');
    }
    const sksVal = Number(data.effective_sks || data.sks || 0);
    if (sksVal < 1 || sksVal > 12) {
      throw new Error('Bobot SKS harus antara 1 sampai 12 SKS.');
    }
    const semVal = Number(data.semester || 1);
    if (semVal < 1 || semVal > 14) {
      throw new Error('Semester harus antara 1 sampai 14.');
    }

    // KKN Rule:
    const isKKN = data.activity_type === 'KKN' || data.name.toUpperCase().includes('KKN');
    const isSchedulable = isKKN ? false : (data.is_schedulable ?? true);
    const managedBy = isKKN ? 'LPPM' : (data.managed_by || 'JURUSAN');
    const scope = isKKN ? 'ALL_KBK' : (data.scope || 'PROG_STUDI');

    const courseType = (data.course_type as CourseType) || 'WAJIB';

    const insertPayload: Record<string, any> = {
      name: data.name.trim(),
      code: data.code && data.code.trim() ? data.code.trim().toUpperCase() : null,
      effective_sks: sksVal,
      semester: semVal,
      course_type: courseType,
      activity_type: isKKN ? 'KKN' : (data.activity_type || 'KULIAH'),
      is_schedulable: isSchedulable,
      managed_by: managedBy,
      scope: scope,
      kbk_id: data.kbk_id || null,
      curriculum_id: data.curriculum_id || null,
    };
    if (data.metadata) insertPayload.metadata = data.metadata;
    if (data.legacy_id) insertPayload.legacy_id = data.legacy_id;

    const { data: created, error } = await supabase
      .from('courses')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error, 'course_code'));
    }

    return created;
  },

  async updateCourse(id: string, data: Partial<Course>): Promise<Course> {
    await assertOwnerAdmin('mengubah mata kuliah');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (!data.name || !data.name.trim()) {
      throw new Error('Nama mata kuliah wajib diisi.');
    }
    const sksVal = Number(data.effective_sks ?? data.sks ?? 0);
    if (sksVal < 1 || sksVal > 12) {
      throw new Error('Bobot SKS harus antara 1 sampai 12 SKS.');
    }
    const semVal = Number(data.semester ?? 1);
    if (semVal < 1 || semVal > 14) {
      throw new Error('Semester harus antara 1 sampai 14.');
    }

    const isKKN = data.activity_type === 'KKN' || data.name.toUpperCase().includes('KKN');
    const isSchedulable = isKKN ? false : (data.is_schedulable ?? true);
    const managedBy = isKKN ? 'LPPM' : (data.managed_by || 'JURUSAN');
    const scope = isKKN ? 'ALL_KBK' : (data.scope || 'PROG_STUDI');

    const courseType = (data.course_type as CourseType) || 'WAJIB';

    const updatePayload: Record<string, any> = {
      name: data.name.trim(),
      code: data.code && data.code.trim() ? data.code.trim().toUpperCase() : null,
      effective_sks: sksVal,
      semester: semVal,
      course_type: courseType,
      activity_type: isKKN ? 'KKN' : (data.activity_type || 'KULIAH'),
      is_schedulable: isSchedulable,
      managed_by: managedBy,
      scope: scope,
      kbk_id: data.kbk_id || null,
      curriculum_id: data.curriculum_id || null,
    };
    if (data.metadata) updatePayload.metadata = data.metadata;
    if (data.legacy_id) updatePayload.legacy_id = data.legacy_id;

    const { data: updated, error } = await supabase
      .from('courses')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error, 'course_code'));
    }

    return updated;
  },

  async deleteCourse(id: string): Promise<void> {
    await assertOwnerAdmin('menghapus mata kuliah');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) {
      // If foreign key constraint prevents deletion, advise or deactivate
      throw new Error(parseSupabaseError(error));
    }
  },

  async toggleSchedulable(id: string, isSchedulable: boolean): Promise<void> {
    await assertOwnerAdmin('mengubah status schedulable mata kuliah');
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('courses')
      .update({ is_schedulable: isSchedulable })
      .eq('id', id);

    if (error) throw new Error(parseSupabaseError(error));
  },

  async getCurriculums() {
    if (!isSupabaseConfigured()) return [];
    try {
      const isOwner = await verifyOwnerAdmin();
      const table = isOwner ? 'curriculums' : 'guest_curriculums';
      const { data } = await supabase
        .from(table)
        .select('*')
        .order('year', { ascending: false });
      return data || [];
    } catch {
      return [];
    }
  },

  async getKBKs() {
    if (!isSupabaseConfigured()) return [];
    try {
      const isOwner = await verifyOwnerAdmin();
      const table = isOwner ? 'kbk' : 'guest_kbk';
      const { data } = await supabase.from(table).select('*').order('name', { ascending: true });
      return data || [];
    } catch {
      return [];
    }
  },

  async getStats() {
    if (!isSupabaseConfigured()) {
      return { total: 0, schedulable: 0, wajib: 0, pilihan: 0, totalClasses: 0 };
    }

    try {
      const isOwner = await verifyOwnerAdmin();
      const table = isOwner ? 'courses' : 'guest_courses';

      let { data: courses, error } = await supabase
        .from(table)
        .select('id, course_type, is_schedulable, activity_type, metadata');

      if (error) {
        const guestRes = await supabase
          .from('guest_courses')
          .select('id, course_type, is_schedulable, activity_type, metadata');
        courses = guestRes.data || [];
      }

      let classesCount = 0;
      try {
        const { count } = await supabase
          .from('course_offerings')
          .select('*', { count: 'exact', head: true });
        classesCount = count || 0;
      } catch {
        // ignore
      }

      // Master catalog filter: only count metadata->>'master_catalog' = 'true'
      const masterCourses = (courses || []).filter(
        (c) => c.metadata?.master_catalog === true || c.metadata?.master_catalog === 'true'
      );
      const catalogList = masterCourses.length > 0 ? masterCourses : (courses || []);

      const total = catalogList.length;
      const schedulable = catalogList.filter((c) => c.is_schedulable && c.activity_type !== 'KKN').length;
      const wajib = catalogList.filter((c) => c.course_type === 'WAJIB').length;
      const pilihan = catalogList.filter((c) => c.course_type === 'PILIHAN').length;

      return {
        total,
        schedulable,
        wajib,
        pilihan,
        totalClasses: classesCount || 0,
      };
    } catch (err) {
      console.warn('Failed to get course stats:', err);
      return { total: 0, schedulable: 0, wajib: 0, pilihan: 0, totalClasses: 0 };
    }
  },
};
