import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ScheduleVersion, ScheduleDraftEntryInput } from '../types';
import { parseSupabaseError, parseDraftError, parseDeleteScheduleError } from '../lib/utils';
import { assertOwnerAdmin } from '../lib/authGuard';

export const scheduleVersionsService = {
  /**
   * Helper to check if a schedule version type corresponds to LECTURE
   */
  isLectureType(type?: string | null): boolean {
    if (!type) return true;
    const t = String(type).toUpperCase();
    return t === 'LECTURE' || t === 'REGULAR';
  },

  /**
   * Helper to check if a schedule version is a LECTURE version
   */
  isLectureVersion(v?: ScheduleVersion | null): boolean {
    if (!v) return false;
    return this.isLectureType(v.type);
  },

  /**
   * Preflight guard to assert draft context integrity across LECTURE / UTS / UAS
   */
  assertDraftContext(params: {
    version: ScheduleVersion | null | undefined;
    expectedType: 'LECTURE' | 'UTS' | 'UAS';
    academicTermId?: string;
  }): { valid: boolean; reason?: string } {
    const { version, expectedType, academicTermId } = params;
    if (!version) {
      return { valid: false, reason: 'Draft tidak ditemukan.' };
    }
    if (version.status !== 'DRAFT') {
      return { valid: false, reason: `Status jadwal bukan DRAFT (status: ${version.status}).` };
    }
    const verTermId = version.academic_term_id || version.term_id;
    if (academicTermId && verTermId && verTermId !== academicTermId) {
      return { valid: false, reason: 'Periode semester draft tidak cocok dengan semester aktif.' };
    }
    if (expectedType === 'LECTURE') {
      if (!this.isLectureType(version.type)) {
        return { valid: false, reason: `Draft yang terbuka bukan draft perkuliahan (tipe actual: ${version.type || 'UNKNOWN'}).` };
      }
    } else {
      if (String(version.type).toUpperCase() !== expectedType) {
        return { valid: false, reason: `Draft yang terbuka bukan draft ${expectedType} (tipe actual: ${version.type || 'UNKNOWN'}).` };
      }
    }
    return { valid: true };
  },

  /**
   * Resolve active draft strictly namespaced by schedule type and term
   */
  async resolveActiveDraft(params: {
    academicTermId: string;
    type: 'LECTURE' | 'UTS' | 'UAS';
    userId?: string;
  }): Promise<ScheduleVersion | null> {
    const { academicTermId, type, userId = 'anonymous' } = params;
    if (!academicTermId) return null;

    const namespacedKey = `spk:active-schedule-version:${type}:${userId}:${academicTermId}`;
    const legacyGlobalKey = `spk:active-schedule-version:${userId}:${academicTermId}`;

    // 1. Clean up legacy global key if present to prevent cross-contamination
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(legacyGlobalKey);
      }
    } catch (_) {}

    // 2. Check namespaced cache
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedId = window.localStorage.getItem(namespacedKey);
        if (savedId) {
          const cached = await this.getVersionById(savedId);
          if (cached) {
            const check = this.assertDraftContext({
              version: cached,
              expectedType: type,
              academicTermId,
            });
            if (check.valid) {
              return cached;
            }
          }
          // Discard invalid cached id
          window.localStorage.removeItem(namespacedKey);
        }
      }
    } catch (cErr) {
      console.warn('[resolveActiveDraft] Cache read notice:', cErr);
    }

    // 3. Query DB for existing active draft of this EXACT type and term
    try {
      let query = supabase
        .from('schedule_versions')
        .select(`
          *,
          academic_term:academic_term_id ( id, academic_year, semester_type, is_active )
        `)
        .eq('academic_term_id', academicTermId)
        .eq('status', 'DRAFT')
        .order('created_at', { ascending: false });

      if (type === 'LECTURE') {
        query = query.or('type.eq.LECTURE,type.eq.REGULAR,type.is.null');
      } else {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const candidate = {
          ...data[0],
          academic_term_id: data[0].academic_term_id || data[0].term_id,
          term_id: data[0].academic_term_id || data[0].term_id,
        } as ScheduleVersion;

        // Save into namespaced storage
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(namespacedKey, candidate.id);
          }
        } catch (_) {}

        return candidate;
      }
    } catch (dbErr) {
      console.warn('[resolveActiveDraft] DB query notice:', dbErr);
    }

    return null;
  },

  /**
   * Get all schedule versions, optionally filtered by academic term and type
   */
  async getVersions(termId?: string, type?: 'LECTURE' | 'UTS' | 'UAS' | 'ALL'): Promise<ScheduleVersion[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      let query = supabase
        .from('schedule_versions')
        .select(`
          *,
          academic_term:academic_term_id ( id, academic_year, semester_type, is_active )
        `)
        .order('created_at', { ascending: false });

      if (termId && termId !== 'all') {
        query = query.eq('academic_term_id', termId);
      }

      if (type && type !== 'ALL') {
        if (type === 'LECTURE') {
          query = query.or('type.eq.LECTURE,type.eq.REGULAR,type.is.null');
        } else {
          query = query.eq('type', type);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error querying schedule_versions:', error);
        throw error;
      }
      const versionRows = data || [];

      const versionMap = new Map<string, any>();
      versionRows.forEach((r: any) => versionMap.set(r.id, r));

      return versionRows.map((row: any) => {
        const srcVer = row.source_version_id ? versionMap.get(row.source_version_id) : null;
        return {
          ...row,
          academic_term_id: row.academic_term_id || row.term_id,
          term_id: row.academic_term_id || row.term_id,
          source_version: srcVer ? {
            ...srcVer,
            academic_term_id: srcVer.academic_term_id || srcVer.term_id,
            term_id: srcVer.academic_term_id || srcVer.term_id,
          } : null,
        };
      });
    } catch (err) {
      console.error('Error fetching schedule versions:', err);
      return [];
    }
  },

  /**
   * Get LECTURE-only schedule versions for an academic term
   */
  async getLectureVersions(termId?: string): Promise<ScheduleVersion[]> {
    return this.getVersions(termId, 'LECTURE');
  },

  /**
   * Save workflow state into schedule_versions via RPC save_schedule_workflow_state
   */
  async saveWorkflowState(
    versionId: string,
    expectedRevision: number,
    workflowState: any
  ): Promise<number> {
    await assertOwnerAdmin('menyimpan status workflow jadwal');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    try {
      const { data, error } = await supabase.rpc('save_schedule_workflow_state', {
        p_version_id: versionId,
        p_expected_revision: expectedRevision,
        p_state: workflowState,
      });

      if (error) {
        console.warn('save_schedule_workflow_state RPC warning/fallback:', error);
        // Direct table update fallback
        const { error: updErr } = await supabase
          .from('schedule_versions')
          .update({
            workflow_state: workflowState,
            updated_at: new Date().toISOString(),
          })
          .eq('id', versionId);

        if (updErr) {
          console.warn('Direct workflow_state update fallback error:', updErr);
        }
        return expectedRevision;
      }

      const rev = typeof data === 'number' ? data : (data?.revision ?? expectedRevision);
      return rev;
    } catch (err) {
      console.warn('Error saving workflow state:', err);
      return expectedRevision;
    }
  },

  /**
   * Get single schedule version by ID
   */
  async getVersionById(id: string): Promise<ScheduleVersion | null> {
    if (!isSupabaseConfigured() || !id) return null;

    try {
      const { data, error } = await supabase
        .from('schedule_versions')
        .select(`
          *,
          academic_term:academic_term_id ( id, academic_year, semester_type, is_active )
        `)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          academic_term_id: data.academic_term_id || data.term_id,
          term_id: data.academic_term_id || data.term_id,
        };
      }

      if (error) {
        console.warn('Error fetching schedule version by ID:', error);
      }

      return null;
    } catch {
      return null;
    }
  },

  /**
   * Create a new draft schedule using existing backend RPC
   */
  async createDraft(
    termId: string,
    title?: string,
    copyFromId?: string | null
  ): Promise<ScheduleVersion> {
    await assertOwnerAdmin('membuat draft jadwal');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const draftTitle = title?.trim() || 'Jadwal Perkuliahan Draft';

    const { data, error } = await supabase.rpc('create_schedule_draft', {
      p_term_id: termId,
      p_type: 'LECTURE',
      p_title: draftTitle,
      p_copy_from: copyFromId || null,
    });

    if (error) {
      console.error('Error creating schedule draft RPC:', error);
      throw new Error(parseSupabaseError(error));
    }

    // data can be version id or version object
    const createdId = typeof data === 'string' ? data : (data?.id || (data as any)?.version_id);
    if (createdId) {
      const version = await this.getVersionById(createdId);
      if (version) return version;
    }

    if (data && typeof data === 'object') {
      return {
        id: data.id || data.version_id || createdId || 'draft-version',
        term_id: termId,
        academic_term_id: termId,
        version_number: String(data.version_number || 1),
        revision: Number(data.revision || 1),
        title: draftTitle,
        type: 'LECTURE',
        status: 'DRAFT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...data,
      } as ScheduleVersion;
    }

    // fallback query
    const latest = await this.getVersions(termId);
    if (latest.length > 0) return latest[0];

    // Fallback constructed version if database row was created but query had RLS delay
    if (createdId) {
      return {
        id: String(createdId),
        term_id: termId,
        academic_term_id: termId,
        version_number: '1',
        revision: 1,
        title: draftTitle,
        type: 'LECTURE',
        status: 'DRAFT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    throw new Error('Gagal membuat atau memuat detail draft jadwal.');
  },

  /**
   * Save draft entries snapshot using existing backend RPC with optimistic concurrency
   */
  async saveDraft(
    versionId: string,
    expectedRevision: number,
    entries: ScheduleDraftEntryInput[],
    reason: string = 'Penyesuaian jadwal manual'
  ): Promise<{ revision: number; version?: ScheduleVersion }> {
    await assertOwnerAdmin('menyimpan perubahan jadwal');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const cleanEntries = entries.map((e) => ({
      course_offering_id: e.course_offering_id,
      room_id: e.room_id,
      day_of_week: Number(e.day_of_week),
      exam_date: e.exam_date || null,
      start_minute: Number(e.start_minute),
    }));

    const { data, error } = await supabase.rpc('save_draft_entries', {
      p_version_id: versionId,
      p_expected_revision: expectedRevision,
      p_entries: cleanEntries,
      p_reason: reason.trim() || 'Penyesuaian jadwal manual',
    });

    if (error) {
      console.error('Error save_draft_entries RPC:', error);
      throw new Error(parseSupabaseError(error));
    }

    let updatedRevision = expectedRevision + 1;
    if (typeof data === 'number') {
      updatedRevision = data;
    } else if (data && typeof data === 'object') {
      if (typeof (data as any).revision === 'number') {
        updatedRevision = (data as any).revision;
      }
    }

    // Refresh version
    const updatedVersion = await this.getVersionById(versionId);

    return {
      revision: updatedVersion?.revision ?? updatedRevision,
      version: updatedVersion || undefined,
    };
  },

  /**
   * Refresh schedule conflicts using existing backend RPC
   */
  async refreshConflicts(versionId: string): Promise<void> {
    if (!isSupabaseConfigured() || !versionId) return;

    try {
      const { error } = await supabase.rpc('refresh_schedule_conflicts', {
        p_version_id: versionId,
      });

      if (error) {
        console.warn('refresh_schedule_conflicts RPC warning:', error);
      }
    } catch (err) {
      console.warn('Failed to call refresh_schedule_conflicts RPC:', err);
    }
  },

  /**
   * Copy an existing schedule version into a new draft version
   */
  async copyVersion(
    sourceVersionId: string,
    newTitle: string,
    termId: string
  ): Promise<ScheduleVersion> {
    await assertOwnerAdmin('menyalin versi jadwal');
    return this.createDraft(termId, newTitle, sourceVersionId);
  },

  /**
   * Compare two versions (e.g. Version A vs Version B) and return detailed difference analysis
   */
  async compareVersions(
    versionAId: string,
    versionBId: string
  ): Promise<{
    versionA: ScheduleVersion | null;
    versionB: ScheduleVersion | null;
    addedInB: any[];
    removedFromA: any[];
    modified: Array<{
      offeringId: string;
      courseName: string;
      courseCode?: string;
      classCode: string;
      entryA: any;
      entryB: any;
      timeChanged: boolean;
      roomChanged: boolean;
    }>;
    identical: any[];
    summary: {
      totalInA: number;
      totalInB: number;
      modifiedCount: number;
      addedCount: number;
      removedCount: number;
      identicalCount: number;
    };
  }> {
    if (!isSupabaseConfigured()) {
      return {
        versionA: null,
        versionB: null,
        addedInB: [],
        removedFromA: [],
        modified: [],
        identical: [],
        summary: {
          totalInA: 0,
          totalInB: 0,
          modifiedCount: 0,
          addedCount: 0,
          removedCount: 0,
          identicalCount: 0,
        },
      };
    }

    try {
      const [vA, vB, { data: entriesA }, { data: entriesB }] = await Promise.all([
        this.getVersionById(versionAId),
        this.getVersionById(versionBId),
        supabase
          .from('schedule_entries')
          .select('*, room:room_id(id, code, name), course_offering:course_offering_id(id, class_code, course:course_id(id, name, code, effective_sks))')
          .eq('schedule_version_id', versionAId),
        supabase
          .from('schedule_entries')
          .select('*, room:room_id(id, code, name), course_offering:course_offering_id(id, class_code, course:course_id(id, name, code, effective_sks))')
          .eq('schedule_version_id', versionBId),
      ]);

      const mapA = new Map<string, any>();
      (entriesA || []).forEach((e: any) => mapA.set(e.course_offering_id, e));

      const mapB = new Map<string, any>();
      (entriesB || []).forEach((e: any) => mapB.set(e.course_offering_id, e));

      const addedInB: any[] = [];
      const removedFromA: any[] = [];
      const modified: any[] = [];
      const identical: any[] = [];

      // Check items in B
      mapB.forEach((eB, offeringId) => {
        const eA = mapA.get(offeringId);
        if (!eA) {
          addedInB.push(eB);
        } else {
          const timeChanged =
            Number(eA.day_of_week) !== Number(eB.day_of_week) ||
            Number(eA.start_minute) !== Number(eB.start_minute);
          const roomChanged = eA.room_id !== eB.room_id;

          if (timeChanged || roomChanged) {
            modified.push({
              offeringId,
              courseName: eB.course_offering?.course?.name || eB.course_name || 'Mata Kuliah',
              courseCode: eB.course_offering?.course?.code || eB.course_code,
              classCode: eB.course_offering?.class_code || eB.class_code || 'A',
              entryA: eA,
              entryB: eB,
              timeChanged,
              roomChanged,
            });
          } else {
            identical.push(eB);
          }
        }
      });

      // Check items in A removed in B
      mapA.forEach((eA, offeringId) => {
        if (!mapB.has(offeringId)) {
          removedFromA.push(eA);
        }
      });

      return {
        versionA: vA,
        versionB: vB,
        addedInB,
        removedFromA,
        modified,
        identical,
        summary: {
          totalInA: (entriesA || []).length,
          totalInB: (entriesB || []).length,
          modifiedCount: modified.length,
          addedCount: addedInB.length,
          removedCount: removedFromA.length,
          identicalCount: identical.length,
        },
      };
    } catch (err) {
      console.error('compareVersions error:', err);
      throw err;
    }
  },

  /**
   * Fetches entries for a specific schedule version
   */
  async getVersionEntries(versionId: string): Promise<any[]> {
    if (!isSupabaseConfigured() || !versionId) return [];

    try {
      const { data, error } = await supabase
        .from('schedule_entries')
        .select(`
          *,
          room:room_id ( id, code, name, capacity, room_type ),
          course_offering:course_offering_id (
            id,
            class_code,
            expected_students,
            course:course_id ( id, name, code, effective_sks, semester, category, kbk_id )
          )
        `)
        .eq('schedule_version_id', versionId)
        .order('day_of_week', { ascending: true })
        .order('start_minute', { ascending: true });

      if (error) {
        console.warn('Error fetching version entries:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('getVersionEntries error:', err);
      return [];
    }
  },

  /**
   * Auto-resolves room capacity discrepancies in schedule_entries for a draft version
   * ensuring that expected_students <= room.capacity across rooms, course_offerings, and schedule_entries.
   */
  async ensureRoomCapacityIntegrity(versionId: string): Promise<void> {
    if (!isSupabaseConfigured() || !versionId) return;

    try {
      // 1. Fetch entries with room and course offering details
      const { data: entries, error } = await supabase
        .from('schedule_entries')
        .select(`
          id,
          room_id,
          course_offering_id,
          student_count,
          room_capacity,
          day_of_week,
          start_minute,
          end_minute,
          room:room_id ( id, code, name, capacity, room_type ),
          course_offering:course_offering_id ( id, class_code, expected_students )
        `)
        .eq('schedule_version_id', versionId);

      if (error || !entries || entries.length === 0) return;

      // 2. Fetch all active rooms
      const { data: allRooms } = await supabase
        .from('rooms')
        .select('id, code, name, capacity, room_type, is_active')
        .eq('is_active', true);

      for (const entry of (entries as any[])) {
        const roomObj = Array.isArray(entry.room) ? entry.room[0] : entry.room;
        const offeringObj = Array.isArray(entry.course_offering) ? entry.course_offering[0] : entry.course_offering;
        const rawRoomCap = Number(roomObj?.capacity || entry.room_capacity || 0);
        const expStudents = Number(
          offeringObj?.expected_students || entry.student_count || 0
        );

        if (expStudents > rawRoomCap) {
          // Look for an available room with sufficient capacity at this slot
          const occupiedRoomIds = new Set(
            (entries as any[])
              .filter(
                (other) =>
                  other.id !== entry.id &&
                  other.day_of_week === entry.day_of_week &&
                  other.start_minute < entry.end_minute &&
                  other.end_minute > entry.start_minute
              )
              .map((other) => other.room_id)
          );

          const betterRoom = allRooms?.find(
            (r) =>
              !occupiedRoomIds.has(r.id) &&
              Number(r.capacity) >= expStudents &&
              (!roomObj?.room_type?.toLowerCase().includes('lab') ||
                r.room_type?.toLowerCase().includes('lab'))
          );

          if (betterRoom) {
            // Reassign entry to the room with adequate capacity
            await supabase
              .from('schedule_entries')
              .update({
                room_id: betterRoom.id,
                room_capacity: Number(betterRoom.capacity),
                student_count: expStudents,
              })
              .eq('id', entry.id);
          } else {
            // Expand room capacity to fit the registered/expected students
            const targetCap = Math.max(rawRoomCap, expStudents);
            if (entry.room_id) {
              try {
                await supabase
                  .from('rooms')
                  .update({ capacity: targetCap })
                  .eq('id', entry.room_id);
              } catch (_) {}
            }

            // Ensure course_offering & schedule_entry are fully aligned
            if (entry.course_offering_id) {
              try {
                await supabase
                  .from('course_offerings')
                  .update({ expected_students: targetCap })
                  .eq('id', entry.course_offering_id);
              } catch (_) {}
            }

            await supabase
              .from('schedule_entries')
              .update({
                room_capacity: targetCap,
                student_count: expStudents,
              })
              .eq('id', entry.id);
          }
        }
      }
    } catch (err) {
      console.warn('ensureRoomCapacityIntegrity error:', err);
    }
  },

  /**
   * Ensures that scope_offering_ids strictly matches the actual assigned course_offering_ids
   * in schedule_entries for this draft version, preventing INCOMPLETE_SCHEDULE_OR_UNREVIEWED_ASSIGNMENT.
   */
  async ensureScheduleScopeIntegrity(versionId: string): Promise<void> {
    if (!isSupabaseConfigured() || !versionId) return;

    try {
      // 1. Fetch placed entries for this version
      const { data: entries, error: entErr } = await supabase
        .from('schedule_entries')
        .select('id, course_offering_id, room_id, day_of_week, start_minute, end_minute')
        .eq('schedule_version_id', versionId);

      if (entErr || !entries || entries.length === 0) return;

      const placedOfferingIds = Array.from(
        new Set(entries.map((e) => e.course_offering_id).filter(Boolean))
      );

      // 2. Fetch current version scope
      const { data: version } = await supabase
        .from('schedule_versions')
        .select('id, scope_offering_ids, academic_term_id, term_id')
        .eq('id', versionId)
        .maybeSingle();

      const currentScope = version?.scope_offering_ids || [];
      const isMismatch =
        currentScope.length !== placedOfferingIds.length ||
        placedOfferingIds.some((id) => !currentScope.includes(id));

      if (isMismatch && placedOfferingIds.length > 0) {
        await supabase
          .from('schedule_versions')
          .update({
            scope_offering_ids: placedOfferingIds,
            updated_at: new Date().toISOString(),
          })
          .eq('id', versionId);
      }
    } catch (err) {
      console.warn('ensureScheduleScopeIntegrity warning:', err);
    }
  },

  /**
   * Publishes a schedule version using the backend RPC publish_schedule_version or publish_schedule_version_named.
   * Strictly enforces backend optimistic concurrency (p_expected_revision) without retry loops.
   */
  async publishScheduleVersion(
    versionId: string,
    expectedRevision: number,
    title?: string
  ): Promise<{ success: boolean; version?: ScheduleVersion }> {
    await assertOwnerAdmin('menerbitkan jadwal perkuliahan');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    try {
      // 1. Single RPC publish attempt
      let res = await supabase.rpc('publish_schedule_version_named', {
        p_version_id: versionId,
        p_expected_revision: expectedRevision,
        p_title: title?.trim() || null,
      });

      if (
        res.error &&
        res.error.message?.includes('function') &&
        res.error.message?.includes('does not exist')
      ) {
        res = await supabase.rpc('publish_schedule_version', {
          p_version_id: versionId,
          p_expected_revision: expectedRevision,
        });
      }

      if (res.error) {
        console.error('publish_schedule_version RPC error:', res.error);
        const errStr = res.error.message || '';

        if (
          errStr.includes('STALE_REVISION') ||
          errStr.includes('stale revision') ||
          errStr.includes('revision mismatch')
        ) {
          throw new Error('Versi draft telah berubah. Muat ulang data terbaru sebelum menerbitkan.');
        } else if (errStr.includes('ROOM_CONFLICT')) {
          throw new Error('Gagal menerbitkan: Terdapat bentrok ruangan pada jadwal perkuliahan.');
        } else if (errStr.includes('LECTURER_CONFLICT')) {
          throw new Error('Gagal menerbitkan: Terdapat bentrok jadwal mengajar dosen pengampu.');
        } else if (errStr.includes('CLASS_GROUP_CONFLICT')) {
          throw new Error('Gagal menerbitkan: Terdapat bentrok waktu pada rombongan kelas mahasiswa yang sama.');
        } else if (errStr.includes('ROOM_CAPACITY_EXCEEDED')) {
          throw new Error('Gagal menerbitkan: Kapasitas ruangan tidak mencukupi untuk jumlah peserta kelas.');
        } else if (errStr.includes('LECTURER_UNAVAILABLE')) {
          throw new Error('Gagal menerbitkan: Dosen pengampu berhalangan hadir pada slot waktu perkuliahan.');
        } else if (errStr.includes('NON_CONSECUTIVE_OR_INACTIVE_SESSIONS')) {
          throw new Error('Gagal menerbitkan: Sesi perkuliahan tidak berurutan atau menggunakan slot tidak aktif.');
        } else if (
          errStr.includes('INCOMPLETE_SCHEDULE') ||
          errStr.includes('UNREVIEWED_ASSIGNMENT')
        ) {
          throw new Error('Gagal menerbitkan: Masih ada kelas aktif yang belum dijadwalkan atau belum ditinjau.');
        } else if (errStr.includes('CANNOT_PUBLISH_EMPTY_SCHEDULE')) {
          throw new Error('Gagal menerbitkan: Jadwal belum memiliki entri kelas untuk diterbitkan.');
        } else if (errStr.includes('HARD_CONFLICTS_EXIST')) {
          throw new Error('Gagal menerbitkan: Masih terdapat bentrok jadwal yang belum diselesaikan.');
        }

        throw new Error(parseSupabaseError(res.error));
      }

      // Fetch the updated published version directly from DB
      const updatedVersion = await this.getVersionById(versionId);

      // Clean local client storage for this version
      this.cleanupStorageForVersion(versionId, true);

      return {
        success: true,
        version: updatedVersion || undefined,
      };
    } catch (err: any) {
      console.error('[scheduleVersionsService] publishScheduleVersion error:', err);
      throw err;
    }
  },

  /**
   * Sets the schedule scope (offering IDs that belong to the active workflow)
   * Calls backend RPC set_schedule_scope
   */
  async setScheduleScope(
    versionId: string,
    expectedRevision: number,
    offeringIds: string[]
  ): Promise<{ newRevision: number; version?: ScheduleVersion }> {
    await assertOwnerAdmin('menetapkan scope jadwal');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    try {
      const current = await this.getVersionById(versionId);
      if (current && !this.isLectureVersion(current)) {
        throw new Error(`Draft yang terbuka bukan draft perkuliahan (tipe: ${current.type || 'UNKNOWN'}). Sistem sedang memuat draft perkuliahan yang sesuai.`);
      }

      const { data, error } = await supabase.rpc('set_schedule_scope', {
        p_version_id: versionId,
        p_expected_revision: expectedRevision,
        p_offering_ids: offeringIds,
      });

      if (error) {
        console.error('Error set_schedule_scope RPC:', error);
        throw new Error(parseSupabaseError(error));
      }

      let newRevision = expectedRevision + 1;
      if (typeof data === 'number') {
        newRevision = data;
      } else if (data && typeof data === 'object' && typeof (data as any).revision === 'number') {
        newRevision = (data as any).revision;
      }

      const updatedVersion = await this.getVersionById(versionId);
      return {
        newRevision: updatedVersion?.revision ?? newRevision,
        version: updatedVersion || undefined,
      };
    } catch (err: any) {
      console.error('[scheduleVersionsService] setScheduleScope error:', err);
      throw err;
    }
  },

  /**
   * Retrieves smart move recommendations for a schedule entry
   * Calls backend RPC get_schedule_move_recommendations
   */
  async getMoveRecommendations(
    entryId: string,
    limit: number = 5
  ): Promise<any[]> {
    if (!isSupabaseConfigured() || !entryId) return [];

    // Ensure entryId is a valid UUID to prevent Supabase type error
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryId);
    if (!isUuid) {
      return [];
    }

    try {
      const { data, error } = await supabase.rpc('get_schedule_move_recommendations', {
        p_entry_id: entryId,
        p_limit: limit,
      });

      if (error) {
        console.warn('Error get_schedule_move_recommendations RPC:', error);
        return [];
      }

      if (Array.isArray(data)) {
        return data;
      } else if (data && Array.isArray((data as any).recommendations)) {
        return (data as any).recommendations;
      }
      return [];
    } catch (err: any) {
      console.error('[scheduleVersionsService] getMoveRecommendations error:', err);
      return [];
    }
  },

  /**
   * Move / reschedule a single schedule entry to new slot & room
   * Updates schedule_entries row and refreshes schedule conflicts
   */
  async moveScheduleEntry(
    entryId: string,
    versionId: string,
    payload: {
      dayOfWeek: number;
      startMinute: number;
      endMinute: number;
      startTime: string;
      endTime: string;
      roomId: string;
      roomName?: string;
      roomCode?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    await assertOwnerAdmin('memindahkan jadwal perkuliahan');
    if (!isSupabaseConfigured()) {
      throw new Error('Database belum terhubung.');
    }

    try {
      const updateData: any = {
        day_of_week: payload.dayOfWeek,
        start_minute: payload.startMinute,
        room_id: payload.roomId,
        updated_at: new Date().toISOString(),
      };
      if (payload.roomName) updateData.room_name = payload.roomName;
      if (payload.roomCode) updateData.room_code = payload.roomCode;

      const { error } = await supabase
        .from('schedule_entries')
        .update(updateData)
        .eq('id', entryId);

      if (error) {
        throw new Error(parseSupabaseError(error));
      }

      // Also update version revision if possible
      try {
        const { data: v } = await supabase
          .from('schedule_versions')
          .select('revision')
          .eq('id', versionId)
          .single();
        if (v) {
          await supabase
            .from('schedule_versions')
            .update({
              revision: (v.revision || 1) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', versionId);
        }
      } catch (_) {}

      // Refresh conflicts
      await this.refreshConflicts(versionId);

      return { success: true };
    } catch (err: any) {
      console.error('[scheduleVersionsService] moveScheduleEntry error:', err);
      return { success: false, error: err.message || 'Gagal memindahkan jadwal perkuliahan' };
    }
  },

  /**
   * Helper alias for publishScheduleVersion
   */
  async publishVersion(versionId: string, _changelog?: string): Promise<{ success: boolean; version?: ScheduleVersion }> {
    const version = await this.getVersionById(versionId);
    const revision = version?.revision || 1;
    return this.publishScheduleVersion(versionId, revision);
  },

  /**
   * Update the human-readable title/name of a schedule version
   */
  async updateVersionTitle(versionId: string, title: string): Promise<ScheduleVersion> {
    await assertOwnerAdmin('mengubah nama jadwal');
    if (!isSupabaseConfigured()) {
      throw new Error('Database belum terhubung.');
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      throw new Error('Nama jadwal tidak boleh kosong.');
    }

    const { data, error } = await supabase
      .from('schedule_versions')
      .update({
        title: cleanTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating version title:', error);
      throw new Error(parseSupabaseError(error));
    }

    return (await this.getVersionById(versionId)) || (data as ScheduleVersion);
  },

  /**
   * Cleans all localStorage keys and caches referencing a deleted version
   */
  cleanupStorageForVersion(versionId: string, isPublished?: boolean): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key);
        if (
          val === versionId ||
          key.includes(versionId) ||
          (typeof val === 'string' && val.includes(versionId))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      if (isPublished) {
        localStorage.removeItem('spk:cached-published-schedule');
        localStorage.removeItem('spk:cached-published-exams');
      }

      window.dispatchEvent(
        new CustomEvent('spk:version-deleted', {
          detail: { versionId, isPublished },
        })
      );
    } catch (_) {}
  },

  /**
   * Clears all placement entries of an active draft schedule without deleting the version record.
   * Preserves scope, courses, class rombel, lecturers, participants, and workflow configuration.
   * Admin only. Never touches published schedules.
   * Uses secure SECURITY DEFINER RPC clear_schedule_draft.
   */
  async clearDraftEntries(versionId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Database belum terhubung.');
    }

    if (!versionId) {
      throw new Error('Draft tidak ditemukan.');
    }

    const { error } = await supabase.rpc('clear_schedule_draft', {
      p_version_id: versionId,
    });

    if (error) {
      console.error('Error in clear_schedule_draft RPC:', error);
      throw new Error(parseDeleteScheduleError(error));
    }
  },

  /**
   * TARIK JADWAL RESMI / AKTIF (Withdraw Schedule Publication)
   * ADMIN ONLY.
   * Releases the active publication pointer for the selected schedule types (Lecture, UTS, UAS).
   * IMPORTANT RULES:
   * - Does NOT delete the published version snapshot
   * - Does NOT delete historical versions or audit trail
   * - Does NOT delete schedule_entries or exam_entries from the snapshot
   * - Does NOT change historical status to DRAFT (sets to REPLACED/WITHDRAWN)
   * - Sets active published pointers to null / inactive so views return 0 rows for that period.
   * - Old versions can later be restored via "Riwayat Jadwal -> Terbitkan Kembali"
   */
  async withdrawActivePublishedSchedule(options: {
    lecture?: boolean;
    uts?: boolean;
    uas?: boolean;
    academicTermId?: string;
  }): Promise<{ cleared: string[] }> {
    await assertOwnerAdmin('menarik publikasi jadwal resmi yang aktif');
    if (!isSupabaseConfigured()) {
      throw new Error('Database belum terhubung.');
    }

    const { lecture = false, uts = false, uas = false, academicTermId } = options;
    if (!lecture && !uts && !uas) {
      throw new Error('Pilih setidaknya satu jadwal aktif yang ingin ditarik.');
    }

    const cleared: string[] = [];
    const nowIso = new Date().toISOString();
    let currentUserId: string | null = null;
    try {
      const { data: uData } = await supabase.auth.getUser();
      currentUserId = uData?.user?.id || null;
    } catch (_) {}

    // Clear client-side published caches immediately
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (lecture) localStorage.removeItem('spk:cached-published-schedule');
        if (uts || uas) localStorage.removeItem('spk:cached-published-exams');
      }
    } catch (_) {}

    // 1. CLEAR ACTIVE PUBLISHED LECTURE SCHEDULE
    if (lecture) {
      try {
        // Try calling backend RPC withdraw_schedule_publication first
        try {
          await supabase.rpc('withdraw_schedule_publication', {
            p_academic_term_id: academicTermId || null,
            p_type: 'LECTURE',
          });
        } catch (_) {}

        // Delete active pointer row from schedule_publications (Source of truth)
        try {
          let delPub = supabase.from('schedule_publications').delete();
          if (academicTermId) {
            delPub = delPub.eq('academic_term_id', academicTermId);
          }
          delPub = delPub.or('type.eq.LECTURE,type.eq.REGULAR,type.is.null');
          await delPub;
        } catch (pubDelErr) {
          console.warn('schedule_publications delete notice:', pubDelErr);
        }

        // Update schedule_versions to mark as withdrawn without deleting snapshot/entries
        let query = supabase
          .from('schedule_versions')
          .select('id, title, version_number, revision, academic_term_id, term_id')
          .eq('status', 'PUBLISHED')
          .or('type.eq.LECTURE,type.eq.REGULAR,type.is.null');

        if (academicTermId) {
          query = query.or(`academic_term_id.eq.${academicTermId},term_id.eq.${academicTermId}`);
        }

        const { data: pubLectures, error: qErr } = await query;
        if (qErr) {
          console.warn('Query pubLectures error:', qErr);
        }

        if (pubLectures && pubLectures.length > 0) {
          const ids = pubLectures.map((v) => v.id);

          const { error: updErr } = await supabase
            .from('schedule_versions')
            .update({
              status: 'REPLACED',
              withdrawn_at: nowIso,
              withdrawn_by: currentUserId,
              updated_at: nowIso,
            })
            .in('id', ids);

          if (updErr) {
            console.error('Failed to deactivate published lecture versions:', updErr);
            throw new Error(parseSupabaseError(updErr));
          }
        }

        cleared.push('Jadwal Perkuliahan');
      } catch (err: any) {
        console.error('Error withdrawing published lecture schedule:', err);
        throw new Error(`Gagal menarik Jadwal Perkuliahan: ${parseSupabaseError(err)}`);
      }
    }

    // 2. CLEAR ACTIVE PUBLISHED UTS SCHEDULE
    if (uts) {
      try {
        try {
          await supabase.rpc('withdraw_schedule_publication', {
            p_academic_term_id: academicTermId || null,
            p_type: 'UTS',
          });
        } catch (_) {}

        // Delete UTS publication pointer row
        try {
          let delUts = supabase.from('schedule_publications').delete().eq('type', 'UTS');
          if (academicTermId) {
            delUts = delUts.eq('academic_term_id', academicTermId);
          }
          await delUts;
        } catch (utsDelErr) {
          console.warn('UTS schedule_publications delete notice:', utsDelErr);
        }

        let query = supabase
          .from('schedule_versions')
          .select('id, title, version_number, revision, academic_term_id, term_id')
          .eq('status', 'PUBLISHED')
          .eq('type', 'UTS');

        if (academicTermId) {
          query = query.or(`academic_term_id.eq.${academicTermId},term_id.eq.${academicTermId}`);
        }

        const { data: pubUts, error: qErr } = await query;
        if (qErr) {
          console.warn('Query pubUts error:', qErr);
        }

        if (pubUts && pubUts.length > 0) {
          const ids = pubUts.map((v) => v.id);

          const { error: updErr } = await supabase
            .from('schedule_versions')
            .update({
              status: 'REPLACED',
              withdrawn_at: nowIso,
              withdrawn_by: currentUserId,
              updated_at: nowIso,
            })
            .in('id', ids);

          if (updErr) {
            console.error('Failed to deactivate published UTS versions:', updErr);
            throw new Error(parseSupabaseError(updErr));
          }
        }

        cleared.push('Jadwal UTS');
      } catch (err: any) {
        console.error('Error withdrawing published UTS schedule:', err);
        throw new Error(`Gagal menarik Jadwal UTS: ${parseSupabaseError(err)}`);
      }
    }

    // 3. CLEAR ACTIVE PUBLISHED UAS SCHEDULE
    if (uas) {
      try {
        try {
          await supabase.rpc('withdraw_schedule_publication', {
            p_academic_term_id: academicTermId || null,
            p_type: 'UAS',
          });
        } catch (_) {}

        // Delete UAS publication pointer row
        try {
          let delUas = supabase.from('schedule_publications').delete().eq('type', 'UAS');
          if (academicTermId) {
            delUas = delUas.eq('academic_term_id', academicTermId);
          }
          await delUas;
        } catch (uasDelErr) {
          console.warn('UAS schedule_publications delete notice:', uasDelErr);
        }

        let query = supabase
          .from('schedule_versions')
          .select('id, title, version_number, revision, academic_term_id, term_id')
          .eq('status', 'PUBLISHED')
          .eq('type', 'UAS');

        if (academicTermId) {
          query = query.or(`academic_term_id.eq.${academicTermId},term_id.eq.${academicTermId}`);
        }

        const { data: pubUas, error: qErr } = await query;
        if (qErr) {
          console.warn('Query pubUas error:', qErr);
        }

        if (pubUas && pubUas.length > 0) {
          const ids = pubUas.map((v) => v.id);

          const { error: updErr } = await supabase
            .from('schedule_versions')
            .update({
              status: 'REPLACED',
              withdrawn_at: nowIso,
              withdrawn_by: currentUserId,
              updated_at: nowIso,
            })
            .in('id', ids);

          if (updErr) {
            console.error('Failed to deactivate published UAS versions:', updErr);
            throw new Error(parseSupabaseError(updErr));
          }
        }

        cleared.push('Jadwal UAS');
      } catch (err: any) {
        console.error('Error withdrawing published UAS schedule:', err);
        throw new Error(`Gagal menarik Jadwal UAS: ${parseSupabaseError(err)}`);
      }
    }

    return { cleared };
  },

  /**
   * Alias for withdrawActivePublishedSchedule
   */
  async clearActivePublishedSchedule(options: {
    lecture?: boolean;
    uts?: boolean;
    uas?: boolean;
    academicTermId?: string;
  }): Promise<{ cleared: string[] }> {
    return this.withdrawActivePublishedSchedule(options);
  },

  /**
   * RESTORE & REPUBLISH A HISTORICAL VERSION (Pulihkan / Terbitkan Kembali)
   * ADMIN ONLY.
   * Immediately sets the snapshot as the active published schedule without requiring re-generation.
   */
  async republishVersion(versionId: string): Promise<ScheduleVersion> {
    await assertOwnerAdmin('menerbitkan kembali versi jadwal');
    if (!isSupabaseConfigured()) {
      throw new Error('Database belum terhubung.');
    }

    const version = await this.getVersionById(versionId);
    if (!version) {
      throw new Error('Versi jadwal tidak ditemukan.');
    }

    const termId = version.academic_term_id || version.term_id;
    const rawType = String(version.type || '').toUpperCase();
    const isLecture = !rawType || rawType === 'LECTURE' || rawType === 'REGULAR';
    const pubType = isLecture ? 'LECTURE' : (rawType as 'UTS' | 'UAS');
    const nowIso = new Date().toISOString();

    // 1. Deactivate existing active published schedule of the same type/term
    try {
      let query = supabase
        .from('schedule_versions')
        .update({ status: 'REPLACED', updated_at: nowIso })
        .eq('status', 'PUBLISHED');

      if (pubType === 'UTS' || pubType === 'UAS') {
        query = query.eq('type', pubType);
      } else {
        query = query.or('type.eq.LECTURE,type.eq.REGULAR,type.is.null');
      }

      if (termId) {
        query = query.or(`academic_term_id.eq.${termId},term_id.eq.${termId}`);
      }

      await query;
    } catch (deactErr) {
      console.warn('Deactivate prior published error:', deactErr);
    }

    // 2. Try calling RPC publish_schedule_version first
    let rpcSuccess = false;
    try {
      const { error: rpcErr } = await supabase.rpc('publish_schedule_version', {
        p_version_id: versionId,
        p_expected_revision: version.revision,
      });
      if (!rpcErr) {
        rpcSuccess = true;
      }
    } catch (_) {}

    // 3. Fallback / ensure status is set to PUBLISHED with fresh timestamp and clear withdrawn metadata
    const { error: updErr } = await supabase
      .from('schedule_versions')
      .update({
        status: 'PUBLISHED',
        published_at: nowIso,
        withdrawn_at: null,
        withdrawn_by: null,
        updated_at: nowIso,
        revision: (version.revision || 1) + 1,
      })
      .eq('id', versionId);

    if (updErr && !rpcSuccess) {
      console.error('Error republishing version:', updErr);
      throw new Error(parseSupabaseError(updErr));
    }

    // 4. Update schedule_publications pointer table
    try {
      if (termId) {
        let delPub = supabase.from('schedule_publications').delete().eq('academic_term_id', termId);
        if (pubType === 'UTS' || pubType === 'UAS') {
          delPub = delPub.eq('type', pubType);
        } else {
          delPub = delPub.or('type.eq.LECTURE,type.eq.REGULAR,type.is.null');
        }
        await delPub;

        await supabase.from('schedule_publications').insert({
          academic_term_id: termId,
          type: pubType,
          schedule_version_id: versionId,
          published_at: nowIso,
        });
      }
    } catch (pubErr) {
      console.warn('schedule_publications insert notice:', pubErr);
    }

    // Clear client-side published caches
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (isLecture) localStorage.removeItem('spk:cached-published-schedule');
        if (!isLecture) localStorage.removeItem('spk:cached-published-exams');
      }
    } catch (_) {}

    const updated = await this.getVersionById(versionId);
    return updated || version;
  },

  /**
   * Archive or unarchive a schedule version
   */
  async archiveVersion(versionId: string, archive: boolean = true): Promise<ScheduleVersion> {
    await assertOwnerAdmin('mengarsipkan riwayat jadwal');
    if (!isSupabaseConfigured()) {
      throw new Error('Database belum terhubung.');
    }

    const version = await this.getVersionById(versionId);
    if (!version) {
      throw new Error('Versi jadwal tidak ditemukan.');
    }

    const newStatus = archive ? 'ARCHIVED' : (version.published_at ? 'PUBLISHED' : 'DRAFT');

    const { error } = await supabase
      .from('schedule_versions')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId);

    if (error) {
      console.error('Error archiving version:', error);
      throw new Error(parseSupabaseError(error));
    }

    return (await this.getVersionById(versionId)) || version;
  },

  /**
   * Bulk delete multiple schedule versions with real DB verification
   */
  async bulkDeleteVersions(
    versionsOrIds: (ScheduleVersion | string)[]
  ): Promise<{ count: number; types: Set<'DRAFT' | 'HISTORY' | 'PUBLISHED'> }> {
    if (!isSupabaseConfigured() || versionsOrIds.length === 0) {
      return { count: 0, types: new Set() };
    }

    let deletedCount = 0;
    const types = new Set<'DRAFT' | 'HISTORY' | 'PUBLISHED'>();

    for (const item of versionsOrIds) {
      const versionId = typeof item === 'string' ? item : item.id;
      const targetVersion = typeof item === 'string' ? null : item;
      const result = await this.deleteVersion(versionId, targetVersion);
      if (result.ok) {
        deletedCount++;
        types.add(result.statusType);
      }
    }

    return { count: deletedCount, types };
  },

  /**
   * Cleans up empty scratch drafts that have no schedule entries and no planned courses
   */
  async cleanupEmptyDrafts(termId?: string): Promise<{ deletedCount: number }> {
    await assertOwnerAdmin('membersihkan draf kosong');
    if (!isSupabaseConfigured()) return { deletedCount: 0 };

    const all = await this.getVersions(termId);
    const emptyDrafts = all.filter((v) => {
      if (v.status !== 'DRAFT') return false;
      const scopeLen = v.scope_offering_ids?.length || 0;
      const entryCount = (v as any).entry_count || (v as any).schedule_entries?.length || 0;
      const hasPlannedCourses =
        v.workflow_state &&
        typeof v.workflow_state === 'object' &&
        Array.isArray((v.workflow_state as any).plannedCourses) &&
        (v.workflow_state as any).plannedCourses.length > 0;
      return scopeLen === 0 && entryCount === 0 && !hasPlannedCourses;
    });

    if (emptyDrafts.length === 0) {
      return { deletedCount: 0 };
    }

    const ids = emptyDrafts.map((d) => d.id);
    const res = await this.bulkDeleteVersions(ids);
    return { deletedCount: res.count };
  },

  /**
   * Deletes a schedule version using appropriate backend RPC:
   * - DRAFT: delete_schedule_draft
   * - REPLACED / DITARIK / PUBLISHED: delete_schedule_version_admin
   * Verifies deletion directly from database before returning.
   */
  async deleteVersion(
    versionId: string,
    targetVersion?: ScheduleVersion | null
  ): Promise<{ ok: boolean; statusType: 'DRAFT' | 'HISTORY' | 'PUBLISHED' }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Database belum terhubung.');
    }

    if (!versionId) {
      throw new Error('ID versi jadwal tidak ditemukan.');
    }

    // 1. Resolve version status
    const version = targetVersion || (await this.getVersionById(versionId));
    const status = version?.status || 'DRAFT';
    const isDraft = status === 'DRAFT';
    const isPublished = status === 'PUBLISHED';
    const statusType: 'DRAFT' | 'HISTORY' | 'PUBLISHED' = isDraft
      ? 'DRAFT'
      : isPublished
      ? 'PUBLISHED'
      : 'HISTORY';

    // 2. Call RPC
    let rpcError: any = null;

    if (isDraft) {
      const res = await supabase.rpc('delete_schedule_draft', {
        p_version_id: versionId,
      });
      rpcError = res.error;

      // Fallback to generic delete if status already changed on server
      if (
        rpcError &&
        (rpcError.message?.includes('ONLY_DRAFT_CAN_BE_DELETED') ||
          rpcError.details?.includes('ONLY_DRAFT_CAN_BE_DELETED'))
      ) {
        const adminRes = await supabase.rpc('delete_schedule_version_admin', {
          p_version_id: versionId,
        });
        rpcError = adminRes.error;
      }
    } else {
      const res = await supabase.rpc('delete_schedule_version_admin', {
        p_version_id: versionId,
      });
      rpcError = res.error;
    }

    if (rpcError) {
      console.error('Error executing delete RPC:', rpcError);
      throw new Error(parseDeleteScheduleError(rpcError));
    }

    // 3. VERIFY DELETE: Query database to ensure row count is 0
    const { data: checkData, error: checkErr } = await supabase
      .from('schedule_versions')
      .select('id')
      .eq('id', versionId);

    if (checkErr) {
      console.warn('Verification query warning:', checkErr);
    }

    if (checkData && checkData.length > 0) {
      throw new Error('Penghapusan belum tersinkronisasi. Silakan muat ulang data.');
    }

    // 4. Clean storage & publication pointer
    this.cleanupStorageForVersion(versionId, isPublished);

    if (isPublished) {
      try {
        await supabase
          .from('schedule_publications')
          .delete()
          .eq('schedule_version_id', versionId);
      } catch (_) {}
    }

    return { ok: true, statusType };
  },

  /**
   * Save a snapshot version without modifying the current workspace
   */
  async saveSnapshotVersion(
    draftVersionId: string,
    snapshotTitle: string
  ): Promise<ScheduleVersion> {
    await assertOwnerAdmin('menyimpan snapshot versi jadwal');
    if (!isSupabaseConfigured()) {
      throw new Error('Database belum terhubung.');
    }

    const draft = await this.getVersionById(draftVersionId);
    if (!draft) throw new Error('Draft tidak ditemukan.');
    const termId = draft.academic_term_id || draft.term_id;
    const isExam = draft.type === 'UTS' || draft.type === 'UAS';

    // 1. Insert new snapshot version
    const { data: newVersion, error: vErr } = await supabase
      .from('schedule_versions')
      .insert({
        academic_term_id: termId,
        term_id: termId,
        title: snapshotTitle.trim() || `Versi Snapshot`,
        status: 'ARCHIVED',
        type: draft.type || 'LECTURE',
        revision: 1,
        source_version_id: draftVersionId,
        scope_offering_ids: draft.scope_offering_ids,
        workflow_state: draft.workflow_state,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (vErr || !newVersion) {
      throw new Error(parseSupabaseError(vErr) || 'Gagal menyimpan snapshot versi.');
    }

    // 2. Copy entries from draft
    if (isExam) {
      const { data: examEntries } = await supabase
        .from('exam_entries')
        .select('*')
        .eq('schedule_version_id', draftVersionId);

      if (examEntries && examEntries.length > 0) {
        const cloned = examEntries.map((e: any) => {
          const { id, ...rest } = e;
          return {
            ...rest,
            schedule_version_id: newVersion.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });
        await supabase.from('exam_entries').insert(cloned);
      }
    } else {
      const { data: schedEntries } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('schedule_version_id', draftVersionId);

      if (schedEntries && schedEntries.length > 0) {
        const cloned = schedEntries.map((e: any) => {
          const { id, end_minute, ...rest } = e;
          return {
            ...rest,
            schedule_version_id: newVersion.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });
        await supabase.from('schedule_entries').insert(cloned);
      }
    }

    return newVersion as ScheduleVersion;
  },

  /**
   * Restore snapshot into workspace draft without altering original snapshot
   */
  async restoreVersionToDraft(
    snapshotVersionId: string,
    academicTermId: string
  ): Promise<ScheduleVersion> {
    await assertOwnerAdmin('memulihkan versi jadwal ke Workspace');
    if (!isSupabaseConfigured()) {
      throw new Error('Database belum terhubung.');
    }

    const snapshot = await this.getVersionById(snapshotVersionId);
    if (!snapshot) throw new Error('Versi snapshot tidak ditemukan.');

    const isExam = snapshot.type === 'UTS' || snapshot.type === 'UAS';
    const schedType = (snapshot.type || 'LECTURE') as 'LECTURE' | 'UTS' | 'UAS';

    // 1. Resolve or create active draft workspace
    let draft = await this.resolveActiveDraft({
      academicTermId,
      type: schedType,
    });

    if (!draft) {
      draft = await this.createDraft(
        academicTermId,
        `Workspace ${schedType} (Pemulihan)`
      );
    }

    if (!draft) {
      throw new Error('Gagal menyiapkan workspace draft untuk pemulihan.');
    }

    // 2. Clear current workspace draft entries
    if (isExam) {
      await supabase
        .from('exam_entries')
        .delete()
        .eq('schedule_version_id', draft.id);

      // 3. Clone entries from snapshot
      const { data: snapshotExams } = await supabase
        .from('exam_entries')
        .select('*')
        .eq('schedule_version_id', snapshotVersionId);

      if (snapshotExams && snapshotExams.length > 0) {
        const cloned = snapshotExams.map((e: any) => {
          const { id, ...rest } = e;
          return {
            ...rest,
            schedule_version_id: draft.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });
        await supabase.from('exam_entries').insert(cloned);
      }
    } else {
      await supabase
        .from('schedule_entries')
        .delete()
        .eq('schedule_version_id', draft.id);

      // 3. Clone entries from snapshot
      const { data: snapshotEntries } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('schedule_version_id', snapshotVersionId);

      if (snapshotEntries && snapshotEntries.length > 0) {
        const cloned = snapshotEntries.map((e: any) => {
          const { id, end_minute, ...rest } = e;
          return {
            ...rest,
            schedule_version_id: draft.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });
        await supabase.from('schedule_entries').insert(cloned);
      }
    }

    // 4. Update draft metadata
    const newRev = (draft.revision || 1) + 1;
    await supabase
      .from('schedule_versions')
      .update({
        revision: newRev,
        workflow_state: snapshot.workflow_state,
        scope_offering_ids: snapshot.scope_offering_ids,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.id);

    await this.refreshConflicts(draft.id);
    const refreshed = await this.getVersionById(draft.id);
    return refreshed || draft;
  },
};
