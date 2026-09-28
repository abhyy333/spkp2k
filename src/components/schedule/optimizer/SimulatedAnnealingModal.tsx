import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CourseOffering,
  Room,
  TimeSlot,
  LecturerAvailability,
  Lecturer,
  ScheduleEntry,
  AcademicTerm,
} from '../../../types';
import {
  SAConfig,
  OptimizationProgress,
  OptimizationResult,
  ProblemData,
} from '../../../lib/optimizer/types';
import {
  validateOptimizationReadiness,
  extractSchedulableOfferings,
} from '../../../lib/optimizer/validator';
import {
  SimulatedAnnealingEngine,
} from '../../../lib/optimizer/simulatedAnnealing';
import { DEFAULT_WEIGHTS } from '../../../lib/optimizer/costFunction';
import { optimizerService } from '../../../services/optimizer.service';
import { SAPreValidationTab } from './SAPreValidationTab';
import { SAConfigTab } from './SAConfigTab';
import { SARunnerTab } from './SARunnerTab';
import { SAResultTab } from './SAResultTab';
import { toast } from '../../ui/Toast';
import { minuteToTime, dayOfWeekToName } from '../../../lib/utils';
import {
  Sparkles,
  X,
  CheckCircle,
  Sliders,
  Play,
  TrendingDown,
} from 'lucide-react';

