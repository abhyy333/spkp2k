import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Square,
  RotateCcw,
  Layers,
  Sliders,
  Flame,
  Activity,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Zap,
  BarChart3,
  TrendingDown,
  Clock,
  Settings2,
  RefreshCw,
  Save,
  HelpCircle,
} from 'lucide-react';
import { ScheduleVersion, SAMultiRunSummary, SAParameterComparison } from '../../../types';
import {
  SAConfig,
  SAProgress,
  SAResult,
  SAProblemData,
  SASolution,
  SACostBreakdown,
} from '../../../optimization/simulatedAnnealing/types';
import {
  SA_PRESETS,
  SA_DEFAULT_CONFIG,
  SAPreset,
} from '../../../optimization/simulatedAnnealing/config';
import { saEvaluationService } from '../../../services/saEvaluation.service';
import { SAConvergenceChart } from './SAConvergenceChart';
import { toast } from '../../ui/Toast';
import { cn } from '../../../lib/utils';

interface SAExperimentLabProps {
  versions: ScheduleVersion[];
  selectedVersionId: string;
  onSelectVersionId: (id: string) => void;
  onExperimentComplete: () => void;
}

export const SAExperimentLab: React.FC<SAExperimentLabProps> = ({
  versions,
  selectedVersionId,
  onSelectVersionId,
  onExperimentComplete,
}) => {
  // Lab Mode: SINGLE | MULTI_RUN | SENSITIVITY
  const [labMode, setLabMode] = useState<'SINGLE' | 'MULTI_RUN' | 'SENSITIVITY'>('SINGLE');

  // Loading state for version problem data
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [problemData, setProblemData] = useState<SAProblemData | null>(null);
  const [initialSolution, setInitialSolution] = useState<SASolution | null>(null);
  const [initialCost, setInitialCost] = useState<SACostBreakdown | null>(null);

  // SA Configuration
  const [config, setConfig] = useState<SAConfig>({
    ...SA_DEFAULT_CONFIG,
    seed: 42,
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>('BALANCED');

  // Execution states
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<SAProgress | null>(null);
  const [singleResult, setSingleResult] = useState<SAResult | null>(null);

  // Multi-Run Benchmark State
  const [multiRunSeedsCount, setMultiRunSeedsCount] = useState<number>(5);
  const [multiRunProgress, setMultiRunProgress] = useState<{ current: number; total: number } | null>(null);
  const [multiRunSummary, setMultiRunSummary] = useState<SAMultiRunSummary | null>(null);

  // Sensitivity Matrix State
  const [sensitivityParam, setSensitivityParam] = useState<'coolingRate' | 'initialTemperature'>('coolingRate');
  const [sensitivityComparison, setSensitivityComparison] = useState<SAParameterComparison | null>(null);
  const [sensitivityProgress, setSensitivityProgress] = useState<{ current: number; total: number; val: number } | null>(null);

  // Load problem data when selectedVersionId changes
  useEffect(() => {
    if (!selectedVersionId) return;

    let isMounted = true;
    setLoadingData(true);
    setSingleResult(null);
    setProgress(null);
    setMultiRunSummary(null);
    setSensitivityComparison(null);

    saEvaluationService
      .loadVersionProblemData(selectedVersionId)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setProblemData(data.problem);
          setInitialSolution(data.initialSolution);
          setInitialCost(data.initialCost);
        } else {
          setProblemData(null);
          setInitialSolution(null);
          setInitialCost(null);
        }
        setLoadingData(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error loading problem data:', err);
        setLoadingData(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedVersionId]);

  const handleSelectPreset = (preset: SAPreset) => {
    setSelectedPresetId(preset.id);
    setConfig((prev) => ({
      ...prev,
      ...preset.config,
    }));
  };

  // Run Single Experiment
  const handleRunSingle = async () => {
    if (!problemData || !initialSolution) {
      toast.error('Data problem belum dimuat atau kosong.');
      return;
    }

    setIsRunning(true);
    setProgress(null);
    setSingleResult(null);

    try {
      toast.info(`Memulai single run eksperimen (Seed: ${config.seed}, Max Iter: ${config.maxIterations})...`);
      const { result, savedRun } = await saEvaluationService.runSingleExperiment(
        selectedVersionId,
        problemData,
        initialSolution,
        config,
        (p) => setProgress(p)
      );

      setSingleResult(result);
      setIsRunning(false);

      if (result.bestCost.hardConflictsCount === 0) {
        toast.success(
          `Eksperimen Selesai! 100% Bentrok tereliminasi (0 Bentrok) dalam ${result.executionTimeMs} ms.`
        );
      } else {
        toast.warning(
          `Eksperimen Selesai dengan ${result.bestCost.hardConflictsCount} bentrok tersisa.`
        );
      }

      onExperimentComplete();
    } catch (err: any) {
      console.error('Single experiment error:', err);
      setIsRunning(false);
      toast.error(err?.message || 'Terjadi kesalahan saat menjalankan eksperimen.');
    }
  };

  // Run Multi-Run Stability Benchmark
  const handleRunMultiBenchmark = async () => {
    if (!problemData || !initialSolution) {
      toast.error('Data problem belum dimuat.');
      return;
    }

    setIsRunning(true);
    setMultiRunSummary(null);

    const baseSeeds = [42, 123, 777, 999, 2026, 314, 555, 888, 1001, 2024];
    const seeds = baseSeeds.slice(0, multiRunSeedsCount);

    try {
      toast.info(`Menjalankan ${seeds.length} batch run eksperimen untuk uji stabilitas...`);
      const summary = await saEvaluationService.runMultiRunBenchmark(
        selectedVersionId,
        problemData,
        initialSolution,
        config,
        seeds,
        (current, total, prog) => {
          setMultiRunProgress({ current, total });
          if (prog) setProgress(prog);
        }
      );

      setMultiRunSummary(summary);
      setIsRunning(false);
      setMultiRunProgress(null);
      toast.success(
        `Uji Stabilitas Selesai! Success Rate: ${summary.successRatePercent}%, Rata-rata Runtime: ${summary.meanRuntimeMs} ms.`
      );
      onExperimentComplete();
    } catch (err: any) {
      console.error('Multi run benchmark error:', err);
      setIsRunning(false);
      setMultiRunProgress(null);
      toast.error(err?.message || 'Terjadi kesalahan pada multi-run benchmark.');
    }
  };

  // Run Parameter Sensitivity Test
  const handleRunSensitivity = async () => {
    if (!problemData || !initialSolution) {
      toast.error('Data problem belum dimuat.');
      return;
    }

    setIsRunning(true);
    setSensitivityComparison(null);

    const testedValues =
      sensitivityParam === 'coolingRate'
        ? [0.90, 0.95, 0.985, 0.992]
        : [50, 100, 200, 500];

    try {
      toast.info(`Menguji sensitivitas parameter ${sensitivityParam}...`);
      const comp = await saEvaluationService.runParameterSensitivitySuite(
        selectedVersionId,
        problemData,
        initialSolution,
        sensitivityParam,
        testedValues,
        config,
        (current, total, val) => {
          setSensitivityProgress({ current, total, val });
        }
      );

      setSensitivityComparison(comp);
      setIsRunning(false);
      setSensitivityProgress(null);
      toast.success(`Uji sensitivitas parameter selesai!`);
      onExperimentComplete();
    } catch (err: any) {
      console.error('Sensitivity test error:', err);
      setIsRunning(false);
      setSensitivityProgress(null);
      toast.error(err?.message || 'Terjadi kesalahan saat uji sensitivitas.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Target Schedule Selector & Experiment Mode */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Lab Eksperimen Simulated Annealing</h3>
              <p className="text-xs text-slate-500">
                Pilih versi draf jadwal dasar dan uji perilaku konvergensi SA secara terukur
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setLabMode('SINGLE')}
              disabled={isRunning}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                labMode === 'SINGLE'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              Single Run
            </button>
            <button
              type="button"
              onClick={() => setLabMode('MULTI_RUN')}
              disabled={isRunning}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                labMode === 'MULTI_RUN'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Multi-Run (Stabilitas)
            </button>
            <button
              type="button"
              onClick={() => setLabMode('SENSITIVITY')}
              disabled={isRunning}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                labMode === 'SENSITIVITY'
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Sliders className="w-3.5 h-3.5" />
              Sensitivitas Parameter
            </button>
          </div>
        </div>

        {/* Version Selector Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 items-center">
          <div className="md:col-span-2">
            <label className="block text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Pilih Target Jadwal (Draft / Versi Uji)
            </label>
            <select
              value={selectedVersionId}
              onChange={(e) => onSelectVersionId(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title || `Versi ${v.version_number}`} ({v.status}) • {v.academic_term?.academic_year || '2026/2027'}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">Kondisi Awal</span>
              <span className="font-bold text-slate-800">
                {initialCost ? `${initialCost.hardConflictsCount} Bentrok` : 'Memuat data...'}
              </span>
            </div>
            {initialCost && (
              <div className="text-right">
                <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">Initial Cost</span>
                <span className="font-bold text-blue-600">{Math.round(initialCost.totalCost).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Parameter Tuning Panel */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Konfigurasi Parameter Simulated Annealing
            </h4>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-3xs font-bold text-slate-400 uppercase mr-1">Preset:</span>
            {SA_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                disabled={isRunning}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer',
                  selectedPresetId === preset.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {/* Initial Temp */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Suhu Awal (T₀)
            </label>
            <input
              type="number"
              value={config.initialTemperature}
              disabled={isRunning}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, initialTemperature: Math.max(1, Number(e.target.value)) }))
              }
              className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
            />
          </div>

          {/* Cooling Rate */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Cooling Rate (α)
            </label>
            <input
              type="number"
              step="0.001"
              value={config.coolingRate}
              disabled={isRunning}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, coolingRate: Math.max(0.5, Math.min(0.999, Number(e.target.value))) }))
              }
              className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
            />
          </div>

          {/* Max Iterations */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Max Iterasi (N)
            </label>
            <input
              type="number"
              step="500"
              value={config.maxIterations}
              disabled={isRunning}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, maxIterations: Math.max(100, Number(e.target.value)) }))
              }
              className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
            />
          </div>

          {/* Seed */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
            <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Random Seed (PRNG)
            </label>
            <input
              type="number"
              value={config.seed}
              disabled={isRunning}
              onChange={(e) => setConfig((prev) => ({ ...prev, seed: Number(e.target.value) }))}
              className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800"
            />
          </div>

          {/* Early Stop */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex flex-col justify-between">
            <label className="text-3xs font-bold text-slate-500 uppercase tracking-wider block">
              Early Exit @ 0 HC
            </label>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={config.stopOnZeroHardConflicts ?? false}
                disabled={isRunning}
                onChange={(e) => setConfig((prev) => ({ ...prev, stopOnZeroHardConflicts: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-2xs font-medium text-slate-600">Stop jika 0 bentrok</span>
            </label>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-2xs text-slate-500">
            {labMode === 'SINGLE' && 'Mode Single Run: Menampilkan grafik real-time dan audit pelanggaran constraint.'}
            {labMode === 'MULTI_RUN' && 'Mode Multi-Run: Menguji stabilitas stokastik dengan variasi random seed otomatis.'}
            {labMode === 'SENSITIVITY' && 'Mode Sensitivitas: Menguji dampak variasi parameter terhadap cost dan runtime.'}
          </div>

          <div className="flex items-center gap-2">
            {labMode === 'SINGLE' && (
              <button
                type="button"
                onClick={handleRunSingle}
                disabled={isRunning || loadingData || !problemData}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Mengoptimasi... ({progress?.progressPercent ?? 0}%)
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Jalankan Single Run
                  </>
                )}
              </button>
            )}

            {labMode === 'MULTI_RUN' && (
              <button
                type="button"
                onClick={handleRunMultiBenchmark}
                disabled={isRunning || loadingData || !problemData}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Batch Run ({multiRunProgress?.current ?? 0}/{multiRunProgress?.total ?? multiRunSeedsCount})...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Jalankan {multiRunSeedsCount} Multi-Runs
                  </>
                )}
              </button>
            )}

            {labMode === 'SENSITIVITY' && (
              <button
                type="button"
                onClick={handleRunSensitivity}
                disabled={isRunning || loadingData || !problemData}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Uji Parameter ({sensitivityProgress?.current ?? 0}/{sensitivityProgress?.total ?? 4})...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Uji Sensitivitas
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Real-Time Telemetry Bar (When Running) */}
      {isRunning && progress && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md space-y-2 animate-pulse">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-2 text-blue-400">
              <Sparkles className="w-4 h-4" />
              Proses Optimasi Simulated Annealing Berjalan...
            </span>
            <span className="text-emerald-400">{progress.progressPercent}% Selesai</span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-2 transition-all duration-100"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 text-2xs font-mono">
            <div>
              <span className="text-slate-400 block">Iterasi:</span>
              <span className="font-bold text-white">
                {progress.iteration.toLocaleString()} / {progress.maxIterations.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Temperatur:</span>
              <span className="font-bold text-amber-400">{progress.temperature.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Hard Conflicts:</span>
              <span className={cn('font-bold', progress.hardConflictsCount === 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {progress.hardConflictsCount} Konflik
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Best Cost:</span>
              <span className="font-bold text-blue-400">{Math.round(progress.bestCost).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Acceptance Rate:</span>
              <span className="font-bold text-emerald-400">{progress.acceptanceRate}%</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Results View for Active Mode */}
      {labMode === 'SINGLE' && singleResult && (
        <div className="space-y-6">
          <SAConvergenceChart
            metrics={singleResult.metrics}
            title={`Hasil Single Run Eksperimen (Seed: ${singleResult.seed})`}
            subtitle={`Waktu Komputasi: ${singleResult.executionTimeMs} ms • Total Iterasi: ${singleResult.iterations.toLocaleString()} • Accepted Moves: ${singleResult.acceptedMoves.toLocaleString()}`}
            initialCost={singleResult.initialCost.totalCost}
            finalCost={singleResult.bestCost.totalCost}
            runtimeMs={singleResult.executionTimeMs}
          />

          {/* Before vs After Audit Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
              Perbandingan Metrik Sebelum vs Sesudah Optimasi
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">Kondisi Awal</span>
                <div className="text-xl font-black text-slate-800 mt-1">
                  {Math.round(singleResult.initialCost.totalCost).toLocaleString()}
                </div>
                <div className="text-2xs text-rose-600 font-bold mt-0.5">
                  {singleResult.initialCost.hardConflictsCount} Bentrok Keras
                </div>
              </div>

              <div className="bg-blue-50/60 rounded-xl p-3 text-center border border-blue-100">
                <span className="text-3xs font-bold uppercase tracking-wider text-blue-600 block">Hasil Optimasi</span>
                <div className="text-xl font-black text-blue-700 mt-1">
                  {Math.round(singleResult.bestCost.totalCost).toLocaleString()}
                </div>
                <div className="text-2xs text-emerald-600 font-bold mt-0.5">
                  {singleResult.bestCost.hardConflictsCount === 0 ? '0 Bentrok (Bebas Konflik)' : `${singleResult.bestCost.hardConflictsCount} Bentrok`}
                </div>
              </div>

              <div className="bg-emerald-50/60 rounded-xl p-3 text-center border border-emerald-100">
                <span className="text-3xs font-bold uppercase tracking-wider text-emerald-700 block">Efisiensi</span>
                <div className="text-xl font-black text-emerald-700 mt-1">
                  ↓ {singleResult.initialCost.totalCost > 0
                    ? Math.round(((singleResult.initialCost.totalCost - singleResult.bestCost.totalCost) / singleResult.initialCost.totalCost) * 1000) / 10
                    : 100}%
                </div>
                <div className="text-2xs text-slate-600 font-medium mt-0.5">
                  Waktu: {singleResult.executionTimeMs} ms
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Run Benchmark Result */}
      {labMode === 'MULTI_RUN' && multiRunSummary && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Ringkasan Uji Stabilitas Stokastik ({multiRunSummary.runCount} Percobaan)
              </h4>
              <p className="text-xs text-slate-500">
                Membuktikan konsistensi dan reliabilitas Simulated Annealing terhadap variasi random seed
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Success Rate: {multiRunSummary.successRatePercent}% (Feasible)
            </span>
          </div>

          {/* Statistical Aggregates Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">Rata-rata Final Cost (μ)</span>
              <span className="text-lg font-black text-slate-900 mt-0.5 block">
                {multiRunSummary.meanFinalCost.toLocaleString()}
              </span>
              <span className="text-3xs text-slate-500">σ = {multiRunSummary.stdDevFinalCost}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">Rata-rata Runtime</span>
              <span className="text-lg font-black text-slate-900 mt-0.5 block">
                {multiRunSummary.meanRuntimeMs} ms
              </span>
              <span className="text-3xs text-slate-500">σ = {multiRunSummary.stdDevRuntimeMs} ms</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">Cost Terbaik / Terendah</span>
              <span className="text-lg font-black text-blue-600 mt-0.5 block">
                {multiRunSummary.minFinalCost.toLocaleString()}
              </span>
              <span className="text-3xs text-slate-500">Seed: {multiRunSummary.bestSeed}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">Mean Cost Reduction</span>
              <span className="text-lg font-black text-emerald-600 mt-0.5 block">
                ↓ {multiRunSummary.meanCostReductionPercent}%
              </span>
              <span className="text-3xs text-slate-500">Konsisten</span>
            </div>
          </div>

          {/* Runs Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 mt-4">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Run #</th>
                  <th className="p-2.5">Random Seed</th>
                  <th className="p-2.5">Initial Cost</th>
                  <th className="p-2.5">Final Cost</th>
                  <th className="p-2.5">Hard Conflicts</th>
                  <th className="p-2.5">Cost Reduction</th>
                  <th className="p-2.5">Runtime</th>
                  <th className="p-2.5">Feasibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {multiRunSummary.runs.map((r) => (
                  <tr key={r.runIndex} className="hover:bg-slate-50/80">
                    <td className="p-2.5 font-bold text-slate-800">#{r.runIndex}</td>
                    <td className="p-2.5 font-mono text-slate-600">{r.seed}</td>
                    <td className="p-2.5 font-mono text-slate-500">{r.initialCost.toLocaleString()}</td>
                    <td className="p-2.5 font-mono font-bold text-blue-600">{r.finalCost.toLocaleString()}</td>
                    <td className="p-2.5">
                      <span className={cn('px-2 py-0.5 rounded text-2xs font-bold', r.finalHardConflicts === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
                        {r.finalHardConflicts} bentrok
                      </span>
                    </td>
                    <td className="p-2.5 text-emerald-600 font-bold">↓ {r.costReductionPercent}%</td>
                    <td className="p-2.5 font-mono text-slate-600">{r.runtimeMs} ms</td>
                    <td className="p-2.5">
                      {r.success ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Bersih
                        </span>
                      ) : (
                        <span className="text-amber-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Minor
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sensitivity Test Result */}
      {labMode === 'SENSITIVITY' && sensitivityComparison && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h4 className="text-sm font-bold text-slate-900">
              Hasil Uji Sensitivitas Parameter ({sensitivityComparison.parameterName})
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Analisis perbandingan kinerja saat parameter diubah untuk menemukan titik optimal
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {sensitivityComparison.results.map((res, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 text-xs">
                <span className="font-bold text-blue-700 block">{res.label}</span>
                <div className="text-2xs text-slate-600 pt-1">
                  Rata-rata Cost: <strong>{res.meanFinalCost.toLocaleString()}</strong>
                </div>
                <div className="text-2xs text-slate-600">
                  Runtime: <strong>{res.meanRuntimeMs} ms</strong>
                </div>
                <div className="text-2xs text-emerald-600 font-bold">
                  Clearance Rate: {res.hardConflictClearanceRate}%
                </div>
                <div className="text-3xs text-slate-400">{res.convergenceSpeed}</div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Rekomendasi Parameter Penelitian:</strong>
              <p className="mt-0.5 text-2xs leading-relaxed">{sensitivityComparison.recommendation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
