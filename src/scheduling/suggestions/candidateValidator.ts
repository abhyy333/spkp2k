import {
  ScheduleEntry,
  Room,
  TimeSlot,
  LecturerAvailability,
  CourseOffering,
  Lecturer,
} from '../../types';
import { CandidateMove } from './candidateGenerator';
import { detectAllScheduleConflicts, ClientConflict } from '../../lib/scheduleValidator';

export interface EvaluatedCandidate {
  candidate: CandidateMove;
  simulatedEntries: ScheduleEntry[];
  initialConflicts: ClientConflict[];
  resultingConflicts: ClientConflict[];
  resolvedConflicts: ClientConflict[];
  newConflicts: ClientConflict[];
  hardViolationsCount: number;
  softScoreImprovement: number;
  isFeasible: boolean;
}

/**
 * Validates and evaluates the candidate move against the schedule
 */
export function evaluateCandidateMove(params: {
  candidate: CandidateMove;
  currentEntries: ScheduleEntry[];
  rooms: Room[];
  activeTimeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  offerings: CourseOffering[];
  lecturers: Lecturer[];
  cachedInitialConflicts?: ClientConflict[];
}): EvaluatedCandidate {
  const {
    candidate,
    currentEntries,
    rooms,
    availabilities,
    cachedInitialConflicts,
  } = params;

  // 1. Compute initial conflicts if not provided
  const initialConflicts =
    cachedInitialConflicts ||
    detectAllScheduleConflicts(currentEntries, rooms, availabilities);

  // 2. Simulate the new schedule entries after applying candidate move
  let simulatedEntries: ScheduleEntry[] = [];

  if (candidate.type === 'SWAP' && candidate.swapTargetEntry && candidate.swapTargetPlacement) {
    // Both entries swap places
    simulatedEntries = currentEntries.map((e) => {
      if (e.id === candidate.entryId) {
        return {
          ...e,
          day_of_week: candidate.targetPlacement.dayOfWeek,
          start_minute: candidate.targetPlacement.startMinute,
          end_minute: candidate.targetPlacement.endMinute,
          room_id: candidate.targetPlacement.roomId,
          day: candidate.targetPlacement.dayName,
          start_time: candidate.targetPlacement.startTime,
          end_time: candidate.targetPlacement.endTime,
          room: rooms.find((r) => r.id === candidate.targetPlacement.roomId) || e.room,
        };
      }
      if (e.id === candidate.swapTargetEntry!.id) {
        return {
          ...e,
          day_of_week: candidate.swapTargetPlacement!.dayOfWeek,
          start_minute: candidate.swapTargetPlacement!.startMinute,
          end_minute: candidate.swapTargetPlacement!.endMinute,
          room_id: candidate.swapTargetPlacement!.roomId,
          day: candidate.swapTargetPlacement!.dayName,
          start_time: candidate.swapTargetPlacement!.startTime,
          end_time: candidate.swapTargetPlacement!.endTime,
          room: rooms.find((r) => r.id === candidate.swapTargetPlacement!.roomId) || e.room,
        };
      }
      return e;
    });
  } else {
    // Single entry move (MOVE_TIME, MOVE_ROOM, MOVE_TIME_ROOM)
    simulatedEntries = currentEntries.map((e) => {
      if (e.id === candidate.entryId) {
        return {
          ...e,
          day_of_week: candidate.targetPlacement.dayOfWeek,
          start_minute: candidate.targetPlacement.startMinute,
          end_minute: candidate.targetPlacement.endMinute,
          room_id: candidate.targetPlacement.roomId,
          day: candidate.targetPlacement.dayName,
          start_time: candidate.targetPlacement.startTime,
          end_time: candidate.targetPlacement.endTime,
          room: rooms.find((r) => r.id === candidate.targetPlacement.roomId) || e.room,
        };
      }
      return e;
    });
  }

  // 3. Compute resulting conflicts on simulated entries
  const resultingConflicts = detectAllScheduleConflicts(
    simulatedEntries,
    rooms,
    availabilities
  );

  // 4. Identify resolved conflicts & new conflicts
  const initialKeys = new Set(
    initialConflicts.map((c) => `${c.type}-${c.title}-${c.entryIds.sort().join(',')}`)
  );
  const resultingKeys = new Set(
    resultingConflicts.map((c) => `${c.type}-${c.title}-${c.entryIds.sort().join(',')}`)
  );

  const resolvedConflicts = initialConflicts.filter(
    (c) => !resultingKeys.has(`${c.type}-${c.title}-${c.entryIds.sort().join(',')}`)
  );

  const newConflicts = resultingConflicts.filter(
    (c) => !initialKeys.has(`${c.type}-${c.title}-${c.entryIds.sort().join(',')}`)
  );

  const hardViolationsCount = resultingConflicts.filter(
    (c) => c.severity === 'CRITICAL' || c.severity === 'HIGH'
  ).length;

  // 5. Evaluate soft constraints improvement
  let softScoreImprovement = 0;

  // Friday prayer window penalty reduction (Jumat 11:30 - 13:00)
  const wasFridayPrayer =
    candidate.currentPlacement.dayOfWeek === 5 &&
    candidate.currentPlacement.startMinute < 780 &&
    candidate.currentPlacement.endMinute > 690;
  const isFridayPrayer =
    candidate.targetPlacement.dayOfWeek === 5 &&
    candidate.targetPlacement.startMinute < 780 &&
    candidate.targetPlacement.endMinute > 690;

  if (wasFridayPrayer && !isFridayPrayer) {
    softScoreImprovement += 20;
  } else if (!wasFridayPrayer && isFridayPrayer) {
    softScoreImprovement -= 25;
  }

  // Lecturer avoid preference penalty check
  const offeringLecIds =
    candidate.offering.course_offering_lecturers?.map((l) => l.lecturer_id) || [];
  const targetDay = candidate.targetPlacement.dayOfWeek;
  const targetStart = candidate.targetPlacement.startMinute;
  const targetEnd = candidate.targetPlacement.endMinute;

  for (const lid of offeringLecIds) {
    const avs = availabilities.filter(
      (a) => a.lecturer_id === lid && Number(a.day_of_week) === Number(targetDay)
    );
    for (const av of avs) {
      if (av.preference === 'avoid' && targetStart < av.end_minute && av.start_minute < targetEnd) {
        softScoreImprovement -= 15;
      }
      if (av.preference === 'preferred' && targetStart < av.end_minute && av.start_minute < targetEnd) {
        softScoreImprovement += 10;
      }
    }
  }

  // Room capacity tightness bonus (prefer room with capacity >= students with minimal wastage)
  const targetRoom = rooms.find((r) => r.id === candidate.targetPlacement.roomId);
  const students = candidate.offering.expected_students || 0;
  if (targetRoom && students > 0) {
    const roomMargin = targetRoom.capacity - students;
    if (roomMargin >= 0 && roomMargin <= 15) {
      softScoreImprovement += 10; // Well-fitted room
    }
  }

  const isFeasible = hardViolationsCount === 0 || resolvedConflicts.length > newConflicts.length;

  return {
    candidate,
    simulatedEntries,
    initialConflicts,
    resultingConflicts,
    resolvedConflicts,
    newConflicts,
    hardViolationsCount,
    softScoreImprovement,
    isFeasible,
  };
}
