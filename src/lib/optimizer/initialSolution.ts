import {
  ScheduleSolution,
  ScheduleAssignment,
  SchedulableOffering,
  ProblemData,
} from './types';
import { PRNG } from './prng';
import { isOverlapping } from './costFunction';
import { Room, TimeSlot } from '../../types';

export interface ValidSlotOption {
  dayOfWeek: number;
  startMinute: number;
}

/**
 * Finds all valid starting slot points where active continuous slots exist for given SKS
 */
export function getValidStartingSlotsForSks(
  timeSlots: TimeSlot[],
  sks: number
): ValidSlotOption[] {
  const activeSlots = timeSlots.filter((s) => s.is_active !== false);
  const slotsByDay = new Map<number, number[]>();

  for (const slot of activeSlots) {
    const d = Number(slot.day_of_week);
    if (!slotsByDay.has(d)) {
      slotsByDay.set(d, []);
    }
    slotsByDay.get(d)!.push(slot.start_minute);
  }

  const validOptions: ValidSlotOption[] = [];

  slotsByDay.forEach((startMinutes, dayOfWeek) => {
    // Sort minutes ascending
    startMinutes.sort((a, b) => a - b);
    const minuteSet = new Set(startMinutes);

    for (const startMin of startMinutes) {
      let isConsecutive = true;
      for (let s = 1; s < sks; s++) {
        if (!minuteSet.has(startMin + s * 50)) {
          isConsecutive = false;
          break;
        }
      }
      if (isConsecutive) {
        validOptions.push({
          dayOfWeek,
          startMinute: startMin,
        });
      }
    }
  });

  return validOptions;
}

/**
 * Generates an initial candidate solution using a greedy difficulty-first heuristic with PRNG tie-breaking.
 */
export function generateInitialSolution(
  problem: ProblemData,
  prng: PRNG
): ScheduleSolution {
  const { offerings, rooms, timeSlots, availabilities } = problem;
  const solution: ScheduleAssignment[] = [];
  const activeRooms = rooms.filter((r) => r.is_active !== false);

  if (offerings.length === 0 || activeRooms.length === 0) {
    return solution;
  }

  // Pre-calculate valid start slots for common SKS (1, 2, 3, 4, 6)
  const slotOptionsCache = new Map<number, ValidSlotOption[]>();
  for (let sks = 1; sks <= 6; sks++) {
    slotOptionsCache.set(sks, getValidStartingSlotsForSks(timeSlots, sks));
  }

  // 1. Sort offerings by complexity/difficulty (Greedy Priority)
  // Higher priority = harder to schedule:
  // - Strict non-default room type (e.g. LAB)
  // - High expected students
  // - High SKS
  // - Multiple lecturers
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

    return b.lecturerIds.length - a.lecturerIds.length;
  });

  // Track placed assignments for fast conflict checking during greedy placement
  interface PlacedMeta {
    offeringId: string;
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
    roomId: string;
    lecturerIds: string[];
    semester: number;
  }
  const placedList: PlacedMeta[] = [];

  for (const offering of sortedOfferings) {
    const sks = offering.effectiveSks || 2;
    const duration = sks * 50;
    const availableSlots = slotOptionsCache.get(sks) || [];

    // Filter candidate rooms
    const reqType = offering.requiredRoomType.toLowerCase().trim();
    let candidateRooms = activeRooms.filter((r) => {
      const actualType = (r.room_type || '').toLowerCase().trim();
      const typeMatch = reqType ? actualType === reqType : true;
      const capMatch = r.capacity >= offering.expectedStudents;
      return typeMatch && capMatch;
    });

    // Fallback 1: match type only
    if (candidateRooms.length === 0) {
      candidateRooms = activeRooms.filter(
        (r) => (r.room_type || '').toLowerCase().trim() === reqType
      );
    }
    // Fallback 2: any active room
    if (candidateRooms.length === 0) {
      candidateRooms = activeRooms;
    }

    // Evaluate candidate (slot, room) pairs
    let bestCandidates: { slot: ValidSlotOption; room: Room; score: number }[] = [];
    let minConflictScore = Infinity;

    // Shuffle candidate combinations to randomize tie-breaking deterministically
    const sampledSlots = prng.shuffle(availableSlots);
    const sampledRooms = prng.shuffle(candidateRooms);

    for (const slot of sampledSlots) {
      const startMin = slot.startMinute;
      const endMin = startMin + duration;
      const day = slot.dayOfWeek;

      for (const room of sampledRooms) {
        let conflictScore = 0;

        // Capacity check
        if (offering.expectedStudents > room.capacity) {
          conflictScore += 1000 + (offering.expectedStudents - room.capacity) * 10;
        }

        // Room type check
        if (
          reqType &&
          (room.room_type || '').toLowerCase().trim() !== reqType
        ) {
          conflictScore += 800;
        }

        // Friday prayer check
        if (day === 5 && isOverlapping(day, startMin, endMin, 5, 690, 780)) {
          conflictScore += 50;
        }

        // Lecturer availability
        for (const lid of offering.lecturerIds) {
          const avails = availabilities.filter(
            (av) =>
              av.lecturer_id === lid &&
              Number(av.day_of_week) === Number(day) &&
              isOverlapping(day, startMin, endMin, av.day_of_week, av.start_minute, av.end_minute)
          );
          for (const av of avails) {
            if (!av.is_available) conflictScore += 1000;
            else if (av.preference === 'avoid') conflictScore += 40;
          }
        }

        // Overlap with already placed
        for (const placed of placedList) {
          if (isOverlapping(day, startMin, endMin, placed.dayOfWeek, placed.startMinute, placed.endMinute)) {
            // Room overlap
            if (placed.roomId === room.id) {
              conflictScore += 1000;
            }
            // Lecturer overlap
            const shared = offering.lecturerIds.some((lid) => placed.lecturerIds.includes(lid));
            if (shared) {
              conflictScore += 1000;
            }
            // Semester collision
            if (offering.semester > 0 && offering.semester === placed.semester) {
              conflictScore += 30;
            }
          }
        }

        if (conflictScore < minConflictScore) {
          minConflictScore = conflictScore;
          bestCandidates = [{ slot, room, score: conflictScore }];
        } else if (conflictScore === minConflictScore) {
          bestCandidates.push({ slot, room, score: conflictScore });
        }

        // If zero conflicts found, we can take it directly for fast initialization
        if (conflictScore === 0 && bestCandidates.length >= 3) {
          break;
        }
      }

      if (minConflictScore === 0 && bestCandidates.length >= 3) {
        break;
      }
    }

    // Pick from best candidates
    const chosen = bestCandidates.length > 0
      ? prng.choice(bestCandidates)
      : {
          slot: sampledSlots[0] || { dayOfWeek: 1, startMinute: 470 },
          room: sampledRooms[0] || activeRooms[0],
          score: 9999,
        };

    const assignment: ScheduleAssignment = {
      courseOfferingId: offering.id,
      dayOfWeek: chosen.slot.dayOfWeek,
      startMinute: chosen.slot.startMinute,
      roomId: chosen.room.id,
    };

    solution.push(assignment);
    placedList.push({
      offeringId: offering.id,
      dayOfWeek: chosen.slot.dayOfWeek,
      startMinute: chosen.slot.startMinute,
      endMinute: chosen.slot.startMinute + duration,
      roomId: chosen.room.id,
      lecturerIds: offering.lecturerIds,
      semester: offering.semester,
    });
  }

  return solution;
}
