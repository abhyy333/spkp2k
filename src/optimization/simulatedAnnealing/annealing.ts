import {
  SASolution,
  SAProblemData,
  SAConfig,
  SAResult,
  SAProgress,
  SAMetricPoint,
  SACostBreakdown,
  SAOfferingContext,
  SARoomContext,
  SALecturerAvailabilityContext,
} from './types';
import { SA_DEFAULT_CONFIG } from './config';
import { SeededRandom } from './seededRandom';
import { evaluateSolution } from './scoring';
import { buildNeighborContext, generateNeighbor } from './neighbor';
import { createMetricPoint } from './metrics';

export class SimulatedAnnealingEngine {
  private problem: SAProblemData;
  private config: SAConfig;
  private prng: SeededRandom;

  private offeringsMap: Map<string, SAOfferingContext>;
  private roomsMap: Map<string, SARoomContext>;
  private availabilitiesMap: Map<string, SALecturerAvailabilityContext[]>;

  private initialSolution: SASolution;
  private initialCost: SACostBreakdown;

  private currentSolution: SASolution;
  private currentCost: SACostBreakdown;

  private bestSolution: SASolution;
  private bestCost: SACostBreakdown;

  private temperature: number;
  private iteration: number = 0;
  private acceptedMoves: number = 0;
  private improvedMoves: number = 0;
  private metrics: SAMetricPoint[] = [];

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private shouldStop: boolean = false;

  constructor(
    problem: SAProblemData,
    initialSolution: SASolution,
    userConfig?: Partial<SAConfig>
  ) {
    this.problem = problem;
    this.config = {
      ...SA_DEFAULT_CONFIG,
      ...(userConfig || {}),
      weights: {
        ...SA_DEFAULT_CONFIG.weights,
        ...(userConfig?.weights || {}),
      },
    };

    this.prng = new SeededRandom(this.config.seed);

    // Build lookup maps
    this.offeringsMap = new Map();
    problem.offerings.forEach((o) => this.offeringsMap.set(o.id, o));

    this.roomsMap = new Map();
    problem.rooms.forEach((r) => this.roomsMap.set(r.id, r));

    this.availabilitiesMap = new Map();
    problem.availabilities.forEach((a) => {
      if (!this.availabilitiesMap.has(a.lecturerId)) {
        this.availabilitiesMap.set(a.lecturerId, []);
      }
      this.availabilitiesMap.get(a.lecturerId)!.push(a);
    });

    // Deep clone initial solution
    this.initialSolution = initialSolution.map((e) => ({ ...e }));
    this.initialCost = evaluateSolution(
      this.initialSolution,
      this.offeringsMap,
      this.roomsMap,
      this.availabilitiesMap,
      this.problem.validSequencesBySks,
      this.config.weights,
      true
    );

    this.currentSolution = this.initialSolution.map((e) => ({ ...e }));
    this.currentCost = { ...this.initialCost };

    this.bestSolution = this.initialSolution.map((e) => ({ ...e }));
    this.bestCost = { ...this.initialCost };

    this.temperature = this.config.initialTemperature;
  }

