import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Search,
  Download,
  Printer,
  Sparkles,
  LayoutGrid,
  List,
  Clock,
  DoorOpen,
  AlertTriangle,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { schedulesService } from '../../services/schedules.service';
import { scheduleVersionsService } from '../../services/scheduleVersions.service';
import { scheduleEntriesService } from '../../services/scheduleEntries.service';
import { roomsService } from '../../services/rooms.service';
import { timeSlotsService } from '../../services/timeSlots.service';
import { lecturerAvailabilityService } from '../../services/lecturerAvailability.service';
import { courseOfferingsService } from '../../services/courseOfferings.service';
import { lecturersService } from '../../services/lecturers.service';
import { detectAllScheduleConflicts } from '../../lib/scheduleValidator';
import {
  CurrentPublishedSchedule,
  AcademicTerm,
  ScheduleVersion,
  ScheduleEntry,
  Room,
  TimeSlot,
  LecturerAvailability,
  CourseOffering,
  Lecturer,
} from '../../types';
import { sortScheduleEntries, cn } from '../../lib/utils';
import { generateLectureSchedulePDF } from '../../lib/pdf/pdfGenerator';
import { UnramLogo } from '../../components/shared/UnramLogo';
import { AppleWeeklyCalendar } from '../../components/schedule/AppleWeeklyCalendar';
import { AppleScheduleCardData } from '../../components/schedule/AppleScheduleCard';
import { SmartSuggestionModal } from '../../components/schedule/suggestions/SmartSuggestionModal';

