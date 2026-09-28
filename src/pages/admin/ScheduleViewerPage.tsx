import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Printer,
  Search,
  Filter,
  PlusCircle,
  ExternalLink,
  UserCheck,
  MapPin,
  Clock,
  LayoutGrid,
  List,
  DoorOpen,
  Info,
  Sparkles,
  Download,
  Loader2,
  FileText,
  EyeOff,
} from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { schedulesService } from '../../services/schedules.service';
import { scheduleVersionsService } from '../../services/scheduleVersions.service';
import { CurrentPublishedSchedule, AcademicTerm } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { timeToMinute, minuteToTime, cn, sortScheduleEntries } from '../../lib/utils';
import { toast } from '../../components/ui/Toast';
import { PublishedScheduleDetailDrawer } from '../../components/schedule/PublishedScheduleDetailDrawer';
import { AppleWeeklyCalendar } from '../../components/schedule/AppleWeeklyCalendar';
import { AppleRightRail } from '../../components/schedule/AppleRightRail';
import { AppleScheduleCardData } from '../../components/schedule/AppleScheduleCard';
import { DocumentExportModal } from '../../components/documents/DocumentExportModal';
import { generateLectureSchedulePDF } from '../../lib/pdf/pdfGenerator';
import { ClearActiveScheduleModal } from '../../components/admin/settings/ClearActiveScheduleModal';

