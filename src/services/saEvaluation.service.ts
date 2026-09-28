import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  OptimizationRun,
  ScheduleVersion,
  AcademicTerm,
  Room,
  TimeSlot,
  LecturerAvailability,
  SAMultiRunSummary,
  SAParameterComparison,
} from '../types';
import {
  SAProblemData,
  SASolution,
  SAConfig,
  SAProgress,
  SAResult,
  SACostBreakdown,
} from '../optimization/simulatedAnnealing/types';
import { SA_DEFAULT_CONFIG } from '../optimization/simulatedAnnealing/config';
import { SimulatedAnnealingEngine } from '../optimization/simulatedAnnealing/annealing';
import { schedulingOptimizationService } from './schedulingOptimization.service';
import { roomsService } from './rooms.service';
import { timeSlotsService } from './timeSlots.service';
import { lecturerAvailabilityService } from './lecturerAvailability.service';
import { scheduleVersionsService } from './scheduleVersions.service';

export interface SABenchmarkResult {
  run: OptimizationRun;
  saResult: SAResult;
}

export class SAEvaluationService {
  /**
   * Fetch historical optimization runs from Supabase
   */
  async getRuns(termId?: string, versionId?: string): Promise<OptimizationRun[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      let query = supabase
        .from('optimization_runs')
        .select(`
          *,
          schedule_version:schedule_version_id (
            id, title, version_number, revision, status, academic_term_id
          )
        `)
        .order('created_at', { ascending: false });

      if (versionId && versionId !== 'all') {
        query = query.eq('schedule_version_id', versionId);
      }

      if (termId && termId !== 'all') {
        query = query.eq('academic_term_id', termId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('getRuns with join notice, trying direct query:', error.message);
        // Fallback query without foreign key join
        let plainQuery = supabase
          .from('optimization_runs')
          .select('*')
          .order('created_at', { ascending: false });

        if (versionId && versionId !== 'all') {
          plainQuery = plainQuery.eq('schedule_version_id', versionId);
        }
        if (termId && termId !== 'all') {
          plainQuery = plainQuery.eq('academic_term_id', termId);
        }

        const { data: plainData } = await plainQuery;
        return (plainData || []) as OptimizationRun[];
      }

      return (data || []) as OptimizationRun[];
    } catch (err) {
      console.error('Error fetching optimization runs:', err);
      return [];
    }
  }

