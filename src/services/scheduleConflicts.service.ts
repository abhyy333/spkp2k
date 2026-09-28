import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ScheduleConflict } from '../types';

export const scheduleConflictsService = {
  /**
   * Fetch schedule conflicts, filtered by version ID and excluding student conflicts
   */
  async getConflicts(
    versionId?: string,
    filters?: {
      severity?: string;
      type?: string;
      isResolved?: boolean;
    }
  ): Promise<ScheduleConflict[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      let query = supabase
        .from('schedule_conflicts')
        .select('*')
        .order('created_at', { ascending: false });

      if (versionId && versionId !== 'all') {
        query = query.eq('schedule_version_id', versionId);
      }

      if (filters?.severity && filters.severity !== 'all') {
        query = query.ilike('severity', `%${filters.severity}%`);
      }

      if (filters?.type && filters.type !== 'all') {
        query = query.eq('conflict_type', filters.type);
      }

      if (typeof filters?.isResolved === 'boolean') {
        query = query.eq('is_resolved', filters.isResolved);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Conflicts query warning:', error);
        return [];
      }

      // STRICT RULE: JANGAN tampilkan STUDENT conflict!
      const valid = (data || []).filter(
        (c: ScheduleConflict) =>
          c.conflict_type !== 'STUDENT' &&
          c.conflict_type !== 'CLASS' &&
          !c.conflict_type?.includes('STUDENT')
      );

      return valid;
    } catch (err) {
      console.error('Error fetching conflicts:', err);
      return [];
    }
  },

  /**
   * Summary counts for conflicts (ROOM, LECTURER, CAPACITY - NO student conflicts)
   */
  async getStats(versionId?: string) {
    if (!isSupabaseConfigured()) {
      return { total: 0, lecturerConflicts: 0, roomConflicts: 0, capacityConflicts: 0 };
    }

    try {
      const conflicts = await this.getConflicts(versionId, { isResolved: false });
      const total = conflicts.length;
      const lecturerConflicts = conflicts.filter((c) => c.conflict_type === 'LECTURER').length;
      const roomConflicts = conflicts.filter((c) => c.conflict_type === 'ROOM').length;
      const capacityConflicts = conflicts.filter((c) => c.conflict_type === 'CAPACITY').length;

      return { total, lecturerConflicts, roomConflicts, capacityConflicts };
    } catch {
      return { total: 0, lecturerConflicts: 0, roomConflicts: 0, capacityConflicts: 0 };
    }
  },
};
