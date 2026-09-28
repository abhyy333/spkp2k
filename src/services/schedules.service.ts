import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getActiveAcademicTerm } from './academicTerms.service';
import { scheduleEntriesService } from './scheduleEntries.service';
import { minuteToTime, timeToMinute } from '../lib/utils';
import {
  CurrentPublishedSchedule,
  CurrentPublishedExam,
  AcademicTerm,
  TimeSlot,
} from '../types';

const DAY_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

const PUBLISHED_SCHEDULE_CACHE_KEY = 'spk:cached-published-schedule';

function mapPublishedScheduleRow(
  row: any,
  coursesMap: Map<string, number>
): CurrentPublishedSchedule {
  const dayStr =
    row.day ||
    (row.day_of_week ? DAY_NAMES[Number(row.day_of_week)] : 'Senin') ||
    'Senin';

  const startMin =
    typeof row.start_minute === 'number'
      ? row.start_minute
      : row.start_time
      ? timeToMinute(row.start_time)
      : 470;

  let endMin =
    typeof row.end_minute === 'number'
      ? row.end_minute
      : row.end_time
      ? timeToMinute(row.end_time)
      : startMin + 150;

  if (endMin <= startMin) {
    endMin = startMin + 150;
  }

  const durationMinutes = endMin - startMin;
  const calculatedSessionCount = Math.max(1, Math.round(durationMinutes / 50));
  const sessionCount =
    typeof row.session_count === 'number' && row.session_count > 0
      ? row.session_count
      : calculatedSessionCount;

  // Effective SKS resolution from coursesMap, relation, or duration calculation
  const cCodeKey = String(row.course_code || '').trim().toUpperCase();
  const effectiveSksFromMap =
    (row.course_id && coursesMap.get(row.course_id)) ||
    (cCodeKey && coursesMap.get(cCodeKey));

  const effectiveSks =
    row.course_offering?.course?.effective_sks ??
    effectiveSksFromMap ??
    row.effective_sks ??
    sessionCount ??
    calculatedSessionCount;

  const startStr = row.start_time || minuteToTime(startMin);
  const endStr = row.end_time || minuteToTime(endMin);
  const realScheduleEntryId = row.id || row.schedule_entry_id || row.scheduleEntryId || null;
  const offeringId = row.course_offering_id || row.offering_id || row.courseOfferingId;

  return {
    ...row,
    id: realScheduleEntryId || `published-${offeringId || Math.random()}`,
    scheduleEntryId: realScheduleEntryId,
    uiKey: realScheduleEntryId || `preview-${offeringId || Math.random()}`,
    schedule_version_id: row.schedule_version_id || row.version_id,
    term_id: String(row.term_id || row.academic_term_id || ''),
    course_offering_id: offeringId,
    course_id: String(row.course_id || ''),
    course_code: String(row.course_code || ''),
    course_name: String(row.course_name || 'Mata Kuliah'),
    sks: Number(effectiveSks),
    effective_sks: Number(effectiveSks),
    session_count: Number(sessionCount),
    start_minute: Number(startMin),
    end_minute: Number(endMin),
    day_of_week: Number(
      row.day_of_week ||
        (row.day
          ? Object.entries(DAY_NAMES).find(
              ([_, v]) => v.toLowerCase() === String(row.day).toLowerCase()
            )?.[0]
          : 1) ||
        1
    ),
    class_name: String(row.class_name || row.class_code || 'A'),
    day: dayStr,
    start_time: startStr,
    end_time: endStr,
    room_id: String(row.room_id || ''),
    room_code: String(row.room_code || row.room_name || 'Ruang ?'),
    room_name: String(row.room_name || row.room_code || 'Ruang ?'),
    lecturer_names: row.lecturer_names || '',
    kbk_name: row.kbk_name || '',
    student_count: Number(row.student_count || row.expected_students || row.course_offering?.expected_students || 40),
    expected_students: Number(row.expected_students || row.student_count || row.course_offering?.expected_students || 40),
  };
}

