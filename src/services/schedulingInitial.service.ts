import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Room,
  TimeSlot,
  LecturerAvailability,
  ScheduleVersion,
  Step3OfferingLecturerRow,
  CourseRombelGroup,
} from '../types';
import { verifyOwnerAdmin, assertOwnerAdmin } from '../lib/authGuard';
import { isPracticum, isKKN } from '../lib/distributionUtils';
import { minuteToTime, dayOfWeekToName, parseSupabaseError } from '../lib/utils';
import { roomsService } from './rooms.service';
import { timeSlotsService } from './timeSlots.service';
import { lecturerAvailabilityService } from './lecturerAvailability.service';
import { scheduleVersionsService } from './scheduleVersions.service';

export interface InitialScheduleOffering {
  id: string; // course_offering_id
  courseId: string;
  courseCode: string;
  courseName: string;
  classCode: string;
  semester: number;
  curriculumYear: number;
  effectiveSks: number;
  expectedStudents: number;
  requiredRoomType: string;
  primaryLecturerId: string;
  primaryLecturerName: string;
  primaryLecturerCode: string;
  isLecturerInactive?: boolean;
}

export interface InitialScheduleEntry {
  id: string;
  scheduleVersionId?: string;
  courseOfferingId: string;
  offering: InitialScheduleOffering;
  roomId: string;
  roomCode: string;
  roomName: string;
  roomCapacity: number;
  roomType: string;
  dayOfWeek: number; // 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat
  dayName: string;
  startMinute: number;
  endMinute: number;
  startTime: string;
  endTime: string;
  sessionCount: number;
  seatWaste: number;
  isCapacityExceeded: boolean;
  conflicts: InitialScheduleConflict[];
}

export interface InitialScheduleConflict {
  id: string;
  type: 'ROOM_OVERLAP' | 'LECTURER_OVERLAP' | 'CAPACITY_EXCEEDED' | 'LECTURER_UNAVAILABLE' | 'FRIDAY_PRAYER';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  offeringIds: string[];
  roomId?: string;
  lecturerId?: string;
  dayOfWeek?: number;
  startMinute?: number;
  endMinute?: number;
}

export interface InitialScheduleStats {
  totalOfferings: number;
  scheduledCount: number;
  unscheduledCount: number;
  roomsUsedCount: number;
  totalSks: number;
  totalConflicts: number;
  roomConflictCount: number;
  lecturerConflictCount: number;
  capacityViolationCount: number;
  availabilityConflictCount: number;
  averageSeatWaste: number;
}

export interface ConsecutiveSlotSequence {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  sessionCount: number;
  slots: TimeSlot[];
}

/**
 * Validates consecutive active time slots strictly:
 * - Sequence of slots on the same day_of_week
 * - Each next slot start_minute must equal previous slot end_minute (NO crossing gaps/breaks)
 * - Total duration = sessionCount * 50
 */
export function findConsecutiveSlotSequences(
  timeSlots: TimeSlot[],
  sessionCount: number
): ConsecutiveSlotSequence[] {
  const activeSlots = timeSlots.filter((s) => s.is_active !== false);
  const dayGroups = new Map<number, TimeSlot[]>();

  for (const slot of activeSlots) {
    const d = Number(slot.day_of_week);
    if (!dayGroups.has(d)) dayGroups.set(d, []);
    dayGroups.get(d)!.push(slot);
  }

  const results: ConsecutiveSlotSequence[] = [];

  dayGroups.forEach((daySlots, dayOfWeek) => {
    // Sort strictly by start_minute ascending
    daySlots.sort((a, b) => a.start_minute - b.start_minute);

    for (let i = 0; i <= daySlots.length - sessionCount; i++) {
      let isConsecutive = true;
      for (let j = 0; j < sessionCount - 1; j++) {
        // STRICT GAP SLOT RULE: slot[i].end_minute === slot[i+1].start_minute
        if (daySlots[i + j].end_minute !== daySlots[i + j + 1].start_minute) {
          isConsecutive = false;
          break;
        }
      }

      if (isConsecutive) {
        const seqSlots = daySlots.slice(i, i + sessionCount);
        results.push({
          dayOfWeek,
          startMinute: seqSlots[0].start_minute,
          endMinute: seqSlots[seqSlots.length - 1].end_minute,
          sessionCount,
          slots: seqSlots,
        });
      }
    }
  });

  return results;
}

