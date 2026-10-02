import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Search,
  Filter,
  LayoutGrid,
  List,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DoorOpen,
  Users,
  RotateCcw,
  Flame,
  Check,
  Loader2,
} from 'lucide-react';
import {
  InitialScheduleEntry,
  InitialScheduleConflict,
} from '../../../services/schedulingInitial.service';
import { Room, TimeSlot, LecturerAvailability } from '../../../types';
import { SimulatedAnnealingEngine } from '../../../optimization/simulatedAnnealing/annealing';
import { SA_DEFAULT_CONFIG } from '../../../optimization/simulatedAnnealing/config';
import { SAConfig, SAResult, SACostBreakdown } from '../../../optimization/simulatedAnnealing/types';
import { schedulingOptimizationService } from '../../../services/schedulingOptimization.service';
import { cn, sortScheduleEntries, minuteToTime } from '../../../lib/utils';
import { toast } from '../../ui/Toast';
import { AppleWeeklyCalendar } from '../../schedule/AppleWeeklyCalendar';
import { AppleScheduleCardData } from '../../schedule/AppleScheduleCard';

interface SchedulingUnifiedStep2Props {
  entries: InitialScheduleEntry[];
  conflicts: InitialScheduleConflict[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  selectedSemesterType: 'GANJIL' | 'GENAP';
  onOptimizedSuccess: (optimizedEntries: InitialScheduleEntry[], meta: any) => Promise<void>;
  onBackToStep1: () => void;
  onContinueToStep3: () => void;
  saving?: boolean;
}

export const SchedulingUnifiedStep2: React.FC<SchedulingUnifiedStep2Props> = ({
  entries,
  conflicts: initialConflictsProp,
  rooms,
  timeSlots,
  availabilities,
  selectedSemesterType,
  onOptimizedSuccess,
  onBackToStep1,
  onContinueToStep3,
  saving = false,
}) => {
  // Current active entries (initial or optimized)
  const [currentEntries, setCurrentEntries] = useState<InitialScheduleEntry[]>(entries);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [hasOptimized, setHasOptimized] = useState<boolean>(false);

  // SA summary metrics
  const [saSummary, setSaSummary] = useState<{
    initialConflicts: number;
    bestConflicts: number;
    initialCost: number;
    bestCost: number;
    iterations: number;
    executionTimeMs: number;
  } | null>(null);

  // View mode: Table vs Matrix (Weekly calendar)
  const [viewMode, setViewMode] = useState<'TABLE' | 'GRID'>('TABLE');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'ALL'>('ALL');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string | 'ALL'>('ALL');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<number | 'ALL'>('ALL');
  const [conflictFilter, setConflictFilter] = useState<'ALL' | 'CONFLICT_ONLY' | 'CLEAN_ONLY'>('ALL');

  useEffect(() => {
    setCurrentEntries(entries);
  }, [entries]);

  // Determine active profile from timeSlots or entries
  const isRamadanMode = useMemo(() => {
    return (
      timeSlots.some((s) => s.duration_minutes === 40 || s.start_minute === 480) ||
      entries.some((e: any) => e.minutes_per_session === 40)
    );
  }, [timeSlots, entries]);

  const activeMinutesPerSks = isRamadanMode ? 40 : 50;

  // Set of conflicted offering IDs
  const conflictedOfferingIds = useMemo(() => {
    const set = new Set<string>();
    currentEntries.forEach((e) => {
      if (e.conflicts && e.conflicts.length > 0) {
        set.add(e.courseOfferingId);
      }
    });
    initialConflictsProp.forEach((c) => {
      if (Array.isArray(c.offeringIds)) {
        c.offeringIds.forEach((id) => set.add(id));
      }
    });
    return set;
  }, [currentEntries, initialConflictsProp]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let list = currentEntries.filter((entry) => {
      if (selectedDayFilter !== 'ALL' && entry.dayOfWeek !== selectedDayFilter) {
        return false;
      }
      if (selectedRoomFilter !== 'ALL' && entry.roomId !== selectedRoomFilter) {
        return false;
      }
      if (selectedSemesterFilter !== 'ALL' && entry.offering.semester !== selectedSemesterFilter) {
        return false;
      }
      const hasConflict = conflictedOfferingIds.has(entry.courseOfferingId);
      if (conflictFilter === 'CONFLICT_ONLY' && !hasConflict) {
        return false;
      }
      if (conflictFilter === 'CLEAN_ONLY' && hasConflict) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCourseName = entry.offering.courseName.toLowerCase().includes(q);
        const matchCourseCode = entry.offering.courseCode.toLowerCase().includes(q);
        const matchClass = entry.offering.classCode.toLowerCase().includes(q);
        const matchLecturer = entry.offering.primaryLecturerName.toLowerCase().includes(q);
        const matchRoom =
          entry.roomCode.toLowerCase().includes(q) || entry.roomName.toLowerCase().includes(q);
        return matchCourseName || matchCourseCode || matchClass || matchLecturer || matchRoom;
      }
      return true;
    });

    return sortScheduleEntries(list);
  }, [
    currentEntries,
    conflictedOfferingIds,
    selectedDayFilter,
    selectedRoomFilter,
    selectedSemesterFilter,
    conflictFilter,
    searchQuery,
  ]);

  // Convert to AppleScheduleCardData for Matrix View
  const calendarEntries = useMemo<AppleScheduleCardData[]>(() => {
    return filteredEntries.map((entry) => ({
      id: entry.courseOfferingId,
      course_name: entry.offering.courseName,
      course_code: entry.offering.courseCode,
      class_name: entry.offering.classCode,
      start_time: entry.startTime,
      end_time: entry.endTime,
      room_name: entry.roomName || entry.roomCode,
      room_code: entry.roomCode,
      lecturer_names: entry.offering.primaryLecturerName,
      sks: entry.offering.effectiveSks,
      isConflict: conflictedOfferingIds.has(entry.courseOfferingId),
      conflictReason: entry.conflicts?.[0]?.title || entry.conflicts?.[0]?.description || 'Bentrok Terdeteksi',
      raw: {
        ...entry,
        day_of_week: entry.dayOfWeek,
        start_minute: entry.startMinute,
        end_minute: entry.endMinute,
      },
    }));
  }, [filteredEntries, conflictedOfferingIds]);

  // Execute Simulated Annealing Optimization
  const handleRunSimulatedAnnealing = async () => {
    if (entries.length === 0) {
      toast.error('Tidak ada kelas untuk dioptimalkan.');
      return;
    }

    setIsOptimizing(true);
    toast.info('Memulai optimasi Simulated Annealing...');

    // Allow UI to render the loading state
    setTimeout(() => {
      try {
        const problemContext = schedulingOptimizationService.prepareProblemData(
          entries,
          rooms,
          timeSlots,
          availabilities,
          activeMinutesPerSks
        );

        const config: SAConfig = {
          ...SA_DEFAULT_CONFIG,
          maxIterations: 8000,
          initialTemperature: 100,
          coolingRate: 0.995,
          seed: 42,
        };

        const engine = new SimulatedAnnealingEngine(
          problemContext.problem,
          problemContext.initialSolution,
          config
        );

        const initialCost = (engine as any).initialCost as SACostBreakdown;
        const result: SAResult = engine.run();

        // Map solution back to InitialScheduleEntry[]
        const optimizedList = schedulingOptimizationService.mergeSolutionToEntries(
          result.bestSolution,
          entries,
          rooms,
          activeMinutesPerSks
        );

        setCurrentEntries(optimizedList);
        setHasOptimized(true);

        const summary = {
          initialConflicts: initialCost?.hardConflictsCount ?? 0,
          bestConflicts: (result.bestCost || (result as any).bestCostBreakdown)?.hardConflictsCount ?? 0,
          initialCost: Math.round(initialCost?.totalCost ?? 0),
          bestCost: Math.round((result.bestCost || (result as any).bestCostBreakdown)?.totalCost ?? 0),
          iterations: result.iterations,
          executionTimeMs: result.executionTimeMs,
        };

        setSaSummary(summary);

        if (summary.bestConflicts === 0) {
          toast.success('Optimasi selesai: Seluruh konflik berhasil dieliminasi (0 Bentrok)!');
        } else {
          toast.info(
            `Optimasi selesai: Bentrok berkurang dari ${summary.initialConflicts} menjadi ${summary.bestConflicts}.`
          );
        }
      } catch (err: any) {
        console.error('SA Optimization Error:', err);
        toast.error('Terjadi kendala saat menjalankan Simulated Annealing.');
      } finally {
        setIsOptimizing(false);
      }
    }, 100);
  };

  // Reset to initial schedule
  const handleResetToInitial = () => {
    setCurrentEntries(entries);
    setHasOptimized(false);
    setSaSummary(null);
    toast.info('Jadwal dikembalikan ke kondisi awal sebelum optimasi.');
  };

  // Confirm and proceed with optimized schedule
  const handleUseOptimizedSchedule = async () => {
    await onOptimizedSuccess(currentEntries, saSummary);
    onContinueToStep3();
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Toolbar & Action Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Jadwal Awal & Optimasi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tinjau jadwal awal yang dibentuk oleh sistem, periksa konflik, dan jalankan optimasi metaheuristik Simulated Annealing.
            </p>
          </div>

          {/* Primary Action Button: Optimalkan dengan SA */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {hasOptimized && (
              <button
                type="button"
                onClick={handleResetToInitial}
                disabled={isOptimizing}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                title="Kembalikan ke Jadwal Awal"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Awal</span>
              </button>
            )}

            <button
              type="button"
              disabled={isOptimizing}
              onClick={handleRunSimulatedAnnealing}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer',
                isOptimizing
                  ? 'bg-blue-400 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-98 shadow-blue-500/20'
              )}
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengoptimalkan dengan SA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{hasOptimized ? 'Optimasi Ulang SA' : 'Optimalkan dengan Simulated Annealing'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Ringkasan Hasil Optimasi SA (Hanya tampil setelah SA selesai) */}
        {saSummary && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Ringkasan Hasil Optimasi Simulated Annealing
              </span>
              <span className="text-3xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                Reproducible Seed 42
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 text-xs">
              <div className="bg-white/80 rounded-lg p-2.5 border border-emerald-100 text-center">
                <span className="text-3xs text-slate-500 font-semibold block uppercase">Konflik Sebelum</span>
                <span className="text-sm font-bold text-rose-600">{saSummary.initialConflicts}</span>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 border border-emerald-100 text-center">
                <span className="text-3xs text-slate-500 font-semibold block uppercase">Konflik Sesudah</span>
                <span className="text-sm font-bold text-emerald-700">
                  {saSummary.bestConflicts === 0 ? '0 (Bebas Bentrok)' : saSummary.bestConflicts}
                </span>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 border border-emerald-100 text-center">
                <span className="text-3xs text-slate-500 font-semibold block uppercase">Objective Value</span>
                <span className="text-sm font-bold text-slate-800">{saSummary.bestCost.toLocaleString()}</span>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 border border-emerald-100 text-center">
                <span className="text-3xs text-slate-500 font-semibold block uppercase">Iterasi</span>
                <span className="text-sm font-bold text-slate-800">{saSummary.iterations.toLocaleString()}</span>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 border border-emerald-100 text-center col-span-2 sm:col-span-1">
                <span className="text-3xs text-slate-500 font-semibold block uppercase">Waktu Proses</span>
                <span className="text-sm font-bold text-slate-800">
                  {(saSummary.executionTimeMs / 1000).toFixed(2)} detik
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Filter & View Mode Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari mata kuliah, dosen, atau ruangan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('TABLE')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  viewMode === 'TABLE'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <List className="w-3.5 h-3.5" />
                <span>Tabel</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  viewMode === 'GRID'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Matriks</span>
              </button>
            </div>

            {/* Day Filter */}
            <select
              value={selectedDayFilter}
              onChange={(e) =>
                setSelectedDayFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
              }
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            >
              <option value="ALL">Semua Hari</option>
              <option value={1}>Senin</option>
              <option value={2}>Selasa</option>
              <option value={3}>Rabu</option>
              <option value={4}>Kamis</option>
              <option value={5}>Jumat</option>
            </select>

            {/* Room Filter */}
            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            >
              <option value="ALL">Semua Ruangan</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code || r.name}
                </option>
              ))}
            </select>

            {/* Conflict Filter */}
            <select
              value={conflictFilter}
              onChange={(e) => setConflictFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            >
              <option value="ALL">Semua Status</option>
              <option value="CONFLICT_ONLY">Hanya Bentrok</option>
              <option value="CLEAN_ONLY">Bebas Bentrok</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Content: Table or Matrix View with Direct Conflict Indicators */}
      {viewMode === 'TABLE' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Hari & Waktu</th>
                  <th className="py-3 px-4">Mata Kuliah</th>
                  <th className="py-3 px-3 text-center">Kelas</th>
                  <th className="py-3 px-3 text-center">SKS</th>
                  <th className="py-3 px-4">Ruangan</th>
                  <th className="py-3 px-4">Dosen Pengampu</th>
                  <th className="py-3 px-4 text-center">Status / Konflik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Tidak ada kelas yang memenuhi kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry, idx) => {
                    const hasConflict = conflictedOfferingIds.has(entry.courseOfferingId);
                    const conflictDesc =
                      entry.conflicts?.[0]?.title ||
                      entry.conflicts?.[0]?.description ||
                      'Bentrok penempatan ruangan / jam mengajar';

                    return (
                      <tr
                        key={entry.courseOfferingId}
                        className={cn(
                          'hover:bg-slate-50/80 transition-colors',
                          hasConflict && 'bg-rose-50/30'
                        )}
                      >
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{entry.dayName}</p>
                          <span className="font-mono text-2xs text-slate-500">
                            {entry.startTime} – {entry.endTime}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 leading-snug">
                            {entry.offering.courseName}
                          </p>
                          <span className="font-mono text-2xs text-slate-400">
                            {entry.offering.courseCode} • Sem {entry.offering.semester}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded font-bold text-2xs bg-blue-100 text-blue-800">
                            {entry.offering.classCode}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">
                          {entry.offering.effectiveSks}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {entry.roomCode || entry.roomName}
                          <span className="text-3xs text-slate-400 block font-normal">
                            Kapasitas: {entry.roomCapacity} kursi
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {entry.offering.primaryLecturerName}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {hasConflict ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-rose-100 text-rose-800 border border-rose-200"
                              title={conflictDesc}
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span className="truncate max-w-[140px]">{conflictDesc}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Feasible</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <AppleWeeklyCalendar
            entries={calendarEntries}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>
      )}

      {/* 5. Sticky Bottom Action Bar */}
      <div className="sticky bottom-4 z-20">
        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left: Summary */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border',
                  conflictedOfferingIds.size === 0
                    ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-600/30 text-amber-400 border-amber-500/30'
                )}
              >
                {conflictedOfferingIds.size === 0 ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  {currentEntries.length} Kelas Terjadwal •{' '}
                  {conflictedOfferingIds.size === 0
                    ? '0 Bentrok Keras (Bebas Konflik)'
                    : `${conflictedOfferingIds.size} Kelas Mengalami Bentrok`}
                </p>
                <p className="text-3xs text-slate-400 mt-0.5">
                  {hasOptimized
                    ? 'Hasil optimasi Simulated Annealing siap diterapkan ke draf jadwal.'
                    : 'Klik "Optimalkan dengan Simulated Annealing" untuk mengeliminasi bentrok otomatis.'}
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onBackToStep1}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Tahap 1</span>
              </button>

              {hasOptimized ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleUseOptimizedSchedule}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Menerapkan...' : 'Gunakan Hasil Optimasi'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onContinueToStep3}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs shadow-blue-500/25 transition-all cursor-pointer"
                >
                  <span>Lanjut ke Hasil Jadwal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