  /**
   * Runs the full Simulated Annealing process synchronously or step-by-step
   */
  public run(
    onProgress?: (progress: SAProgress) => void,
    reportIntervalMs: number = 100
  ): SAResult {
    const startTime = performance.now();
    this.isRunning = true;
    this.shouldStop = false;

    const neighborCtx = buildNeighborContext(
      this.problem.offerings,
      this.problem.rooms,
      this.problem.validSequencesBySks
    );

    const maxIter = this.config.maxIterations;
    const initialTemp = this.config.initialTemperature;
    const cooling = this.config.coolingRate;
    const minTemp = this.config.minTemperature;

    let lastReportTime = performance.now();

    // Initial metric point
    this.metrics.push(
      createMetricPoint(0, this.temperature, this.currentCost, this.bestCost, 0)
    );

    for (let iter = 1; iter <= maxIter; iter++) {
      if (this.shouldStop) break;

      this.iteration = iter;

      // Collect offering IDs currently involved in hard conflicts for biased mutation
      const conflictOfferingIds: string[] = [];
      if (this.currentCost.conflicts.length > 0) {
        for (const conf of this.currentCost.conflicts) {
          conflictOfferingIds.push(...conf.offeringIds);
        }
      }

      // Generate neighbor
      const { neighbor } = generateNeighbor(
        this.currentSolution,
        neighborCtx,
        this.prng,
        conflictOfferingIds
      );

      // Evaluate neighbor (fast check without full details in inner loop)
      const neighborCost = evaluateSolution(
        neighbor,
        this.offeringsMap,
        this.roomsMap,
        this.availabilitiesMap,
        this.problem.validSequencesBySks,
        this.config.weights,
        false
      );

      const deltaCost = neighborCost.totalCost - this.currentCost.totalCost;

      // Acceptance criterion (Metropolis)
      let accept = false;
      if (deltaCost <= 0) {
        // Improvement or equal
        accept = true;
        if (deltaCost < 0) {
          this.improvedMoves++;
        }
      } else {
        // Worse solution: accept with probability exp(-delta / T)
        const acceptanceProbability = Math.exp(-deltaCost / Math.max(0.0001, this.temperature));
        if (this.prng.next() < acceptanceProbability) {
          accept = true;
        }
      }

      if (accept) {
        this.currentSolution = neighbor;
        this.currentCost = neighborCost;
        this.acceptedMoves++;

        // Update global best if strictly better
        if (neighborCost.totalCost < this.bestCost.totalCost) {
          // Re-evaluate best with full conflict details for UI
          const detailedBest = evaluateSolution(
            neighbor,
            this.offeringsMap,
            this.roomsMap,
            this.availabilitiesMap,
            this.problem.validSequencesBySks,
            this.config.weights,
            true
          );
          this.bestSolution = neighbor.map((e) => ({ ...e }));
          this.bestCost = detailedBest;
        }
      }

      // Cooling schedule (Geometric cooling)
      this.temperature = Math.max(minTemp, this.temperature * cooling);

      // Record metrics periodically
      const isSampleIter = iter % Math.max(1, Math.floor(maxIter / 50)) === 0 || iter === maxIter;
      if (isSampleIter) {
        this.metrics.push(
          createMetricPoint(
            iter,
            this.temperature,
            this.currentCost,
            this.bestCost,
            this.acceptedMoves
          )
        );
      }

      // Throttle UI progress callbacks
      const now = performance.now();
      if (onProgress && (now - lastReportTime >= reportIntervalMs || iter === maxIter)) {
        lastReportTime = now;
        onProgress({
          iteration: iter,
          maxIterations: maxIter,
          temperature: this.temperature,
          progressPercent: Math.round((iter / maxIter) * 100),
          currentCost: this.currentCost.totalCost,
          bestCost: this.bestCost.totalCost,
          hardConflictsCount: this.bestCost.hardConflictsCount,
          acceptanceRate: Math.round((this.acceptedMoves / iter) * 1000) / 10,
          status: iter === maxIter ? 'COMPLETED' : 'RUNNING',
          metrics: [...this.metrics],
        });
      }

      // Early stop if zero hard conflicts and stopOnZeroHardConflicts is enabled
      if (this.config.stopOnZeroHardConflicts && this.bestCost.hardConflictsCount === 0) {
        break;
      }
    }

    const executionTimeMs = Math.round(performance.now() - startTime);
    this.isRunning = false;

    // Final detailed evaluation on best solution
    const finalBestCost = evaluateSolution(
      this.bestSolution,
      this.offeringsMap,
      this.roomsMap,
      this.availabilitiesMap,
      this.problem.validSequencesBySks,
      this.config.weights,
      true
    );

    return {
      bestSolution: this.bestSolution,
      bestCost: finalBestCost,
      initialCost: this.initialCost,
      iterations: this.iteration,
      acceptedMoves: this.acceptedMoves,
      improvedMoves: this.improvedMoves,
      executionTimeMs,
      seed: this.config.seed,
      metrics: this.metrics,
    };
  }

  public stop(): void {
    this.shouldStop = true;
    this.isRunning = false;
  }
}
