import React, { useState, useMemo } from 'react';
import { CourseOffering } from '../../../types';
import {
  BookOpen,
  Users,
  Layers,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Check,
  Plus,
} from 'lucide-react';
import { toast } from '../../ui/Toast';

interface Step2RombelReviewProps {
  selectedOfferings: CourseOffering[];
  onUpdateExpectedStudents: (offeringId: string, count: number) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}

export const Step2RombelReview: React.FC<Step2RombelReviewProps> = ({
  selectedOfferings,
  onUpdateExpectedStudents,
  onBack,
  onNext,
}) => {
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  const [editStudentValue, setEditStudentValue] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Group selected offerings by course
  const groupedCourses = useMemo(() => {
    const map = new Map<
      string,
      {
        courseId: string;
        courseName: string;
        courseCode: string;
        semester: number;
        sks: number;
        offerings: CourseOffering[];
      }
    >();

    selectedOfferings.forEach((offering) => {
      const cId = offering.course_id;
      const course = offering.course;
      const cName = course?.name || 'Mata Kuliah';
      const cCode = course?.code || '-';
      const sem = course?.semester || 1;
      const sks = course?.effective_sks || 2;

      if (!map.has(cId)) {
        map.set(cId, {
          courseId: cId,
          courseName: cName,
          courseCode: cCode,
          semester: sem,
          sks,
          offerings: [],
        });
      }
      map.get(cId)!.offerings.push(offering);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.semester !== b.semester) return a.semester - b.semester;
      return a.courseName.localeCompare(b.courseName);
    });
  }, [selectedOfferings]);

  // Overall statistics
  const totalCourses = groupedCourses.length;
  const totalClasses = selectedOfferings.length;
  const totalStudents = selectedOfferings.reduce(
    (acc, o) => acc + (o.expected_students || 0),
    0
  );

  const missingStudentsCount = selectedOfferings.filter(
    (o) => (o.expected_students || 0) <= 0
  ).length;

  const handleSaveStudent = async (offeringId: string) => {
    const val = parseInt(editStudentValue, 10);
    if (isNaN(val) || val <= 0) {
      toast.error('Jumlah peserta harus lebih besar dari 0.');
      return;
    }
    try {
      setSavingId(offeringId);
      await onUpdateExpectedStudents(offeringId, val);
      setEditingOfferingId(null);
      toast.success('Jumlah peserta berhasil diperbarui.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui jumlah peserta.');
    } finally {
      setSavingId(null);
    }
  };

  const handleProceed = () => {
    if (missingStudentsCount > 0) {
      toast.error(
        `Terdapat ${missingStudentsCount} kelas yang belum memiliki jumlah peserta. Harap lengkapi sebelum lanjut.`
      );
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
            2
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Pembagian Rombel & Review Kelas
            </h2>
            <p className="text-xs text-slate-500">
              Evaluasi rombel resmi (kelas A/B/C/INTER/REG) dan pastikan estimasi jumlah peserta telah terisi untuk setiap kelas.
            </p>
          </div>
        </div>

        {/* 3 Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4 pt-4 border-t border-slate-100">
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xs font-bold text-blue-800 uppercase tracking-wider">
                Mata Kuliah Aktif
              </p>
              <p className="text-xl font-extrabold text-slate-900">
                {totalCourses} <span className="text-xs font-semibold text-slate-500">MK</span>
              </p>
            </div>
          </div>

          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xs font-bold text-indigo-800 uppercase tracking-wider">
                Total Kelas / Rombel
              </p>
              <p className="text-xl font-extrabold text-slate-900">
                {totalClasses} <span className="text-xs font-semibold text-slate-500">Kelas</span>
              </p>
            </div>
          </div>

          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xs font-bold text-emerald-800 uppercase tracking-wider">
                Total Peserta
              </p>
              <p className="text-xl font-extrabold text-slate-900">
                {totalStudents.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-semibold text-slate-500">Mahasiswa</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rombel Review Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-2xs">
              <tr>
                <th className="py-3 px-4">Mata Kuliah</th>
                <th className="py-3 px-3 text-center">Semester & SKS</th>
                <th className="py-3 px-3 text-center">Jumlah Kelas</th>
                <th className="py-3 px-3 text-center">Total Peserta</th>
                <th className="py-3 px-4">Rincian Kelas & Peserta</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedCourses.map((group) => {
                const groupTotalStudents = group.offerings.reduce(
                  (acc, o) => acc + (o.expected_students || 0),
                  0
                );
                const hasZeroInGroup = group.offerings.some(
                  (o) => (o.expected_students || 0) <= 0
                );

                return (
                  <tr key={group.courseId} className="hover:bg-slate-50/70 transition-colors">
                    {/* Course Code & Name */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900 text-sm leading-snug">
                        {group.courseName}
                      </p>
                      <span className="font-mono text-2xs text-slate-400">
                        {group.courseCode}
                      </span>
                    </td>

                    {/* Semester & SKS */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="font-semibold text-slate-700">
                          Semester {group.semester}
                        </span>
                        <span className="text-3xs font-medium text-slate-400">
                          {group.sks} SKS ({group.sks * 50} mnt)
                        </span>
                      </div>
                    </td>

                    {/* Class Count */}
                    <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                      {group.offerings.length} Kelas
                    </td>

                    {/* Total Students */}
                    <td className="py-3.5 px-3 text-center font-extrabold text-slate-900">
                      {groupTotalStudents} Mhs
                    </td>

                    {/* Class Chips with Inline Editing */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {group.offerings.map((offering) => {
                          const isEditing = editingOfferingId === offering.id;
                          const exp = offering.expected_students || 0;
                          const isExpValid = exp > 0;

                          if (isEditing) {
                            return (
                              <div
                                key={offering.id}
                                className="flex items-center gap-1 p-1 bg-blue-50 border border-blue-300 rounded-lg"
                              >
                                <span className="text-2xs font-bold text-blue-800 px-1">
                                  {offering.class_code}:
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={200}
                                  value={editStudentValue}
                                  onChange={(e) => setEditStudentValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveStudent(offering.id);
                                    if (e.key === 'Escape') setEditingOfferingId(null);
                                  }}
                                  autoFocus
                                  className="w-14 px-1.5 py-0.5 text-xs font-bold border border-blue-400 rounded bg-white text-center focus:outline-none"
                                />
                                <button
                                  type="button"
                                  disabled={savingId === offering.id}
                                  onClick={() => handleSaveStudent(offering.id)}
                                  className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={offering.id}
                              onClick={() => {
                                setEditingOfferingId(offering.id);
                                setEditStudentValue(String(exp || '40'));
                              }}
                              className={`group/chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-2xs font-semibold cursor-pointer transition-all ${
                                isExpValid
                                  ? 'bg-blue-50/70 border-blue-200 text-blue-900 hover:bg-blue-100'
                                  : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 animate-pulse'
                              }`}
                              title="Klik untuk mengubah jumlah peserta"
                            >
                              <span className="font-bold">Kelas {offering.class_code}:</span>
                              <span>{isExpValid ? `${exp} Mhs` : '0 (Isi)'}</span>
                              <Edit2 className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover/chip:opacity-100 transition-opacity" />
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {!hasZeroInGroup ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Siap Dosen
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Jumlah Peserta Belum Lengkap
                        </span>
                      )}
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
          <span>Kembali ke Pemilihan MK</span>
        </button>

        <div className="flex items-center gap-3">
          {missingStudentsCount > 0 && (
            <span className="text-2xs text-amber-700 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Lengkapi {missingStudentsCount} kelas sebelum melanjutkan
            </span>
          )}

          <button
            type="button"
            disabled={missingStudentsCount > 0}
            onClick={handleProceed}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <span>Lanjut ke Penugasan Dosen</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
