import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Layers,
  BookOpen,
  Users,
  Sparkles,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Tag,
  Plus,
  Trash2,
  X,
  Info,
  AlertTriangle,
  GraduationCap,
} from 'lucide-react';
import { CurriculumPackage, CurriculumPackageCourse, PlannedCourse } from '../../../types';
import { cn } from '../../../lib/utils';
import {
  normalizeParticipantInput,
  isPracticum,
  isKKN,
  isPKL,
  isElective,
  isNonSchedulableCourse,
} from '../../../lib/distributionUtils';
import { toast } from '../../ui/Toast';

interface SchedulingTemplateViewProps {
  packages: CurriculumPackage[];
  categoryMap: Map<string, string>;
  selectedSemesterType: 'GANJIL' | 'GENAP';
  onChangeSemesterType: (type: 'GANJIL' | 'GENAP') => void;
  selectedSemesterFilter: number | 'ALL';
  onChangeSemesterFilter: (filter: number | 'ALL') => void;
  activeCurricula: number[]; // e.g. [2026, 2022]
  onToggleCurriculum: (year: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  plannedCourses: PlannedCourse[];
  participantInputMap: Record<string, number>;
  onToggleCourse: (pkg: CurriculumPackage, course: CurriculumPackageCourse, category?: string) => void;
  onUpdateParticipants: (selectionKey: string, count: number) => void;
  onSelectAllFromTemplate: (packagesToSelect: CurriculumPackage[]) => void;
  onClearAll: () => void;
  onSelectSemesterCourses: (semester: number, packagesInSemester: CurriculumPackage[]) => void;
  onClearSemesterCourses: (semester: number, packagesInSemester: CurriculumPackage[]) => void;
  onTogglePackage: (pkg: CurriculumPackage, categoryMap: Map<string, string>) => void;
}

export const SchedulingTemplateView: React.FC<SchedulingTemplateViewProps> = ({
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
  onToggleCourse,
  onUpdateParticipants,
  onSelectAllFromTemplate,
  onClearAll,
  onSelectSemesterCourses,
  onClearSemesterCourses,
  onTogglePackage,
}) => {
  // Modal state for adding elective courses
  const [showElectiveModal, setShowElectiveModal] = useState<boolean>(false);
  const [electiveSearch, setElectiveSearch] = useState<string>('');
  const [electiveKbkFilter, setElectiveKbkFilter] = useState<string>('ALL');

  // Semesters belonging to term
  const termSemesters = useMemo(() => {
    return selectedSemesterType === 'GANJIL' ? [1, 3, 5, 7] : [2, 4, 6, 8];
  }, [selectedSemesterType]);

  // Create a fast lookup map for selected courses (indexed by unique courseCode)
  const selectedMap = useMemo(() => {
    const map = new Map<string, PlannedCourse>();
    plannedCourses.forEach((pc) => {
      map.set(pc.courseCode.trim().toUpperCase(), pc);
    });
    return map;
  }, [plannedCourses]);

  // Filter packages by active curricula
  const curriculumFilteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const cy = pkg.payload?.curriculum_year || 2026;
      return activeCurricula.includes(cy);
    });
  }, [packages, activeCurricula]);

  // Fast occurrence map across packages to detect shared courses
  const courseOccurrenceMap = useMemo(() => {
    const map = new Map<string, { count: number; packageNames: string[]; kbkNames: string[] }>();
    curriculumFilteredPackages.forEach((pkg) => {
      const courses = pkg.payload?.courses || [];
      courses.forEach((c) => {
        const codeKey = c.code.trim().toUpperCase();
        const existing = map.get(codeKey) || { count: 0, packageNames: [], kbkNames: [] };
        existing.count += 1;
        if (!existing.packageNames.includes(pkg.name)) {
          existing.packageNames.push(pkg.name);
        }
        const kbk = pkg.payload?.kbk_name || pkg.payload?.kbk_code;
        if (kbk && !existing.kbkNames.includes(kbk)) {
          existing.kbkNames.push(kbk);
        }
        map.set(codeKey, existing);
      });
    });
    return map;
  }, [curriculumFilteredPackages]);

  // Separate regular semester packages and elective catalogs
  const { regularPackages, electivePackages } = useMemo(() => {
    const regular: CurriculumPackage[] = [];
    const elective: CurriculumPackage[] = [];

    curriculumFilteredPackages.forEach((pkg) => {
      const isElectivePkg =
        pkg.payload?.package_type === 'ELECTIVE_CATALOG' ||
        pkg.name.toUpperCase().includes('ELECTIVE') ||
        pkg.name.toUpperCase().includes('PILIHAN') ||
        (pkg.payload?.semester === null || pkg.payload?.semester === undefined);

      if (isElectivePkg) {
        elective.push(pkg);
      } else {
        regular.push(pkg);
      }
    });

    return { regularPackages: regular, electivePackages: elective };
  }, [curriculumFilteredPackages]);

  // Filter regular packages by active academic term and semester filter
  const displayedRegularPackages = useMemo(() => {
    return regularPackages.filter((pkg) => {
      const sem = Number(pkg.payload?.semester || 0);
      if (!termSemesters.includes(sem)) {
        return false;
      }
      if (selectedSemesterFilter !== 'ALL' && sem !== selectedSemesterFilter) {
        return false;
      }
      return true;
    });
  }, [regularPackages, termSemesters, selectedSemesterFilter]);

  // Filter course list inside a package by search query
  const getFilteredCourses = (pkg: CurriculumPackage): CurriculumPackageCourse[] => {
    const courses = pkg.payload?.courses || [];
    const sorted = [...courses].sort((a, b) => (a.order || 0) - (b.order || 0));

    if (!searchQuery.trim()) return sorted;

    const q = searchQuery.toLowerCase().trim();
    return sorted.filter(
      (c) =>
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.name && c.name.toLowerCase().includes(q))
    );
  };

  // Group displayed packages by curriculum year -> semester
  const groupedPackages = useMemo(() => {
    const currGroups: {
      curriculumYear: number;
      curriculumName: string;
      semesters: {
        semester: number;
        packages: CurriculumPackage[];
      }[];
    }[] = [];

    const sortedYears = [...activeCurricula].sort((a, b) => b - a);

    sortedYears.forEach((year) => {
      const yearPkgs = displayedRegularPackages.filter(
        (p) => (p.payload?.curriculum_year || 2026) === year
      );
      if (yearPkgs.length === 0) return;

      const semMap = new Map<number, CurriculumPackage[]>();
      termSemesters.forEach((sem) => {
        if (selectedSemesterFilter === 'ALL' || selectedSemesterFilter === sem) {
          semMap.set(sem, []);
        }
      });

      yearPkgs.forEach((pkg) => {
        const sem = Number(pkg.payload?.semester || 0);
        if (semMap.has(sem)) {
          semMap.get(sem)!.push(pkg);
        }
      });

      const semList = Array.from(semMap.entries())
        .filter(([_, pkgs]) => pkgs.length > 0)
        .map(([sem, pkgs]) => ({
          semester: sem,
          packages: pkgs.sort((a, b) => {
            const scopeA = a.payload?.scope || '';
            const scopeB = b.payload?.scope || '';
            if (scopeA.includes('PROG_STUDI') || scopeA.includes('UMUM')) return -1;
            if (scopeB.includes('PROG_STUDI') || scopeB.includes('UMUM')) return 1;
            return a.name.localeCompare(b.name);
          }),
        }))
        .sort((a, b) => a.semester - b.semester);

      if (semList.length > 0) {
        currGroups.push({
          curriculumYear: year,
          curriculumName:
            year === 2026
              ? 'Kurikulum 2026 (OBE)'
              : year === 2022
              ? 'Kurikulum 2022'
              : `Kurikulum ${year}`,
          semesters: semList,
        });
      }
    });

    return currGroups;
  }, [displayedRegularPackages, activeCurricula, termSemesters, selectedSemesterFilter]);

  // Catalog of ALL available elective courses (deduplicated by course code)
  const allElectiveCoursesCatalog = useMemo(() => {
    const map = new Map<
      string,
      {
        course: CurriculumPackageCourse;
        pkg: CurriculumPackage;
        kbkName: string;
        kbkCode: string;
        curriculumYear: number;
      }
    >();

    // Scan elective packages and all packages for elective courses
    const allPkgsToScan = [...electivePackages, ...curriculumFilteredPackages];

    allPkgsToScan.forEach((pkg) => {
      const courses = pkg.payload?.courses || [];
      const cy = pkg.payload?.curriculum_year || 2026;
      const kbkName = pkg.payload?.kbk_name || pkg.payload?.kbk_code || 'Umum';
      const kbkCode = pkg.payload?.kbk_code || 'ALL';

      courses.forEach((c) => {
        const codeKey = c.code.trim().toUpperCase();
        const isElect = isElective(c, categoryMap) || categoryMap.get(codeKey) === 'Pilihan' || pkg.payload?.package_type === 'ELECTIVE_CATALOG';
        if (isElect && !map.has(codeKey)) {
          map.set(codeKey, {
            course: c,
            pkg,
            kbkName,
            kbkCode,
            curriculumYear: cy,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [electivePackages, curriculumFilteredPackages, categoryMap]);

  // Filtered catalog for modal
  const filteredElectiveCatalog = useMemo(() => {
    return allElectiveCoursesCatalog.filter((item) => {
      if (electiveKbkFilter !== 'ALL' && item.kbkCode !== electiveKbkFilter) {
        return false;
      }
      if (electiveSearch.trim()) {
        const q = electiveSearch.toLowerCase().trim();
        const matchCode = item.course.code.toLowerCase().includes(q);
        const matchName = item.course.name.toLowerCase().includes(q);
        return matchCode || matchName;
      }
      return true;
    });
  }, [allElectiveCoursesCatalog, electiveKbkFilter, electiveSearch]);

  // List of opened elective courses (already in plannedCourses with category 'Pilihan')
  const openedElectiveCourses = useMemo(() => {
    return plannedCourses.filter((pc) => {
      const codeKey = pc.courseCode.trim().toUpperCase();
      return pc.category === 'Pilihan' || isElective(pc, categoryMap) || categoryMap.get(codeKey) === 'Pilihan';
    });
  }, [plannedCourses, categoryMap]);

  // Counters for breakdown summary
  const mandatoryCoursesCount = useMemo(() => {
    return plannedCourses.filter((pc) => {
      const codeKey = pc.courseCode.trim().toUpperCase();
      return (
        pc.category === 'Wajib' &&
        !isPracticum(pc) &&
        !isKKN(pc) &&
        !isPKL(pc) &&
        !isElective(pc, categoryMap) &&
        categoryMap.get(codeKey) !== 'Pilihan'
      );
    }).length;
  }, [plannedCourses, categoryMap]);

  const openedElectiveCount = openedElectiveCourses.length;

  const practicumCoursesCount = useMemo(() => {
    return plannedCourses.filter((pc) => isPracticum(pc)).length;
  }, [plannedCourses]);

  const totalSelectedSks = useMemo(() => {
    return plannedCourses.reduce((acc, pc) => acc + (Number(pc.sks) || 0), 0);
  }, [plannedCourses]);

  const totalParticipantsSum = useMemo(() => {
    return plannedCourses
      .filter((pc) => !isPracticum(pc) && !isKKN(pc) && !isPKL(pc))
      .reduce((acc, pc) => {
        const codeKey = pc.courseCode.trim().toUpperCase();
        const count =
          participantInputMap[codeKey] !== undefined
            ? participantInputMap[codeKey]
            : pc.totalParticipants;
        return acc + (Number(count) || 0);
      }, 0);
  }, [plannedCourses, participantInputMap]);

  // Handler: Open an elective course from catalog modal
  const handleOpenElectiveCourse = (item: {
    course: CurriculumPackageCourse;
    pkg: CurriculumPackage;
  }) => {
    const codeKey = item.course.code.trim().toUpperCase();
    const currentCount = participantInputMap[codeKey] ?? 0;

    if (currentCount < 10) {
      toast.error('Minimal 10 mahasiswa peminat diperlukan untuk membuka mata kuliah pilihan.');
      return;
    }

    if (!selectedMap.has(codeKey)) {
      onToggleCourse(item.pkg, item.course, 'Pilihan');
    }
    toast.success(`Mata kuliah pilihan ${item.course.name} berhasil dibuka.`);
  };

  // Handler: Close / Cancel an opened elective course
  const handleCloseElectiveCourse = (planned: PlannedCourse) => {
    const pkg = packages.find((p) => p.id === planned.packageId) || {
      id: planned.packageId,
      name: planned.packageName,
      payload: {
        curriculum_year: planned.curriculumYear,
        semester: planned.semester,
        courses: [{ code: planned.courseCode, name: planned.courseName, sks: planned.sks, order: 0 }],
      },
    } as CurriculumPackage;

    onToggleCourse(pkg, { code: planned.courseCode, name: planned.courseName, sks: planned.sks, order: 0 }, 'Pilihan');
    toast.info(`Pembukaan mata kuliah ${planned.courseName} dibatalkan.`);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* 1. Filter & Controls Toolbar Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        {/* Row A: Academic Term & Curriculum Toggles */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          {/* Term selector tabs (Ganjil / Genap) */}
          <div className="flex items-center gap-2">
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 shrink-0">
              Periode:
            </span>
            <div className="inline-flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => onChangeSemesterType('GANJIL')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  selectedSemesterType === 'GANJIL'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Semester Ganjil (1, 3, 5, 7)
              </button>
              <button
                type="button"
                onClick={() => onChangeSemesterType('GENAP')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  selectedSemesterType === 'GENAP'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Semester Genap (2, 4, 6, 8)
              </button>
            </div>
          </div>

          {/* Curriculum Toggles (2026 & 2022) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 shrink-0">
              Kurikulum:
            </span>
            <div className="flex items-center gap-2">
              <label
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all select-none',
                  activeCurricula.includes(2026)
                    ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                )}
              >
                <input
                  type="checkbox"
                  checked={activeCurricula.includes(2026)}
                  onChange={() => onToggleCurriculum(2026)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span>Kurikulum 2026 (OBE)</span>
                <span className="text-3xs px-1.5 py-0.2 rounded bg-blue-200/80 text-blue-800 font-bold">
                  OBE
                </span>
              </label>

              <label
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all select-none',
                  activeCurricula.includes(2022)
                    ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                )}
              >
                <input
                  type="checkbox"
                  checked={activeCurricula.includes(2022)}
                  onChange={() => onToggleCurriculum(2022)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span>Kurikulum 2022</span>
              </label>
            </div>
          </div>
        </div>

        {/* Row B: Semester Filter Pills & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Semester pills */}
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

          {/* Search Box */}
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

        {/* Row C: Global Actions & Summary Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
            <span className="font-semibold text-slate-900">Ringkasan Template:</span>
            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              {mandatoryCoursesCount} MK Wajib
            </span>
            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
              {openedElectiveCount} MK Pilihan Dibuka
            </span>
            {practicumCoursesCount > 0 && (
              <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                {practicumCoursesCount} Praktikum Non-Jadwal
              </span>
            )}
            <span className="font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              KKN/PKL Tidak Dijadwalkan
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-semibold text-slate-700">
              {totalSelectedSks} SKS ({totalParticipantsSum} Peserta)
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSelectAllFromTemplate(displayedRegularPackages)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Pilih Semua MK Wajib</span>
            </button>

            <button
              type="button"
              onClick={onClearAll}
              disabled={plannedCourses.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Kosongkan Semua</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Grouped Regular Mandatory Packages View */}
      {groupedPackages.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-2xs">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">
            Tidak ada paket kurikulum untuk filter ini.
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeCurricula.length === 0
              ? 'Aktifkan minimal satu kurikulum (2026 atau 2022) di toolbar atas.'
              : 'Cobalah mengganti semester filter atau kata kunci pencarian.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedPackages.map((currGroup) => (
            <div key={currGroup.curriculumYear} className="space-y-6">
              {/* Curriculum Section Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    {currGroup.curriculumYear}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      {currGroup.curriculumName}
                    </h2>
                    <p className="text-2xs text-slate-500 font-medium">
                      Paket pembelajaran resmi Program Studi S1 Teknik Elektro
                    </p>
                  </div>
                </div>
              </div>

              {/* Semesters under this Curriculum */}
              {currGroup.semesters.map((semGroup) => (
                <div key={`${currGroup.curriculumYear}-sem-${semGroup.semester}`} className="space-y-4">
                  {/* Semester Bar with Quick Semester Select */}
                  <div className="flex items-center justify-between bg-slate-100/80 px-4 py-2.5 rounded-xl border border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Semester {semGroup.semester}
                      </h3>
                      <span className="text-3xs px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 font-semibold">
                        {semGroup.packages.length} Paket
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectSemesterCourses(semGroup.semester, semGroup.packages)}
                        className="text-2xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded bg-white hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer"
                      >
                        + Pilih Semua MK Wajib Sem {semGroup.semester}
                      </button>
                      <button
                        type="button"
                        onClick={() => onClearSemesterCourses(semGroup.semester, semGroup.packages)}
                        className="text-2xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
                      >
                        Kosongkan Sem {semGroup.semester}
                      </button>
                    </div>
                  </div>

                  {/* Package Cards in this semester */}
                  <div className="space-y-4">
                    {semGroup.packages.map((pkg) => {
                      const courses = getFilteredCourses(pkg);
                      const isCommonPackage =
                        pkg.payload?.scope === 'PROG_STUDI' ||
                        pkg.payload?.scope === 'ALL_KBK' ||
                        pkg.name.toUpperCase().includes('UMUM') ||
                        pkg.name.toUpperCase().includes('DASAR');

                      const kbkCode = pkg.payload?.kbk_code;
                      const kbkName = pkg.payload?.kbk_name;
                      const legacyTrack = pkg.payload?.legacy_track;

                      // Count selected unique courses in this package
                      const selectedInThisPkgCount = courses.filter((c) =>
                        selectedMap.has(c.code.trim().toUpperCase())
                      ).length;

                      const isAllPkgSelected =
                        courses.length > 0 && selectedInThisPkgCount === courses.length;
                      const isPartialPkgSelected =
                        selectedInThisPkgCount > 0 && selectedInThisPkgCount < courses.length;

                      const totalSks =
                        pkg.payload?.total_sks ??
                        courses.reduce((acc, c) => acc + (c.sks || 0), 0);

                      return (
                        <div
                          key={pkg.id}
                          className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs transition-all hover:border-slate-300"
                        >
                          {/* Package Header Card */}
                          <div className="p-4 bg-slate-50/70 border-b border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {/* Package Checkbox */}
                              <button
                                type="button"
                                onClick={() => onTogglePackage(pkg, categoryMap)}
                                className="w-5 h-5 rounded border border-slate-300 flex items-center justify-center transition-colors cursor-pointer hover:border-blue-500 bg-white"
                                title="Pilih / Batalkan seluruh mata kuliah wajib di paket ini"
                              >
                                {isAllPkgSelected ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600 fill-blue-600 text-white" />
                                ) : isPartialPkgSelected ? (
                                  <div className="w-2.5 h-2.5 rounded-2xs bg-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-transparent" />
                                )}
                              </button>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                                    {pkg.name}
                                  </h4>

                                  {/* Badge: Umum / KBK */}
                                  {isCommonPackage ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200/80">
                                      Paket Bersama / Umum
                                    </span>
                                  ) : kbkCode || kbkName ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                                      KBK {kbkCode ? kbkCode : kbkName}
                                    </span>
                                  ) : null}

                                  {/* Legacy Track Badge for 2022 */}
                                  {legacyTrack && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                                      Legacy: {legacyTrack}
                                    </span>
                                  )}
                                </div>

                                {kbkName && !isCommonPackage && (
                                  <p className="text-2xs text-slate-500 mt-0.5">
                                    {kbkName}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Summary Badge inside Package Header */}
                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <div className="text-right">
                                <div className="text-xs font-semibold text-slate-700">
                                  {courses.length} MK ({totalSks} SKS)
                                </div>
                                <div className="text-2xs text-slate-400">
                                  Terpilih:{' '}
                                  <span className="font-bold text-blue-600">
                                    {selectedInThisPkgCount} / {courses.length}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Table of Courses */}
                          {courses.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-400 italic">
                              Tidak ada mata kuliah yang cocok dengan kata kunci pencarian.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50/40 text-slate-500 text-3xs uppercase tracking-wider border-b border-slate-200/60 select-none">
                                    <th className="py-2.5 pl-4 pr-2 w-12 text-center">Pilih</th>
                                    <th className="py-2.5 px-3 min-w-[240px]">Kode & Mata Kuliah</th>
                                    <th className="py-2.5 px-3 w-20 text-center">SKS</th>
                                    <th className="py-2.5 px-3 w-32 text-center">Kategori</th>
                                    <th className="py-2.5 px-3 w-40 text-center">Jumlah Peserta</th>
                                    <th className="py-2.5 px-3 w-44 text-center">Penjadwalan Kuliah</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                  {courses.map((course) => {
                                    const codeKey = course.code.trim().toUpperCase();
                                    const isSelected = selectedMap.has(codeKey);
                                    const planned = selectedMap.get(codeKey);
                                    const occurrence = courseOccurrenceMap.get(codeKey);
                                    const isSharedCourse = (occurrence?.count || 0) > 1;

                                    const isPracticumCourse = isPracticum(course);
                                    const isKKNCourse = isKKN(course);
                                    const isPKLCourse = isPKL(course);
                                    const isElectiveCourse =
                                      isElective(course, categoryMap) ||
                                      categoryMap.get(codeKey) === 'Pilihan' ||
                                      course.name.toLowerCase().includes('pilihan');

                                    // Category label
                                    let categoryLabel = 'Wajib';
                                    if (isPracticumCourse) categoryLabel = 'Praktikum';
                                    else if (isKKNCourse) categoryLabel = 'KKN';
                                    else if (isPKLCourse) categoryLabel = 'PKL / Magang';
                                    else if (isElectiveCourse) categoryLabel = 'Pilihan';

                                    // Non-schedulable flag (KKN, PKL, Praktikum)
                                    const isNonSchedulable = isPracticumCourse || isKKNCourse || isPKLCourse;

                                    // Canonical participant count for this course code
                                    const rawParticipant = participantInputMap[codeKey];
                                    const currentParticipant =
                                      rawParticipant !== undefined
                                        ? rawParticipant
                                        : planned?.totalParticipants !== undefined
                                        ? planned.totalParticipants
                                        : '';

                                    const isParticipantInvalid =
                                      isSelected &&
                                      !isNonSchedulable &&
                                      (currentParticipant === '' || Number(currentParticipant) <= 0);

                                    return (
                                      <tr
                                        key={`${pkg.id}:${course.code}`}
                                        className={cn(
                                          'transition-colors',
                                          isSelected ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-slate-50/60'
                                        )}
                                      >
                                        {/* 1. Checkbox */}
                                        <td className="py-3 pl-4 pr-2 text-center">
                                          {isNonSchedulable ? (
                                            <span
                                              className="w-4 h-4 inline-block text-slate-300 select-none cursor-not-allowed"
                                              title={
                                                isKKNCourse
                                                  ? 'KKN dikelola LPPM — tidak dijadwalkan perkuliahan reguler'
                                                  : isPKLCourse
                                                  ? 'PKL / Magang dikelola mandiri — tidak dijadwalkan perkuliahan reguler'
                                                  : 'Praktikum dikelola laboratorium — non-jadwal perkuliahan'
                                              }
                                            >
                                              -
                                            </span>
                                          ) : (
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => onToggleCourse(pkg, course, categoryLabel)}
                                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                              aria-label={`Pilih ${course.name}`}
                                            />
                                          )}
                                        </td>

                                        {/* 2. Kode & Nama Mata Kuliah */}
                                        <td className="py-3 px-3">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                              {course.code}
                                            </span>
                                            <span
                                              className={cn(
                                                'font-medium text-slate-800',
                                                isSelected && 'font-bold text-slate-900'
                                              )}
                                            >
                                              {course.name}
                                            </span>

                                            {/* Specific Badges */}
                                            {isKKNCourse && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                                KKN — Dikelola LPPM
                                              </span>
                                            )}
                                            {isPKLCourse && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                PKL — Magang / Tidak Dijadwalkan
                                              </span>
                                            )}
                                            {isPracticumCourse && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Praktikum — Dikelola Terpisah
                                              </span>
                                            )}
                                            {isSharedCourse && !isNonSchedulable && (
                                              <span
                                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-3xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 select-none"
                                                title={`Mata kuliah bersama yang digunakan di ${occurrence?.count} paket: ${occurrence?.packageNames.join(', ')}`}
                                              >
                                                <Users className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                                                <span>Mata Kuliah Bersama</span>
                                              </span>
                                            )}
                                          </div>
                                        </td>

                                        {/* 3. SKS */}
                                        <td className="py-3 px-3 text-center">
                                          <span className="font-semibold text-slate-700 bg-slate-100/70 px-2 py-0.5 rounded">
                                            {course.sks} SKS
                                          </span>
                                        </td>

                                        {/* 4. Kategori */}
                                        <td className="py-3 px-3 text-center">
                                          <span
                                            className={cn(
                                              'inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold',
                                              categoryLabel === 'Wajib'
                                                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                                : categoryLabel === 'Pilihan'
                                                ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                                                : categoryLabel === 'Praktikum'
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-slate-100 text-slate-600'
                                            )}
                                          >
                                            {categoryLabel}
                                          </span>
                                        </td>

                                        {/* 5. Jumlah Peserta */}
                                        <td className="py-3 px-3 text-center">
                                          {isKKNCourse ? (
                                            <span className="text-3xs text-slate-400 font-medium italic">
                                              Dikelola LPPM
                                            </span>
                                          ) : isPKLCourse ? (
                                            <span className="text-3xs text-slate-400 font-medium italic">
                                              Kegiatan Magang
                                            </span>
                                          ) : isPracticumCourse ? (
                                            <span className="text-3xs text-emerald-700 font-medium italic">
                                              Dikelola Asisten Lab
                                            </span>
                                          ) : (
                                            <div className="flex flex-col items-center justify-center">
                                              <div className="relative w-28">
                                                <input
                                                  type="text"
                                                  inputMode="numeric"
                                                  pattern="[0-9]*"
                                                  disabled={!isSelected}
                                                  data-invalid-participant={isParticipantInvalid ? 'true' : 'false'}
                                                  value={currentParticipant === 0 && !isSelected ? '' : currentParticipant}
                                                  onChange={(e) => {
                                                    const normalized = normalizeParticipantInput(e.target.value);
                                                    onUpdateParticipants(codeKey, normalized);
                                                  }}
                                                  placeholder={isSelected ? '0' : '-'}
                                                  className={cn(
                                                    'w-full text-center px-2.5 py-1.5 rounded-lg border text-xs transition-all',
                                                    !isSelected && 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed',
                                                    isSelected && !isParticipantInvalid && 'bg-white border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold',
                                                    isSelected && isParticipantInvalid && 'bg-rose-50 border-rose-300 text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-semibold'
                                                  )}
                                                />
                                              </div>
                                              {isSharedCourse && isSelected && (
                                                <span className="text-3xs text-slate-400 font-normal mt-0.5 whitespace-nowrap">
                                                  Tersinkron ({occurrence?.count} Paket)
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </td>

                                        {/* 6. Status Penjadwalan */}
                                        <td className="py-3 px-3 text-center">
                                          {isKKNCourse || isPKLCourse ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                              Tidak Dijadwalkan
                                            </span>
                                          ) : isPracticumCourse ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                              Non-Jadwal Kuliah
                                            </span>
                                          ) : isSelected ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-2xs font-semibold border border-blue-200/60">
                                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                                              <span>Dijadwalkan</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 text-2xs font-medium">
                                              Belum Dipilih
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
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 3. DEDICATED SECTION: MATA KULIAH PILIHAN YANG DIBUKA */}
      <div className="bg-white border-2 border-purple-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 bg-purple-50/70 border-b border-purple-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Mata Kuliah Pilihan yang Dibuka
                </h3>
                <span className="text-3xs px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-900 font-bold uppercase tracking-wider">
                  {openedElectiveCourses.length} Mata Kuliah
                </span>
              </div>
              <p className="text-2xs text-slate-500">
                MK Pilihan hanya dibuka jika memiliki minimal 10 mahasiswa peminat.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setElectiveSearch('');
              setShowElectiveModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Mata Kuliah Pilihan</span>
          </button>
        </div>

        {/* Opened Electives Table */}
        {openedElectiveCourses.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Tag className="w-10 h-10 text-purple-200 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">
              Belum ada Mata Kuliah Pilihan yang dibuka untuk semester ini.
            </p>
            <p className="text-2xs text-slate-400 max-w-md mx-auto">
              Klik tombol di atas untuk memilih mata kuliah pilihan dari katalog kurikulum dengan minimal 10 peminat.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-purple-50/40 text-purple-900 text-3xs uppercase tracking-wider border-b border-purple-100 select-none">
                  <th className="py-3 px-4 min-w-[220px]">Kode & Mata Kuliah Pilihan</th>
                  <th className="py-3 px-3 w-20 text-center">SKS</th>
                  <th className="py-3 px-3 w-40 text-center">KBK / Kurikulum</th>
                  <th className="py-3 px-3 w-40 text-center">Jumlah Peminat</th>
                  <th className="py-3 px-3 w-32 text-center">Status</th>
                  <th className="py-3 px-4 w-28 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-100/60">
                {openedElectiveCourses.map((pc) => {
                  const codeKey = pc.courseCode.trim().toUpperCase();
                  const rawCount = participantInputMap[codeKey];
                  const currentCount =
                    rawCount !== undefined ? rawCount : pc.totalParticipants || 0;
                  const isBelowMin = currentCount < 10;

                  return (
                    <tr key={pc.selectionKey || pc.courseCode} className="hover:bg-purple-50/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                            {pc.courseCode}
                          </span>
                          <span className="font-bold text-slate-900">{pc.courseName}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {pc.sks} SKS
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="text-2xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {pc.kbkName || pc.kbkCode || 'Umum'} (K{pc.curriculumYear || 2026})
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={currentCount === 0 ? '' : currentCount}
                            onChange={(e) => {
                              const normalized = normalizeParticipantInput(e.target.value);
                              onUpdateParticipants(codeKey, normalized);
                            }}
                            placeholder="Min. 10"
                            className={cn(
                              'w-24 text-center px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                              isBelowMin
                                ? 'bg-amber-50 border-amber-300 text-amber-900 focus:ring-2 focus:ring-amber-500/20'
                                : 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500'
                            )}
                          />
                          {isBelowMin && (
                            <span className="text-3xs text-amber-700 font-bold mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Min. 10 Mahasiswa
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-3xs font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3 text-blue-600" />
                          <span>DIBUKA</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleCloseElectiveCourse(pc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-3xs font-bold rounded-lg border border-rose-200 transition-colors cursor-pointer"
                          title="Batalkan pembukaan MK pilihan ini"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Batalkan</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL: TAMBAH MATA KULIAH PILIHAN */}
      {showElectiveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    Tambah Mata Kuliah Pilihan yang Dibuka
                  </h3>
                  <p className="text-2xs text-purple-100">
                    Pilih mata kuliah pilihan dari kurikulum. Minimal 10 peminat diperlukan agar dapat dibuka.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowElectiveModal(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filters & Search */}
            <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={electiveSearch}
                  onChange={(e) => setElectiveSearch(e.target.value)}
                  placeholder="Cari kode atau nama MK pilihan..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2 text-2xs text-slate-500 w-full sm:w-auto justify-end">
                <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>Jumlah peminat disinkronkan langsung per kode mata kuliah.</span>
              </div>
            </div>

            {/* Modal Content Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredElectiveCatalog.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Tidak ada mata kuliah pilihan yang cocok.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-3xs uppercase tracking-wider border-b border-slate-200 select-none">
                      <th className="py-2.5 px-3">Kode & Nama MK</th>
                      <th className="py-2.5 px-3 w-16 text-center">SKS</th>
                      <th className="py-2.5 px-3 w-36 text-center">KBK</th>
                      <th className="py-2.5 px-3 w-36 text-center">Jumlah Peminat</th>
                      <th className="py-2.5 px-3 w-32 text-center">Kelayakan</th>
                      <th className="py-2.5 px-3 w-36 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredElectiveCatalog.map((item) => {
                      const codeKey = item.course.code.trim().toUpperCase();
                      const isAlreadyOpened = selectedMap.has(codeKey);
                      const rawCount = participantInputMap[codeKey];
                      const currentCount =
                        rawCount !== undefined
                          ? rawCount
                          : isAlreadyOpened
                          ? selectedMap.get(codeKey)?.totalParticipants || 0
                          : 0;

                      const isEligible = currentCount >= 10;

                      return (
                        <tr
                          key={`${item.pkg.id}:${item.course.code}`}
                          className={cn('hover:bg-slate-50/70', isAlreadyOpened && 'bg-purple-50/30')}
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                {item.course.code}
                              </span>
                              <span className="font-semibold text-slate-900">
                                {item.course.name}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center font-semibold text-slate-700">
                            {item.course.sks} SKS
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="text-3xs font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              {item.kbkName}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={currentCount === 0 ? '' : currentCount}
                              onChange={(e) => {
                                const normalized = normalizeParticipantInput(e.target.value);
                                onUpdateParticipants(codeKey, normalized);
                              }}
                              placeholder="0"
                              className={cn(
                                'w-20 text-center px-2 py-1 rounded-lg border text-xs font-bold transition-all',
                                isEligible
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 focus:ring-2 focus:ring-emerald-500/20'
                                  : 'bg-white border-slate-300 text-slate-700 focus:ring-2 focus:ring-purple-500/20'
                              )}
                            />
                          </td>

                          <td className="py-3 px-3 text-center">
                            {isEligible ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>MEMENUHI</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-50 text-amber-800 border border-amber-300"
                                title="Minimal 10 mahasiswa diperlukan untuk membuka mata kuliah pilihan."
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>BELUM MEMENUHI</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {isAlreadyOpened ? (
                              <span className="inline-flex items-center gap-1 text-2xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>SUDAH DIBUKA</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={!isEligible}
                                onClick={() => handleOpenElectiveCourse(item)}
                                title={
                                  !isEligible
                                    ? 'Minimal 10 mahasiswa diperlukan untuk membuka mata kuliah pilihan.'
                                    : 'Buka mata kuliah pilihan ini'
                                }
                                className={cn(
                                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs',
                                  isEligible
                                    ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer active:scale-98'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-70'
                                )}
                              >
                                Buka Mata Kuliah
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-2xs text-slate-500">
                {openedElectiveCourses.length} Mata Kuliah Pilihan sedang dibuka.
              </span>
              <button
                type="button"
                onClick={() => setShowElectiveModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