/**
 * Checks if two time intervals on the same day overlap
 */
function intervalsOverlap(
  dayA: number,
  startA: number,
  endA: number,
  dayB: number,
  startB: number,
  endB: number
): boolean {
  if (dayA !== dayB) return false;
  return startA < endB && endA > startB;
}

export const schedulingInitialService = {
  /**
   * Loads all required data once before initial schedule generation:
   * - Active rooms (is_active = true)
   * - Active time slots (is_active = true)
   * - Primary lecturer availability
   * - Eligible offerings (non-practicum, non-KKN, expected_students > 0, valid primary lecturer)
   */
  async loadStep4Data(
    activeTermId: string,
    step3Rows?: Step3OfferingLecturerRow[],
    rombelGroups?: CourseRombelGroup[]
  ): Promise<{
    offerings: InitialScheduleOffering[];
    rooms: Room[];
    timeSlots: TimeSlot[];
    availabilities: LecturerAvailability[];
    existingVersion: ScheduleVersion | null;
  }> {
    if (!isSupabaseConfigured() || !activeTermId) {
      return {
        offerings: [],
        rooms: [],
        timeSlots: [],
        availabilities: [],
        existingVersion: null,
      };
    }

    try {
      const isOwner = await verifyOwnerAdmin();

      // 1. Fetch Rooms (active only)
      let rooms: Room[] = [];
      try {
        rooms = await roomsService.getRooms({ status: 'active' });
      } catch (e) {
        console.warn('Error fetching rooms for step 4, fallback query:', e);
        const roomTable = isOwner ? 'rooms' : 'guest_rooms';
        const { data: rawRooms } = await supabase
          .from(roomTable)
          .select('*')
          .eq('is_active', true)
          .order('capacity', { ascending: true });
        rooms = rawRooms || [];
      }

      // 2. Fetch Time Slots (active only)
      let timeSlots: TimeSlot[] = [];
      try {
        timeSlots = await timeSlotsService.getTimeSlots({ activeOnly: true });
      } catch (e) {
        console.warn('Error fetching time slots for step 4, fallback query:', e);
        const slotTable = isOwner ? 'time_slots' : 'guest_time_slots';
        const { data: rawSlots } = await supabase
          .from(slotTable)
          .select('*')
          .eq('is_active', true)
          .order('day_of_week', { ascending: true })
          .order('start_minute', { ascending: true });
        timeSlots = (rawSlots || []).map((row: any) => ({
          ...row,
          duration_minutes: row.end_minute - row.start_minute,
        }));
      }

      // 3. Build eligible offerings strictly from Step 3 / database
      const eligibleOfferings: InitialScheduleOffering[] = [];

      if (step3Rows && step3Rows.length > 0) {
        // Use verified Step 3 rows (where single primary lecturer is already selected)
        for (const row of step3Rows) {
          // STRICT EXCLUSIONS:
          // 1. BUKAN PRAKTIKUM
          if (isPracticum(row.courseName) || isPracticum(row.courseCode)) continue;
          // 2. BUKAN KKN
          if (isKKN(row.courseName) || isKKN(row.courseCode)) continue;
          // 3. expected_students > 0
          if (row.expectedStudents <= 0) continue;
          // 4. valid primary_lecturer_id
          if (!row.primaryLecturerId || !row.primaryLecturer) continue;
          if (row.primaryLecturer.isLecturerInactive || row.primaryLecturer.isLecturerMissing) continue;

          eligibleOfferings.push({
            id: row.offeringId,
            courseId: row.courseId,
            courseCode: row.courseCode,
            courseName: row.courseName,
            classCode: row.classCode,
            semester: row.semester,
            curriculumYear: row.curriculumYear,
            effectiveSks: row.effectiveSks || 2,
            expectedStudents: row.expectedStudents,
            requiredRoomType: row.requiredRoomType || 'Ruang Kuliah Teori',
            primaryLecturerId: row.primaryLecturerId,
            primaryLecturerName: row.primaryLecturer.lecturerName,
            primaryLecturerCode: row.primaryLecturer.lecturerCode || '',
            isLecturerInactive: row.primaryLecturer.isLecturerInactive,
          });
        }
      } else {
        // Fallback: Query course offerings from Supabase
        const offTable = isOwner ? 'course_offerings' : 'guest_course_offerings';
        const lectTable = isOwner ? 'lecturers' : 'guest_lecturers';

        const [offRes, lectRes] = await Promise.all([
          supabase
            .from(offTable)
            .select(`
              id,
              class_code,
              expected_students,
              required_room_type,
              planning_metadata,
              academic_term_id,
              course:course_id (
                id,
                name,
                code,
                effective_sks,
                semester,
                curriculum_year
              )
            `)
            .eq('academic_term_id', activeTermId)
            .gt('expected_students', 0),
          supabase.from(lectTable).select('id, name, lecturer_code, is_active, status'),
        ]);

        const lectMap = new Map((lectRes.data || []).map((l: any) => [l.id, l]));

        for (const row of offRes.data || []) {
          const c = (row as any).course;
          if (!c) continue;
          if (isPracticum(c.name) || isPracticum(c.code)) continue;
          if (isKKN(c.name) || isKKN(c.code)) continue;

          const meta = (row as any).planning_metadata;
          const primaryLecturerId = meta?.primary_lecturer_id;
          if (!primaryLecturerId) continue;

          const lecturer = lectMap.get(primaryLecturerId);
          if (!lecturer) continue;
          const isInactive = lecturer.is_active === false || lecturer.status === 'Nonaktif';
          if (isInactive) continue;

          eligibleOfferings.push({
            id: row.id,
            courseId: c.id,
            courseCode: c.code,
            courseName: c.name,
            classCode: row.class_code,
            semester: c.semester || 1,
            curriculumYear: c.curriculum_year || 2026,
            effectiveSks: c.effective_sks || 2,
            expectedStudents: row.expected_students || 0,
            requiredRoomType: row.required_room_type || 'Ruang Kuliah Teori',
            primaryLecturerId,
            primaryLecturerName: lecturer.name,
            primaryLecturerCode: lecturer.lecturer_code || '',
            isLecturerInactive: false,
          });
        }
      }

      // 4. Fetch Lecturer Availability for all primary lecturers
      const uniqueLecturerIds = [...new Set(eligibleOfferings.map((o) => o.primaryLecturerId))];
      let availabilities: LecturerAvailability[] = [];

      if (uniqueLecturerIds.length > 0) {
        try {
          const { data: rawAvail } = await supabase
            .from('lecturer_availability')
            .select('*')
            .in('lecturer_id', uniqueLecturerIds);
          availabilities = rawAvail || [];
        } catch {
          availabilities = [];
        }
      }

      // 5. Check latest draft version
      let existingVersion: ScheduleVersion | null = null;
      try {
        const versions = await scheduleVersionsService.getVersions(activeTermId);
        existingVersion = versions.find((v) => v.status === 'DRAFT') || versions[0] || null;
      } catch {
        existingVersion = null;
      }

      return {
        offerings: eligibleOfferings,
        rooms,
        timeSlots,
        availabilities,
        existingVersion,
      };
    } catch (err) {
      console.error('[schedulingInitialService] loadStep4Data error:', err);
      throw err;
    }
  },

  /**
   * Generates the initial schedule using greedy room-fit and availability heuristic.
   * STRICT RULES:
   * 1. 1 SKS = 50 min. session_count = effective_sks.
   * 2. Consecutive slot sequence verified via slot[i].end_minute === slot[i+1].start_minute.
   * 3. Candidate rooms: is_active = true, room_type === required_room_type, capacity >= expected_students.
   * 4. Room waste: (room.capacity - expected_students). Smaller waste preferred.
   * 5. Strict room type: Ruang Teori !== Lab.
   * 6. Primary lecturer availability: unavailable = penalty avoid; preferred = bonus; avoid = penalty.
   * 7. Initial schedule may still have conflicts (resolved later in Step 5).
   */
  generateInitialSchedule(
    offerings: InitialScheduleOffering[],
    rooms: Room[],
    timeSlots: TimeSlot[],
    availabilities: LecturerAvailability[]
  ): {
    entries: InitialScheduleEntry[];
    conflicts: InitialScheduleConflict[];
    stats: InitialScheduleStats;
  } {
    const activeRooms = rooms.filter((r) => r.is_active !== false);

    if (offerings.length === 0 || activeRooms.length === 0 || timeSlots.length === 0) {
      return {
        entries: [],
        conflicts: [],
        stats: {
          totalOfferings: offerings.length,
          scheduledCount: 0,
          unscheduledCount: offerings.length,
          roomsUsedCount: 0,
          totalSks: 0,
          totalConflicts: 0,
          roomConflictCount: 0,
          lecturerConflictCount: 0,
          capacityViolationCount: 0,
          availabilityConflictCount: 0,
          averageSeatWaste: 0,
        },
      };
    }

    // 1. Group availability by lecturerId
    const availMap = new Map<string, LecturerAvailability[]>();
    for (const a of availabilities) {
      if (!availMap.has(a.lecturer_id)) availMap.set(a.lecturer_id, []);
      availMap.get(a.lecturer_id)!.push(a);
    }

    // 2. Pre-calculate consecutive slot sequences for SKS durations 1..6
    const sequencesBySks = new Map<number, ConsecutiveSlotSequence[]>();
    for (let sks = 1; sks <= 6; sks++) {
      sequencesBySks.set(sks, findConsecutiveSlotSequences(timeSlots, sks));
    }

    // 3. Sort offerings deterministically (hardest first):
    // - Lab room type first
    // - Higher expected_students first
    // - Higher effective_sks first
    // - Lecturer with more unavailable slots first
    // - Tie-breaker: courseCode ASC, classCode ASC
    const sortedOfferings = [...offerings].sort((a, b) => {
      const aIsLab = a.requiredRoomType.toLowerCase().includes('lab') ? 1 : 0;
      const bIsLab = b.requiredRoomType.toLowerCase().includes('lab') ? 1 : 0;
      if (aIsLab !== bIsLab) return bIsLab - aIsLab;

      if (b.expectedStudents !== a.expectedStudents) {
        return b.expectedStudents - a.expectedStudents;
      }

      if (b.effectiveSks !== a.effectiveSks) {
        return b.effectiveSks - a.effectiveSks;
      }

      const aUnavailCount = (availMap.get(a.primaryLecturerId) || []).filter(
        (av) => av.is_available === false
      ).length;
      const bUnavailCount = (availMap.get(b.primaryLecturerId) || []).filter(
        (av) => av.is_available === false
      ).length;
      if (aUnavailCount !== bUnavailCount) return bUnavailCount - aUnavailCount;

      const codeComp = a.courseCode.localeCompare(b.courseCode);
      if (codeComp !== 0) return codeComp;
      return a.classCode.localeCompare(b.classCode);
    });

    // 4. Placed records tracking for conflict evaluation
    interface PlacedMeta {
      offeringId: string;
      offering: InitialScheduleOffering;
      dayOfWeek: number;
      startMinute: number;
      endMinute: number;
      roomId: string;
      primaryLecturerId: string;
      semester: number;
    }
    const placedList: PlacedMeta[] = [];
    const entries: InitialScheduleEntry[] = [];

    for (const offering of sortedOfferings) {
      const sks = offering.effectiveSks || 2;
      const availableSequences = sequencesBySks.get(sks) || [];

      // 4a. Filter candidate rooms:
      // STRICT ROOM TYPE: Ruang Kuliah Teori !== Laboratorium
      const reqTypeLower = offering.requiredRoomType.trim().toLowerCase();
      const isLab = reqTypeLower.includes('lab');

      let candidateRooms = activeRooms.filter((r) => {
        const actualType = (r.room_type || '').trim().toLowerCase();
        if (isLab) {
          return actualType.includes('lab');
        } else {
          return !actualType.includes('lab');
        }
      });

      // Filter rooms with capacity >= expectedStudents
      let eligibleRooms = candidateRooms.filter((r) => r.capacity >= offering.expectedStudents);

      // If no room with sufficient capacity exists for strict room type, fallback to candidate rooms with largest capacity
      if (eligibleRooms.length === 0) {
        eligibleRooms = candidateRooms.length > 0 ? candidateRooms : activeRooms;
      }

      // Sort candidate rooms by roomWaste = room.capacity - expectedStudents (prefer minimal waste)
      eligibleRooms.sort((a, b) => {
        const wasteA = Math.abs(a.capacity - offering.expectedStudents);
        const wasteB = Math.abs(b.capacity - offering.expectedStudents);
        if (wasteA !== wasteB) return wasteA - wasteB;
        return a.code.localeCompare(b.code);
      });

      // 4b. Evaluate all (sequence, room) candidate combinations
      let bestCombination: {
        sequence: ConsecutiveSlotSequence;
        room: Room;
        score: number;
      } | null = null;

      const lectAvailabilities = availMap.get(offering.primaryLecturerId) || [];

      for (const seq of availableSequences) {
        const day = seq.dayOfWeek;
        const startMin = seq.startMinute;
        const endMin = seq.endMinute;

        // Base penalty for lecturer availability
        let lectPenalty = 0;
        for (const av of lectAvailabilities) {
          if (av.day_of_week === day && startMin < av.end_minute && endMin > av.start_minute) {
            if (av.is_available === false) {
              lectPenalty += 5000; // Hard avoid unavailable slot
            } else if (av.preference === 'preferred') {
              lectPenalty -= 50; // Bonus for preferred slot
            } else if (av.preference === 'avoid') {
              lectPenalty += 100; // Slight penalty for avoid
            }
          }
        }

        // Friday prayer window penalty (Jumat 11:30 - 13:00 -> 690 to 780 min)
        if (day === 5 && startMin < 780 && endMin > 690) {
          lectPenalty += 400;
        }

        // Lecturer daily teaching load
        const lectDayClasses = placedList.filter(
          (p) => p.primaryLecturerId === offering.primaryLecturerId && p.dayOfWeek === day
        ).length;
        if (lectDayClasses >= 2) {
          lectPenalty += 40 * (lectDayClasses - 1);
        }

        // Lecturer overlapping with another placed class
        const lectOverlapCount = placedList.filter(
          (p) =>
            p.primaryLecturerId === offering.primaryLecturerId &&
            intervalsOverlap(day, startMin, endMin, p.dayOfWeek, p.startMinute, p.endMinute)
        ).length;
        if (lectOverlapCount > 0) {
          lectPenalty += 3000 * lectOverlapCount;
        }

        // Semester cohort spread: avoid having multiple classes of same semester at the same time
        const semOverlapCount = placedList.filter(
          (p) =>
            p.semester === offering.semester &&
            intervalsOverlap(day, startMin, endMin, p.dayOfWeek, p.startMinute, p.endMinute)
        ).length;
        if (semOverlapCount > 0) {
          lectPenalty += 30 * semOverlapCount;
        }

        for (const room of eligibleRooms) {
          let score = lectPenalty;

          // Room fit waste: prefer minimal waste
          const roomWaste = room.capacity - offering.expectedStudents;
          if (roomWaste >= 0) {
            score += roomWaste * 1;
          } else {
            // Capacity deficit penalty
            score += 2000 + Math.abs(roomWaste) * 10;
          }

          // Room overlap penalty
          const roomOverlapCount = placedList.filter(
            (p) =>
              p.roomId === room.id &&
              intervalsOverlap(day, startMin, endMin, p.dayOfWeek, p.startMinute, p.endMinute)
          ).length;
          if (roomOverlapCount > 0) {
            score += 3000 * roomOverlapCount;
          }

          // Even day distribution heuristic (spread over Senin..Jumat)
          score += day * 5;

          if (!bestCombination || score < bestCombination.score) {
            bestCombination = { sequence: seq, room, score };
          }
        }
      }

      // If for any reason no combination was evaluated, fallback to first sequence and first room
      if (!bestCombination && availableSequences.length > 0 && eligibleRooms.length > 0) {
        bestCombination = {
          sequence: availableSequences[0],
          room: eligibleRooms[0],
          score: 9999,
        };
      }

      if (bestCombination) {
        const { sequence: seq, room } = bestCombination;
        const startMin = seq.startMinute;
        const endMin = seq.endMinute;
        const day = seq.dayOfWeek;

        placedList.push({
          offeringId: offering.id,
          offering,
          dayOfWeek: day,
          startMinute: startMin,
          endMinute: endMin,
          roomId: room.id,
          primaryLecturerId: offering.primaryLecturerId,
          semester: offering.semester,
        });

        const seatWaste = room.capacity - offering.expectedStudents;
        const isCapacityExceeded = seatWaste < 0;

        entries.push({
          id: `initial-entry-${offering.id}`,
          courseOfferingId: offering.id,
          offering,
          roomId: room.id,
          roomCode: room.code,
          roomName: room.name,
          roomCapacity: room.capacity,
          roomType: room.room_type,
          dayOfWeek: day,
          dayName: dayOfWeekToName(day),
          startMinute: startMin,
          endMinute: endMin,
          startTime: minuteToTime(startMin),
          endTime: minuteToTime(endMin),
          sessionCount: seq.sessionCount,
          seatWaste,
          isCapacityExceeded,
          conflicts: [],
        });
      }
    }

    // 5. Conflict Detection on Generated Initial Schedule
    const detectedConflicts: InitialScheduleConflict[] = [];

    // 5a. Room overlaps
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];

        if (
          a.roomId === b.roomId &&
          intervalsOverlap(a.dayOfWeek, a.startMinute, a.endMinute, b.dayOfWeek, b.startMinute, b.endMinute)
        ) {
          const conflict: InitialScheduleConflict = {
            id: `conf-room-${a.courseOfferingId}-${b.courseOfferingId}`,
            type: 'ROOM_OVERLAP',
            severity: 'CRITICAL',
            title: `Bentrok Ruangan: ${a.roomCode}`,
            description: `Ruang ${a.roomCode} digunakan bersamaan oleh ${a.offering.courseName} (${a.offering.classCode}) dan ${b.offering.courseName} (${b.offering.classCode}) pada ${a.dayName}, ${a.startTime}-${a.endTime}.`,
            offeringIds: [a.courseOfferingId, b.courseOfferingId],
            roomId: a.roomId,
            dayOfWeek: a.dayOfWeek,
            startMinute: Math.max(a.startMinute, b.startMinute),
            endMinute: Math.min(a.endMinute, b.endMinute),
          };
          detectedConflicts.push(conflict);
          a.conflicts.push(conflict);
          b.conflicts.push(conflict);
        }

        // 5b. Lecturer overlaps (EXACTLY 1 primary lecturer per class)
        if (
          a.offering.primaryLecturerId === b.offering.primaryLecturerId &&
          intervalsOverlap(a.dayOfWeek, a.startMinute, a.endMinute, b.dayOfWeek, b.startMinute, b.endMinute)
        ) {
          const conflict: InitialScheduleConflict = {
            id: `conf-lect-${a.courseOfferingId}-${b.courseOfferingId}`,
            type: 'LECTURER_OVERLAP',
            severity: 'CRITICAL',
            title: `Bentrok Dosen Pengampu: ${a.offering.primaryLecturerName}`,
            description: `${a.offering.primaryLecturerName} dijadwalkan mengajar 2 kelas sekaligus: ${a.offering.courseName} (${a.offering.classCode}) dan ${b.offering.courseName} (${b.offering.classCode}) pada ${a.dayName}, ${a.startTime}-${a.endTime}.`,
            offeringIds: [a.courseOfferingId, b.courseOfferingId],
            lecturerId: a.offering.primaryLecturerId,
            dayOfWeek: a.dayOfWeek,
            startMinute: Math.max(a.startMinute, b.startMinute),
            endMinute: Math.min(a.endMinute, b.endMinute),
          };
          detectedConflicts.push(conflict);
          a.conflicts.push(conflict);
          b.conflicts.push(conflict);
        }
      }

      // 5c. Capacity exceeded
      const entry = entries[i];
      if (entry.isCapacityExceeded) {
        const conflict: InitialScheduleConflict = {
          id: `conf-cap-${entry.courseOfferingId}`,
          type: 'CAPACITY_EXCEEDED',
          severity: 'HIGH',
          title: `Kapasitas Ruang Kurang: ${entry.roomCode}`,
          description: `Peserta kelas ${entry.offering.courseName} (${entry.offering.expectedStudents} mhs) melebihi kapasitas ${entry.roomCode} (${entry.roomCapacity} kursi).`,
          offeringIds: [entry.courseOfferingId],
          roomId: entry.roomId,
        };
        detectedConflicts.push(conflict);
        entry.conflicts.push(conflict);
      }

      // 5d. Lecturer unavailable interval
      const lectAvails = availMap.get(entry.offering.primaryLecturerId) || [];
      for (const av of lectAvails) {
        if (
          av.day_of_week === entry.dayOfWeek &&
          av.is_available === false &&
          intervalsOverlap(entry.dayOfWeek, entry.startMinute, entry.endMinute, av.day_of_week, av.start_minute, av.end_minute)
        ) {
          const conflict: InitialScheduleConflict = {
            id: `conf-unavail-${entry.courseOfferingId}`,
            type: 'LECTURER_UNAVAILABLE',
            severity: 'HIGH',
            title: `Dosen Berhalangan: ${entry.offering.primaryLecturerName}`,
            description: `${entry.offering.primaryLecturerName} berhalangan hadir pada ${entry.dayName} pukul ${minuteToTime(av.start_minute)}-${minuteToTime(av.end_minute)}.`,
            offeringIds: [entry.courseOfferingId],
            lecturerId: entry.offering.primaryLecturerId,
          };
          detectedConflicts.push(conflict);
          entry.conflicts.push(conflict);
          break;
        }
      }
    }

    // 6. Calculate Stats
    const scheduledOfferingIds = new Set(entries.map((e) => e.courseOfferingId));
    const usedRoomIds = new Set(entries.map((e) => e.roomId));
    const totalSks = entries.reduce((acc, e) => acc + e.offering.effectiveSks, 0);

    const roomConflictCount = detectedConflicts.filter((c) => c.type === 'ROOM_OVERLAP').length;
    const lecturerConflictCount = detectedConflicts.filter((c) => c.type === 'LECTURER_OVERLAP').length;
    const capacityViolationCount = detectedConflicts.filter((c) => c.type === 'CAPACITY_EXCEEDED').length;
    const availabilityConflictCount = detectedConflicts.filter((c) => c.type === 'LECTURER_UNAVAILABLE').length;

    const totalWaste = entries.reduce((acc, e) => acc + Math.max(0, e.seatWaste), 0);
    const averageSeatWaste = entries.length > 0 ? Math.round(totalWaste / entries.length) : 0;

    const stats: InitialScheduleStats = {
      totalOfferings: offerings.length,
      scheduledCount: scheduledOfferingIds.size,
      unscheduledCount: Math.max(0, offerings.length - scheduledOfferingIds.size),
      roomsUsedCount: usedRoomIds.size,
      totalSks,
      totalConflicts: detectedConflicts.length,
      roomConflictCount,
      lecturerConflictCount,
      capacityViolationCount,
      availabilityConflictCount,
      averageSeatWaste,
    };

    return {
      entries,
      conflicts: detectedConflicts,
      stats,
    };
  },

  /**
   * Persists the generated initial schedule to Supabase:
   * - Finds or creates a DRAFT schedule_version
   * - Saves all entries to schedule_entries
   * - Ensures primary lecturer consistency: lecturer_ids: [primaryLecturerId]
   */
  async saveInitialScheduleToSupabase(
    termId: string,
    termYear: string,
    termSemester: string,
    entries: InitialScheduleEntry[],
    existingVersionId?: string
  ): Promise<{ version: ScheduleVersion; savedCount: number }> {
    await assertOwnerAdmin('menyimpan jadwal awal');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    try {
      // 1. Get or create DRAFT version (use existingVersionId if provided)
      let version: ScheduleVersion | null = null;
      if (existingVersionId) {
        version = await scheduleVersionsService.getVersionById(existingVersionId);
      }

      if (!version) {
        const versions = await scheduleVersionsService.getVersions(termId);
        const existingDraft = versions.find((v) => v.status === 'DRAFT');

        if (existingDraft) {
          version = existingDraft;
        } else {
          const title = `Jadwal Perkuliahan - ${termYear} ${termSemester}`;
          version = await scheduleVersionsService.createDraft(termId, title);
        }
      }

      // 2. Set schedule scope using active non-practicum offerings
      const activeOfferingIds = entries.map((e) => e.courseOfferingId);
      if (activeOfferingIds.length > 0) {
        try {
          const scopeRes = await scheduleVersionsService.setScheduleScope(
            version.id,
            version.revision,
            activeOfferingIds
          );
          if (scopeRes.version) {
            version = scopeRes.version;
          }
        } catch (scopeErr) {
          console.warn('Warning setting schedule scope in saveInitialSchedule:', scopeErr);
        }
      }

      // 3. Prepare entries payload
      const cleanEntries = entries.map((e) => ({
        schedule_version_id: version!.id,
        course_offering_id: e.courseOfferingId,
        room_id: e.roomId,
        day_of_week: Number(e.dayOfWeek),
        start_minute: Number(e.startMinute),
        end_minute: Number(e.endMinute),
        session_count: Number(e.sessionCount),
        course_name: e.offering.courseName,
        course_code: e.offering.courseCode,
        class_code: e.offering.classCode,
        student_count: e.offering.expectedStudents,
        room_capacity: e.roomCapacity,
        // BACKEND PRIMARY LECTURER CONSISTENCY: PASS
        lecturer_ids: [e.offering.primaryLecturerId],
        lecturer_names: e.offering.primaryLecturerName,
      }));

      // Clear existing entries for this draft version via secure RPC
      await scheduleVersionsService.clearDraftEntries(version.id);

      // Insert new initial entries
      if (cleanEntries.length > 0) {
        const { error: insertErr } = await supabase
          .from('schedule_entries')
          .insert(cleanEntries);

        if (insertErr) {
          console.error('Error inserting initial schedule_entries:', insertErr);
          throw new Error(parseSupabaseError(insertErr));
        }
      }

      // Refresh version conflicts
      await scheduleVersionsService.refreshConflicts(version.id);
      const updatedVersion = (await scheduleVersionsService.getVersionById(version.id)) || version;

      return {
        version: updatedVersion,
        savedCount: cleanEntries.length,
      };
    } catch (err: any) {
      console.error('[schedulingInitialService] saveInitialScheduleToSupabase error:', err);
      throw err;
    }
  },
};
