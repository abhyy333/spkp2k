import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles,
  Play,
  Square,
  RotateCcw,
  Save,
  ArrowLeft,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Activity,
  Layers,
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  TrendingDown,
  LayoutGrid,
  List,
  DoorOpen,
  Info,
} from 'lucide-react';
import {
  InitialScheduleEntry,
  InitialScheduleConflict,
} from '../../../services/schedulingInitial.service';
import { Room, TimeSlot, LecturerAvailability } from '../../../types';
import {
  SAConfig,
  SAProgress,
  SAResult,
  SACostBreakdown,
  HardConflictDetail,
} from '../../../optimization/simulatedAnnealing/types';
import {
  SA_PRESETS,
  SA_DEFAULT_CONFIG,
  SAPreset,
} from '../../../optimization/simulatedAnnealing/config';
import { SimulatedAnnealingEngine } from '../../../optimization/simulatedAnnealing/annealing';
import {
  ScheduleComparisonStats,
  calculateComparisonStats,
} from '../../../optimization/simulatedAnnealing/metrics';
import { schedulingOptimizationService } from '../../../services/schedulingOptimization.service';
import { saEvaluationService } from '../../../services/saEvaluation.service';
import { cn } from '../../../lib/utils';
import { toast } from '../../ui/Toast';
import { AppleWeeklyCalendar } from '../../schedule/AppleWeeklyCalendar';
import { AppleScheduleCardData } from '../../schedule/AppleScheduleCard';

