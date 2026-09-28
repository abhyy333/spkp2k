import {
  SAConfig,
  ProblemData,
  ScheduleSolution,
  OptimizationProgress,
  OptimizationResult,
  OptimizationMetricPoint,
  OptimizationStatus,
  CostBreakdown,
} from './types';
import { PRNG } from './prng';
import { evaluateSolution, DEFAULT_WEIGHTS } from './costFunction';
import { generateInitialSolution } from './initialSolution';
import { createNeighborhoodContext, generateNeighbor } from './neighborhood';
import { Room } from '../../types';

export const SA_PRESETS: Record<string, { label: string; description: string; config: Partial<SAConfig> }> = {
  FAST: {
    label: 'Cepat / Konvergensi Awal',
    description: 'Iterasi terarah untuk penyesuaian parameter cepat (500 iterasi, T0=50, α=0.92).',
    config: {
      initialTemperature: 50,
      coolingRate: 0.92,
      minTemperature: 0.05,
      maxIterations: 500,
    },
  },
  BALANCED: {
    label: 'Standar / Rekomendasi',
    description: 'Keseimbangan optimal antara kecepatan konvergensi dan kualitas solusi (2000 iterasi, T0=100, α=0.98).',
    config: {
      initialTemperature: 100,
      coolingRate: 0.98,
      minTemperature: 0.01,
      maxIterations: 2000,
    },
  },
  DEEP: {
    label: 'Optimal / Riset Mendalam',
    description: 'Eksplorasi mendalam untuk meminimalkan seluruh soft constraint (5000 iterasi, T0=250, α=0.992).',
    config: {
      initialTemperature: 250,
      coolingRate: 0.992,
      minTemperature: 0.005,
      maxIterations: 5000,
    },
  },
};

export class SimulatedAnnealingEngine {
  private problem: ProblemData;
  private config: SAConfig;
  private prng: PRNG;

  private currentSolution: ScheduleSolution = [];
  private currentCostBreakdown: CostBreakdown;
  private bestSolution: ScheduleSolution = [];
  private bestCostBreakdown: CostBreakdown;
  private initialSolution: ScheduleSolution = [];
  private initialCostBreakdown: CostBreakdown;

  private temperature: number;
  private iteration: number = 0;
  private acceptedMoves: number = 0;
  private rejectedMoves: number = 0;
  private improvedMoves: number = 0;
  private startTime: number = 0;
  private status: OptimizationStatus = 'IDLE';

  private history: OptimizationMetricPoint[] = [];
  private stopRequested: boolean = false;
  private pauseRequested: boolean = false;

  private onProgressCallback?: (progress: OptimizationProgress) => void;
  private onCompleteCallback?: (result: OptimizationResult) => void;

  constructor(problem: ProblemData, userConfig?: Partial<SAConfig>) {
    this.problem = problem;
    const seed = userConfig?.seed ?? Math.floor(Math.random() * 100000);
    this.prng = new PRNG(seed);

    this.config = {
      initialTemperature: userConfig?.initialTemperature ?? 100,
      coolingRate: userConfig?.coolingRate ?? 0.98,
      minTemperature: userConfig?.minTemperature ?? 0.01,
      maxIterations: userConfig?.maxIterations ?? 2000,
      seed,
      weights: { ...DEFAULT_WEIGHTS, ...(userConfig?.weights || {}) },
      allowEarlyExitOnZeroHard: userConfig?.allowEarlyExitOnZeroHard ?? false,
    };

    this.temperature = this.config.initialTemperature;

    // Build lookup maps
    const offeringsMap = new Map();
    problem.offerings.forEach((o) => offeringsMap.set(o.id, o));
    const roomsMap = new Map();
    problem.rooms.forEach((r) => roomsMap.set(r.id, r));

    // Generate Initial Solution
    this.initialSolution = generateInitialSolution(problem, this.prng);
    this.initialCostBreakdown = evaluateSolution(
      this.initialSolution,
      offeringsMap,
      roomsMap,
      problem.timeSlots,
      problem.availabilities,
      this.config.weights
    );

    this.currentSolution = this.initialSolution.map((a) => ({ ...a }));
    this.currentCostBreakdown = { ...this.initialCostBreakdown };

    this.bestSolution = this.initialSolution.map((a) => ({ ...a }));
    this.bestCostBreakdown = { ...this.initialCostBreakdown };
  }

