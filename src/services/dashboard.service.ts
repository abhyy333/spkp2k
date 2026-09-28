import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SchedulingReadiness } from '../types';
import { verifyOwnerAdmin } from '../lib/authGuard';

export const dashboardService = {
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

    try {
      const isOwner = await verifyOwnerAdmin();
      const courseTable = isOwner ? 'courses' : 'guest_courses';
      const lecturerTable = isOwner ? 'lecturers' : 'guest_lecturers';
      const roomTable = isOwner ? 'rooms' : 'guest_rooms';

      const [
        { data: activeTerm },
        courseRes,
        lecturerRes,
        offeringsRes,
        roomRes,
        slotRes,
      ] = await Promise.all([
        supabase.from('academic_terms').select('id, academic_year, semester_type').eq('is_active', true).maybeSingle(),
        supabase.from(courseTable).select('*', { count: 'exact', head: true }),
        supabase.from(lecturerTable).select('*', { count: 'exact', head: true }),
        supabase.from('course_offerings').select('id, expected_students, assignment_confirmed'),
        supabase.from(roomTable).select('*', { count: 'exact', head: true }),
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
      const isReady = score >= 7; // Ready when essential requirements are met

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
};
