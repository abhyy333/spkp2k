import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ClassAssignment } from '../types';
import { parseSupabaseError } from '../lib/utils';

export const classAssignmentsService = {
  async getAssignmentsByOffering(offeringId: string): Promise<ClassAssignment[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      const { data, error } = await supabase
        .from('class_assignments')
        .select(`
          *,
          student:student_id (
            id,
            nim,
            full_name,
            cohort,
            kbk:kbk_id ( id, name, code )
          )
        `)
        .eq('course_offering_id', offeringId);

      if (error) {
        console.warn('Class assignments fetch warning:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        ...row,
        student: row.student
          ? {
              ...row.student,
              name: row.student.full_name || row.student.name,
              batch_year: row.student.cohort,
            }
          : null,
      }));
    } catch {
      return [];
    }
  },

  async assignStudent(
    studentId: string,
    offeringId: string,
    termId?: string,
    locked = false
  ): Promise<ClassAssignment> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const payload: Record<string, any> = {
      student_id: studentId,
      course_offering_id: offeringId,
      assignment_source: 'MANUAL',
      locked: locked,
    };
    if (termId) payload.academic_term_id = termId;

    const { data, error } = await supabase
      .from('class_assignments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error));
    }

    return data;
  },

  async removeAssignment(assignmentId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('class_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) throw new Error(parseSupabaseError(error));
  },

  async toggleLock(assignmentId: string, locked: boolean): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('class_assignments')
      .update({ locked })
      .eq('id', assignmentId);

    if (error) throw new Error(parseSupabaseError(error));
  },
};
