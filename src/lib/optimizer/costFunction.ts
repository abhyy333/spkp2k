import {
  ScheduleSolution,
  SchedulableOffering,
  CostBreakdown,
  ConstraintViolation,
  ConstraintWeights,
} from './types';
import { Room, TimeSlot, LecturerAvailability } from '../../types';

export const DEFAULT_WEIGHTS: ConstraintWeights = {
  hardRoomOverlap: 1000,
  hardLecturerOverlap: 1000,
  hardCapacity: 1000,
  hardRoomType: 1000,
  hardSlotContinuity: 1000,
  hardLecturerUnavailable: 1000,

  softLecturerPreference: 40,
  softFridayPrayer: 60,
  softLecturerDailyLoad: 25,
  softSemesterConflict: 35,
  softRoomCompactness: 10,
};

/**
 * Check if two time intervals on the same day overlap:
 * startA < endB && startB < endA
 */
export function isOverlapping(
  dayA: number,
  startA: number,
  endA: number,
  dayB: number,
  startB: number,
  endB: number
): boolean {
  if (Number(dayA) !== Number(dayB)) return false;
  return startA < endB && startB < endA;
}

/**
 * Evaluates the full cost of a candidate solution, calculating both Hard and Soft constraint penalties.
 */
export function evaluateSolution(
  solution: ScheduleSolution,
  offeringsMap: Map<string, SchedulableOffering>,
  roomsMap: Map<string, Room>,
  timeSlots: TimeSlot[],
  availabilities: LecturerAvailability[],
  weights: ConstraintWeights = DEFAULT_WEIGHTS
): CostBreakdown {
  const violations: ConstraintViolation[] = [];
  let hardCost = 0;
  let softCost = 0;
  let hardViolationsCount = 0;
  let softViolationsCount = 0;

  // Pre-index active time slots by day for fast continuity checking
  const activeSlotsByDay = new Map<number, Set<number>>();
  for (const slot of timeSlots) {
    if (slot.is_active !== false) {
      const d = Number(slot.day_of_week);
      if (!activeSlotsByDay.has(d)) {
        activeSlotsByDay.set(d, new Set<number>());
      }
      activeSlotsByDay.get(d)!.add(slot.start_minute);
    }
  }

  // Pre-calculate derived intervals
  const items = solution.map((assignment) => {
    const offering = offeringsMap.get(assignment.courseOfferingId);
    const room = roomsMap.get(assignment.roomId);
    const sks = offering?.effectiveSks || 2;
    const duration = sks * 50;
    const startMinute = assignment.startMinute;
    const endMinute = startMinute + duration;
    const dayOfWeek = assignment.dayOfWeek;

    return {
      assignment,
      offering,
      room,
      sks,
      duration,
      startMinute,
      endMinute,
      dayOfWeek,
    };
  });

  // Track lecturer daily assignments for overload soft constraint
  // Key: `${lecturerId}-${dayOfWeek}` -> count
  const lecturerDayCount = new Map<string, number>();

  // 1. Individual Offering Evaluations (Capacity, Room Type, Continuity, Availability, Friday Prayer)
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { assignment, offering, room, sks, startMinute, endMinute, dayOfWeek } = item;
    if (!offering || !room) continue;

    // A. CAPACITY CONSTRAINT (Hard)
    if (offering.expectedStudents > room.capacity) {
      const excess = offering.expectedStudents - room.capacity;
      const penalty = weights.hardCapacity + excess * 5;
      hardCost += penalty;
      hardViolationsCount++;
      violations.push({
        id: `cap-${assignment.courseOfferingId}-${room.id}`,
        type: 'CAPACITY_EXCEEDED',
        category: 'HARD',
        penalty,
        title: 'Kapasitas Ruangan Terlampaui',
        description: `Kelas ${offering.courseName} (${offering.expectedStudents} mhs) melebihi kapasitas ${room.name} (${room.capacity} kursi).`,
        offeringIds: [offering.id],
        roomId: room.id,
      });
    } else {
      // Soft Compactness: Don't place a tiny class of 10 in a 100-seat hall if avoided
      const waste = room.capacity - offering.expectedStudents;
      if (waste > 45) {
        const penalty = weights.softRoomCompactness;
        softCost += penalty;
        softViolationsCount++;
        violations.push({
          id: `compact-${assignment.courseOfferingId}`,
          type: 'ROOM_UNDERUTILIZED',
          category: 'SOFT',
          penalty,
          title: 'Ruangan Terlalu Longgar',
          description: `Kelas ${offering.courseName} (${offering.expectedStudents} mhs) menggunakan ruangan ${room.name} (${room.capacity} kursi, sisa ${waste} kursi).`,
          offeringIds: [offering.id],
          roomId: room.id,
        });
      }
    }

    // B. ROOM TYPE CONSTRAINT (Hard)
    const requiredType = offering.requiredRoomType.toLowerCase().trim();
    const actualType = (room.room_type || '').toLowerCase().trim();
    if (requiredType && actualType && requiredType !== actualType) {
      const penalty = weights.hardRoomType;
      hardCost += penalty;
      hardViolationsCount++;
      violations.push({
        id: `room-type-${assignment.courseOfferingId}`,
        type: 'ROOM_TYPE_MISMATCH',
        category: 'HARD',
        penalty,
        title: 'Tipe Ruangan Tidak Sesuai',
        description: `Kelas ${offering.courseName} membutuhkan tipe "${offering.requiredRoomType}", dialokasikan ke "${room.room_type}".`,
        offeringIds: [offering.id],
        roomId: room.id,
      });
    }

    // C. CONSECUTIVE ACTIVE TIME SLOTS (Hard)
    const daySlotSet = activeSlotsByDay.get(dayOfWeek);
    let consecutiveSlotsFound = 0;
    for (let s = 0; s < sks; s++) {
      const slotStart = startMinute + s * 50;
      if (daySlotSet && daySlotSet.has(slotStart)) {
        consecutiveSlotsFound++;
      }
    }
    if (consecutiveSlotsFound < sks) {
      const penalty = weights.hardSlotContinuity;
      hardCost += penalty;
      hardViolationsCount++;
      violations.push({
        id: `discontinuous-${assignment.courseOfferingId}`,
        type: 'TIME_SLOT_DISCONTINUOUS',
        category: 'HARD',
        penalty,
        title: 'Slot Waktu Tidak Kontinu / Tidak Aktif',
        description: `Kelas ${offering.courseName} (${sks} SKS) tidak memiliki ${sks} slot aktif berurutan mulai dari menit ${startMinute}.`,
        offeringIds: [offering.id],
        dayOfWeek,
        startMinute,
      });
    }

    // D. FRIDAY PRAYER BREAK (Soft)
    // Friday (5) from 11:30 (690) to 13:00 (780)
    if (dayOfWeek === 5 && isOverlapping(dayOfWeek, startMinute, endMinute, 5, 690, 780)) {
      const penalty = weights.softFridayPrayer;
      softCost += penalty;
      softViolationsCount++;
      violations.push({
        id: `friday-prayer-${assignment.courseOfferingId}`,
        type: 'FRIDAY_PRAYER_OVERLAP',
        category: 'SOFT',
        penalty,
        title: 'Bertabrakan dengan Waktu Shalat Jumat',
        description: `Kelas ${offering.courseName} dijadwalkan pada hari Jumat antara 11:30 - 13:00.`,
        offeringIds: [offering.id],
        dayOfWeek: 5,
        startMinute,
      });
    }

    // E. LECTURER AVAILABILITY & PREFERENCES (Hard & Soft)
    for (const lid of offering.lecturerIds) {
      // Track daily load
      const lKey = `${lid}-${dayOfWeek}`;
      lecturerDayCount.set(lKey, (lecturerDayCount.get(lKey) || 0) + 1);

      // Match availability records
      const matchingAvails = availabilities.filter(
        (av) =>
          av.lecturer_id === lid &&
          Number(av.day_of_week) === Number(dayOfWeek) &&
          isOverlapping(dayOfWeek, startMinute, endMinute, av.day_of_week, av.start_minute, av.end_minute)
      );

      for (const av of matchingAvails) {
        if (!av.is_available) {
          // Hard unavailable
          const penalty = weights.hardLecturerUnavailable;
          hardCost += penalty;
          hardViolationsCount++;
          violations.push({
            id: `unavail-${lid}-${assignment.courseOfferingId}`,
            type: 'LECTURER_UNAVAILABLE',
            category: 'HARD',
            penalty,
            title: 'Dosen Tidak Bersedia (Hard Constraint)',
            description: `Dosen pengampu (${lid}) telah menandai tidak bersedia pada hari & waktu ini.`,
            offeringIds: [offering.id],
            lecturerId: lid,
            dayOfWeek,
            startMinute,
          });
        } else if (av.preference === 'avoid') {
          // Soft avoid
          const penalty = weights.softLecturerPreference;
          softCost += penalty;
          softViolationsCount++;
          violations.push({
            id: `pref-avoid-${lid}-${assignment.courseOfferingId}`,
            type: 'LECTURER_PREFERENCE_AVOID',
            category: 'SOFT',
            penalty,
            title: 'Waktu Dihindari Dosen (Soft Constraint)',
            description: `Dosen pengampu (${lid}) memiliki preferensi menghindari jadwal ini (${av.notes || 'preferensi'}).`,
            offeringIds: [offering.id],
            lecturerId: lid,
            dayOfWeek,
            startMinute,
          });
        }
      }
    }
  }

  // 2. Lecturer Daily Overload (Soft: > 3 classes on same day)
  lecturerDayCount.forEach((count, key) => {
    if (count > 3) {
      const extra = count - 3;
      const penalty = weights.softLecturerDailyLoad * extra;
      softCost += penalty;
      softViolationsCount += extra;
      const [lid, day] = key.split('-');
      violations.push({
        id: `overload-${key}`,
        type: 'LECTURER_OVERLOAD',
        category: 'SOFT',
        penalty,
        title: 'Beban Mengajar Harian Tinggi',
        description: `Dosen memiliki ${count} sesi kelas pada hari ${day} (disarankan maksimal 3 sesi).`,
        offeringIds: [],
        lecturerId: lid,
        dayOfWeek: Number(day),
      });
    }
  });

  // 3. Pairwise Evaluations (Room Overlaps, Lecturer Overlaps, Semester Collisions)
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const offA = a.offering;
    const roomA = a.room;
    if (!offA || !roomA) continue;

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      const offB = b.offering;
      const roomB = b.room;
      if (!offB || !roomB) continue;

      // Check if time intervals overlap
      if (isOverlapping(a.dayOfWeek, a.startMinute, a.endMinute, b.dayOfWeek, b.startMinute, b.endMinute)) {
        // A. ROOM CONFLICT (Hard)
        if (a.assignment.roomId === b.assignment.roomId) {
          const penalty = weights.hardRoomOverlap;
          hardCost += penalty;
          hardViolationsCount++;
          violations.push({
            id: `room-conflict-${offA.id}-${offB.id}`,
            type: 'ROOM_OVERLAP',
            category: 'HARD',
            penalty,
            title: 'Bentrok Pemakaian Ruangan',
            description: `Ruangan ${roomA.name} digunakan bersamaan oleh ${offA.courseName} (${offA.classCode}) dan ${offB.courseName} (${offB.classCode}).`,
            offeringIds: [offA.id, offB.id],
            roomId: a.assignment.roomId,
            dayOfWeek: a.dayOfWeek,
          });
        }

        // B. LECTURER CONFLICT (Hard)
        const sharedLecturers = offA.lecturerIds.filter((lid) =>
          offB.lecturerIds.includes(lid)
        );
        if (sharedLecturers.length > 0) {
          const penalty = weights.hardLecturerOverlap * sharedLecturers.length;
          hardCost += penalty;
          hardViolationsCount += sharedLecturers.length;
          violations.push({
            id: `lect-conflict-${offA.id}-${offB.id}`,
            type: 'LECTURER_OVERLAP',
            category: 'HARD',
            penalty,
            title: 'Bentrok Dosen Pengampu',
            description: `Dosen yang sama mengajar bersamaan pada ${offA.courseName} (${offA.classCode}) dan ${offB.courseName} (${offB.classCode}).`,
            offeringIds: [offA.id, offB.id],
            dayOfWeek: a.dayOfWeek,
          });
        }

        // C. SEMESTER COLLISION (Soft: Same curriculum semester)
        if (
          offA.semester > 0 &&
          offA.semester === offB.semester &&
          offA.courseId !== offB.courseId
        ) {
          const penalty = weights.softSemesterConflict;
          softCost += penalty;
          softViolationsCount++;
          violations.push({
            id: `sem-conflict-${offA.id}-${offB.id}`,
            type: 'SEMESTER_COLLISION',
            category: 'SOFT',
            penalty,
            title: 'Tabrakan Jadwal Semester yang Sama',
            description: `Mata kuliah Semester ${offA.semester} (${offA.courseName} & ${offB.courseName}) berlangsung bersamaan.`,
            offeringIds: [offA.id, offB.id],
            dayOfWeek: a.dayOfWeek,
          });
        }
      }
    }
  }

  const totalCost = hardCost + softCost;

  return {
    totalCost,
    hardCost,
    softCost,
    hardViolationsCount,
    softViolationsCount,
    violations,
  };
}
