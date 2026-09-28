import {
  ScheduleSolution,
  ScheduleAssignment,
  SchedulableOffering,
  ProblemData,
} from './types';
import { PRNG } from './prng';
import { getValidStartingSlotsForSks, ValidSlotOption } from './initialSolution';
import { Room } from '../../types';

export type NeighborhoodMoveType = 'MOVE_TIME' | 'MOVE_ROOM' | 'MOVE_TIME_ROOM' | 'SWAP_TIME';

export interface NeighborhoodContext {
  problem: ProblemData;
  offeringsMap: Map<string, SchedulableOffering>;
  roomsMap: Map<string, Room>;
  activeRooms: Room[];
  slotOptionsBySks: Map<number, ValidSlotOption[]>;
}

export function createNeighborhoodContext(problem: ProblemData): NeighborhoodContext {
  const offeringsMap = new Map<string, SchedulableOffering>();
  for (const off of problem.offerings) {
    offeringsMap.set(off.id, off);
  }

  const roomsMap = new Map<string, Room>();
  const activeRooms = problem.rooms.filter((r) => r.is_active !== false);
  for (const r of activeRooms) {
    roomsMap.set(r.id, r);
  }

  const slotOptionsBySks = new Map<number, ValidSlotOption[]>();
  for (let sks = 1; sks <= 6; sks++) {
    slotOptionsBySks.set(sks, getValidStartingSlotsForSks(problem.timeSlots, sks));
  }

  return {
    problem,
    offeringsMap,
    roomsMap,
    activeRooms,
    slotOptionsBySks,
  };
}

/**
 * Generates a neighbor solution by applying one stochastic perturbation operator.
 */
export function generateNeighbor(
  currentSolution: ScheduleSolution,
  ctx: NeighborhoodContext,
  prng: PRNG
): { neighbor: ScheduleSolution; moveType: NeighborhoodMoveType } {
  if (currentSolution.length === 0) {
    return { neighbor: [], moveType: 'MOVE_TIME' };
  }

  // Clone solution array
  const neighbor: ScheduleSolution = currentSolution.map((a) => ({ ...a }));
  const { offeringsMap, activeRooms, slotOptionsBySks } = ctx;

  // Choose move operator based on probabilities:
  // 40% MOVE_TIME, 25% MOVE_ROOM, 25% MOVE_TIME_ROOM, 10% SWAP_TIME
  const roll = prng.next();
  let moveType: NeighborhoodMoveType = 'MOVE_TIME';

  if (roll < 0.40) {
    moveType = 'MOVE_TIME';
  } else if (roll < 0.65) {
    moveType = 'MOVE_ROOM';
  } else if (roll < 0.90) {
    moveType = 'MOVE_TIME_ROOM';
  } else {
    moveType = 'SWAP_TIME';
  }

  // Pick target index
  const targetIdx = prng.nextInt(0, neighbor.length - 1);
  const target = neighbor[targetIdx];
  const offering = offeringsMap.get(target.courseOfferingId);
  const sks = offering?.effectiveSks || 2;
  const validSlots = slotOptionsBySks.get(sks) || [];

  switch (moveType) {
    case 'MOVE_TIME': {
      if (validSlots.length > 0) {
        // Choose a slot different from current if possible
        const filteredSlots = validSlots.filter(
          (s) => !(s.dayOfWeek === target.dayOfWeek && s.startMinute === target.startMinute)
        );
        const slot = filteredSlots.length > 0 ? prng.choice(filteredSlots) : prng.choice(validSlots);
        target.dayOfWeek = slot.dayOfWeek;
        target.startMinute = slot.startMinute;
      }
      break;
    }

    case 'MOVE_ROOM': {
      if (activeRooms.length > 1) {
        // Prefer rooms matching required type & capacity
        const reqType = (offering?.requiredRoomType || '').toLowerCase().trim();
        const expected = offering?.expectedStudents || 0;

        const preferredRooms = activeRooms.filter(
          (r) =>
            r.id !== target.roomId &&
            (!reqType || (r.room_type || '').toLowerCase().trim() === reqType) &&
            r.capacity >= expected
        );

        const chosenRoom = preferredRooms.length > 0
          ? prng.choice(preferredRooms)
          : prng.choice(activeRooms.filter((r) => r.id !== target.roomId) || activeRooms);

        if (chosenRoom) {
          target.roomId = chosenRoom.id;
        }
      }
      break;
    }

    case 'MOVE_TIME_ROOM': {
      if (validSlots.length > 0) {
        const slot = prng.choice(validSlots);
        target.dayOfWeek = slot.dayOfWeek;
        target.startMinute = slot.startMinute;
      }
      if (activeRooms.length > 1) {
        const otherRooms = activeRooms.filter((r) => r.id !== target.roomId);
        if (otherRooms.length > 0) {
          target.roomId = prng.choice(otherRooms).id;
        }
      }
      break;
    }

    case 'SWAP_TIME': {
      if (neighbor.length > 1) {
        // Pick another target
        let otherIdx = prng.nextInt(0, neighbor.length - 1);
        if (otherIdx === targetIdx) {
          otherIdx = (targetIdx + 1) % neighbor.length;
        }
        const other = neighbor[otherIdx];

        // Swap day & startMinute
        const tempDay = target.dayOfWeek;
        const tempStart = target.startMinute;

        target.dayOfWeek = other.dayOfWeek;
        target.startMinute = other.startMinute;

        other.dayOfWeek = tempDay;
        other.startMinute = tempStart;
      }
      break;
    }
  }

  return { neighbor, moveType };
}
