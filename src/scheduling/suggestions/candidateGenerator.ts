import {
  ScheduleEntry,
  Room,
  TimeSlot,
  CourseOffering,
  LecturerAvailability,
} from '../../types';
import { ProposedPlacement, SuggestionType } from './types';
import { minuteToTime, dayOfWeekToName } from '../../lib/utils';
import { isTimeOverlapping } from '../../lib/scheduleValidator';

export interface CandidateMove {
  type: SuggestionType;
  entryId: string;
  offering: CourseOffering;
  currentPlacement: ProposedPlacement;
  targetPlacement: ProposedPlacement;
  swapTargetEntry?: ScheduleEntry;
  swapTargetPlacement?: ProposedPlacement;
}

/**
 * Generate candidate placements for an entry
 */
export function generateCandidateMoves(params: {
  entry: ScheduleEntry;
  currentEntries: ScheduleEntry[];
  rooms: Room[];
  activeTimeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  offering: CourseOffering;
  maxCandidates?: number;
}): CandidateMove[] {
  const {
    entry,
    currentEntries,
    rooms,
    activeTimeSlots,
    offering,
    maxCandidates = 25,
  } = params;

  const candidates: CandidateMove[] = [];
  const currentRoom = rooms.find((r) => r.id === entry.room_id);
  const sks = offering.course?.effective_sks || 2;
  const isRamadanSlot = activeTimeSlots.some((s) => s.duration_minutes === 40 || s.start_minute === 480);
  const minutesPerSession = (entry as any).minutes_per_session || (isRamadanSlot ? 40 : 50);
  const duration = sks * minutesPerSession;

  const currentPlacement: ProposedPlacement = {
    dayOfWeek: Number(entry.day_of_week) || 1,
    startMinute: entry.start_minute ?? (isRamadanSlot ? 480 : 470),
    endMinute: entry.end_minute ?? (entry.start_minute ?? (isRamadanSlot ? 480 : 470)) + duration,
    roomId: entry.room_id,
    dayName: entry.day || dayOfWeekToName(entry.day_of_week || 1),
    startTime: entry.start_time || minuteToTime(entry.start_minute ?? (isRamadanSlot ? 480 : 470)),
    endTime: entry.end_time || minuteToTime(entry.end_minute ?? (entry.start_minute ?? (isRamadanSlot ? 480 : 470)) + duration),
    roomCode: currentRoom?.code || '-',
    roomName: currentRoom?.name || '-',
  };

  // Group active time slots by day
  const validDays = [1, 2, 3, 4, 5]; // Senin - Jumat
  const standardStartMinutes = isRamadanSlot
    ? [480, 520, 560, 600, 640, 680, 780, 820, 860, 900, 940]
    : [470, 520, 570, 620, 680, 730, 780, 840, 890, 940, 990];

  const candidateStartsByDay: Map<number, number[]> = new Map();
  validDays.forEach((day) => {
    const daySlots = activeTimeSlots
      .filter((s) => Number(s.day_of_week) === day && s.is_active)
      .sort((a, b) => a.start_minute - b.start_minute);

    const validStarts: number[] = [];
    daySlots.forEach((slot) => {
      // Check if sks continuous slots exist starting from this slot (no break crossing)
      let consecutive = 0;
      let curr = slot.start_minute;
      for (let i = 0; i < sks; i++) {
        const found = daySlots.find((s) => s.start_minute === curr);
        if (found) {
          consecutive++;
          curr += (found.duration_minutes || (found.end_minute - found.start_minute) || minutesPerSession);
        } else {
          break;
        }
      }
      if (consecutive >= sks) {
        validStarts.push(slot.start_minute);
      }
    });

    // Fallback standard slots if no specific timeSlots loaded
    if (validStarts.length === 0) {
      validStarts.push(...standardStartMinutes.filter((m) => m + duration <= (isRamadanSlot ? 980 : 1070)));
    }

    candidateStartsByDay.set(day, Array.from(new Set(validStarts)));
  });

  // Filter suitable rooms based on capacity and required room type
  const expectedStudents = offering.expected_students || 0;
  const reqType = offering.required_room_type?.toLowerCase().trim();

  const compatibleRooms = rooms.filter((r) => {
    if (!r.is_active) return false;
    if (expectedStudents > 0 && r.capacity < expectedStudents) return false;
    if (reqType && (r.room_type || '').toLowerCase().trim() !== reqType) return false;
    return true;
  });

  const targetRooms = compatibleRooms.length > 0 ? compatibleRooms : rooms.filter((r) => r.is_active);

  // 1. GENERATE MOVE_ROOM (Same day & time, different room)
  targetRooms.forEach((r) => {
    if (r.id === entry.room_id) return;

    // Check if room is free at current time
    const isRoomOccupied = currentEntries.some(
      (e) =>
        e.id !== entry.id &&
        e.room_id === r.id &&
        isTimeOverlapping(
          Number(e.day_of_week),
          e.start_minute ?? 470,
          e.end_minute ?? (e.start_minute ?? 470) + ((e.course_offering?.course?.effective_sks || 2) * (e.minutes_per_session || 50)),
          currentPlacement.dayOfWeek,
          currentPlacement.startMinute,
          currentPlacement.endMinute
        )
    );

    if (!isRoomOccupied) {
      candidates.push({
        type: 'MOVE_ROOM',
        entryId: entry.id,
        offering,
        currentPlacement,
        targetPlacement: {
          ...currentPlacement,
          roomId: r.id,
          roomCode: r.code,
          roomName: r.name,
        },
      });
    }
  });

  // 2. GENERATE MOVE_TIME (Same room, different day/time)
  if (currentRoom) {
    validDays.forEach((day) => {
      const starts = candidateStartsByDay.get(day) || [];
      starts.forEach((startMin) => {
        const endMin = startMin + duration;
        // Skip current slot
        if (day === currentPlacement.dayOfWeek && startMin === currentPlacement.startMinute) return;

        // Check if current room is free
        const isOccupied = currentEntries.some(
          (e) =>
            e.id !== entry.id &&
            e.room_id === currentRoom.id &&
            isTimeOverlapping(
              Number(e.day_of_week),
              e.start_minute ?? 470,
              e.end_minute ?? (e.start_minute ?? 470) + ((e.course_offering?.course?.effective_sks || 2) * (e.minutes_per_session || 50)),
              day,
              startMin,
              endMin
            )
        );

        if (!isOccupied) {
          candidates.push({
            type: 'MOVE_TIME',
            entryId: entry.id,
            offering,
            currentPlacement,
            targetPlacement: {
              dayOfWeek: day,
              startMinute: startMin,
              endMinute: endMin,
              roomId: currentRoom.id,
              dayName: dayOfWeekToName(day),
              startTime: minuteToTime(startMin),
              endTime: minuteToTime(endMin),
              roomCode: currentRoom.code,
              roomName: currentRoom.name,
            },
          });
        }
      });
    });
  }

  // 3. GENERATE MOVE_TIME_ROOM (Different day/time + different room)
  validDays.forEach((day) => {
    const starts = candidateStartsByDay.get(day) || [];
    starts.forEach((startMin) => {
      const endMin = startMin + duration;
      targetRooms.forEach((r) => {
        // Skip exact same slot & room
        if (
          r.id === currentPlacement.roomId &&
          day === currentPlacement.dayOfWeek &&
          startMin === currentPlacement.startMinute
        ) {
          return;
        }

        const isOccupied = currentEntries.some(
          (e) =>
            e.id !== entry.id &&
            e.room_id === r.id &&
            isTimeOverlapping(
              Number(e.day_of_week),
              e.start_minute ?? 470,
              e.end_minute ?? (e.start_minute ?? 470) + ((e.course_offering?.course?.effective_sks || 2) * 50),
              day,
              startMin,
              endMin
            )
        );

        if (!isOccupied) {
          candidates.push({
            type: 'MOVE_TIME_ROOM',
            entryId: entry.id,
            offering,
            currentPlacement,
            targetPlacement: {
              dayOfWeek: day,
              startMinute: startMin,
              endMinute: endMin,
              roomId: r.id,
              dayName: dayOfWeekToName(day),
              startTime: minuteToTime(startMin),
              endTime: minuteToTime(endMin),
              roomCode: r.code,
              roomName: r.name,
            },
          });
        }
      });
    });
  });

  // 4. GENERATE SWAP (Swap slot/room with another entry with equal or compatible SKS)
  const otherEntries = currentEntries.filter(
    (e) => e.id !== entry.id && e.course_offering_id !== entry.course_offering_id
  );

  for (const other of otherEntries) {
    const otherOffering = other.course_offering;
    const otherSks = otherOffering?.course?.effective_sks || 2;

    // Only swap if SKS is equal or suitable
    if (otherSks === sks) {
      const otherRoom = rooms.find((r) => r.id === other.room_id);
      const otherDay = Number(other.day_of_week) || 1;
      const otherStart = other.start_minute ?? 470;
      const otherEnd = otherStart + duration;

      // Don't swap if they already occupy the exact same time and room
      if (
        otherRoom?.id === currentPlacement.roomId &&
        otherDay === currentPlacement.dayOfWeek &&
        otherStart === currentPlacement.startMinute
      ) {
        continue;
      }

      candidates.push({
        type: 'SWAP',
        entryId: entry.id,
        offering,
        currentPlacement,
        targetPlacement: {
          dayOfWeek: otherDay,
          startMinute: otherStart,
          endMinute: otherEnd,
          roomId: other.room_id,
          dayName: dayOfWeekToName(otherDay),
          startTime: minuteToTime(otherStart),
          endTime: minuteToTime(otherEnd),
          roomCode: otherRoom?.code || '-',
          roomName: otherRoom?.name || '-',
        },
        swapTargetEntry: other,
        swapTargetPlacement: {
          dayOfWeek: currentPlacement.dayOfWeek,
          startMinute: currentPlacement.startMinute,
          endMinute: currentPlacement.endMinute,
          roomId: currentPlacement.roomId,
          dayName: currentPlacement.dayName,
          startTime: currentPlacement.startTime,
          endTime: currentPlacement.endTime,
          roomCode: currentPlacement.roomCode,
          roomName: currentPlacement.roomName,
        },
      });
    }
  }

  return candidates.slice(0, maxCandidates);
}
