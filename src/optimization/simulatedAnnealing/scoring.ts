import {
  SASolution,
  SAOfferingContext,
  SARoomContext,
  SALecturerAvailabilityContext,
  ConsecutiveSlot,
  SAWeights,
  SACostBreakdown,
  HardConflictDetail,
} from './types';
import {
  intervalsOverlap,
  classCodesOverlap,
  isFridayPrayerOverlap,
  isValidConsecutiveSequence,
  isLecturerUnavailable,
  getLecturerPreference,
} from './constraints';

export interface PreparedOfferingAssignment {
  offering: SAOfferingContext;
  room?: SARoomContext;
  roomId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  sks: number;
}

/**
 * Prepares assignment lookup structure for high-speed evaluation in SA loop
 */
export function prepareAssignments(
  solution: SASolution,
  offeringsMap: Map<string, SAOfferingContext>,
  roomsMap: Map<string, SARoomContext>
): PreparedOfferingAssignment[] {
  const list: PreparedOfferingAssignment[] = [];

  for (let i = 0; i < solution.length; i++) {
    const entry = solution[i];
    const offering = offeringsMap.get(entry.courseOfferingId);
    if (!offering) continue;

    const room = roomsMap.get(entry.roomId);
    const sks = offering.effectiveSks || 2;
    const durationMinutes = offering.durationMinutes || (sks * 50);
    const startMinute = entry.startMinute;
    const endMinute = startMinute + durationMinutes;

    list.push({
      offering,
      room,
      roomId: entry.roomId,
      dayOfWeek: Number(entry.dayOfWeek),
      startMinute,
      endMinute,
      durationMinutes,
      sks,
    });
  }

  return list;
}

/**
 * Evaluates the full solution against all Hard & Soft Constraints.
 * Returns detailed cost breakdown and specific conflict items for UI.
 */