  public getInitialCost(): CostBreakdown {
    return this.initialCostBreakdown;
  }

  public getBestCost(): CostBreakdown {
    return this.bestCostBreakdown;
  }

  public getBestSolution(): ScheduleSolution {
    return this.bestSolution;
  }

  public onProgress(cb: (progress: OptimizationProgress) => void) {
    this.onProgressCallback = cb;
  }

  public onComplete(cb: (result: OptimizationResult) => void) {
    this.onCompleteCallback = cb;
  }

  public pause() {
    if (this.status === 'RUNNING') {
      this.pauseRequested = true;
      this.status = 'PAUSED';
      this.emitProgress();
    }
  }

  public resume() {
    if (this.status === 'PAUSED') {
      this.pauseRequested = false;
      this.status = 'RUNNING';
      this.runLoop();
    }
  }

  public stop() {
    this.stopRequested = true;
    this.status = 'STOPPED_EARLY';
  }

  /**
   * Start the asynchronous optimization process.
   */
  public async start(): Promise<OptimizationResult> {
    this.status = 'RUNNING';
    this.stopRequested = false;
    this.pauseRequested = false;
    this.iteration = 0;
    this.acceptedMoves = 0;
    this.rejectedMoves = 0;
    this.improvedMoves = 0;
    this.temperature = this.config.initialTemperature;
    this.history = [];
    this.startTime = performance.now();

    // Record initial point
    this.recordMetricPoint();
    this.emitProgress();

    return new Promise((resolve) => {
      this.onCompleteCallback = (res) => resolve(res);
      this.runLoop();
    });
  }

