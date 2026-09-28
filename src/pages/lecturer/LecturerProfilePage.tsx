import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Mail,
  Phone,
  BookOpen,
  Award,
  Clock,
  MapPin,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building,
  GraduationCap,
  Sparkles,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Layers,
  Users,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { lecturersService } from '../../services/lecturers.service';
import { schedulesService } from '../../services/schedules.service';
import { examsService } from '../../services/exams.service';
import {
  Lecturer,
  CurrentPublishedSchedule,
  CurrentPublishedExam,
  AcademicTerm,
} from '../../types';
import { dayOfWeekToName, getInitials, formatDateIndo, cn } from '../../lib/utils';
import { EditProfileModal } from '../../components/lecturer/EditProfileModal';
import { generateLectureSchedulePDF } from '../../lib/pdf/pdfGenerator';
import { DocumentExportModal } from '../../components/documents/DocumentExportModal';
import { toast } from '../../components/ui/Toast';

// Order of days for academic timetable
const DAY_ORDER: Record<string, number> = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
  minggu: 7,
};

// Soft tag color palettes matching the reference image
const TAG_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200/60',
  'bg-purple-50 text-purple-700 border-purple-200/60',
  'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  'bg-amber-50 text-amber-700 border-amber-200/60',
  'bg-rose-50 text-rose-700 border-rose-200/60',
  'bg-cyan-50 text-cyan-700 border-cyan-200/60',
  'bg-indigo-50 text-indigo-700 border-indigo-200/60',
];

const BULLET_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
];

const CLASS_BADGE_COLORS: Record<string, string> = {
  A: 'bg-blue-100 text-blue-800',
  B: 'bg-purple-100 text-purple-800',
  C: 'bg-emerald-100 text-emerald-800',
  D: 'bg-amber-100 text-amber-800',
  REG: 'bg-blue-100 text-blue-800',
  INT: 'bg-indigo-100 text-indigo-800',
  INTER: 'bg-indigo-100 text-indigo-800',
};

