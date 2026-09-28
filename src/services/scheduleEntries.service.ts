import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ScheduleEntry } from '../types';
import { minuteToTime, dayOfWeekToName, parseSupabaseError } from '../lib/utils';

export const scheduleEntriesService = {
  /**
   * Fetch all schedule entries for a given version ID
   */
  async getEntriesByVersionId(versionId: string): Promise<ScheduleEntry[]> {
    if (!isSupabaseConfigured() || !versionId) return [];

    try {
      const { data, error } = await supabase
        .from('schedule_entries')
        .select(`
          *,
          room:room_id (
            id,
            code,
            name,
            capacity,
            room_type,
            is_active
          ),
          course_offering:course_offering_id (
            id,
            class_code,
            expected_students,
            required_room_type,
            assignment_confirmed,
            academic_term_id,
            course:course_id (
              id,
              name,
              code,
              effective_sks,
              semester,
              course_type,
              activity_type,
              is_schedulable,
              kbk_id
            ),
            course_offering_lecturers (
              course_offering_id,
              lecturer_id,
              assignment_role,
              lecturer:lecturer_id (
                id,
                name,
                lecturer_code,
                nip
              )
            )
          )
        `)
        .eq('schedule_version_id', versionId);

      if (error) {
        console.error('Error fetching schedule entries:', error);
        throw new Error(parseSupabaseError(error));
      }

      return (data || []).map((row: any) => {
        const startMin = row.start_minute ?? (row.start_time ? parseInt(row.start_time) : 470);
        const sks = row.course_offering?.course?.effective_sks || 2;
        const minutesPerSession = row.minutes_per_session || 50;
        const sessionCount = row.session_count || sks;
        const dur = sessionCount * minutesPerSession;
        const endMin = row.end_minute ?? (startMin + dur);
        const dayNum = Number(row.day_of_week) || 1;

        const offering = row.course_offering;
        const lecturersList = offering?.course_offering_lecturers?.map(
          (col: any) => col.lecturer?.name
        ).filter(Boolean) || [];

        return {
          ...row,
          day_of_week: dayNum,
          start_minute: startMin,
          end_minute: endMin,
          day: dayOfWeekToName(dayNum),
          start_time: minuteToTime(startMin),
          end_time: minuteToTime(endMin),
          course_name: row.course_name || offering?.course?.name,
          course_code: row.course_code || offering?.course?.code,
          class_code: row.class_code || offering?.class_code,
          student_count: row.student_count ?? offering?.expected_students ?? 0,
          room_capacity: row.room_capacity ?? row.room?.capacity ?? 0,
          lecturer_names: row.lecturer_names || (lecturersList.length > 0 ? lecturersList : '-'),
        };
      });
    } catch (err: any) {
      console.error('getEntriesByVersionId exception:', err);
      return [];
    }
  },
};
