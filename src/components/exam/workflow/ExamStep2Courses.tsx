import React, { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Users,
  DoorOpen,
  UserCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { ExamSourceOffering, Room } from '../../../types';
import { allocateRoomsForExam } from '../../../services/examGenerator.service';

interface ExamStep2CoursesProps {
  examType: 'UTS' | 'UAS';
  sourceOfferings: ExamSourceOffering[];
  rooms: Room[];
  isLoading?: boolean;
  onRefreshSource?: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}

export const ExamStep2Courses: React.FC<ExamStep2CoursesProps> = ({
  examType,
  sourceOfferings,
  rooms,
  isLoading = false,
  onRefreshSource,
  onNext,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');

  // Filtered by UI search & filters
  const filteredOfferings = useMemo(() => {
    return sourceOfferings.filter((offering) => {
      const cName = (offering.course_name || '').toLowerCase();
      const cCode = (offering.course_code || '').toLowerCase();
      const clCode = (offering.class_code || 'A').toUpperCase();
      const sem = String(offering.semester || '');

      if (
        searchQuery &&
        !cName.includes(searchQuery.toLowerCase()) &&
        !cCode.includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      if (semesterFilter !== 'ALL' && sem !== semesterFilter) {
        return false;
      }

      if (classFilter !== 'ALL' && clCode !== classFilter) {
        return false;
      }

      return true;
    });
  }, [sourceOfferings, searchQuery, semesterFilter, classFilter]);

  const totalParticipants = useMemo(() => {
    return sourceOfferings.reduce((sum, o) => sum + (o.student_count || 0), 0);
  }, [sourceOfferings]);

  const uniqueLecturersCount = useMemo(() => {
    return new Set(sourceOfferings.map((o) => o.primary_lecturer_id || o.primary_lecturer_name)).size;
  }, [sourceOfferings]);

  // Compute recommended room helper
  const getRoomRecommendation = (item: ExamSourceOffering) => {
    if (
      item.preferred_room_id &&
      item.preferred_room_capacity &&
      item.preferred_room_capacity >= item.student_count
    ) {
      return {
        name: item.preferred_room_code || item.preferred_room_name || 'Ruang Kuliah',
        capacity: item.preferred_room_capacity,
        isFromLecture: true,
      };
    }

    const alloc = allocateRoomsForExam(
      item.student_count,
      rooms,
      item.preferred_room_id ? [item.preferred_room_id] : undefined,
      item.required_room_type
    );

    return {
      name: alloc ? alloc.roomNames.join(' + ') : 'Ruang Teori',
      capacity: alloc ? alloc.totalCapacity : 0,
      isFromLecture: false,
    };
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Info */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800">
                Tahap 2 dari 5
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Review Mata Kuliah Ujian
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Mata Kuliah Ujian ({examType})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mata kuliah dan kelas diambil otomatis dari Jadwal Perkuliahan resmi periode aktif.
            </p>
          </div>

          {/* Compact Summary Bar */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-900">{sourceOfferings.length}</span>
              <span>Kelas Ujian</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-slate-900 font-mono">{totalParticipants}</span>
              <span>Peserta</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-900">{uniqueLecturersCount}</span>
              <span>Dosen Pengampu</span>
            </div>
            {onRefreshSource && (
              <button
                type="button"
                onClick={onRefreshSource}
                disabled={isLoading}
                className="ml-2 p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                title="Sinkronisasi Ulang Jadwal Perkuliahan"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari kode atau nama mata kuliah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
          >
            <option value="ALL">Semua Semester</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={String(sem)}>
                Semester {sem}
              </option>
            ))}
          </select>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
          >
            <option value="ALL">Semua Kelas</option>
            {['A', 'B', 'C', 'INTER'].map((cls) => (
              <option key={cls} value={cls}>
                Kelas {cls}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Offerings Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
            Memuat data mata kuliah dari Jadwal Perkuliahan resmi...
          </div>
        ) : filteredOfferings.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak Ada Mata Kuliah Ditemukan</p>
            <p className="text-xs text-slate-500 mt-1">
              {sourceOfferings.length === 0
                ? 'Belum ada jadwal perkuliahan resmi yang diterbitkan untuk periode semester ini.'
                : 'Coba sesuaikan kata kunci pencarian atau filter semester / kelas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Kode & Mata Kuliah</th>
                  <th className="py-3 px-3 text-center">Kelas</th>
                  <th className="py-3 px-3 text-center">Semester</th>
                  <th className="py-3 px-3 text-center">SKS</th>
                  <th className="py-3 px-4 text-right">Jumlah Peserta</th>
                  <th className="py-3 px-4">Dosen Pengampu</th>
                  <th className="py-3 px-4">Rekomendasi Ruang</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOfferings.map((item, idx) => {
                  const roomRec = getRoomRecommendation(item);

                  return (
                    <tr key={item.course_offering_id || item.schedule_entry_id || idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{item.course_name}</p>
                        <span className="text-2xs font-mono text-slate-400">{item.course_code}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 text-2xs">
                          {item.class_code || 'A'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        Sem {item.semester}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {item.effective_sks} SKS
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 font-mono">
                        {item.student_count} peserta
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {item.primary_lecturer_name || 'Dosen Pengampu'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold">{roomRec.name}</span>
                          <span className="text-2xs text-slate-500 font-mono">
                            ({roomRec.capacity} kursi)
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Siap {examType}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar / Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200/80">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Tahap 1
        </button>

        <div className="text-xs text-slate-500 hidden sm:block">
          <span className="font-semibold text-slate-800">{sourceOfferings.length}</span> kelas siap dialokasikan pengawas & ruangan
        </div>

        <button
          type="button"
          disabled={sourceOfferings.length === 0}
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
        >
          Lanjut ke Tahap 3: Pengawas & Ruangan
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
