import React, { useState, useMemo } from 'react';
import {
  Calendar,
  List,
  DoorOpen,
  Users,
  CheckCircle2,
  AlertTriangle,
  Send,
  ArrowLeft,
  ShieldCheck,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { GeneratedExamSlot } from '../../../services/examGenerator.service';
import {
  ExamSession,
  Room,
  Lecturer,
  ScheduleVersion,
  AcademicTerm,
} from '../../../types';
import { minuteToTime, formatDateIndo } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

interface ExamStep5PreviewPublishProps {
  examType: 'UTS' | 'UAS';
  activeTerm: AcademicTerm | null;
  currentVersion: ScheduleVersion | null;
  slots: GeneratedExamSlot[];
  sessions: ExamSession[];
  rooms: Room[];
  lecturers: Lecturer[];
  onPublish: () => Promise<void>;
  isPublishing: boolean;
  onBack: () => void;
}

export const ExamStep5PreviewPublish: React.FC<ExamStep5PreviewPublishProps> = ({
  examType,
  activeTerm,
  currentVersion,
  slots,
  sessions,
  rooms,
  lecturers,
  onPublish,
  isPublishing,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'CALENDAR' | 'TABLE' | 'ROOMS' | 'SUPERVISORS'>(
    'CALENDAR'
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Group slots by date
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(slots.map((s) => s.examDate))).sort();
  }, [slots]);

  // Conflict count & validation
  const conflictSlots = useMemo(() => {
    return slots.filter((s) => s.isConflict);
  }, [slots]);

  const hasConflicts = conflictSlots.length > 0;
  const isAllScheduled = slots.length > 0;

  // Checklist status
  const checklist = [
    {
      label: 'Semua ujian terjadwal',
      status: isAllScheduled,
      detail: `${slots.length} mata kuliah memiliki jadwal`,
    },
    {
      label: 'Bebas bentrok ruangan',
      status: !hasConflicts,
      detail: hasConflicts ? `${conflictSlots.length} bentrok terdeteksi` : 'Seluruh ruangan unik per sesi',
    },
    {
      label: 'Bebas bentrok pengawas',
      status: !hasConflicts,
      detail: hasConflicts ? 'Periksa penugasan pengawas' : 'Pengawas tidak merangkap sesi yang sama',
    },
    {
      label: 'Bebas bentrok rombongan kelas',
      status: !hasConflicts,
      detail: hasConflicts ? 'Periksa jadwal kelas paralel' : 'Satu kelas hanya 1 ujian per sesi',
    },
    {
      label: 'Kapasitas ruangan mencukupi',
      status: slots.every((s) => s.roomCapacity >= s.expectedStudents),
      detail: 'Total kursi >= jumlah mahasiswa terdaftar',
    },
  ];

  const canPublish = isAllScheduled && !hasConflicts;

  // Supervisor workload aggregation
  const supervisorWorkload = useMemo(() => {
    const map: Record<
      string,
      {
        lecturer: Lecturer | null;
        count: number;
        slots: GeneratedExamSlot[];
      }
    > = {};

    lecturers.forEach((l) => {
      map[l.id] = { lecturer: l, count: 0, slots: [] };
    });

    slots.forEach((s) => {
      s.supervisorIds.forEach((sId) => {
        if (!map[sId]) {
          map[sId] = {
            lecturer: lecturers.find((l) => l.id === sId) || null,
            count: 0,
            slots: [],
          };
        }
        map[sId].count += 1;
        map[sId].slots.push(s);
      });
    });

    return Object.values(map)
      .filter((w) => w.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [slots, lecturers]);

  return (
    <div className="w-full space-y-6">
      {/* Header Info */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                Tahap 5 dari 5
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Tinjauan Akhir & Publikasi Resmi
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Publikasi Jadwal {examType === 'UTS' ? 'Ujian Tengah Semester' : 'Ujian Akhir Semester'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Periksa kembali kesiapan jadwal dari berbagai sudut pandang sebelum diterbitkan secara resmi kepada dosen dan mahasiswa.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPublish}
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
              Terbitkan Jadwal {examType} Resmi
            </button>
          </div>
        </div>
      </div>

      {/* Checklist Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Kesiapan Publikasi Jadwal Ujian
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {checklist.map((item, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                item.status
                  ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900'
                  : 'bg-rose-50/50 border-rose-200/80 text-rose-900'
              }`}
            >
              {item.status ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="text-xs font-bold block">{item.label}</span>
                <span className="text-2xs opacity-80">{item.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('CALENDAR')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'CALENDAR'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Kalender Ujian
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TABLE')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'TABLE'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <List className="w-4 h-4" />
          Daftar Ujian
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ROOMS')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ROOMS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DoorOpen className="w-4 h-4" />
          Penggunaan Ruangan
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SUPERVISORS')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'SUPERVISORS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          Beban Pengawas
        </button>
      </div>

      {/* Tab 1: Calendar View */}
      {activeTab === 'CALENDAR' && (
        <div className="space-y-4">
          {uniqueDates.map((dateStr) => {
            const dateSlots = slots.filter((s) => s.examDate === dateStr);
            return (
              <div
                key={dateStr}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
              >
                <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 font-bold text-xs text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>{formatDateIndo(dateStr)}</span>
                  </div>
                  <span className="text-2xs text-slate-500 font-semibold">
                    {dateSlots.length} Mata Kuliah
                  </span>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {dateSlots.map((slot) => (
                    <div
                      key={slot.courseOfferingId}
                      className="p-3.5 rounded-xl border border-slate-200/80 bg-white space-y-2 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 leading-snug">
                            {slot.courseName}
                          </h4>
                          <span className="text-2xs font-mono text-slate-400">
                            {slot.courseCode}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 text-2xs">
                          Kelas {slot.classCode}
                        </span>
                      </div>

                      <div className="space-y-1 text-2xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-bold text-slate-800">
                            {slot.sessionName}
                          </span>
                          <span className="font-mono text-slate-500">
                            ({minuteToTime(slot.startMinute)} – {minuteToTime(slot.endMinute)})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <DoorOpen className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span className="font-semibold">{slot.roomNames.join(' + ')}</span>
                          <span className="text-slate-400">({slot.roomCapacity} kursi)</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Pengawas: {slot.supervisorNames.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Table View */}
      {activeTab === 'TABLE' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">No</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Sesi & Waktu</th>
                  <th className="py-3 px-4">Mata Kuliah</th>
                  <th className="py-3 px-3 text-center">Kelas</th>
                  <th className="py-3 px-3 text-center">Peserta</th>
                  <th className="py-3 px-4">Ruangan</th>
                  <th className="py-3 px-4">Pengawas</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slots.map((slot, idx) => (
                  <tr key={slot.courseOfferingId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-center text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {formatDateIndo(slot.examDate)}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      <span className="font-bold text-slate-900 block font-sans">
                        {slot.sessionName}
                      </span>
                      {minuteToTime(slot.startMinute)} – {minuteToTime(slot.endMinute)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{slot.courseName}</p>
                      <span className="text-2xs text-slate-400 font-mono">{slot.courseCode}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 text-2xs">
                        {slot.classCode}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800 font-mono">
                      {slot.expectedStudents}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {slot.roomNames.join(' + ')}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {slot.supervisorNames.join(', ')}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Siap Terbit
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Rooms Utilization View */}
      {activeTab === 'ROOMS' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Distribusi Penggunaan Ruangan
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms
              .filter((r) => r.is_active)
              .map((r) => {
                const roomSlots = slots.filter((s) => s.roomIds.includes(r.id));
                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        {r.code || r.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-2xs font-bold bg-purple-100 text-purple-800 font-mono">
                        {r.capacity} Kursi
                      </span>
                    </div>
                    <span className="text-2xs text-slate-500 block">
                      Digunakan untuk: {roomSlots.length} sesi ujian
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab 4: Supervisors Workload View */}
      {activeTab === 'SUPERVISORS' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Rekap Beban Tugas Pengawas ({supervisorWorkload.length} Dosen)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                <tr>
                  <th className="py-3 px-4">Nama Dosen Pengawas</th>
                  <th className="py-3 px-4 text-center">Jumlah Sesi</th>
                  <th className="py-3 px-4">Daftar Jadwal Pengawasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supervisorWorkload.map((w, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {w.lecturer?.name || 'Dosen'}
                    </td>
                    <td className="py-3 px-4 text-center font-black text-blue-700 font-mono">
                      {w.count} Sesi
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {w.slots.map((s, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-2xs font-medium text-slate-700"
                          >
                            {formatDateIndo(s.examDate)} ({s.sessionName}) • {s.courseName} ({s.classCode})
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Publish Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
              <Send className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                Terbitkan Jadwal {examType} Resmi?
              </h3>
              <p className="text-xs text-slate-500">
                Setelah diterbitkan, jadwal {examType} akan menjadi sumber data resmi yang dapat dilihat oleh seluruh dosen dan mahasiswa jurusan.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 font-medium text-slate-700">
              <div className="flex justify-between">
                <span>Total Mata Kuliah:</span>
                <span className="font-bold">{slots.length} Kelas</span>
              </div>
              <div className="flex justify-between">
                <span>Status Validasi:</span>
                <span className="font-bold text-emerald-700">✓ Bebas Bentrok</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={async () => {
                  if (isPublishing) return;
                  setShowConfirmModal(false);
                  await onPublish();
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs cursor-pointer"
              >
                {isPublishing ? 'Menerbitkan...' : 'Ya, Terbitkan Resmi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200/80">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Tahap 4
        </button>

        <button
          type="button"
          disabled={!canPublish || isPublishing}
          onClick={() => setShowConfirmModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <Send className="w-4 h-4" />
          {isPublishing ? 'Menerbitkan...' : `Terbitkan Jadwal ${examType} Resmi`}
        </button>
      </div>
    </div>
  );
};
