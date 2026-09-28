import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ScheduleVersion } from '../types';
import { scheduleVersionsService } from './scheduleVersions.service';

export const versionsService = {
  async getVersions(termId?: string): Promise<ScheduleVersion[]> {
    return scheduleVersionsService.getVersions(termId);
  },

  async updateTitle(versionId: string, title: string): Promise<ScheduleVersion> {
    return scheduleVersionsService.updateVersionTitle(versionId, title);
  },

  async clearDraft(versionId: string): Promise<void> {
    return scheduleVersionsService.clearDraftEntries(versionId);
  },

  async archiveVersion(versionId: string, archive: boolean = true): Promise<ScheduleVersion> {
    return scheduleVersionsService.archiveVersion(versionId, archive);
  },

  async deleteVersion(versionId: string): Promise<void> {
    await scheduleVersionsService.deleteVersion(versionId);
  },

  async bulkDeleteVersions(versionIds: string[]): Promise<{ count: number }> {
    const res = await scheduleVersionsService.bulkDeleteVersions(versionIds);
    return { count: res.count };
  },

  async cleanupEmptyDrafts(termId?: string): Promise<{ deletedCount: number }> {
    return scheduleVersionsService.cleanupEmptyDrafts(termId);
  },

  async getStats(termId?: string) {
    if (!isSupabaseConfigured()) {
      return { total: 0, published: 0, drafts: 0, archived: 0, recentChanges: 0, rollbackAvailable: 0 };
    }

    try {
      const versions = await this.getVersions(termId);
      const total = versions.length;
      const published = versions.filter((v) => v.status === 'PUBLISHED').length;
      const drafts = versions.filter((v) => v.status === 'DRAFT').length;
      const archived = versions.filter((v) => v.status === 'ARCHIVED' || v.status === 'REPLACED').length;
      const recentChanges = versions.filter((v) => {
        const created = new Date(v.created_at).getTime();
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return created > weekAgo;
      }).length;

      return {
        total,
        published,
        drafts,
        archived,
        recentChanges,
        rollbackAvailable: total > 1 ? total - 1 : 0,
      };
    } catch {
      return { total: 0, published: 0, drafts: 0, archived: 0, recentChanges: 0, rollbackAvailable: 0 };
    }
  },
};