interface SimulatedAnnealingModalProps {
  isOpen: boolean;
  onClose: () => void;
  term: AcademicTerm | null;
  offerings: CourseOffering[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  lecturers: Lecturer[];
  currentVersionId: string;
  onApplySolution: (newEntries: ScheduleEntry[]) => void;
}

type TabKey = 'VALIDATION' | 'CONFIG' | 'RUNNER' | 'RESULT';

export const SimulatedAnnealingModal: React.FC<SimulatedAnnealingModalProps> = ({
  isOpen,
  onClose,
  term,
  offerings,
  rooms,
  timeSlots,
  availabilities,
  lecturers,
  currentVersionId,
  onApplySolution,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('VALIDATION');

  // SA Configuration state
  const [config, setConfig] = useState<SAConfig>({
    initialTemperature: 100,
    coolingRate: 0.98,
    minTemperature: 0.01,
    maxIterations: 2000,
    seed: 42,
    weights: { ...DEFAULT_WEIGHTS },
    allowEarlyExitOnZeroHard: false,
  });

  // Runner state
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const engineRef = useRef<SimulatedAnnealingEngine | null>(null);

  // Pre-flight Validation
  const validationResult = useMemo(() => {
    return validateOptimizationReadiness(offerings, rooms, timeSlots);
  }, [offerings, rooms, timeSlots]);

  // Clean problem data
  const problemData: ProblemData = useMemo(() => {
    const schedulable = extractSchedulableOfferings(offerings);
    return {
      offerings: schedulable,
      rooms,
      timeSlots,
      availabilities,
      lecturers,
    };
  }, [offerings, rooms, timeSlots, availabilities, lecturers]);

  // Reset or init on open
  useEffect(() => {
    if (isOpen) {
      if (validationResult.isReady) {
        setActiveTab('VALIDATION');
      } else {
        setActiveTab('VALIDATION');
      }
    }
  }, [isOpen, validationResult.isReady]);

  // Handle start SA
  const handleStartSA = async () => {
    if (!validationResult.isReady) {
      toast.error('Data belum siap untuk optimasi.');
      return;
    }

    try {
      const engine = new SimulatedAnnealingEngine(problemData, config);
      engineRef.current = engine;

      setIsRunning(true);
      setIsPaused(false);
      setProgress(null);
      setResult(null);

      engine.onProgress((prog) => {
        setProgress(prog);
        setIsRunning(prog.status === 'RUNNING');
        setIsPaused(prog.status === 'PAUSED');
      });

      const res = await engine.start();
      setResult(res);
      setIsRunning(false);
      setIsPaused(false);

      // Record to optimization_runs in Supabase
      if (term?.id && currentVersionId) {
        optimizerService.recordRun(term.id, currentVersionId, res, config).catch((err) => {
          console.warn('Could not record optimization run:', err);
        });
      }

      if (res.success) {
        toast.success('Simulated Annealing selesai! Solusi bebas dari seluruh hard conflict.');
      } else {
        toast.info(
          `Simulated Annealing selesai dengan ${res.bestCostBreakdown.hardViolationsCount} potensi konflik tersisa.`
        );
      }
    } catch (err: any) {
      console.error('SA Execution Error:', err);
      toast.error(err.message || 'Terjadi kesalahan saat menjalankan Simulated Annealing.');
      setIsRunning(false);
      setIsPaused(false);
    }
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pause();
    }
  };

  const handleResume = () => {
    if (engineRef.current) {
      engineRef.current.resume();
    }
  };

  const handleStop = () => {
    if (engineRef.current) {
      engineRef.current.stop();
    }
  };

  // Convert best solution assignments to ScheduleEntry array and apply
  const handleApplyToDraft = () => {
    if (!result || !result.bestSolution) {
      toast.error('Solusi optimasi belum tersedia.');
      return;
    }

    const roomsMap = new Map<string, Room>();
    rooms.forEach((r) => roomsMap.set(r.id, r));

    const offeringsMap = new Map<string, CourseOffering>();
    offerings.forEach((o) => offeringsMap.set(o.id, o));

    const newEntries: ScheduleEntry[] = result.bestSolution.map((assignment) => {
      const off = offeringsMap.get(assignment.courseOfferingId);
      const room = roomsMap.get(assignment.roomId);
      const sks = off?.course?.effective_sks || off?.effective_sks || 2;
      const endMinute = assignment.startMinute + sks * 50;
      const dayName = dayOfWeekToName(assignment.dayOfWeek);

      const lecturerNames: string[] =
        off?.course_offering_lecturers
          ?.map((l) => l.lecturer?.name)
          .filter((name): name is string => Boolean(name)) || [];

      const lecturerIds =
        off?.course_offering_lecturers?.map((l) => l.lecturer_id) || [];

      return {
        id: `sa-entry-${assignment.courseOfferingId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        schedule_version_id: currentVersionId,
        course_offering_id: assignment.courseOfferingId,
        room_id: assignment.roomId,
        day_of_week: assignment.dayOfWeek,
        start_minute: assignment.startMinute,
        end_minute: endMinute,
        day: dayName,
        start_time: minuteToTime(assignment.startMinute),
        end_time: minuteToTime(endMinute),
        course_name: off?.course?.name || undefined,
        course_code: off?.course?.code || undefined,
        class_code: off?.class_code || 'A',
        student_count: off?.expected_students || 0,
        room_capacity: room?.capacity || 0,
        lecturer_ids: lecturerIds,
        lecturer_names: lecturerNames,
        course_offering: off || null,
        room: room || null,
      };
    });

    onApplySolution(newEntries);
    onClose();
    toast.success(
      `Solusi optimasi (${newEntries.length} kelas) berhasil diterapkan ke draft jadwal perkuliahan.`
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Mesin Optimasi Jadwal (Simulated Annealing)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Phase 4 Engine
                </span>
              </div>
              <p className="text-2xs text-slate-300">
                Penyusunan jadwal otomatis berbasis metaheuristik untuk Jurusan Teknik Elektro UNRAM
                {term ? ` — Periode ${term.academic_year || term.year}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/70 overflow-x-auto shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('VALIDATION')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'VALIDATION'
                ? 'bg-white text-blue-700 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            1. Validasi Kesiapan
          </button>

          <button
            type="button"
            disabled={!validationResult.isReady}
            onClick={() => setActiveTab('CONFIG')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'CONFIG'
                ? 'bg-white text-blue-700 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            2. Parameter &amp; Bobot
          </button>

          <button
            type="button"
            disabled={!validationResult.isReady}
            onClick={() => setActiveTab('RUNNER')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'RUNNER'
                ? 'bg-white text-blue-700 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            3. Eksekusi SA
          </button>

          <button
            type="button"
            disabled={!result}
            onClick={() => setActiveTab('RESULT')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'RESULT'
                ? 'bg-white text-emerald-700 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            4. Hasil &amp; Evaluasi
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {activeTab === 'VALIDATION' && (
            <SAPreValidationTab
              validation={validationResult}
              onRefresh={() => {
                toast.success('Data validasi diperbarui.');
              }}
              onProceed={() => setActiveTab('CONFIG')}
            />
          )}

          {activeTab === 'CONFIG' && (
            <SAConfigTab
              config={config}
              onChangeConfig={setConfig}
              onProceed={() => {
                setActiveTab('RUNNER');
                // Auto trigger SA on proceed to runner
                setTimeout(() => handleStartSA(), 50);
              }}
              onBack={() => setActiveTab('VALIDATION')}
            />
          )}

          {activeTab === 'RUNNER' && (
            <SARunnerTab
              progress={progress}
              isRunning={isRunning}
              isPaused={isPaused}
              onStart={handleStartSA}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
              onViewResults={() => setActiveTab('RESULT')}
            />
          )}

          {activeTab === 'RESULT' && (
            <SAResultTab
              result={result}
              onApplyToDraft={handleApplyToDraft}
            />
          )}
        </div>
      </div>
    </div>
  );
};
