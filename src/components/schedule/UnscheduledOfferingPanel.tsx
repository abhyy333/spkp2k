import React, { useState, useMemo } from 'react';
import { CourseOffering, Lecturer } from '../../types';
import {
  Search,
  BookOpen,
  User,
  Users,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  PlusCircle,
  Filter,
} from 'lucide-react';

interface UnscheduledOfferingPanelProps {
  offerings: CourseOffering[];
  lecturers: Lecturer[];
  onSelectOffering: (offering: CourseOffering) => void;
}

export const UnscheduledOfferingPanel: React.FC<UnscheduledOfferingPanelProps> = ({
  offerings,
  lecturers,
  onSelectOffering,
}) => {
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [lecturerFilter, setLecturerFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');

  const filteredOfferings = useMemo(() => {
    return offerings.filter((o) => {
      // Semester filter
      if (semesterFilter !== 'all' && String(o.course?.semester) !== semesterFilter) {
        return false;
      }

      // Class filter
      if (classFilter !== 'all' && o.class_code !== classFilter) {
        return false;
      }

      // Lecturer filter
      if (lecturerFilter !== 'all') {
        const hasLec = o.course_offering_lecturers?.some((l) => l.lecturer_id === lecturerFilter);
        if (!hasLec) return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const cName = o.course?.name?.toLowerCase() || '';
        const cCode = o.course?.code?.toLowerCase() || '';
        const cls = o.class_code?.toLowerCase() || '';
        const lNames = o.course_offering_lecturers
          ?.map((l) => l.lecturer?.name?.toLowerCase() || '')
          .join(' ') || '';

        return cName.includes(q) || cCode.includes(q) || cls.includes(q) || lNames.includes(q);
      }

      return true;
    });
  }, [offerings, search, semesterFilter, lecturerFilter, classFilter]);

  // Unique class codes for filter
  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(offerings.map((o) => o.class_code).filter(Boolean))).sort();
  }, [offerings]);

  return (
    <div className="w-full lg:w-80 shrink-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col h-[calc(100vh-210px)] max-h-[850px] overflow-hidden select-none">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 tracking-tight">
              Kelas Belum Terjadwal
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            {filteredOfferings.length} Kelas
          </span>
        </div>

        {/* Search input */}
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari MK, kode, dosen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-3 gap-1.5 text-3xs">
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="px-1.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Smt</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={String(s)}>
                Smt {s}
              </option>
            ))}
          </select>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-1.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Kelas</option>
            {uniqueClasses.map((c) => (
              <option key={c} value={c}>
                Kelas {c}
              </option>
            ))}
          </select>

          <select
            value={lecturerFilter}
            onChange={(e) => setLecturerFilter(e.target.value)}
            className="px-1.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none truncate"
          >
            <option value="all">Semua Dosen</option>
            {lecturers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Offerings Scrollable List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-100">
        {filteredOfferings.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <p className="text-xs font-semibold text-slate-600">Tidak ada kelas</p>
            <p className="text-3xs text-slate-400 mt-1">
              {offerings.length === 0
                ? 'Semua kelas pada periode ini telah ditempatkan ke dalam jadwal.'
                : 'Tidak ada kelas yang cocok dengan filter pencarian.'}
            </p>
          </div>
        ) : (
          filteredOfferings.map((offering) => {
            const course = offering.course;
            const sks = course?.effective_sks || 2;
            const expectedStudents = offering.expected_students || 0;
            const hasLecturers = (offering.course_offering_lecturers?.length || 0) > 0;
            const lecturerNames = offering.course_offering_lecturers
              ?.map((l) => l.lecturer?.name)
              .filter(Boolean)
              .join(', ') || 'Belum ditentukan';

            const isReady = expectedStudents > 0 && hasLecturers;

            return (
              <div
                key={offering.id}
                onClick={() => onSelectOffering(offering)}
                className="pt-2 first:pt-0 group p-2.5 rounded-xl border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer shadow-2xs"
              >
                {/* Header: Code & Class */}
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <span className="font-mono text-3xs font-semibold text-slate-400 tracking-tight truncate">
                    {course?.code}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-blue-100 text-blue-700">
                      Kelas {offering.class_code}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-3xs font-semibold text-slate-600 bg-slate-100">
                      {sks} SKS
                    </span>
                  </div>
                </div>

                {/* Course Name */}
                <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors">
                  {course?.name}
                </h4>

                {/* Meta details */}
                <div className="mt-1.5 space-y-0.5 text-3xs text-slate-600">
                  <div className="flex items-center gap-1 text-slate-500">
                    <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                    <span className="truncate">{lecturerNames}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      <span>{expectedStudents > 0 ? `${expectedStudents} peserta` : '0 peserta'}</span>
                    </span>
                    {offering.required_room_type && (
                      <span className="text-blue-600 font-medium truncate max-w-[120px]">
                        {offering.required_room_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action button */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-3xs text-slate-400 font-medium">
                    Semester {course?.semester || 1}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectOffering(offering);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-3xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-lg transition-all border border-blue-200 cursor-pointer shadow-2xs"
                  >
                    <PlusCircle className="w-3 h-3" />
                    Atur Jadwal
                  </button>
                </div>

                {/* Readiness Badges */}
                {!isReady && (
                  <div className="mt-1.5 pt-1 border-t border-slate-100 flex flex-wrap gap-1">
                    {expectedStudents === 0 && (
                      <span className="inline-flex items-center gap-0.5 text-3xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                        Jumlah peserta belum diisi
                      </span>
                    )}
                    {!hasLecturers && (
                      <span className="inline-flex items-center gap-0.5 text-3xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                        Dosen belum ditentukan
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