  /**
   * Fetch single run by ID
   */
  async getRunById(id: string): Promise<OptimizationRun | null> {
    if (!isSupabaseConfigured() || !id) return null;

    try {
      const { data, error } = await supabase
        .from('optimization_runs')
        .select(`
          *,
          schedule_version:schedule_version_id (
            id, title, version_number, revision, status, academic_term_id
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        const { data: fallback } = await supabase
          .from('optimization_runs')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        return (fallback as OptimizationRun) || null;
      }

      return data as OptimizationRun;
    } catch (err) {
      console.error('Error fetching run by id:', err);
      return null;
    }
  }

  /**
   * Record an optimization run into Supabase
   */
  async recordRun(runPayload: Partial<OptimizationRun>): Promise<OptimizationRun | null> {
    if (!isSupabaseConfigured()) return null;

    try {
      const payload: Record<string, any> = {
        algorithm: runPayload.algorithm || 'SIMULATED_ANNEALING',
        status: runPayload.status || 'COMPLETED',
        schedule_version_id: runPayload.schedule_version_id || null,
        academic_term_id: runPayload.academic_term_id || runPayload.term_id || null,
        term_id: runPayload.academic_term_id || runPayload.term_id || null,
        iterations: runPayload.iterations || 0,
        initial_cost: runPayload.initial_cost !== undefined ? Math.round(runPayload.initial_cost) : 0,
        best_cost: runPayload.best_cost !== undefined ? Math.round(runPayload.best_cost) : 0,
        final_cost: runPayload.final_cost !== undefined ? Math.round(runPayload.final_cost) : Math.round(runPayload.best_cost || 0),
        runtime_ms: runPayload.runtime_ms || runPayload.execution_time_ms || 0,
        execution_time_ms: runPayload.execution_time_ms || runPayload.runtime_ms || 0,
        hard_conflicts_count: runPayload.hard_conflicts_count ?? 0,
        soft_conflicts_count: runPayload.soft_conflicts_count ?? 0,
        config: runPayload.config || {},
        metrics: runPayload.metrics || {},
        created_at: runPayload.created_at || new Date().toISOString(),
        finished_at: runPayload.finished_at || new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('optimization_runs')
        .insert([payload])
        .select();

      if (error) {
        console.warn('recordRun notice, trying minimal insert:', error.message);
        const minimal: Record<string, any> = {
          algorithm: 'SIMULATED_ANNEALING',
          status: 'COMPLETED',
          schedule_version_id: runPayload.schedule_version_id || null,
          iterations: runPayload.iterations || 0,
          best_cost: Math.round(runPayload.best_cost || 0),
        };
        const { data: fallbackData } = await supabase.from('optimization_runs').insert([minimal]).select();
        return (fallbackData?.[0] as OptimizationRun) || null;
      }

      return (data?.[0] as OptimizationRun) || null;
    } catch (err) {
      console.warn('Error recording run:', err);
      return null;
    }
  }

  /**
   * Delete an optimization run
   */
  async deleteRun(id: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !id) return false;
    try {
      const { error } = await supabase
        .from('optimization_runs')
        .delete()
        .eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Loads problem context & initial solution for a specific schedule version
   */
  async loadVersionProblemData(versionId: string): Promise<{
    version: ScheduleVersion;
    problem: SAProblemData;
    initialSolution: SASolution;
    initialCost: SACostBreakdown;
  } | null> {
    try {
      const [version, rooms, timeSlots, availabilities] = await Promise.all([
        scheduleVersionsService.getVersionById(versionId),
        roomsService.getRooms(),
        timeSlotsService.getTimeSlots(),
        lecturerAvailabilityService.getAvailabilities(),
      ]);

      if (!version) return null;

      const entries = await schedulingOptimizationService.fetchVersionScheduleEntries(
        versionId,
        rooms,
        []
      );

      if (entries.length === 0) return null;

      const prepared = schedulingOptimizationService.prepareProblemData(
        entries,
        rooms,
        timeSlots,
        availabilities
      );

      // Evaluate initial cost breakdown
      const engine = new SimulatedAnnealingEngine(
        prepared.problem,
        prepared.initialSolution,
        SA_DEFAULT_CONFIG
      );
      const initialCost = (engine as any).initialCost as SACostBreakdown;

      return {
        version,
        problem: prepared.problem,
        initialSolution: prepared.initialSolution,
        initialCost,
      };
    } catch (err) {
      console.error('Error loading version problem data for SA evaluation:', err);
      return null;
    }
  }

  /**
   * Runs a single SA experiment on the given problem data and records it to DB
   */
  async runSingleExperiment(
    versionId: string,
    problemData: SAProblemData,
    initialSolution: SASolution,
    config: SAConfig,
    onProgress?: (progress: SAProgress) => void
  ): Promise<{
    result: SAResult;
    savedRun: OptimizationRun | null;
  }> {
    const startTime = performance.now();
    const startedAt = new Date().toISOString();

    const result = await schedulingOptimizationService.runOptimization(
      problemData,
      initialSolution,
      config,
      onProgress || (() => {})
    );

    const runtimeMs = Math.round(performance.now() - startTime);
    const finishedAt = new Date().toISOString();

    const hardReduction = result.initialCost.hardConflictsCount - result.bestCost.hardConflictsCount;
    const costReduction = result.initialCost.totalCost - result.bestCost.totalCost;
    const costReductionPercent =
      result.initialCost.totalCost > 0
        ? Math.round(((costReduction / result.initialCost.totalCost) * 100) * 100) / 100
        : 100;

    // Build rich research metrics snapshot
    const metricsPayload = {
      seed: config.seed,
      initialHardConflicts: result.initialCost.hardConflictsCount,
      finalHardConflicts: result.bestCost.hardConflictsCount,
      hardConflictsEliminated: hardReduction,
      initialSoftCost: result.initialCost.softCost,
      finalSoftCost: result.bestCost.softCost,
      costReductionPercent,
      hardBreakdown: {
        hc1RoomOverlap: { initial: result.initialCost.hc1Count, final: result.bestCost.hc1Count },
        hc2LecturerOverlap: { initial: result.initialCost.hc2Count, final: result.bestCost.hc2Count },
        hc3ClassConflict: { initial: result.initialCost.hc3Count, final: result.bestCost.hc3Count },
        hc4Capacity: { initial: result.initialCost.hc4Count, final: result.bestCost.hc4Count },
        hc5RoomType: { initial: result.initialCost.hc5Count, final: result.bestCost.hc5Count },
        hc6LecturerAvail: { initial: result.initialCost.hc6Count, final: result.bestCost.hc6Count },
        hc7SlotSeq: { initial: result.initialCost.hc7Count, final: result.bestCost.hc7Count },
        hc8FridayPrayer: { initial: result.initialCost.hc8Count, final: result.bestCost.hc8Count },
        hc9InactiveRoom: { initial: result.initialCost.hc9Count, final: result.bestCost.hc9Count },
      },
      acceptedMoves: result.acceptedMoves,
      improvedMoves: result.improvedMoves,
      totalOfferings: problemData.offerings.length,
      roomsAvailable: problemData.rooms.length,
      sampleConvergence: result.metrics.filter((_, idx) => idx % Math.max(1, Math.floor(result.metrics.length / 40)) === 0),
    };

    const savedRun = await this.recordRun({
      schedule_version_id: versionId,
      algorithm: 'SIMULATED_ANNEALING',
      status: result.bestCost.hardConflictsCount === 0 ? 'COMPLETED' : 'COMPLETED_WITH_WARNINGS',
      iterations: result.iterations,
      initial_cost: Math.round(result.initialCost.totalCost),
      best_cost: Math.round(result.bestCost.totalCost),
      final_cost: Math.round(result.bestCost.totalCost),
      runtime_ms: runtimeMs,
      execution_time_ms: runtimeMs,
      hard_conflicts_count: result.bestCost.hardConflictsCount,
      soft_conflicts_count: result.bestCost.softPenaltiesCount,
      config: {
        initialTemperature: config.initialTemperature,
        coolingRate: config.coolingRate,
        minTemperature: config.minTemperature,
        maxIterations: config.maxIterations,
        seed: config.seed,
        weights: config.weights,
      },
      metrics: metricsPayload,
      created_at: startedAt,
      finished_at: finishedAt,
    });

    return { result, savedRun };
  }

  /**
   * Runs Multi-Run Stability Benchmark (e.g. 3, 5, 10 runs with distinct seeds)
   */
  async runMultiRunBenchmark(
    versionId: string,
    problemData: SAProblemData,
    initialSolution: SASolution,
    baseConfig: SAConfig,
    seeds: number[] = [42, 123, 777, 999, 2026],
    onStep?: (currentRun: number, totalRuns: number, currentProgress?: SAProgress) => void
  ): Promise<SAMultiRunSummary> {
    const runsSummary = [];

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      const runConfig: SAConfig = {
        ...baseConfig,
        seed,
      };

      const { result } = await this.runSingleExperiment(
        versionId,
        problemData,
        initialSolution,
        runConfig,
        (prog) => {
          if (onStep) {
            onStep(i + 1, seeds.length, prog);
          }
        }
      );

      const costReduction = result.initialCost.totalCost - result.bestCost.totalCost;
      const costReductionPercent =
        result.initialCost.totalCost > 0
          ? Math.round(((costReduction / result.initialCost.totalCost) * 100) * 100) / 100
          : 100;

      runsSummary.push({
        runIndex: i + 1,
        seed,
        initialCost: Math.round(result.initialCost.totalCost),
        finalCost: Math.round(result.bestCost.totalCost),
        initialHardConflicts: result.initialCost.hardConflictsCount,
        finalHardConflicts: result.bestCost.hardConflictsCount,
        costReductionPercent,
        runtimeMs: result.executionTimeMs,
        iterations: result.iterations,
        success: result.bestCost.hardConflictsCount === 0,
      });
    }

    // Statistical analysis
    const n = runsSummary.length;
    const finalCosts = runsSummary.map((r) => r.finalCost);
    const runtimes = runsSummary.map((r) => r.runtimeMs);
    const reductions = runsSummary.map((r) => r.costReductionPercent);

    const meanFinalCost = Math.round(finalCosts.reduce((a, b) => a + b, 0) / n);
    const meanInitialCost = Math.round(runsSummary.reduce((a, b) => a + b.initialCost, 0) / n);
    const meanCostReductionPercent = Math.round((reductions.reduce((a, b) => a + b, 0) / n) * 100) / 100;
    const meanRuntimeMs = Math.round(runtimes.reduce((a, b) => a + b, 0) / n);

    // Standard deviation
    const varianceFinal = finalCosts.reduce((acc, val) => acc + Math.pow(val - meanFinalCost, 2), 0) / (n > 1 ? n - 1 : 1);
    const stdDevFinalCost = Math.round(Math.sqrt(varianceFinal) * 10) / 10;

    const varianceRuntime = runtimes.reduce((acc, val) => acc + Math.pow(val - meanRuntimeMs, 2), 0) / (n > 1 ? n - 1 : 1);
    const stdDevRuntimeMs = Math.round(Math.sqrt(varianceRuntime) * 10) / 10;

    const minFinalCost = Math.min(...finalCosts);
    const maxFinalCost = Math.max(...finalCosts);

    const successCount = runsSummary.filter((r) => r.success).length;
    const successRatePercent = Math.round((successCount / n) * 100);

    const bestRun = runsSummary.reduce((prev, curr) => (curr.finalCost < prev.finalCost ? curr : prev), runsSummary[0]);

    return {
      runCount: n,
      runs: runsSummary,
      meanInitialCost,
      meanFinalCost,
      meanCostReductionPercent,
      stdDevFinalCost,
      minFinalCost,
      maxFinalCost,
      meanRuntimeMs,
      stdDevRuntimeMs,
      successRatePercent,
      bestSeed: bestRun.seed,
      bestFinalCost: bestRun.finalCost,
    };
  }

  /**
   * Tests parameter sensitivity (e.g. cooling rates: 0.90, 0.95, 0.985, 0.992)
   */
  async runParameterSensitivitySuite(
    versionId: string,
    problemData: SAProblemData,
    initialSolution: SASolution,
    parameterName: 'coolingRate' | 'initialTemperature' | 'maxIterations',
    testedValues: number[],
    baseConfig: SAConfig = SA_DEFAULT_CONFIG,
    onStep?: (currentStep: number, totalSteps: number, value: number) => void
  ): Promise<SAParameterComparison> {
    const results = [];

    for (let i = 0; i < testedValues.length; i++) {
      const val = testedValues[i];
      if (onStep) onStep(i + 1, testedValues.length, val);

      const currentConfig: SAConfig = {
        ...baseConfig,
        [parameterName]: val,
      };

      // Run 2 seeds per parameter value to get an average
      const testSeeds = [42, 123];
      let sumCost = 0;
      let sumRuntime = 0;
      let sumIter = 0;
      let clearCount = 0;

      for (const s of testSeeds) {
        const engine = new SimulatedAnnealingEngine(problemData, initialSolution, {
          ...currentConfig,
          seed: s,
        });
        const res = engine.run(undefined, 200);

        sumCost += res.bestCost.totalCost;
        sumRuntime += res.executionTimeMs;
        sumIter += res.iterations;
        if (res.bestCost.hardConflictsCount === 0) clearCount++;
      }

      const meanFinalCost = Math.round(sumCost / testSeeds.length);
      const meanRuntimeMs = Math.round(sumRuntime / testSeeds.length);
      const meanIterations = Math.round(sumIter / testSeeds.length);
      const hardConflictClearanceRate = Math.round((clearCount / testSeeds.length) * 100);

      let speedLabel = 'Standar';
      if (meanRuntimeMs < 800) speedLabel = 'Sangat Cepat';
      else if (meanRuntimeMs < 2000) speedLabel = 'Cepat';
      else if (meanRuntimeMs > 5000) speedLabel = 'Pencarian Mendalam';

      results.push({
        value: val,
        label: `${parameterName} = ${val}`,
        meanFinalCost,
        meanRuntimeMs,
        meanIterations,
        hardConflictClearanceRate,
        convergenceSpeed: speedLabel,
      });
    }

    // Recommendation logic
    const optimal = results.reduce((best, curr) => {
      if (curr.hardConflictClearanceRate > best.hardConflictClearanceRate) return curr;
      if (curr.hardConflictClearanceRate === best.hardConflictClearanceRate && curr.meanFinalCost < best.meanFinalCost) return curr;
      return best;
    }, results[0]);

    const recommendation = `Nilai optimal untuk parameter ${parameterName} adalah ${optimal.value} karena menghasilkan tingkat keberhasilan ${optimal.hardConflictClearanceRate}% dengan rata-rata cost terendah (${optimal.meanFinalCost}) dalam waktu ${optimal.meanRuntimeMs} ms.`;

    return {
      parameterName,
      testedValues,
      results,
      recommendation,
    };
  }

  /**
   * Export runs data to CSV
   */
  exportRunsToCSV(runs: OptimizationRun[]): string {
    const headers = [
      'ID Run',
      'Waktu',
      'Versi Jadwal',
      'Algoritma',
      'Status',
      'Iterasi',
      'Initial Cost',
      'Final Cost',
      'Hard Conflicts (Akhir)',
      'Soft Cost (Akhir)',
      'Runtime (ms)',
      'Initial Temp',
      'Cooling Rate',
      'Max Iter',
      'Seed',
    ];

    const rows = runs.map((r) => {
      const cfg = r.config || {};
      const ver = r.schedule_version?.title || r.schedule_version_id || '-';
      return [
        `"${r.id}"`,
        `"${r.created_at}"`,
        `"${ver}"`,
        `"${r.algorithm || 'SIMULATED_ANNEALING'}"`,
        `"${r.status}"`,
        r.iterations ?? 0,
        r.initial_cost ?? 0,
        r.best_cost ?? r.final_cost ?? 0,
        r.hard_conflicts_count ?? 0,
        r.soft_conflicts_count ?? 0,
        r.runtime_ms ?? r.execution_time_ms ?? 0,
        cfg.initialTemperature ?? 100,
        cfg.coolingRate ?? 0.985,
        cfg.maxIterations ?? 3000,
        cfg.seed ?? 42,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Export runs to JSON
   */
  exportRunsToJSON(runs: OptimizationRun[]): string {
    return JSON.stringify(runs, null, 2);
  }
}

export const saEvaluationService = new SAEvaluationService();
