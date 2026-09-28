import React, { useState, useMemo } from 'react';
import {
  ScheduleEntry,
  CourseOffering,
  Room,
  TimeSlot,
  LecturerAvailability,
  Lecturer,
} from '../../../types';
import {
  CalendarDays,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Edit,
  ArrowLeft,
  ArrowRight,
  Search,
  Filter,
  MapPin,
  Clock,
  User,
} from 'lucide-react';
import { ClientConflict, detectAllScheduleConflicts } from '../../../lib/scheduleValidator';
import { ScheduleEntryDetailDrawer } from './ScheduleEntryDetailDrawer';
import { minuteToTime, dayOfWeekToName } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

interface Step4InitialScheduleProps {
  entries: ScheduleEntry[];
  selectedOfferings: CourseOffering[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  lecturers: Lecturer[];
  isGenerating: boolean;
  onGenerateInitialPlacement: () => Promise<void>;
  onUpdateEntryPlacement: (
    entryId: string,
    data: { room_id: string; day_of_week: number; start_minute: number }
  ) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}

export const Step4InitialSchedule: React.FC<Step4InitialScheduleProps> = ({
  entries,
  selectedOfferings,
  rooms,
  timeSlots,
  availabilities,
  lecturers,
  isGenerating,
  onGenerateInitialPlacement,
  onUpdateEntryPlacement,
  onBack,
  onNext,
}) => {
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [conflictFilter, setConflictFilter] = useState<'all' | 'conflicts_only' | 'clean_only'>('all');
  const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<ScheduleEntry | null>(null);

  // Compute real-time conflicts
  const conflicts: ClientConflict[] = useMemo(() => {
    return detectAllScheduleConflicts(entries, rooms, availabilities);
  }, [entries, rooms, availabilities]);

  // Conflict map by entry ID
  const conflictMap = useMemo(() => {
    const map = new Map<string, ClientConflict[]>();
    conflicts.forEach((c) => {
      c.entryIds.forEach((eid) => {
        const arr = map.get(eid) || [];
        arr.push(c);
        map.set(eid, arr);
      });
    });
    return map;
  }, [conflicts]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const eDay = String(entry.day_of_week || 1);
      if (dayFilter !== 'all' && eDay !== dayFilter) return false;

      const entryConflicts = conflictMap.get(entry.id) || [];
      const hasConflict = entryConflicts.length > 0;

      if (conflictFilter === 'conflicts_only' && !hasConflict) return false;
      if (conflictFilter === 'clean_only' && hasConflict) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const cName = entry.course_name?.toLowerCase() || '';
        const cCode = entry.course_code?.toLowerCase() || '';
        const cls = entry.class_code?.toLowerCase() || '';
        const rCode = entry.room?.code?.toLowerCase() || '';
        const lNames = Array.isArray(entry.lecturer_names)
          ? entry.lecturer_names.join(' ').toLowerCase()
          : String(entry.lecturer_names || '').toLowerCase();

        return (
          cName.includes(q) ||
          cCode.includes(q) ||
          cls.includes(q) ||
          rCode.includes(q) ||
          lNames.includes(q)
        );
      }

      return true;
    });
  }, [entries, dayFilter, conflictFilter, search, conflictMap]);

  const hardConflictCount = conflicts.filter((c) => c.severity === 'CRITICAL').length;
  const totalConflictCount = conflicts.length;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                4
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Jadwal Awal (Initial Schedule) & Alokasi Ruangan
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Penempatan jadwal awal greedy berbasis kapasitas ruangan, kesesuaian tipe ruang, ketersediaan dosen, dan durasi SKS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isGenerating}
              onClick={onGenerateInitialPlacement}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>Generate Ulang Penempatan</span>
            </button>

            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Jalankan Optimasi SA</span>
            </button>
          </div>
        </div>

        {/* Conflict Notice Banner */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          {totalConflictCount > 0 ? (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-900">
                    Ditemukan {totalConflictCount} potensi bentrok pada jadwal awal ({hardConflictCount} bentrok keras)
                  </p>
                  <p className="text-2xs text-amber-700 mt-0.5">
                    Hal ini wajar pada tahap initial schedule. Anda dapat melakukan penyesuaian manual atau langsung menjalankan optimasi Simulated Annealing pada tahap berikutnya.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onNext}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shrink-0 cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Optimasi Sekarang
              </button>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">
                Jadwal awal berhasil ditempatkan tanpa bentrok (0 Konflik).
              </span>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari mata kuliah, ruangan, dosen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Day filter */}
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">Semua Hari (Senin–Jumat)</option>
              <option value="1">Senin</option>
              <option value="2">Selasa</option>
              <option value="3">Rabu</option>
              <option value="4">Kamis</option>
              <option value="5">Jumat</option>
            </select>

            {/* Conflict filter */}
            <select
              value={conflictFilter}
              onChange={(e) => setConflictFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">Semua Entri Jadwal ({entries.length})</option>
              <option value="conflicts_only">Hanya yang Bentrok ({totalConflictCount})</option>
              <option value="clean_only">Hanya yang Valid</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            Menampilkan <strong>{filteredEntries.length}</strong> dari <strong>{entries.length}</strong> entri jadwal
          </div>
        </div>
      </div>

      {/* Initial Schedule Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-2xs sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Hari & Sesi Waktu</th>
                <th className="py-3 px-4">Ruangan</th>
                <th className="py-3 px-4">Mata Kuliah & Rombel</th>
                <th className="py-3 px-4">Dosen Pengampu</th>
                <th className="py-3 px-4 text-center">Status Audit</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Tidak ada jadwal yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const dayName = dayOfWeekToName(Number(entry.day_of_week) || 1);
                  const timeRange = `${entry.start_time || minuteToTime(entry.start_minute || 470)} – ${
                    entry.end_time || minuteToTime(entry.end_minute || 570)
                  }`;
                  const room = rooms.find((r) => r.id === entry.room_id) || entry.room;
                  const roomName = room ? `${room.code} (${room.name})` : '-';
                  const roomCap = room ? `${room.capacity} kursi` : '-';
                  const courseName = entry.course_name || entry.course_offering?.course?.name || 'Mata Kuliah';
                  const courseCode = entry.course_code || entry.course_offering?.course?.code || '';
                  const classCode = entry.class_code || entry.course_offering?.class_code || 'A';
                  const sks =
                    entry.course_offering?.course?.effective_sks ||
                    Math.round(((entry.end_minute || 570) - (entry.start_minute || 470)) / 50) ||
                    2;

                  const lecturerNames = Array.isArray(entry.lecturer_names)
                    ? entry.lecturer_names.join(', ')
                    : entry.lecturer_names || '-';

                  const entryConflicts = conflictMap.get(entry.id) || [];
                  const hasConflict = entryConflicts.length > 0;

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        hasConflict
                          ? 'bg-rose-50/40 hover:bg-rose-50/70'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Day & Time */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900">{dayName}</p>
                          <p className="font-mono text-2xs font-semibold text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {timeRange} WITA
                          </p>
                          <span className="text-3xs text-slate-400 font-medium">
                            {sks} SKS ({sks * 50} menit)
                          </span>
                        </div>
                      </td>

                      {/* Room */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                            {roomName}
                          </p>
                          <div className="flex items-center gap-1.5 text-3xs text-slate-500">
                            <span>{roomCap}</span>
                            <span>•</span>
                            <span className="truncate">{room?.room_type || 'Teori'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Course & Class */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.2 rounded font-bold text-2xs bg-blue-100 text-blue-800 border border-blue-200">
                              Kelas {classCode}
                            </span>
                            <span className="font-mono text-3xs text-slate-400 font-semibold">
                              {courseCode}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 leading-snug">
                            {courseName}
                          </p>
                          <span className="text-3xs text-slate-500 font-medium">
                            {entry.student_count || entry.course_offering?.expected_students || 0} Mahasiswa
                          </span>
                        </div>
                      </td>

                      {/* Lecturers */}
                      <td className="py-3.5 px-4">
                        <p className="text-xs text-slate-800 font-medium line-clamp-2">
                          {lecturerNames}
                        </p>
                      </td>

                      {/* Conflict Audit */}
                      <td className="py-3.5 px-4 text-center">
                        {hasConflict ? (
                          <div className="flex flex-col items-center gap-1">
                            {entryConflicts.map((c) => (
                              <span
                                key={c.id}
                                title={c.description}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-rose-100 text-rose-800 border border-rose-300"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {c.title}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Valid (0 Konflik)
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedEntryForDetail(entry)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit className="w-3 h-3" />
                          Detail & Pindah
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
          <span>Kembali ke Penugasan Dosen</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <span>Lanjut ke Optimasi SA</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Detail & Pindah Drawer */}
      {selectedEntryForDetail && (
        <ScheduleEntryDetailDrawer
          isOpen={Boolean(selectedEntryForDetail)}
          onClose={() => setSelectedEntryForDetail(null)}
          entry={selectedEntryForDetail}
          rooms={rooms}
          activeTimeSlots={timeSlots}
          availabilities={availabilities}
          currentEntries={entries}
          onUpdateEntry={onUpdateEntryPlacement}
        />
      )}
    </div>
  );
};
