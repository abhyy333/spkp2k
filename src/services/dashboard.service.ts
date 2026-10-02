import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DashboardStats, SchedulingReadiness } from '../types';
import { fetchWithCache } from '../lib/queryCache';

export const dashboardService = {
  async getDashboardSummary(termId?: string): Promise<DashboardStats> {
    if (!isSupabaseConfigured()) {
      return {
        totalCourses: 0,
        schedulableCourses: 0,
        totalLecturers: 0,
        activeLecturers: 0,
        totalRooms: 0,
        totalOfferings: 0,
        unconfirmedOfferings: 0,
        totalConflicts: 0,
        resolvedConflicts: 0,
        publishedPercentage: 0,
        scheduleStatus: 'Ready',
        availableRooms: 0,
        totalStudents: 0,
      };
    }

    const cacheKey = `dashboard_summary_${termId || 'active'}`;
    return fetchWithCache(
      cacheKey,
      async () => {
        try {
          const { data, error } = await supabase.rpc('get_dashboard_summary', termId ? { p_term_id: termId } : {});
          if (!error && data) {
            return data as DashboardStats;
          }
        } catch (err) {
          console.warn('get_dashboard_summary RPC notice:', err);
        }

        // Fallback lightweight counts
        try {
          const [courseRes, lectRes, roomRes, offRes] = await Promise.all([
            supabase.from('courses').select('id, is_schedulable'),
            supabase.from('lecturers').select('id, status'),
            supabase.from('rooms').select('id'),
            supabase.from('course_offerings').select('id, is_verified'),
          ]);

          const courses = courseRes.data || [];
          const lecturers = lectRes.data || [];
          const rooms = roomRes.data || [];
          const offerings = offRes.data || [];

          return {
            totalCourses: courses.length,
            schedulableCourses: courses.filter((c: any) => c.is_schedulable).length,
            totalLecturers: lecturers.length,
            activeLecturers: lecturers.filter((l: any) => l.status === 'Aktif' || !l.status).length,
            totalRooms: rooms.length,
            totalOfferings: offerings.length,
            unconfirmedOfferings: offerings.filter((o: any) => !o.is_verified).length,
            totalConflicts: 0,
            resolvedConflicts: 0,
            publishedPercentage: offerings.length > 0 ? 100 : 0,
            scheduleStatus: 'Ready',
            availableRooms: rooms.length,
            totalStudents: 0,
          };
        } catch {
          return {
            totalCourses: 0,
            schedulableCourses: 0,
            totalLecturers: 0,
            activeLecturers: 0,
            totalRooms: 0,
            totalOfferings: 0,
            unconfirmedOfferings: 0,
            totalConflicts: 0,
            resolvedConflicts: 0,
            publishedPercentage: 0,
            scheduleStatus: 'Ready',
            availableRooms: 0,
            totalStudents: 0,
          };
        }
      },
      { staleTimeMs: 3 * 60 * 1000 }
    );
  },

  async getReadinessChecklist(): Promise<SchedulingReadiness> {
    if (!isSupabaseConfigured()) {
      return {
        isReady: false,
        score: 0,
        total: 8,
        items: [
          { id: 'term', label: 'Periode akademik aktif', status: false, details: 'Database belum terhubung' },
          { id: 'courses', label: 'Mata kuliah tersedia', status: false, details: 'Database belum terhubung' },
          { id: 'lecturers', label: 'Dosen pengampu tersedia', status: false, details: 'Database belum terhubung' },
          { id: 'offerings', label: 'Penawaran kelas tersedia', status: false, details: 'Database belum terhubung' },
          { id: 'students', label: 'Jumlah mahasiswa terisi', status: false, details: 'Database belum terhubung' },
          { id: 'rooms', label: 'Ruangan tersedia', status: false, details: 'Database belum terhubung' },
          { id: 'slots', label: 'Slot waktu tersedia', status: false, details: 'Database belum terhubung' },
          { id: 'confirmed', label: 'Assignment sudah dikonfirmasi', status: false, details: 'Database belum terhubung' },
        ],
      };
    }

    return fetchWithCache(
      'dashboard_readiness',
      async () => {
        try {
          const [
            { data: activeTerm },
            courseRes,
            lecturerRes,
            offeringsRes,
            roomRes,
            slotRes,
          ] = await Promise.all([
            supabase.from('academic_terms').select('id, academic_year, semester_type').eq('is_active', true).maybeSingle(),
            supabase.from('courses').select('*', { count: 'exact', head: true }),
            supabase.from('lecturers').select('*', { count: 'exact', head: true }),
            supabase.from('course_offerings').select('id, expected_students, assignment_confirmed'),
            supabase.from('rooms').select('*', { count: 'exact', head: true }),
            supabase.from('time_slots').select('*', { count: 'exact', head: true }).eq('is_active', true),
          ]);

          const courseCount = courseRes.count || 0;
          const lecturerCount = lecturerRes.count || 0;
          const roomCount = roomRes.count || 0;
          const slotCount = slotRes.count || 0;
          const offerings = offeringsRes.data || [];

          const totalOfferings = offerings?.length || 0;
          const confirmedOfferings = offerings?.filter((o: any) => o.assignment_confirmed).length || 0;
          const filledExpectedStudents = offerings?.filter((o: any) => (o.expected_students || 0) > 0).length || 0;

          const items = [
            {
              id: 'term',
              label: 'Periode akademik aktif',
              status: Boolean(activeTerm),
              details: activeTerm ? `${activeTerm.semester_type} ${activeTerm.academic_year}` : 'Belum ditentukan',
            },
            {
              id: 'courses',
              label: 'Mata kuliah siap dijadwalkan',
              status: (courseCount || 0) > 0,
              details: `${courseCount || 0} mata kuliah aktif`,
            },
            {
              id: 'lecturers',
              label: 'Dosen pengampu tersedia',
              status: (lecturerCount || 0) > 0,
              details: `${lecturerCount || 0} dosen terdaftar`,
            },
            {
              id: 'offerings',
              label: 'Penawaran kelas tersedia',
              status: totalOfferings > 0,
              details: `${totalOfferings} kelas penawaran`,
            },
            {
              id: 'students',
              label: 'Jumlah mahasiswa terisi',
              status: totalOfferings > 0 && filledExpectedStudents >= totalOfferings * 0.8,
              details: `${filledExpectedStudents} dari ${totalOfferings} kelas terisi`,
            },
            {
              id: 'rooms',
              label: 'Ruangan aktif tersedia',
              status: (roomCount || 0) > 0,
              details: `${roomCount || 0} ruangan aktif`,
            },
            {
              id: 'slots',
              label: 'Slot waktu perkuliahan siap',
              status: (slotCount || 0) > 0,
              details: `${slotCount || 0} slot waktu terdaftar`,
            },
            {
              id: 'confirmed',
              label: 'Assignment kelas dikonfirmasi',
              status: totalOfferings > 0 && confirmedOfferings >= totalOfferings * 0.7,
              details: `${confirmedOfferings} / ${totalOfferings} kelas dikonfirmasi`,
            },
          ];

          const score = items.filter((i) => i.status).length;
          const isReady = score >= 7;

          return {
            isReady,
            score,
            total: items.length,
            items,
          };
        } catch (err) {
          console.error('Failed to compute scheduling readiness:', err);
          return {
            isReady: false,
            score: 0,
            total: 8,
            items: [],
          };
        }
      },
      { staleTimeMs: 5 * 60 * 1000 }
    );
  },
};

