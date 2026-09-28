import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  CheckSquare,
  Square,
  Search,
  Check,
  RotateCcw,
  AlertTriangle,
  Layers,
  ArrowRight,
  Info,
  Users,
} from 'lucide-react';
import { AcademicTerm } from '../../../types';
import {
  PackageGroup,
  PackageCourseItem,
  KURIKULUM_2026_ALL_PACKAGES,
  KURIKULUM_2022_ALL_PACKAGES,
} from './PackageDefinitionConstants';
import { curriculumPackagesService } from '../../../services/curriculumPackages.service';
import { toast } from '../../ui/Toast';

interface Step1CourseSelectionProps {
  activeTerm: AcademicTerm | null;
  selectedCourseCodes: string[];
  expectedStudentsMap: Record<string, number>;
  onToggleCourse: (courseCode: string) => void;
  onSelectMultipleCourses: (courseCodes: string[]) => void;
  onDeselectMultipleCourses: (courseCodes: string[]) => void;
  onUpdateExpectedStudents: (courseCode: string, count: number) => void;
  curriculumYear: 2026 | 2022;
  onChangeCurriculumYear: (year: 2026 | 2022) => void;
}

export const Step1CourseSelection: React.FC<Step1CourseSelectionProps> = ({
  activeTerm,
  selectedCourseCodes,
  expectedStudentsMap,
  onToggleCourse,
  onSelectMultipleCourses,
  onDeselectMultipleCourses,
  onUpdateExpectedStudents,
  curriculumYear,
  onChangeCurriculumYear,
}) => {
  // Term Type (Ganjil vs Genap)
  const isTermGanjil = useMemo(() => {
    const semType =
      activeTerm?.semester_type?.toUpperCase() ||
      activeTerm?.term?.toUpperCase() ||
      'GANJIL';
    return semType.includes('GANJIL') || semType.includes('1') || semType.includes('ODD');
  }, [activeTerm]);

  const [termTypeFilter, setTermTypeFilter] = useState<'GANJIL' | 'GENAP'>(
    isTermGanjil ? 'GANJIL' : 'GENAP'
  );

  // Available Semesters for Current Term Type
  const availableSemesters = useMemo(() => {
    return termTypeFilter === 'GANJIL' ? [1, 3, 5, 7] : [2, 4, 6, 8];
  }, [termTypeFilter]);

  const [selectedSemester, setSelectedSemester] = useState<number | 'all'>('all');
  const [selectedKbkFilter, setSelectedKbkFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Packages list loaded for selected curriculum year
  const [packages, setPackages] = useState<PackageGroup[]>([]);
  const [loadingPackages, setLoadingPackages] = useState<boolean>(true);

  // Load packages whenever curriculumYear changes
  useEffect(() => {
    async function load() {
      setLoadingPackages(true);
      try {
        const rawList = await curriculumPackagesService.getPackages();
        const transformed: PackageGroup[] = rawList
          .map((pkg) => {
            const p = pkg.payload || {};
            const courses: PackageCourseItem[] = (p.courses || []).map((c: any, idx: number) => ({
              code: c.code,
              name: c.name,
              sks: Number(c.sks || 2),
              semester: Number(p.semester || 1),
              category: c.category || 'Wajib',
              kbk_code: c.kbk_code || p.kbk_code || 'DASAR',
              kbk_name: c.kbk_name || p.kbk_name || 'Dasar',
              order: idx + 1,
            }));
            const totalSks = courses.reduce((acc, c) => acc + (c.sks || 0), 0);
            return {
              id: pkg.id,
              legacy_id: pkg.legacy_id || `PKG_${pkg.id}`,
              name: pkg.name,
              curriculum_year: Number(p.curriculum_year || 2026) as 2026 | 2022,
              semester: Number(p.semester || 1),
              kbk_code: (p.kbk_code || 'DASAR') as any,
              kbk_name: p.kbk_name || 'Dasar',
              badge_label: p.badge_label || `Semester ${p.semester || 1}`,
              total_sks: Number(p.total_sks || totalSks),
              course_count: Number(p.course_count || courses.length),
              courses,
            };
          })
          .filter((g) => g.curriculum_year === curriculumYear);

        if (transformed.length === 0) {
          const fallback = curriculumYear === 2026 ? KURIKULUM_2026_ALL_PACKAGES : KURIKULUM_2022_ALL_PACKAGES;
          setPackages(fallback);
        } else {
          setPackages(transformed);
        }
      } catch (err) {
        console.warn('Pemberitahuan memuat paket:', err);
        const fallback = curriculumYear === 2026 ? KURIKULUM_2026_ALL_PACKAGES : KURIKULUM_2022_ALL_PACKAGES;
        setPackages(fallback);
      } finally {
        setLoadingPackages(false);
      }
    }
    load();
  }, [curriculumYear]);

  // Reset semester / KBK filter when changing termType or curriculumYear
  useEffect(() => {
    setSelectedSemester('all');
    setSelectedKbkFilter('all');
  }, [termTypeFilter, curriculumYear]);

  // Filter packages based on active term type, semester filter, KBK filter, and search
  const visiblePackages = useMemo(() => {
    return packages
      .filter((pkg) => {
        // 1. Term type filter (Ganjil: 1, 3, 5, 7; Genap: 2, 4, 6, 8)
        const isPkgGanjil = pkg.semester % 2 !== 0;
        if (termTypeFilter === 'GANJIL' && !isPkgGanjil) return false;
        if (termTypeFilter === 'GENAP' && isPkgGanjil) return false;

        // 2. Specific semester filter
        if (selectedSemester !== 'all' && pkg.semester !== selectedSemester) {
          return false;
        }

        // 3. KBK filter (applies for Semester 5-8)
        if (pkg.semester >= 5 && selectedKbkFilter !== 'all') {
          if (curriculumYear === 2022) {
            if (selectedKbkFilter === 'ELKOM_TEL' || selectedKbkFilter === 'ELKOM_EL') {
              if (pkg.kbk_code !== selectedKbkFilter) return false;
            } else if (pkg.kbk_code !== selectedKbkFilter) {
              return false;
            }
          } else {
            if (pkg.kbk_code !== selectedKbkFilter) return false;
          }
        }

        return true;
      })
      .map((pkg) => {
        if (!search.trim()) return pkg;
        const q = search.toLowerCase().trim();
        const matchingCourses = pkg.courses.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q)
        );
        return {
          ...pkg,
          courses: matchingCourses,
        };
      })
      .filter((pkg) => pkg.courses.length > 0);
  }, [packages, termTypeFilter, selectedSemester, selectedKbkFilter, search, curriculumYear]);

  // All visible course codes across current visible packages
  const allVisibleCourseCodes = useMemo(() => {
    const set = new Set<string>();
    visiblePackages.forEach((pkg) => {
      pkg.courses.forEach((c) => set.add(c.code));
    });
    return Array.from(set);
  }, [visiblePackages]);

  // Total courses count in currently visible packages
  const totalVisibleCoursesCount = allVisibleCourseCodes.length;

  // Selected count within visible packages
  const selectedVisibleCount = useMemo(() => {
    return allVisibleCourseCodes.filter((code) => selectedCourseCodes.includes(code)).length;
  }, [allVisibleCourseCodes, selectedCourseCodes]);

  const allVisibleSelected =
    totalVisibleCoursesCount > 0 && selectedVisibleCount === totalVisibleCoursesCount;

  // Selection handlers
  const handleSelectAllVisible = () => {
    onSelectMultipleCourses(allVisibleCourseCodes);
    toast.success(`${allVisibleCourseCodes.length} mata kuliah dipilih.`);
  };

  const handleDeselectAllVisible = () => {
    onDeselectMultipleCourses(allVisibleCourseCodes);
    toast.info('Pilihan mata kuliah dikosongkan.');
  };

  const handleSelectPackage = (pkg: PackageGroup) => {
    const codes = pkg.courses.map((c) => c.code);
    onSelectMultipleCourses(codes);
  };

  const handleDeselectPackage = (pkg: PackageGroup) => {
    const codes = pkg.courses.map((c) => c.code);
    onDeselectMultipleCourses(codes);
  };

  const handleSelectSemester = (sem: number) => {
    const semCodes: string[] = [];
    packages
      .filter((p) => p.semester === sem)
      .forEach((p) => p.courses.forEach((c) => semCodes.push(c.code)));
    onSelectMultipleCourses(semCodes);
    toast.success(`Semua mata kuliah Semester ${sem} dipilih.`);
  };

  const handleDeselectSemester = (sem: number) => {
    const semCodes: string[] = [];
    packages
      .filter((p) => p.semester === sem)
      .forEach((p) => p.courses.forEach((c) => semCodes.push(c.code)));
    onDeselectMultipleCourses(semCodes);
  };

  // Group visible packages by semester for structured rendering
  const semesterGroups = useMemo(() => {
    const map = new Map<number, PackageGroup[]>();
    availableSemesters.forEach((s) => map.set(s, []));

    visiblePackages.forEach((pkg) => {
      const arr = map.get(pkg.semester) || [];
      arr.push(pkg);
      map.set(pkg.semester, arr);
    });

    return Array.from(map.entries())
      .filter(([_, pkgs]) => pkgs.length > 0)
      .map(([sem, pkgs]) => ({
        semester: sem,
        packages: pkgs,
      }));
  }, [visiblePackages, availableSemesters]);

  // Fast occurrence map across all loaded packages to detect shared courses
  const courseOccurrenceMap = useMemo(() => {
    const map = new Map<string, { count: number; packageNames: string[]; kbkNames: string[] }>();
    packages.forEach((pkg) => {
      pkg.courses.forEach((c) => {
        const codeKey = c.code.trim().toUpperCase();
        const existing = map.get(codeKey) || { count: 0, packageNames: [], kbkNames: [] };
        existing.count += 1;
        if (!existing.packageNames.includes(pkg.name)) {
          existing.packageNames.push(pkg.name);
        }
        if (pkg.kbk_name && !existing.kbkNames.includes(pkg.kbk_name)) {
          existing.kbkNames.push(pkg.kbk_name);
        }
        map.set(codeKey, existing);
      });
    });
    return map;
  }, [packages]);

  // Global selection metrics (Deduplicated unique courses)
  const uniqueSelectedCoursesMap = useMemo(() => {
    const map = new Map<string, PackageCourseItem>();
    packages.forEach((p) => {
      p.courses.forEach((c) => {
        const codeKey = c.code.trim().toUpperCase();
        if (selectedCourseCodes.includes(c.code) && !map.has(codeKey)) {
          map.set(codeKey, c);
        }
      });
    });
    return map;
  }, [packages, selectedCourseCodes]);

  const totalSelectedInCurriculum = selectedCourseCodes.length;

  const totalSelectedSks = useMemo(() => {
    let sks = 0;
    uniqueSelectedCoursesMap.forEach((c) => {
      sks += Number(c.sks || 0);
    });
    return sks;
  }, [uniqueSelectedCoursesMap]);

  const totalParticipantsCount = useMemo(() => {
    return selectedCourseCodes.reduce((acc, code) => acc + (expectedStudentsMap[code] || 0), 0);
  }, [selectedCourseCodes, expectedStudentsMap]);

  return (
    <div className="space-y-6 pb-28">
      {/* ------------------------------------------------------------------ */}
      {/* 1. FILTER & CONTROLS CARD */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3.5">
        {/* Row 1: Periode & Exclusive Status Kurikulum */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          {/* Periode Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
              PERIODE:
            </span>
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setTermTypeFilter('GANJIL')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  termTypeFilter === 'GANJIL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semester Ganjil (1, 3, 5, 7)
              </button>
              <button
                type="button"
                onClick={() => setTermTypeFilter('GENAP')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  termTypeFilter === 'GENAP'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semester Genap (2, 4, 6, 8)
              </button>
            </div>
          </div>

          {/* Exclusive Kurikulum Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
              STATUS KURIKULUM:
            </span>
            <div className="flex items-center gap-2">
              {/* Kurikulum 2026 */}
              <button
                type="button"
                onClick={() => onChangeCurriculumYear(2026)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
                  curriculumYear === 2026
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center ${
                    curriculumYear === 2026 ? 'bg-emerald-600 text-white' : 'border border-slate-300'
                  }`}
                >
                  {curriculumYear === 2026 && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Kurikulum 2026 (OBE)</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-4xs font-bold uppercase tracking-wider ${
                    curriculumYear === 2026 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {curriculumYear === 2026 ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </button>

              {/* Kurikulum 2022 */}
              <button
                type="button"
                onClick={() => onChangeCurriculumYear(2022)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
                  curriculumYear === 2022
                    ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center ${
                    curriculumYear === 2022 ? 'bg-white text-slate-900' : 'border border-slate-300'
                  }`}
                >
                  {curriculumYear === 2022 && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Kurikulum 2022</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-4xs font-bold uppercase tracking-wider ${
                    curriculumYear === 2022 ? 'bg-emerald-400 text-slate-900' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {curriculumYear === 2022 ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Semester Buttons, Search, Select All / Clear */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Semester Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedSemester('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                selectedSemester === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Semester
            </button>
            {availableSemesters.map((sem) => (
              <button
                key={sem}
                type="button"
                onClick={() => setSelectedSemester(sem)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  selectedSemester === sem
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semester {sem}
              </button>
            ))}
          </div>

          {/* Search + Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari kode/nama MK..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-slate-50/50"
              />
            </div>

            <button
              type="button"
              onClick={handleSelectAllVisible}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-800 font-bold text-xs border border-slate-200 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Pilih Semua dari Template
            </button>

            <button
              type="button"
              onClick={handleDeselectAllVisible}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-600 font-semibold text-xs border border-slate-200 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              Kosongkan Semua
            </button>
          </div>
        </div>

        {/* Row 3 (Conditional): KBK Selector for Semester >= 5 */}
        {selectedSemester !== 'all' && selectedSemester >= 5 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 bg-blue-50/40 p-2.5 rounded-xl border border-blue-100/80">
            <span className="text-2xs font-bold text-blue-950 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Pilih KBK (Semester {selectedSemester}):
            </span>

            <button
              type="button"
              onClick={() => setSelectedKbkFilter('all')}
              className={`px-2.5 py-1 text-2xs font-bold rounded-lg transition-all ${
                selectedKbkFilter === 'all'
                  ? 'bg-blue-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50'
              }`}
            >
              Semua KBK
            </button>

            <button
              type="button"
              onClick={() => setSelectedKbkFilter('STL')}
              className={`px-2.5 py-1 text-2xs font-bold rounded-lg transition-all ${
                selectedKbkFilter === 'STL'
                  ? 'bg-blue-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50'
              }`}
            >
              Sistem Tenaga Listrik
            </button>

            <button
              type="button"
              onClick={() => setSelectedKbkFilter('KOMPUTER')}
              className={`px-2.5 py-1 text-2xs font-bold rounded-lg transition-all ${
                selectedKbkFilter === 'KOMPUTER'
                  ? 'bg-blue-800 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50'
              }`}
            >
              Komputer
            </button>

            {curriculumYear === 2026 ? (
              <button
                type="button"
                onClick={() => setSelectedKbkFilter('ELKOM')}
                className={`px-2.5 py-1 text-2xs font-bold rounded-lg transition-all ${
                  selectedKbkFilter === 'ELKOM'
                    ? 'bg-blue-800 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50'
                }`}
              >
                Elektronika Digital dan Telekomunikasi
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedKbkFilter('ELKOM_TEL')}
                  className={`px-2.5 py-1 text-2xs font-bold rounded-lg transition-all ${
                    selectedKbkFilter === 'ELKOM_TEL'
                      ? 'bg-blue-800 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50'
                  }`}
                >
                  Legacy Telekomunikasi
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKbkFilter('ELKOM_EL')}
                  className={`px-2.5 py-1 text-2xs font-bold rounded-lg transition-all ${
                    selectedKbkFilter === 'ELKOM_EL'
                      ? 'bg-blue-800 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50'
                  }`}
                >
                  Legacy Elektronika
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. STATUS BAR */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-slate-200/90 px-4 py-2.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <span className="w-2 h-2 rounded-full bg-slate-900 shrink-0" />
          <span>
            Status Pemilihan:{' '}
            <strong className="text-slate-900 font-bold">
              {selectedVisibleCount} / {totalVisibleCoursesCount} MK Dipilih ({totalSelectedSks} SKS)
            </strong>{' '}
            <span className="text-slate-500 font-medium">
              ({totalParticipantsCount} Total Mahasiswa Terencana)
            </span>
          </span>
        </div>

        <div className="text-3xs text-slate-400 font-normal italic">
          * Centang checkbox pada mata kuliah yang ingin dibuka di semester ini. Data peserta dan status seleksi tersinkronisasi otomatis untuk kode MK yang sama.
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. GROUPED PACKAGES BY SEMESTER */}
      {/* ------------------------------------------------------------------ */}
      {loadingPackages ? (
        <div className="p-12 text-center text-xs text-slate-400">
          Memuat struktur paket kurikulum {curriculumYear}...
        </div>
      ) : semesterGroups.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          Tidak ada paket mata kuliah yang sesuai dengan filter yang dipilih.
        </div>
      ) : (
        <div className="space-y-8">
          {semesterGroups.map(({ semester, packages: semPackages }) => {
            return (
              <div key={`sem-group-${semester}`} className="space-y-4">
                {/* Semester Section Header */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 bg-slate-900 text-white font-bold text-xs rounded-lg uppercase tracking-wider shadow-2xs">
                      SEMESTER {semester}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      Proyeksi Kuota Angkatan:{' '}
                      <strong className="text-slate-800 font-semibold">76 Mahasiswa</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-2xs">
                    <button
                      type="button"
                      onClick={() => handleSelectSemester(semester)}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 shadow-2xs transition-colors"
                    >
                      + Pilih Semua Sem {semester}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeselectSemester(semester)}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-2xs transition-colors"
                    >
                      ✕ Kosongkan Sem {semester}
                    </button>
                  </div>
                </div>

                {/* Packages in this Semester */}
                {semPackages.map((pkg) => {
                  const pkgCodes = pkg.courses.map((c) => c.code);
                  const selectedInPkgCount = pkgCodes.filter((code) =>
                    selectedCourseCodes.includes(code)
                  ).length;
                  const isAllPkgSelected =
                    pkgCodes.length > 0 && selectedInPkgCount === pkgCodes.length;

                  return (
                    <div
                      key={pkg.id || pkg.legacy_id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
                    >
                      {/* Package Subheader Bar */}
                      <div className="p-3.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isAllPkgSelected}
                            onChange={(e) => {
                              if (e.target.checked) handleSelectPackage(pkg);
                              else handleDeselectPackage(pkg);
                            }}
                            className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
                          />
                          <h4 className="text-xs font-bold text-slate-900">
                            {pkg.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-3xs font-semibold bg-slate-200/80 text-slate-700">
                            {pkg.badge_label}
                          </span>
                        </div>

                        <div className="text-3xs font-medium text-slate-500">
                          <span>
                            {pkg.courses.length} MK ({pkg.total_sks} SKS)
                          </span>{' '}
                          •{' '}
                          <span className="text-slate-700 font-bold">
                            Terpilih {selectedInPkgCount} / {pkg.courses.length}
                          </span>
                        </div>
                      </div>

                      {/* Package Table: EXACT 1 ROW = 1 COURSE */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-200/90 text-slate-600 font-bold uppercase tracking-wider text-3xs select-none">
                              <th className="py-2.5 px-4 w-12 text-center">PILIH</th>
                              <th className="py-2.5 px-4 min-w-[260px]">KODE & MATA KULIAH</th>
                              <th className="py-2.5 px-3 w-16 text-center">SKS</th>
                              <th className="py-2.5 px-3 w-24 text-center">KATEGORI</th>
                              <th className="py-2.5 px-4 w-44">JUMLAH PESERTA</th>
                              <th className="py-2.5 px-4 w-44">ESTIMASI ROMBEL & SECTION</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {pkg.courses.map((course) => {
                              const codeKey = course.code.trim().toUpperCase();
                              const isSelected = selectedCourseCodes.includes(course.code);
                              const expectedCount = expectedStudentsMap[course.code] ?? 0;
                              const occurrence = courseOccurrenceMap.get(codeKey);
                              const isSharedCourse = (occurrence?.count || 0) > 1;

                              return (
                                <tr
                                  key={course.code}
                                  className={`transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50/30 hover:bg-blue-50/50'
                                      : 'hover:bg-slate-50/60'
                                  }`}
                                >
                                  {/* PILIH Checkbox */}
                                  <td className="py-3 px-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => onToggleCourse(course.code)}
                                      className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
                                    />
                                  </td>

                                  {/* KODE & MATA KULIAH */}
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-slate-900 leading-snug">
                                        {course.name}
                                      </span>
                                      {isSharedCourse && (
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-3xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 select-none"
                                          title={`Mata kuliah bersama yang digunakan di ${occurrence?.count} paket: ${occurrence?.packageNames.join(', ')}`}
                                        >
                                          <Users className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                                          <span>Mata Kuliah Bersama</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="font-mono text-3xs text-slate-400 mt-0.5">
                                      {course.code}
                                    </div>
                                  </td>

                                  {/* SKS */}
                                  <td className="py-3 px-3 text-center font-bold text-slate-800 font-mono">
                                    {course.sks}
                                  </td>

                                  {/* KATEGORI */}
                                  <td className="py-3 px-3 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded text-3xs font-semibold ${
                                        course.category === 'Wajib'
                                          ? 'bg-slate-100 text-slate-700'
                                          : course.category === 'Praktikum'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                                      }`}
                                    >
                                      {course.category}
                                    </span>
                                  </td>

                                  {/* JUMLAH PESERTA */}
                                  <td className="py-3 px-4">
                                    <div className="flex flex-col items-start gap-1 max-w-[140px]">
                                      <div className="flex items-center gap-1.5 w-full">
                                        <input
                                          type="number"
                                          min={0}
                                          placeholder="Isi kuota"
                                          value={expectedCount > 0 ? expectedCount : ''}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            onUpdateExpectedStudents(course.code, val);
                                          }}
                                          className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 font-mono"
                                        />
                                        <span className="text-3xs text-slate-400 font-medium shrink-0">
                                          mhs
                                        </span>
                                      </div>
                                      {isSharedCourse && isSelected && (
                                        <span className="text-3xs text-slate-400 font-normal whitespace-nowrap">
                                          Tersinkron ({occurrence?.count} Paket)
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* ESTIMASI ROMBEL & SECTION */}
                                  <td className="py-3 px-4">
                                    <span className="text-3xs text-slate-400 italic">
                                      {isSelected ? 'Belum dihitung' : 'Belum dicentang'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. STICKY BOTTOM ACTION BAR */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3.5 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Metrics */}
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Mata Kuliah Terpilih:</span>{' '}
              <strong className="text-slate-900 font-bold text-sm">
                {totalSelectedInCurriculum} MK ({totalSelectedSks} SKS)
              </strong>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="text-slate-600 font-medium">
              <span>{totalParticipantsCount} Total Peserta Terencana</span>
            </div>
          </div>

          {/* Right Action Button (Disabled with tooltip) */}
          <div className="flex items-center gap-3">
            <div className="relative group">
              <button
                type="button"
                disabled={true}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-300 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed select-none shadow-2xs"
              >
                <span>Lanjut ke Step 2 (Pembagian Rombel)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Tooltip */}
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-slate-900 text-white text-3xs rounded-lg py-1 px-3 shadow-md whitespace-nowrap z-50">
                Step 2 akan diaktifkan pada tahap implementasi berikutnya.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