export const LecturerProfilePage: React.FC = () => {
  const { user, profile, isOwnerAdmin, previewRole } = useAuth();

  // State
  const [lecturer, setLecturer] = useState<Lecturer | null>(null);
  const [allLecturers, setAllLecturers] = useState<Lecturer[]>([]);
  const [teachingSchedule, setTeachingSchedule] = useState<CurrentPublishedSchedule[]>([]);
  const [publishedExams, setPublishedExams] = useState<CurrentPublishedExam[]>([]);
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState<boolean>(false);

  // Mini Calendar Navigation
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  const isDosenPreview = isOwnerAdmin && previewRole === 'DOSEN';

  // 1. Single Batch Data Loader (Prevents duplicate fetches and N+1 queries)
  const loadProfileData = async (targetLecturerId?: string) => {
    setLoading(true);
    try {
      let currentLect: Lecturer | null = null;

      if (targetLecturerId) {
        const detail = await lecturersService.getLecturerById(targetLecturerId);
        currentLect = detail.lecturer;
      } else if (user) {
        currentLect = await lecturersService.getLecturerForUser(user.id, user.email);
      }

      // If System Owner simulation mode and no lecturer assigned, fallback to first active lecturer
      if (!currentLect && isDosenPreview) {
        const lects = await lecturersService.getLecturers();
        setAllLecturers(lects);
        if (lects.length > 0) currentLect = lects[0];
      } else if (isDosenPreview && allLecturers.length === 0) {
        const lects = await lecturersService.getLecturers();
        setAllLecturers(lects);
      }

      if (currentLect) {
        setLecturer(currentLect);

        // Fetch published schedule, published exams, and active term concurrently
        const [sched, exams, term] = await Promise.all([
          schedulesService.getLecturerSchedule(currentLect.id),
          examsService.getPublishedExams(),
          schedulesService.getActiveTerm(),
        ]);

        setTeachingSchedule(sched);
        setActiveTerm(term);

        // Filter exams for this lecturer (supervisor_ids or lecturer_ids)
        const lectId = currentLect.id;
        const lectNameLower = (currentLect.name || '').toLowerCase();
        const myExams = exams.filter((e) => {
          const inSupervisors = Array.isArray(e.supervisor_ids) && e.supervisor_ids.includes(lectId);
          const inLecturers = Array.isArray(e.lecturer_ids) && e.lecturer_ids.includes(lectId);
          const nameMatch =
            Array.isArray(e.supervisor_names) &&
            e.supervisor_names.some((n: string) => n.toLowerCase().includes(lectNameLower));
          return inSupervisors || inLecturers || nameMatch;
        });

        setPublishedExams(myExams);
      }
    } catch (err: any) {
      console.error('Error loading lecturer profile data:', err);
      toast.error('Gagal memuat profil dosen.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [user?.id, previewRole]);

  // Derived Metrics & Calculations (Memoized for optimal performance)
  const totalSks = useMemo(() => {
    return teachingSchedule.reduce(
      (acc, item) => acc + (item.sks || (item as any).effective_sks || 0),
      0
    );
  }, [teachingSchedule]);

  // Unique Courses Grouped by Course Name
  const uniqueCourses = useMemo(() => {
    const map = new Map<string, {
      courseName: string;
      courseCode: string;
      semester: number;
      sks: number;
      classes: string[];
    }>();

    teachingSchedule.forEach((item) => {
      const key = item.course_code || item.course_name;
      const cls = item.class_name || (item as any).class_code || 'A';
      const sks = item.sks || (item as any).effective_sks || 3;
      const sem = item.semester || (item as any).course_offering?.course?.semester || 1;

      if (!map.has(key)) {
        map.set(key, {
          courseName: item.course_name,
          courseCode: item.course_code,
          semester: sem,
          sks,
          classes: [cls],
        });
      } else {
        const existing = map.get(key)!;
        if (!existing.classes.includes(cls)) {
          existing.classes.push(cls);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.semester - b.semester || a.courseName.localeCompare(b.courseName));
  }, [teachingSchedule]);

  // Sorted Weekly Lecture Timetable (Senin -> Jumat, start_time ascending)
  const sortedWeeklySchedule = useMemo(() => {
    return [...teachingSchedule].sort((a, b) => {
      const dayA = DAY_ORDER[String(a.day || '').trim().toLowerCase()] || (a.day_of_week ?? 99);
      const dayB = DAY_ORDER[String(b.day || '').trim().toLowerCase()] || (b.day_of_week ?? 99);
      if (dayA !== dayB) return dayA - dayB;

      const startA = a.start_minute ?? (a.start_time ? parseInt(a.start_time.replace(':', ''), 10) : 0);
      const startB = b.start_minute ?? (b.start_time ? parseInt(b.start_time.replace(':', ''), 10) : 0);
      return startA - startB;
    });
  }, [teachingSchedule]);

  // Days of week with active lectures (for Mini Calendar active dots)
  const activeTeachingDaysOfWeek = useMemo(() => {
    const days = new Set<number>();
    teachingSchedule.forEach((item) => {
      const d = DAY_ORDER[String(item.day || '').trim().toLowerCase()] || item.day_of_week;
      if (d) days.add(d);
    });
    return days;
  }, [teachingSchedule]);

  // Keahlian Tags derived from actual expertise string or KBK
  const expertiseTags = useMemo(() => {
    if (!lecturer) return [];
    const tags: string[] = [];

    if (lecturer.expertise && lecturer.expertise.trim()) {
      const split = lecturer.expertise.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      tags.push(...split);
    }

    if (lecturer.kbk?.name && !tags.some((t) => t.toLowerCase() === lecturer.kbk?.name.toLowerCase())) {
      tags.unshift(lecturer.kbk.name);
    }

    if (tags.length === 0) {
      tags.push('Teknik Elektro', 'Akademisi');
    }

    return tags;
  }, [lecturer]);

  // Mini Calendar Generation
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth(); // 0-indexed

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
    const totalDays = lastDay.getDate();

    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days = [];

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonthLastDay - i),
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i),
      });
    }

    // Next month filler days to complete grid (multiples of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i),
      });
    }

    return days;
  }, [calendarDate]);

  // Handle PDF Export
  const handleDownloadMyPDF = async () => {
    if (teachingSchedule.length === 0) {
      toast.error('Belum ada jadwal mengajar terbit.');
      return;
    }
    setIsDownloadingPDF(true);
    try {
      await generateLectureSchedulePDF(teachingSchedule, activeTerm, {
        scope: 'FILTERED',
        filterDescription: `Dosen: ${lecturer?.name || 'Dosen Pengampu'}`,
      });
      toast.success('Jadwal mengajar resmi berhasil diunduh.');
    } catch (err) {
      toast.error('Gagal membuat PDF jadwal.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-3 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">Memuat Profil Akademik Dosen...</p>
        </div>
      </div>
    );
  }

  if (!lecturer) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-4 text-amber-900 shadow-2xs">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Akun Belum Terhubung dengan Master Data Dosen</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              Akun login Anda ({user?.email}) belum memiliki tautan ke data dosen resmi di sistem. Silakan hubungi
              Administrator Jurusan Teknik Elektro untuk menghubungkan akun email ini dengan profil dosen Anda.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const displayName = lecturer.name || profile?.name || 'Dosen Elektro';
  const nipDisplay = lecturer.nip || '-';
  const codeDisplay = lecturer.lecturer_code || lecturer.code || '-';
  const kbkName = lecturer.kbk?.name || 'Teknik Elektro';
  const avatarUrl = (lecturer as any).avatar_url || profile?.avatar_url || null;

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. Page Header matching Reference Image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Profil Saya</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Informasi akademik, mata kuliah, jadwal mengajar, dan pengawasan ujian.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Cetak Profil</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Profil</span>
          </button>
        </div>
      </div>

      {/* 2. Main Grid Layout (~75% Left Main Area, ~25% Right Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =========================================================
            LEFT / MAIN CONTENT AREA (~75% on desktop: 8 or 9 cols)
           ========================================================= */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Top Section: Profile Identity Card + Top 3 Metrics & Mata Kuliah Diampu */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* DATA UTAMA CARD (Left ~45% of main area / 5 cols) */}
            <div className="md:col-span-5 bg-white border border-slate-200/90 rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
              <div>
                {/* Section Header */}
                <div className="flex items-center gap-2 text-slate-800 pb-3 border-b border-slate-100 mb-5">
                  <User className="w-4 h-4 text-blue-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Data Utama</h2>
                </div>

                {/* Avatar & Core Identity */}
                <div className="flex items-center gap-4 mb-5">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-16 h-16 rounded-2xl object-cover ring-4 ring-blue-50 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-blue-600 to-indigo-700 text-white font-bold text-2xl flex items-center justify-center ring-4 ring-blue-50 shadow-sm shrink-0">
                      {getInitials(displayName)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug truncate">
                      {displayName}
                    </h3>
                    <p className="text-2xs text-slate-400 truncate mt-0.5">
                      {lecturer.email || user?.email || '-'}
                    </p>
                    <div className="mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Dosen Aktif
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detailed Information Rows */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400 text-2xs">NIP</span>
                    <span className="font-mono font-bold text-slate-800 text-right text-2xs">{nipDisplay}</span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400 text-2xs">Kode Dosen</span>
                    <span className="font-mono font-bold text-blue-700 text-right text-2xs">{codeDisplay}</span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400 text-2xs">Fakultas</span>
                    <span className="font-semibold text-slate-800 text-right text-2xs">Fakultas Teknik</span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400 text-2xs">Program Studi</span>
                    <span className="font-semibold text-slate-800 text-right text-2xs">Teknik Elektro</span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400 text-2xs">Bidang Keahlian</span>
                    <span className="font-semibold text-slate-800 text-right text-2xs max-w-[160px] truncate">
                      {kbkName}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400 text-2xs">No. Telepon</span>
                    <span className="font-mono font-semibold text-slate-800 text-right text-2xs">
                      {lecturer.phone || '-'}
                    </span>
                  </div>

                  {lecturer.room_office && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400 text-2xs">Ruang Dosen</span>
                      <span className="font-semibold text-slate-800 text-right text-2xs max-w-[160px] truncate">
                        {lecturer.room_office}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom 3 Mini Badges */}
              <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-slate-100 text-center">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <div className="text-sm font-black text-slate-900">{uniqueCourses.length}</div>
                  <div className="text-3xs text-slate-400 font-medium truncate">Mata Kuliah</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <div className="text-sm font-black text-slate-900">{teachingSchedule.length}</div>
                  <div className="text-3xs text-slate-400 font-medium truncate">Kelas Aktif</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <div className="text-sm font-black text-blue-600">{totalSks}</div>
                  <div className="text-3xs text-slate-400 font-medium truncate">Beban SKS</div>
                </div>
              </div>
            </div>

            {/* TOP RIGHT: 3 Metric Cards + Mata Kuliah Diampu Card (7 cols) */}
            <div className="md:col-span-7 flex flex-col gap-5 justify-between">
              {/* Top 3 Metric Cards matching reference */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Card 1: Total SKS Diampu */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block truncate">
                      Total SKS Diampu
                    </span>
                    <span className="text-xl font-black text-slate-900 leading-tight">
                      {totalSks} <span className="text-xs font-semibold text-slate-400">SKS</span>
                    </span>
                  </div>
                </div>

                {/* Card 2: Jadwal Minggu Ini */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block truncate">
                      Jadwal Minggu Ini
                    </span>
                    <span className="text-xl font-black text-slate-900 leading-tight">
                      {teachingSchedule.length} <span className="text-xs font-semibold text-slate-400">Sesi</span>
                    </span>
                  </div>
                </div>

                {/* Card 3: Kelas Aktif */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block truncate">
                      Kelas Aktif
                    </span>
                    <span className="text-xl font-black text-slate-900 leading-tight">
                      {teachingSchedule.length} <span className="text-xs font-semibold text-slate-400">Kelas</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Mata Kuliah Diampu Card matching reference */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex-1 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Mata Kuliah Diampu
                    </h3>
                  </div>
                  <span className="text-3xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                    {activeTerm?.academic_year || '2026/2027'} ({activeTerm?.semester_type || 'Ganjil'})
                  </span>
                </div>

                {uniqueCourses.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Belum ada mata kuliah yang ditugaskan pada periode ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-xs text-left">
                      <thead className="text-3xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="pb-2">Mata Kuliah</th>
                          <th className="pb-2 text-center">Kelas</th>
                          <th className="pb-2 text-center">Semester</th>
                          <th className="pb-2 text-center">SKS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/80">
                        {uniqueCourses.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 font-bold text-slate-800">
                              <div className="truncate max-w-[200px]">{c.courseName}</div>
                              {c.courseCode && (
                                <div className="text-3xs text-slate-400 font-mono font-normal">
                                  {c.courseCode}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                {c.classes.map((cls) => (
                                  <span
                                    key={cls}
                                    className={cn(
                                      'px-2 py-0.5 rounded-md text-3xs font-bold font-mono',
                                      CLASS_BADGE_COLORS[cls] || 'bg-slate-100 text-slate-700'
                                    )}
                                  >
                                    {cls}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 text-center font-bold text-slate-700">
                              {c.semester}
                            </td>
                            <td className="py-2.5 text-center font-mono font-bold text-slate-900">
                              {c.sks}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Jadwal Mengajar Minggu Ini & Pengawasan Ujian Mendatang */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* JADWAL MENGAJAR MINGGU INI (Timeline format matching reference) */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Jadwal Mengajar Minggu Ini
                    </h3>
                  </div>
                  {teachingSchedule.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadMyPDF}
                      disabled={isDownloadingPDF}
                      className="text-3xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </button>
                  )}
                </div>

                {sortedWeeklySchedule.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Belum ada jadwal perkuliahan yang diterbitkan.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedWeeklySchedule.map((item, idx) => {
                      const dayName = item.day || (item.day_of_week ? dayOfWeekToName(item.day_of_week) : 'Senin');
                      const timeStr = item.start_time && item.end_time ? `${item.start_time} - ${item.end_time}` : '08:00 - 10:00';
                      const bulletColor = BULLET_COLORS[idx % BULLET_COLORS.length];

                      return (
                        <div
                          key={item.id || idx}
                          className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50/60 hover:bg-blue-50/40 border border-slate-100 transition-all text-xs"
                        >
                          <div className="w-24 shrink-0">
                            <span className="font-bold text-slate-900 block text-2xs uppercase">
                              {dayName}
                            </span>
                            <span className="text-3xs text-slate-400 font-mono">
                              {timeStr}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0 flex items-center gap-2.5">
                            <span className={cn('w-2 h-2 rounded-full shrink-0', bulletColor)} />
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-800 truncate text-xs">
                                {item.course_name}
                              </h4>
                              <p className="text-3xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {item.room_name || item.room_code || 'Ruang Kuliah'} • Kelas {item.class_name || (item as any).class_code || 'A'}
                              </p>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-blue-100 text-blue-800 shrink-0">
                            Kuliah
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {teachingSchedule.length > 0 && (
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-3xs text-slate-400">
                  <span>Total {teachingSchedule.length} sesi perkuliahan aktif</span>
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(true)}
                    className="text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Format Cetak Lengkap →
                  </button>
                </div>
              )}
            </div>

            {/* PENGAWASAN UJIAN MENDATANG (Replaces Riwayat Aktivitas as per Rule 18 & 19) */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Pengawasan Ujian Mendatang
                    </h3>
                  </div>
                  <span className="text-3xs font-bold text-slate-400 uppercase">
                    UTS / UAS
                  </span>
                </div>

                {publishedExams.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Belum ada jadwal pengawasan ujian yang diterbitkan.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {publishedExams.map((exam, idx) => {
                      const isPrimarySupervisor = exam.supervisor_ids?.[0] === lecturer.id;
                      const isSecondarySupervisor = exam.supervisor_ids?.[1] === lecturer.id;

                      const roleBadge = isPrimarySupervisor
                        ? 'Pengawas 1 (Dosen Pengampu)'
                        : isSecondarySupervisor
                        ? 'Pengawas 2'
                        : 'Pengawas';

                      const examTypeBadge = exam.type || exam.exam_type || 'UTS';
                      const dateStr = exam.date || exam.exam_date || 'Tanggal Segera';
                      const timeStr = exam.start_time && exam.end_time ? `${exam.start_time} - ${exam.end_time}` : '-';

                      return (
                        <div
                          key={exam.id || idx}
                          className="p-3 rounded-2xl bg-slate-50/60 hover:bg-slate-50 border border-slate-100 transition-all text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded text-3xs font-bold bg-purple-100 text-purple-800 font-mono">
                              {examTypeBadge}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-3xs font-bold',
                                isPrimarySupervisor
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-200 text-slate-700'
                              )}
                            >
                              {roleBadge}
                            </span>
                          </div>

                          <div className="font-bold text-slate-900 truncate">
                            {exam.course_name} (Kelas {exam.class_name || exam.class_code || 'A'})
                          </div>

                          <div className="flex items-center justify-between text-3xs text-slate-500 pt-0.5">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {dateStr} • {timeStr}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {exam.room_name || exam.room_code || (Array.isArray(exam.room_names) ? exam.room_names.join(', ') : 'Ruang Ujian')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {publishedExams.length > 0 && (
                <div className="pt-3 mt-3 border-t border-slate-100 text-3xs text-slate-400 flex items-center justify-between">
                  <span>Total {publishedExams.length} sesi pengawasan ujian</span>
                  <span className="text-slate-600 font-semibold">Jurusan Teknik Elektro</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================
            RIGHT SIDEBAR (~25% on desktop: 4 or 3 cols)
           ========================================================= */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          {/* 1. Ringkasan Dosen Card matching reference */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Ringkasan Dosen
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <BookOpen className="w-4 h-4 text-slate-400" />
                  <span>Mata Kuliah Aktif</span>
                </div>
                <span className="font-bold text-slate-900 font-mono">{uniqueCourses.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>Total Kelas</span>
                </div>
                <span className="font-bold text-slate-900 font-mono">{teachingSchedule.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Beban SKS</span>
                </div>
                <span className="font-bold text-blue-700 font-mono">{totalSks} SKS</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span>Pengawasan Ujian</span>
                </div>
                <span className="font-bold text-purple-700 font-mono">{publishedExams.length} Sesi</span>
              </div>
            </div>
          </div>

          {/* 2. Keahlian Card matching reference */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Award className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Keahlian & Bidang Riset
              </h3>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {expertiseTags.map((tag, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'px-2.5 py-1 rounded-xl text-2xs font-bold border transition-all',
                    TAG_COLORS[idx % TAG_COLORS.length]
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* 3. Mini Calendar matching reference */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">
                {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))
                  }
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                  aria-label="Bulan sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))
                  }
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                  aria-label="Bulan berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-3xs">
              {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
                <span key={d} className="font-bold text-slate-400 py-1">
                  {d}
                </span>
              ))}

              {calendarDays.map((item, idx) => {
                const isToday =
                  new Date().toDateString() === item.date.toDateString() && item.isCurrentMonth;
                const dayNum = item.date.getDay(); // 0 = Sunday, 1 = Monday
                const academicDay = dayNum === 0 ? 7 : dayNum;
                const hasLecture = activeTeachingDaysOfWeek.has(academicDay) && item.isCurrentMonth;

                return (
                  <div
                    key={idx}
                    className={cn(
                      'relative py-1.5 rounded-lg flex flex-col items-center justify-center transition-colors',
                      !item.isCurrentMonth && 'text-slate-300 opacity-40',
                      item.isCurrentMonth && 'text-slate-700 font-medium',
                      isToday && 'bg-blue-600 text-white font-black shadow-xs'
                    )}
                  >
                    <span>{item.day}</span>
                    {hasLecture && !isToday && (
                      <span className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Kontak Card (NO Availability / Absensi) */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <User className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Kontak
              </h3>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{lecturer.email || user?.email || '-'}</span>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-mono">{lecturer.phone || '-'}</span>
              </div>

              {lecturer.room_office && (
                <div className="flex items-center gap-2.5">
                  <Building className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{lecturer.room_office}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {lecturer.email && (
                <a
                  href={`mailto:${lecturer.email}`}
                  className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-2xs font-bold text-center transition-colors flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </a>
              )}
              {lecturer.phone && (
                <a
                  href={`https://wa.me/${lecturer.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-2xs font-bold text-center transition-colors flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <EditProfileModal
          isOpen={true}
          onClose={() => setIsEditModalOpen(false)}
          lecturer={lecturer}
          profile={profile}
          onSaved={(updated) => setLecturer(updated)}
        />
      )}

      {/* Official Schedule Export Modal */}
      {isExportModalOpen && (
        <DocumentExportModal
          isOpen={true}
          onClose={() => setIsExportModalOpen(false)}
          documentType="KULIAH"
          allSchedules={teachingSchedule}
          term={activeTerm}
          filterDescription={`Dosen: ${lecturer.name || 'Dosen Pengampu'}`}
        />
      )}
    </div>
  );
};
