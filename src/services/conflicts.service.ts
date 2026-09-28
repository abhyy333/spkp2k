import { scheduleConflictsService } from './scheduleConflicts.service';
import { ScheduleConflict, ScheduleSuggestion } from '../types';

export const conflictsService = {
  async getConflicts(filters?: {
    versionId?: string;
    severity?: string;
    type?: string;
    isResolved?: boolean;
  }): Promise<ScheduleConflict[]> {
    return scheduleConflictsService.getConflicts(filters?.versionId, filters);
  },

  async getSuggestions(): Promise<ScheduleSuggestion[]> {
    // Phase 3: automatic suggestion engine is not implemented yet
    return [];
  },

  async getStats(versionId?: string) {
    const stats = await scheduleConflictsService.getStats(versionId);
    return {
      total: stats.total,
      lecturerConflicts: stats.lecturerConflicts,
      roomConflicts: stats.roomConflicts,
      capacityConflicts: stats.capacityConflicts,
    };
  },
};
