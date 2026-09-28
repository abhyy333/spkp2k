import React, { useState, useMemo, useRef } from 'react';
import {
  ScheduleEntry,
  CourseOffering,
  Room,
  TimeSlot,
  LecturerAvailability,
  Lecturer,
} from '../../../types';
import {
  Sparkles,
  Flame,
  Activity,
  Award,
  ArrowLeft,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  SimulatedAnnealingEngine,
  SchedulableOffering,
  ProblemData,
  SAConfig,
  OptimizationProgress,
  OptimizationResult,
} from '../../../lib/optimizer';
import { ClientConflict, detectAllScheduleConflicts } from '../../../lib/scheduleValidator';
import { toast } from '../../ui/Toast';

interface Step5SimulatedAnnealingProps {
  entries: ScheduleEntry[];
  selectedOfferings: CourseOffering[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  lecturers: Lecturer[];
  onApplyOptimizedSolution: (
    newEntries: ScheduleEntry[],
    result: OptimizationResult
  ) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}

export const Step5SimulatedAnnealing: React.FC<Step5SimulatedAnnealingProps> = ({
  entries,
  selectedOfferings,
  rooms,
  timeSlots,
  availabilities,
  lecturers,
  onApplyOptimizedSolution,
  onBack,
  onNext,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const engineRef = useRef<SimulatedAnnealingEngine | null>(null);

  // SA Configuration
  const [config] = useState<SAConfig>({
    initialTemperature: 100,
    coolingRate: 0.985,
    minTemperature: 0.01,
    maxIterations: 2000,
    seed: 42,
    allowEarlyExitOnZeroHard: true,
    weights: {
      hardRoomOverlap: 1000,
      hardLecturerOverlap: 1000,
      hardCapacity: 1000,
      hardRoomType: 1000,
      hardSlotContinuity: 1000,
      hardLecturerUnavailable: 1000,
      softLecturerPreference: 40,
      softFridayPrayer: 60,
      softLecturerDailyLoad: 25,
      softSemesterConflict: 35,
      softRoomCompactness: 10,
    },
  });

  // Convert current entries & offerings to problem data
  const problemData: ProblemData = useMemo(() => {
    const schedOfferings: SchedulableOffering[] = selectedOfferings.map((o) => {
      const col = o.course_offering_lecturers || o.lecturers || [];
      const lecIds = col.map((l) => l.lecturer_id);
      const lecNames = col.map((l) => l.lecturer?.name || 'Dosen');

      return {
        id: o.id,
        courseId: o.course_id,
        courseCode: o.course?.code || '',
        courseName: o.course?.name || 'Mata Kuliah',
        classCode: o.class_code,
        effectiveSks: o.course?.effective_sks || 2,
        expectedStudents: o.expected_students || 0,
        requiredRoomType: o.required_room_type || 'Ruang Kuliah Teori',
        semester: o.course?.semester || 1,
        lecturerIds: lecIds,
        lecturerNames: lecNames,
      };
    });

    return {
      offerings: schedOfferings,
      rooms: rooms.filter((r) => r.is_active),
      timeSlots: timeSlots.filter((s) => s.is_active),
      availabilities,
      lecturers,
    };
  }, [selectedOfferings, rooms, timeSlots, availabilities, lecturers]);

  // Current client conflicts
  const currentConflicts = useMemo(() => {
    return detectAllScheduleConflicts(entries, rooms, availabilities);
  }, [entries, rooms, availabilities]);

  const hardConflictsCount = currentConflicts.filter((c: ClientConflict) => c.severity === 'CRITICAL').length;

  const handleStartOptimization = async () => {
    if (isRunning) return;

    if (problemData.offerings.length === 0) {
      toast.error('Tidak ada mata kuliah yang terpilih untuk dioptimasi.');
      return;
    }

    setIsRunning(true);
    setProgress(null);
    setOptResult(null);

    try {
      const engine = new SimulatedAnnealingEngine(problemData, config);
      engineRef.current = engine;

      engine.onProgress((prog: OptimizationProgress) => {
        setProgress(prog);
      });

      const result = await engine.start();
      setOptResult(result);

      // Map best solution back to ScheduleEntry objects WITHOUT altering lecturers
      const offeringMap = new Map(selectedOfferings.map((o) => [o.id, o]));
      const roomMap = new Map(rooms.map((r) => [r.id, r]));

      const newEntries: ScheduleEntry[] = result.bestSolution.map((assignment) => {
        const offering = offeringMap.get(assignment.courseOfferingId);
        const room = roomMap.get(assignment.roomId);
        const sks = offering?.course?.effective_sks || 2;
        const startMin = assignment.startMinute;
        const endMin = startMin + sks * 50;

        const lecturersList =
          offering?.course_offering_lecturers || offering?.lecturers || [];
        const lecIds = lecturersList.map((l) => l.lecturer_id);
        const lecNames = lecturersList
          .map((l) => l.lecturer?.name)
          .filter((n): n is string => Boolean(n));

        return {
          id: `opt-entry-${assignment.courseOfferingId}`,
          schedule_version_id: entries[0]?.schedule_version_id || '',
          course_offering_id: assignment.courseOfferingId,
          room_id: assignment.roomId,
          day_of_week: assignment.dayOfWeek,
          start_minute: startMin,
          end_minute: endMin,
          course_name: offering?.course?.name || undefined,
          course_code: offering?.course?.code || undefined,
          class_code: offering?.class_code || 'A',
          student_count: offering?.expected_students || 0,
          room_capacity: room?.capacity || 0,
          lecturer_ids: lecIds,
          lecturer_names: lecNames,
          course_offering: offering || null,
          room: room || null,
        };
      });

      setIsApplying(true);
      await onApplyOptimizedSolution(newEntries, result);
      toast.success('Hasil optimasi Simulated Annealing berhasil diterapkan dan disimpan.');
    } catch (err: any) {
      console.error('Apply solution error:', err);
      toast.error(err.message || 'Gagal menyimpan hasil optimasi.');
    } finally {
      setIsRunning(false);
      setIsApplying(false);
    }
  };

  const handleStop = () => {
    if (engineRef.current) {
      engineRef.current.stop();
      toast.info('Permintaan penghentian optimasi dikirim...');
    }
  };

  // Safe progress percentage
  const progressPercent = progress
    ? Math.min(100, Math.round((progress.iteration / Math.max(1, progress.totalIterations)) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                5
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Engine Optimasi Simulated Annealing
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Algoritma metaheuristik probabilistik untuk mengeliminasi bentrok ruangan, dosen, kapasitas, dan preferensi waktu perkuliahan.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isRunning ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
              >
                <span>Hentikan Optimasi</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartOptimization}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{optResult ? 'Ulangi Optimasi' : 'Mulai Optimasi Simulated Annealing'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-3xs font-bold text-slate-500 uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Suhu (Temperature)
            </div>
            <p className="text-lg font-mono font-extrabold text-slate-900 mt-0.5">
              {progress ? progress.temperature.toFixed(2) : isRunning ? '100.00' : '0.00'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-3xs font-bold text-slate-500 uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              Hard Conflicts
            </div>
            <p className="text-lg font-mono font-extrabold text-rose-600 mt-0.5">
              {progress ? progress.hardViolations : hardConflictsCount}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-3xs font-bold text-slate-500 uppercase tracking-wider">
              <Award className="w-3.5 h-3.5 text-blue-500" />
              Best Cost / Penalty
            </div>
            <p className="text-lg font-mono font-extrabold text-blue-700 mt-0.5">
              {progress ? progress.bestCost.toFixed(0) : optResult ? optResult.bestCostBreakdown.totalCost.toFixed(0) : '-'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-3xs font-bold text-slate-500 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              Iterasi / Progress
            </div>
            <p className="text-lg font-mono font-extrabold text-slate-900 mt-0.5">
              {progress ? `${progress.iteration} (${progressPercent}%)` : isRunning ? 'Memulai...' : '0 / 2000'}
            </p>
          </div>
        </div>

        {/* Real-time Progress Bar */}
        {isRunning && (
          <div className="mt-3.5 space-y-1">
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-3xs text-slate-400 font-semibold">
              <span>Iterasi: {progress?.iteration || 0} / {config.maxIterations}</span>
              <span>Acceptance Rate: {((progress?.acceptanceRate || 0) * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Optimization Result Banner */}
      {optResult && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
            optResult.bestCostBreakdown.hardViolationsCount === 0
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : 'bg-amber-50/80 border-amber-300 text-amber-950'
          }`}
        >
          {optResult.bestCostBreakdown.hardViolationsCount === 0 ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          )}

          <div className="space-y-1">
            <h4 className="text-sm font-bold">
              {optResult.bestCostBreakdown.hardViolationsCount === 0
                ? 'Feasible — 0 Konflik (Solusi Layak Ditemukan)'
                : `Hasil Terbaik — ${optResult.bestCostBreakdown.hardViolationsCount} Konflik Tersisa`}
            </h4>
            <p className="text-xs opacity-90 leading-relaxed">
              Optimasi selesai dalam {(optResult.timeElapsedMs / 1000).toFixed(2)} detik ({optResult.totalIterations} iterasi).
              Hard Penalty: {optResult.bestCostBreakdown.hardCost} | Soft Penalty: {optResult.bestCostBreakdown.softCost.toFixed(0)}.
              {optResult.bestCostBreakdown.hardViolationsCount === 0
                ? ' Semua kelas telah ditempatkan tanpa bentrok ruangan maupun bentrok dosen.'
                : ' Beberapa bentrok masih tersisa karena keterbatasan ruangan atau ketersediaan dosen.'}
            </p>
          </div>
        </div>
      )}

      {/* Constraints Explanation Info */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Info className="w-4 h-4 text-blue-600" />
          Aturan Batasan Evaluasi (Constraints Evaluation)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-2xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <span className="font-bold text-rose-700 block">Batasan Keras (Hard Constraints):</span>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>Tidak ada bentrok ruangan (2 kelas di ruang & waktu sama).</li>
              <li>Tidak ada bentrok dosen (1 dosen mengajar 2 kelas bersamaan).</li>
              <li>Kapasitas ruangan mencukupi (Kapasitas &ge; Peserta).</li>
              <li>Kesesuaian tipe ruangan (Praktikum di Lab, Teori di Ruang Kuliah).</li>
              <li>Dosen tidak dijadwalkan pada waktu yang dinyatakan tidak bersedia.</li>
            </ul>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <span className="font-bold text-blue-700 block">Batasan Lunak (Soft Constraints):</span>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>Menghindari waktu istirahat Sholat Jumat (11:30 – 13:00 WITA).</li>
              <li>Memperhatikan preferensi waktu luang dosen.</li>
              <li>Meratakan beban harian dosen (maksimal 3 sesi per hari).</li>
              <li>Menghindari tabrakan mata kuliah pada semester yang sama.</li>
              <li>Kesesuaian efisiensi kapasitas ruangan (compactness).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Jadwal Awal</span>
        </button>

        <button
          type="button"
          disabled={isRunning || isApplying}
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <span>Lanjut ke Preview & Publikasi</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
