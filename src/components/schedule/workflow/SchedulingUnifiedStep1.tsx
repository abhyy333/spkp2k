import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Info,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import {
  CurriculumPackage,
  CurriculumPackageCourse,
  PlannedCourse,
  CourseRombelGroup,
  Lecturer,
} from '../../../types';
import { cn } from '../../../lib/utils';
import { isKKN, isPKL, isPracticum } from '../../../lib/distributionUtils';
import { toast } from '../../ui/Toast';

interface SchedulingUnifiedStep1Props {
  packages: CurriculumPackage[];
  categoryMap: Map<string, string>;
  selectedSemesterType: 'GANJIL' | 'GENAP';
  onChangeSemesterType: (type: 'GANJIL' | 'GENAP') => void;
  selectedSemesterFilter: number | 'ALL';
  onChangeSemesterFilter: (filter: number | 'ALL') => void;
  activeCurricula: number[];
  onToggleCurriculum: (year: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  plannedCourses: PlannedCourse[];
  participantInputMap: Record<string, number>;
  rombelGroups: CourseRombelGroup[];
  allLecturers: Lecturer[];
  onToggleCourse: (course: CurriculumPackageCourse) => void;
  onUpdateParticipants: (courseId: string, count: number) => void;
  onSelectSectionCount: (courseId: string, sections: number) => void;
  onUpdateOfferingParticipants: (offeringId: string, count: number) => void;
  onSelectPrimaryLecturer: (offeringId: string, lecturerId: string) => void;
  onSelectAllWajib: () => void;
  onContinueToStep2: () => void;
  loading?: boolean;
}

export const SchedulingUnifiedStep1: React.FC<SchedulingUnifiedStep1Props> = ({
  packages,
  categoryMap,
  selectedSemesterType,
  onChangeSemesterType,
  selectedSemesterFilter,
  onChangeSemesterFilter,
  activeCurricula,
  onToggleCurriculum,
  searchQuery,
  onSearchChange,
  plannedCourses,
  participantInputMap,
  rombelGroups,
  allLecturers,
  onToggleCourse,
  onUpdateParticipants,
  onSelectSectionCount,
  onUpdateOfferingParticipants,
  onSelectPrimaryLecturer,
  onSelectAllWajib,
  onContinueToStep2,
  loading = false,
}) => {
  // Collapsed state for course details
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});

  const toggleExpand = (courseId: string) => {
    setExpandedCourses((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  // Map of planned courses by code
  const plannedMap = useMemo(() => {
    const map = new Map<string, PlannedCourse>();
    plannedCourses.forEach((pc) => {
      map.set(pc.courseCode, pc);
    });
    return map;
  }, [plannedCourses]);

  // Map of rombel groups by course code
  const rombelMap = useMemo(() => {
    const map = new Map<string, CourseRombelGroup>();
    rombelGroups.forEach((rg) => {
      map.set(rg.courseCode, rg);
    });
    return map;
  }, [rombelGroups]);

  // Extract all courses across packages for current semester type
  const availableCourses = useMemo(() => {
    const courseMap = new Map<string, CurriculumPackageCourse>();

    packages.forEach((pkg) => {
      const courses = pkg.payload?.courses || [];
      const pkgSem = Number(pkg.payload?.semester || 1);
      courses.forEach((c) => {
        const sem = Number(c.semester || pkgSem);
        const isGanjil = sem % 2 === 1;
        const matchesType =
          selectedSemesterType === 'GANJIL' ? isGanjil : !isGanjil;

        if (matchesType && !courseMap.has(c.code)) {
          courseMap.set(c.code, {
            ...c,
            semester: sem,
            curriculum_year: pkg.payload?.curriculum_year || 2026,
          });
        }
      });
    });

    let list = Array.from(courseMap.values());

    // Filter by semester
    if (selectedSemesterFilter !== 'ALL') {
      list = list.filter((c) => Number(c.semester) === selectedSemesterFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q)
      );
    }

    // Sort by semester asc, then code
    return list.sort((a, b) => {
      const semA = Number(a.semester || 1);
      const semB = Number(b.semester || 1);
      if (semA !== semB) return semA - semB;
      return a.code.localeCompare(b.code);
    });
  }, [packages, selectedSemesterType, selectedSemesterFilter, searchQuery]);

  // Semesters for filter tabs
  const availableSemesters = selectedSemesterType === 'GANJIL' ? [1, 3, 5, 7] : [2, 4, 6, 8];

  // Validation metrics
  const activeOfferingsCount = useMemo(() => {
    let count = 0;
    rombelGroups.forEach((rg) => {
      count += rg.offerings.filter((o) => o.active).length;
    });
    return count;
  }, [rombelGroups]);

  const totalParticipantsSum = useMemo(() => {
    return plannedCourses.reduce((sum, c) => sum + (c.totalParticipants || 0), 0);
  }, [plannedCourses]);

  const missingLecturerCount = useMemo(() => {
    let missing = 0;
    rombelGroups.forEach((rg) => {
      rg.offerings.forEach((o) => {
        if (o.active && !(o as any).primaryLecturerId && !(o as any).primary_lecturer_id) {
          missing++;
        }
      });
    });
    return missing;
  }, [rombelGroups]);

  // Check if any elective course has < 10 participants
  const invalidElectives = useMemo(() => {
    return plannedCourses.filter((pc) => {
      const isPilihan = pc.category?.toLowerCase().includes('pilihan') || pc.category === 'PIL';
      return isPilihan && (pc.totalParticipants < 10);
    });
  }, [plannedCourses]);

  const handleValidateAndContinue = () => {
    if (plannedCourses.length === 0) {
      toast.error('Pilih minimal 1 mata kuliah untuk dijadwalkan.');
      return;
    }

    if (invalidElectives.length > 0) {
      toast.error(
        `Mata kuliah pilihan "${invalidElectives[0].courseName}" belum memenuhi batas minimal 10 mahasiswa.`
      );
      return;
    }

    onContinueToStep2();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar: Semester Switcher & Filter Controls */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Pemilihan Mata Kuliah, Pembagian Kelas & Penugasan Dosen
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur seluruh persiapan perkuliahan di satu tempat: pilih mata kuliah dibuka, tentukan jumlah peserta, bagi rombel, dan tugaskan dosen pengampu.
            </p>
          </div>

          {/* Ganjil / Genap Toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => onChangeSemesterType('GANJIL')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                selectedSemesterType === 'GANJIL'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Semester Ganjil
            </button>
            <button
              type="button"
              onClick={() => onChangeSemesterType('GENAP')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                selectedSemesterType === 'GENAP'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Semester Genap
            </button>
          </div>
        </div>

        {/* Filters and Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari kode atau nama mata kuliah..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Semester Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => onChangeSemesterFilter('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                selectedSemesterFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              Semua Semester
            </button>
            {availableSemesters.map((sem) => (
              <button
                key={sem}
                type="button"
                onClick={() => onChangeSemesterFilter(sem)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  selectedSemesterFilter === sem
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                Semester {sem}
              </button>
            ))}

            {/* Quick Action: Select All Wajib */}
            <button
              type="button"
              onClick={onSelectAllWajib}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200/80 transition-colors cursor-pointer ml-2"
              title="Buka seluruh MK Wajib untuk semester ini secara otomatis"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Buka Semua MK Wajib</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Course Cards List */}
      <div className="space-y-3">
        {availableCourses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            Tidak ada mata kuliah yang sesuai kriteria pencarian.
          </div>
        ) : (
          availableCourses.map((course) => {
            const planned = plannedMap.get(course.code);
            const isSelected = Boolean(planned);
            const isCourseKKN = isKKN(course);
            const isCoursePKL = isPKL(course);
            const isCoursePraktikum = isPracticum(course);
            const isExcludedNonJadwal = isCourseKKN || isCoursePKL;

            const categoryName = categoryMap.get(course.code) || 'Wajib';
            const isPilihan =
              categoryName.toLowerCase().includes('pilihan') ||
              categoryName === 'PIL' ||
              (course as any).is_elective;

            const participantsCount =
              participantInputMap[course.code] ?? (planned?.totalParticipants ?? 40);

            const isElectiveUnderMinimum = isPilihan && isSelected && participantsCount < 10;
            const rombel = rombelMap.get(course.code);
            const isExpanded = expandedCourses[course.code] ?? isSelected;

            return (
              <div
                key={course.code}
                className={cn(
                  'bg-white rounded-2xl border transition-all overflow-hidden shadow-2xs',
                  isSelected
                    ? isElectiveUnderMinimum
                      ? 'border-amber-300 ring-2 ring-amber-500/10'
                      : 'border-blue-200/90 ring-1 ring-blue-500/10'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                {/* Course Header Bar */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Checkbox + Course Info */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {!isExcludedNonJadwal ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleCourse(course)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer mt-1"
                      />
                    ) : (
                      <div className="w-4 h-4 mt-1" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {course.code}
                        </span>
                        <span className="text-xs font-bold text-slate-900 leading-snug">
                          {course.name}
                        </span>

                        {/* Category Badges */}
                        {isCourseKKN ? (
                          <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            KKN (LPPM / Non-Jadwal)
                          </span>
                        ) : isCoursePKL ? (
                          <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            PKL (Magang / Non-Jadwal)
                          </span>
                        ) : isCoursePraktikum ? (
                          <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Praktikum (Non-Jadwal Teori)
                          </span>
                        ) : isPilihan ? (
                          <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            MK Pilihan
                          </span>
                        ) : (
                          <span className="text-3xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            MK Wajib
                          </span>
                        )}

                        <span className="text-3xs text-slate-400 font-semibold">
                          Semester {course.semester} • {course.effective_sks || course.sks || 3} SKS
                        </span>
                      </div>

                      {/* Rule notes */}
                      {isPilihan && !isSelected && (
                        <p className="text-3xs text-purple-600 font-medium mt-1">
                          *MK Pilihan tidak otomatis dibuka. Centang untuk membuka (syarat: peminat ≥ 10 mahasiswa).
                        </p>
                      )}
                      {isElectiveUnderMinimum && (
                        <p className="text-3xs text-amber-700 font-bold mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Peminat kurang dari 10 mahasiswa. Tambah peserta atau batalkan pembukaan MK pilihan ini.</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Participant Count Input & Section Buttons */}
                  {!isExcludedNonJadwal && isSelected && (
                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                      {/* Participant Count Input */}
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-3xs font-semibold text-slate-500 uppercase">Peserta:</span>
                        <input
                          type="number"
                          min={isPilihan ? 10 : 1}
                          max={300}
                          value={participantsCount}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                            onUpdateParticipants(course.code, val);
                          }}
                          className="w-14 text-center font-bold text-xs bg-white border border-slate-300 rounded-lg py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-3xs text-slate-400">mhs</span>
                      </div>

                      {/* Section Count Buttons */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <span className="text-3xs font-semibold text-slate-500 px-1.5 uppercase">Kelas:</span>
                        {[1, 2, 3, 4].map((num) => {
                          const currentSections = rombel?.offerings?.filter((o) => o.active).length || 1;
                          const isActive = currentSections === num;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => onSelectSectionCount(course.code, num)}
                              className={cn(
                                'w-6 h-6 rounded-lg text-xs font-bold transition-all cursor-pointer',
                                isActive
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-slate-200'
                              )}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>

                      {/* Toggle Expand Details */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(course.code)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                        title={isExpanded ? 'Sembunyikan Rincian Kelas' : 'Tampilkan Rincian Kelas'}
                      >
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 transition-transform duration-200',
                            isExpanded ? 'rotate-180' : ''
                          )}
                        />
                      </button>
                    </div>
                  )}
                </div>

                {/* Sub-Rows: Classes & Lecturers Selection */}
                {!isExcludedNonJadwal && isSelected && isExpanded && rombel && (
                  <div className="bg-slate-50/70 border-t border-slate-100 p-4 space-y-2.5">
                    <p className="text-3xs font-bold text-slate-500 uppercase tracking-wider">
                      Alokasi Kelas & Penugasan Dosen Pengampu:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {rombel.offerings
                        .filter((o) => o.active)
                        .map((offering) => {
                          const selectedLecturerId =
                            (offering as any).primaryLecturerId ||
                            (offering as any).primary_lecturer_id ||
                            '';

                          return (
                            <div
                              key={offering.id}
                              className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded font-extrabold text-xs bg-blue-100 text-blue-800">
                                  Kelas {offering.class_code}
                                </span>
                                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                  <span>Kapasitas:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={offering.expected_students || offering.currentParticipants}
                                    onChange={(e) => {
                                      const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                                      onUpdateOfferingParticipants(offering.id, val);
                                    }}
                                    className="w-12 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded py-0.5"
                                  />
                                  <span className="text-3xs text-slate-400">kursi</span>
                                </div>
                              </div>

                              {/* Lecturer Picker */}
                              <div className="space-y-1">
                                <label className="text-3xs font-semibold text-slate-500 flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 text-slate-400" />
                                  <span>Dosen Pengampu Utama:</span>
                                </label>
                                <select
                                  value={selectedLecturerId}
                                  onChange={(e) => onSelectPrimaryLecturer(offering.id, e.target.value)}
                                  className={cn(
                                    'w-full py-1.5 px-2.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium',
                                    selectedLecturerId
                                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                                      : 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                                  )}
                                >
                                  <option value="">-- Pilih Dosen Pengampu --</option>
                                  {allLecturers
                                    .filter((l: any) => l.is_active !== false && l.status !== 'Nonaktif')
                                    .map((lect) => (
                                      <option key={lect.id} value={lect.id}>
                                        {lect.name} {lect.lecturer_code ? `(${lect.lecturer_code})` : ''}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. Sticky Bottom Action Bar */}
      <div className="sticky bottom-4 z-20">
        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left: Summary Stats */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  {plannedCourses.length} Mata Kuliah Terpilih • {activeOfferingsCount} Kelas/Rombel
                </p>
                <p className="text-3xs text-slate-400 mt-0.5">
                  Total {totalParticipantsSum} Mahasiswa Peserta
                  {missingLecturerCount > 0 && (
                    <span className="text-amber-400 font-bold ml-2">
                      • {missingLecturerCount} kelas belum memiliki dosen pengampu
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Right: Primary Action Button */}
            <button
              type="button"
              disabled={loading || plannedCourses.length === 0}
              onClick={handleValidateAndContinue}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer',
                plannedCourses.length > 0 && !loading
                  ? 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-blue-500/25'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
              )}
            >
              <span>{loading ? 'Memproses...' : 'Lanjut Susun Jadwal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
