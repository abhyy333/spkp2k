import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  RotateCcw,
  BookOpen,
  Users,
  GraduationCap,
  Calendar,
  Layers,
  Sparkles,
  Filter,
} from 'lucide-react';
import { lecturersService } from '../../services/lecturers.service';
import { LecturerCourseAssignment } from '../../types';
import { LoadingState } from '../ui/LoadingState';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { useToast } from '../ui/Toast';

export const LecturerCourseAssignmentsTab: React.FC = () => {
  const toast = useToast();

  const [assignments, setAssignments] = useState<LecturerCourseAssignment[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<string>('all'); // 'all' or '1'..'8'
  const [semesterTypeFilter, setSemesterTypeFilter] = useState<'all' | 'GANJIL' | 'GENAP'>('all');
  const [academicYearFilter, setAcademicYearFilter] = useState<string>('all');

  const fetchAssignments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [data, years] = await Promise.all([
        lecturersService.getLecturerCourseAssignments({
          semester: semesterFilter,
          semesterType: semesterTypeFilter,
          academicYear: academicYearFilter,
          search: search,
        }),
        lecturersService.getAcademicYears(),
      ]);

      setAssignments(data);
      if (years.length > 0) {
        setAcademicYears(years);
      }
      if (isRefresh) {
        toast.success('Data dosen pengampu mata kuliah berhasil diperbarui.');
      }
    } catch (err: any) {
      console.error('Error in fetchAssignments:', err);
      setError(err.message || 'Gagal memuat data dosen pengampu mata kuliah.');
      if (isRefresh) {
        toast.error('Gagal memperbarui data dosen pengampu.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [semesterFilter, semesterTypeFilter, academicYearFilter, search, toast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleResetFilters = () => {
    setSearch('');
    setSemesterFilter('all');
    setSemesterTypeFilter('all');
    setAcademicYearFilter('all');
  };

  // Group assignments strictly by Semester 1 to 8
  const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

  // Determine active semesters to display based on filters
  const visibleSemesters = useMemo(() => {
    return SEMESTERS.filter((sem) => {
      // Semester filter
      if (semesterFilter !== 'all' && Number(semesterFilter) !== sem) {
        return false;
      }
      // Ganjil / Genap filter
      if (semesterTypeFilter === 'GANJIL' && sem % 2 === 0) {
        return false;
      }
      if (semesterTypeFilter === 'GENAP' && sem % 2 !== 0) {
        return false;
      }
      return true;
    });
  }, [SEMESTERS, semesterFilter, semesterTypeFilter]);

  // Group data by semester
  const assignmentsBySemester = useMemo(() => {
    const map: Record<number, LecturerCourseAssignment[]> = {};
    SEMESTERS.forEach((sem) => {
      map[sem] = [];
    });

    assignments.forEach((item) => {
      const sem = Number(item.semester);
      if (map[sem]) {
        map[sem].push(item);
      } else {
        // In case non-standard semester > 8
        if (!map[sem]) map[sem] = [];
        map[sem].push(item);
      }
    });

    return map;
  }, [assignments, SEMESTERS]);

  // Summary Metrics
  const totalAssignmentsCount = assignments.length;
  const uniqueCoursesCount = useMemo(() => {
    const set = new Set(assignments.map((a) => a.course_code || a.course_name));
    return set.size;
  }, [assignments]);
  const uniqueLecturersCount = useMemo(() => {
    const set = new Set(assignments.map((a) => a.lecturer_name));
    return set.size;
  }, [assignments]);
  const totalSks = useMemo(() => {
    // Unique classes SKS
    const seen = new Set<string>();
    let sum = 0;
    assignments.forEach((a) => {
      const key = `${a.course_code || a.course_name}-${a.class_code}`;
      if (!seen.has(key)) {
        seen.add(key);
        sum += a.effective_sks || 0;
      }
    });
    return sum;
  }, [assignments]);

  return (
    <div className="space-y-6">
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Total Penugasan</p>
            <p className="text-xl font-bold text-slate-800 tracking-tight mt-0.5">{totalAssignmentsCount}</p>
            <p className="text-2xs text-slate-500">alokasi dosen di kelas</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Mata Kuliah</p>
            <p className="text-xl font-bold text-slate-800 tracking-tight mt-0.5">{uniqueCoursesCount}</p>
            <p className="text-2xs text-slate-500">mata kuliah terjadwal</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Dosen Pengampu</p>
            <p className="text-xl font-bold text-slate-800 tracking-tight mt-0.5">{uniqueLecturersCount}</p>
            <p className="text-2xs text-slate-500">dosen aktif mengajar</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Total Beban SKS</p>
            <p className="text-xl font-bold text-slate-800 tracking-tight mt-0.5">{totalSks} SKS</p>
            <p className="text-2xs text-slate-500">kumulatif kelas kuliah</p>
          </div>
        </div>
      </div>

      {/* Filter & Toolbar Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari mata kuliah, kode dosen, atau nama dosen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Semester 1–8 filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-semibold text-slate-400 uppercase">Semester:</span>
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-700"
              >
                <option value="all">Semua Semester</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
                <option value="3">Semester 3</option>
                <option value="4">Semester 4</option>
                <option value="5">Semester 5</option>
                <option value="6">Semester 6</option>
                <option value="7">Semester 7</option>
                <option value="8">Semester 8</option>
              </select>
            </div>

            {/* Ganjil / Genap filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-semibold text-slate-400 uppercase">Tipe:</span>
              <select
                value={semesterTypeFilter}
                onChange={(e) => setSemesterTypeFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-700"
              >
                <option value="all">Semua Tipe</option>
                <option value="GANJIL">Ganjil (Sem 1, 3, 5, 7)</option>
                <option value="GENAP">Genap (Sem 2, 4, 6, 8)</option>
              </select>
            </div>

            {/* Academic Year Filter */}
            {academicYears.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-2xs font-semibold text-slate-400 uppercase">Tahun:</span>
                <select
                  value={academicYearFilter}
                  onChange={(e) => setAcademicYearFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-700"
                >
                  <option value="all">Semua Tahun</option>
                  {academicYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Filter Button */}
            {(search || semesterFilter !== 'all' || semesterTypeFilter !== 'all' || academicYearFilter !== 'all') && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Reset semua filter"
              >
                Reset
              </button>
            )}

            {/* Real-time Refresh Button */}
            <button
              onClick={() => fetchAssignments(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer ml-auto"
              title="Perbarui data secara real-time dari Supabase"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Memperbarui...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Quick pill selector for Semesters 1 to 8 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 text-xs">
          <span className="text-2xs font-semibold text-slate-400 uppercase mr-1 shrink-0">Pilih Cepat:</span>
          <button
            onClick={() => setSemesterFilter('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              semesterFilter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua
          </button>
          {SEMESTERS.map((sem) => (
            <button
              key={sem}
              onClick={() => setSemesterFilter(String(sem))}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                semesterFilter === String(sem)
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semester {sem}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Grouped by Semester 1 to 8 */}
      {loading ? (
        <LoadingState message="Memuat data penugasan dosen pengampu dari Supabase..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchAssignments(true)} />
      ) : visibleSemesters.length === 0 ? (
        <EmptyState
          title="Tidak ada semester yang sesuai filter"
          description="Silakan sesuaikan filter semester atau tipe semester di atas."
          icon={<Filter className="w-8 h-8 text-slate-400" />}
          action={{
            label: 'Reset Filter',
            onClick: handleResetFilters,
          }}
        />
      ) : (
        <div className="space-y-6">
          {visibleSemesters.map((sem) => {
            const semAssignments = assignmentsBySemester[sem] || [];
            const semCoursesCount = new Set(semAssignments.map((a) => a.course_code || a.course_name)).size;
            const semSks = semAssignments.reduce((acc, curr, idx, arr) => {
              const isFirst = arr.findIndex((x) => x.course_name === curr.course_name && x.class_code === curr.class_code) === idx;
              return isFirst ? acc + (curr.effective_sks || 0) : acc;
            }, 0);

            return (
              <div
                key={sem}
                className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden"
              >
                {/* Section Header */}
                <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                      {sem}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                        Semester {sem}
                      </h3>
                      <p className="text-2xs text-slate-500">
                        {sem % 2 !== 0 ? 'Semester Ganjil' : 'Semester Genap'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-2xs font-semibold">
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-2xs">
                      {semCoursesCount} Mata Kuliah
                    </span>
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-2xs">
                      {semAssignments.length} Penugasan Dosen
                    </span>
                    <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
                      {semSks} SKS Total
                    </span>
                  </div>
                </div>

                {/* Table for this Semester */}
                {semAssignments.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs text-slate-400 italic">
                      Belum ada data mata kuliah dan penugasan dosen untuk Semester {sem}.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                        <tr>
                          <th className="py-3 px-4 w-12 text-center">No</th>
                          <th className="py-3 px-4 min-w-[220px]">Mata Kuliah</th>
                          <th className="py-3 px-4 w-20 text-center">Kelas</th>
                          <th className="py-3 px-4 w-20 text-center">SKS</th>
                          <th className="py-3 px-4 w-28 text-center">Kode Dosen</th>
                          <th className="py-3 px-4 min-w-[220px]">Dosen Pengampu</th>
                          <th className="py-3 px-4 w-40">NIP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {semAssignments.map((item, idx) => {
                          const isKoordinator =
                            (item.assignment_role || '').toUpperCase() === 'KOORDINATOR';

                          return (
                            <tr
                              key={`${sem}-${item.course_code || item.course_name}-${item.class_code}-${item.lecturer_name}-${idx}`}
                              className="hover:bg-blue-50/40 transition-colors"
                            >
                              {/* No */}
                              <td className="py-3 px-4 text-center font-mono text-slate-400 text-2xs">
                                {idx + 1}
                              </td>

                              {/* Mata Kuliah */}
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900 leading-snug">
                                  {item.course_name}
                                </div>
                                <div className="text-2xs text-slate-400 font-mono mt-0.5">
                                  {item.course_code || '—'}
                                </div>
                              </td>

                              {/* Kelas */}
                              <td className="py-3 px-4 text-center">
                                <span className="inline-block px-2.5 py-0.5 font-bold font-mono text-2xs rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                                  {item.class_code || 'A'}
                                </span>
                              </td>

                              {/* SKS */}
                              <td className="py-3 px-4 text-center font-semibold text-slate-700">
                                {item.effective_sks || 0}
                              </td>

                              {/* Kode Dosen */}
                              <td className="py-3 px-4 text-center">
                                {item.lecturer_code ? (
                                  <span className="inline-block px-2 py-0.5 font-mono font-bold text-2xs rounded bg-purple-50 text-purple-700 border border-purple-200">
                                    {item.lecturer_code}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono text-2xs">—</span>
                                )}
                              </td>

                              {/* Dosen Pengampu */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-slate-800">
                                    {item.lecturer_name || '—'}
                                  </span>
                                  {isKoordinator ? (
                                    <span className="inline-block px-2 py-0.5 text-3xs font-bold uppercase rounded bg-blue-100 text-blue-700 border border-blue-200">
                                      Koordinator
                                    </span>
                                  ) : item.assignment_role ? (
                                    <span className="inline-block px-1.5 py-0.5 text-3xs font-medium uppercase rounded bg-slate-100 text-slate-600 border border-slate-200">
                                      {item.assignment_role}
                                    </span>
                                  ) : null}
                                </div>
                              </td>

                              {/* NIP */}
                              <td className="py-3 px-4 font-mono text-2xs text-slate-500">
                                {item.nip || '—'}
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
    </div>
  );
};
