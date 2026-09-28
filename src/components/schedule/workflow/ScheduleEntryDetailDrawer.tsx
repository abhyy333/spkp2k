import React, { useState, useEffect } from 'react';
import { ScheduleEntry, Room, TimeSlot, LecturerAvailability, CourseOffering } from '../../../types';
import { Drawer } from '../../ui/Drawer';
import { RoomSelector } from '../RoomSelector';
import { TimeSlotSelector } from '../TimeSlotSelector';
import { validatePlacement, ClientConflict } from '../../../lib/scheduleValidator';
import { minuteToTime, dayOfWeekToName } from '../../../lib/utils';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  User,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';
import { toast } from '../../ui/Toast';

interface ScheduleEntryDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entry: ScheduleEntry | null;
  rooms: Room[];
  activeTimeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  currentEntries: ScheduleEntry[];
  onUpdateEntry: (
    entryId: string,
    data: {
      room_id: string;
      day_of_week: number;
      start_minute: number;
    }
  ) => Promise<void>;
}

export const ScheduleEntryDetailDrawer: React.FC<ScheduleEntryDetailDrawerProps> = ({
  isOpen,
  onClose,
  entry,
  rooms,
  activeTimeSlots,
  availabilities,
  currentEntries,
  onUpdateEntry,
}) => {
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [startMinute, setStartMinute] = useState<number>(470);
  const [roomId, setRoomId] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const [validation, setValidation] = useState<{
    isValid: boolean;
    conflicts: ClientConflict[];
    hasHardConflict: boolean;
    warnings: string[];
  }>({
    isValid: true,
    conflicts: [],
    hasHardConflict: false,
    warnings: [],
  });

  useEffect(() => {
    if (entry && isOpen) {
      setDayOfWeek(Number(entry.day_of_week) || 1);
      setStartMinute(entry.start_minute ?? 470);
      setRoomId(entry.room_id || '');
    }
  }, [entry, isOpen]);

  // Real-time pre-check validation
  useEffect(() => {
    if (!entry || !roomId) {
      setValidation({
        isValid: false,
        conflicts: [],
        hasHardConflict: !roomId,
        warnings: [],
      });
      return;
    }

    const offering = entry.course_offering || {
      id: entry.course_offering_id,
      class_code: entry.class_code || 'A',
      expected_students: entry.student_count || 0,
      course: {
        id: entry.course_offering_id,
        name: entry.course_name || 'Mata Kuliah',
        code: entry.course_code || '',
        effective_sks: Math.round(((entry.end_minute || 570) - (entry.start_minute || 470)) / 50) || 2,
        semester: 1,
        is_schedulable: true,
      },
      course_offering_lecturers: Array.isArray(entry.lecturer_names)
        ? entry.lecturer_names.map((name, i) => ({
            course_offering_id: entry.course_offering_id,
            lecturer_id: entry.lecturer_ids?.[i] || `lec-${i}`,
            assignment_role: 'PENGAMPU',
            lecturer: { id: entry.lecturer_ids?.[i] || `lec-${i}`, name },
          }))
        : [],
    };

    const res = validatePlacement({
      offering: offering as CourseOffering,
      roomId,
      dayOfWeek,
      startMinute,
      rooms,
      currentEntries,
      availabilities,
      activeTimeSlots,
      excludeEntryId: entry.id,
    });

    setValidation(res);
  }, [entry, roomId, dayOfWeek, startMinute, rooms, currentEntries, availabilities, activeTimeSlots]);

  if (!entry) return null;

  const courseName = entry.course_name || entry.course_offering?.course?.name || 'Mata Kuliah';
  const courseCode = entry.course_code || entry.course_offering?.course?.code || '';
  const classCode = entry.class_code || entry.course_offering?.class_code || 'A';
  const sks =
    entry.course_offering?.course?.effective_sks ||
    Math.round(((entry.end_minute || 570) - (entry.start_minute || 470)) / 50) ||
    2;
  const expectedStudents = entry.student_count ?? entry.course_offering?.expected_students ?? 0;
  const lecturerNames = Array.isArray(entry.lecturer_names)
    ? entry.lecturer_names.join(', ')
    : entry.lecturer_names ||
      entry.course_offering?.course_offering_lecturers?.map((l) => l.lecturer?.name).filter(Boolean).join(', ') ||
      'Dosen Pengampu';

  const handleSave = async () => {
    if (!roomId) {
      toast.error('Harap pilih ruangan.');
      return;
    }

    try {
      setSaving(true);
      await onUpdateEntry(entry.id, {
        room_id: roomId,
        day_of_week: dayOfWeek,
        start_minute: startMinute,
      });
      toast.success(`Jadwal ${courseName} berhasil dipindahkan.`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan perubahan penempatan jadwal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Detail & Pindah Jadwal"
      subtitle={`${courseCode} – ${courseName} (Kelas ${classCode})`}
      width="w-full sm:max-w-md lg:max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving || !roomId}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Menyimpan...' : 'Terapkan & Simpan'}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Read-only Course Header Box */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-mono text-3xs font-semibold text-slate-400">
                {courseCode}
              </span>
              <h4 className="text-sm font-bold text-slate-800 leading-tight">
                {courseName}
              </h4>
            </div>
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Kelas {classCode}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-2xs pt-2 border-t border-slate-200/60">
            <div>
              <span className="text-slate-400 block">Bobot SKS:</span>
              <span className="font-semibold text-slate-700">{sks} SKS ({sks * 50} menit)</span>
            </div>
            <div>
              <span className="text-slate-400 block">Jumlah Peserta:</span>
              <span className="font-semibold text-slate-700">{expectedStudents} Mahasiswa</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 block">Dosen Pengampu:</span>
              <span className="font-semibold text-slate-700">{lecturerNames}</span>
            </div>
          </div>
        </div>

        {/* Time Selector */}
        <TimeSlotSelector
          dayOfWeek={dayOfWeek}
          onDayChange={setDayOfWeek}
          startMinute={startMinute}
          onStartMinuteChange={setStartMinute}
          effectiveSks={sks}
          activeTimeSlots={activeTimeSlots}
        />

        {/* Room Selector */}
        <RoomSelector
          rooms={rooms}
          selectedRoomId={roomId}
          onChange={setRoomId}
          expectedStudents={expectedStudents}
          requiredRoomType={entry.course_offering?.required_room_type || undefined}
        />

        {/* Conflicts Alert */}
        {validation.conflicts.length > 0 && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-2xs text-rose-800">
            <div className="flex items-center gap-2 font-bold text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Ditemukan {validation.conflicts.length} Konflik Jadwal:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-rose-700">
              {validation.conflicts.map((c) => (
                <li key={c.id}>
                  <strong>{c.title}:</strong> {c.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Soft Warnings */}
        {validation.warnings.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-2xs text-amber-800">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Catatan Preferensi:
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-amber-700">
              {validation.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Clean State Feedback */}
        {validation.isValid && !validation.hasHardConflict && roomId && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Alokasi waktu dan ruangan valid tanpa konflik.</span>
          </div>
        )}
      </div>
    </Drawer>
  );
};
