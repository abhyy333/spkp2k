import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Download,
  Printer,
  Loader2,
  FileText,
  MapPin,
  Clock,
  DoorOpen,
  UserCheck,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { toast } from '../../components/ui/Toast';
import { schedulesService } from '../../services/schedules.service';
import { CurrentPublishedSchedule, AcademicTerm } from '../../types';
import { sortScheduleEntries, cn, formatDateIndo } from '../../lib/utils';
import { generateLectureSchedulePDF } from '../../lib/pdf/pdfGenerator';

export const OfficialScheduleTablePage: React.FC = () => {
  const [schedules, setSchedules] = useState<CurrentPublishedSchedule[]>([]);
  const [term, setTerm] = useState<AcademicTerm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState('ALL');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [list, activeTerm] = await Promise.all([
          schedulesService.getPublishedSchedule(),
          schedulesService.getActiveTerm(),
        ]);
        setSchedules(list);
        setTerm(activeTerm);
      } catch (err: any) {
        console.error('Error loading official schedule:', err);
        setError('Gagal memuat jadwal perkuliahan resmi.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Unique lists for filters
  const uniqueSemesters = useMemo(() => {
    const sems = new Set<number>();
    schedules.forEach((s) => {
      if (s.semester) sems.add(s.semester);
    });
    return Array.from(sems).sort((a, b) => a - b);
  }, [schedules]);

  const uniqueClasses = useMemo(() => {
    const cls = new Set<string>();
    schedules.forEach((s) => {
      if (s.class_name) cls.add(s.class_name);
    });
    return Array.from(cls).sort();
  }, [schedules]);

  const uniqueRooms = useMemo(() => {
    const rms = new Set<string>();
    schedules.forEach((s) => {
      if (s.room_name || s.room_code) rms.add(s.room_name || s.room_code || '');
    });
    return Array.from(rms).sort();
  }, [schedules]);

  // Filtered & Sorted schedules
  const filteredSchedules = useMemo(() => {
    const list = schedules.filter((s) => {
      if (!s) return false;
      if (dayFilter !== 'ALL' && String(s.day || '').trim().toLowerCase() !== dayFilter.toLowerCase()) {
        return false;
      }
      if (semesterFilter !== 'ALL' && String(s.semester) !== semesterFilter) {
        return false;
      }
      if (classFilter !== 'ALL' && s.class_name !== classFilter) {
        return false;
      }
      if (roomFilter !== 'ALL' && (s.room_name !== roomFilter && s.room_code !== roomFilter)) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCourse = s.course_name?.toLowerCase().includes(q) || s.course_code?.toLowerCase().includes(q);
        const matchLecturer = Array.isArray(s.lecturer_names)
          ? s.lecturer_names.some((l: string) => l.toLowerCase().includes(q))
          : String(s.lecturer_names || '').toLowerCase().includes(q);
        const matchRoom = s.room_name?.toLowerCase().includes(q) || s.room_code?.toLowerCase().includes(q);
        if (!matchCourse && !matchLecturer && !matchRoom) return false;
      }
      return true;
    });
    return sortScheduleEntries(list);
  }, [schedules, dayFilter, semesterFilter, classFilter, roomFilter, search]);

  const filterDescription = useMemo(() => {
    const parts: string[] = [];
    if (dayFilter !== 'ALL') parts.push(`Hari ${dayFilter}`);
    if (semesterFilter !== 'ALL') parts.push(`Semester ${semesterFilter}`);
    if (classFilter !== 'ALL') parts.push(`Kelas ${classFilter}`);
    if (roomFilter !== 'ALL') parts.push(`Ruangan ${roomFilter}`);
    if (search.trim()) parts.push(`Cari "${search.trim()}"`);
    return parts.join(' • ');
  }, [dayFilter, semesterFilter, classFilter, roomFilter, search]);

  const handleDownloadPDF = async () => {
    if (schedules.length === 0) {
      toast.error('Jadwal perkuliahan belum diterbitkan.');
      return;
    }
    try {
      const hasFilter = filterDescription.length > 0;
      const dataToExport = hasFilter ? filteredSchedules : schedules;
      await generateLectureSchedulePDF(dataToExport, term, {
        scope: hasFilter ? 'FILTERED' : 'ALL',
        filterDescription: hasFilter ? filterDescription : undefined,
      });
      toast.success('File PDF Jadwal Perkuliahan Resmi berhasil diunduh.');
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Gagal membuat PDF. Silakan coba lagi.');
    }
  };

  if (loading) {
    return <LoadingState rows={8} message="Memuat Jadwal Perkuliahan Resmi..." />;
  }

  const isWithdrawn = schedules.length === 0;

  return (
    <div className="space-y-6 pb-12 max-w-[1720px] mx-auto">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden, nav, header, footer, button, select, input {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 15px !important;
          }
          th, td {
            border: 1px solid #333 !important;
            padding: 6px 8px !important;
            font-size: 10pt !important;
            color: #000 !important;
            text-align: left !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }
        }
      `}</style>

      {/* Official Print Header */}
      <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-4">
        <h1 className="text-xl font-bold tracking-wider">UNIVERSITAS MATARAM</h1>
        <h2 className="text-base font-semibold">FAKULTAS TEKNIK • JURUSAN TEKNIK ELEKTRO</h2>
        <h3 className="text-sm font-bold uppercase mt-2">
          JADWAL PERKULIAHAN SEMESTER {(term?.semester_type || 'GANJIL').toUpperCase()} — TA {term?.academic_year || '2026/2027'}
        </h3>
        {filterDescription && (
          <p className="text-xs italic text-slate-600 mt-1">Filter: {filterDescription} ({filteredSchedules.length} Kelas)</p>
        )}
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Jadwal Perkuliahan Resmi"
          subtitle={`Jadwal perkuliahan tetap Jurusan Teknik Elektro Universitas Mataram — Semester ${(term?.semester_type || 'GANJIL').toUpperCase()} TA ${term?.academic_year || '2026/2027'}`}
          actions={
            !isWithdrawn ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Unduh PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Cetak</span>
                </button>
              </div>
            ) : undefined
          }
        />
      </div>

      {/* If Withdrawn */}
      {isWithdrawn && (
        <EmptyState
          icon={<Calendar className="w-10 h-10 text-slate-400" />}
          title="Jadwal Belum Diterbitkan"
          description="Belum ada jadwal perkuliahan resmi yang dipublikasikan oleh bagian akademik untuk semester ini."
        />
      )}

      {!isWithdrawn && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-5 shadow-xs">
          {/* Compact Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari mata kuliah, kode MK, dosen, atau ruangan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50"
              />
            </div>
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">Semua Hari</option>
              <option value="Senin">Senin</option>
              <option value="Selasa">Selasa</option>
              <option value="Rabu">Rabu</option>
              <option value="Kamis">Kamis</option>
              <option value="Jumat">Jumat</option>
              <option value="Sabtu">Sabtu</option>
            </select>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">Semua Semester</option>
              {uniqueSemesters.map((sem) => (
                <option key={sem} value={String(sem)}>Semester {sem}</option>
              ))}
            </select>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">Semua Kelas</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>Kelas {cls}</option>
              ))}
            </select>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">Semua Ruangan</option>
              {uniqueRooms.map((rm) => (
                <option key={rm} value={rm}>{rm}</option>
              ))}
            </select>
          </div>

          {/* Table Only View */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-2xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 w-24">Hari</th>
                  <th className="py-3 px-4 w-28">Waktu</th>
                  <th className="py-3 px-4 w-24">Kode MK</th>
                  <th className="py-3 px-4">Mata Kuliah</th>
                  <th className="py-3 px-3 text-center w-16">Kelas</th>
                  <th className="py-3 px-3 text-center w-16">Smt</th>
                  <th className="py-3 px-3 text-center w-16">SKS</th>
                  <th className="py-3 px-4 w-28">Ruangan</th>
                  <th className="py-3 px-4">Dosen Pengampu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      Tidak ada kelas yang memenuhi kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.day}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">
                        {item.start_time} – {item.end_time}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{item.course_code}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.course_name}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 text-2xs">
                          {item.class_name || 'A'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600">{item.semester || '-'}</td>
                      <td className="py-3 px-3 text-center font-semibold">{item.effective_sks || item.sks || 3}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {item.room_name || item.room_code || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {Array.isArray(item.lecturer_names) ? item.lecturer_names.join(', ') : (item.lecturer_names || '-')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-2xs text-slate-400 font-medium px-1">
            <span>Menampilkan {filteredSchedules.length} dari {schedules.length} total kelas terjadwal</span>
            <span>Jurusan Teknik Elektro — Universitas Mataram</span>
          </div>
        </div>
      )}
    </div>
  );
};
