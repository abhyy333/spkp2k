import {
  SASolution,
  SAEntry,
  SAOfferingContext,
  SARoomContext,
  ConsecutiveSlot,
} from './types';
import { SeededRandom } from './seededRandom';

export type NeighborMoveType = 'MOVE_TIME' | 'MOVE_ROOM' | 'MOVE_BOTH' | 'SWAP_TIME' | 'SWAP_ROOM';

export interface NeighborContext {
  offeringsMap: Map<string, SAOfferingContext>;
  roomsMap: Map<string, SARoomContext>;
  validSequencesBySks: Record<number, ConsecutiveSlot[]>;
  activeRooms: SARoomContext[];
  roomsByType: Map<string, SARoomContext[]>;
}

/**
 * Builds fast lookup tables for generating valid neighbors
 */
export function buildNeighborContext(
  offerings: SAOfferingContext[],
  rooms: SARoomContext[],
  validSequencesBySks: Record<number, ConsecutiveSlot[]>
): NeighborContext {
  const offeringsMap = new Map<string, SAOfferingContext>();
  offerings.forEach((o) => offeringsMap.set(o.id, o));

  const roomsMap = new Map<string, SARoomContext>();
  const activeRooms = rooms.filter((r) => r.isActive !== false);
  const roomsByType = new Map<string, SARoomContext[]>();

  rooms.forEach((r) => {
    roomsMap.set(r.id, r);
    if (r.isActive !== false) {
      if (!roomsByType.has(r.roomType)) {
        roomsByType.set(r.roomType, []);
      }
      roomsByType.get(r.roomType)!.push(r);
    }
  });

  return {
    offeringsMap,
    roomsMap,
    validSequencesBySks,
    activeRooms,
    roomsByType,
  };
}

/**
 * Generates a neighbor solution by applying a stochastic perturbation using SeededRandom.
 * Does NOT modify the original solution array; returns a new shallow copy with modified entry.
 */
export function generateNeighbor(
  currentSolution: SASolution,
  ctx: NeighborContext,
  prng: SeededRandom,
  conflictOfferingIds?: string[]
): { neighbor: SASolution; moveType: NeighborMoveType; modifiedIndex: number } {
  if (currentSolution.length === 0) {
    return { neighbor: [], moveType: 'MOVE_TIME', modifiedIndex: -1 };
  }

  // Clone solution
  const neighbor: SAEntry[] = currentSolution.map((e) => ({ ...e }));

  // Bias towards selecting an offering that currently has a conflict (70% probability if conflicts exist)
  let targetIdx: number;
  if (conflictOfferingIds && conflictOfferingIds.length > 0 && prng.next() < 0.7) {
    const conflictedId = prng.choice(conflictOfferingIds);
    const foundIdx = neighbor.findIndex((e) => e.courseOfferingId === conflictedId);
    targetIdx = foundIdx !== -1 ? foundIdx : prng.nextInt(0, neighbor.length - 1);
  } else {
    targetIdx = prng.nextInt(0, neighbor.length - 1);
  }

  const currentEntry = neighbor[targetIdx];
  const offering = ctx.offeringsMap.get(currentEntry.courseOfferingId);

  if (!offering) {
    return { neighbor, moveType: 'MOVE_TIME', modifiedIndex: targetIdx };
  }

  const sks = offering.effectiveSks || 2;
  const validSequences = ctx.validSequencesBySks[sks] || [];
  const compatibleRooms = (ctx.roomsByType.get(offering.requiredRoomType) || ctx.activeRooms).filter(
    (r) => r.capacity >= offering.expectedStudents
  );
  const candidateRooms = compatibleRooms.length > 0 ? compatibleRooms : ctx.activeRooms;

  // Choose move type weighted
  const randMove = prng.next();

  if (randMove < 0.40) {
    // 1. MOVE_TIME: change day and startMinute
    if (validSequences.length > 0) {
      const newSeq = prng.choice(validSequences);
      neighbor[targetIdx] = {
        ...currentEntry,
        dayOfWeek: newSeq.dayOfWeek,
        startMinute: newSeq.startMinute,
      };
      return { neighbor, moveType: 'MOVE_TIME', modifiedIndex: targetIdx };
    }
  } else if (randMove < 0.65) {
    // 2. MOVE_ROOM: change room
    if (candidateRooms.length > 0) {
      const newRoom = prng.choice(candidateRooms);
      neighbor[targetIdx] = {
        ...currentEntry,
        roomId: newRoom.id,
      };
      return { neighbor, moveType: 'MOVE_ROOM', modifiedIndex: targetIdx };
    }
  } else if (randMove < 0.85) {
    // 3. MOVE_BOTH: change room and time
    if (validSequences.length > 0 && candidateRooms.length > 0) {
      const newSeq = prng.choice(validSequences);
      const newRoom = prng.choice(candidateRooms);
      neighbor[targetIdx] = {
        ...currentEntry,
        roomId: newRoom.id,
        dayOfWeek: newSeq.dayOfWeek,
        startMinute: newSeq.startMinute,
      };
      return { neighbor, moveType: 'MOVE_BOTH', modifiedIndex: targetIdx };
    }
  } else {
    // 4. SWAP_TIME: swap time slot with another offering if compatible
    const otherIdx = prng.nextInt(0, neighbor.length - 1);
    if (otherIdx !== targetIdx) {
      const otherEntry = neighbor[otherIdx];
      const otherOffering = ctx.offeringsMap.get(otherEntry.courseOfferingId);

      // Only swap if SKS is equal or valid sequences match
      if (otherOffering && (otherOffering.effectiveSks || 2) === sks) {
        neighbor[targetIdx] = {
          ...currentEntry,
          dayOfWeek: otherEntry.dayOfWeek,
          startMinute: otherEntry.startMinute,
        };
        neighbor[otherIdx] = {
          ...otherEntry,
          dayOfWeek: currentEntry.dayOfWeek,
          startMinute: currentEntry.startMinute,
        };
        return { neighbor, moveType: 'SWAP_TIME', modifiedIndex: targetIdx };
      }
    }
  }

  // Fallback: move to random valid sequence
  if (validSequences.length > 0) {
    const newSeq = prng.choice(validSequences);
    neighbor[targetIdx] = {
      ...currentEntry,
      dayOfWeek: newSeq.dayOfWeek,
      startMinute: newSeq.startMinute,
    };
  }

  return { neighbor, moveType: 'MOVE_TIME', modifiedIndex: targetIdx };
}
