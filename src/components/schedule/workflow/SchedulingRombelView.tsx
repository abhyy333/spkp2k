import React, { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  Users,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Save,
  ArrowLeft,
  ArrowRight,
  Split,
  ChevronRight,
  Armchair,
  Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CourseRombelGroup, CourseOfferingRombelItem } from '../../../types';
import { cn } from '../../../lib/utils';
import { normalizeParticipantInput, isPracticum } from '../../../lib/distributionUtils';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

interface SchedulingRombelViewProps {
  groups: CourseRombelGroup[];
  selectedSemesterType: 'GANJIL' | 'GENAP';
  selectedSemesterFilter: number | 'ALL';
  onChangeSemesterFilter: (filter: number | 'ALL') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleOfferingActive: (offeringId: string) => void;
  onUpdateOfferingParticipants: (offeringId: string, count: number) => void;
  onSelectSectionCount?: (group: CourseRombelGroup, count: number) => void;
  onAutoDistributeCourse: (group: CourseRombelGroup) => void;
  onRecalculateCourse: (group: CourseRombelGroup) => void;
  onAutoDistributeAll: () => void;
  onRecalculateAll: () => void;
  saving: boolean;
  hasUnsavedChanges: boolean;
  onSaveRombel: () => void;
  onBackToStep1: () => void;
  onContinueToStep3: () => void;
}