interface SchedulingSimulatedAnnealingViewProps {
  entries: InitialScheduleEntry[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  selectedSemesterType: 'GANJIL' | 'GENAP';
  onBackToStep4: () => void;
  onContinueToStep6?: (meta?: any) => void;
  onSaveOptimizedSchedule: (optimizedEntries: InitialScheduleEntry[]) => Promise<void>;
  saving: boolean;
}

export const SchedulingSimulatedAnnealingView: React.FC<SchedulingSimulatedAnnealingViewProps> = ({
  entries,
  rooms,
  timeSlots,
  availabilities,
  selectedSemesterType,
  onBackToStep4,
  onContinueToStep6,
  onSaveOptimizedSchedule,
  saving,
}) => {
  // Optimization State
  const [config, setConfig] = useState<SAConfig>({
    ...SA_DEFAULT_CONFIG,
    seed: 42,
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>('BALANCED');

  const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'COMPLETED' | 'STOPPED'>('IDLE');
  const [progress, setProgress] = useState<SAProgress | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<SAResult | null>(null);

  // Active solution displayed in table/grid (initial or optimized)
  const [currentEntries, setCurrentEntries] = useState<InitialScheduleEntry[]>(entries);
  const [hasOptimized, setHasOptimized] = useState<boolean>(false);

  // View mode (Default to GRID per Apple Calendar focus)
  const [viewMode, setViewMode] = useState<'TABLE' | 'GRID'>('GRID');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'ALL'>('ALL');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string | 'ALL'>('ALL');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<number | 'ALL'>('ALL');
  const [conflictFilter, setConflictFilter] = useState<'ALL' | 'CONFLICT_ONLY' | 'CLEAN_ONLY'>('ALL');

  // Determine active profile from timeSlots or entries
  const isRamadanMode = useMemo(() => {
    return (
      timeSlots.some((s) => s.duration_minutes === 40 || s.start_minute === 480) ||
      entries.some((e: any) => e.minutes_per_session === 40)
    );
  }, [timeSlots, entries]);

  const activeMinutesPerSks = isRamadanMode ? 40 : 50;

  // Pre-prepared problem data
  const problemContext = useMemo(() => {
    return schedulingOptimizationService.prepareProblemData(
      entries,
      rooms,
      timeSlots,
      availabilities,
      activeMinutesPerSks
    );
  }, [entries, rooms, timeSlots, availabilities, activeMinutesPerSks]);

  // Initial Cost Evaluation on mount
  const initialCostBreakdown = useMemo(() => {
    // Initial cost from problem context
    const engine = new SimulatedAnnealingEngine(
      problemContext.problem,
      problemContext.initialSolution,
      config
    );
    return (engine as any).initialCost as SACostBreakdown;
  }, [problemContext, config]);

  // Active Cost Breakdown
  const activeCost: SACostBreakdown = useMemo(() => {
    if (optimizationResult) {
      return optimizationResult.bestCost;
    }
    return initialCostBreakdown;
  }, [optimizationResult, initialCostBreakdown]);

  // Comparison stats
  const comparisonStats: ScheduleComparisonStats | null = useMemo(() => {
    if (!optimizationResult) return null;
    const offMap = new Map();
    problemContext.problem.offerings.forEach((o) => offMap.set(o.id, o));
    const rmMap = new Map();
    problemContext.problem.rooms.forEach((r) => rmMap.set(r.id, r));

    return calculateComparisonStats(
      optimizationResult.initialCost,
      optimizationResult.bestCost,
      problemContext.initialSolution,
      optimizationResult.bestSolution,
      offMap,
      rmMap
    );
  }, [optimizationResult, problemContext]);

  // Handle Preset selection
  const handleSelectPreset = (preset: SAPreset) => {
    setSelectedPresetId(preset.id);
    setConfig((prev) => ({
      ...prev,
      ...preset.config,
    }));
  };

  // Start Optimization
  const handleStartOptimization = async () => {
    setStatus('RUNNING');
    setProgress(null);

    try {
      toast.info('Memulai optimasi Simulated Annealing...');
      const result = await schedulingOptimizationService.runOptimization(
        problemContext.problem,
        problemContext.initialSolution,
        config,
        (p) => {
          setProgress(p);
        }
      );

      setOptimizationResult(result);
      setStatus('COMPLETED');
      setHasOptimized(true);

      // Merge best solution back into InitialScheduleEntry[]
      const merged = schedulingOptimizationService.mergeSolutionToEntries(
        result.bestSolution,
        entries,
        rooms,
        activeMinutesPerSks
      );
      setCurrentEntries(merged);

      // Record to optimization_runs database table
      const versionId = entries[0]?.scheduleVersionId;
      if (versionId) {
        saEvaluationService.recordRun({
          schedule_version_id: versionId,
          algorithm: 'SIMULATED_ANNEALING',
          status: result.bestCost.hardConflictsCount === 0 ? 'COMPLETED' : 'COMPLETED_WITH_WARNINGS',
          iterations: result.iterations,
          initial_cost: Math.round(result.initialCost.totalCost),
          best_cost: Math.round(result.bestCost.totalCost),
          final_cost: Math.round(result.bestCost.totalCost),
          runtime_ms: result.executionTimeMs,
          execution_time_ms: result.executionTimeMs,
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
          metrics: {
            seed: config.seed,
            initialHardConflicts: result.initialCost.hardConflictsCount,
            finalHardConflicts: result.bestCost.hardConflictsCount,
            initialSoftCost: result.initialCost.softCost,
            finalSoftCost: result.bestCost.softCost,
            sampleConvergence: result.metrics.filter(
              (_, idx) => idx % Math.max(1, Math.floor(result.metrics.length / 40)) === 0
            ),
          },
        }).catch((e) => console.warn('Record run background notice:', e));
      }

      if (result.bestCost.hardConflictsCount === 0) {
        toast.success(
          `Optimasi Selesai! Seluruh ${result.initialCost.hardConflictsCount} bentrok berhasil dieliminasi (0 Bentrok).`
        );
      } else {
        const eliminated = result.initialCost.hardConflictsCount - result.bestCost.hardConflictsCount;
        toast.success(
          `Optimasi Selesai! Berhasil mengeliminasi ${eliminated} bentrok (${result.bestCost.hardConflictsCount} tersisa).`
        );
      }
    } catch (err: any) {
      console.error('Optimization error:', err);
      setStatus('STOPPED');
      toast.error(err?.message || 'Terjadi kesalahan saat menjalankan optimasi.');
    }
  };

  // Stop Optimization
  const handleStopOptimization = () => {
    schedulingOptimizationService.terminateWorker();
    setStatus('STOPPED');
    toast.info('Optimasi dihentikan oleh pengguna.');
  };

  // Reset back to Initial Solution
  const handleResetToInitial = () => {
    setCurrentEntries(entries);
    setOptimizationResult(null);
    setProgress(null);
    setStatus('IDLE');
    setHasOptimized(false);
    toast.info('Jadwal dikembalikan ke kondisi awal (Tahap 4).');
  };

  // Filtered entries for table/grid
  const filteredEntries = useMemo(() => {
    return currentEntries.filter((entry) => {
      if (selectedDayFilter !== 'ALL' && entry.dayOfWeek !== selectedDayFilter) {
        return false;
      }
      if (selectedRoomFilter !== 'ALL' && entry.roomId !== selectedRoomFilter) {
        return false;
      }
      if (selectedSemesterFilter !== 'ALL' && entry.offering.semester !== selectedSemesterFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCourse =
          entry.offering.courseName.toLowerCase().includes(q) ||
          entry.offering.courseCode.toLowerCase().includes(q);
        const matchesLecturer = entry.offering.primaryLecturerName.toLowerCase().includes(q);
        const matchesRoom = entry.roomCode.toLowerCase().includes(q);
        if (!matchesCourse && !matchesLecturer && !matchesRoom) return false;
      }
      return true;
    });
  }, [
    currentEntries,
    selectedDayFilter,
    selectedRoomFilter,
    selectedSemesterFilter,
    searchQuery,
  ]);

  // Convert filteredEntries to AppleScheduleCardData for AppleWeeklyCalendar
  const calendarEntries: AppleScheduleCardData[] = useMemo(() => {
    return filteredEntries.map((e) => ({
      id: e.courseOfferingId,
      course_name: e.offering.courseName,
      course_code: e.offering.courseCode,
      class_name: e.offering.classCode,
      start_time: e.startTime,
      end_time: e.endTime,
      room_code: e.roomCode,
      room_name: e.roomName,
      lecturer_names: e.offering.primaryLecturerName,
      sks: e.offering.effectiveSks,
      isConflict: e.conflicts.length > 0,
      conflictReason: e.conflicts[0]?.title || 'Bentrok',
      raw: {
        ...e,
        day_of_week: e.dayOfWeek,
        start_minute: e.startMinute,
        end_minute: e.endMinute,
      },
    }));
  }, [filteredEntries]);

  const daysList = [
    { num: 1, name: 'Senin' },
    { num: 2, name: 'Selasa' },
    { num: 3, name: 'Rabu' },
    { num: 4, name: 'Kamis' },
    { num: 5, name: 'Jumat' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">
                  Tahap 5: Optimasi Jadwal (Simulated Annealing)
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  <Activity className="w-3 h-3" />
                  Unit: 1 Offering
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-semibold bg-slate-100 text-slate-700">
                  Primary Lecturer Preserved
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-semibold bg-emerald-100 text-emerald-800">
                  Praktikum & KKN Excluded
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Mengoptimasi penempatan ruangan dan slot waktu jadwal awal dari Tahap 4 menggunakan algoritma
                metaheuristik <strong>Simulated Annealing</strong> dengan <em>Seeded Random</em> reproducible
                untuk mengeliminasi seluruh bentrok (Hard Constraints) dan meminimalkan waste kursi (Soft Constraints).
              </p>
            </div>
          </div>

          {/* Quick Status / Cost Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-right">
              <p className="text-3xs font-semibold text-slate-400 uppercase tracking-wider">Bentrok Keras (Hard)</p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span
                  className={cn(
                    'text-xl font-black',
                    activeCost.hardConflictsCount === 0 ? 'text-emerald-600' : 'text-rose-600'
                  )}
                >
                  {activeCost.hardConflictsCount}
                </span>
                <span className="text-3xs text-slate-400">konflik</span>
              </div>
              {comparisonStats && (
                <p className="text-3xs font-bold text-emerald-600">
                  ↓ {comparisonStats.conflictsEliminatedCount} tereliminasi
                </p>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-right">
              <p className="text-3xs font-semibold text-slate-400 uppercase tracking-wider">Total Penalti (Cost)</p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="text-xl font-black text-slate-900">
                  {Math.round(activeCost.totalCost).toLocaleString()}
                </span>
              </div>
              {comparisonStats && comparisonStats.costReductionPercent > 0 && (
                <p className="text-3xs font-bold text-emerald-600">
                  ↓ {comparisonStats.costReductionPercent}% reduksi
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Control Panel & Configuration */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              Parameter & Kontrol Optimasi
            </h3>
            <p className="text-3xs text-slate-400">
              Pilih preset atau sesuaikan parameter pendinginan (cooling schedule) & seeded random.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {status === 'RUNNING' ? (
              <button
                type="button"
                onClick={handleStopOptimization}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Hentikan Optimasi</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartOptimization}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs shadow-blue-500/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>{hasOptimized ? 'Optimasi Ulang' : 'Mulai Optimasi Simulated Annealing'}</span>
              </button>
            )}

            {hasOptimized && status !== 'RUNNING' && (
              <button
                type="button"
                onClick={handleResetToInitial}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                title="Kembalikan ke Jadwal Awal"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Awal</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onSaveOptimizedSchedule(currentEntries)}
              disabled={saving || status === 'RUNNING'}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Menerapkan...' : 'Terapkan Hasil Optimasi'}</span>
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SA_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={status === 'RUNNING'}
                onClick={() => handleSelectPreset(preset)}
                className={cn(
                  'p-3.5 rounded-xl border text-left transition-all cursor-pointer',
                  isSelected
                    ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/60',
                  status === 'RUNNING' && 'opacity-60 cursor-not-allowed'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs font-bold', isSelected ? 'text-blue-900' : 'text-slate-800')}>
                    {preset.name}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </div>
                <p className="text-3xs text-slate-500 mt-1 leading-snug">{preset.description}</p>
              </button>
            );
          })}
        </div>

        {/* Parameter Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="block text-3xs font-semibold text-slate-500 mb-1">Max Iterasi</label>
            <input
              type="number"
              disabled={status === 'RUNNING'}
              value={config.maxIterations}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  maxIterations: Math.max(100, Number(e.target.value) || 1000),
                }))
              }
              className="w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-3xs font-semibold text-slate-500 mb-1">Suhu Awal (T₀)</label>
            <input
              type="number"
              disabled={status === 'RUNNING'}
              value={config.initialTemperature}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  initialTemperature: Math.max(1, Number(e.target.value) || 100),
                }))
              }
              className="w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-3xs font-semibold text-slate-500 mb-1">Laju Pendinginan (α)</label>
            <input
              type="number"
              step="0.001"
              disabled={status === 'RUNNING'}
              value={config.coolingRate}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  coolingRate: Math.min(0.999, Math.max(0.8, Number(e.target.value) || 0.985)),
                }))
              }
              className="w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-3xs font-semibold text-slate-500 mb-1">Random Seed</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                disabled={status === 'RUNNING'}
                value={config.seed}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    seed: Number(e.target.value) || 42,
                  }))
                }
                className="w-full text-xs font-mono px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={status === 'RUNNING'}
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    seed: Math.floor(Math.random() * 100000) + 1,
                  }))
                }
                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-3xs font-semibold rounded-lg"
                title="Randomize Seed"
              >
                Acak
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar (Visible while RUNNING or COMPLETED) */}
        {(status === 'RUNNING' || progress) && (
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                Iterasi {progress?.iteration.toLocaleString() || 0} / {config.maxIterations.toLocaleString()}
              </span>
              <span className="font-mono text-3xs text-slate-500">
                Suhu: {progress?.temperature.toFixed(2)} | Acceptance:{' '}
                {progress?.acceptanceRate}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-blue-500 to-indigo-600 transition-all duration-150 rounded-full"
                style={{ width: `${progress?.progressPercent || 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Hard & Soft Constraints Diagnostics Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hard Constraints Breakdown */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Status 9 Hard Constraints
            </h3>
            {activeCost.hardConflictsCount === 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Solusi Feasible (0 Bentrok)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <AlertTriangle className="w-3 h-3" />
                {activeCost.hardConflictsCount} Pelanggaran
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5">
              <p className="text-3xs text-slate-500 font-semibold truncate">HC1: Bentrok Ruang</p>
              <p
                className={cn(
                  'text-base font-bold mt-0.5',
                  activeCost.hc1Count === 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {activeCost.hc1Count}
              </p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5">
              <p className="text-3xs text-slate-500 font-semibold truncate">HC2: Bentrok Dosen</p>
              <p
                className={cn(
                  'text-base font-bold mt-0.5',
                  activeCost.hc2Count === 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {activeCost.hc2Count}
              </p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5">
              <p className="text-3xs text-slate-500 font-semibold truncate">HC3: Bentrok Rombel</p>
              <p
                className={cn(
                  'text-base font-bold mt-0.5',
                  activeCost.hc3Count === 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {activeCost.hc3Count}
              </p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5">
              <p className="text-3xs text-slate-500 font-semibold truncate">HC4: Kapasitas Ruang</p>
              <p
                className={cn(
                  'text-base font-bold mt-0.5',
                  activeCost.hc4Count === 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {activeCost.hc4Count}
              </p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5">
              <p className="text-3xs text-slate-500 font-semibold truncate">HC5: Tipe Ruang Strict</p>
              <p
                className={cn(
                  'text-base font-bold mt-0.5',
                  activeCost.hc5Count === 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {activeCost.hc5Count}
              </p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5">
              <p className="text-3xs text-slate-500 font-semibold truncate">HC6: Ketersediaan Dosen</p>
              <p
                className={cn(
                  'text-base font-bold mt-0.5',
                  activeCost.hc6Count === 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {activeCost.hc6Count}
              </p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5">
              <p className="text-3xs text-slate-500 font-semibold truncate">HC7: Slot Berurutan</p>
              <p
                className={cn(
                  'text-base font-bold mt-0.5',
                  activeCost.hc7Count === 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {activeCost.hc7Count}
              </p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5">
              <p className="text-3xs text-slate-500 font-semibold truncate">HC8: Sholat Jumat</p>
              <p
                className={cn(
                  'text-base font-bold mt-0.5',
                  activeCost.hc8Count === 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {activeCost.hc8Count}
              </p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5">
              <p className="text-3xs text-slate-500 font-semibold truncate">HC9: Ruang Aktif</p>
              <p
                className={cn(
                  'text-base font-bold mt-0.5',
                  activeCost.hc9Count === 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {activeCost.hc9Count}
              </p>
            </div>
          </div>

          {/* Conflict details accordion/list if any exist */}
          {activeCost.conflicts.length > 0 && (
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 text-xs">
              <p className="text-3xs font-bold text-rose-800 uppercase tracking-wider">
                Daftar Konflik Tersisa:
              </p>
              {activeCost.conflicts.slice(0, 10).map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-rose-700 text-3xs">
                  <span className="font-bold shrink-0">•</span>
                  <span>{c.description}</span>
                </div>
              ))}
              {activeCost.conflicts.length > 10 && (
                <p className="text-3xs text-rose-600 italic">
                  + {activeCost.conflicts.length - 10} konflik lainnya...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Soft Constraints & Comparison Stats */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-emerald-500" />
            Soft Constraints & Metrik
          </h3>

          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
              <p className="text-3xs text-slate-500 font-semibold">Rata-rata Waste Kursi / Kelas</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold text-slate-900">
                  {comparisonStats ? comparisonStats.bestSeatWaste : '—'} kursi
                </span>
                {comparisonStats && (
                  <span className="text-3xs text-slate-500">
                    Awal: {comparisonStats.initialSeatWaste} kursi
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
              <p className="text-3xs text-slate-500 font-semibold">Total Soft Penalty Cost</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold text-slate-900">
                  {Math.round(activeCost.softCost).toLocaleString()}
                </span>
                <span className="text-3xs text-slate-500">
                  {activeCost.softPenaltiesCount} penalti ringan
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
              <p className="text-3xs text-slate-500 font-semibold">Waktu Eksekusi Worker</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {optimizationResult ? `${optimizationResult.executionTimeMs} ms` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Results View (Filters & Table/Grid) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {/* Table/Grid Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari mata kuliah / dosen / ruang..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Day Filter */}
            <select
              value={selectedDayFilter}
              onChange={(e) =>
                setSelectedDayFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
              }
              className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="ALL">Semua Hari</option>
              {daysList.map((d) => (
                <option key={d.num} value={d.num}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Room Filter */}
            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="ALL">Semua Ruangan</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} ({r.capacity} krs)
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabel Rinci</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'GRID' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid Mingguan</span>
            </button>
          </div>
        </div>

        {/* Content Table / Grid */}
        {viewMode === 'TABLE' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-3xs uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Mata Kuliah & Kelas</th>
                  <th className="py-3 px-4">Dosen Pengampu Utama</th>
                  <th className="py-3 px-4">Hari & Waktu</th>
                  <th className="py-3 px-4">Ruangan</th>
                  <th className="py-3 px-4 text-center">Peserta / Kapasitas</th>
                  <th className="py-3 px-4 text-center">Waste Kursi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Tidak ada kelas yang memenuhi kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.courseOfferingId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{entry.offering.courseName}</div>
                        <div className="text-3xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{entry.offering.courseCode}</span>
                          <span>•</span>
                          <span className="font-semibold text-blue-600">Kelas {entry.offering.classCode}</span>
                          <span>•</span>
                          <span>{entry.offering.effectiveSks} SKS</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {entry.offering.primaryLecturerName}
                        </div>
                        <div className="text-3xs text-slate-400">Dosen Pengampu Utama</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{entry.dayName}</div>
                        <div className="text-3xs font-mono text-slate-500">
                          {entry.startTime} - {entry.endTime}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{entry.roomCode}</div>
                        <div className="text-3xs text-slate-400">{entry.roomType}</div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-3xs font-semibold bg-slate-100 text-slate-700">
                          {entry.offering.expectedStudents} / {entry.roomCapacity}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-md font-mono text-3xs font-bold',
                            entry.seatWaste >= 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          )}
                        >
                          {entry.seatWaste >= 0 ? `+${entry.seatWaste}` : entry.seatWaste} kursi
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Weekly Grid View: Apple Weekly Translucent Glass Calendar */
          <div className="p-2 sm:p-4">
            <AppleWeeklyCalendar
              title="Matriks Jadwal Teroptimasi"
              subtitle="Hasil optimasi Simulated Annealing. Seluruh kelas ditampilkan dengan aksen warna dan alokasi sesi teratur."
              entries={calendarEntries}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onResetThisWeek={() => setSelectedDate(new Date())}
            />
          </div>
        )}
      </div>

      {/* 5. Sticky Bottom Action Bar */}
      <div className="sticky bottom-4 z-20">
        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left: Summary Info */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  Tahap 5: {hasOptimized ? 'Solusi Teroptimasi' : 'Jadwal Awal Siap Dioptimasi'}
                </p>
                <p className="text-3xs text-slate-400">
                  {activeCost.hardConflictsCount === 0
                    ? '0 Bentrok Keras (Solusi Feasible). Siap untuk ditinjau pada publikasi.'
                    : `${activeCost.hardConflictsCount} bentrok terdeteksi. Jalankan optimasi untuk mengeliminasi.`}
                </p>
              </div>
            </div>

            {/* Right: Navigation Controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onBackToStep4}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Step 4</span>
              </button>

              {/* Step 6: Preview & Publikasi */}
              <button
                type="button"
                onClick={() => {
                  if (onContinueToStep6) {
                    onContinueToStep6(
                      optimizationResult
                        ? {
                            initialConflicts: optimizationResult.initialCost.hardConflictsCount,
                            bestConflicts: optimizationResult.bestCost.hardConflictsCount,
                            initialCost: optimizationResult.initialCost.totalCost,
                            bestCost: optimizationResult.bestCost.totalCost,
                            executionTimeMs: optimizationResult.executionTimeMs,
                            seed: optimizationResult.seed,
                          }
                        : null
                    );
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-500/30 transition-all cursor-pointer"
              >
                <span>Lanjut ke Preview & Publikasi (Step 6)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
