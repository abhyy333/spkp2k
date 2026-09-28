import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Room,
  TimeSlot,
  LecturerAvailability,
  ScheduleVersion,
} from '../types';
import {
  InitialScheduleEntry,
  InitialScheduleOffering,
  InitialScheduleConflict,
  findConsecutiveSlotSequences,
} from './schedulingInitial.service';
import { scheduleVersionsService } from './scheduleVersions.service';
import { assertOwnerAdmin } from '../lib/authGuard';
import { minuteToTime, dayOfWeekToName, parseSupabaseError } from '../lib/utils';
import {
  SAProblemData,
  SASolution,
  SAConfig,
  SAProgress,
  SAResult,
  ConsecutiveSlot,
} from '../optimization/simulatedAnnealing/types';
import { SimulatedAnnealingEngine } from '../optimization/simulatedAnnealing/annealing';

export class SchedulingOptimizationService {
  private activeWorker: Worker | null = null;

  /**
   * Prepares SAProblemData and initial SASolution from Step 4 data
   */
  public prepareProblemData(
    step4Entries: InitialScheduleEntry[],
    rooms: Room[],
    timeSlots: TimeSlot[],
    availabilities: LecturerAvailability[],
    minutesPerSks: number = 50
  ): { problem: SAProblemData; initialSolution: SASolution } {
    // 1. Initial solution
    const initialSolution: SASolution = step4Entries.map((e) => ({
      courseOfferingId: e.courseOfferingId,
      roomId: e.roomId,
      dayOfWeek: Number(e.dayOfWeek),
      startMinute: Number(e.startMinute),
    }));

    // 2. Offerings context
    const offerings = step4Entries.map((e) => ({
      id: e.courseOfferingId,
      courseId: e.offering.courseId,
      courseCode: e.offering.courseCode,
      courseName: e.offering.courseName,
      classCode: e.offering.classCode,
      semester: e.offering.semester,
      curriculumYear: e.offering.curriculumYear,
      kbk: (e.offering as any).kbk || null,
      effectiveSks: e.offering.effectiveSks,
      durationMinutes: e.offering.effectiveSks * minutesPerSks,
      expectedStudents: e.offering.expectedStudents,
      requiredRoomType: e.offering.requiredRoomType,
      primaryLecturerId: e.offering.primaryLecturerId,
      primaryLecturerName: e.offering.primaryLecturerName,
      primaryLecturerCode: e.offering.primaryLecturerCode,
    }));

    // 3. Rooms context (only active rooms)
    const saRooms = rooms.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      capacity: r.capacity,
      roomType: r.room_type,
      isActive: r.is_active !== false,
    }));

    // 4. TimeSlots context
    const saTimeSlots = timeSlots.map((t) => ({
      id: t.id,
      dayOfWeek: Number(t.day_of_week),
      startMinute: t.start_minute,
      endMinute: t.end_minute,
      isActive: t.is_active !== false,
    }));

    // 5. Lecturer availabilities context
    const saAvailabilities = availabilities.map((a) => ({
      lecturerId: a.lecturer_id,
      dayOfWeek: Number(a.day_of_week),
      startMinute: a.start_minute,
      endMinute: a.end_minute,
      isAvailable: a.is_available !== false,
      preference: a.preference || 'neutral',
    }));

    // 6. Pre-calculate valid consecutive slot sequences for SKS 1 to 6
    const validSequencesBySks: Record<number, ConsecutiveSlot[]> = {};
    for (let sks = 1; sks <= 6; sks++) {
      const sequences = findConsecutiveSlotSequences(timeSlots, sks);
      validSequencesBySks[sks] = sequences.map((seq) => ({
        dayOfWeek: Number(seq.dayOfWeek),
        startMinute: seq.startMinute,
        endMinute: seq.endMinute,
        sessionCount: seq.sessionCount,
      }));
    }

    const problem: SAProblemData = {
      offerings,
      rooms: saRooms,
      timeSlots: saTimeSlots,
      availabilities: saAvailabilities,
      validSequencesBySks,
    };

    return { problem, initialSolution };
  }

  /**
   * Runs Simulated Annealing in Web Worker with fallback to inline execution
   */
  public runOptimization(
    problem: SAProblemData,
    initialSolution: SASolution,
    config: SAConfig,
    onProgress: (progress: SAProgress) => void
  ): Promise<SAResult> {
    return new Promise((resolve, reject) => {
      // Clean up any previous worker
      this.terminateWorker();

      // Check if Worker API is available
      if (typeof Worker !== 'undefined') {
        try {
          const worker = new Worker(
            new URL('../workers/simulatedAnnealing.worker.ts', import.meta.url),
            { type: 'module' }
          );
          this.activeWorker = worker;

          worker.onmessage = (e) => {
            const data = e.data;
            if (data.type === 'PROGRESS') {
              onProgress(data.payload);
            } else if (data.type === 'COMPLETE') {
              this.terminateWorker();
              resolve(data.payload);
            } else if (data.type === 'ERROR') {
              this.terminateWorker();
              reject(new Error(data.error));
            }
          };

          worker.onerror = (err) => {
            console.warn('[SA Worker] Worker error, falling back to synchronous execution:', err);
            this.terminateWorker();
            this.runInline(problem, initialSolution, config, onProgress)
              .then(resolve)
              .catch(reject);
          };

          worker.postMessage({
            type: 'START',
            problem,
            initialSolution,
            config,
          });
          return;
        } catch (workerErr) {
          console.warn('[SA Worker] Failed to spawn worker, using inline execution:', workerErr);
        }
      }

      // Inline fallback
      this.runInline(problem, initialSolution, config, onProgress)
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Inline execution fallback (if Web Worker fails or is disabled)
   */
  private runInline(
    problem: SAProblemData,
    initialSolution: SASolution,
    config: SAConfig,
    onProgress: (progress: SAProgress) => void
  ): Promise<SAResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const engine = new SimulatedAnnealingEngine(problem, initialSolution, config);
        const result = engine.run(onProgress, 100);
        resolve(result);
      }, 10);
    });
  }

  /**
   * Stops/terminates running optimization
   */
  public terminateWorker(): void {
    if (this.activeWorker) {
      try {
        this.activeWorker.postMessage({ type: 'STOP' });
        this.activeWorker.terminate();
      } catch (e) {
        console.warn('Error terminating worker:', e);
      }
      this.activeWorker = null;
    }
  }

  /**
   * Merges optimized SASolution back into enriched InitialScheduleEntry[]
   */
  public mergeSolutionToEntries(
    bestSolution: SASolution,
    originalEntries: InitialScheduleEntry[],
    rooms: Room[],
    minutesPerSks: number = 50
  ): InitialScheduleEntry[] {
    const roomsMap = new Map<string, Room>();
    rooms.forEach((r) => roomsMap.set(r.id, r));

    const solutionMap = new Map(
      bestSolution.map((s) => [s.courseOfferingId, s])
    );

    return originalEntries.map((orig) => {
      const saAssignment = solutionMap.get(orig.courseOfferingId);
      if (!saAssignment) return orig;

      const room = roomsMap.get(saAssignment.roomId) || {
        id: saAssignment.roomId,
        code: orig.roomCode,
        name: orig.roomName,
        capacity: orig.roomCapacity,
        room_type: orig.roomType,
      };

      const durationMinutes = orig.offering.effectiveSks * minutesPerSks;
      const startMin = saAssignment.startMinute;
      const endMin = startMin + durationMinutes;
      const capacity = (room as any).capacity || orig.roomCapacity;
      const isCapacityExceeded = orig.offering.expectedStudents > capacity;
      const seatWaste = capacity - orig.offering.expectedStudents;

      return {
        ...orig,
        roomId: saAssignment.roomId,
        roomCode: (room as any).code || orig.roomCode,
        roomName: (room as any).name || orig.roomName,
        roomCapacity: capacity,
        roomType: (room as any).room_type || orig.roomType,
        dayOfWeek: saAssignment.dayOfWeek,
        dayName: dayOfWeekToName(saAssignment.dayOfWeek),
        startMinute: startMin,
        endMinute: endMin,
        startTime: minuteToTime(startMin),
        endTime: minuteToTime(endMin),
        sessionCount: orig.offering.effectiveSks,
        seatWaste,
        isCapacityExceeded,
        conflicts: [], // will be populated from cost breakdown
      };
    });
  }

  /**
   * Persists the optimized schedule back to Supabase using save_draft_entries RPC:
   * - Uses existing currentVersion.id & currentVersion.revision (NO creating new version)
   * - Enforces reason: "SIMULATED_ANNEALING"
   * - Preserves primary lecturer and offering snapshot metadata
   * - Calls refresh_schedule_conflicts(versionId)
   */
  public async saveOptimizedScheduleToSupabase(
    versionId: string,
    expectedRevision: number,
    entries: InitialScheduleEntry[],
    reason: string = 'SIMULATED_ANNEALING'
  ): Promise<{ version: ScheduleVersion; savedCount: number }> {
    await assertOwnerAdmin('menerapkan hasil optimasi jadwal');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    try {
      // 1. Stage 1: set_schedule_scope first
      const offeringIds = Array.from(new Set(entries.map((e) => e.courseOfferingId)));
      let revisionForDraft = expectedRevision;

      if (offeringIds.length > 0) {
        try {
          const scopeRes = await scheduleVersionsService.setScheduleScope(
            versionId,
            expectedRevision,
            offeringIds
          );
          revisionForDraft = scopeRes.newRevision;
        } catch (scopeErr) {
          console.warn('setScheduleScope in saveOptimizedSchedule warning:', scopeErr);
        }
      }

      // 2. Stage 2: save_draft_entries RPC using revisionForDraft
      const draftPayload = entries.map((e) => ({
        course_offering_id: e.courseOfferingId,
        room_id: e.roomId,
        day_of_week: Number(e.dayOfWeek),
        start_minute: Number(e.startMinute),
      }));

      const draftRes = await scheduleVersionsService.saveDraft(
        versionId,
        revisionForDraft,
        draftPayload,
        reason
      );

      // 3. Refresh conflicts via backend RPC
      await scheduleVersionsService.refreshConflicts(versionId);

      // 4. Refetch latest version
      const updatedVersion = (await scheduleVersionsService.getVersionById(versionId)) || draftRes.version;

      return {
        version: updatedVersion!,
        savedCount: entries.length,
      };
    } catch (err: any) {
      console.error('[schedulingOptimizationService] save error:', err);
      throw err;
    }
  }

  /**
   * Fetches schedule_entries for a version directly from Supabase
   * and maps them to InitialScheduleEntry[] format with room and offering details.
   */
  public async fetchVersionScheduleEntries(
    versionId: string,
    rooms: Room[] = [],
    offerings: InitialScheduleOffering[] = []
  ): Promise<InitialScheduleEntry[]> {
    if (!isSupabaseConfigured() || !versionId) return [];

    try {
      const { data, error } = await supabase
        .from('schedule_entries')
        .select(`
          *,
          room:room_id ( id, code, name, capacity, room_type ),
          course_offering:course_offering_id (
            id,
            course_id,
            class_code,
            expected_students,
            course:course_id ( id, code, name, semester, effective_sks )
          )
        `)
        .eq('schedule_version_id', versionId)
        .order('day_of_week', { ascending: true })
        .order('start_minute', { ascending: true });

      if (error) {
        console.warn('Error fetching schedule entries for version:', error);
        return [];
      }

      const rows = data || [];
      const roomsMap = new Map<string, Room>(rooms.map((r) => [r.id, r]));
      const offeringsMap = new Map<string, InitialScheduleOffering>(offerings.map((o) => [o.id, o]));

      return rows.map((row: any) => {
        const offContext = offeringsMap.get(row.course_offering_id);
        const roomContext = roomsMap.get(row.room_id) || row.room;

        const effectiveSks =
          row.session_count ||
          offContext?.effectiveSks ||
          row.course_offering?.course?.effective_sks ||
          2;
        const minutesPerSession = row.minutes_per_session || 50;
        const startMin = Number(row.start_minute || 470);
        const durationMin = effectiveSks * minutesPerSession;
        const endMin = Number(row.end_minute || startMin + durationMin);

        const roomCapacity = Number(row.room_capacity || roomContext?.capacity || 40);
        const studentCount = Number(
          row.student_count || offContext?.expectedStudents || row.course_offering?.expected_students || 0
        );

        const primaryLecturerId =
          Array.isArray(row.lecturer_ids) && row.lecturer_ids.length > 0
            ? row.lecturer_ids[0]
            : offContext?.primaryLecturerId || '';

        const primaryLecturerName =
          row.lecturer_names
            ? Array.isArray(row.lecturer_names)
              ? row.lecturer_names.join(', ')
              : String(row.lecturer_names)
            : offContext?.primaryLecturerName || 'Dosen Pengampu';

        const mappedOffering: InitialScheduleOffering = offContext || {
          id: row.course_offering_id,
          courseId: row.course_offering?.course_id || '',
          courseCode: row.course_code || row.course_offering?.course?.code || '',
          courseName: row.course_name || row.course_offering?.course?.name || 'Mata Kuliah',
          classCode: row.class_code || row.course_offering?.class_code || 'A',
          semester: row.course_offering?.course?.semester || 1,
          curriculumYear: 2026,
          effectiveSks,
          expectedStudents: studentCount,
          requiredRoomType: roomContext?.room_type || 'Ruang Kuliah Teori',
          primaryLecturerId,
          primaryLecturerName,
          primaryLecturerCode: '',
        };

        return {
          id: row.id,
          scheduleVersionId: row.schedule_version_id,
          courseOfferingId: row.course_offering_id,
          offering: mappedOffering,
          roomId: row.room_id,
          roomCode: roomContext?.code || row.course_code || 'Ruang',
          roomName: roomContext?.name || 'Ruang Kuliah',
          roomCapacity,
          roomType: roomContext?.room_type || 'Ruang Kuliah Teori',
          dayOfWeek: Number(row.day_of_week),
          dayName: dayOfWeekToName(Number(row.day_of_week)),
          startMinute: startMin,
          endMinute: endMin,
          startTime: minuteToTime(startMin),
          endTime: minuteToTime(endMin),
          sessionCount: effectiveSks,
          seatWaste: Math.max(0, roomCapacity - studentCount),
          isCapacityExceeded: studentCount > roomCapacity,
          conflicts: [],
        };
      });
    } catch (err) {
      console.error('fetchVersionScheduleEntries error:', err);
      return [];
    }
  }
}

export const schedulingOptimizationService = new SchedulingOptimizationService();
