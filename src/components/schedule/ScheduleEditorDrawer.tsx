import React, { useState, useEffect } from 'react';
import { CourseOffering, Room, TimeSlot, LecturerAvailability, ScheduleEntry } from '../../types';
import { validatePlacement, ClientConflict } from '../../lib/scheduleValidator';
import { RoomSelector } from './RoomSelector';
import { TimeSlotSelector } from './TimeSlotSelector';
import { Drawer } from '../ui/Drawer';
import {
  Calendar,
  BookOpen,
  User,
  Users,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface ScheduleEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  offering: CourseOffering | null;
  initialEntry?: ScheduleEntry | null; // provided if editing an existing entry
  rooms: Room[];
  activeTimeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  currentEntries: ScheduleEntry[];
  onApply: (data: {
    course_offering_id: string;
    room_id: string;
    day_of_week: number;
    start_minute: number;
  }) => void;
}

export const ScheduleEditorDrawer: React.FC<ScheduleEditorDrawerProps> = ({
  isOpen,
  onClose,
  offering,
  initialEntry,
  rooms,
  activeTimeSlots,
  availabilities,
  currentEntries,
  onApply,
}) => {
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [startMinute, setStartMinute] = useState<number>(470); // 07:50
  const [roomId, setRoomId] = useState<string>('');
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

  // Initialize or reset form when drawer opens
  useEffect(() => {
    if (!isOpen || !offering) return;

    if (initialEntry) {
      setDayOfWeek(Number(initialEntry.day_of_week) || 1);
      setStartMinute(initialEntry.start_minute ?? 470);
      setRoomId(initialEntry.room_id || '');
    } else {
      setDayOfWeek(1);
      // Pick first active start_minute for Monday
      const monSlots = activeTimeSlots
        .filter((s) => Number(s.day_of_week) === 1 && s.is_active)
        .sort((a, b) => a.start_minute - b.start_minute);
      setStartMinute(monSlots[0]?.start_minute || 470);

      // Auto pick best matching room by type and capacity if available
      const matching = rooms.find(
        (r) =>
          r.is_active &&
          (!offering.required_room_type ||
            (r.room_type || '').toLowerCase() === offering.required_room_type.toLowerCase()) &&
          r.capacity >= (offering.expected_students || 0)
      );
      setRoomId(matching?.id || rooms.filter((r) => r.is_active)[0]?.id || '');
    }
  }, [isOpen, offering, initialEntry, rooms, activeTimeSlots]);

  // Run real-time pre-check validation whenever day, startMinute, or roomId changes
  useEffect(() => {
    if (!offering || !roomId) {
      setValidation({
        isValid: false,
        conflicts: [],
        hasHardConflict: !roomId,
        warnings: [],
      });
      return;
    }

    const res = validatePlacement({
      offering,
      roomId,
      dayOfWeek,
      startMinute,
      rooms,
      currentEntries,
      availabilities,
      activeTimeSlots,
      excludeEntryId: initialEntry?.id,
    });

    setValidation(res);
  }, [offering, roomId, dayOfWeek, startMinute, rooms, currentEntries, availabilities, activeTimeSlots, initialEntry]);

  if (!offering) return null;

  const course = offering.course;
  const sks = course?.effective_sks || 2;
  const expectedStudents = offering.expected_students || 0;
  const lecturerNames = offering.course_offering_lecturers?.map((l) => l.lecturer?.name).filter(Boolean).join(', ') || 'Belum ditentukan';

  const handleConfirm = () => {
    if (validation.hasHardConflict || !roomId) return;

    onApply({
      course_offering_id: offering.id,
      room_id: roomId,
      day_of_week: dayOfWeek,
      start_minute: startMinute,
    });
    onClose();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialEntry ? 'Ubah Jadwal Perkuliahan' : 'Atur Jadwal Perkuliahan'}
      subtitle={`${course?.code || ''} – ${course?.name || ''}`}
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
            disabled={validation.hasHardConflict || !roomId}
            onClick={handleConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
          >
            {initialEntry ? 'Terapkan Perubahan' : 'Tambahkan ke Jadwal'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Read-only Course Info Box */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-mono text-3xs font-semibold text-slate-400">
                {course?.code}
              </span>
              <h4 className="text-sm font-bold text-slate-800 leading-tight">
                {course?.name}
              </h4>
            </div>
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800">
              Kelas {offering.class_code}
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
            {offering.required_room_type && (
              <div className="col-span-2">
                <span className="text-slate-400 block">Kebutuhan Ruangan:</span>
                <span className="font-semibold text-blue-700">{offering.required_room_type}</span>
              </div>
            )}
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
          requiredRoomType={offering.required_room_type || undefined}
        />

        {/* Conflict & Warning Display */}
        {validation.conflicts.length > 0 && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Ditemukan {validation.conflicts.length} Kendala / Konflik Jadwal:</span>
            </div>
            <ul className="space-y-1.5 pl-6 list-disc text-2xs text-rose-700">
              {validation.conflicts.map((c) => (
                <li key={c.id}>
                  <strong className="font-semibold">{c.title}:</strong> {c.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Soft Warnings (e.g. lecturer avoid preference) */}
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
