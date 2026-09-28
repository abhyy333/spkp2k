import React, { useState, useMemo } from 'react';
import {
  Users,
  DoorOpen,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { ExamSourceOffering, Room, Lecturer } from '../../../types';
import { allocateRoomsForExam } from '../../../services/examGenerator.service';

interface ExamStep3SupervisorsRoomsProps {
  sourceOfferings: ExamSourceOffering[];
  rooms: Room[];
  lecturers: Lecturer[];
  supervisorAssignments: Record<string, { primaryId: string; secondaryId?: string }>;
  roomPreferences: Record<string, string[]>;
  onChangeSupervisor: (
    offeringId: string,
    assignment: { primaryId: string; secondaryId?: string }
  ) => void;
  onChangeRoomPreference: (offeringId: string, roomIds: string[]) => void;
  onAutoAllocateAllRooms: () => void;
  onNext: () => void;
  onBack: () => void;
}

export const ExamStep3SupervisorsRooms: React.FC<ExamStep3SupervisorsRoomsProps> = ({
  sourceOfferings,
  rooms,
  lecturers,
  supervisorAssignments,
  roomPreferences,
  onChangeSupervisor,
  onChangeRoomPreference,
  onAutoAllocateAllRooms,
  onNext,
  onBack,
}) => {
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);

  // Map active lecturers
  const activeLecturers = useMemo(() => {
    return lecturers.filter((l: any) => l.is_active !== false && l.status !== 'INACTIVE');
  }, [lecturers]);

  // Map rooms
  const roomMap = useMemo(() => {
    const map = new Map<string, Room>();
    rooms.forEach((r) => map.set(r.id, r));
    return map;
  }, [rooms]);

  // Compute room status per offering
  const offeringRoomSummaries = useMemo(() => {
    const res: Record<
      string,
      {
        roomIds: string[];
        roomNames: string[];
        totalCapacity: number;
        studentCount: number;
        isSufficient: boolean;
        waste: number;
      }
    > = {};

    sourceOfferings.forEach((offering) => {
      const studentCount = offering.student_count || 40;
      const prefIds =
        roomPreferences[offering.course_offering_id] ||
        (offering.preferred_room_id ? [offering.preferred_room_id] : undefined);

      const alloc = allocateRoomsForExam(
        studentCount,
        rooms,
        prefIds,
        offering.required_room_type
      );

      res[offering.course_offering_id] = {
        roomIds: alloc ? alloc.roomIds : [],
        roomNames: alloc ? alloc.roomNames : ['Belum Dialokasi'],
        totalCapacity: alloc ? alloc.totalCapacity : 0,
        studentCount,
        isSufficient: alloc ? alloc.totalCapacity >= studentCount : false,
        waste: alloc ? alloc.totalCapacity - studentCount : 0,
      };
    });

    return res;
  }, [sourceOfferings, rooms, roomPreferences]);

  // Count capacity issues
  const capacityIssuesCount = useMemo(() => {
    return Object.values(offeringRoomSummaries).filter((s) => !s.isSufficient).length;
  }, [offeringRoomSummaries]);

  // Auto assign single offering room
  const handleAutoAssignRoom = (offering: ExamSourceOffering) => {
    const prefIds = offering.preferred_room_id ? [offering.preferred_room_id] : undefined;
    const alloc = allocateRoomsForExam(
      offering.student_count,
      rooms,
      prefIds,
      offering.required_room_type
    );
    if (alloc) {
      onChangeRoomPreference(offering.course_offering_id, alloc.roomIds);
    }
  };

  // Auto assign all secondary supervisors evenly
  const handleAutoAssignAllSupervisors = () => {
    sourceOfferings.forEach((offering, idx) => {
      const eligible = activeLecturers.filter((l) => l.id !== offering.primary_lecturer_id);
      if (eligible.length > 0) {
        const secondary = eligible[idx % eligible.length].id;
        onChangeSupervisor(offering.course_offering_id, {
          primaryId: offering.primary_lecturer_id,
          secondaryId: secondary,
        });
      }
    });
  };

  const handleProceed = () => {
    // Ensure all offerings have secondary supervisor before proceeding
    sourceOfferings.forEach((offering, idx) => {
      const current = supervisorAssignments[offering.course_offering_id];
      if (!current?.secondaryId || current.secondaryId === offering.primary_lecturer_id) {
        const eligible = activeLecturers.filter((l) => l.id !== offering.primary_lecturer_id);
        const secondary = eligible.length > 0 ? eligible[idx % eligible.length].id : offering.primary_lecturer_id;
        onChangeSupervisor(offering.course_offering_id, {
          primaryId: offering.primary_lecturer_id,
          secondaryId: secondary,
        });
      }
    });
    onNext();
  };

  const handleToggleRoomInPreference = (offering: ExamSourceOffering, roomId: string) => {
    const current =
      roomPreferences[offering.course_offering_id] ||
      offeringRoomSummaries[offering.course_offering_id]?.roomIds ||
      [];
    let updated: string[];
    if (current.includes(roomId)) {
      updated = current.filter((id) => id !== roomId);
    } else {
      updated = [...current, roomId];
    }
    onChangeRoomPreference(offering.course_offering_id, updated);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Info */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800">
                Tahap 3 dari 5
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Penetapan Pengawas & Alokasi Ruangan
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Review Pengawas & Ruangan Ujian
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pengawas 1 otomatis ditetapkan dari Dosen Pengampu Utama. Admin dapat menambahkan Pengawas 2 dan menyesuaikan alokasi ruangan.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleAutoAssignAllSupervisors}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Users className="w-4 h-4 text-purple-600" />
              Auto Tugaskan Pengawas 2
            </button>

            <button
              type="button"
              onClick={onAutoAllocateAllRooms}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Auto Alokasikan Semua Ruang
            </button>
          </div>
        </div>
      </div>

      {capacityIssuesCount > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold">
              Terdapat {capacityIssuesCount} kelas ujian dengan kapasitas ruangan kurang dari jumlah peserta!
            </p>
            <p className="text-amber-700 mt-0.5">
              Gunakan tombol "Auto Alokasikan Semua Ruang" atau pilih kombinasi multi-ruang per kelas agar kapasitas mencukupi.
            </p>
          </div>
        </div>
      )}

      {/* Offerings List & Configuration */}
      <div className="space-y-3">
        {sourceOfferings.map((offering) => {
          const assignment = supervisorAssignments[offering.course_offering_id] || {
            primaryId: offering.primary_lecturer_id,
            secondaryId: '',
          };

          const roomSummary = offeringRoomSummaries[offering.course_offering_id];
          const isConfiguringRooms = editingOfferingId === offering.course_offering_id;

          return (
            <div
              key={offering.course_offering_id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{offering.course_name}</h3>
                    <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 text-2xs">
                      Kelas {offering.class_code}
                    </span>
                    <span className="text-2xs font-semibold text-slate-500">
                      • Sem {offering.semester} ({offering.effective_sks} SKS)
                    </span>
                  </div>
                  <span className="text-2xs font-mono text-slate-400">{offering.course_code}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-800">{offering.student_count}</span>
                    <span className="text-slate-500 text-2xs">Peserta</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold ${
                      roomSummary?.isSufficient
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>
                      {roomSummary?.roomNames?.join(' + ') || 'Belum Ada Ruang'}
                    </span>
                    <span className="font-bold font-mono">
                      ({roomSummary?.totalCapacity || 0} kursi)
                    </span>
                  </div>
                </div>
              </div>

              {/* Assignment Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supervisors Controls */}
                <div className="space-y-2">
                  <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Dosen Pengawas Ujian
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Pengawas 1 (Read Only Dosen Pengampu) */}
                    <div>
                      <span className="text-2xs text-slate-500 block mb-0.5 font-medium">
                        Pengawas 1 (Dosen Pengampu)
                      </span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{offering.primary_lecturer_name || 'Dosen Pengampu'}</span>
                      </div>
                    </div>

                    {/* Pengawas 2 (Manual Admin Dropdown) */}
                    <div>
                      <span className="text-2xs text-slate-500 block mb-0.5 font-medium">
                        Pengawas 2 (Opsional)
                      </span>
                      <select
                        value={assignment.secondaryId || ''}
                        onChange={(e) =>
                          onChangeSupervisor(offering.course_offering_id, {
                            primaryId: offering.primary_lecturer_id,
                            secondaryId: e.target.value || undefined,
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-800"
                      >
                        <option value="">-- Tanpa Pengawas 2 --</option>
                        {activeLecturers
                          .filter((l) => l.id !== offering.primary_lecturer_id)
                          .map((lec) => (
                            <option key={lec.id} value={lec.id}>
                              {lec.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Rooms Preference & Multi-Room Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <DoorOpen className="w-3.5 h-3.5 text-purple-600" />
                      Alokasi Ruangan Ujian
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAutoAssignRoom(offering)}
                        className="text-2xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Auto Pilih
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingOfferingId(
                            isConfiguringRooms ? null : offering.course_offering_id
                          )
                        }
                        className="text-2xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                      >
                        {isConfiguringRooms ? 'Selesai Pilih' : 'Pilih Ruang Lain'}
                      </button>
                    </div>
                  </div>

                  {/* Summary chips */}
                  {!isConfiguringRooms && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {roomSummary?.roomIds?.map((rId) => {
                          const r = roomMap.get(rId);
                          return (
                            <span
                              key={rId}
                              className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold text-2xs"
                            >
                              {r?.code || r?.name} ({r?.capacity} kursi)
                            </span>
                          );
                        })}
                      </div>
                      <span
                        className={`text-2xs font-bold ${
                          roomSummary?.waste >= 0 ? 'text-slate-500' : 'text-rose-600'
                        }`}
                      >
                        {roomSummary?.waste >= 0
                          ? `Sisa ${roomSummary.waste} kursi`
                          : `Kurang ${Math.abs(roomSummary.waste)} kursi`}
                      </span>
                    </div>
                  )}

                  {/* Interactive Room Checkboxes dropdown */}
                  {isConfiguringRooms && (
                    <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2 max-h-40 overflow-y-auto">
                      <p className="text-2xs text-blue-800 font-semibold">
                        Pilih satu atau kombinasi ruangan untuk kelas ini:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {rooms
                          .filter((r) => {
                            if (r.is_active === false) return false;
                            const isLab = (r.room_type || '').toUpperCase().includes('LAB');
                            const reqLab = (offering.required_room_type || '').toUpperCase().includes('LAB');
                            return reqLab ? isLab : !isLab;
                          })
                          .map((r) => {
                            const isChecked = roomSummary?.roomIds?.includes(r.id);
                            return (
                              <label
                                key={r.id}
                                className={`p-2 rounded-lg border text-2xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() =>
                                    handleToggleRoomInPreference(offering, r.id)
                                  }
                                  className="w-3.5 h-3.5 rounded-sm"
                                />
                                <span className="truncate">{r.code || r.name}</span>
                                <span className="text-2xs opacity-80">({r.capacity})</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200/80">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Tahap 2
        </button>

        <button
          type="button"
          onClick={handleProceed}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          Lanjut ke Tahap 4: Generate Jadwal Ujian
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