export const SchedulingRombelView: React.FC<SchedulingRombelViewProps> = ({
  groups,
  selectedSemesterType,
  selectedSemesterFilter,
  onChangeSemesterFilter,
  searchQuery,
  onSearchChange,
  onToggleOfferingActive,
  onUpdateOfferingParticipants,
  onSelectSectionCount,
  onAutoDistributeCourse,
  onRecalculateCourse,
  onAutoDistributeAll,
  onRecalculateAll,
  saving,
  hasUnsavedChanges,
  onSaveRombel,
  onBackToStep1,
  onContinueToStep3,
}) => {
  const [confirmRecalculateAllOpen, setConfirmRecalculateAllOpen] = useState(false);
  const [confirmRecalculateGroup, setConfirmRecalculateGroup] = useState<CourseRombelGroup | null>(null);

  const termSemesters = useMemo(() => {
    return selectedSemesterType === 'GANJIL' ? [1, 3, 5, 7] : [2, 4, 6, 8];
  }, [selectedSemesterType]);

  // Separate Theory and Practicum groups
  // "Praktikum TIDAK BOLEH masuk proses pembagian rombel, distribusi peserta, dan kapasitas ruang"
  const theoryGroups = useMemo(() => groups.filter((g) => !isPracticum(g)), [groups]);
  const practicumGroups = useMemo(() => groups.filter((g) => isPracticum(g)), [groups]);

  // Filter theory groups by semester and search query
  const filteredTheoryGroups = useMemo(() => {
    return theoryGroups.filter((g) => {
      // Semester filter
      if (selectedSemesterFilter !== 'ALL' && g.semester !== selectedSemesterFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = g.courseCode.toLowerCase().includes(q);
        const matchName = g.courseName.toLowerCase().includes(q);
        if (!matchCode && !matchName) return false;
      }
      return true;
    });
  }, [theoryGroups, selectedSemesterFilter, searchQuery]);

  // Summary statistics calculated in real-time strictly for theory courses
  const totalCourses = theoryGroups.length;
  const completedCourses = theoryGroups.filter(
    (g) => g.status === 'LENGKAP' || g.status === 'TIDAK_ADA_KELAS'
  ).length;
  const activeOfferingsCount = theoryGroups.reduce(
    (acc, g) => acc + g.offerings.filter((o) => o.active).length,
    0
  );
  const totalPlannedStudents = theoryGroups.reduce((acc, g) => acc + g.totalParticipantsStep1, 0);
  const totalDistributedStudents = theoryGroups.reduce((acc, g) => acc + g.totalDistributed, 0);
  const totalEstimatedSeatWaste = theoryGroups.reduce((acc, g) => acc + (g.totalSeatWaste || 0), 0);

  // Overall validity check: every theory course with offerings must have status === 'LENGKAP'
  // (Praktikum is completely excluded from blocking Step 2 validity!)
  const isAllValid =
    theoryGroups.length > 0 &&
    theoryGroups.every((g) => g.status === 'LENGKAP' || g.status === 'TIDAK_ADA_KELAS');

  const hasInfeasibleCourses = theoryGroups.some((g) => g.status === 'TIDAK_FEASIBLE');

  return (
    <div className="space-y-6 pb-28">
      {/* 1. Header Information */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <h2 className="text-base lg:text-lg font-bold text-slate-900 tracking-tight">
                Pembagian Rombel / Review Kelas
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Tinjau kelas yang tersedia dan distribusikan jumlah peserta ke setiap kelas berdasarkan kapasitas ruang yang sesuai sebelum penugasan dosen.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onAutoDistributeAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200 transition-colors cursor-pointer"
              title="Bagi peserta secara otomatis dengan optimasi kapasitas ruang"
            >
              <Split className="w-3.5 h-3.5 text-blue-600" />
              <span>Bagi Otomatis (Room-Capacity Aware)</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmRecalculateAllOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Hitung ulang semua pembagian peserta"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Bagi Ulang Semua</span>
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900">
              {completedCourses} / {totalCourses}
            </span>
            <span>Mata Kuliah Selesai Dibagi</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-slate-800">{activeOfferingsCount} Kelas Aktif</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-blue-600">{totalDistributedStudents} Peserta Terdistribusi</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">Estimasi Seat Waste: {totalEstimatedSeatWaste} kursi</span>
          </div>

          <div className="text-2xs font-medium text-slate-400">
            {completedCourses === totalCourses ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Seluruh rombel feasible & lengkap
              </span>
            ) : hasInfeasibleCourses ? (
              <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                <AlertCircle className="w-3.5 h-3.5" />
                Ada rombel melebihi kapasitas ruang
              </span>
            ) : (
              <span>{totalCourses - completedCourses} mata kuliah belum lengkap</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Three Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Mata Kuliah Dipilih */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xs uppercase tracking-wider font-bold text-slate-400">
              Mata Kuliah Dipilih
            </p>
            <h3 className="text-lg lg:text-xl font-bold text-slate-900 mt-0.5">
              {totalCourses} MK
            </h3>
            <p className="text-2xs text-slate-500 font-medium">Dari pilihan Step 1</p>
          </div>
        </div>

        {/* Card 2: Kelas / Rombel Tersedia */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xs uppercase tracking-wider font-bold text-slate-400">
              Kelas / Rombel Digunakan
            </p>
            <h3 className="text-lg lg:text-xl font-bold text-slate-900 mt-0.5">
              {activeOfferingsCount} Kelas
            </h3>
            <p className="text-2xs text-slate-500 font-medium">Aktif dalam penjadwalan</p>
          </div>
        </div>

        {/* Card 3: Total Peserta & Room Fit */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xs uppercase tracking-wider font-bold text-slate-400">
              Total Peserta
            </p>
            <h3 className="text-lg lg:text-xl font-bold text-slate-900 mt-0.5">
              {totalDistributedStudents} / {totalPlannedStudents}
            </h3>
            <p className="text-2xs text-slate-500 font-medium">
              {totalDistributedStudents === totalPlannedStudents
                ? `100% Terdistribusi (${totalEstimatedSeatWaste} seat waste)`
                : `Sisa ${Math.max(0, totalPlannedStudents - totalDistributedStudents)} peserta`}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Semester Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
            Semester:
          </span>
          <button
            type="button"
            onClick={() => onChangeSemesterFilter('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer',
              selectedSemesterFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            )}
          >
            Semua Semester
          </button>
          {termSemesters.map((sem) => (
            <button
              key={sem}
              type="button"
              onClick={() => onChangeSemesterFilter(sem)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer',
                selectedSemesterFilter === sem
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              )}
            >
              Semester {sem}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari kode/nama MK..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* 4. Grouped Courses List */}
      {filteredTheoryGroups.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-2xs">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">
            Tidak ada mata kuliah teori yang cocok dengan filter.
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Coba ganti pilihan semester atau kata kunci pencarian.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTheoryGroups.map((group) => {
            const hasNoOfferings = group.offerings.length === 0;
            const activeCount = group.offerings.filter((o) => o.active).length;

            return (
              <div
                key={group.selectionKey}
                className={cn(
                  'bg-white border rounded-2xl overflow-hidden shadow-2xs transition-all',
                  group.status === 'LENGKAP'
                    ? 'border-slate-200/80'
                    : group.status === 'TIDAK_ADA_KELAS'
                    ? 'border-rose-200 bg-rose-50/10'
                    : group.status === 'TIDAK_FEASIBLE'
                    ? 'border-rose-300 bg-rose-50/20'
                    : 'border-amber-200 bg-amber-50/10'
                )}
              >
                {/* Course Group Header */}
                <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white shadow-2xs">
                        {group.courseCode}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {group.courseName}
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-semibold bg-slate-200/80 text-slate-700">
                        Semester {group.semester} • {group.sks} SKS
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {group.packageName}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        {group.requiredRoomType}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                      <div className="text-slate-600">
                        Total Peserta Step 1:{' '}
                        <span className="font-bold text-slate-900">
                          {group.totalParticipantsStep1}
                        </span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <div className="text-slate-600">
                        Rombel Digunakan:{' '}
                        <span className="font-bold text-slate-900">
                          {activeCount}
                        </span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <div className="text-slate-600">
                        Kapasitas Terbesar Tersedia:{' '}
                        <span className="font-semibold text-slate-800">
                          {group.maxEligibleCapacity} kursi
                        </span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <div className="text-slate-600">
                        Distribusi:{' '}
                        <span
                          className={cn(
                            'font-bold',
                            group.status === 'LENGKAP'
                              ? 'text-emerald-600'
                              : group.status === 'TIDAK_FEASIBLE' || group.status === 'LEBIH'
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          )}
                        >
                          {group.totalDistributed} / {group.totalParticipantsStep1}
                        </span>
                      </div>
                      {group.status === 'LENGKAP' && (
                        <>
                          <span className="text-slate-300">•</span>
                          <div className="text-slate-500 font-medium">
                            Seat Waste: {group.totalSeatWaste} kursi
                          </div>
                        </>
                      )}
                    </div>

                    {/* Room Recommendation Notice */}
                    {!hasNoOfferings && (
                      <div className="mt-2.5 flex items-center gap-2 text-2xs text-slate-500 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                          <Armchair className="w-3 h-3 text-slate-500" />
                          Minimal {group.minimumSections} rombel diperlukan (kapasitas maks: {group.maxEligibleCapacity})
                        </span>
                        {group.offerings.length > 1 && onSelectSectionCount && (
                          <div className="flex items-center gap-1">
                            <span className="text-3xs text-slate-400">Pilih cepat:</span>
                            {Array.from(
                              { length: Math.min(group.offerings.length, 6) },
                              (_, idx) => idx + 1
                            )
                              .filter((num) => num >= group.minimumSections)
                              .map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => onSelectSectionCount(group, num)}
                                  className={cn(
                                    'px-1.5 py-0.5 text-3xs font-bold rounded transition-colors cursor-pointer',
                                    activeCount === num
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                  )}
                                >
                                  {num} Rombel
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status Badge & Per-Course Quick Actions */}
                  <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
                    {/* Status Badge */}
                    {group.status === 'LENGKAP' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Feasible & Lengkap
                      </span>
                    ) : group.status === 'TIDAK_FEASIBLE' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        Tidak Feasible (Ada rombel &gt; {group.maxEligibleCapacity})
                      </span>
                    ) : group.status === 'KURANG' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Sisa {group.remaining} peserta belum dialokasikan
                      </span>
                    ) : group.status === 'LEBIH' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        Distribusi melebihi total peserta sebanyak {Math.abs(group.remaining)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        Belum Ada Rombel
                      </span>
                    )}

                    {!hasNoOfferings && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onAutoDistributeCourse(group)}
                          className="px-2.5 py-1 text-2xs font-semibold bg-white hover:bg-slate-100 text-blue-700 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                          title="Bagi sisa peserta secara room-capacity aware"
                        >
                          Bagi Otomatis
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRecalculateGroup(group)}
                          className="px-2.5 py-1 text-2xs font-semibold bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                          title="Hitung ulang semua rombel aktif"
                        >
                          Bagi Ulang
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Offerings Table or Warning if no offerings */}
                {hasNoOfferings ? (
                  <div className="p-6 text-center space-y-3 bg-white">
                    <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-600">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Belum ada penawaran kelas untuk mata kuliah ini.
                      </h4>
                      <p className="text-2xs text-slate-500 mt-0.5">
                        Mata kuliah ini belum memiliki kelas penawaran (A, B, C, INTER) pada periode akademik aktif.
                      </p>
                    </div>
                    <Link
                      to="/penawaran-kelas"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Penawaran Kelas</span>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/40 text-slate-500 text-3xs uppercase tracking-wider border-b border-slate-200/60 select-none">
                          <th className="py-2.5 pl-5 pr-2 w-16 text-center">Aktif</th>
                          <th className="py-2.5 px-3 w-28">Kelas</th>
                          <th className="py-2.5 px-3 w-40 text-center">Jumlah Peserta</th>
                          <th className="py-2.5 px-3 min-w-[200px]">Target Kapasitas Ruang</th>
                          <th className="py-2.5 px-3 w-28 text-center">SKS Efektif</th>
                          <th className="py-2.5 px-3 min-w-[160px]">Jenis Ruang</th>
                          <th className="py-2.5 px-3 w-32 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {group.offerings.map((offering) => {
                          const isInter = offering.class_code.toUpperCase().includes('INTER');
                          const isOversized = offering.active && offering.isOversized;

                          return (
                            <tr
                              key={offering.id}
                              className={cn(
                                'transition-colors',
                                !offering.active
                                  ? 'bg-slate-50/40 opacity-70'
                                  : isOversized
                                  ? 'bg-rose-50/30 hover:bg-rose-50/50'
                                  : 'hover:bg-slate-50/60'
                              )}
                            >
                              {/* 1. Aktif Toggle */}
                              <td className="py-3 pl-5 pr-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={offering.active}
                                  onChange={() => onToggleOfferingActive(offering.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                  aria-label={`Aktifkan kelas ${offering.class_code}`}
                                />
                              </td>

                              {/* 2. Kelas Badge */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      'font-bold px-2.5 py-1 rounded-lg text-xs border shadow-2xs',
                                      isInter
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                    )}
                                  >
                                    Kelas {offering.class_code}
                                  </span>
                                  {isInter && (
                                    <span className="text-3xs font-semibold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                                      Internasional
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 3. Jumlah Peserta Input */}
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center">
                                  <div className="relative w-28">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      disabled={!offering.active}
                                      value={
                                        offering.active
                                          ? offering.currentParticipants === 0
                                            ? ''
                                            : offering.currentParticipants
                                          : 0
                                      }
                                      onChange={(e) => {
                                        const count = normalizeParticipantInput(e.target.value);
                                        onUpdateOfferingParticipants(offering.id, count);
                                      }}
                                      placeholder={offering.active ? '0' : '-'}
                                      className={cn(
                                        'w-full text-center px-2.5 py-1.5 rounded-lg border text-xs transition-all font-semibold',
                                        !offering.active &&
                                          'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed',
                                        offering.active &&
                                          !isOversized &&
                                          'bg-white border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                                        offering.active &&
                                          isOversized &&
                                          'bg-rose-50 border-rose-300 text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                      )}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* 4. Target Kapasitas Ruang */}
                              <td className="py-3 px-3">
                                {!offering.active ? (
                                  <span className="text-2xs text-slate-400 italic">-</span>
                                ) : isOversized ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 text-2xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                                      <AlertCircle className="w-3 h-3 text-rose-600" />
                                      Tidak ada ruang aktif ≥ {offering.currentParticipants}
                                    </span>
                                    <p className="text-3xs text-rose-600">
                                      Maksimal ruang {group.requiredRoomType}: {group.maxEligibleCapacity} kursi
                                    </p>
                                  </div>
                                ) : offering.targetRoomCapacity ? (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                        <Armchair className="w-3.5 h-3.5 text-blue-600" />
                                        Target ≥ {offering.targetRoomCapacity} kursi
                                      </span>
                                    </div>
                                    <p className="text-3xs text-slate-500">
                                      {offering.seatWaste === 0 ? (
                                        <span className="text-emerald-600 font-semibold">
                                          Fit sempurna (0 kursi kosong)
                                        </span>
                                      ) : (
                                        <span>
                                          Estimasi waste:{' '}
                                          <span className="font-semibold text-slate-700">
                                            {offering.seatWaste} kursi
                                          </span>
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-2xs text-slate-400 italic">
                                    Isi peserta untuk kalkulasi
                                  </span>
                                )}
                              </td>

                              {/* 5. SKS Efektif */}
                              <td className="py-3 px-3 text-center font-medium text-slate-700">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-2xs font-semibold">
                                  {offering.effective_sks} SKS
                                </span>
                              </td>

                              {/* 6. Jenis Ruang */}
                              <td className="py-3 px-3">
                                <span className="text-2xs text-slate-600 font-medium">
                                  {offering.required_room_type || group.requiredRoomType}
                                </span>
                              </td>

                              {/* 7. Status Kelas */}
                              <td className="py-3 px-3 text-center">
                                {!offering.active ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-medium bg-slate-100 text-slate-500">
                                    Nonaktif
                                  </span>
                                ) : isOversized ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    <AlertCircle className="w-3 h-3 text-rose-600" />
                                    Oversized
                                  </span>
                                ) : offering.currentParticipants > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    {offering.currentParticipants} Peserta
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                    Belum Diisi
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Practicum Informative Section (Section 5 from Brief) */}
      {practicumGroups.length > 0 && (
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight uppercase">
                Praktikum ({practicumGroups.length} Mata Kuliah)
              </h3>
            </div>
            <span className="text-3xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
              Dikelola Asisten Praktikum • Non-Penjadwalan Kuliah
            </span>
          </div>
          <p className="text-2xs text-slate-500">
            Mata kuliah praktikum berikut tidak memerlukan pembagian rombel atau penentuan kapasitas ruang perkuliahan. Kelompok praktikum dan jadwal laboratorium dikoordinasikan secara mandiri oleh laboratorium/asisten.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {practicumGroups.map((pg) => (
              <div
                key={pg.selectionKey}
                className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-start gap-3 shadow-2xs"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs">
                  ✓
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-3xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {pg.courseCode}
                    </span>
                    <span className="text-3xs text-slate-500">
                      Semester {pg.semester} • {pg.sks} SKS
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-1 truncate" title={pg.courseName}>
                    {pg.courseName}
                  </h4>
                  <p className="text-3xs text-slate-500 mt-0.5">
                    Pembagian kelompok dikelola oleh asisten praktikum. Tidak termasuk penjadwalan perkuliahan.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-4 py-3 sm:py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Stats */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900">
                <span>{totalCourses} MK Teori</span>
                {practicumGroups.length > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-3xs font-semibold bg-emerald-100 text-emerald-800">
                    + {practicumGroups.length} Praktikum
                  </span>
                )}
              </div>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <div className="text-xs sm:text-sm font-semibold text-slate-700">
              {activeOfferingsCount} Kelas Aktif
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <div className="text-xs sm:text-sm font-semibold text-slate-700">
              {totalDistributedStudents} Peserta
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <div className="text-xs sm:text-sm text-slate-500 font-medium">
              Waste: {totalEstimatedSeatWaste} Kursi
            </div>

            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Draft Belum Disimpan
              </span>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onBackToStep1}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Pemilihan MK</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={onSaveRombel}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer',
                hasUnsavedChanges
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              )}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Pembagian'}</span>
            </button>

            <button
              type="button"
              disabled={!isAllValid || saving}
              onClick={onContinueToStep3}
              className={cn(
                'inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm',
                isAllValid
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              )}
            >
              <span>Lanjut ke Penugasan Dosen</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Recalculate All */}
      <ConfirmDialog
        isOpen={confirmRecalculateAllOpen}
        onClose={() => setConfirmRecalculateAllOpen(false)}
        onConfirm={() => {
          onRecalculateAll();
          setConfirmRecalculateAllOpen(false);
        }}
        title="Bagi Ulang Seluruh Kelas?"
        message="Nilai jumlah peserta yang sudah tersimpan akan dihitung ulang secara optimal berdasarkan kapasitas ruang yang tersedia."
        confirmText="Bagi Ulang Semua"
        cancelLabel="Batal"
        variant="warning"
      />

      {/* Confirmation Dialog for Recalculate Single Group */}
      <ConfirmDialog
        isOpen={Boolean(confirmRecalculateGroup)}
        onClose={() => setConfirmRecalculateGroup(null)}
        onConfirm={() => {
          if (confirmRecalculateGroup) {
            onRecalculateCourse(confirmRecalculateGroup);
          }
          setConfirmRecalculateGroup(null);
        }}
        title={`Bagi Ulang ${confirmRecalculateGroup?.courseName}?`}
        message="Nilai jumlah peserta pada kelas aktif untuk mata kuliah ini akan dihitung ulang secara optimal berdasarkan kapasitas ruang."
        confirmText="Bagi Ulang"
        cancelLabel="Batal"
        variant="warning"
      />
    </div>
  );
};