export function evaluateSolution(
  solution: SASolution,
  offeringsMap: Map<string, SAOfferingContext>,
  roomsMap: Map<string, SARoomContext>,
  availabilitiesMap: Map<string, SALecturerAvailabilityContext[]>,
  validSequencesBySks: Record<number, ConsecutiveSlot[]>,
  weights: SAWeights,
  includeDetails: boolean = true
): SACostBreakdown {
  const items = prepareAssignments(solution, offeringsMap, roomsMap);

  let hc1Count = 0; // Room overlap
  let hc2Count = 0; // Lecturer overlap
  let hc3Count = 0; // Class group overlap
  let hc4Count = 0; // Capacity deficit
  let hc5Count = 0; // Room type mismatch
  let hc6Count = 0; // Lecturer unavailable
  let hc7Count = 0; // Invalid consecutive slot
  let hc8Count = 0; // Friday prayer
  let hc9Count = 0; // Inactive room

  let softCost = 0;
  let softPenaltiesCount = 0;
  const conflicts: HardConflictDetail[] = [];

  // Groupings for soft constraints
  // Key: lecturerId:dayOfWeek -> count
  const lecturerDailyTeachingCount = new Map<string, number>();
  // Key: semester:dayOfWeek -> count
  const semesterDailyCount = new Map<string, number>();

  // 1. Unary Constraints per assignment
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { offering, room, roomId, dayOfWeek, startMinute, endMinute, sks } = item;

    // Track for soft constraint: Lecturer daily teaching count
    const lectKey = `${offering.primaryLecturerId}:${dayOfWeek}`;
    lecturerDailyTeachingCount.set(lectKey, (lecturerDailyTeachingCount.get(lectKey) || 0) + 1);

    // Track for soft constraint: Semester day spread
    const semKey = `${offering.semester}:${dayOfWeek}`;
    semesterDailyCount.set(semKey, (semesterDailyCount.get(semKey) || 0) + 1);

    // HC4: Room Capacity
    if (room && offering.expectedStudents > room.capacity) {
      hc4Count++;
      if (includeDetails) {
        conflicts.push({
          type: 'HC4_CAPACITY_EXCEEDED',
          description: `Kapasitas ruang ${room.code} (${room.capacity} kursi) kurang untuk ${offering.courseName} (${offering.classCode}, ${offering.expectedStudents} mhs).`,
          offeringIds: [offering.id],
          roomId,
        });
      }
    }

    // HC5: Room Type Strict
    if (room && offering.requiredRoomType && room.roomType !== offering.requiredRoomType) {
      hc5Count++;
      if (includeDetails) {
        conflicts.push({
          type: 'HC5_ROOM_TYPE_MISMATCH',
          description: `Tipe ruang ${room.code} (${room.roomType}) tidak cocok dengan kebutuhan ${offering.courseName} (${offering.requiredRoomType}).`,
          offeringIds: [offering.id],
          roomId,
        });
      }
    }

    // HC6: Lecturer Unavailable
    if (
      isLecturerUnavailable(
        offering.primaryLecturerId,
        dayOfWeek,
        startMinute,
        endMinute,
        availabilitiesMap
      )
    ) {
      hc6Count++;
      if (includeDetails) {
        conflicts.push({
          type: 'HC6_LECTURER_UNAVAILABLE',
          description: `Dosen pengampu ${offering.primaryLecturerName} berhalangan hadir pada slot waktu perkuliahan ${offering.courseName} (${offering.classCode}).`,
          offeringIds: [offering.id],
          lecturerId: offering.primaryLecturerId,
          dayOfWeek,
          startMinute,
          endMinute,
        });
      }
    }

    // HC7: Valid Consecutive Time Slot Sequence
    if (!isValidConsecutiveSequence(dayOfWeek, startMinute, sks, validSequencesBySks)) {
      hc7Count++;
      if (includeDetails) {
        conflicts.push({
          type: 'HC7_INVALID_SLOT',
          description: `Slot waktu ${offering.courseName} (${offering.classCode}, ${sks} SKS) tidak memiliki urutan waktu berurutan aktif tanpa jeda.`,
          offeringIds: [offering.id],
          dayOfWeek,
          startMinute,
          endMinute,
        });
      }
    }

    // HC8: Friday Prayer Window
    if (isFridayPrayerOverlap(dayOfWeek, startMinute, endMinute)) {
      hc8Count++;
      if (includeDetails) {
        conflicts.push({
          type: 'HC8_FRIDAY_PRAYER',
          description: `Perkuliahan ${offering.courseName} (${offering.classCode}) melewati waktu Sholat Jumat (11:30 - 13:00).`,
          offeringIds: [offering.id],
          dayOfWeek,
          startMinute,
          endMinute,
        });
      }
    }

    // HC9: Inactive Room
    if (!room || room.isActive === false) {
      hc9Count++;
      if (includeDetails) {
        conflicts.push({
          type: 'HC9_INACTIVE_ROOM',
          description: `Ruangan ${room?.code || roomId} berstatus tidak aktif.`,
          offeringIds: [offering.id],
          roomId,
        });
      }
    }

    // SC1: Lecturer Preference (Preferred bonus / Avoid penalty)
    const pref = getLecturerPreference(
      offering.primaryLecturerId,
      dayOfWeek,
      startMinute,
      endMinute,
      availabilitiesMap
    );
    if (pref === 'avoid') {
      softCost += weights.sc1LecturerAvoidPreference;
      softPenaltiesCount++;
    } else if (pref === 'preferred') {
      softCost += weights.sc1LecturerPreferredBonus; // negative (bonus)
    }

    // SC2: Room Waste (Capacity fit)
    if (room && room.capacity >= offering.expectedStudents) {
      const waste = room.capacity - offering.expectedStudents;
      softCost += waste * weights.sc2RoomWaste;
    }
  }

  // 2. Binary Constraints (Pairwise overlap checks)
  for (let i = 0; i < items.length; i++) {
    const a = items[i];

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];

      // Must be on the same day to overlap
      if (a.dayOfWeek !== b.dayOfWeek) continue;

      // Check time overlap
      if (!intervalsOverlap(a.dayOfWeek, a.startMinute, a.endMinute, b.dayOfWeek, b.startMinute, b.endMinute)) {
        continue;
      }

      // HC1: Room Overlap
      if (a.roomId === b.roomId) {
        hc1Count++;
        if (includeDetails) {
          conflicts.push({
            type: 'HC1_ROOM_OVERLAP',
            description: `Bentrok Ruang ${a.room?.code || a.roomId}: Digunakan bersamaan oleh ${a.offering.courseName} (${a.offering.classCode}) dan ${b.offering.courseName} (${b.offering.classCode}).`,
            offeringIds: [a.offering.id, b.offering.id],
            roomId: a.roomId,
            dayOfWeek: a.dayOfWeek,
            startMinute: Math.max(a.startMinute, b.startMinute),
            endMinute: Math.min(a.endMinute, b.endMinute),
          });
        }
      }

      // HC2: Lecturer Overlap (Exact same primary lecturer)
      if (a.offering.primaryLecturerId === b.offering.primaryLecturerId) {
        hc2Count++;
        if (includeDetails) {
          conflicts.push({
            type: 'HC2_LECTURER_OVERLAP',
            description: `Bentrok Dosen ${a.offering.primaryLecturerName}: Dijadwalkan mengajar 2 kelas sekaligus (${a.offering.courseName} ${a.offering.classCode} & ${b.offering.courseName} ${b.offering.classCode}).`,
            offeringIds: [a.offering.id, b.offering.id],
            lecturerId: a.offering.primaryLecturerId,
            dayOfWeek: a.dayOfWeek,
            startMinute: Math.max(a.startMinute, b.startMinute),
            endMinute: Math.min(a.endMinute, b.endMinute),
          });
        }
      }

      // HC3: Class Group Conflict
      // Conditions:
      // Same curriculum year, same semester, class codes overlap
      // AND (same KBK OR either is general/null)
      if (
        a.offering.curriculumYear === b.offering.curriculumYear &&
        a.offering.semester === b.offering.semester &&
        classCodesOverlap(a.offering.classCode, b.offering.classCode)
      ) {
        const kbkMatches = !a.offering.kbk || !b.offering.kbk || a.offering.kbk === b.offering.kbk;
        if (kbkMatches) {
          hc3Count++;
          if (includeDetails) {
            conflicts.push({
              type: 'HC3_CLASS_GROUP_CONFLICT',
              description: `Bentrok Rombel Mahasiswa: Semester ${a.offering.semester} Kelas ${a.offering.classCode} mengikuti ${a.offering.courseName} dan ${b.offering.courseName} di jam yang sama.`,
              offeringIds: [a.offering.id, b.offering.id],
              dayOfWeek: a.dayOfWeek,
              startMinute: Math.max(a.startMinute, b.startMinute),
              endMinute: Math.min(a.endMinute, b.endMinute),
            });
          }
        }
      }
    }
  }

  // 3. Aggregate Soft Constraints:
  // SC3: Lecturer Daily Overload (> 2 classes on the same day)
  lecturerDailyTeachingCount.forEach((count) => {
    if (count > 2) {
      softCost += (count - 2) * weights.sc3LecturerDailyOverload;
      softPenaltiesCount += count - 2;
    }
  });

  // SC4: Semester cohort day spread (> 3 classes of same semester on the same day)
  semesterDailyCount.forEach((count) => {
    if (count > 3) {
      softCost += (count - 3) * weights.sc4CohortDaySpread;
      softPenaltiesCount += count - 3;
    }
  });

  // Total Hard Cost calculation
  const hardCost =
    hc1Count * weights.hc1RoomOverlap +
    hc2Count * weights.hc2LecturerOverlap +
    hc3Count * weights.hc3ClassGroupConflict +
    hc4Count * weights.hc4CapacityExceeded +
    hc5Count * weights.hc5RoomTypeMismatch +
    hc6Count * weights.hc6LecturerUnavailable +
    hc7Count * weights.hc7InvalidSlotSequence +
    hc8Count * weights.hc8FridayPrayer +
    hc9Count * weights.hc9InactiveRoom;

  const hardConflictsCount =
    hc1Count + hc2Count + hc3Count + hc4Count + hc5Count + hc6Count + hc7Count + hc8Count + hc9Count;

  const totalCost = hardCost + Math.max(0, softCost);

  return {
    totalCost,
    hardCost,
    softCost,
    hardConflictsCount,
    softPenaltiesCount,
    hc1Count,
    hc2Count,
    hc3Count,
    hc4Count,
    hc5Count,
    hc6Count,
    hc7Count,
    hc8Count,
    hc9Count,
    conflicts,
  };
}
