import {
  ScheduleEntry,
  Room,
  TimeSlot,
  LecturerAvailability,
  CourseOffering,
  Lecturer,
} from '../../types';
import { PartialOptimizationParams, PartialOptimizationResult } from './types';
import { SchedulableOffering, ScheduleAssignment, ScheduleSolution } from '../../lib/optimizer/types';
import { PRNG } from '../../lib/optimizer/prng';
import { evaluateSolution, DEFAULT_WEIGHTS } from '../../lib/optimizer/costFunction';
import { createNeighborhoodContext } from '../../lib/optimizer/neighborhood';
import { detectAllScheduleConflicts } from '../../lib/scheduleValidator';
import { minuteToTime, dayOfWeekToName } from '../../lib/utils';

/**
 * Execute Partial Simulated Annealing Optimization
 * Keeps locked entries fixed in their day, time, and room.
 * Optimizes unlocked entries to eliminate conflicts.
 */
export async function runPartialOptimization(
  params: PartialOptimizationParams,
  onProgress?: (progress: { iteration: number; totalIterations: number; currentConflicts: number; temperature: number }) => void
): Promise<PartialOptimizationResult> {
  const {
    currentEntries,
    lockedEntryIds,
    rooms,
    timeSlots,
    availabilities,
    offerings,
    maxIterations = 1500,
    initialTemperature = 80,
    coolingRate = 0.975,
    seed = 42,
  } = params;

  const startTime = performance.now();
  const prng = new PRNG(seed);
  const lockedSet = new Set(lockedEntryIds);

  // Initial conflicts count
  const initialConflicts = detectAllScheduleConflicts(currentEntries, rooms, availabilities);
  const initialConflictsCount = initialConflicts.length;

  // Build schedulable offerings list from currentEntries
  const schedulableOfferings: SchedulableOffering[] = [];
  const offeringsMap = new Map<string, SchedulableOffering>();
  const roomsMap = new Map<string, Room>();
  rooms.forEach((r) => roomsMap.set(r.id, r));

  currentEntries.forEach((entry) => {
    const rawOffering = offerings.find((o) => o.id === entry.course_offering_id) || entry.course_offering;
    const course = rawOffering?.course;
    const lecturersList =
      rawOffering?.course_offering_lecturers?.map((col) => col.lecturer?.name).filter(Boolean) ||
      (Array.isArray(entry.lecturer_names) ? entry.lecturer_names : [entry.lecturer_names || '']);
    const lecturerIdsList =
      rawOffering?.course_offering_lecturers?.map((col) => col.lecturer_id) ||
      entry.lecturer_ids ||
      [];

    const schedOffering: SchedulableOffering = {
      id: entry.course_offering_id,
      courseId: course?.id || entry.course_offering_id,
      courseCode: course?.code || entry.course_code || '',
      courseName: course?.name || entry.course_name || 'Mata Kuliah',
      classCode: rawOffering?.class_code || entry.class_code || 'A',
      effectiveSks: course?.effective_sks || 2,
      expectedStudents: rawOffering?.expected_students ?? entry.student_count ?? 30,
      requiredRoomType: rawOffering?.required_room_type || 'KELAS',
      semester: course?.semester || 1,
      lecturerIds: lecturerIdsList,
      lecturerNames: lecturersList as string[],
    };

    if (!offeringsMap.has(schedOffering.id)) {
      schedulableOfferings.push(schedOffering);
      offeringsMap.set(schedOffering.id, schedOffering);
    }
  });

  // Build problem data & neighborhood context
  const problem = {
    offerings: schedulableOfferings,
    rooms,
    timeSlots,
    availabilities,
    lecturers: [],
  };
  const ctx = createNeighborhoodContext(problem);

  // Build Initial Solution from current entries
  let currentSolution: ScheduleSolution = currentEntries.map((e) => ({
    courseOfferingId: e.course_offering_id,
    dayOfWeek: Number(e.day_of_week) || 1,
    startMinute: e.start_minute ?? 470,
    roomId: e.room_id,
  }));

  // Identify which indices are unlocked
  const unlockedIndices: number[] = [];
  currentEntries.forEach((e, idx) => {
    if (!lockedSet.has(e.id)) {
      unlockedIndices.push(idx);
    }
  });

  // Evaluate initial cost
  let currentCost = evaluateSolution(
    currentSolution,
    offeringsMap,
    roomsMap,
    timeSlots,
    availabilities,
    DEFAULT_WEIGHTS
  );

  let bestSolution: ScheduleSolution = currentSolution.map((a) => ({ ...a }));
  let bestCost = { ...currentCost };

  let temperature = initialTemperature;

  // Run Simulated Annealing loop (only mutate unlocked entries!)
  if (unlockedIndices.length > 0) {
    const validDays = [1, 2, 3, 4, 5];

    for (let iter = 1; iter <= maxIterations; iter++) {
      // Pick a random unlocked entry index
      const targetIndex = unlockedIndices[prng.nextInt(0, unlockedIndices.length - 1)];
      const targetAssignment = currentSolution[targetIndex];
      const targetOffering = offeringsMap.get(targetAssignment.courseOfferingId);

      if (!targetOffering) continue;

      const duration = targetOffering.effectiveSks * 50;

      // Clone solution for neighbor
      const neighbor = currentSolution.map((a) => ({ ...a }));
      const moveType = prng.nextInt(0, 2);
      const validSlots = ctx.slotOptionsBySks.get(targetOffering.effectiveSks) || [];
      const roomsPool = ctx.activeRooms.length > 0 ? ctx.activeRooms : rooms;

      if (moveType === 0) {
        // Shift time
        if (validSlots.length > 0) {
          const pickSlot = validSlots[prng.nextInt(0, validSlots.length - 1)];
          neighbor[targetIndex] = {
            ...targetAssignment,
            dayOfWeek: pickSlot.dayOfWeek,
            startMinute: pickSlot.startMinute,
          };
        }
      } else if (moveType === 1) {
        // Shift room
        const pickRoom = roomsPool[prng.nextInt(0, roomsPool.length - 1)];
        neighbor[targetIndex] = {
          ...targetAssignment,
          roomId: pickRoom.id,
        };
      } else {
        // Shift both time & room
        if (validSlots.length > 0 && roomsPool.length > 0) {
          const pickSlot = validSlots[prng.nextInt(0, validSlots.length - 1)];
          const pickRoom = roomsPool[prng.nextInt(0, roomsPool.length - 1)];
          neighbor[targetIndex] = {
            courseOfferingId: targetAssignment.courseOfferingId,
            dayOfWeek: pickSlot.dayOfWeek,
            startMinute: pickSlot.startMinute,
            roomId: pickRoom.id,
          };
        }
      }

      // Evaluate neighbor
      const neighborCost = evaluateSolution(
        neighbor,
        offeringsMap,
        roomsMap,
        timeSlots,
        availabilities,
        DEFAULT_WEIGHTS
      );

      const deltaE = neighborCost.totalCost - currentCost.totalCost;

      let accept = false;
      if (deltaE <= 0) {
        accept = true;
      } else {
        const prob = Math.exp(-deltaE / temperature);
        if (prng.next() < prob) {
          accept = true;
        }
      }

      if (accept) {
        currentSolution = neighbor;
        currentCost = neighborCost;

        if (neighborCost.totalCost < bestCost.totalCost) {
          bestSolution = neighbor.map((a) => ({ ...a }));
          bestCost = { ...neighborCost };
        }
      }

      // Cooling
      temperature = Math.max(0.01, temperature * coolingRate);

      if (iter % 150 === 0 && onProgress) {
        onProgress({
          iteration: iter,
          totalIterations: maxIterations,
          currentConflicts: bestCost.hardViolationsCount,
          temperature,
        });
      }
    }
  }

  // Map bestSolution back to ScheduleEntry format
  const changelog: string[] = [];
  let unlockedMovedCount = 0;

  const optimizedEntries: ScheduleEntry[] = currentEntries.map((orig, idx) => {
    const best = bestSolution[idx];
    const offering = offeringsMap.get(best.courseOfferingId);
    const duration = (offering?.effectiveSks || 2) * 50;
    const room = rooms.find((r) => r.id === best.roomId);

    const isChanged =
      orig.day_of_week !== best.dayOfWeek ||
      orig.start_minute !== best.startMinute ||
      orig.room_id !== best.roomId;

    if (isChanged) {
      unlockedMovedCount++;
      const origDay = orig.day || dayOfWeekToName(orig.day_of_week || 1);
      const newDay = dayOfWeekToName(best.dayOfWeek);
      changelog.push(
        `${orig.course_name || 'Kelas'} (${orig.class_code || 'A'}): ${origDay} ${orig.start_time} [${orig.room?.code || orig.room_id}] ➜ ${newDay} ${minuteToTime(best.startMinute)} [${room?.code || best.roomId}]`
      );
    }

    return {
      ...orig,
      day_of_week: best.dayOfWeek,
      start_minute: best.startMinute,
      end_minute: best.startMinute + duration,
      room_id: best.roomId,
      day: dayOfWeekToName(best.dayOfWeek),
      start_time: minuteToTime(best.startMinute),
      end_time: minuteToTime(best.startMinute + duration),
      room: room || orig.room,
    };
  });

  const finalConflicts = detectAllScheduleConflicts(optimizedEntries, rooms, availabilities);

  return {
    success: finalConflicts.length <= initialConflictsCount,
    optimizedEntries,
    initialConflictsCount,
    finalConflictsCount: finalConflicts.length,
    unlockedMovedCount,
    lockedCount: lockedSet.size,
    iterations: maxIterations,
    timeElapsedMs: performance.now() - startTime,
    seed,
    changelog,
  };
}
