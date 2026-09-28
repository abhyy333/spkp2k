import React, { useState, useMemo } from 'react';
import { CourseOffering, Lecturer } from '../../../types';
import {
  UserCheck,
  Search,
  RefreshCw,
  Edit,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { EditOfferingLecturerModal } from './EditOfferingLecturerModal';
import { toast } from '../../ui/Toast';

interface Step3LecturerAssignmentProps {
  selectedOfferings: CourseOffering[];
  lecturersList: Lecturer[];
  onRefreshFromMaster: () => Promise<void>;
  onSaveOfferingLecturers: (
    offeringId: string,
    assignments: { lecturer_id: string; assignment_role: string }[]
  ) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}

export const Step3LecturerAssignment: React.FC<Step3LecturerAssignmentProps> = ({
  selectedOfferings,
  lecturersList,
  onRefreshFromMaster,
  onSaveOfferingLecturers,
  onBack,
  onNext,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOfferingForEdit, setSelectedOfferingForEdit] = useState<CourseOffering | null>(null);

  // Filter offerings
  const filteredOfferings = useMemo(() => {
    return selectedOfferings.filter((o) => {
      const lecturers = o.course_offering_lecturers || o.lecturers || [];
      const hasLecturers = lecturers.length > 0;

      if (statusFilter === 'assigned' && !hasLecturers) return false;
      if (statusFilter === 'unassigned' && hasLecturers) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const cName = o.course?.name?.toLowerCase() || '';
        const cCode = o.course?.code?.toLowerCase() || '';
        const cls = o.class_code?.toLowerCase() || '';
        const lNames = lecturers.map((l) => l.lecturer?.name?.toLowerCase() || '').join(' ');
        return cName.includes(q) || cCode.includes(q) || cls.includes(q) || lNames.includes(q);
      }

      return true;
    });
  }, [selectedOfferings, statusFilter, search]);

  const totalAssigned = selectedOfferings.filter(
    (o) => (o.course_offering_lecturers?.length || o.lecturers?.length || 0) > 0
  ).length;
  const missingCount = selectedOfferings.length - totalAssigned;

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await onRefreshFromMaster();
      toast.success('Data dosen pengampu berhasil disinkronkan dari master.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyinkronkan data dosen.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleProceed = () => {
    if (missingCount > 0) {
      toast.error(
        `Terdapat ${missingCount} kelas yang belum memiliki dosen pengampu. Harap tentukan dosen sebelum melanjutkan.`
      );
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Penugasan Dosen Pengampu
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Alokasi dosen pengampu otomatis terbaca dari master dosen semester aktif. Pastikan setiap kelas telah memiliki minimal satu dosen pengampu.
            </p>
          </div>

          <button
            type="button"
            disabled={isRefreshing}
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer shrink-0 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sinkronkan dari Master</span>
          </button>
        </div>

        {/* Filter and stats */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari kelas, mata kuliah, dosen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">Semua Status Dosen</option>
              <option value="assigned">Terisi dari Master ({totalAssigned})</option>
              <option value="unassigned">Belum Ditentukan ({missingCount})</option>
            </select>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              {totalAssigned} / {selectedOfferings.length} Kelas Siap Dosen
            </span>
            {missingCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                {missingCount} Belum Ada Dosen
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lecturer Assignment Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-2xs sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Kode & Kelas</th>
                <th className="py-3 px-4">Mata Kuliah</th>
                <th className="py-3 px-3 text-center">Semester & SKS</th>
                <th className="py-3 px-3 text-center">Peserta</th>
                <th className="py-3 px-4">Dosen Pengampu</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOfferings.map((offering) => {
                const course = offering.course;
                const lecturers = offering.course_offering_lecturers || offering.lecturers || [];
                const hasLecturers = lecturers.length > 0;

                return (
                  <tr key={offering.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Code & Class */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-blue-100 text-blue-800 border border-blue-200">
                          Kelas {offering.class_code}
                        </span>
                        <span className="font-mono text-2xs text-slate-400">
                          {course?.code || '-'}
                        </span>
                      </div>
                    </td>

                    {/* Course Name */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900 leading-snug">
                        {course?.name || 'Mata Kuliah'}
                      </p>
                    </td>

                    {/* Semester & SKS */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="font-semibold text-slate-700">
                        Smt {course?.semester || 1} • {course?.effective_sks || 2} SKS
                      </span>
                    </td>

                    {/* Students */}
                    <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                      {offering.expected_students || 0} Mhs
                    </td>

                    {/* Dosen Pengampu List */}
                    <td className="py-3.5 px-4">
                      {hasLecturers ? (
                        <div className="space-y-1">
                          {lecturers.map((col, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 text-xs text-slate-800"
                            >
                              <span className="font-semibold">{col.lecturer?.name || 'Dosen'}</span>
                              <span
                                className={`text-3xs px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                                  col.assignment_role === 'KOORDINATOR'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {col.assignment_role || 'PENGAMPU'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-2xs text-amber-600 font-semibold italic flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          Dosen belum ditentukan
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {hasLecturers ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Terisi dari Master
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Belum Ditentukan
                        </span>
                      )}
                    </td>

                    {/* Edit Action */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedOfferingForEdit(offering)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit className="w-3 h-3" />
                        Ubah Dosen
                      </button>
                    </td>
                  </tr>
                );
              })}
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
          <span>Kembali ke Pembagian Rombel</span>
        </button>

        <div className="flex items-center gap-3">
          {missingCount > 0 && (
            <span className="text-2xs text-amber-700 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Lengkapi dosen untuk {missingCount} kelas sebelum melanjutkan
            </span>
          )}

          <button
            type="button"
            disabled={missingCount > 0}
            onClick={handleProceed}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <span>Lanjut ke Generate Jadwal Awal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Edit Offering Lecturer Modal */}
      {selectedOfferingForEdit && (
        <EditOfferingLecturerModal
          isOpen={Boolean(selectedOfferingForEdit)}
          onClose={() => setSelectedOfferingForEdit(null)}
          offering={selectedOfferingForEdit}
          lecturersList={lecturersList}
          onSaveLecturers={onSaveOfferingLecturers}
        />
      )}
    </div>
  );
};