export const OfficialScheduleTablePage: React.FC = () => {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const isUserAdmin = role === 'ADMIN';

  const [schedules, setSchedules] = useState<CurrentPublishedSchedule[]>([]);
  const [term, setTerm] = useState<AcademicTerm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin View Mode State (Table vs Matrix)
  const [adminViewMode, setAdminViewMode] = useState<'table' | 'matrix'>(() => {
    try {
      return (localStorage.getItem('admin-schedule-view') as 'table' | 'matrix') || 'table';
    } catch {
      return 'table';
    }
  });

  // Selected date for matrix calendar
  const [selectedMatrixDate, setSelectedMatrixDate] = useState<Date>(new Date());

  // Filters
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState('ALL');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');

  // Smart Reschedule & Revision Prompt State
  const [selectedRescheduleItem, setSelectedRescheduleItem] = useState<CurrentPublishedSchedule | null>(null);
  const [isRevisionPromptOpen, setIsRevisionPromptOpen] = useState(false);
  const [activeDraftVersion, setActiveDraftVersion] = useState<ScheduleVersion | null>(null);
  const [loadingRevisionCheck, setLoadingRevisionCheck] = useState(false);
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);

  // SmartSuggestionModal State
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [suggestionVersionId, setSuggestionVersionId] = useState<string>('');
  const [suggestionCurrentEntries, setSuggestionCurrentEntries] = useState<ScheduleEntry[]>([]);
  const [suggestionTargetEntry, setSuggestionTargetEntry] = useState<ScheduleEntry | null>(null);
  const [rescheduleMasterData, setRescheduleMasterData] = useState<{
    rooms: Room[];
    timeSlots: TimeSlot[];
    availabilities: LecturerAvailability[];
    offerings: CourseOffering[];
    lecturers: Lecturer[];
  }>({ rooms: [], timeSlots: [], availabilities: [], offerings: [], lecturers: [] });

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
      if (typeof s.semester === 'number' && s.semester > 0) {
        sems.add(s.semester);
      }
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

  // Map to AppleScheduleCardData for Matrix View
  const appleCardEntries = useMemo<AppleScheduleCardData[]>(() => {
    return filteredSchedules.map((item) => {
      return {
        id: item.id || item.scheduleEntryId || String(Math.random()),
        course_name: item.course_name,
        course_code: item.course_code,
        class_name: item.class_name || 'A',
        start_time: item.start_time,
        end_time: item.end_time,
        room_name: item.room_name || item.room_code || 'Ruang ?',
        lecturer_names: Array.isArray(item.lecturer_names) ? item.lecturer_names.join(', ') : item.lecturer_names || '',
        sks: item.effective_sks || item.sks || 3,
        raw: item,
      };
    });
  }, [filteredSchedules]);

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

  // Initiate Smart Rescheduling flow for Admin
  const handleInitiateSmartReschedule = async (item: CurrentPublishedSchedule) => {
    if (!term?.id) return;
    setSelectedRescheduleItem(item);
    setLoadingRevisionCheck(true);
    setIsRevisionPromptOpen(true);
    try {
      const existingDraft = await scheduleVersionsService.resolveActiveDraft({
        academicTermId: term.id,
        type: 'LECTURE',
        userId: user?.id,
      });
      setActiveDraftVersion(existingDraft);
    } catch (err) {
      console.warn('Draft resolution notice:', err);
      setActiveDraftVersion(null);
    } finally {
      setLoadingRevisionCheck(false);
    }
  };

  // Confirm Revision Prompt and open SmartSuggestionModal
  const handleConfirmRevisionFlow = async () => {
    if (!term?.id || !selectedRescheduleItem) return;
    setIsCreatingRevision(true);
    try {
      let targetDraft = activeDraftVersion;
      if (!targetDraft) {
        const draftTitle = `Revisi Jadwal Perkuliahan ${term.semester_type || ''} ${term.academic_year || ''}`;
        targetDraft = await scheduleVersionsService.createDraft(
          term.id,
          draftTitle,
          selectedRescheduleItem.schedule_version_id || null
        );
      }

      // Load entries & master data for SmartSuggestionModal
      const [entries, rms, slots, avails, offs, lects] = await Promise.all([
        scheduleEntriesService.getEntriesByVersionId(targetDraft.id),
        roomsService.getRooms(),
        timeSlotsService.getTimeSlots(),
        lecturerAvailabilityService.getAvailabilities(),
        courseOfferingsService.getOfferings(),
        lecturersService.getLecturers(),
      ]);

      const targetEntry =
        entries.find(
          (e) =>
            e.course_offering_id === selectedRescheduleItem.course_offering_id ||
            e.id === selectedRescheduleItem.id
        ) || entries[0] || null;

      setSuggestionVersionId(targetDraft.id);
      setSuggestionCurrentEntries(entries);
      setSuggestionTargetEntry(targetEntry);
      setRescheduleMasterData({
        rooms: rms,
        timeSlots: slots,
        availabilities: avails,
        offerings: offs,
        lecturers: lects,
      });

      setIsRevisionPromptOpen(false);
      setIsSuggestionModalOpen(true);
    } catch (err: any) {
      console.error('Failed to initiate revision draft:', err);
      toast.error(err?.message || 'Gagal menyiapkan draf revisi.');
    } finally {
      setIsCreatingRevision(false);
    }
  };

  // Handle Apply Entries from SmartSuggestionModal
  const handleApplySuggestionEntries = async (newEntries: ScheduleEntry[]) => {
    setIsSuggestionModalOpen(false);
    try {
      // Evaluate conflicts on new entries
      const liveConflicts = detectAllScheduleConflicts(
        newEntries,
        rescheduleMasterData.rooms,
        rescheduleMasterData.availabilities
      );

      const conflictCount = liveConflicts.length;
      if (conflictCount === 0) {
        toast.success('Jadwal berhasil dipindahkan tanpa konflik.');
      } else {
        toast.warning(`Perubahan tersimpan pada draf, tetapi ditemukan ${conflictCount} konflik.`);
      }

      // Navigate Admin to drafting workflow to continue editing revision draft
      navigate(`/penyusunan-jadwal?version=${suggestionVersionId}`);
    } catch (err: any) {
      console.error('Apply suggestion notice:', err);
      toast.error('Jadwal diperbarui pada draf revisi.');
      navigate(`/penyusunan-jadwal?version=${suggestionVersionId}`);
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
        <UnramLogo size={56} className="mx-auto mb-2" />
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
            <div className="flex flex-wrap items-center gap-2">
              {/* Admin View Mode Toggle: Tabel | Matriks */}
              {isUserAdmin && !isWithdrawn && (
                <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminViewMode('table');
                      try { localStorage.setItem('admin-schedule-view', 'table'); } catch (_) {}
                    }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                      adminViewMode === 'table' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Tabel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminViewMode('matrix');
                      try { localStorage.setItem('admin-schedule-view', 'matrix'); } catch (_) {}
                    }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                      adminViewMode === 'matrix' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Matriks</span>
                  </button>
                </div>
              )}

              {!isWithdrawn && (
                <>
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
                </>
              )}
            </div>
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
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 space-y-4 sm:space-y-5 shadow-xs">
          {/* Compact Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
            <div className="w-full sm:flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari mata kuliah, kode MK, dosen, atau ruangan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700 w-full sm:w-auto"
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
                className="px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700 w-full sm:w-auto"
              >
                <option value="ALL">Semua Semester</option>
                {uniqueSemesters.map((sem) => (
                  <option key={sem} value={String(sem)}>
                    Semester {sem}
                  </option>
                ))}
              </select>

              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700 w-full sm:w-auto"
              >
                <option value="ALL">Semua Kelas</option>
                {uniqueClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    Kelas {cls}
                  </option>
                ))}
              </select>

              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700 w-full sm:w-auto"
              >
                <option value="ALL">Semua Ruangan</option>
                {uniqueRooms.map((rm) => (
                  <option key={rm} value={rm}>
                    {rm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Render ADMIN Matrix View if selected */}
          {isUserAdmin && adminViewMode === 'matrix' ? (
            <div className="print:hidden">
              <AppleWeeklyCalendar
                title="Matriks Jadwal Perkuliahan"
                subtitle="Visualisasi distribusi jadwal perkuliahan mingguan."
                entries={appleCardEntries}
                selectedDate={selectedMatrixDate}
                onSelectDate={setSelectedMatrixDate}
                onSelectEntry={(cardData) => {
                  if (cardData.raw) {
                    handleInitiateSmartReschedule(cardData.raw);
                  }
                }}
                onResetThisWeek={() => setSelectedMatrixDate(new Date())}
              />
            </div>
          ) : (
            /* Table / Card List View */
            <>
              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-2xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">No</th>
                      <th className="py-3 px-4 w-24">Hari</th>
                      <th className="py-3 px-4 w-28">Waktu</th>
                      <th className="py-3 px-4 w-24">Kode MK</th>
                      <th className="py-3 px-4">Mata Kuliah</th>
                      <th className="py-3 px-3 text-center w-16">Kelas</th>
                      <th className="py-3 px-3 text-center w-16">SMT</th>
                      <th className="py-3 px-3 text-center w-16">SKS</th>
                      <th className="py-3 px-4 w-28">Ruangan</th>
                      <th className="py-3 px-4">Dosen Pengampu</th>
                      {isUserAdmin && <th className="py-3 px-3 text-center w-28">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSchedules.length === 0 ? (
                      <tr>
                        <td colSpan={isUserAdmin ? 11 : 10} className="py-12 text-center text-slate-400">
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
                          <td className="py-3 px-3 text-center font-bold text-slate-800">{item.semester ?? '-'}</td>
                          <td className="py-3 px-3 text-center font-semibold">{item.effective_sks || item.sks || 3}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {item.room_name || item.room_code || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {Array.isArray(item.lecturer_names) ? item.lecturer_names.join(', ') : (item.lecturer_names || '-')}
                          </td>
                          {isUserAdmin && (
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleInitiateSmartReschedule(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                title="Smart Reschedule — Rekomendasi penyesuaian jadwal"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                <span>Reschedule</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (< 640px) grouped by Day */}
              <div className="block sm:hidden space-y-4">
                {filteredSchedules.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    Tidak ada kelas yang memenuhi kriteria filter.
                  </div>
                ) : (
                  (() => {
                    const dayOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
                    const groups: { [day: string]: CurrentPublishedSchedule[] } = {};
                    filteredSchedules.forEach((item) => {
                      const day = item.day || 'Lainnya';
                      if (!groups[day]) groups[day] = [];
                      groups[day].push(item);
                    });

                    const sortedDays = Object.keys(groups).sort(
                      (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
                    );

                    return sortedDays.map((day) => (
                      <div key={day} className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/60">
                            {day}
                          </span>
                          <span className="text-2xs font-semibold text-slate-400">
                            {groups[day].length} Kelas
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {groups[day].map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs font-bold text-slate-900 leading-snug break-words">
                                    {item.course_name}
                                  </h4>
                                  <span className="text-2xs font-mono text-slate-500">
                                    {item.course_code}
                                  </span>
                                </div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 text-2xs shrink-0">
                                  Kelas {item.class_name || 'A'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs font-medium text-slate-600 border-y border-slate-100 py-1.5">
                                <span className="flex items-center gap-1 font-mono font-semibold text-slate-800">
                                  <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                                  {item.start_time} – {item.end_time}
                                </span>
                                <span className="flex items-center gap-1 font-semibold text-slate-800">
                                  <DoorOpen className="w-3 h-3 text-amber-600 shrink-0" />
                                  {item.room_name || item.room_code || '-'}
                                </span>
                                <span>SMT {item.semester ?? '-'} • {item.effective_sks || item.sks || 3} SKS</span>
                              </div>

                              <div className="flex items-center justify-between pt-0.5">
                                <div className="text-2xs text-slate-500 leading-snug break-words min-w-0 flex-1 pr-2">
                                  <span className="font-semibold text-slate-600">Dosen: </span>
                                  {Array.isArray(item.lecturer_names)
                                    ? item.lecturer_names.join(', ')
                                    : item.lecturer_names || '-'}
                                </div>

                                {isUserAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleInitiateSmartReschedule(item)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 rounded-lg transition-colors cursor-pointer shrink-0"
                                  >
                                    <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                                    <span>Reschedule</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()
                )}
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between text-2xs text-slate-400 font-medium px-1 gap-1 text-center sm:text-left">
            <span>Menampilkan {filteredSchedules.length} dari {schedules.length} total kelas terjadwal</span>
            <span>Jurusan Teknik Elektro — Universitas Mataram</span>
          </div>
        </div>
      )}

      {/* Revision Prompt Modal (Published Safety Guard) */}
      {isRevisionPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 shrink-0 text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Buat / Lanjutkan Draf Revisi?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Jadwal resmi terbit yang sedang tampil bersifat dibekukan dan tidak dapat diubah secara langsung.
                  Sistem akan membuat atau melanjutkan <strong>Draf Revisi</strong> agar Anda dapat menyesuaikan jadwal dengan aman.
                </p>
              </div>
            </div>

            {selectedRescheduleItem && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                <p className="font-bold text-slate-900">{selectedRescheduleItem.course_name}</p>
                <p className="text-slate-500 font-mono text-2xs">
                  {selectedRescheduleItem.course_code} • Kelas {selectedRescheduleItem.class_name || 'A'} • {selectedRescheduleItem.day}, {selectedRescheduleItem.start_time}–{selectedRescheduleItem.end_time}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isCreatingRevision}
                onClick={() => setIsRevisionPromptOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isCreatingRevision || loadingRevisionCheck}
                onClick={handleConfirmRevisionFlow}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isCreatingRevision ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyiapkan Draf...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{activeDraftVersion ? 'Lanjutkan Draf Revisi' : 'Buat Draf Revisi & Lanjutkan'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SmartSuggestionModal */}
      {isSuggestionModalOpen && (
        <SmartSuggestionModal
          isOpen={isSuggestionModalOpen}
          onClose={() => setIsSuggestionModalOpen(false)}
          versionId={suggestionVersionId}
          currentEntries={suggestionCurrentEntries}
          targetEntry={suggestionTargetEntry}
          rooms={rescheduleMasterData.rooms}
          timeSlots={rescheduleMasterData.timeSlots}
          availabilities={rescheduleMasterData.availabilities}
          offerings={rescheduleMasterData.offerings}
          lecturers={rescheduleMasterData.lecturers}
          onApplyEntries={handleApplySuggestionEntries}
        />
      )}
    </div>
  );
};
