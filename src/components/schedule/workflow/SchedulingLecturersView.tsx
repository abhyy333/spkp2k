import React, { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  Users,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  X,
  Check,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Step3OfferingLecturerRow, Step3LecturerItem } from '../../../types';
import { cn } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

interface SchedulingLecturersViewProps {
  rows: Step3OfferingLecturerRow[];
  totalActiveOfferings: number;
  totalWithPengampu: number;
  totalMultiCandidate: number;
  totalTeamTeaching?: number;
  totalMissingPengampu: number;
  totalInactiveLecturers: number;
  isAllValid: boolean;
  selectedSemesterType: 'GANJIL' | 'GENAP';
  syncing: boolean;
  onSyncFromMaster: () => Promise<void>;
  onSelectPrimaryLecturer: (offeringId: string, lecturerId: string) => Promise<void>;
  onBackToStep2: () => void;
  onContinueToStep4: () => void;
}

export const SchedulingLecturersView: React.FC<SchedulingLecturersViewProps> = ({
  rows,
  totalActiveOfferings,
  totalWithPengampu,
  totalMultiCandidate,
  totalMissingPengampu,
  totalInactiveLecturers,
  isAllValid,
  selectedSemesterType,
  syncing,
  onSyncFromMaster,
  onSelectPrimaryLecturer,
  onBackToStep2,
  onContinueToStep4,
}) => {
  // Filters state
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY' | 'MULTI_CANDIDATE' | 'MISSING' | 'INACTIVE'>('ALL');

  // Detail modal state for viewing full lecturer info
  const [activeLecturerModal, setActiveLecturerModal] = useState<Step3LecturerItem | null>(null);

  // Candidate selection modal state for picking the 1 primary lecturer
  const [candidateModalRow, setCandidateModalRow] = useState<Step3OfferingLecturerRow | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [savingCandidate, setSavingCandidate] = useState(false);

  // Available semester numbers based on term type
  const availableSemesters = useMemo(() => {
    return selectedSemesterType === 'GANJIL' ? [1, 3, 5, 7] : [2, 4, 6, 8];
  }, [selectedSemesterType]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Semester filter
      if (selectedSemesterFilter !== 'ALL' && row.semester !== selectedSemesterFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'READY') {
        if (row.status !== 'SIAP') return false;
      } else if (statusFilter === 'MULTI_CANDIDATE') {
        if (!row.hasMultipleCandidates) return false;
      } else if (statusFilter === 'MISSING') {
        if (row.hasPengampu && !row.hasMissingLecturer) return false;
      } else if (statusFilter === 'INACTIVE') {
        if (!row.hasInactiveLecturer && !row.primaryLecturer?.isLecturerInactive) return false;
      }

      // Search query: course name, course code, class code, primary lecturer, candidates
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCourseName = row.courseName.toLowerCase().includes(q);
        const matchCourseCode = row.courseCode.toLowerCase().includes(q);
        const matchClass = row.classCode.toLowerCase().includes(q);
        const matchPrimary =
          row.primaryLecturer &&
          (row.primaryLecturer.lecturerName.toLowerCase().includes(q) ||
            row.primaryLecturer.lecturerCode.toLowerCase().includes(q) ||
            (row.primaryLecturer.nip && row.primaryLecturer.nip.toLowerCase().includes(q)));
        const matchCandidates = row.candidates.some(
          (c) =>
            c.lecturerName.toLowerCase().includes(q) ||
            c.lecturerCode.toLowerCase().includes(q) ||
            (c.nip && c.nip.toLowerCase().includes(q))
        );

        if (!matchCourseName && !matchCourseCode && !matchClass && !matchPrimary && !matchCandidates) {
          return false;
        }
      }

      return true;
    });
  }, [rows, selectedSemesterFilter, statusFilter, searchQuery]);

  // Open candidate selection modal
  const handleOpenCandidateModal = (row: Step3OfferingLecturerRow) => {
    setCandidateModalRow(row);
    setSelectedCandidateId(row.primaryLecturerId);
  };

  // Close candidate modal
  const handleCloseCandidateModal = () => {
    if (savingCandidate) return;
    setCandidateModalRow(null);
    setSelectedCandidateId(null);
  };

  // Confirm candidate selection
  const handleConfirmCandidateSelection = async () => {
    if (!candidateModalRow || !selectedCandidateId) return;

    setSavingCandidate(true);
    try {
      await onSelectPrimaryLecturer(candidateModalRow.offeringId, selectedCandidateId);
      toast.success(
        `Dosen pengampu utama untuk ${candidateModalRow.courseName} (Kelas ${candidateModalRow.classCode}) berhasil diperbarui.`
      );
      handleCloseCandidateModal();
    } catch (err: any) {
      console.error('Error saving primary lecturer:', err);
      toast.error('Gagal menyimpan dosen pengampu utama ke database.');
    } finally {
      setSavingCandidate(false);
    }
  };

  // Format availability day helpers
  const formatDays = (days: any) => {
    if (!days) return null;
    if (Array.isArray(days)) {
      return days.join(', ');
    }
    if (typeof days === 'object') {
      return Object.keys(days).filter((k) => days[k]).join(', ');
    }
    return String(days);
  };

  return (
    <div className="space-y-6">
      {/* 1. View Header with Action */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100/80 text-blue-700">
                <UserCheck className="w-3.5 h-3.5" />
                Tahap 3 dari 6
              </span>
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Semester {selectedSemesterType}
              </span>
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                1 Dosen Pengampu Utama Per Kelas
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-2">
              Penugasan Dosen Pengampu
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tinjau dosen pengampu setiap kelas berdasarkan Master Dosen Pengampu semester aktif sebelum proses generate jadwal.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/penawaran-kelas"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
              title="Buka halaman Master Penawaran Kelas untuk mengedit dosen pengampu"
            >
              <span>Kelola di Master</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              type="button"
              disabled={syncing}
              onClick={async () => {
                await onSyncFromMaster();
                toast.success('Data dosen pengampu berhasil disinkronkan dari Master.');
              }}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer',
                syncing
                  ? 'bg-blue-100 text-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 active:scale-95'
              )}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
              <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan dari Master'}</span>
            </button>
          </div>
        </div>

        {/* Global Progress & Validation Indicator */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900">
              {totalWithPengampu} / {totalActiveOfferings}
            </span>
            <span>Kelas Siap</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-indigo-700">{totalMultiCandidate} Multi-Kandidat</span>
            <span className="text-slate-300">•</span>
            <span
              className={cn(
                'font-semibold',
                totalMissingPengampu > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'
              )}
            >
              {totalMissingPengampu} Belum Ada Pengampu
            </span>
            {totalInactiveLecturers > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-amber-600 font-bold">
                  {totalInactiveLecturers} Dosen Nonaktif
                </span>
              </>
            )}
          </div>

          <div className="text-2xs font-medium">
            {isAllValid ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Seluruh kelas memiliki tepat 1 dosen pengampu utama aktif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5" />
                {totalMissingPengampu} kelas belum memenuhi syarat penugasan dosen
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Four Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Kelas Aktif */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xs uppercase tracking-wider font-bold text-slate-400">
              Kelas Aktif
            </p>
            <h3 className="text-lg lg:text-xl font-bold text-slate-900 mt-0.5">
              {totalActiveOfferings} Kelas
            </h3>
            <p className="text-2xs text-slate-500 font-medium">Terpilih & terisi di Step 2</p>
          </div>
        </div>

        {/* Card 2: Dosen Terisi */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xs uppercase tracking-wider font-bold text-slate-400">
              Dosen Terisi
            </p>
            <h3 className="text-lg lg:text-xl font-bold text-emerald-700 mt-0.5">
              {totalWithPengampu} Kelas
            </h3>
            <p className="text-2xs text-slate-500 font-medium">
              {totalActiveOfferings > 0
                ? `${Math.round((totalWithPengampu / totalActiveOfferings) * 100)}% dari total kelas`
                : '0%'}
            </p>
          </div>
        </div>

        {/* Card 3: Multi-Kandidat Master */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xs uppercase tracking-wider font-bold text-slate-400">
              Multi-Kandidat
            </p>
            <h3 className="text-lg lg:text-xl font-bold text-indigo-700 mt-0.5">
              {totalMultiCandidate} Kelas
            </h3>
            <p className="text-2xs text-slate-500 font-medium">&gt; 1 Dosen pada Master</p>
          </div>
        </div>

        {/* Card 4: Belum Ada Pengampu */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
          <div
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
              totalMissingPengampu > 0
                ? 'bg-rose-50 text-rose-600'
                : 'bg-slate-100 text-slate-400'
            )}
          >
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <p className="text-3xs uppercase tracking-wider font-bold text-slate-400">
              Belum Ada Pengampu
            </p>
            <h3
              className={cn(
                'text-lg lg:text-xl font-bold mt-0.5',
                totalMissingPengampu > 0 ? 'text-rose-600' : 'text-slate-700'
              )}
            >
              {totalMissingPengampu} Kelas
            </h3>
            <p className="text-2xs text-slate-500 font-medium">
              {totalMissingPengampu > 0 ? 'Perlu dilengkapi di Master' : 'Seluruh kelas lengkap'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Global Notification Alert Banner (if incomplete) */}
      {!isAllValid && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Perhatian: Terdapat {totalMissingPengampu} kelas yang belum memiliki dosen pengampu utama aktif!
              </h4>
              <p className="text-2xs text-amber-700 mt-0.5">
                Alur generate jadwal dan Simulated Annealing membutuhkan tepat 1 dosen pengampu utama per kelas untuk validasi bentrok jadwal dosen.
                Lengkapi penugasan pada Master Penawaran Kelas, lalu klik <strong>Sinkronkan dari Master</strong>.
              </p>
            </div>
          </div>
          <Link
            to="/penawaran-kelas"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-2xs transition-colors"
          >
            <span>Buka Master Penawaran Kelas</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 4. Filter Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Semester Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
            Semester:
          </span>
          <button
            type="button"
            onClick={() => setSelectedSemesterFilter('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer',
              selectedSemesterFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            )}
          >
            Semua Semester
          </button>
          {availableSemesters.map((sem) => (
            <button
              key={sem}
              type="button"
              onClick={() => setSelectedSemesterFilter(sem)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer',
                selectedSemesterFilter === sem
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              )}
            >
              Semester {sem}
            </button>
          ))}
        </div>

        {/* Right Search & Status Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">Semua Status ({rows.length})</option>
            <option value="READY">Siap / Lengkap ({totalWithPengampu})</option>
            <option value="MULTI_CANDIDATE">Multi-Kandidat Master ({totalMultiCandidate})</option>
            <option value="MISSING">Belum Ada Pengampu ({totalMissingPengampu})</option>
            {totalInactiveLecturers > 0 && (
              <option value="INACTIVE">Dosen Tidak Aktif ({totalInactiveLecturers})</option>
            )}
          </select>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari MK, kelas, dosen pengampu..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Main Table: SATU ROW = SATU COURSE OFFERING */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              Tidak ada data kelas yang sesuai filter
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Coba ubah kata kunci pencarian atau ganti filter semester dan status untuk melihat daftar kelas lainnya.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-slate-50/60 text-slate-500 text-3xs uppercase tracking-wider border-b border-slate-200/70 select-none">
                  <th className="py-3 px-4 w-40">Kode & Kelas</th>
                  <th className="py-3 px-4 min-w-[200px]">Mata Kuliah</th>
                  <th className="py-3 px-3 w-28 text-center">Semester & SKS</th>
                  <th className="py-3 px-3 w-24 text-center">Peserta</th>
                  <th className="py-3 px-4 min-w-[260px]">Dosen Pengampu Utama</th>
                  <th className="py-3 px-4 w-48 text-center">Kandidat Tersedia</th>
                  <th className="py-3 px-4 w-36 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRows.map((row) => {
                  const isInter = row.classCode.toUpperCase().includes('INTER');
                  const primary = row.primaryLecturer;

                  return (
                    <tr
                      key={row.offeringId}
                      className={cn(
                        'transition-colors',
                        !row.isValid
                          ? 'bg-rose-50/20 hover:bg-rose-50/40'
                          : row.status === 'PILIH_DOSEN'
                          ? 'bg-amber-50/15 hover:bg-amber-50/30'
                          : 'hover:bg-slate-50/60'
                      )}
                    >
                      {/* 1. KODE & KELAS */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1">
                          <span className="font-mono text-3xs font-semibold text-slate-500 block">
                            {row.courseCode}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'font-bold px-2 py-0.5 rounded-md text-xs border shadow-2xs',
                                isInter
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              )}
                            >
                              Kelas {row.classCode}
                            </span>
                            {isInter && (
                              <span className="text-3xs font-semibold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                                Intl
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. MATA KULIAH */}
                      <td className="py-3 px-4 align-top">
                        <div>
                          <p className="font-bold text-slate-900 leading-snug">
                            {row.courseName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-3xs font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              Kurikulum {row.curriculumYear}
                            </span>
                            <span className="text-3xs text-slate-400">•</span>
                            <span className="text-3xs text-slate-500">
                              {row.requiredRoomType}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. SEMESTER & SKS */}
                      <td className="py-3 px-3 align-top text-center">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-800 block">
                            Semester {row.semester}
                          </span>
                          <span className="inline-block bg-slate-100 px-2 py-0.5 rounded text-3xs font-bold text-slate-600">
                            {row.effectiveSks} SKS
                          </span>
                        </div>
                      </td>

                      {/* 4. PESERTA */}
                      <td className="py-3 px-3 align-top text-center">
                        <div className="space-y-0.5">
                          <span className="font-bold text-blue-600 block">
                            {row.expectedStudents}
                          </span>
                          <span className="text-3xs text-slate-400">peserta</span>
                        </div>
                      </td>

                      {/* 5. DOSEN PENGAMPU UTAMA (EXACTLY ONE DOSEN) */}
                      <td className="py-3 px-4 align-top">
                        {primary ? (
                          <div className="p-2 rounded-xl bg-slate-50/90 border border-slate-200/80 hover:border-blue-300 transition-colors space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveLecturerModal(primary)}
                                className="font-bold text-xs text-slate-900 hover:text-blue-600 text-left cursor-pointer transition-colors underline decoration-slate-300 hover:decoration-blue-500 truncate"
                                title="Klik untuk melihat detail dosen"
                              >
                                {primary.lecturerName}
                              </button>
                              {primary.lecturerCode && (
                                <span className="font-mono text-3xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
                                  {primary.lecturerCode}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-3xs text-slate-500 flex-wrap">
                              {primary.nip && <span>NIP: {primary.nip}</span>}
                              {primary.isLecturerInactive && (
                                <span className="text-rose-600 font-bold bg-rose-100 px-1.5 py-0.2 rounded">
                                  Nonaktif
                                </span>
                              )}
                              {primary.isLecturerMissing && (
                                <span className="text-rose-600 font-bold bg-rose-100 px-1.5 py-0.2 rounded">
                                  Data Tidak Ditemukan
                                </span>
                              )}
                              {row.isManuallySelected && (
                                <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  Pilihan Admin
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-2xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              Belum Ada Dosen Pengampu
                            </span>
                            <p className="text-3xs text-slate-400">
                              Kelas ini belum memiliki relasi pengampu di database.
                            </p>
                          </div>
                        )}
                      </td>

                      {/* 6. KANDIDAT TERSEDIA */}
                      <td className="py-3 px-4 align-top text-center">
                        <div className="space-y-1.5 flex flex-col items-center">
                          {row.hasMultipleCandidates ? (
                            <>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Users className="w-3 h-3" />
                                {row.totalCandidates} Kandidat
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenCandidateModal(row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-3xs font-bold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 hover:border-blue-600 transition-colors shadow-2xs cursor-pointer"
                              >
                                <span>Pilih Dosen</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </>
                          ) : row.totalCandidates === 1 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-3xs font-medium text-slate-600 bg-slate-100 border border-slate-200/80">
                              1 Dosen Master
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-3xs font-medium text-rose-600 bg-rose-50 border border-rose-200">
                              0 Kandidat
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. STATUS */}
                      <td className="py-3 px-4 align-top text-center">
                        {row.status === 'DOSEN_TIDAK_DITEMUKAN' ? (
                          <span className="inline-flex items-center gap-1 text-2xs font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded-md border border-rose-300">
                            <AlertCircle className="w-3 h-3" />
                            Data Hilang
                          </span>
                        ) : row.status === 'DOSEN_TIDAK_AKTIF' ? (
                          <span className="inline-flex items-center gap-1 text-2xs font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded-md border border-amber-300">
                            <AlertTriangle className="w-3 h-3" />
                            Dosen Nonaktif
                          </span>
                        ) : row.status === 'BELUM_ADA_PENGAMPU' ? (
                          <span className="inline-flex items-center gap-1 text-2xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md border border-rose-300">
                            <AlertCircle className="w-3 h-3" />
                            Belum Terisi
                          </span>
                        ) : row.status === 'PILIH_DOSEN' ? (
                          <span
                            onClick={() => handleOpenCandidateModal(row)}
                            className="inline-flex items-center gap-1 text-2xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-md border border-amber-300 cursor-pointer transition-colors"
                            title="Klik untuk memilih dosen pengampu utama"
                          >
                            <Users className="w-3 h-3" />
                            Pilih Dosen
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Siap
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

        {/* Footer Summary Info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-2xs text-slate-500">
          <span>
            Menampilkan <strong>{filteredRows.length}</strong> dari <strong>{rows.length}</strong> kelas aktif
          </span>
          <span>
            Setiap kelas tepat 1 dosen pengampu utama • Disimpan ke planning_metadata
          </span>
        </div>
      </div>

      {/* 6. Candidate Selection Modal (PILIH SATU DOSEN DARI KANDIDAT) */}
      {candidateModalRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-3xs uppercase font-bold tracking-wider text-blue-600">
                  Pemilihan Dosen Pengampu Utama
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {candidateModalRow.courseName}
                </h3>
                <p className="text-xs text-slate-500">
                  Kelas {candidateModalRow.classCode} • {candidateModalRow.courseCode} • {candidateModalRow.expectedStudents} peserta
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseCandidateModal}
                disabled={savingCandidate}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-800">
              <p className="font-semibold">Aturan Penjadwalan Perkuliahan:</p>
              <p className="text-2xs text-blue-700 mt-0.5">
                Setiap kelas hanya boleh memiliki tepat <strong>1 Dosen Pengampu Utama</strong>. Pilih salah satu dosen dari kandidat pengampu master di bawah ini.
              </p>
            </div>

            {/* List of Candidates with Radio Selection */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {candidateModalRow.candidates.map((cand, idx) => {
                const isSelected = selectedCandidateId === cand.lecturerId;
                const isCurrentPrimary = candidateModalRow.primaryLecturerId === cand.lecturerId;

                return (
                  <label
                    key={cand.lecturerId}
                    onClick={() => setSelectedCandidateId(cand.lecturerId)}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none',
                      isSelected
                        ? 'bg-blue-50/60 border-blue-500 shadow-2xs ring-1 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    )}
                  >
                    <div className="pt-0.5">
                      <input
                        type="radio"
                        name="primary_lecturer"
                        value={cand.lecturerId}
                        checked={isSelected}
                        onChange={() => setSelectedCandidateId(cand.lecturerId)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">
                          {cand.lecturerName}
                        </span>
                        {cand.lecturerCode && (
                          <span className="font-mono text-3xs font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                            {cand.lecturerCode}
                          </span>
                        )}
                        {isCurrentPrimary && (
                          <span className="text-3xs font-bold px-2 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Dosen Utama Aktif
                          </span>
                        )}
                        {idx === 0 && (
                          <span className="text-3xs font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            Default Sumber Master
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-3xs text-slate-500 flex-wrap">
                        {cand.nip && <span>NIP: {cand.nip}</span>}
                        {cand.expertise && <span>Keahlian: {cand.expertise}</span>}
                        {cand.sourceRowId && (
                          <span className="font-mono text-slate-400">
                            Source: {cand.sourceRowId}
                          </span>
                        )}
                        {cand.isLecturerInactive ? (
                          <span className="text-rose-600 font-bold bg-rose-100 px-1 rounded">
                            Nonaktif
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                            Aktif
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-2xs text-slate-400">
                Pilihan disimpan ke planning_metadata
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseCandidateModal}
                  disabled={savingCandidate}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCandidateSelection}
                  disabled={!selectedCandidateId || savingCandidate}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer',
                    !selectedCandidateId || savingCandidate
                      ? 'bg-blue-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 active:scale-95'
                  )}
                >
                  {savingCandidate ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan Dosen Utama</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Lecturer Detail Modal / Popover */}
      {activeLecturerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-3xs uppercase font-bold tracking-wider text-slate-400">
                  Detail Dosen Pengampu
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {activeLecturerModal.lecturerName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveLecturerModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-400">Kode Dosen:</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                  {activeLecturerModal.lecturerCode || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-400">NIP:</span>
                <span className="font-medium text-slate-800">
                  {activeLecturerModal.nip || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-400">Bidang Keahlian:</span>
                <span className="font-medium text-slate-800 text-right">
                  {activeLecturerModal.expertise || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-400">Status Kepegawaian:</span>
                <span
                  className={cn(
                    'font-bold px-2 py-0.5 rounded text-2xs',
                    activeLecturerModal.status === 'Aktif'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  )}
                >
                  {activeLecturerModal.status || 'Aktif'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Hari Tersedia:</span>
                <span className="font-medium text-slate-800 text-right">
                  {formatDays(activeLecturerModal.availabilityDays) || 'Semua Hari Kerja'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setActiveLecturerModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left summary badges */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-slate-900">
              {totalActiveOfferings} Kelas Aktif
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-emerald-700">
              {totalWithPengampu} Kelas Siap
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-indigo-700">
              {totalMultiCandidate} Multi-Kandidat
            </span>
            {totalMissingPengampu > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {totalMissingPengampu} Belum Lengkap
                </span>
              </>
            )}
          </div>

          {/* Right action buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onBackToStep2}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Pembagian Rombel</span>
            </button>

            <button
              type="button"
              disabled={syncing}
              onClick={async () => {
                await onSyncFromMaster();
                toast.success('Data dosen pengampu berhasil disinkronkan dari Master.');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
              <span>{syncing ? 'Sinkronisasi...' : 'Sinkronkan'}</span>
            </button>

            <button
              type="button"
              disabled={!isAllValid || syncing}
              onClick={onContinueToStep4}
              className={cn(
                'inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm',
                isAllValid
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              )}
              title={
                !isAllValid
                  ? 'Lengkapi seluruh dosen pengampu di Master Penawaran Kelas untuk melanjutkan'
                  : 'Lanjut ke tahap penjadwalan awal'
              }
            >
              <span>Lanjut ke Generate Jadwal Awal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
