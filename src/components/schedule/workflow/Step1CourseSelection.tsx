import React, { useState, useMemo } from 'react';
import { CourseOffering, AcademicTerm } from '../../../types';
import {
  BookOpen,
  Search,
  Filter,
  CheckSquare,
  Square,
  AlertCircle,
  ArrowRight,
  Layers,
  Sparkles,
  Edit2,
  Check,
} from 'lucide-react';
import { toast } from '../../ui/Toast';
import { courseOfferingsService } from '../../../services/courseOfferings.service';

interface Step1CourseSelectionProps {
  activeTerm: AcademicTerm | null;
  offerings: CourseOffering[];
  selectedOfferingIds: Set<string>;
  onToggleOffering: (offeringId: string) => void;
  onSelectMultipleOfferings: (offeringIds: string[], select: boolean) => void;
  onUpdateExpectedStudents: (offeringId: string, count: number) => Promise<void>;
  onNext: () => void;
}

export const Step1CourseSelection: React.FC<Step1CourseSelectionProps> = ({
  activeTerm,
  offerings,
  selectedOfferingIds,
  onToggleOffering,
  onSelectMultipleOfferings,
  onUpdateExpectedStudents,
  onNext,
}) => {
  const [mode, setMode] = useState<'TEMPLATE' | 'CUSTOM'>('TEMPLATE');
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [curriculumFilter, setCurriculumFilter] = useState<string>('all');
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  const [editStudentValue, setEditStudentValue] = useState<string>('');
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);

  const isGanjil = (activeTerm?.semester_type || 'GANJIL').toUpperCase() === 'GANJIL';
  const templateSemesters = isGanjil ? [1, 3, 5, 7] : [2, 4, 6, 8];

  // Unique curriculums present in offerings
  const availableCurriculums = useMemo(() => {
    const list: string[] = [];
    offerings.forEach((o) => {
      const cYear = o.course?.curriculum?.name || o.course?.curriculum?.year;
      if (cYear && !list.includes(String(cYear))) {
        list.push(String(cYear));
      }
    });
    return list.sort();
  }, [offerings]);

  // Filter offerings based on mode and inputs
  const filteredOfferings = useMemo(() => {
    return offerings.filter((o) => {
      const sem = o.course?.semester || 1;

      // In Template mode, enforce template semesters by default unless filter is set
      if (mode === 'TEMPLATE' && semesterFilter === 'all') {
        if (!templateSemesters.includes(sem)) return false;
      } else if (semesterFilter !== 'all') {
        if (String(sem) !== semesterFilter) return false;
      }

      // Curriculum filter
      if (curriculumFilter !== 'all') {
        const cYear = String(o.course?.curriculum?.name || o.course?.curriculum?.year || '');
        if (!cYear.includes(curriculumFilter)) return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const cName = o.course?.name?.toLowerCase() || '';
        const cCode = o.course?.code?.toLowerCase() || '';
        const cls = o.class_code?.toLowerCase() || '';
        const kbkName = o.course?.kbk?.name?.toLowerCase() || '';
        return cName.includes(q) || cCode.includes(q) || cls.includes(q) || kbkName.includes(q);
      }

      return true;
    });
  }, [offerings, mode, templateSemesters, semesterFilter, curriculumFilter, search]);

  // Handle select all from template
  const handleSelectAllTemplate = () => {
    const templateIds = offerings
      .filter((o) => templateSemesters.includes(o.course?.semester || 1))
      .map((o) => o.id);
    onSelectMultipleOfferings(templateIds, true);
    toast.success(`Semua kelas Semester ${templateSemesters.join(', ')} telah dipilih.`);
  };

  const handleClearAll = () => {
    onSelectMultipleOfferings(offerings.map((o) => o.id), false);
    toast.info('Pilihan kelas dikosongkan.');
  };

  const handleSelectSemester = (sem: number, select: boolean) => {
    const targetIds = offerings
      .filter((o) => (o.course?.semester || 1) === sem)
      .map((o) => o.id);
    onSelectMultipleOfferings(targetIds, select);
    if (select) {
      toast.success(`Semua kelas Semester ${sem} dipilih.`);
    } else {
      toast.info(`Pilihan kelas Semester ${sem} dibatalkan.`);
    }
  };

  // Save student count inline
  const handleSaveStudentCount = async (offeringId: string) => {
    const val = parseInt(editStudentValue, 10);
    if (isNaN(val) || val < 0) {
      toast.error('Jumlah peserta harus angka positif.');
      return;
    }
    try {
      setSavingStudentId(offeringId);
      await onUpdateExpectedStudents(offeringId, val);
      setEditingOfferingId(null);
      toast.success('Jumlah peserta berhasil diperbarui.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui jumlah peserta.');
    } finally {
      setSavingStudentId(null);
    }
  };

  // Stats
  const selectedCount = selectedOfferingIds.size;
  const selectedOfferings = offerings.filter((o) => selectedOfferingIds.has(o.id));
  const missingStudentsCount = selectedOfferings.filter(
    (o) => (o.expected_students || 0) <= 0
  ).length;

  return (
    <div className="space-y-4">
      {/* Step Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Pemilihan Mata Kuliah & Kelas
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Pilih mata kuliah dan kelas (rombel) yang akan dijadwalkan pada periode{' '}
              <strong className="text-slate-800">
                {activeTerm?.academic_year || '2026/2027'} {activeTerm?.semester_type || 'GANJIL'}
              </strong>
              .
            </p>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => {
                setMode('TEMPLATE');
                setSemesterFilter('all');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'TEMPLATE'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A. Template Semester ({isGanjil ? '1, 3, 5, 7' : '2, 4, 6, 8'})
            </button>
            <button
              type="button"
              onClick={() => setMode('CUSTOM')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'CUSTOM'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              B. Kustom Manual
            </button>
          </div>
        </div>

        {/* Filter Bar & Quick Actions */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari mata kuliah, kode, KBK..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Semester Filter */}
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">
                {mode === 'TEMPLATE'
                  ? `Semua Semester Template (${templateSemesters.join(', ')})`
                  : 'Semua Semester (1–8)'}
              </option>
              {(mode === 'TEMPLATE' ? templateSemesters : [1, 2, 3, 4, 5, 6, 7, 8]).map((s) => (
                <option key={s} value={String(s)}>
                  Semester {s}
                </option>
              ))}
            </select>

            {/* Curriculum Filter */}
            <select
              value={curriculumFilter}
              onChange={(e) => setCurriculumFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">Semua Kurikulum</option>
              <option value="2022">Kurikulum 2022</option>
              <option value="2026">Kurikulum 2026</option>
              {availableCurriculums
                .filter((c) => !c.includes('2022') && !c.includes('2026'))
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          {/* Quick Selection Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllTemplate}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Pilih Semua dari Template
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              Kosongkan Semua
            </button>
          </div>
        </div>

        {/* Semester Quick Toggle Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-2xs">
          <span className="text-slate-400 font-semibold mr-1">Pilih Per Semester:</span>
          {templateSemesters.map((sem) => {
            const semOfferings = offerings.filter((o) => (o.course?.semester || 1) === sem);
            const allSelected =
              semOfferings.length > 0 &&
              semOfferings.every((o) => selectedOfferingIds.has(o.id));

            return (
              <button
                key={sem}
                type="button"
                onClick={() => handleSelectSemester(sem, !allSelected)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all border cursor-pointer ${
                  allSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Semester {sem} ({semOfferings.length} Kelas)
              </button>
            );
          })}
        </div>
      </div>

      {/* Offerings Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-2xs sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Pilih</th>
                <th className="py-3 px-4">Kode & Mata Kuliah</th>
                <th className="py-3 px-3 text-center">Kelas</th>
                <th className="py-3 px-3 text-center">Semester</th>
                <th className="py-3 px-3 text-center">SKS</th>
                <th className="py-3 px-4">Kurikulum</th>
                <th className="py-3 px-4">KBK</th>
                <th className="py-3 px-4 text-center">Jumlah Peserta</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOfferings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Tidak ada penawaran kelas yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredOfferings.map((offering) => {
                  const course = offering.course;
                  const isSelected = selectedOfferingIds.has(offering.id);
                  const expected = offering.expected_students || 0;
                  const hasStudents = expected > 0;
                  const isEditing = editingOfferingId === offering.id;
                  const currLabel =
                    course?.curriculum?.name ||
                    (course?.curriculum?.year ? `Kurikulum ${course?.curriculum?.year}` : 'Kurikulum 2022');
                  const kbkLabel = course?.kbk?.name || course?.kbk?.code || '-';

                  return (
                    <tr
                      key={offering.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/40 hover:bg-blue-50/70'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleOffering(offering.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                      </td>

                      {/* Course Code & Name */}
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800 leading-snug">
                          {course?.name || 'Mata Kuliah'}
                        </p>
                        <span className="font-mono text-2xs text-slate-400">
                          {course?.code || '-'}
                        </span>
                      </td>

                      {/* Class Code */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-blue-100 text-blue-800 border border-blue-200">
                          Kelas {offering.class_code}
                        </span>
                      </td>

                      {/* Semester */}
                      <td className="py-3 px-3 text-center font-semibold text-slate-700">
                        Smt {course?.semester || 1}
                      </td>

                      {/* SKS */}
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {course?.effective_sks || 2} SKS
                      </td>

                      {/* Curriculum */}
                      <td className="py-3 px-4 text-slate-600 text-2xs">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-medium">
                          {currLabel}
                        </span>
                      </td>

                      {/* KBK */}
                      <td className="py-3 px-4 text-slate-600 text-2xs font-medium">
                        {kbkLabel}
                      </td>

                      {/* Jumlah Peserta with Inline Edit */}
                      <td className="py-3 px-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={editStudentValue}
                              onChange={(e) => setEditStudentValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveStudentCount(offering.id);
                                if (e.key === 'Escape') setEditingOfferingId(null);
                              }}
                              autoFocus
                              className="w-16 px-2 py-1 text-center text-xs font-bold border border-blue-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            />
                            <button
                              type="button"
                              disabled={savingStudentId === offering.id}
                              onClick={() => handleSaveStudentCount(offering.id)}
                              className="p-1 text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingOfferingId(offering.id);
                              setEditStudentValue(String(expected || '40'));
                            }}
                            className="group/peserta inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-100 cursor-pointer border border-transparent hover:border-slate-200 transition-all"
                            title="Klik untuk mengubah jumlah peserta"
                          >
                            <span
                              className={`font-bold ${
                                hasStudents ? 'text-slate-800' : 'text-amber-600'
                              }`}
                            >
                              {hasStudents ? `${expected} Mhs` : '0 (Belum diisi)'}
                            </span>
                            <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/peserta:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {hasStudents ? (
                          <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Siap
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Peserta Belum Diisi
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Sticky Status Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span>
              <strong className="text-slate-900 font-bold">{selectedCount}</strong> Offering Dipilih
            </span>
          </div>

          <span>•</span>

          <div>
            {missingStudentsCount > 0 ? (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                {missingStudentsCount} Offering Belum Diisi Jumlah Peserta
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold">
                Semua offering terpilih telah memiliki jumlah peserta
              </span>
            )}
          </div>
        </div>

        {/* Next Button */}
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onNext}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <span>Lanjut ke Pembagian Rombel</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
