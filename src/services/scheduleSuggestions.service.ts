import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SmartSuggestion } from '../scheduling/suggestions/types';
import { parseSupabaseError } from '../lib/utils';
import { assertOwnerAdmin } from '../lib/authGuard';

export const scheduleSuggestionsService = {
  /**
   * Fetch stored suggestions for a given schedule version
   */
  async getSuggestions(versionId: string): Promise<SmartSuggestion[]> {
    if (!isSupabaseConfigured() || !versionId) return [];

    try {
      const { data, error } = await supabase
        .from('schedule_suggestions')
        .select('*')
        .eq('schedule_version_id', versionId)
        .order('score', { ascending: false });

      if (error) {
        console.warn('schedule_suggestions query warning:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        scheduleVersionId: row.schedule_version_id,
        conflictId: row.conflict_id,
        scheduleEntryId: row.schedule_entry_id,
        courseOfferingId: row.proposed_change?.courseOfferingId || '',
        courseName: row.proposed_change?.courseName || 'Mata Kuliah',
        courseCode: row.proposed_change?.courseCode,
        classCode: row.proposed_change?.classCode || 'A',
        suggestionType: row.suggestion_type,
        title: row.title || 'Rekomendasi Penyesuaian',
        rationale: row.rationale || '',
        currentPlacement: row.proposed_change?.currentPlacement || {
          dayOfWeek: 1,
          startMinute: 470,
          endMinute: 570,
          roomId: '',
          dayName: 'Senin',
          startTime: '07:50',
          endTime: '09:30',
          roomCode: '',
          roomName: '',
        },
        proposedPlacement: row.proposed_change?.proposedPlacement || {
          dayOfWeek: 1,
          startMinute: 470,
          endMinute: 570,
          roomId: '',
          dayName: 'Senin',
          startTime: '07:50',
          endTime: '09:30',
          roomCode: '',
          roomName: '',
        },
        swapDetails: row.proposed_change?.swapDetails,
        score: row.score ?? 50,
        status: (row.status?.toUpperCase() as any) || 'PENDING',
        impact: row.proposed_change?.impact || {
          resolvedConflictsCount: 1,
          newConflictsCount: 0,
          resolvedConflictTitles: [],
          hardConflictFree: true,
          softCostImprovement: 0,
        },
        createdAt: row.created_at || new Date().toISOString(),
        appliedAt: row.applied_at,
        appliedBy: row.applied_by,
      }));
    } catch (err) {
      console.warn('getSuggestions exception:', err);
      return [];
    }
  },

  /**
   * Save generated suggestions to database
   */
  async saveSuggestions(
    versionId: string,
    suggestions: SmartSuggestion[]
  ): Promise<void> {
    if (!isSupabaseConfigured() || !versionId || suggestions.length === 0) return;

    try {
      const rows = suggestions.map((s) => ({
        id: s.id,
        schedule_version_id: versionId,
        conflict_id: s.conflictId || null,
        schedule_entry_id: s.scheduleEntryId,
        suggestion_type: s.suggestionType,
        title: s.title,
        rationale: s.rationale,
        score: s.score,
        status: s.status,
        proposed_change: {
          courseOfferingId: s.courseOfferingId,
          courseName: s.courseName,
          courseCode: s.courseCode,
          classCode: s.classCode,
          currentPlacement: s.currentPlacement,
          proposedPlacement: s.proposedPlacement,
          swapDetails: s.swapDetails,
          impact: s.impact,
        },
        created_at: s.createdAt || new Date().toISOString(),
      }));

      const { error } = await supabase.from('schedule_suggestions').upsert(rows, {
        onConflict: 'id',
      });

      if (error) {
        console.warn('Failed to upsert suggestions into database:', error);
      }
    } catch (err) {
      console.warn('saveSuggestions exception:', err);
    }
  },

  /**
   * Mark a suggestion as APPLIED
   */
  async applySuggestion(
    suggestionId: string,
    appliedBy?: string
  ): Promise<void> {
    await assertOwnerAdmin('menerapkan rekomendasi jadwal');
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('schedule_suggestions')
        .update({
          status: 'APPLIED',
          applied_at: new Date().toISOString(),
          applied_by: appliedBy || 'Admin',
        })
        .eq('id', suggestionId);

      if (error) {
        console.warn('Failed to update suggestion status to APPLIED:', error);
      }
    } catch (err: any) {
      console.warn('applySuggestion exception:', err);
    }
  },

  /**
   * Mark a suggestion as REJECTED
   */
  async rejectSuggestion(suggestionId: string): Promise<void> {
    await assertOwnerAdmin('menolak rekomendasi jadwal');
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('schedule_suggestions')
        .update({
          status: 'REJECTED',
        })
        .eq('id', suggestionId);

      if (error) {
        console.warn('Failed to update suggestion status to REJECTED:', error);
      }
    } catch (err: any) {
      console.warn('rejectSuggestion exception:', err);
    }
  },
};
