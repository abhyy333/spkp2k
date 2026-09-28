import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Search,
  Filter,
  CheckSquare,
  Square,
  Trash2,
  RefreshCw,
  Download,
  Printer,
  CalendarPlus,
  AlertTriangle,
  Info,
  CheckCircle2,
  LayoutGrid,
  List,
  ArrowRight,
  X,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { toast } from '../../components/ui/Toast';
import { schedulesService } from '../../services/schedules.service';
import { CurrentPublishedSchedule } from '../../types';
import { useAcademicTerm } from '../../contexts/AcademicTermContext';
import { useAuth } from '../../contexts/AuthContext';
import { sortScheduleEntries, timeToMinute, minuteToTime, cn, formatDateIndo } from '../../lib/utils';
import { generateLectureSchedulePDF } from '../../lib/pdf/pdfGenerator';
import { UnramLogo } from '../../components/shared/UnramLogo';

export const AturJadwalSayaPage: React.FC = () => {
  const { activeTerm } = useAcademicTerm();
  const { role, profile } = useAuth();
  const isLecturer = role === 'DOSEN';

  const [publishedSchedule, setPublishedSchedule] = useState<CurrentPublishedSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local storage key based on term ID
  const termId = activeTerm?.id || 'default-term';
  const storageKey = `spk-personal-schedule:${termId}`;
  const lecturerPinnedKey = `spk-dosen-pinned:${profile?.id || 'lecturer'}`;

  // Selection state
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<string[]>([]);
  const [pinnedOfferingIds, setPinnedOfferingIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'TABEL' | 'MATRIKS'>('TABEL');

  // Modals state
  const [showResetModal, setShowResetModal] = useState(false);
  const [showIcsModal, setShowIcsModal] = useState(false);
  const [icsStartDate, setIcsStartDate] = useState('2026-03-02');

  // Search & Filter for course selection view
  const [searchQuery, setSearchQuery] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');

  // Load published schedule & local storage
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const sched = await schedulesService.getPublishedSchedule();
        setPublishedSchedule(sched);

        if (isLecturer && profile?.id) {
          const lecturerCourses = sched.filter((item: any) => {
            const lNames = Array.isArray(item.lecturer_names)
              ? item.lecturer_names.join(' ')
              : String(item.lecturer_names || '');
            const pName = profile.name || '';
            return pName && lNames.toLowerCase().includes(pName.toLowerCase());
          });
          const autoIds = lecturerCourses.map((c) => c.course_offering_id || c.id);
          
          let pinned: string[] = [];
          try {
            const rawPinned = localStorage.getItem(lecturerPinnedKey);
            if (rawPinned) pinned = JSON.parse(rawPinned);
          } catch {}

          setSelectedOfferingIds(Array.from(new Set([...autoIds, ...pinned])));
          setPinnedOfferingIds(pinned);
          setIsEditing(false);
        } else {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              const ids = Array.isArray(parsed) ? parsed : parsed.selectedOfferingIds || [];
              setSelectedOfferingIds(ids);
              setIsEditing(ids.length === 0);
            } catch {
              setIsEditing(true);
            }
          } else {
            setIsEditing(true);
          }
        }
      } catch (err: any) {
        console.error('Error loading schedule for personal view:', err);
        setError('Gagal memuat jadwal resmi.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeTerm, profile, isLecturer]);

  const handleSavePersonalSchedule = () => {
    if (selectedOfferingIds.length === 0) {
      toast.error('Pilih minimal satu mata kuliah terlebih dahulu.');
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(selectedOfferingIds));
      setIsEditing(false);
      toast.success('Jadwal Saya berhasil dibuat dan disimpan di perangkat ini.');
    } catch (err) {
      console.error('Save to localStorage error:', err);
      toast.error('Gagal menyimpan ke penyimpanan lokal browser.');
    }
  };

  const confirmResetSchedule = () => {
    try {
      localStorage.removeItem(storageKey);
      setSelectedOfferingIds([]);
      setIsEditing(true);
      setShowResetModal(false);
      toast.success('Jadwal Saya berhasil direset.');
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Gagal mereset jadwal.');
    }
  };

  const availableOfferings = useMemo(() => {
    const map = new Map<string, CurrentPublishedSchedule>();
    publishedSchedule.forEach((item) => {
      const key = item.course_offering_id || item.id;
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }, [publishedSchedule]);

  const filteredOfferingsForSelection = useMemo(() => {
    return availableOfferings.filter((item) => {
      if (semesterFilter !== 'ALL' && String(item.semester) !== semesterFilter) return false;
      if (classFilter !== 'ALL' && item.class_name !== classFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCourse = item.course_name?.toLowerCase().includes(q) || item.course_code?.toLowerCase().includes(q);
        const matchLecturer = String(item.lecturer_names || '').toLowerCase().includes(q);
        if (!matchCourse && !matchLecturer) return false;
      }
      return true;
    });
  }, [availableOfferings, semesterFilter, classFilter, searchQuery]);

  const selectedEntries = useMemo(() => {
    return publishedSchedule.filter((item) => {
      const key = item.course_offering_id || item.id;
      return selectedOfferingIds.includes(key);
    });
  }, [publishedSchedule, selectedOfferingIds]);

  const sortedSelectedEntries = useMemo(() => {
    return sortScheduleEntries(selectedEntries);
  }, [selectedEntries]);

  const missingOfferingIds = useMemo(() => {
    const publishedIds = new Set(publishedSchedule.map((i) => i.course_offering_id || i.id));
    return selectedOfferingIds.filter((id) => !publishedIds.has(id));
  }, [publishedSchedule, selectedOfferingIds]);

  const personalConflicts = useMemo(() => {
    const conflicts: { itemA: CurrentPublishedSchedule; itemB: CurrentPublishedSchedule; reason: string }[] = [];
    for (let i = 0; i < sortedSelectedEntries.length; i++) {
      for (let j = i + 1; j < sortedSelectedEntries.length; j++) {
        const a = sortedSelectedEntries[i];
        const b = sortedSelectedEntries[j];
        const dayA = a.day_of_week || 1;
        const dayB = b.day_of_week || 1;
        if (dayA === dayB) {
          const startA = a.start_minute ?? timeToMinute(a.start_time || '07:50');
          const endA = a.end_minute ?? timeToMinute(a.end_time || '09:30');
          const startB = b.start_minute ?? timeToMinute(b.start_time || '07:50');
          const endB = b.end_minute ?? timeToMinute(b.end_time || '09:30');

          if (startA < endB && startB < endA) {
            conflicts.push({
              itemA: a,
              itemB: b,
              reason: `${a.course_name} (${a.class_name}) bentrok dengan ${b.course_name} (${b.class_name}) pada hari ${a.day} pukul ${a.start_time}–${a.end_time}`,
            });
          }
        }
      }
    }
    return conflicts;
  }, [sortedSelectedEntries]);

  // Handle Print Action
  const handlePrintPersonalSchedule = () => {
    if (sortedSelectedEntries.length === 0) {
      toast.error('Tidak ada jadwal untuk dicetak.');
      return;
    }
    window.print();
  };

  // Handle ICS Export Action
  const handleExecuteExportICS = () => {
    try {
      if (sortedSelectedEntries.length === 0) return;
      
      let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Teknik Elektro Universitas Mataram//Jadwal Saya//ID\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nX-WR-CALNAME:Jadwal Saya - Teknik Elektro Unram\nX-WR-TIMEZONE:Asia/Makassar\n";
      
      const escapeIcs = (str: string) => {
        if (!str) return '';
        return str.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');
      };

      const baseDate = new Date(icsStartDate || '2026-03-02');

      sortedSelectedEntries.forEach((item, idx) => {
        const dayNum = item.day_of_week || 1; // 1=Senin ... 5=Jumat
        // Find date matching day_of_week on or after baseDate
        const eventDate = new Date(baseDate);
        const currentDay = eventDate.getDay() === 0 ? 7 : eventDate.getDay(); // 1=Mon ... 7=Sun
        const targetDay = dayNum > 7 ? 1 : dayNum;
        let diff = targetDay - currentDay;
        if (diff < 0) diff += 7;
        eventDate.setDate(eventDate.getDate() + diff);

        const dateStr = eventDate.toISOString().split('T')[0].replace(/-/g, '');
        const startTime = (item.start_time || '07:50').replace(':', '') + '00';
        const endTime = (item.end_time || '09:30').replace(':', '') + '00';

        const lecturerStr = Array.isArray(item.lecturer_names) ? item.lecturer_names.join(', ') : (item.lecturer_names || '-');
        const description = `Kelas: ${item.class_name || 'A'} | Dosen: ${lecturerStr}`;
        const location = item.room_name || item.room_code || 'Ruang Kuliah';

        ics += "BEGIN:VEVENT\n";
        ics += `UID:personal-sched-${item.id || idx}-${dateStr}@elektro.unram.ac.id\n`;
        ics += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
        ics += `SUMMARY:${escapeIcs(item.course_name)} (${escapeIcs(item.class_name || 'A')})\n`;
        ics += `DESCRIPTION:${escapeIcs(description)}\n`;
        ics += `LOCATION:${escapeIcs(location)}\n`;
        ics += `DTSTART;TZID=Asia/Makassar:${dateStr}T${startTime}\n`;
        ics += `DTEND;TZID=Asia/Makassar:${dateStr}T${endTime}\n`;
        ics += `RRULE:FREQ=WEEKLY;COUNT=16\n`;
        ics += "END:VEVENT\n";
      });

      ics += "END:VCALENDAR\n";

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'jadwal-saya-elektro-unram.ics');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setShowIcsModal(false);
      toast.success('File kalender .ics berhasil diunduh.');
    } catch (err) {
      console.error('ICS Export error:', err);
      toast.error('Gagal membuat file kalender. Coba lagi.');
    }
  };

  const handleDownloadPDF = async () => {
    if (sortedSelectedEntries.length === 0) return;
    try {
      await generateLectureSchedulePDF(sortedSelectedEntries, activeTerm, {
        scope: 'FILTERED',
        filterDescription: 'Jadwal Pilihan Saya',
      });
      toast.success('PDF Jadwal Saya berhasil diunduh.');
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Gagal membuat PDF.');
    }
  };

  if (loading) {
    return <LoadingState rows={8} message="Memuat Jadwal Saya..." />;
  }

  const isWithdrawn = publishedSchedule.length === 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden, nav, header, footer, button, select, input, .page-header-actions {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print-container {
            padding: 20px !important;
            margin: 0 !important;
            max-width: none !important;
            background: white !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 15px !important;
          }
          th, td {
            border: 1px solid #333 !important;
            padding: 8px 10px !important;
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
      <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-xl font-bold tracking-wider">UNIVERSITAS MATARAM</h1>
        <h2 className="text-base font-semibold">FAKULTAS TEKNIK • JURUSAN TEKNIK ELEKTRO</h2>
        <h3 className="text-sm font-bold uppercase mt-2">
          JADWAL PERKULIAHAN PRIBADI (JADWAL SAYA) — SEMESTER {(activeTerm?.semester_type || 'GANJIL').toUpperCase()}
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          Tahun Akademik {activeTerm?.academic_year || '2026/2027'} • Dicetak: {new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
        </p>
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Atur Jadwal Saya"
          subtitle={
            isLecturer
              ? `Jadwal mengajar resmi untuk ${profile?.name || 'Dosen Elektro'}`
              : 'Kelola dan susun pilihan mata kuliah perkuliahan pribadi Anda pada perangkat ini'
          }
          actions={
            !isEditing && !isWithdrawn && sortedSelectedEntries.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Ubah Mata Kuliah</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Unduh PDF</span>
                </button>
                <button
                  type="button"
                  disabled={sortedSelectedEntries.length === 0}
                  onClick={handlePrintPersonalSchedule}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cetak</span>
                </button>
                <button
                  type="button"
                  disabled={sortedSelectedEntries.length === 0}
                  onClick={() => setShowIcsModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>Export .ics</span>
                </button>
                <button
                  type="button"
                  disabled={sortedSelectedEntries.length === 0}
                  onClick={() => setShowResetModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Notice if Schedule is Withdrawn */}
      {isWithdrawn && (
        <div className="print:hidden p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Jadwal resmi sedang tidak tersedia.</h4>
            <p className="text-amber-800 mt-1 leading-relaxed">
              Pilihan mata kuliah Anda tetap tersimpan di perangkat ini dan akan ditampilkan kembali setelah jadwal diterbitkan oleh bagian akademik.
            </p>
          </div>
        </div>
      )}

      {/* Missing offerings warning */}
      {!isWithdrawn && missingOfferingIds.length > 0 && (
        <div className="print:hidden p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{missingOfferingIds.length} mata kuliah pilihan tidak tersedia pada jadwal resmi terbaru.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-3 py-1 text-2xs font-bold text-amber-800 bg-amber-200/80 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
          >
            Tinjau Pilihan
          </button>
        </div>
      )}

      {/* Personal Conflict Warning */}
      {!isWithdrawn && personalConflicts.length > 0 && !isEditing && (
        <div className="print:hidden p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-rose-900 text-xs">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Jadwal Pilihan Anda Bentrok ({personalConflicts.length} Bentrok Lokal)</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-2xs text-rose-800 pl-1">
            {personalConflicts.map((c, idx) => (
              <li key={idx}>{c.reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Selection Mode UI */}
      {(isEditing || isWithdrawn) && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pilih Mata Kuliah untuk Jadwal Saya</h3>
              <p className="text-2xs text-slate-500 mt-0.5">
                Pilih mata kuliah dan kelas yang Anda ambil. Data disimpan di browser perangkat ini.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {selectedOfferingIds.length} Dipilih
              </span>
              <button
                type="button"
                disabled={selectedOfferingIds.length === 0}
                onClick={handleSavePersonalSchedule}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <span>Buat Jadwal Saya</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari mata kuliah atau dosen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50"
              />
            </div>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">Semua Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={String(s)}>Semester {s}</option>
              ))}
            </select>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="ALL">Semua Kelas</option>
              <option value="A">Kelas A</option>
              <option value="B">Kelas B</option>
              <option value="C">Kelas C</option>
            </select>
          </div>

          {/* Offerings List Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-2xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">Pilih</th>
                  <th className="py-3 px-3">Kode & MK</th>
                  <th className="py-3 px-3 text-center">Kelas</th>
                  <th className="py-3 px-3 text-center">Smt</th>
                  <th className="py-3 px-3 text-center">SKS</th>
                  <th className="py-3 px-3">Waktu & Ruangan</th>
                  <th className="py-3 px-3">Dosen Pengampu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOfferingsForSelection.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Tidak ada mata kuliah yang sesuai dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredOfferingsForSelection.map((item) => {
                    const key = item.course_offering_id || item.id;
                    const isSelected = selectedOfferingIds.includes(key);
                    return (
                      <tr
                        key={key}
                        onClick={() => {
                          setSelectedOfferingIds((prev) =>
                            isSelected ? prev.filter((id) => id !== key) : [...prev, key]
                          );
                        }}
                        className={cn(
                          'hover:bg-blue-50/40 transition-colors cursor-pointer',
                          isSelected && 'bg-blue-50/60'
                        )}
                      >
                        <td className="py-3 px-3 text-center">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600 mx-auto" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{item.course_name}</p>
                          <span className="font-mono text-2xs text-slate-400">{item.course_code}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-blue-700">
                          {item.class_name || 'A'}
                        </td>
                        <td className="py-3 px-3 text-center">{item.semester}</td>
                        <td className="py-3 px-3 text-center font-semibold">{item.effective_sks || item.sks || 3}</td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800">{item.day}</span>, {item.start_time}–{item.end_time}
                          <span className="block text-2xs text-slate-500">{item.room_name || item.room_code}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {Array.isArray(item.lecturer_names) ? item.lecturer_names.join(', ') : item.lecturer_names}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <span className="text-2xs text-slate-500 font-medium">
              {selectedOfferingIds.length === 0
                ? 'Pilih minimal satu mata kuliah terlebih dahulu.'
                : `${selectedOfferingIds.length} mata kuliah dipilih.`}
            </span>
            <button
              type="button"
              disabled={selectedOfferingIds.length === 0}
              onClick={handleSavePersonalSchedule}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <span>Buat Jadwal Saya</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active Personal Schedule View (Table & Matrix) */}
      {!isEditing && !isWithdrawn && sortedSelectedEntries.length > 0 && (
        <div className="space-y-4">
          {/* View Mode Toggle: Matriks | Tabel */}
          <div className="print:hidden flex items-center justify-between">
            <div className="flex items-center p-0.5 rounded-xl bg-slate-200/60 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('TABEL')}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer',
                  viewMode === 'TABEL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Tabel Pilihan
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MATRIKS')}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer',
                  viewMode === 'MATRIKS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Matriks Kalender
              </button>
            </div>
            <span className="text-2xs text-slate-400 font-medium">
              Menampilkan {sortedSelectedEntries.length} mata kuliah pilihan
            </span>
          </div>

          {viewMode === 'TABEL' || window.matchMedia?.('print').matches ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-2xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Hari</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Mata Kuliah</th>
                    <th className="py-3 px-3 text-center">Kelas</th>
                    <th className="py-3 px-3 text-center">SKS</th>
                    <th className="py-3 px-4">Ruangan</th>
                    <th className="py-3 px-4">Dosen Pengampu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedSelectedEntries.map((item, idx) => {
                    const isConflicting = personalConflicts.some(
                      (c) => c.itemA.id === item.id || c.itemB.id === item.id
                    );
                    return (
                      <tr
                        key={item.id || idx}
                        className={cn('hover:bg-slate-50 transition-colors', isConflicting && 'bg-rose-50/60')}
                      >
                        <td className="py-3 px-4 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{item.day}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-600">
                          {item.start_time} – {item.end_time}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{item.course_name}</p>
                          <span className="font-mono text-2xs text-slate-400">{item.course_code}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 text-2xs">
                            {item.class_name || 'A'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold">{item.effective_sks || item.sks || 3}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {item.room_name || item.room_code || 'Ruang Kuliah'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {Array.isArray(item.lecturer_names) ? item.lecturer_names.join(', ') : item.lecturer_names}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Personal Matrix View */
            <div className="print:hidden bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Matriks Jadwal Pilihan (Senin – Jumat)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].map((dayName) => {
                  const dayEntries = sortedSelectedEntries.filter(
                    (e) => String(e.day).toLowerCase() === dayName.toLowerCase()
                  );
                  return (
                    <div key={dayName} className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-2">
                      <div className="font-bold text-xs text-blue-900 pb-2 border-b border-slate-200 flex items-center justify-between">
                        <span>{dayName}</span>
                        <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-3xs font-bold">
                          {dayEntries.length} MK
                        </span>
                      </div>
                      <div className="space-y-2">
                        {dayEntries.length === 0 ? (
                          <p className="text-3xs text-slate-400 py-6 text-center italic">Tidak ada jadwal</p>
                        ) : (
                          dayEntries.map((entry, eIdx) => (
                            <div
                              key={eIdx}
                              className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-1 text-2xs"
                            >
                              <div className="font-mono font-bold text-blue-600">
                                {entry.start_time} – {entry.end_time}
                              </div>
                              <div className="font-bold text-slate-900 leading-snug">{entry.course_name}</div>
                              <div className="flex items-center justify-between text-3xs text-slate-500 pt-1 border-t border-slate-100">
                                <span className="font-bold text-slate-700">Kelas {entry.class_name || 'A'}</span>
                                <span className="font-medium text-slate-600">{entry.room_code || entry.room_name}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!isEditing && !isWithdrawn && sortedSelectedEntries.length === 0 && (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-slate-400" />}
          title="Belum Ada Mata Kuliah Dipilih"
          description="Anda belum memilih mata kuliah untuk Jadwal Saya."
          action={{
            label: 'Pilih Mata Kuliah',
            onClick: () => setIsEditing(true),
          }}
        />
      )}

      {/* Privacy Notice */}
      <div className="print:hidden text-center text-3xs text-slate-400 font-medium pt-4">
        🔒 Pilihan Jadwal Saya disimpan hanya pada browser/perangkat ini.
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Reset Jadwal Saya?</h4>
                <p className="text-2xs text-slate-500">
                  Seluruh mata kuliah yang Anda pilih pada perangkat ini akan dihapus. Jadwal resmi tidak akan terpengaruh.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmResetSchedule}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Reset Jadwal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ICS Start Date Modal */}
      {showIcsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Export Kalender (.ics)</h4>
              <button
                type="button"
                onClick={() => setShowIcsModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-2xs text-slate-500">
              Pilih tanggal mulai perkuliahan (Senin) untuk penentuan tanggal event mingguan kalender Anda.
            </p>
            <div className="space-y-1">
              <label className="text-3xs font-bold text-slate-700 uppercase">Tanggal Mulai Semester</label>
              <input
                type="date"
                value={icsStartDate}
                onChange={(e) => setIcsStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowIcsModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteExportICS}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Unduh File .ics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
