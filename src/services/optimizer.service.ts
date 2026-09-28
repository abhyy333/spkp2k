import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { OptimizationResult, SAConfig } from '../lib/optimizer/types';

export interface OptimizationRunRecord {
  id?: string;
  term_id?: string;
  academic_term_id?: string;
  schedule_version_id?: string;
  algorithm: string;
  status: string;
  iterations?: number;
  initial_cost?: number;
  best_cost?: number;
  final_cost?: number;
  runtime_ms?: number;
  execution_time_ms?: number;
  hard_conflicts_count?: number;
  soft_conflicts_count?: number;
  config?: Record<string, any>;
  metrics?: Record<string, any>;
  created_at?: string;
}

export const optimizerService = {
  /**
   * Log an optimization run to Supabase optimization_runs table
   */
  async recordRun(
    termId: string,
    versionId: string,
    result: OptimizationResult,
    config: SAConfig
  ): Promise<any> {
    if (!isSupabaseConfigured()) return null;

    try {
      const payload: Record<string, any> = {
        term_id: termId,
        academic_term_id: termId,
        schedule_version_id: versionId,
        algorithm: 'SIMULATED_ANNEALING',
        status: result.success ? 'COMPLETED' : 'COMPLETED_WITH_WARNINGS',
        iterations: result.totalIterations,
        initial_cost: Math.round(result.initialCostBreakdown.totalCost),
        best_cost: Math.round(result.bestCostBreakdown.totalCost),
        final_cost: Math.round(result.bestCostBreakdown.totalCost),
        runtime_ms: Math.round(result.timeElapsedMs),
        execution_time_ms: Math.round(result.timeElapsedMs),
        hard_conflicts_count: result.bestCostBreakdown.hardViolationsCount,
        soft_conflicts_count: result.bestCostBreakdown.softViolationsCount,
        config: {
          initialTemperature: config.initialTemperature,
          coolingRate: config.coolingRate,
          minTemperature: config.minTemperature,
          maxIterations: config.maxIterations,
          seed: config.seed,
          weights: config.weights,
        },
        metrics: {
          acceptanceRate: result.acceptanceRate,
          finalTemperature: result.finalTemperature,
          totalOfferings: result.bestSolution.length,
          violations: result.bestCostBreakdown.violations.slice(0, 20),
        },
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('optimization_runs')
        .insert([payload])
        .select();

      if (error) {
        // If column schema mismatch, try fallback minimal insert
        console.warn('Full optimization_runs insert notice, trying standard payload:', error.message);
        const minimalPayload: Record<string, any> = {
          academic_term_id: termId,
          schedule_version_id: versionId,
          algorithm: 'SIMULATED_ANNEALING',
          status: 'COMPLETED',
          iterations: result.totalIterations,
          best_cost: Math.round(result.bestCostBreakdown.totalCost),
        };
        const fallbackRes = await supabase.from('optimization_runs').insert([minimalPayload]).select();
        return fallbackRes.data;
      }

      return data;
    } catch (err) {
      console.warn('Error recording optimization run to Supabase:', err);
      return null;
    }
  },

  /**
   * Get list of optimization runs
   */
  async getRuns(versionId?: string): Promise<any[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      let query = supabase
        .from('optimization_runs')
        .select('*')
        .order('created_at', { ascending: false });

      if (versionId) {
        query = query.eq('schedule_version_id', versionId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error querying optimization_runs:', error);
        return [];
      }

      return data || [];
    } catch {
      return [];
    }
  },
};
