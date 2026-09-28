import React from 'react';
import { ScheduleEntry, Room } from '../../types';
import { Drawer } from '../ui/Drawer';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  User,
  BookOpen,
  Edit,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { ClientConflict } from '../../lib/scheduleValidator';

interface ScheduleDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entry: ScheduleEntry | null;
  room?: Room | null;
  conflicts: ClientConflict[];
  onEdit: (entry: ScheduleEntry) => void;
  onRemove: (entry: ScheduleEntry) => void;
  onGetSuggestion?: (entry: ScheduleEntry) => void;
}

export const ScheduleDetailDrawer: React.FC<ScheduleDetailDrawerProps> = ({
  isOpen,
  onClose,
  entry,
  room,
  conflicts,
  onEdit,
  onRemove,
  onGetSuggestion,
}) => {
  if (!entry) return null;

  const course = entry.course_offering?.course;
  const courseName = entry.course_name || course?.name || 'Mata Kuliah';
  const courseCode = entry.course_code || course?.code || '';
  const classCode = entry.class_code || entry.course_offering?.class_code || 'A';
  const sks = course?.effective_sks || 2;
  const timeRange = `${entry.start_time || '07:50'} – ${entry.end_time || '09:30'}`;
  const dayName = entry.day || 'Senin';
  const expectedStudents = entry.student_count ?? entry.course_offering?.expected_students ?? 0;
  const roomName = room ? `${room.code} – ${room.name}` : entry.room_id;
  const roomCap = room ? `${room.capacity} kursi (${room.room_type || 'Teori'})` : '-';

  const lecturerNames = Array.isArray(entry.lecturer_names)
    ? entry.lecturer_names.join(', ')
    : entry.lecturer_names ||
      entry.course_offering?.course_offering_lecturers?.map((l) => l.lecturer?.name).filter(Boolean).join(', ') ||
      'Belum ditentukan';

  // Associated conflicts
  const entryConflicts = conflicts.filter(
    (c) =>
      c.entryIds.includes(entry.id) ||
      c.courseOfferingIds.includes(entry.course_offering_id)
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Detail Jadwal Perkuliahan"
      subtitle={`${courseCode} – ${courseName}`}
      width="w-full sm:max-w-md"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() => onRemove(entry)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Keluarkan dari Jadwal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => onEdit(entry)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              Ubah Jadwal
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Conflict Alert if any */}
        {entryConflicts.length > 0 && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-2xs text-rose-800">
            <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              Perhatian: Jadwal ini mengalami bentrok
            </div>
            <ul className="list-disc pl-5 space-y-1 text-rose-700">
              {entryConflicts.map((c) => (
                <li key={c.id}>
                  <strong>{c.title}:</strong> {c.description}
                </li>
              ))}
            </ul>

            {onGetSuggestion && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGetSuggestion(entry);
                }}
                className="w-full mt-1.5 py-1.5 px-3 rounded-lg text-2xs font-bold bg-white text-rose-900 border border-rose-300 hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>💡 Cari Saran Solusi Cerdas untuk Kelas Ini</span>
              </button>
            )}
          </div>
        )}

        {/* Detailed Attribute List */}
        <div className="bg-white rounded-xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden text-xs">
          <div className="p-3 flex items-start justify-between">
            <span className="text-slate-400">Mata Kuliah</span>
            <div className="text-right">
              <p className="font-bold text-slate-800">{courseName}</p>
              <span className="font-mono text-2xs text-slate-400">{courseCode}</span>
            </div>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="text-slate-400">Kelas</span>
            <span className="px-2 py-0.5 rounded font-bold text-blue-700 bg-blue-50 border border-blue-200">
              Kelas {classCode}
            </span>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="text-slate-400">Bobot SKS</span>
            <span className="font-semibold text-slate-700">{sks} SKS ({sks * 50} menit)</span>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="text-slate-400">Hari & Waktu</span>
            <span className="font-semibold text-slate-800">
              {dayName}, {timeRange} WITA
            </span>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="text-slate-400">Ruangan</span>
            <span className="font-semibold text-slate-800">{roomName}</span>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="text-slate-400">Kapasitas Ruang</span>
            <span className="text-slate-700">{roomCap}</span>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="text-slate-400">Jumlah Peserta</span>
            <span className="font-semibold text-slate-800">{expectedStudents} Mahasiswa</span>
          </div>

          <div className="p-3 flex items-start justify-between">
            <span className="text-slate-400">Dosen Pengampu</span>
            <span className="font-semibold text-slate-800 text-right max-w-[200px]">
              {lecturerNames}
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-2xs text-slate-500 leading-relaxed">
          Catatan: Mengeluarkan mata kuliah dari jadwal hanya akan menghapusnya dari rancangan (draft) saat ini. Data penawaran kelas dan dosen pengampu tetap tersimpan di database.
        </div>
      </div>
    </Drawer>
  );
};
