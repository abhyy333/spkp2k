import React, { useState, useMemo } from 'react';
import {
  ScheduleEntry,
  CourseOffering,
  Room,
  TimeSlot,
  LecturerAvailability,
  Lecturer,
  ScheduleVersion,
} from '../../../types';
import {
  Calendar,
  Grid,
  List,
  Layers,
  Send,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  Users,
  Search,
  Filter,
  ArrowLeft,
  Loader2,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { ClientConflict, detectAllScheduleConflicts } from '../../../lib/scheduleValidator';
import { ScheduleEntryDetailDrawer } from './ScheduleEntryDetailDrawer';
import { minuteToTime, dayOfWeekToName } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

interface Step6PreviewPublishProps {
  currentVersion: ScheduleVersion | null;
  entries: ScheduleEntry[];
  selectedOfferings: CourseOffering[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  lecturers: Lecturer[];
  onUpdateEntryPlacement: (
    entryId: string,
    data: { room_id: string; day_of_week: number; start_minute: number }
  ) => Promise<void>;
  onPublishSchedule: (changelog?: string) => Promise<void>;
  onBack: () => void;
}

const DAYS = [
  { value: 1, name: 'Senin' },
  { value: 2, name: 'Selasa' },
  { value: 3, name: 'Rabu' },
  { value: 4, name: 'Kamis' },
  { value: 5, name: 'Jumat' },
];

export const Step6PreviewPublish: React.FC<Step6PreviewPublishProps> = ({
  currentVersion,
  entries,
  selectedOfferings,
  rooms,
  timeSlots,
  availabilities,
  lecturers,
  onUpdateEntryPlacement,
  onPublishSchedule,
  onBack,
}) => {
  const [viewMode, setViewMode] = useState<'DAY_MATRIX' | 'ROOM_MATRIX' | 'TABLE'>('DAY_MATRIX');
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [selectedRoomId, setSelectedRoomId] = useState('all');
  const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<ScheduleEntry | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [changelogInput, setChangelogInput] = useState('');
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);

  // Conflicts calculation
  const conflicts: ClientConflict[] = useMemo(() => {
    return detectAllScheduleConflicts(entries, rooms, availabilities);
  }, [entries, rooms, availabilities]);

  const hardConflicts = conflicts.filter((c) => c.severity === 'CRITICAL');
  const isFeasible = hardConflicts.length === 0;
  const isPublished = currentVersion?.status === 'PUBLISHED';

  // Unique time slots starting minutes
  const uniqueStartMinutes = useMemo(() => {
    const set = new Set<number>();
    timeSlots.forEach((s) => {
      if (s.is_active && s.start_minute != null) set.add(s.start_minute);
    });
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length > 0 ? arr : [470, 520, 570, 620, 670, 780, 830, 880, 930, 980];
  }, [timeSlots]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const course = e.course_offering?.course;
      if (semesterFilter !== 'all' && String(course?.semester) !== semesterFilter) return false;
      if (selectedRoomId !== 'all' && e.room_id !== selectedRoomId) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const cName = e.course_name?.toLowerCase() || '';
        const cCode = e.course_code?.toLowerCase() || '';
        const cls = e.class_code?.toLowerCase() || '';
        const lNames = Array.isArray(e.lecturer_names)
          ? e.lecturer_names.join(' ').toLowerCase()
          : String(e.lecturer_names || '').toLowerCase();
        return cName.includes(q) || cCode.includes(q) || cls.includes(q) || lNames.includes(q);
      }
      return true;
    });
  }, [entries, semesterFilter, selectedRoomId, search]);

  const handleConfirmPublish = async () => {
    if (!isFeasible) {
      toast.error('Jadwal tidak dapat diterbitkan karena masih terdapat bentrok keras.');
      return;
    }

    try {
      setIsPublishing(true);
      await onPublishSchedule(changelogInput || 'Dipublikasikan sebagai jadwal resmi perkuliahan');
      setShowPublishConfirmModal(false);
      toast.success('Jadwal perkuliahan resmi berhasil diterbitkan!');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mempublikasikan jadwal.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                6
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Preview & Publikasi Jadwal
              </h2>
              {/* Feasible Badge */}
              {isFeasible ? (
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Feasible — 0 Konflik
                </span>
              ) : (
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Belum Feasible — {hardConflicts.length} Konflik
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Evaluasi tata letak jadwal dalam 3 mode tampilan (Matriks Hari, Matriks Ruangan, dan Tabel Daftar) sebelum diterbitkan secara resmi.
            </p>
          </div>

          {/* Action: Print & Publish */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-400" />
              Cetak / Unduh
            </button>

            {isPublished ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
                Jadwal Resmi Diterbitkan (Read-Only)
              </span>
            ) : (
              <button
                type="button"
                disabled={!isFeasible || isPublishing}
                onClick={() => setShowPublishConfirmModal(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
                title={
                  !isFeasible
                    ? 'Jadwal masih memiliki bentrok keras. Selesaikan sebelum menerbitkan.'
                    : 'Terbitkan jadwal perkuliahan resmi'
                }
              >
                <Send className="w-4 h-4" />
                <span>Konfirmasi & Terbitkan Jadwal Resmi</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 View Mode Tabs & Search Filter */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('DAY_MATRIX')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'DAY_MATRIX'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              1. Matriks Hari
            </button>

            <button
              type="button"
              onClick={() => setViewMode('ROOM_MATRIX')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'ROOM_MATRIX'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-indigo-600" />
              2. Matriks Ruangan
            </button>

            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5 text-emerald-600" />
              3. Tabel Daftar
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari MK, dosen, ruang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none"
            >
              <option value="all">Semua Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={String(s)}>
                  Semester {s}
                </option>
              ))}
            </select>

            {viewMode !== 'ROOM_MATRIX' && (
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none max-w-[150px] truncate"
              >
                <option value="all">Semua Ruangan</option>
                {rooms.filter((r) => r.is_active).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} ({r.name})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: MATRIKS HARI (Senin s.d. Jumat) */}
      {viewMode === 'DAY_MATRIX' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col max-h-[750px]">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <div className="min-w-[850px] h-full flex flex-col">
              {/* Day Headers */}
              <div className="grid grid-cols-11 border-b border-slate-200 bg-slate-100/80 font-bold text-2xs uppercase tracking-wider sticky top-0 z-10 text-slate-700">
                <div className="col-span-1 p-2.5 text-center border-r border-slate-200 text-slate-400">
                  Waktu
                </div>
                {DAYS.map((day) => (
                  <div
                    key={day.value}
                    className="col-span-2 p-2.5 text-center border-r border-slate-200 last:border-r-0"
                  >
                    {day.name}
                  </div>
                ))}
              </div>

              {/* Time Slot Rows */}
              <div className="flex-1 divide-y divide-slate-100">
                {uniqueStartMinutes.map((startMin) => {
                  const timeLabel = minuteToTime(startMin);
                  const nextSlotLabel = minuteToTime(startMin + 50);

                  return (
                    <div key={startMin} className="grid grid-cols-11 min-h-[95px]">
                      {/* Time Slot Label */}
                      <div className="col-span-1 p-2 border-r border-slate-200 bg-slate-50/60 flex flex-col items-center justify-start font-mono text-3xs text-slate-500 font-medium">
                        <span className="font-bold text-slate-800">{timeLabel}</span>
                        <span className="text-slate-400 text-4xs">s.d {nextSlotLabel}</span>
                      </div>

                      {/* Day Columns */}
                      {DAYS.map((day) => {
                        const slotEntries = filteredEntries.filter((e) => {
                          const eDay = Number(e.day_of_week) || 1;
                          const eStart = e.start_minute ?? 470;
                          return eDay === day.value && eStart === startMin;
                        });

                        return (
                          <div
                            key={`${day.value}-${startMin}`}
                            className="col-span-2 p-1.5 border-r border-slate-200 last:border-r-0 bg-white/40 hover:bg-slate-50/40 transition-colors flex flex-col gap-1.5"
                          >
                            {slotEntries.map((entry) => {
                              const room = rooms.find((r) => r.id === entry.room_id);
                              const course = entry.course_offering?.course;
                              const sks = course?.effective_sks || 2;
                              const timeRange = `${entry.start_time || minuteToTime(entry.start_minute || 470)} – ${
                                entry.end_time || minuteToTime(entry.end_minute || 570)
                              }`;
                              const lecturerNames = Array.isArray(entry.lecturer_names)
                                ? entry.lecturer_names.join(', ')
                                : String(entry.lecturer_names || '-');

                              return (
                                <div
                                  key={entry.id}
                                  onClick={() => !isPublished && setSelectedEntryForDetail(entry)}
                                  className={`p-2.5 rounded-xl border text-left shadow-2xs hover:shadow-xs transition-all ${
                                    isPublished
                                      ? 'bg-slate-50 border-slate-200'
                                      : 'bg-white border-slate-200/90 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer'
                                  }`}
                                >
                                  {/* Code, Class, SKS */}
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="font-mono text-3xs font-semibold text-slate-400 truncate">
                                      {entry.course_code || course?.code}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="px-1.5 py-0.2 rounded font-bold text-3xs bg-blue-100 text-blue-700">
                                        Kelas {entry.class_code || entry.course_offering?.class_code}
                                      </span>
                                      <span className="px-1 py-0.2 rounded text-3xs font-medium text-slate-600 bg-slate-100">
                                        {sks} SKS
                                      </span>
                                    </div>
                                  </div>

                                  {/* Course Name */}
                                  <h5 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                                    {entry.course_name || course?.name}
                                  </h5>

                                  {/* Details */}
                                  <div className="mt-1.5 space-y-0.5 text-3xs text-slate-600">
                                    <div className="flex items-center gap-1 font-mono font-medium text-slate-700">
                                      <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span>{timeRange} WITA ({sks * 50}m)</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                      <span className="font-bold text-slate-800 truncate">
                                        {room ? `${room.code} (${room.name})` : '-'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-slate-500">
                                      <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span className="truncate">{lecturerNames}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-slate-400">
                                      <Users className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span>{entry.student_count || 0} Mahasiswa</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: MATRIKS RUANGAN */}
      {viewMode === 'ROOM_MATRIX' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden max-h-[750px] overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {rooms.filter((r) => r.is_active).map((room) => {
              const roomEntries = filteredEntries.filter((e) => e.room_id === room.id);

              return (
                <div
                  key={room.id}
                  className="bg-slate-50/60 rounded-xl border border-slate-200 p-3.5 space-y-2.5 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        {room.code} – {room.name}
                      </h4>
                      <p className="text-3xs text-slate-500 mt-0.5">
                        Kapasitas: {room.capacity} kursi • {room.room_type || 'Teori'}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-blue-100 text-blue-800">
                      {roomEntries.length} Sesi
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200/70 border-t border-slate-200/70 pt-2 space-y-1.5">
                    {roomEntries.length === 0 ? (
                      <p className="text-3xs text-slate-400 italic text-center py-2">
                        Ruangan kosong sepanjang minggu.
                      </p>
                    ) : (
                      roomEntries.map((e) => {
                        const dayName = dayOfWeekToName(Number(e.day_of_week) || 1);
                        const timeRange = `${e.start_time || minuteToTime(e.start_minute || 470)} – ${
                          e.end_time || minuteToTime(e.end_minute || 570)
                        }`;

                        return (
                          <div
                            key={e.id}
                            onClick={() => !isPublished && setSelectedEntryForDetail(e)}
                            className="pt-1.5 first:pt-0 cursor-pointer hover:text-blue-700 transition-colors"
                          >
                            <div className="flex items-center justify-between text-3xs font-semibold text-slate-700">
                              <span className="font-bold text-slate-900">{dayName}</span>
                              <span className="font-mono text-slate-500">{timeRange}</span>
                            </div>
                            <p className="text-2xs font-bold text-slate-800 truncate">
                              {e.course_name} (Kelas {e.class_code})
                            </p>
                            <p className="text-3xs text-slate-500 truncate">
                              {Array.isArray(e.lecturer_names) ? e.lecturer_names.join(', ') : e.lecturer_names}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: TABEL DAFTAR */}
      {viewMode === 'TABLE' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-2xs sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">Hari</th>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Kode MK</th>
                  <th className="py-3 px-4">Mata Kuliah</th>
                  <th className="py-3 px-3 text-center">Kelas</th>
                  <th className="py-3 px-3 text-center">SKS</th>
                  <th className="py-3 px-4">Dosen Pengampu</th>
                  <th className="py-3 px-4">Ruangan</th>
                  <th className="py-3 px-3 text-center">Peserta</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((e) => {
                  const dayName = dayOfWeekToName(Number(e.day_of_week) || 1);
                  const timeRange = `${e.start_time || minuteToTime(e.start_minute || 470)} – ${
                    e.end_time || minuteToTime(e.end_minute || 570)
                  }`;
                  const room = rooms.find((r) => r.id === e.room_id);
                  const sks = e.course_offering?.course?.effective_sks || 2;
                  const lecturerNames = Array.isArray(e.lecturer_names)
                    ? e.lecturer_names.join(', ')
                    : String(e.lecturer_names || '-');

                  return (
                    <tr
                      key={e.id}
                      onClick={() => !isPublished && setSelectedEntryForDetail(e)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-bold text-slate-800">{dayName}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {timeRange}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {e.course_code || e.course_offering?.course?.code || '-'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{e.course_name}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded font-bold text-xs bg-blue-100 text-blue-800">
                          Kelas {e.class_code}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">{sks}</td>
                      <td className="py-3 px-4 text-slate-700">{lecturerNames}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {room ? `${room.code} (${room.name})` : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {e.student_count || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Siap
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Optimasi SA</span>
        </button>

        <div className="flex items-center gap-3">
          {isPublished ? (
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Jadwal resmi telah aktif dan dapat diakses oleh seluruh civitas akademika.
            </span>
          ) : (
            <button
              type="button"
              disabled={!isFeasible || isPublishing}
              onClick={() => setShowPublishConfirmModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Konfirmasi & Terbitkan Jadwal Resmi</span>
            </button>
          )}
        </div>
      </div>

      {/* Detail & Pindah Drawer (Manual Adjustment in Step 6) */}
      {selectedEntryForDetail && !isPublished && (
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

      {/* Publish Confirmation Modal */}
      {showPublishConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <Send className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Terbitkan Jadwal Perkuliahan Resmi?
              </h3>
              <p className="text-xs text-slate-500">
                Setelah diterbitkan, jadwal ini akan berstatus <strong>PUBLISHED</strong> dan langsung menjadi jadwal acuan resmi bagi dosen, mahasiswa, dan sistem perkuliahan.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Catatan Rilis / Changelog (Opsional):
              </label>
              <textarea
                rows={2}
                value={changelogInput}
                onChange={(e) => setChangelogInput(e.target.value)}
                placeholder="Contoh: Jadwal perkuliahan resmi semester ganjil 2026/2027 hasil optimasi final."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={handleConfirmPublish}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menerbitkan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Ya, Terbitkan Jadwal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
