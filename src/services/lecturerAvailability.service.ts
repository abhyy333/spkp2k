import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { LecturerAvailability, AvailabilityPreference } from '../types';
import { minuteToTime, dayOfWeekToName, parseSupabaseError } from '../lib/utils';

export const lecturerAvailabilityService = {
  async getAllAvailabilities(termId?: string): Promise<LecturerAvailability[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      let query = supabase
        .from('lecturer_availability')
        .select('*')
        .order('day_of_week', { ascending: true })
        .order('start_minute', { ascending: true });

      if (termId && termId !== 'all') {
        query = query.eq('academic_term_id', termId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Lecturer availability fetch warning:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        ...row,
        day: dayOfWeekToName(row.day_of_week),
        start_time: minuteToTime(row.start_minute),
        end_time: minuteToTime(row.end_minute),
      }));
    } catch {
      return [];
    }
  },

  async getAvailabilities(termId?: string): Promise<LecturerAvailability[]> {
    return this.getAllAvailabilities(termId);
  },

  async getAvailability(lecturerId: string, termId?: string): Promise<LecturerAvailability[]> {
    if (!isSupabaseConfigured() || !lecturerId) return [];

    try {
      let query = supabase
        .from('lecturer_availability')
        .select('*')
        .eq('lecturer_id', lecturerId)
        .order('day_of_week', { ascending: true })
        .order('start_minute', { ascending: true });

      if (termId && termId !== 'all') {
        query = query.eq('academic_term_id', termId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Lecturer availability fetch warning:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        ...row,
        day: dayOfWeekToName(row.day_of_week),
        start_time: minuteToTime(row.start_minute),
        end_time: minuteToTime(row.end_minute),
      }));
    } catch {
      return [];
    }
  },

  async addAvailabilitySlot(data: {
    lecturer_id: string;
    academic_term_id?: string | null;
    day_of_week: number;
    start_minute: number;
    end_minute: number;
    is_available: boolean;
    preference: AvailabilityPreference;
    notes?: string | null;
  }): Promise<LecturerAvailability> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (data.end_minute <= data.start_minute) {
      throw new Error('Jam selesai harus lebih akhir dari jam mulai.');
    }

    const payload: Record<string, any> = {
      lecturer_id: data.lecturer_id,
      academic_term_id: data.academic_term_id || null,
      day_of_week: Number(data.day_of_week),
      start_minute: Number(data.start_minute),
      end_minute: Number(data.end_minute),
      is_available: data.is_available,
      preference: data.preference || 'neutral',
      notes: data.notes?.trim() || null,
    };

    const { data: created, error } = await supabase
      .from('lecturer_availability')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error));
    }

    return created;
  },

  async deleteAvailabilitySlot(id: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.from('lecturer_availability').delete().eq('id', id);
    if (error) throw new Error(parseSupabaseError(error));
  },
};