export const ScheduleViewerPage: React.FC = () => {
  const { role, user, isOwnerAdmin } = useAuth();
  const navigate = useNavigate();

  const [schedules, setSchedules] = useState<CurrentPublishedSchedule[]>([]);
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingRevision, setCreatingRevision] = useState(false);

  // Selected date for calendar navigation (default today)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Detail & Smart Rescheduling Drawer state
  const [selectedSchedule, setSelectedSchedule] = useState<CurrentPublishedSchedule | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Inspected Card for Right Rail Inspector
  const [inspectedCard, setInspectedCard] = useState<AppleScheduleCardData | null>(null);

  // View Mode: 'MATRIKS' | 'TABEL'
  const [viewMode, setViewMode] = useState<'MATRIKS' | 'TABEL'>('MATRIKS');

  // Filters
  const [dayFilter, setDayFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [onlyMySchedule, setOnlyMySchedule] = useState(false);

  // Export & Print modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const handleOpenDetail = useCallback((item: CurrentPublishedSchedule) => {
    setSelectedSchedule(item);
    setIsDetailDrawerOpen(true);
  }, []);

  const handleSelectEntry = useCallback((entry: AppleScheduleCardData) => {
    setInspectedCard(entry);
    if (entry.raw) {
      setSelectedSchedule(entry.raw);
    }
  }, []);

  const handleResetThisWeek = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const handleCloseInspector = useCallback(() => {
    setInspectedCard(null);
  }, []);

  const fetchScheduleData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, term] = await Promise.all([
        schedulesService.getPublishedSchedule(),
        schedulesService.getActiveTerm(),
      ]);
      setSchedules(list);
      setActiveTerm(term);
    } catch (err: any) {
      console.warn('Notice in fetchScheduleData:', err);
      // Graceful fallback to empty list
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, []);

  const daysList = useMemo(
    () => [
      { num: 1, name: 'Senin', englishName: 'Monday' },
      { num: 2, name: 'Selasa', englishName: 'Tuesday' },
      { num: 3, name: 'Rabu', englishName: 'Wednesday' },
      { num: 4, name: 'Kamis', englishName: 'Thursday' },
      { num: 5, name: 'Jumat', englishName: 'Friday' },
    ],
    []
  );

  // Admin action: Buat Revisi Baru
  const handleCreateNewRevision = async () => {
    if (!activeTerm?.id) return;
    setCreatingRevision(true);
    try {
      const termTitle = `Revisi Jadwal Perkuliahan ${activeTerm.semester_type || ''} ${activeTerm.academic_year || ''}`;
      const newDraft = await scheduleVersionsService.createDraft(activeTerm.id, termTitle);
      const key = `spk:active-schedule-version:LECTURE:${user?.id || 'anonymous'}:${activeTerm.id}`;
      localStorage.setItem(key, newDraft.id);
      toast.success('Draf revisi jadwal baru berhasil dibuat.');
      navigate('/penyusunan-jadwal');
    } catch (err: any) {
      console.error('Error creating revision:', err);
      toast.error(err?.message || 'Gagal membuat revisi baru.');
    } finally {
      setCreatingRevision(false);
    }
  };

  // Safe helper to extract day name
  const getDayName = (s: any): string => {
    if (!s) return 'Senin';
    if (typeof s.day === 'string' && s.day.trim()) return s.day.trim();
    const dayNum = s.day_of_week || (typeof s.day === 'number' ? s.day : 1);
    const found = daysList.find((d) => d.num === Number(dayNum));
    return found?.name || 'Senin';
  };

  // Source of truth for SKS: entry.course_offering.course.effective_sks -> entry.effective_sks -> entry.session_count -> duration/50 -> entry.sks
  const getDisplayedSks = (item: any): number => {
    if (item?.course_offering?.course?.effective_sks) {
      return Number(item.course_offering.course.effective_sks);
    }
    if (typeof item?.effective_sks === 'number' && item.effective_sks > 0) {
      return Number(item.effective_sks);
    }
    if (typeof item?.session_count === 'number' && item.session_count > 0) {
      return Number(item.session_count);
    }
    const startMin =
      typeof item?.start_minute === 'number'
        ? item.start_minute
        : item?.start_time
        ? timeToMinute(item.start_time)
        : null;
    const endMin =
      typeof item?.end_minute === 'number'
        ? item.end_minute
        : item?.end_time
        ? timeToMinute(item.end_time)
        : null;
    if (startMin !== null && endMin !== null && endMin > startMin) {
      const calc = Math.round((endMin - startMin) / 50);
      if (calc > 0) return calc;
    }
    if (typeof item?.sks === 'number' && item.sks > 0) {
      return Number(item.sks);
    }
    return 3;
  };

  // Filtered schedules
  const filtered = useMemo(() => {
    const list = schedules.filter((s) => {
      if (!s) return false;
      const sDay = getDayName(s);
      if (dayFilter !== 'all' && sDay.toLowerCase() !== (dayFilter || '').toLowerCase()) {
        return false;
      }
      if (classFilter !== 'all' && (s.class_name || (s as any).class_code) !== classFilter) {
        return false;
      }
      if (onlyMySchedule && user) {
        const lNames = Array.isArray(s.lecturer_names)
          ? s.lecturer_names.join(' ')
          : String(s.lecturer_names || '');
        const uName = (user as any).name || (user as any).user_metadata?.full_name || user.email || '';
        if (uName && !lNames.toLowerCase().includes(uName.toLowerCase())) {
          return false;
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCourse = s.course_name?.toLowerCase().includes(q);
        const matchCode = s.course_code?.toLowerCase().includes(q);
        const matchLecturer = Array.isArray(s.lecturer_names)
          ? s.lecturer_names.some((l: string) => l.toLowerCase().includes(q))
          : typeof s.lecturer_names === 'string' && s.lecturer_names.toLowerCase().includes(q);
        const matchRoom =
          s.room_name?.toLowerCase().includes(q) || s.room_code?.toLowerCase().includes(q);
        if (!matchCourse && !matchCode && !matchLecturer && !matchRoom) return false;
      }
      return true;
    });
    return sortScheduleEntries(list);
  }, [schedules, dayFilter, classFilter, onlyMySchedule, search, user]);

  // Filter description for export scope
  const filterDescription = useMemo(() => {
    const parts: string[] = [];
    if (dayFilter !== 'all') parts.push(`Hari ${dayFilter}`);
    if (classFilter !== 'all') parts.push(`Kelas ${classFilter}`);
    if (search.trim()) parts.push(`Cari "${search.trim()}"`);
    if (onlyMySchedule) parts.push('Jadwal Dosen Pengampu');
    return parts.join(' • ');
  }, [dayFilter, classFilter, search, onlyMySchedule]);

  const handleQuickDownloadPDF = async () => {
    if (schedules.length === 0) {
      toast.error('Jadwal belum diterbitkan.');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      // If filters are active, use filtered data, otherwise all schedules
      const hasActiveFilter = filterDescription.length > 0;
      const dataToExport = hasActiveFilter ? filtered : schedules;

      await generateLectureSchedulePDF(dataToExport, activeTerm, {
        scope: hasActiveFilter ? 'FILTERED' : 'ALL',
        filterDescription: hasActiveFilter ? filterDescription : undefined,
      });
      toast.success('File PDF resmi berhasil dibuat dan diunduh.');
    } catch (err: any) {
      console.error('Download PDF error:', err);
      toast.error('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Convert to AppleScheduleCardData
  const calendarEntries: AppleScheduleCardData[] = useMemo(() => {
    return filtered.map((item) => {
      return {
        id: item.id,
        course_name: item.course_name,
        course_code: item.course_code,
        class_name: item.class_name,
        start_time: item.start_time,
        end_time: item.end_time,
        room_code: item.room_code,
        room_name: item.room_name,
        lecturer_names: item.lecturer_names,
        sks: getDisplayedSks(item),
        isConflict: false,
        raw: item,
      };
    });
  }, [filtered]);

  // All entries for right rail
  const allRailEntries: AppleScheduleCardData[] = useMemo(() => {
    return schedules.map((item) => {
      return {
        id: item.id,
        course_name: item.course_name,
        course_code: item.course_code,
        class_name: item.class_name,
        start_time: item.start_time,
        end_time: item.end_time,
        room_code: item.room_code,
        room_name: item.room_name,
        lecturer_names: item.lecturer_names,
        sks: getDisplayedSks(item),
        isConflict: false,
        raw: item,
      };
    });
  }, [schedules]);

  return (
    <div className="relative min-h-screen space-y-6 pb-12">
      {/* Official Print Header (Only visible on browser print) */}
      <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-xl font-bold tracking-wider">UNIVERSITAS MATARAM</h1>
        <h2 className="text-base font-semibold">FAKULTAS TEKNIK • JURUSAN TEKNIK ELEKTRO</h2>
        <h3 className="text-sm font-bold uppercase mt-2">
          JADWAL PERKULIAHAN RESMI SEMESTER {activeTerm?.semester_type || 'GANJIL'} TAHUN AKADEMIK{' '}
          {activeTerm?.academic_year || '2026/2027'}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Dicetak pada: {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
        </p>
      </div>

      {loading ? (
        <LoadingState rows={8} message="Memuat jadwal perkuliahan resmi..." />
      ) : error ? (
        <ErrorState
          title="Gagal Memuat Jadwal"
          message={error}
          onRetry={fetchScheduleData}
        />
      ) : schedules.length === 0 ? (
        <EmptyState
          title="Belum Ada Jadwal Perkuliahan Aktif"
          description={
            role === 'ADMIN'
              ? 'Jadwal sebelumnya telah ditarik dari publikasi atau belum diterbitkan. Versi jadwal tetap tersimpan di Riwayat Jadwal.'
              : 'Belum ada jadwal perkuliahan yang diterbitkan.'
          }
          action={
            role === 'ADMIN'
              ? {
                  label: 'Buka Penyusunan Jadwal',
                  onClick: () => navigate('/penyusunan-jadwal'),
                }
              : undefined
          }
          secondaryAction={
            role === 'ADMIN'
              ? {
                  label: 'Lihat Riwayat Versi',
                  onClick: () => navigate('/riwayat-jadwal'),
                }
              : undefined
          }
        />
      ) : (
        /* Main 2-Column Desktop Layout (Weekly Calendar on Left, Right Rail on Right) */
        <div className="flex flex-col xl:flex-row gap-6 items-start">
          {/* Main Weekly Calendar */}
          <div className="flex-1 min-w-0 w-full space-y-4">
            <AppleWeeklyCalendar
              title="Jadwal Kuliah"
              subtitle="Kelola dan lihat jadwal perkuliahan resmi Jurusan Teknik Elektro Universitas Mataram"
              entries={calendarEntries}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onSelectEntry={handleSelectEntry}
              onResetThisWeek={handleResetThisWeek}
              actions={
                <div className="flex items-center gap-2">
                  {role === 'ADMIN' && (
                    <button
                      type="button"
                      disabled={creatingRevision}
                      onClick={handleCreateNewRevision}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>{creatingRevision ? 'Membuat...' : 'Buat Revisi'}</span>
                    </button>
                  )}

                  {/* Tarik Jadwal (Admin Only) */}
                  {role === 'ADMIN' && schedules.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowClearModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50/90 hover:bg-rose-100/90 border border-rose-200/90 rounded-xl transition-colors shadow-2xs cursor-pointer"
                      title="Tarik jadwal resmi perkuliahan yang sedang aktif dari publik"
                    >
                      <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                      <span>Tarik Jadwal</span>
                    </button>
                  )}

                  {/* Unduh PDF Resmi */}
                  <button
                    type="button"
                    disabled={isGeneratingPDF || schedules.length === 0}
                    onClick={handleQuickDownloadPDF}
                    title={schedules.length === 0 ? 'Jadwal belum diterbitkan.' : 'Unduh Dokumen PDF Resmi'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white/80 hover:bg-white border border-slate-200/80 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingPDF ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                        <span>Membuat PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>Unduh PDF</span>
                      </>
                    )}
                  </button>

                  {/* Cetak / Preview Dokumen */}
                  <button
                    type="button"
                    disabled={schedules.length === 0}
                    onClick={() => setIsExportModalOpen(true)}
                    title={schedules.length === 0 ? 'Jadwal belum diterbitkan.' : 'Cetak & Format Dokumen'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white/80 hover:bg-white border border-slate-200/80 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Cetak</span>
                  </button>
                </div>
              }
              filterControls={
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Search Bar */}
                  <div className="flex-1 max-w-sm relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cari mata kuliah, dosen, ruangan..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white/80 text-slate-800 placeholder-slate-400"
                    />
                  </div>

                  {/* Filter Selectors */}
                  <div className="flex flex-wrap items-center gap-2">
                    {role === 'DOSEN' && (
                      <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-2xs font-semibold text-blue-900 cursor-pointer shadow-2xs">
                        <input
                          type="checkbox"
                          checked={onlyMySchedule}
                          onChange={(e) => setOnlyMySchedule(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span>Jadwal Saya</span>
                      </label>
                    )}

                    <select
                      value={dayFilter}
                      onChange={(e) => setDayFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-2xs font-semibold border border-slate-200/80 rounded-xl bg-white/80 text-slate-700 focus:outline-none"
                    >
                      <option value="all">Semua Hari</option>
                      {daysList.map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={classFilter}
                      onChange={(e) => setClassFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-2xs font-semibold border border-slate-200/80 rounded-xl bg-white/80 text-slate-700 focus:outline-none"
                    >
                      <option value="all">Semua Kelas</option>
                      <option value="A">Kelas A</option>
                      <option value="B">Kelas B</option>
                      <option value="C">Kelas C</option>
                    </select>

                    {/* View mode toggle */}
                    <div className="flex items-center p-0.5 rounded-xl bg-slate-200/60 text-2xs">
                      <button
                        type="button"
                        onClick={() => setViewMode('MATRIKS')}
                        className={cn(
                          'px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer',
                          viewMode === 'MATRIKS'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        Matriks
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('TABEL')}
                        className={cn(
                          'px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer',
                          viewMode === 'TABEL'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        Tabel
                      </button>
                    </div>
                  </div>
                </div>
              }
            />

            {/* If user toggled to Tabel View */}
            {viewMode === 'TABEL' && (
              <div
                className="p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] space-y-4"
                style={{
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(14px) saturate(130%)',
                  WebkitBackdropFilter: 'blur(14px) saturate(130%)',
                  border: '1px solid rgba(255, 255, 255, 0.85)',
                  borderRadius: '24px',
                }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Tabel Daftar Perkuliahan Resmi ({filtered.length} Mata Kuliah)
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase text-3xs border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-3">Hari</th>
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">Mata Kuliah</th>
                        <th className="py-2.5 px-3">Kelas</th>
                        <th className="py-2.5 px-3">SKS</th>
                        <th className="py-2.5 px-3">Ruangan</th>
                        <th className="py-2.5 px-3">Dosen Pengampu</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {filtered.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                          onClick={() => handleOpenDetail(item)}
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {getDayName(item)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {item.start_time} – {item.end_time}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.course_name}
                            <span className="block font-mono text-3xs text-slate-400 font-normal">
                              {item.course_code}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200/60">
                              {item.class_name}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">
                            {getDisplayedSks(item)} SKS
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.room_code || item.room_name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">
                            {Array.isArray(item.lecturer_names)
                              ? item.lecturer_names.join(', ')
                              : item.lecturer_names}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDetail(item);
                              }}
                              className="px-2.5 py-1 text-2xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Rail: Jadwal Hari Ini + Mini Calendar / Inspector */}
          <div className="w-full xl:w-[320px] 2xl:w-[340px] shrink-0">
            <AppleRightRail
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              allEntries={allRailEntries}
              inspectedEntry={inspectedCard}
              onCloseInspector={handleCloseInspector}
              isAdmin={role === 'ADMIN'}
              onApplyReschedule={async (entry, newDay, newStartMin, newRoomId) => {
                if (entry.raw) {
                  setSelectedSchedule(entry.raw);
                  setIsDetailDrawerOpen(true);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Published Schedule Detail & Rescheduling Drawer */}
      <PublishedScheduleDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedSchedule(null);
        }}
        selectedSchedule={selectedSchedule}
        allSchedules={schedules}
        activeTerm={activeTerm}
        isAdmin={role === 'ADMIN'}
      />

      {/* Official Academic Document Export & Print Modal */}
      <DocumentExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        documentType="KULIAH"
        allSchedules={schedules}
        filteredSchedules={filtered}
        term={activeTerm}
        filterDescription={filterDescription}
      />

      {/* Tarik Jadwal Aktif Modal (Admin Only) */}
      <ClearActiveScheduleModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        academicTermId={activeTerm?.id}
        scheduleType="LECTURE"
        onCleared={fetchScheduleData}
      />
    </div>
  );
};
