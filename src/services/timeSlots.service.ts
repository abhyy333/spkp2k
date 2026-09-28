import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TimeSlot } from '../types';
import { minuteToTime, timeToMinute, dayOfWeekToName, parseSupabaseError } from '../lib/utils';
import { verifyOwnerAdmin, assertOwnerAdmin } from '../lib/authGuard';

export const timeSlotsService = {
  async getTimeSlots(filters?: { termId?: string; day?: number; activeOnly?: boolean }): Promise<TimeSlot[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const isOwner = await verifyOwnerAdmin();
      const table = isOwner ? 'time_slots' : 'guest_time_slots';

      let query = supabase
        .from(table)
        .select('*')
        .order('day_of_week', { ascending: true })
        .order('start_minute', { ascending: true });

      if (filters?.day) {
        query = query.eq('day_of_week', filters.day);
      }
      if (filters?.activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching time slots:', error);
        throw new Error(parseSupabaseError(error));
      }

      return (data || []).map((row: any) => {
        const startMin = row.start_minute ?? (row.start_time ? timeToMinute(row.start_time) : 480);
        const endMin = row.end_minute ?? (row.end_time ? timeToMinute(row.end_time) : 530);
        const dayNum = row.day_of_week ?? (row.day ? 1 : 1);
        const dur = endMin - startMin;

        return {
          ...row,
          day_of_week: dayNum,
          start_minute: startMin,
          end_minute: endMin,
          day: dayOfWeekToName(dayNum),
          start_time: minuteToTime(startMin),
          end_time: minuteToTime(endMin),
          duration_minutes: dur > 0 ? dur : 50,
          slot_type: row.label || `Perkuliahan (${Math.round(dur / 50)} SKS)`,
        };
      });
    } catch (err) {
      console.error('Time slots query error:', err);
      return [];
    }
  },

  async createTimeSlot(data: {
    day_of_week: number;
    start_time: string; // "HH:MM"
    end_time: string; // "HH:MM"
    label?: string;
    is_active?: boolean;
    academic_term_id?: string | null;
  }): Promise<TimeSlot> {
    await assertOwnerAdmin('menambah slot waktu');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const startMin = timeToMinute(data.start_time);
    const endMin = timeToMinute(data.end_time);

    if (endMin <= startMin) {
      throw new Error('Jam selesai harus lebih akhir dari jam mulai.');
    }

    const payload: Record<string, any> = {
      day_of_week: Number(data.day_of_week),
      start_minute: startMin,
      end_minute: endMin,
      label: data.label?.trim() || `Perkuliahan (${Math.round((endMin - startMin) / 50)} SKS)`,
      is_active: data.is_active ?? true,
      academic_term_id: data.academic_term_id || null,
    };

    const { data: created, error } = await supabase
      .from('time_slots')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error));
    }

    return created;
  },

  async updateTimeSlot(
    id: string,
    data: {
      day_of_week: number;
      start_time: string;
      end_time: string;
      label?: string;
      is_active?: boolean;
    }
  ): Promise<TimeSlot> {
    await assertOwnerAdmin('memperbarui slot waktu');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const startMin = timeToMinute(data.start_time);
    const endMin = timeToMinute(data.end_time);

    if (endMin <= startMin) {
      throw new Error('Jam selesai harus lebih akhir dari jam mulai.');
    }

    const payload: Record<string, any> = {
      day_of_week: Number(data.day_of_week),
      start_minute: startMin,
      end_minute: endMin,
      label: data.label?.trim() || null,
      is_active: data.is_active ?? true,
    };

    const { data: updated, error } = await supabase
      .from('time_slots')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error));
    }

    return updated;
  },

  async deleteTimeSlot(id: string): Promise<void> {
    await assertOwnerAdmin('menghapus slot waktu');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const { error } = await supabase.from('time_slots').delete().eq('id', id);
    if (error) {
      throw new Error(parseSupabaseError(error));
    }
  },

  async toggleTimeSlotActive(id: string, isActive: boolean): Promise<void> {
    await assertOwnerAdmin('mengubah status slot waktu');
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('time_slots')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw new Error(parseSupabaseError(error));
  },
};
