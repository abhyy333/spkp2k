import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  DoorOpen,
  Users,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Save,
  Edit2,
  X,
  Info,
} from 'lucide-react';
import {
  GeneratedExamSlot,
  ExamGenerationResult,
  generateDateRange,
} from '../../../services/examGenerator.service';
import {
  ExamSession,
  Room,
  Lecturer,
  CourseOffering,
  Course,
  ExamWorkflowConfig,
  ScheduleVersion,
  ExamSourceOffering,
} from '../../../types';
import { minuteToTime } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

interface ExamStep4GenerateMatrixProps {
  examType: 'UTS' | 'UAS';
  config: ExamWorkflowConfig;
  sessions: ExamSession[];
  rooms: Room[];
  lecturers: Lecturer[];
  offerings: (CourseOffering | ExamSourceOffering)[];
  generationResult: ExamGenerationResult | null;
  onGenerate: () => void;
  onUpdateSlots: (updatedSlots: GeneratedExamSlot[]) => void;
  onSaveDraft: () => Promise<void>;
  isSaving: boolean;
  currentVersion: ScheduleVersion | null;
  onNext: () => void;
  onBack: () => void;
}

export const ExamStep4GenerateMatrix: React.FC<ExamStep4GenerateMatrixProps> = ({
  examType,
  config,
  sessions,
  rooms,
  lecturers,
  offerings,
  generationResult,
  onGenerate,
  onUpdateSlots,
  onSaveDraft,
  isSaving,
  currentVersion,
  onNext,
  onBack,
}) => {
  const [selectedSlotForMove, setSelectedSlotForMove] = useState<GeneratedExamSlot | null>(
    null
  );
  const [moveDate, setMoveDate] = useState<string>('');
  const [moveSessionId, setMoveSessionId] = useState<string>('');

  const datePool = useMemo(() => {
    return generateDateRange(config.startDate, config.endDate, config.allowedDays);
  }, [config.startDate, config.endDate, config.allowedDays]);

  const activeSessions = useMemo(() => {
    return sessions.filter((s) => s.is_active);
  }, [sessions]);

  const slots = generationResult?.slots || [];
  const summary = generationResult?.summary;

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const map: Record<string, GeneratedExamSlot[]> = {};
    datePool.forEach((d) => {
      map[d.dateStr] = [];
    });
    slots.forEach((s) => {
      if (!map[s.examDate]) map[s.examDate] = [];
      map[s.examDate].push(s);
    });
    return map;
  }, [slots, datePool]);

  const handleOpenMoveModal = (slot: GeneratedExamSlot) => {
    setSelectedSlotForMove(slot);
    setMoveDate(slot.examDate);
    setMoveSessionId(slot.sessionId);
  };

  const handleApplyMove = () => {
    if (!selectedSlotForMove || !moveDate || !moveSessionId) return;

    const targetSession = sessions.find((s) => s.id === moveSessionId);
    if (!targetSession) return;

    // Target date info
    const targetDateInfo = datePool.find((d) => d.dateStr === moveDate);
    const dayOfWeek = targetDateInfo ? targetDateInfo.dayOfWeek : 1;

    // Check conflicts for this target slot
    const slotKey = `${moveDate}_${moveSessionId}`;
    const otherSlots = slots.filter(
      (s) => s.courseOfferingId !== selectedSlotForMove.courseOfferingId
    );

    const conflicts: string[] = [];
    let isConflict = false;

    // 1. Room conflict
    const roomsInTarget = otherSlots
      .filter((s) => s.examDate === moveDate && s.sessionId === moveSessionId)
      .flatMap((s) => s.roomIds);

    const roomCollision = selectedSlotForMove.roomIds.some((rId) =>
      roomsInTarget.includes(rId)
    );
    if (roomCollision) {
      isConflict = true;
      conflicts.push('Ruangan yang dialokasikan sedang digunakan oleh ujian lain pada sesi ini.');
    }

    // 2. Supervisor conflict
    const supervisorsInTarget = otherSlots
      .filter((s) => s.examDate === moveDate && s.sessionId === moveSessionId)
      .flatMap((s) => s.supervisorIds);

    const supCollision = selectedSlotForMove.supervisorIds.some((sId) =>
      supervisorsInTarget.includes(sId)
    );
    if (supCollision) {
      isConflict = true;
      conflicts.push('Pengawas sudah terjadwal mengawas ujian lain pada sesi ini.');
    }

    // 3. Class group conflict
    const sameGroupInTarget = otherSlots.some(
      (s) =>
        s.examDate === moveDate &&
        s.sessionId === moveSessionId &&
        s.semester === selectedSlotForMove.semester &&
        s.classCode === selectedSlotForMove.classCode
    );
    if (sameGroupInTarget) {
      isConflict = true;
      conflicts.push(`Kelas ${selectedSlotForMove.classCode} Semester ${selectedSlotForMove.semester} sudah memiliki ujian lain di sesi ini.`);
    }

    const updated = slots.map((s) => {
      if (s.courseOfferingId === selectedSlotForMove.courseOfferingId) {
        return {
          ...s,
          examDate: moveDate,
          dayOfWeek,
          sessionId: moveSessionId,
          sessionName: targetSession.name,
          startMinute: targetSession.start_minute,
          endMinute: targetSession.start_minute + s.durationMinutes,
          isConflict,
          conflictReasons: conflicts,
        };
      }
      return s;
    });

    onUpdateSlots(updated);
    setSelectedSlotForMove(null);
    toast.success('Jadwal mata kuliah berhasil dipindahkan.');
  };

  return (
    <div className="w-full space-y-6">
      {/* Header & Stats */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800">
                Tahap 4 dari 5
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Generate & Penataan Matriks Ujian
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Matriks Jadwal {examType}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Jadwal diatur per tanggal pelaksanaan dan sesi ujian. Anda dapat melakukan penyesuaian manual slot waktu jika diperlukan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGenerate}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              Generate Ulang
            </button>

            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Menyimpan Draf...' : 'Simpan Draf Ujian'}
            </button>
          </div>
        </div>

        {/* 4 Summary Counters */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                Total Ujian
              </span>
              <span className="text-lg font-black text-slate-900 font-mono">
                {summary.scheduledExams} / {summary.totalExams}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                Status Bentrok
              </span>
              <span
                className={`text-lg font-black font-mono ${
                  summary.conflictCount > 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {summary.conflictCount > 0 ? `${summary.conflictCount} Bentrok` : '0 Bentrok'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                Ruangan Aktif
              </span>
              <span className="text-lg font-black text-slate-900 font-mono">
                {summary.roomsUsedCount} Ruang
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
                Pengawas Bertugas
              </span>
              <span className="text-lg font-black text-slate-900 font-mono">
                {summary.supervisorsUsedCount} Dosen
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Date-Based Matrix */}
      <div className="space-y-6">
        {datePool.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Rentang Tanggal Tidak Valid</p>
            <p className="text-xs text-slate-500 mt-1">
              Kembali ke Tahap 1 untuk melengkapi tanggal mulai & selesai ujian.
            </p>
          </div>
        ) : (
          datePool.map((dateInfo) => {
            const dateSlots = slotsByDate[dateInfo.dateStr] || [];

            return (
              <div
                key={dateInfo.dateStr}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
              >
                {/* Date Header */}
                <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shadow-2xs">
                      {dateInfo.dayOfWeek === 1
                        ? 'Sn'
                        : dateInfo.dayOfWeek === 2
                        ? 'Sl'
                        : dateInfo.dayOfWeek === 3
                        ? 'Rb'
                        : dateInfo.dayOfWeek === 4
                        ? 'Km'
                        : dateInfo.dayOfWeek === 5
                        ? 'Jm'
                        : 'Sb'}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{dateInfo.formatted}</h3>
                      <span className="text-2xs text-slate-500">
                        {dateSlots.length} Ujian Terjadwal
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sessions Rows */}
                <div className="divide-y divide-slate-100">
                  {activeSessions.map((session) => {
                    const sessionSlots = dateSlots.filter((s) => s.sessionId === session.id);

                    return (
                      <div key={session.id} className="p-4 flex flex-col md:flex-row gap-4">
                        {/* Session Time Badge */}
                        <div className="md:w-44 shrink-0 flex md:flex-col justify-between md:justify-start">
                          <div>
                            <span className="text-xs font-black text-slate-900 block">
                              {session.name}
                            </span>
                            <span className="text-2xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                              {minuteToTime(session.start_minute)} – {minuteToTime(session.end_minute)}
                            </span>
                          </div>
                          <span className="text-2xs text-slate-400 mt-1">
                            {sessionSlots.length} Kelas
                          </span>
                        </div>

                        {/* Slots Cards Grid */}
                        <div className="flex-1">
                          {sessionSlots.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-center text-2xs text-slate-400 font-medium">
                              Tidak ada ujian pada sesi ini
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {sessionSlots.map((slot) => (
                                <div
                                  key={slot.courseOfferingId}
                                  className={`p-3.5 rounded-xl border transition-all relative flex flex-col justify-between ${
                                    slot.isConflict
                                      ? 'bg-rose-50/70 border-rose-300 shadow-xs'
                                      : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-md'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-1 mb-1.5">
                                      <div>
                                        <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                                          {slot.courseName}
                                        </h4>
                                        <span className="text-2xs font-mono text-slate-400">
                                          {slot.courseCode}
                                        </span>
                                      </div>
                                      <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 text-2xs shrink-0">
                                        Kelas {slot.classCode}
                                      </span>
                                    </div>

                                    {/* Info chips */}
                                    <div className="space-y-1.5 text-2xs my-2">
                                      <div className="flex items-center gap-1.5 text-slate-600">
                                        <DoorOpen className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                        <span className="font-bold truncate">
                                          {slot.roomNames.join(' + ')}
                                        </span>
                                        <span className="text-slate-400 font-mono">
                                          ({slot.roomCapacity} kursi)
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5 text-slate-600">
                                        <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        <span className="font-bold text-slate-800">
                                          {slot.expectedStudents} Mhs
                                        </span>
                                        <span className="text-slate-400">• Sem {slot.semester}</span>
                                      </div>

                                      <div className="flex items-start gap-1.5 text-slate-600 pt-0.5 border-t border-slate-100">
                                        <span className="text-slate-400 font-medium shrink-0">
                                          Pengawas:
                                        </span>
                                        <span className="font-semibold text-slate-700 truncate">
                                          {slot.supervisorNames.join(', ')}
                                        </span>
                                      </div>
                                    </div>

                                    {slot.isConflict && (
                                      <div className="p-2 rounded-lg bg-rose-100/70 text-rose-800 text-2xs font-semibold space-y-0.5 mb-2">
                                        {slot.conflictReasons.map((r, rIdx) => (
                                          <p key={rIdx}>• {r}</p>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Card Action */}
                                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    <span className="text-2xs font-mono text-slate-400">
                                      {slot.durationMinutes} Menit
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenMoveModal(slot)}
                                      className="inline-flex items-center gap-1 text-2xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      Pindah Slot
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Move Modal */}
      {selectedSlotForMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pindah Slot Jadwal Ujian</h3>
                <p className="text-xs text-slate-500">{selectedSlotForMove.courseName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlotForMove(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pilih Tanggal Baru
                </label>
                <select
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                >
                  {datePool.map((d) => (
                    <option key={d.dateStr} value={d.dateStr}>
                      {d.formatted}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pilih Sesi Ujian Baru
                </label>
                <select
                  value={moveSessionId}
                  onChange={(e) => setMoveSessionId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                >
                  {activeSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({minuteToTime(s.start_minute)} – {minuteToTime(s.end_minute)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedSlotForMove(null)}
                className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyMove}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
              >
                Terapkan Perpindahan
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
          Kembali ke Tahap 3
        </button>

        <button
          type="button"
          disabled={slots.length === 0 || isSaving}
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
        >
          {isSaving ? 'Menyimpan ke Database...' : 'Lanjut ke Tahap 5: Preview & Publikasi'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
