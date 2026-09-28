import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
  ArrowLeft,
  ArrowRight,
  Search,
  Filter,
  Layers,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  DoorOpen,
  Info,
  ShieldAlert,
  Flame,
  Sparkles,
  Lock,
} from 'lucide-react';
import {
  InitialScheduleEntry,
  InitialScheduleConflict,
  InitialScheduleStats,
} from '../../../services/schedulingInitial.service';
import { Room } from '../../../types';
import { cn } from '../../../lib/utils';
import { toast } from '../../ui/Toast';
import { AppleWeeklyCalendar } from '../../schedule/AppleWeeklyCalendar';
import { AppleScheduleCardData } from '../../schedule/AppleScheduleCard';

interface SchedulingInitialScheduleViewProps {
  entries: InitialScheduleEntry[];
  conflicts: InitialScheduleConflict[];
  stats: InitialScheduleStats;
  rooms: Room[];
  selectedSemesterType: 'GANJIL' | 'GENAP';
  generating: boolean;
  saving: boolean;
  onRegenerate: () => Promise<void>;
  onSaveInitialSchedule: () => Promise<void>;
  onBackToStep3: () => void;
  onContinueToStep5?: () => void;
}

export const SchedulingInitialScheduleView: React.FC<SchedulingInitialScheduleViewProps> = ({
  entries,
  conflicts,
  stats,
  rooms,
  selectedSemesterType,
  generating,
  saving,
  onRegenerate,
  onSaveInitialSchedule,
  onBackToStep3,
  onContinueToStep5,
}) => {
  // View mode: Table List vs Timetable Grid (Default to GRID per Apple Calendar focus)
  const [viewMode, setViewMode] = useState<'TABLE' | 'GRID'>('GRID');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'ALL'>('ALL');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string | 'ALL'>('ALL');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<number | 'ALL'>('ALL');
  const [conflictFilter, setConflictFilter] = useState<'ALL' | 'CONFLICT_ONLY' | 'CLEAN_ONLY'>('ALL');

  // Selected entry for detail preview modal/drawer
  const [selectedEntry, setSelectedEntry] = useState<InitialScheduleEntry | null>(null);
  const [showConflictPanel, setShowConflictPanel] = useState<boolean>(conflicts.length > 0);

  const availableSemesters = useMemo(() => {
    return selectedSemesterType === 'GANJIL' ? [1, 3, 5, 7] : [2, 4, 6, 8];
  }, [selectedSemesterType]);

  const daysList = [
    { num: 1, name: 'Senin' },
    { num: 2, name: 'Selasa' },
    { num: 3, name: 'Rabu' },
    { num: 4, name: 'Kamis' },
    { num: 5, name: 'Jumat' },
  ];

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Day filter
      if (selectedDayFilter !== 'ALL' && entry.dayOfWeek !== selectedDayFilter) {
        return false;
      }

      // Room filter
      if (selectedRoomFilter !== 'ALL' && entry.roomId !== selectedRoomFilter) {
        return false;
      }

      // Semester filter
      if (selectedSemesterFilter !== 'ALL' && entry.offering.semester !== selectedSemesterFilter) {
        return false;
      }

      // Conflict filter
      if (conflictFilter === 'CONFLICT_ONLY' && entry.conflicts.length === 0) {
        return false;
      }
      if (conflictFilter === 'CLEAN_ONLY' && entry.conflicts.length > 0) {
        return false;
      }

      // Search query
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
  }, [
    entries,
    selectedDayFilter,
    selectedRoomFilter,
    selectedSemesterFilter,
    conflictFilter,
    searchQuery,
  ]);

  // Group entries by Day for Grid View
  const entriesByDay = useMemo(() => {
    const map = new Map<number, InitialScheduleEntry[]>();
    for (const d of daysList) {
      map.set(d.num, []);
    }
    filteredEntries.forEach((e) => {
      const arr = map.get(e.dayOfWeek) || [];
      arr.push(e);
      map.set(e.dayOfWeek, arr);
    });
    // Sort each day's entries by startMinute ascending
    map.forEach((list) => {
      list.sort((a, b) => a.startMinute - b.startMinute || a.roomCode.localeCompare(b.roomCode));
    });
    return map;
  }, [filteredEntries]);

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
      conflictReason: e.conflicts[0]?.title || 'Bentrok Terdeteksi',
      raw: {
        ...e,
        day_of_week: e.dayOfWeek,
        start_minute: e.startMinute,
        end_minute: e.endMinute,
      },
    }));
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                <Calendar className="w-3.5 h-3.5" />
                Tahap 4
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Penyusunan Jadwal • Semester {selectedSemesterType}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Generate Jadwal Awal (Initial Schedule)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-3xl leading-relaxed">
              Penempatan otomatis mata kuliah ke dalam sesi waktu aktif dan ruangan kelas berdasarkan data tervalidasi dari Tahap 1–3. Jadwal awal ini menjadi basis solusi yang akan dioptimasi pada Tahap 5 menggunakan Simulated Annealing.
            </p>
          </div>

          {/* Quick Badges */}
          <div className="flex flex-wrap lg:flex-col items-start lg:items-end gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              1 Dosen Pengampu / Kelas
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
              <DoorOpen className="w-3 h-3 text-slate-500" />
              Praktikum & KKN Dikecualikan
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Clock className="w-3 h-3 text-blue-600" />
              Slot 50m / SKS (Gap-Aware)
            </span>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Classes Placed */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Kelas Terjadwal</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{stats.scheduledCount}</span>
            <span className="text-xs font-semibold text-slate-400">/ {stats.totalOfferings}</span>
          </div>
          <p className="mt-1 text-3xs font-medium text-slate-400">
            {stats.unscheduledCount === 0 ? '100% kelas telah terplot' : `${stats.unscheduledCount} kelas belum terplot`}
          </p>
        </div>

        {/* Rooms Used */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ruangan Terpakai</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DoorOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{stats.roomsUsedCount}</span>
            <span className="text-xs font-semibold text-slate-400">ruang aktif</span>
          </div>
          <p className="mt-1 text-3xs font-medium text-slate-400">
            Rata-rata sisa: ±{stats.averageSeatWaste} kursi/ruang
          </p>
        </div>

        {/* Total SKS Placed */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Beban SKS</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{stats.totalSks}</span>
            <span className="text-xs font-semibold text-slate-400">SKS</span>
          </div>
          <p className="mt-1 text-3xs font-medium text-slate-400">
            Durasi: {stats.totalSks * 50} menit perkuliahan
          </p>
        </div>

        {/* Room & Capacity Conflicts */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Bentrok Ruang & Kapasitas</span>
            <div
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center',
                stats.roomConflictCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
              )}
            >
              {stats.roomConflictCount > 0 ? (
                <ShieldAlert className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={cn(
                'text-2xl font-black',
                stats.roomConflictCount > 0 ? 'text-rose-600' : 'text-emerald-700'
              )}
            >
              {stats.roomConflictCount}
            </span>
            <span className="text-xs font-semibold text-slate-400">bentrok ruang</span>
          </div>
          <p className="mt-1 text-3xs font-medium text-slate-400">
            {stats.capacityViolationCount} kelas kapasitas kurang
          </p>
        </div>

        {/* Lecturer Conflicts */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Bentrok Dosen Pengampu</span>
            <div
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center',
                stats.lecturerConflictCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
              )}
            >
              {stats.lecturerConflictCount > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={cn(
                'text-2xl font-black',
                stats.lecturerConflictCount > 0 ? 'text-amber-600' : 'text-emerald-700'
              )}
            >
              {stats.lecturerConflictCount}
            </span>
            <span className="text-xs font-semibold text-slate-400">bentrok dosen</span>
          </div>
          <p className="mt-1 text-3xs font-medium text-slate-400">
            {conflicts.length > 0 ? 'Akan dieliminasi di Step 5' : 'Jadwal awal bebas bentrok!'}
          </p>
        </div>
      </div>

      {/* 3. Conflict Alert Banner (if conflicts exist) */}
      {conflicts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-amber-900">
                  Terdeteksi {conflicts.length} Konflik / Bentrok pada Jadwal Awal
                </h4>
                <p className="text-xs text-amber-700 max-w-2xl leading-relaxed">
                  Initial schedule diperbolehkan memiliki bentrok penempatan ruangan atau jam mengajar dosen. Seluruh konflik ini dirancang untuk dieliminasi secara otomatis pada{' '}
                  <span className="font-bold">Tahap 5 (Simulated Annealing)</span>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowConflictPanel(!showConflictPanel)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <span>{showConflictPanel ? 'Sembunyikan Daftar Konflik' : 'Lihat Rincian Konflik'}</span>
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform duration-200', showConflictPanel && 'rotate-180')}
              />
            </button>
          </div>

          {/* Collapsible Conflicts List */}
          {showConflictPanel && (
            <div className="mt-4 pt-4 border-t border-amber-200/70 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {conflicts.map((conf) => (
                  <div
                    key={conf.id}
                    className="p-3 bg-white/80 border border-amber-200 rounded-xl space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={cn(
                          'text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                          conf.type === 'ROOM_OVERLAP'
                            ? 'bg-rose-100 text-rose-700'
                            : conf.type === 'LECTURER_OVERLAP'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        )}
                      >
                        {conf.type === 'ROOM_OVERLAP'
                          ? 'Bentrok Ruang'
                          : conf.type === 'LECTURER_OVERLAP'
                          ? 'Bentrok Dosen'
                          : 'Kapasitas Ruang'}
                      </span>
                      <span className="text-3xs font-semibold text-slate-400">Kritis</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 line-clamp-1">{conf.title}</p>
                    <p className="text-3xs text-slate-600 line-clamp-2 leading-relaxed">{conf.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Filter & Action Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari mata kuliah, kode, dosen pengampu, atau ruangan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center flex-wrap gap-2">
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
                <span>Matriks Mingguan</span>
              </button>
            </div>

            {/* Regenerate Initial Schedule */}
            <button
              type="button"
              onClick={onRegenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200/80 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
              <span>{generating ? 'Menggenerate...' : 'Generate Ulang'}</span>
            </button>

            {/* Save to Draft */}
            <button
              type="button"
              onClick={onSaveInitialSchedule}
              disabled={saving || entries.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
            >
              <Save className={cn('w-3.5 h-3.5', saving && 'animate-spin')} />
              <span>{saving ? 'Menyimpan...' : 'Simpan Jadwal Awal'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1 text-slate-400 text-3xs font-bold uppercase tracking-wider mr-1">
            <Filter className="w-3 h-3" />
            <span>Filter:</span>
          </div>

          {/* Day Filter */}
          <select
            value={selectedDayFilter}
            onChange={(e) =>
              setSelectedDayFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
            }
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Hari (Senin–Jumat)</option>
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
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Ruangan</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} ({r.name}) - {r.capacity} kursi
              </option>
            ))}
          </select>

          {/* Semester Filter */}
          <select
            value={selectedSemesterFilter}
            onChange={(e) =>
              setSelectedSemesterFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
            }
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Semester</option>
            {availableSemesters.map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>

          {/* Conflict Filter */}
          <select
            value={conflictFilter}
            onChange={(e) => setConflictFilter(e.target.value as any)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="CONFLICT_ONLY">Hanya Kelas Bentrok ({conflicts.length})</option>
            <option value="CLEAN_ONLY">Hanya Bebas Bentrok</option>
          </select>

          {/* Reset Filters */}
          {(selectedDayFilter !== 'ALL' ||
            selectedRoomFilter !== 'ALL' ||
            selectedSemesterFilter !== 'ALL' ||
            conflictFilter !== 'ALL' ||
            searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={() => {
                setSelectedDayFilter('ALL');
                setSelectedRoomFilter('ALL');
                setSelectedSemesterFilter('ALL');
                setConflictFilter('ALL');
                setSearchQuery('');
              }}
              className="text-3xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          )}

          <div className="ml-auto text-3xs text-slate-400 font-medium">
            Menampilkan <span className="font-bold text-slate-700">{filteredEntries.length}</span> dari {entries.length} kelas
          </div>
        </div>
      </div>

      {/* 5. Main Content: Table View or Timetable Grid View */}
      {viewMode === 'TABLE' ? (
        /* TABLE VIEW */
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-3xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">No</th>
                  <th className="py-3 px-3">Kode & Kelas</th>
                  <th className="py-3 px-3">Mata Kuliah & SKS</th>
                  <th className="py-3 px-3">Smt & Peserta</th>
                  <th className="py-3 px-3 min-w-[200px]">Dosen Pengampu Utama</th>
                  <th className="py-3 px-3">Ruangan & Kapasitas</th>
                  <th className="py-3 px-3">Hari & Jam Perkuliahan</th>
                  <th className="py-3 px-3 text-center">Status Bentrok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="space-y-2">
                        <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-500">Tidak ada jadwal yang sesuai filter.</p>
                        <p className="text-3xs text-slate-400">Coba ubah kata kunci pencarian atau reset filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry, idx) => {
                    const hasConflict = entry.conflicts.length > 0;
                    return (
                      <tr
                        key={entry.courseOfferingId}
                        className={cn(
                          'hover:bg-slate-50/70 transition-colors',
                          hasConflict && 'bg-amber-50/30'
                        )}
                      >
                        {/* No */}
                        <td className="py-3 px-3 text-center text-slate-400 font-medium text-3xs">
                          {idx + 1}
                        </td>

                        {/* Class & Code */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center shrink-0">
                              {entry.offering.classCode}
                            </span>
                            <span className="font-mono text-3xs font-semibold text-slate-600">
                              {entry.offering.courseCode}
                            </span>
                          </div>
                        </td>

                        {/* Course Name & SKS */}
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900 leading-snug">{entry.offering.courseName}</p>
                          <div className="flex items-center gap-1.5 text-3xs text-slate-400 mt-0.5">
                            <span className="font-semibold text-slate-600">{entry.offering.effectiveSks} SKS</span>
                            <span>•</span>
                            <span>{entry.offering.effectiveSks * 50} menit</span>
                          </div>
                        </td>

                        {/* Semester & Participants */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-700">
                              Smt {entry.offering.semester}
                            </span>
                            <div className="text-3xs font-semibold text-slate-600">
                              {entry.offering.expectedStudents} Mahasiswa
                            </div>
                          </div>
                        </td>

                        {/* Primary Lecturer (STRICTLY 1 DOSEN PENGAMPU UTAMA) */}
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                <UserCheck className="w-3 h-3" />
                              </span>
                              <p className="font-bold text-slate-900 text-xs leading-snug">
                                {entry.offering.primaryLecturerName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 pl-6.5 text-3xs">
                              <span className="font-mono text-slate-500 font-semibold">
                                {entry.offering.primaryLecturerCode || '-'}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-emerald-700 font-semibold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/60">
                                Pengampu Utama
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Room & Capacity */}
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-xs">{entry.roomCode}</span>
                              <span className="text-3xs text-slate-500">({entry.roomName})</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-3xs">
                              <span className="font-semibold text-slate-600">Kapasitas {entry.roomCapacity}</span>
                              <span className="text-slate-300">•</span>
                              <span
                                className={cn(
                                  'font-semibold px-1 py-0.2 rounded',
                                  entry.seatWaste >= 0
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-rose-100 text-rose-700 font-bold'
                                )}
                              >
                                {entry.seatWaste >= 0 ? `Sisa ${entry.seatWaste}` : `Kurang ${Math.abs(entry.seatWaste)}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Day & Time Slot */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block px-1.5 py-0.5 rounded font-bold text-3xs bg-blue-50 text-blue-700 border border-blue-200">
                                {entry.dayName}
                              </span>
                              <span className="font-bold text-slate-800 text-xs">
                                {entry.startTime} – {entry.endTime}
                              </span>
                            </div>
                            <p className="text-3xs text-slate-400">{entry.sessionCount} Sesi Berurutan (100% Valid)</p>
                          </div>
                        </td>

                        {/* Conflict Status */}
                        <td className="py-3 px-3 text-center">
                          {hasConflict ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
                              title={entry.conflicts.map((c) => c.title).join('\n')}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>{entry.conflicts.length} Bentrok</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Bebas Bentrok</span>
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
        /* GRID VIEW: Apple Weekly Translucent Glass Calendar */
        <div className="space-y-4">
          <AppleWeeklyCalendar
            title="Matriks Jadwal Awal"
            subtitle="Tinjau hasil plotting jadwal awal. Kelas dengan bentrok ditandai dengan aksen merah/rose."
            entries={calendarEntries}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onSelectEntry={(entry) => {
              if (entry.raw) {
                setSelectedEntry(entry.raw);
              }
            }}
            onResetThisWeek={() => setSelectedDate(new Date())}
          />
        </div>
      )}

      {/* 6. Sticky Bottom Action Bar */}
      <div className="sticky bottom-4 z-20">
        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left: Summary Note */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  Step 4 Selesai: {stats.scheduledCount} dari {stats.totalOfferings} Rombel Terplot
                </p>
                <p className="text-3xs text-slate-400">
                  {conflicts.length > 0
                    ? `Ditemukan ${conflicts.length} konflik yang akan diselesaikan pada Tahap 5 dengan algoritma Simulated Annealing.`
                    : 'Seluruh jadwal awal berhasil diplot tanpa bentrok.'}
                </p>
              </div>
            </div>

            {/* Right: Navigation Controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onBackToStep3}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Step 3</span>
              </button>

              {/* Step 5: Optimasi Simulated Annealing */}
              <button
                type="button"
                onClick={onContinueToStep5}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-500/30 transition-all cursor-pointer"
              >
                <span>Lanjut ke Optimasi Simulated Annealing</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
