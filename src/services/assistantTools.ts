import { schedulesService } from './schedules.service';
import { scheduleVersionsService } from './scheduleVersions.service';
import { scheduleEntriesService } from './scheduleEntries.service';
import { scheduleConflictsService } from './scheduleConflicts.service';
import { saEvaluationService } from './saEvaluation.service';
import { CurrentPublishedSchedule } from '../types';

export interface AssistantToolContext {
  role: 'PUBLIC' | 'DOSEN' | 'ADMIN';
  termId?: string;
  lecturerId?: string;
  lecturerName?: string;
  selectedPersonalOfferingIds?: string[];
  pageContext?: string;
}

export const assistantTools = {
  /**
   * Safe Tool: Public Published Lecture Schedule
   */
  async getPublicLectureSchedule(searchQuery?: string): Promise<CurrentPublishedSchedule[]> {
    try {
      const list = await schedulesService.getPublishedSchedule();
      if (!searchQuery || !searchQuery.trim()) {
        return list;
      }
      const q = searchQuery.toLowerCase().trim();
      return list.filter((item) => {
        const matchName = item.course_name?.toLowerCase().includes(q);
        const matchCode = item.course_code?.toLowerCase().includes(q);
        const matchRoom = (item.room_name || item.room_code || '').toLowerCase().includes(q);
        const matchLecturer = Array.isArray(item.lecturer_names)
          ? item.lecturer_names.some((l) => l.toLowerCase().includes(q))
          : String(item.lecturer_names || '').toLowerCase().includes(q);
        return matchName || matchCode || matchRoom || matchLecturer;
      });
    } catch {
      return [];
    }
  },

  /**
   * Safe Tool: Public Personal Schedule (reads local selected offering IDs)
   */
  async getPersonalSchedule(selectedIds: string[]): Promise<CurrentPublishedSchedule[]> {
    if (!selectedIds || selectedIds.length === 0) return [];
    try {
      const list = await schedulesService.getPublishedSchedule();
      return list.filter((item) => {
        const key = item.course_offering_id || item.id;
        return selectedIds.includes(key);
      });
    } catch {
      return [];
    }
  },

  /**
   * Safe Tool: Dosen Schedule (Filter by logged-in lecturer)
   */
  async getLecturerSchedule(lecturerId?: string, lecturerName?: string): Promise<CurrentPublishedSchedule[]> {
    try {
      const list = await schedulesService.getPublishedSchedule();
      if (!lecturerId && !lecturerName) return list;

      const nameQ = (lecturerName || '').toLowerCase().trim();
      return list.filter((item) => {
        const lNames = Array.isArray(item.lecturer_names)
          ? item.lecturer_names
          : [String(item.lecturer_names || '')];

        const nameMatch = nameQ ? lNames.some((n) => n.toLowerCase().includes(nameQ)) : false;
        const idMatch = lecturerId ? String(item.course_offering_id || '').includes(lecturerId) : false;

        return nameMatch || idMatch;
      });
    } catch {
      return [];
    }
  },

  /**
   * Safe Tool: Admin Draft Summary & Readiness
   */
  async getAdminDraftReadiness(termId: string) {
    try {
      const draft = await scheduleVersionsService.resolveActiveDraft({
        academicTermId: termId,
        type: 'LECTURE',
      });

      if (!draft) {
        return {
          hasActiveDraft: false,
          message: 'Belum ada draf revisi aktif. Anda dapat membuat draf baru.',
        };
      }

      const entries = await scheduleEntriesService.getEntriesByVersion(draft.id);
      const conflicts = await scheduleConflictsService.detectConflictsForVersion(draft.id);

      const scheduledCount = entries.length;
      const hardConflicts = conflicts.filter((c) => c.severity === 'HARD').length;
      const softConflicts = conflicts.filter((c) => c.severity === 'SOFT').length;

      return {
        hasActiveDraft: true,
        draftId: draft.id,
        versionCode: draft.version_code || draft.title,
        status: draft.status,
        scheduledCount,
        hardConflictsCount: hardConflicts,
        softConflictsCount: softConflicts,
        isPublishReady: scheduledCount > 0 && hardConflicts === 0,
      };
    } catch (err: any) {
      return {
        hasActiveDraft: false,
        error: err.message || 'Gagal memuat status draf aktif.',
      };
    }
  },

  /**
   * Safe Tool: Admin Active Draft Conflicts
   */
  async getAdminActiveConflicts(termId: string) {
    try {
      const draft = await scheduleVersionsService.resolveActiveDraft({
        academicTermId: termId,
        type: 'LECTURE',
      });

      if (!draft) return [];

      const conflicts = await scheduleConflictsService.detectConflictsForVersion(draft.id);
      return conflicts.map((c) => ({
        type: c.conflict_type,
        severity: c.severity,
        description: c.description || c.title,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Safe Tool: Admin SA Optimization Summary
   */
  async getAdminSASummary() {
    try {
      const summary = await saEvaluationService.getEvaluationSummary();
      return {
        totalEvaluations: summary.total_evaluations || 0,
        averageInitialConflicts: summary.avg_initial_conflicts || 0,
        averageFinalConflicts: summary.avg_final_conflicts || 0,
        averageIterations: summary.avg_iterations || 0,
      };
    } catch {
      return {
        totalEvaluations: 0,
        averageInitialConflicts: 0,
        averageFinalConflicts: 0,
        averageIterations: 0,
      };
    }
  },
};
