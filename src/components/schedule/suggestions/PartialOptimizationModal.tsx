import React, { useState, useMemo } from 'react';
import {
  ScheduleEntry,
  Room,
  TimeSlot,
  LecturerAvailability,
  CourseOffering,
  Lecturer,
} from '../../../types';
import { runPartialOptimization } from '../../../scheduling/suggestions/partialOptimizer';
import { PartialOptimizationResult } from '../../../scheduling/suggestions/types';
import { detectAllScheduleConflicts, ClientConflict } from '../../../lib/scheduleValidator';
import {
  Lock,
  Unlock,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  Search,
  Sliders,
  ArrowRight,
  ShieldCheck,
  History,
} from 'lucide-react';
import { toast } from '../../ui/Toast';

interface PartialOptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionId: string;
  currentEntries: ScheduleEntry[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  offerings: CourseOffering[];
  lecturers: Lecturer[];
  onApplyResult: (optimizedEntries: ScheduleEntry[]) => void;
}

export const PartialOptimizationModal: React.FC<PartialOptimizationModalProps> = ({
  isOpen,
  onClose,
  versionId,
  currentEntries,
  rooms,
  timeSlots,
  availabilities,
  offerings,
  lecturers,
  onApplyResult,
}) => {
  // Identify entries that currently have conflicts
  const currentConflicts: ClientConflict[] = useMemo(() => {
    return detectAllScheduleConflicts(currentEntries, rooms, availabilities);
  }, [currentEntries, rooms, availabilities]);

  const conflictedEntryIdSet = useMemo(() => {
    const set = new Set<string>();
    currentConflicts.forEach((c) => {
      c.entryIds.forEach((id) => set.add(id));
      c.courseOfferingIds.forEach((offId) => {
        const matching = currentEntries.find((e) => e.course_offering_id === offId);
        if (matching) set.add(matching.id);
      });
    });
    return set;
  }, [currentConflicts, currentEntries]);

  // Locked entries state - by default, lock non-conflicted entries, unlock conflicted entries
  const [lockedEntryIds, setLockedEntryIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    currentEntries.forEach((e) => {
      if (!conflictedEntryIdSet.has(e.id)) {
        set.add(e.id);
      }
    });
    return set;
  });

  // Filters
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');

  // Config parameters
  const [maxIterations, setMaxIterations] = useState<number>(1500);
  const [initialTemp, setInitialTemp] = useState<number>(80);
  const [coolingRate, setCoolingRate] = useState<number>(0.975);
  const [seed, setSeed] = useState<number>(42);

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    iteration: number;
    totalIterations: number;
    currentConflicts: number;
    temperature: number;
  } | null>(null);
  const [result, setResult] = useState<PartialOptimizationResult | null>(null);

  if (!isOpen) return null;

  // Toggle single lock
  const handleToggleLock = (id: string) => {
    setLockedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Lock / Unlock helpers
  const handleLockAll = () => {
    setLockedEntryIds(new Set(currentEntries.map((e) => e.id)));
  };

  const handleUnlockAll = () => {
    setLockedEntryIds(new Set());
  };

  const handleUnlockConflictedOnly = () => {
    const next = new Set<string>();
    currentEntries.forEach((e) => {
      if (!conflictedEntryIdSet.has(e.id)) {
        next.add(e.id);
      }
    });
    setLockedEntryIds(next);
  };

  // Run optimization
  const handleRun = async () => {
    const unlockedCount = currentEntries.length - lockedEntryIds.size;
    if (unlockedCount === 0) {
      toast.error('Semua jadwal terkunci. Buka minimal satu kelas untuk dioptimasi.');
      return;
    }

    setIsRunning(true);
    setProgress({
      iteration: 0,
      totalIterations: maxIterations,
      currentConflicts: currentConflicts.length,
      temperature: initialTemp,
    });
    setResult(null);

    try {
      const res = await runPartialOptimization(
        {
          versionId,
          currentEntries,
          lockedEntryIds: Array.from(lockedEntryIds),
          rooms,
          timeSlots,
          availabilities,
          offerings,
          lecturers,
          maxIterations,
          initialTemperature: initialTemp,
          coolingRate,
          seed,
        },
        (prog) => setProgress(prog)
      );

      setResult(res);
      if (res.finalConflictsCount === 0) {
        toast.success(`Optimasi parsial berhasil! Seluruh konflik (${res.initialConflictsCount}) terselesaikan.`);
      } else if (res.finalConflictsCount < res.initialConflictsCount) {
        toast.success(`Optimasi parsial mereduksi konflik dari ${res.initialConflictsCount} menjadi ${res.finalConflictsCount}.`);
      } else {
        toast.info('Optimasi parsial selesai dievaluasi.');
      }
    } catch (err: any) {
      console.error('Partial optimization error:', err);
      toast.error(err.message || 'Gagal menjalankan optimasi parsial.');
    } finally {
      setIsRunning(false);
    }
  };

  // Apply result to draft
  const handleApply = () => {
    if (!result) return;
    onApplyResult(result.optimizedEntries);
    toast.success('Hasil optimasi parsial telah diterapkan ke rancangan jadwal.');
    onClose();
  };

  // Filter entries for list
  const filteredEntries = currentEntries.filter((e) => {
    const offering = offerings.find((o) => o.id === e.course_offering_id) || e.course_offering;
    const course = offering?.course;
    const semester = course?.semester;

    if (semesterFilter !== 'all' && semester !== Number(semesterFilter)) {
      return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = (e.course_name || course?.name || '').toLowerCase().includes(q);
      const matchCode = (e.course_code || course?.code || '').toLowerCase().includes(q);
      const matchRoom = (e.room?.name || e.room?.code || '').toLowerCase().includes(q);
      return matchName || matchCode || matchRoom;
    }

    return true;
  });

  const unlockedCount = currentEntries.length - lockedEntryIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Optimasi Parsial (Partial Re-Optimization)
              </h3>
              <p className="text-2xs text-slate-500">
                Kunci jadwal yang sudah pasti dan optimalkan ulang hanya kelas yang mengalami bentrok
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Quick Lock Controls Bar */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-slate-700">Status Kunci:</span>
              <span className="px-2.5 py-1 rounded-full text-2xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                <Lock className="w-3 h-3 text-indigo-600" />
                {lockedEntryIds.size} Terkunci
              </span>
              <span className="px-2.5 py-1 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Unlock className="w-3 h-3 text-amber-600" />
                {unlockedCount} Terbuka (Akan Dioptimasi)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleUnlockConflictedOnly}
                className="px-2.5 py-1.5 text-2xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              >
                Buka yang Bentrok Saja
              </button>
              <button
                type="button"
                onClick={handleLockAll}
                className="px-2.5 py-1.5 text-2xs font-semibold text-slate-600 hover:bg-slate-200/60 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Kunci Semua
              </button>
              <button
                type="button"
                onClick={handleUnlockAll}
                className="px-2.5 py-1.5 text-2xs font-semibold text-slate-600 hover:bg-slate-200/60 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Buka Semua
              </button>
            </div>
          </div>

          {/* Running Progress Bar */}
          {isRunning && progress && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2 animate-pulse">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                <span className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 animate-spin text-indigo-600" />
                  Mengoptimasi {unlockedCount} kelas terbuka...
                </span>
                <span>
                  Iterasi {progress.iteration} / {progress.totalIterations}
                </span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 transition-all duration-150"
                  style={{
                    width: `${Math.round((progress.iteration / progress.totalIterations) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-3xs text-indigo-700 font-mono">
                <span>Suhu: {progress.temperature.toFixed(3)}</span>
                <span>Sisa Konflik: {progress.currentConflicts}</span>
              </div>
            </div>
          )}

          {/* Result Summary if available */}
          {result && !isRunning && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-xs font-bold text-emerald-950">
                    Hasil Optimasi Parsial Selesai
                  </h4>
                </div>
                <span className="text-3xs font-mono text-emerald-800">
                  {result.timeElapsedMs.toFixed(0)} ms • Seed: {result.seed}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-2xs">
                <div className="p-2 bg-white rounded-xl border border-emerald-200">
                  <span className="text-slate-400 block">Konflik Awal</span>
                  <strong className="text-rose-600 text-sm">{result.initialConflictsCount}</strong>
                </div>
                <div className="p-2 bg-white rounded-xl border border-emerald-200">
                  <span className="text-slate-400 block">Konflik Akhir</span>
                  <strong className="text-emerald-700 text-sm">{result.finalConflictsCount}</strong>
                </div>
                <div className="p-2 bg-white rounded-xl border border-emerald-200">
                  <span className="text-slate-400 block">Kelas Disesuaikan</span>
                  <strong className="text-indigo-700 text-sm">{result.unlockedMovedCount} Kelas</strong>
                </div>
              </div>

              {result.changelog.length > 0 && (
                <div className="space-y-1">
                  <span className="text-3xs font-bold text-emerald-900 uppercase tracking-wider block">
                    Perubahan Alokasi Jadwal ({result.changelog.length} Item):
                  </span>
                  <div className="max-h-28 overflow-y-auto p-2 bg-white rounded-xl border border-emerald-100 text-3xs space-y-1 font-mono text-slate-700">
                    {result.changelog.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari mata kuliah, ruangan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 w-56"
                />
              </div>

              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none text-slate-700"
              >
                <option value="all">Semua Semester</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-2xs text-slate-400">
              Menampilkan {filteredEntries.length} dari {currentEntries.length} kelas
            </span>
          </div>

          {/* Entries Table with Lock Toggles */}
          <div className="border border-slate-200/90 rounded-2xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-3xs">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">Kunci</th>
                  <th className="py-2.5 px-3">Mata Kuliah & Kelas</th>
                  <th className="py-2.5 px-3">Waktu Saat Ini</th>
                  <th className="py-2.5 px-3">Ruangan</th>
                  <th className="py-2.5 px-3 text-center">Status Konflik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => {
                  const isLocked = lockedEntryIds.has(entry.id);
                  const hasConflict = conflictedEntryIdSet.has(entry.id);

                  return (
                    <tr
                      key={entry.id}
                      onClick={() => handleToggleLock(entry.id)}
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                        hasConflict ? 'bg-rose-50/30' : isLocked ? 'bg-indigo-50/15' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLock(entry.id);
                          }}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isLocked
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700'
                          }`}
                        >
                          {isLocked ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{entry.course_name}</span>
                          <span className="px-1.5 py-0.2 rounded font-bold text-3xs bg-blue-50 text-blue-700 border border-blue-200">
                            {entry.class_code}
                          </span>
                        </div>
                        {entry.course_code && (
                          <span className="text-3xs font-mono text-slate-400">
                            {entry.course_code}
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-3 text-slate-700">
                        {entry.day}, {entry.start_time} – {entry.end_time}
                      </td>

                      <td className="py-2 px-3 text-slate-700">
                        {entry.room?.code || entry.room_id}
                      </td>

                      <td className="py-2 px-3 text-center">
                        {hasConflict ? (
                          <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center justify-center gap-1 w-fit mx-auto">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Bentrok
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Aman
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={isRunning}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            {result && !isRunning && (
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Terapkan Hasil ke Draft
              </button>
            )}

            <button
              type="button"
              disabled={isRunning || unlockedCount === 0}
              onClick={handleRun}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              {isRunning ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  Mengoptimasi...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Jalankan Optimasi Parsial ({unlockedCount} Kelas)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
