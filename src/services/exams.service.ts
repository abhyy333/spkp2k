import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { parseSupabaseError, minuteToTime } from '../lib/utils';
import { assertOwnerAdmin } from '../lib/authGuard';
import {
  ExamSession,
  ExamEntry,
  ExamDraftEntryInput,
  CurrentPublishedExam,
  ScheduleVersion,
  ExamWorkflowState,
  ExamSourceOffering,
} from '../types';

export const examsService = {
  // ==========================================
  // EXAM SESSIONS CRUD & SYNC
  // ==========================================

  /**
   * Sync exam sessions from lecture time_slots for the given academic term
   */
  async syncExamSessionsFromTimeSlots(academicTermId: string): Promise<ExamSession[]> {
    if (!isSupabaseConfigured() || !academicTermId) return this.getExamSessions();

    try {
      // Clean up any stale legacy 08:00-10:00 sessions first
      try {
        await supabase
          .from('exam_sessions')
          .delete()
          .eq('start_minute', 480)
          .eq('end_minute', 600);
      } catch {
        // ignore if not permitted
      }

      const { error } = await supabase.rpc('sync_exam_sessions_from_time_slots', {
        p_academic_term_id: academicTermId,
      });

      if (error) {
        console.warn('Warning syncing exam_sessions from time_slots:', error);
      }
    } catch (err) {
      console.warn('Exception syncing exam_sessions from time_slots:', err);
    }

    return this.getExamSessions();
  },

  /**
   * Fetch all exam sessions ordered by start_minute, filtering out legacy invalid duplicate sessions
   */
  async getExamSessions(): Promise<ExamSession[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('*')
        .order('start_minute', { ascending: true });

      if (error) {
        console.warn('Error fetching exam_sessions:', error);
        return [];
      }

      const rawSessions = (data || []) as ExamSession[];

      // Filter out erroneous legacy "08:00 - 10:00" (start 480, end 600) sessions and deduplicate
      const validSessions: ExamSession[] = [];
      const seenStarts = new Set<number>();
      const seenNames = new Set<string>();

      for (const s of rawSessions) {
        // Drop legacy 08:00 - 10:00 if present
        if (s.start_minute === 480 && s.end_minute === 600) continue;

        const key = `${s.start_minute}_${s.end_minute}`;
        if (seenStarts.has(s.start_minute)) {
          // If duplicate start minute, prefer active or non-break
          continue;
        }
        seenStarts.add(s.start_minute);
        validSessions.push(s);
      }

      return validSessions;
    } catch (err) {
      console.warn('Exception fetching exam_sessions:', err);
      return [];
    }
  },

  /**
   * Create a new exam session
   */
  async createExamSession(session: {
    name: string;
    start_minute: number;
    end_minute: number;
    is_active?: boolean;
  }): Promise<ExamSession> {
    await assertOwnerAdmin('menambah sesi ujian');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (session.start_minute >= session.end_minute) {
      throw new Error('Jam mulai sesi harus lebih awal dari jam selesai.');
    }

    const { data, error } = await supabase
      .from('exam_sessions')
      .insert({
        name: session.name.trim(),
        start_minute: session.start_minute,
        end_minute: session.end_minute,
        is_active: session.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating exam session:', error);
      throw new Error(parseSupabaseError(error));
    }

    return data as ExamSession;
  },

  /**
   * Update an existing exam session
   */
  async updateExamSession(
    id: string,
    session: Partial<{
      name: string;
      start_minute: number;
      end_minute: number;
      is_active: boolean;
    }>
  ): Promise<ExamSession> {
    await assertOwnerAdmin('mengubah sesi ujian');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (
      session.start_minute !== undefined &&
      session.end_minute !== undefined &&
      session.start_minute >= session.end_minute
    ) {
      throw new Error('Jam mulai sesi harus lebih awal dari jam selesai.');
    }

    const { data, error } = await supabase
      .from('exam_sessions')
      .update({
        ...(session.name ? { name: session.name.trim() } : {}),
        ...(session.start_minute !== undefined ? { start_minute: session.start_minute } : {}),
        ...(session.end_minute !== undefined ? { end_minute: session.end_minute } : {}),
        ...(session.is_active !== undefined ? { is_active: session.is_active } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating exam session:', error);
      throw new Error(parseSupabaseError(error));
    }

    return data as ExamSession;
  },

  /**
   * Delete an exam session
   */
  async deleteExamSession(id: string): Promise<void> {
    await assertOwnerAdmin('menghapus sesi ujian');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const { error } = await supabase.from('exam_sessions').delete().eq('id', id);

    if (error) {
      console.error('Error deleting exam session:', error);
      throw new Error(parseSupabaseError(error));
    }
  },

  // ==========================================
  // EXAM SCHEDULE VERSIONS & LIFECYCLE
  // ==========================================

  /**
   * Get all schedule versions for UTS or UAS
   */
  async getExamVersions(termId: string, examType?: 'UTS' | 'UAS'): Promise<ScheduleVersion[]> {
    if (!isSupabaseConfigured() || !termId) return [];

    try {
      let query = supabase
        .from('schedule_versions')
        .select('*')
        .eq('academic_term_id', termId);

      if (examType) {
        query = query.eq('type', examType);
      } else {
        query = query.in('type', ['UTS', 'UAS']);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching exam versions:', error);
        return [];
      }

      return (data || []).map((v: any) => ({
        ...v,
        term_id: v.academic_term_id || v.term_id,
        academic_term_id: v.academic_term_id || v.term_id,
      })) as ScheduleVersion[];
    } catch (err) {
      console.warn('Exception fetching exam versions:', err);
      return [];
    }
  },

  /**
   * Get latest published exam version
   */
  async getLatestPublishedVersion(
    termId: string,
    examType: 'UTS' | 'UAS'
  ): Promise<ScheduleVersion | null> {
    const list = await this.getExamVersions(termId, examType);
    return list.find((v) => v.status === 'PUBLISHED') || null;
  },

  /**
   * Get single version by ID
   */
  async getVersionById(id: string): Promise<ScheduleVersion | null> {
    if (!isSupabaseConfigured() || !id) return null;

    try {
      const { data, error } = await supabase
        .from('schedule_versions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return null;
      return {
        ...data,
        term_id: data.academic_term_id || data.term_id,
        academic_term_id: data.academic_term_id || data.term_id,
      } as ScheduleVersion;
    } catch {
      return null;
    }
  },

  /**
   * Create a new draft for UTS or UAS using backend RPC
   */
  async createExamDraft(
    termId: string,
    examType: 'UTS' | 'UAS',
    title?: string,
    copyFromId?: string | null
  ): Promise<ScheduleVersion> {
    await assertOwnerAdmin('membuat draf jadwal ujian');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const defaultTitle = title?.trim() || `Jadwal ${examType} Draft`;

    const { data, error } = await supabase.rpc('create_schedule_draft', {
      p_term_id: termId,
      p_type: examType,
      p_title: defaultTitle,
      p_copy_from: copyFromId || null,
    });

    if (error) {
      console.error('Error create_schedule_draft RPC for exam:', error);
      throw new Error(parseSupabaseError(error));
    }

    const createdId = typeof data === 'string' ? data : (data?.id || (data as any)?.version_id);
    if (createdId) {
      const version = await this.getVersionById(createdId);
      if (version) return version;
    }

    if (data && typeof data === 'object') {
      return {
        id: data.id || data.version_id || createdId || 'exam-draft-version',
        term_id: termId,
        academic_term_id: termId,
        version_number: String(data.version_number || 1),
        revision: Number(data.revision || 1),
        title: defaultTitle,
        type: examType,
        status: 'DRAFT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...data,
      } as ScheduleVersion;
    }

    throw new Error('Gagal membuat atau memuat draf jadwal ujian.');
  },

  /**
   * Sync exam scope (eligible offerings) from published lecture schedule
   * Fallbacks to active term course offerings if lecture schedule is not yet published.
   */
  async syncExamScopeFromPublishedLecture(
    examVersionId: string,
    expectedRevision: number
  ): Promise<{ revision: number; offering_count: number }> {
    await assertOwnerAdmin('mensinkronkan lingkup jadwal ujian dari jadwal kuliah');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    try {
      const { data, error } = await supabase.rpc('sync_exam_scope_from_published_lecture', {
        p_exam_version_id: examVersionId,
        p_expected_revision: expectedRevision,
      });

      if (!error && data) {
        if (typeof data === 'object') {
          return {
            revision: Number(data.revision ?? expectedRevision),
            offering_count: Number(data.offering_count ?? data.count ?? 0),
          };
        }
        return {
          revision: typeof data === 'number' ? data : expectedRevision,
          offering_count: 0,
        };
      }

      // If error is not PUBLISHED_LECTURE_SCHEDULE_REQUIRED or code P0001, log warning
      if (
        error &&
        !error.message?.includes('PUBLISHED_LECTURE_SCHEDULE_REQUIRED') &&
        error.code !== 'P0001'
      ) {
        console.warn('sync_exam_scope_from_published_lecture RPC notice:', error.message);
      }
    } catch (err: any) {
      if (
        !err?.message?.includes('PUBLISHED_LECTURE_SCHEDULE_REQUIRED') &&
        err?.code !== 'P0001'
      ) {
        console.warn('sync_exam_scope exception notice:', err);
      }
    }

    // Fallback: Sync scope directly from course_offerings for this term
    try {
      const { data: examVer } = await supabase
        .from('schedule_versions')
        .select('id, academic_term_id, revision, scope_offering_ids')
        .eq('id', examVersionId)
        .maybeSingle();

      const termId = examVer?.academic_term_id;
      if (!termId) {
        return { revision: expectedRevision, offering_count: 0 };
      }

      const { data: offerings } = await supabase
        .from('course_offerings')
        .select('id')
        .eq('academic_term_id', termId);

      const offeringIds = (offerings || []).map((o: any) => o.id);
      const nextRev = (examVer?.revision || expectedRevision || 1) + 1;

      if (offeringIds.length > 0) {
        await supabase
          .from('schedule_versions')
          .update({
            scope_offering_ids: offeringIds,
            revision: nextRev,
            updated_at: new Date().toISOString(),
          })
          .eq('id', examVersionId);
      }

      return {
        revision: nextRev,
        offering_count: offeringIds.length,
      };
    } catch (fallbackErr: any) {
      console.warn('Fallback sync exam scope notice:', fallbackErr);
      return { revision: expectedRevision, offering_count: 0 };
    }
  },

  /**
   * Get exam source offerings from published lecture schedule.
   * If lecture schedule is not yet published, falls back to direct query on active term course offerings.
   */
  async getExamSourceOfferings(examVersionId: string): Promise<ExamSourceOffering[]> {
    if (!isSupabaseConfigured() || !examVersionId) return [];

    try {
      const { data, error } = await supabase.rpc('get_exam_source_offerings', {
        p_exam_version_id: examVersionId,
      });

      if (!error && data && Array.isArray(data) && data.length > 0) {
        return data.map((row: any) => ({
          schedule_entry_id: row.schedule_entry_id || row.id || '',
          course_offering_id: row.course_offering_id || '',
          course_code: row.course_code || '',
          course_name: row.course_name || 'Mata Kuliah',
          class_code: row.class_code || 'A',
          semester: Number(row.semester || 1),
          effective_sks: Number(row.effective_sks || row.sks || 3),
          student_count: Number(row.student_count || row.expected_students || 40),
          required_room_type: row.required_room_type || 'TEORI',
          primary_lecturer_id: row.primary_lecturer_id || '',
          primary_lecturer_name: row.primary_lecturer_name || 'Dosen Pengampu',
          preferred_room_id: row.preferred_room_id || null,
          preferred_room_code: row.preferred_room_code || null,
          preferred_room_name: row.preferred_room_name || null,
          preferred_room_capacity: row.preferred_room_capacity ? Number(row.preferred_room_capacity) : null,
        })) as ExamSourceOffering[];
      }

      if (
        error &&
        !error.message?.includes('PUBLISHED_LECTURE_SCHEDULE_REQUIRED') &&
        error.code !== 'P0001'
      ) {
        console.warn('get_exam_source_offerings RPC notice:', error.message);
      }
    } catch (err: any) {
      if (
        !err?.message?.includes('PUBLISHED_LECTURE_SCHEDULE_REQUIRED') &&
        err?.code !== 'P0001'
      ) {
        console.warn('Exception get_exam_source_offerings RPC:', err);
      }
    }

    // Resilient Fallback: Query course offerings for this academic term directly
    try {
      const { data: examVer } = await supabase
        .from('schedule_versions')
        .select('id, academic_term_id, scope_offering_ids')
        .eq('id', examVersionId)
        .maybeSingle();

      const termId = examVer?.academic_term_id;
      if (!termId) return [];

      let query = supabase
        .from('course_offerings')
        .select(`
          id,
          class_code,
          expected_students,
          required_room_type,
          course:course_id ( id, name, code, effective_sks, semester ),
          course_offering_lecturers (
            lecturer_id,
            assignment_role,
            lecturer:lecturer_id ( id, name )
          )
        `)
        .eq('academic_term_id', termId);

      if (examVer.scope_offering_ids && examVer.scope_offering_ids.length > 0) {
        query = query.in('id', examVer.scope_offering_ids);
      }

      const { data: directOfferings, error: directErr } = await query;
      if (directErr || !directOfferings) {
        return [];
      }

      // Check if any schedule entries exist in lecture versions to retrieve preferred rooms
      const offeringIds = directOfferings.map((o: any) => o.id);
      const roomMap = new Map<string, any>();

      if (offeringIds.length > 0) {
        const { data: lectureEntries } = await supabase
          .from('schedule_entries')
          .select(`
            course_offering_id,
            room_id,
            room:room_id ( id, name, code, capacity )
          `)
          .in('course_offering_id', offeringIds);

        (lectureEntries || []).forEach((e: any) => {
          if (e.course_offering_id && e.room) {
            roomMap.set(e.course_offering_id, e.room);
          }
        });
      }

      return directOfferings.map((row: any) => {
        const primaryCol = (row.course_offering_lecturers || []).find(
          (col: any) => col.assignment_role === 'PRIMARY'
        ) || (row.course_offering_lecturers || [])[0];

        const roomObj = roomMap.get(row.id);

        return {
          schedule_entry_id: `entry-${row.id}`,
          course_offering_id: row.id,
          course_code: row.course?.code || '',
          course_name: row.course?.name || 'Mata Kuliah',
          class_code: row.class_code || 'A',
          semester: Number(row.course?.semester || 1),
          effective_sks: Number(row.course?.effective_sks || 3),
          student_count: Number(row.expected_students || 40),
          required_room_type: row.required_room_type || 'TEORI',
          primary_lecturer_id: primaryCol?.lecturer?.id || primaryCol?.lecturer_id || '',
          primary_lecturer_name: primaryCol?.lecturer?.name || 'Dosen Pengampu',
          preferred_room_id: roomObj?.id || null,
          preferred_room_code: roomObj?.code || null,
          preferred_room_name: roomObj?.name || null,
          preferred_room_capacity: roomObj?.capacity ? Number(roomObj.capacity) : null,
        } as ExamSourceOffering;
      });
    } catch (fallbackErr: any) {
      console.warn('Fallback getExamSourceOfferings error:', fallbackErr);
      return [];
    }
  },

  /**
   * Save workflow state for exam version
   */
  async saveWorkflowState(
    versionId: string,
    expectedRevision: number,
    state: Partial<ExamWorkflowState>
  ): Promise<number> {
    if (!isSupabaseConfigured() || !versionId) return expectedRevision;

    try {
      const { data, error } = await supabase.rpc('save_schedule_workflow_state', {
        p_version_id: versionId,
        p_expected_revision: expectedRevision,
        p_state: state,
      });

      if (error) {
        console.warn('Warning saving exam workflow state:', error);
        return expectedRevision;
      }

      return typeof data === 'number' ? data : (data?.revision ?? expectedRevision);
    } catch (err) {
      console.warn('Exception saving exam workflow state:', err);
      return expectedRevision;
    }
  },

  /**
   * Save draft exam entries using backend RPC save_exam_draft_entries
   */
  async saveExamDraftEntries(
    versionId: string,
    expectedRevision: number,
    entries: ExamDraftEntryInput[],
    reason: string = 'Penyusunan jadwal ujian'
  ): Promise<{ revision: number; version?: ScheduleVersion }> {
    await assertOwnerAdmin('menyimpan draf jadwal ujian');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const cleanEntries = entries.map((e) => ({
      course_offering_id: e.course_offering_id,
      exam_session_id: e.exam_session_id,
      exam_date: e.exam_date,
      duration_minutes: Number(e.duration_minutes),
      room_ids: Array.isArray(e.room_ids) ? e.room_ids : [],
      supervisor_ids: Array.isArray(e.supervisor_ids) ? e.supervisor_ids : [],
      notes: e.notes || null,
    }));

    const { data, error } = await supabase.rpc('save_exam_draft_entries', {
      p_version_id: versionId,
      p_expected_revision: expectedRevision,
      p_entries: cleanEntries,
      p_reason: reason.trim() || 'Penyusunan jadwal ujian',
    });

    if (error) {
      console.error('Error save_exam_draft_entries RPC:', error);
      throw new Error(parseSupabaseError(error));
    }

    const newRev = typeof data === 'number' ? data : (data?.revision || expectedRevision + 1);
    const updatedVersion = await this.getVersionById(versionId);

    return {
      revision: newRev,
      version: updatedVersion || undefined,
    };
  },

  /**
   * Publish exam schedule version using backend RPC publish_schedule_version
   * Always fetches fresh revision directly from schedule_versions to prevent STALE_REVISION.
   */
  async publishExamVersion(
    versionId: string,
    expectedRevision?: number
  ): Promise<ScheduleVersion> {
    await assertOwnerAdmin('mempublikasikan jadwal ujian resmi');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    // 1. Fetch fresh version directly from database
    const { data: freshVersion, error: versionError } = await supabase
      .from('schedule_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError || !freshVersion) {
      throw new Error('Gagal mengambil data versi jadwal ujian terbaru.');
    }

    // If already published, return immediately
    if (freshVersion.status === 'PUBLISHED') {
      return {
        ...freshVersion,
        academic_term_id: freshVersion.academic_term_id || freshVersion.term_id,
        term_id: freshVersion.academic_term_id || freshVersion.term_id,
      } as ScheduleVersion;
    }

    if (freshVersion.status !== 'DRAFT') {
      throw new Error('Hanya draf jadwal ujian yang dapat diterbitkan.');
    }

    const revisionToUse = freshVersion.revision;

    // 2. Call publish RPC with fresh revision exactly once
    const { error: publishError } = await supabase.rpc('publish_schedule_version', {
      p_version_id: freshVersion.id,
      p_expected_revision: revisionToUse,
    });

    if (publishError) {
      console.error('Error publish_schedule_version RPC for exam:', publishError);

      // Check if it actually succeeded despite network error or timeout
      const doubleCheck = await this.getVersionById(versionId);
      if (doubleCheck && doubleCheck.status === 'PUBLISHED') {
        return doubleCheck;
      }

      const msg = publishError.message || '';
      if (msg.includes('STALE_REVISION')) {
        throw new Error('Data jadwal telah berubah. Silakan tekan Terbitkan kembali.');
      }

      throw new Error(parseSupabaseError(publishError));
    }

    const updated = await this.getVersionById(versionId);
    if (!updated) {
      throw new Error('Jadwal ujian berhasil dipublikasikan, namun gagal memuat status terbaru.');
    }

    return updated;
  },

  /**
   * Fetch draft exam entries for a version
   */
  async getExamEntriesByVersion(versionId: string): Promise<ExamEntry[]> {
    if (!isSupabaseConfigured() || !versionId) return [];

    try {
      const { data, error } = await supabase
        .from('exam_entries')
        .select('*')
        .eq('schedule_version_id', versionId)
        .order('exam_date', { ascending: true })
        .order('start_minute', { ascending: true });

      if (error) {
        console.warn('Error fetching exam_entries by version:', error);
        return [];
      }

      return (data || []) as ExamEntry[];
    } catch (err) {
      console.warn('Exception fetching exam_entries:', err);
      return [];
    }
  },

  /**
   * Fetch official published exams from view public.current_published_exams
   */
  async getPublishedExams(
    academicTermId?: string,
    examType?: 'UTS' | 'UAS'
  ): Promise<CurrentPublishedExam[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      let query = supabase.from('current_published_exams').select('*');

      if (academicTermId) {
        query = query.eq('academic_term_id', academicTermId);
      }
      if (examType) {
        query = query.eq('type', examType);
      }

      const { data, error } = await query
        .order('exam_date', { ascending: true })
        .order('start_minute', { ascending: true });

      if (error) {
        console.warn('Notice querying current_published_exams view:', error.message || error);

        // Fallback: Try Security Definer RPC
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc(
            'get_current_published_exams',
            {
              p_academic_term_id: academicTermId || null,
              p_type: examType || null,
            }
          );
          if (!rpcErr && rpcData && Array.isArray(rpcData)) {
            return rpcData;
          }
        } catch (_) {}

        return [];
      }

      const mapped = (data || []).map((row: any) => ({
        ...row,
        id: row.id,
        schedule_version_id: row.schedule_version_id,
        course_offering_id: row.course_offering_id,
        exam_session_id: row.exam_session_id,
        exam_type: row.type || 'UTS',
        type: row.type || 'UTS',
        date: row.exam_date || '',
        exam_date: row.exam_date || '',
        start_time: row.start_minute !== undefined ? minuteToTime(row.start_minute) : '',
        end_time: row.end_minute !== undefined ? minuteToTime(row.end_minute) : '',
        start_minute: row.start_minute,
        end_minute: row.end_minute,
        duration_minutes: row.duration_minutes,
        course_name: row.course_name || 'Mata Kuliah',
        course_code: row.course_code || '',
        class_name: row.class_code || 'A',
        class_code: row.class_code || 'A',
        class_keys: row.class_keys,
        room_code: (row.room_names && row.room_names[0]) || 'Ruang ?',
        room_name: (row.room_names && row.room_names.join(' + ')) || '',
        room_ids: row.room_ids || [],
        room_names: row.room_names || [],
        room_capacity: row.room_capacity,
        student_count: row.student_count,
        proctor_names: (row.supervisor_names && row.supervisor_names.join(', ')) || '',
        supervisor_names: row.supervisor_names || [],
        supervisor_ids: row.supervisor_ids || [],
        lecturer_names: row.lecturer_names || [],
        lecturer_ids: row.lecturer_ids || [],
        notes: row.notes,
        academic_term_id: row.academic_term_id,
        version_number: row.version_number,
        published_at: row.published_at,
        status: 'Terjadwal',
      })) as CurrentPublishedExam[];

      try {
        if (mapped.length > 0 && !academicTermId && !examType) {
          localStorage.setItem('spk:cached-published-exams', JSON.stringify(mapped));
        } else if (mapped.length === 0) {
          localStorage.removeItem('spk:cached-published-exams');
        }
      } catch (_) {}

      return mapped;
    } catch (err) {
      console.warn('Notice fetching published exams:', err);
      return [];
    }
  },
};