  private runLoop = () => {
    if (this.status !== 'RUNNING') return;

    const ctx = createNeighborhoodContext(this.problem);
    const { offeringsMap, roomsMap } = ctx;
    const { weights, minTemperature, maxIterations, coolingRate, allowEarlyExitOnZeroHard } = this.config;

    const CHUNK_SIZE = 30; // Perform 30 iterations per micro-tick to stay responsive
    let countInChunk = 0;

    while (countInChunk < CHUNK_SIZE && this.status === 'RUNNING') {
      if (this.stopRequested) {
        this.status = 'STOPPED_EARLY';
        break;
      }
      if (this.pauseRequested) {
        this.status = 'PAUSED';
        break;
      }

      // Check stopping criteria
      if (this.iteration >= maxIterations || this.temperature <= minTemperature) {
        this.status = 'COMPLETED';
        break;
      }

      // Optional early stop if zero hard conflicts and very low cost
      if (
        allowEarlyExitOnZeroHard &&
        this.bestCostBreakdown.hardViolationsCount === 0 &&
        this.bestCostBreakdown.softCost === 0
      ) {
        this.status = 'COMPLETED';
        break;
      }

      this.iteration++;
      countInChunk++;

      // 1. Generate stochastic neighbor
      const { neighbor } = generateNeighbor(this.currentSolution, ctx, this.prng);

      // 2. Evaluate neighbor cost
      const neighborCost = evaluateSolution(
        neighbor,
        offeringsMap,
        roomsMap,
        this.problem.timeSlots,
        this.problem.availabilities,
        weights
      );

      // 3. Compute Delta E
      const deltaE = neighborCost.totalCost - this.currentCostBreakdown.totalCost;

      // 4. Metropolis Acceptance Criterion
      let accept = false;
      if (deltaE <= 0) {
        // Improvement or equal: always accept
        accept = true;
        if (deltaE < 0) {
          this.improvedMoves++;
        }
      } else {
        // Worse solution: accept with probability P = exp(-deltaE / T)
        const acceptanceProb = Math.exp(-deltaE / this.temperature);
        if (this.prng.next() < acceptanceProb) {
          accept = true;
        }
      }

      if (accept) {
        this.currentSolution = neighbor;
        this.currentCostBreakdown = neighborCost;
        this.acceptedMoves++;

        // Update global best if this is better
        if (neighborCost.totalCost < this.bestCostBreakdown.totalCost) {
          this.bestSolution = neighbor.map((a) => ({ ...a }));
          this.bestCostBreakdown = { ...neighborCost };
        }
      } else {
        this.rejectedMoves++;
      }

      // 5. Geometric Cooling Schedule: T = T * alpha
      this.temperature = Math.max(minTemperature, this.temperature * coolingRate);

      // Record history periodically (every 10 iterations or at the end)
      if (this.iteration % 10 === 0 || this.iteration === maxIterations) {
        this.recordMetricPoint();
      }
    }

    // Emit progress to UI
    this.emitProgress();

    if (this.status === 'RUNNING') {
      // Schedule next chunk
      setTimeout(this.runLoop, 0);
    } else {
      // Completed or Stopped
      const elapsed = performance.now() - this.startTime;
      const totalAttempts = this.acceptedMoves + this.rejectedMoves;
      const finalAcceptanceRate = totalAttempts > 0 ? (this.acceptedMoves / totalAttempts) * 100 : 0;

      const result: OptimizationResult = {
        success: this.bestCostBreakdown.hardViolationsCount === 0,
        initialSolution: this.initialSolution,
        initialCostBreakdown: this.initialCostBreakdown,
        bestSolution: this.bestSolution,
        bestCostBreakdown: this.bestCostBreakdown,
        totalIterations: this.iteration,
        timeElapsedMs: elapsed,
        finalTemperature: this.temperature,
        acceptanceRate: finalAcceptanceRate,
        seed: this.config.seed,
        config: this.config,
        progressHistory: this.history,
      };

      if (this.onCompleteCallback) {
        this.onCompleteCallback(result);
      }
    }
  };

  private recordMetricPoint() {
    const totalMoves = this.acceptedMoves + this.rejectedMoves;
    const rate = totalMoves > 0 ? (this.acceptedMoves / totalMoves) * 100 : 0;

    this.history.push({
      iteration: this.iteration,
      temperature: Number(this.temperature.toFixed(4)),
      currentCost: this.currentCostBreakdown.totalCost,
      bestCost: this.bestCostBreakdown.totalCost,
      hardViolations: this.bestCostBreakdown.hardViolationsCount,
      softViolations: this.bestCostBreakdown.softViolationsCount,
      acceptanceRate: Number(rate.toFixed(2)),
    });
  }

  private emitProgress() {
    if (!this.onProgressCallback) return;

    const totalMoves = this.acceptedMoves + this.rejectedMoves;
    const rate = totalMoves > 0 ? (this.acceptedMoves / totalMoves) * 100 : 0;
    const elapsed = performance.now() - (this.startTime || performance.now());

    const progress: OptimizationProgress = {
      iteration: this.iteration,
      totalIterations: this.config.maxIterations,
      temperature: this.temperature,
      currentCost: this.currentCostBreakdown.totalCost,
      bestCost: this.bestCostBreakdown.totalCost,
      initialCost: this.initialCostBreakdown.totalCost,
      hardViolations: this.bestCostBreakdown.hardViolationsCount,
      softViolations: this.bestCostBreakdown.softViolationsCount,
      acceptedMoves: this.acceptedMoves,
      rejectedMoves: this.rejectedMoves,
      improvedMoves: this.improvedMoves,
      acceptanceRate: rate,
      timeElapsedMs: elapsed,
      status: this.status,
      history: this.history,
    };

    this.onProgressCallback(progress);
  }
}
