import {
  SACostBreakdown,
  SAMetricPoint,
  SASolution,
  SAOfferingContext,
  SARoomContext,
} from './types';

export interface ScheduleComparisonStats {
  initialTotalCost: number;
  bestTotalCost: number;
  costReductionPercent: number;

  initialHardConflicts: number;
  bestHardConflicts: number;
  conflictsEliminatedCount: number;

  initialHc1: number; // room overlap
  bestHc1: number;

  initialHc2: number; // lecturer overlap
  bestHc2: number;

  initialHc3: number; // class group conflict
  bestHc3: number;

  initialHc4: number; // capacity
  bestHc4: number;

  initialHc6: number; // lecturer availability
  bestHc6: number;

  initialSeatWaste: number;
  bestSeatWaste: number;
}

/**
 * Calculates comparative statistics between initial and best optimized solutions
 */
export function calculateComparisonStats(
  initialCost: SACostBreakdown,
  bestCost: SACostBreakdown,
  initialSolution: SASolution,
  bestSolution: SASolution,
  offeringsMap: Map<string, SAOfferingContext>,
  roomsMap: Map<string, SARoomContext>
): ScheduleComparisonStats {
  const costReduction =
    initialCost.totalCost > 0
      ? Math.max(0, ((initialCost.totalCost - bestCost.totalCost) / initialCost.totalCost) * 100)
      : 0;

  const conflictsEliminated = Math.max(0, initialCost.hardConflictsCount - bestCost.hardConflictsCount);

  // Seat waste calculation
  const calcWaste = (sol: SASolution) => {
    let waste = 0;
    for (const entry of sol) {
      const off = offeringsMap.get(entry.courseOfferingId);
      const rm = roomsMap.get(entry.roomId);
      if (off && rm && rm.capacity >= off.expectedStudents) {
        waste += rm.capacity - off.expectedStudents;
      }
    }
    return sol.length > 0 ? Math.round(waste / sol.length) : 0;
  };

  return {
    initialTotalCost: initialCost.totalCost,
    bestTotalCost: bestCost.totalCost,
    costReductionPercent: Math.round(costReduction * 10) / 10,

    initialHardConflicts: initialCost.hardConflictsCount,
    bestHardConflicts: bestCost.hardConflictsCount,
    conflictsEliminatedCount: conflictsEliminated,

    initialHc1: initialCost.hc1Count,
    bestHc1: bestCost.hc1Count,

    initialHc2: initialCost.hc2Count,
    bestHc2: bestCost.hc2Count,

    initialHc3: initialCost.hc3Count,
    bestHc3: bestCost.hc3Count,

    initialHc4: initialCost.hc4Count,
    bestHc4: bestCost.hc4Count,

    initialHc6: initialCost.hc6Count,
    bestHc6: bestCost.hc6Count,

    initialSeatWaste: calcWaste(initialSolution),
    bestSeatWaste: calcWaste(bestSolution),
  };
}

/**
 * Samples a metric point for logging convergence history
 */
export function createMetricPoint(
  iteration: number,
  temperature: number,
  currentCost: SACostBreakdown,
  bestCost: SACostBreakdown,
  acceptedMoves: number
): SAMetricPoint {
  return {
    iteration,
    temperature: Math.round(temperature * 100) / 100,
    currentCost: Math.round(currentCost.totalCost),
    bestCost: Math.round(bestCost.totalCost),
    currentHardCost: Math.round(currentCost.hardCost),
    bestHardCost: Math.round(bestCost.hardCost),
    hardConflictsCount: bestCost.hardConflictsCount,
    acceptedMoves,
  };
}