function applyScheduleFilters(
  list: CurrentPublishedSchedule[],
  filters?: { day?: string; termId?: string; className?: string }
): CurrentPublishedSchedule[] {
  if (!filters) return list;
  return list.filter((item) => {
    if (
      filters.termId &&
      filters.termId !== 'all' &&
      item.term_id !== filters.termId &&
      item.academic_term_id !== filters.termId
    ) {
      return false;
    }
    if (
      filters.day &&
      filters.day !== 'all' &&
      item.day?.toLowerCase() !== filters.day.toLowerCase()
    ) {
      return false;
    }
    if (
      filters.className &&
      filters.className !== 'all' &&
      item.class_name !== filters.className
    ) {
      return false;
    }
    return true;
  });
}

export const schedulesService = {
  async getAcademicTerms(): Promise<AcademicTerm[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      const { data, error } = await supabase
        .from('academic_terms')
        .select('*')
        .order('academic_year', { ascending: false });

      if (error) {
        console.warn('Academic terms error:', error);
        return [];
      }
      return (data || []).map((row: any) => ({
        ...row,
        academic_year: row.academic_year || row.year || '2026/2027',
        semester_type: row.semester_type || row.term || 'GANJIL',
        year: row.academic_year || row.year || '2026/2027',
        term: row.semester_type || row.term || 'GANJIL',
        starts_on: row.starts_on || row.start_date,
        ends_on: row.ends_on || row.end_date,
      }));
    } catch {
      return [];
    }
  },

  async getActiveTerm(): Promise<AcademicTerm | null> {
    try {
      return await getActiveAcademicTerm();
    } catch {
      return null;
    }
  },

  async getTimeSlots(): Promise<TimeSlot[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      const { data, error } = await supabase
        .from('time_slots')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) {
        console.warn('Time slots lookup error:', error);
        return [];
      }
      return data || [];
    } catch {
      return [];
    }
  },

  async getPublishedSchedule(filters?: {
    day?: string;
    termId?: string;
    className?: string;
  }): Promise<CurrentPublishedSchedule[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      // 1. Fetch lookup map for courses to ensure authentic effective_sks
      const coursesMap = new Map<string, number>();
      try {
        const { data: coursesData } = await supabase
          .from('courses')
          .select('id, code, effective_sks');
        if (coursesData && Array.isArray(coursesData)) {
          for (const c of coursesData) {
            if (c.id && typeof c.effective_sks === 'number') {
              coursesMap.set(c.id, c.effective_sks);
            }
            if (c.code && typeof c.effective_sks === 'number') {
              coursesMap.set(String(c.code).trim().toUpperCase(), c.effective_sks);
            }
          }
        }
      } catch (cErr) {
        console.warn('Courses lookup warning:', cErr);
      }

      // 2. Query published schedule view
      let query = supabase.from('current_published_schedule').select('*');

      if (filters?.termId && filters.termId !== 'all') {
        query = query.eq('academic_term_id', filters.termId);
      }
      if (filters?.day && filters.day !== 'all') {
        query = query.eq('day', filters.day);
      }
      if (filters?.className && filters.className !== 'all') {
        query = query.eq('class_name', filters.className);
      }

      const { data, error } = await query;
      if (!error && data && Array.isArray(data)) {
        const mapped = data.map((row: any) => mapPublishedScheduleRow(row, coursesMap));
        try {
          if (mapped.length > 0 && (!filters?.day || filters.day === 'all') && (!filters?.className || filters.className === 'all')) {
            localStorage.setItem(PUBLISHED_SCHEDULE_CACHE_KEY, JSON.stringify(mapped));
          } else if (mapped.length === 0) {
            localStorage.removeItem(PUBLISHED_SCHEDULE_CACHE_KEY);
          }
        } catch (_) {}
        return mapped;
      }

      // If view query returned an error (such as 42501 permission denied), attempt security definer RPC
      if (error) {
        console.warn(
          'Notice querying current_published_schedule (code ' +
            (error?.code || 'unknown') +
            '): ' +
            (error?.message || 'Access restricted') +
            '. Initiating RPC fallback.'
        );

        try {
          const rpcParams =
            filters?.termId && filters.termId !== 'all'
              ? { p_academic_term_id: filters.termId }
              : {};
          const { data: rpcData, error: rpcErr } = await supabase.rpc(
            'get_current_published_schedule',
            rpcParams
          );
          if (!rpcErr && rpcData && Array.isArray(rpcData)) {
            const mappedRpc = rpcData.map((row: any) => mapPublishedScheduleRow(row, coursesMap));
            try {
              if (mappedRpc.length > 0) {
                localStorage.setItem(PUBLISHED_SCHEDULE_CACHE_KEY, JSON.stringify(mappedRpc));
              } else {
                localStorage.removeItem(PUBLISHED_SCHEDULE_CACHE_KEY);
              }
            } catch (_) {}
            return applyScheduleFilters(mappedRpc, filters);
          }
        } catch (rpcEx) {
          console.warn('RPC fallback notice:', rpcEx);
        }
      }

      return [];
    } catch (err) {
      console.warn('Notice fetching published schedule:', err);
      return [];
    }
  },

  async getPublishedExams(examType?: 'UTS' | 'UAS'): Promise<CurrentPublishedExam[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      let query = supabase.from('current_published_exams').select('*');

      if (examType) {
        query = query.eq('exam_type', examType);
      }

      const { data, error } = await query;
      if (!error && data && Array.isArray(data)) {
        return data;
      }

      // If view query returned an error, attempt RPC fallback
      console.warn(
        'Notice querying current_published_exams (code ' +
          (error?.code || 'unknown') +
          '): ' +
          (error?.message || 'Access restricted') +
          '. Trying RPC fallback.'
      );

      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          'get_current_published_exams',
          examType ? { p_type: examType } : {}
        );
        if (!rpcErr && rpcData && Array.isArray(rpcData)) {
          return rpcData;
        }
      } catch (_) {}

      return [];
    } catch (err) {
      console.warn('Notice fetching published exams:', err);
      return [];
    }
  },

  async getLecturerSchedule(lecturerId: string): Promise<CurrentPublishedSchedule[]> {
    if (!isSupabaseConfigured() || !lecturerId) return [];

    try {
      // 1. Get offering IDs for this lecturer
      const { data: offerings, error: offErr } = await supabase
        .from('course_offering_lecturers')
        .select('course_offering_id')
        .eq('lecturer_id', lecturerId);

      if (offErr || !offerings || offerings.length === 0) return [];

      const offeringIds = offerings.map((o: any) => o.course_offering_id);

      // 2. Fetch published schedule matching these course offerings
      // Or check current_published_schedule
      const allPublished = await this.getPublishedSchedule();
      if (allPublished.length > 0) {
        // filter by lecturer name or course offering
        const { data: lecturer } = await supabase
          .from('lecturers')
          .select('name')
          .eq('id', lecturerId)
          .single();

        if (lecturer?.name) {
          const lName = lecturer.name.toLowerCase();
          return allPublished.filter((s: any) => {
            const names = Array.isArray(s.lecturer_names)
              ? s.lecturer_names.join(', ')
              : String(s.lecturer_names || '');
            return names.toLowerCase().includes(lName);
          });
        }
      }

      return [];
    } catch (err) {
      console.error('Error getting lecturer schedule:', err);
      return [];
    }
  },

  async getStudentSchedule(_studentId?: string): Promise<CurrentPublishedSchedule[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      // General published schedule viewer for students
      return await this.getPublishedSchedule();
    } catch (err) {
      console.error('Error getting student schedule:', err);
      return [];
    }
  },

  async getScheduleStatus(): Promise<{ status: string; percentage: number }> {
    if (!isSupabaseConfigured()) {
      return { status: 'Belum ada jadwal', percentage: 0 };
    }

    try {
      // Check schedule_publications
      const { data: pubs, error: pubErr } = await supabase
        .from('schedule_publications')
        .select('id, published_at')
        .order('published_at', { ascending: false })
        .limit(1);

      if (pubs && pubs.length > 0) {
        return { status: 'Diterbitkan', percentage: 100 };
      }

      // Check schedule_versions
      const { data: versions, error: verErr } = await supabase
        .from('schedule_versions')
        .select('status')
        .order('created_at', { ascending: false })
        .limit(1);

      if (versions && versions.length > 0) {
        const s = versions[0].status;
        if (s === 'PUBLISHED') return { status: 'Diterbitkan', percentage: 100 };
        if (s === 'DRAFT') return { status: 'Draft', percentage: 85 };
        return { status: 'Belum diterbitkan', percentage: 40 };
      }

      return { status: 'Belum ada jadwal', percentage: 0 };
    } catch {
      return { status: 'Belum ada jadwal', percentage: 0 };
    }
  },
};
