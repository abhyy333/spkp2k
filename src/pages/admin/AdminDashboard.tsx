import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Users,
  AlertTriangle,
  Calendar,
  Download,
  ChevronRight,
  Info,
  CheckCircle2,
  Clock,
  Layers,
  GraduationCap,
  DoorClosed,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ScheduleAnalyticsPanel } from '../../components/dashboard/ScheduleAnalyticsPanel';
import { coursesService } from '../../services/courses.service';
import { lecturersService } from '../../services/lecturers.service';
import { schedulesService } from '../../services/schedules.service';
import { conflictsService } from '../../services/conflicts.service';
import { useAcademicTerm } from '../../contexts/AcademicTermContext';
import {
  CurrentPublishedSchedule,
  ScheduleConflict,
  ScheduleSuggestion,
  AcademicTerm,
} from '../../types';

import { generateLectureSchedulePDF } from '../../lib/pdf/pdfGenerator';
import { toast } from '../../components/ui/Toast';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { activeTerm: globalActiveTerm } = useAcademicTerm();
  const [loading, setLoading] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(globalActiveTerm);

  // Sync global active term
  useEffect(() => {
    if (globalActiveTerm) {
      setActiveTerm(globalActiveTerm);
    }
  }, [globalActiveTerm]);

  // Stats
  const [courseStats, setCourseStats] = useState({ total: 0, schedulable: 0, totalClasses: 0 });
  const [lecturerStats, setLecturerStats] = useState({ total: 0, active: 0 });
  const [conflictStats, setConflictStats] = useState({ total: 0 });
  const [scheduleStatus, setScheduleStatus] = useState({ status: 'Belum ada jadwal', percentage: 0 });

  // Data
  const [schedule, setSchedule] = useState<CurrentPublishedSchedule[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      setLoading(true);
      try {
        const [cStats, lStats, confStats, sStatus, term, pubSchedule, confList, suggList] =
          await Promise.all([
            coursesService.getStats().catch(() => ({ total: 0, schedulable: 0, wajib: 0, pilihan: 0, totalClasses: 0 })),
            lecturersService.getStats().catch(() => ({ total: 0, active: 0, highLoad: 0, available: 0 })),
            conflictsService.getStats().catch(() => ({ total: 0, lecturerConflicts: 0, roomConflicts: 0, capacityConflicts: 0 })),
            schedulesService.getScheduleStatus().catch(() => ({ status: 'Belum ada jadwal', percentage: 0 })),
            schedulesService.getActiveTerm().catch(() => null),
            schedulesService.getPublishedSchedule().catch(() => []),
            conflictsService.getConflicts({ isResolved: false }).catch(() => []),
            conflictsService.getSuggestions().catch(() => []),
          ]);

        if (mounted) {
          setCourseStats(cStats);
          setLecturerStats(lStats);
          setConflictStats(confStats);
          setScheduleStatus(sStatus);
          if (term) setActiveTerm(term);
          setSchedule(pubSchedule);
          setConflicts(confList.slice(0, 5));
          setSuggestions(suggList.slice(0, 4));
        }
      } catch (err) {
        console.error('Error loading admin dashboard:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header with Quick Actions */}
      <PageHeader
        title="Dashboard Penjadwalan"
        subtitle="Sistem Pendukung Keputusan Penjadwalan Perkuliahan"
        badge={
          activeTerm ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {activeTerm.academic_year || activeTerm.year} {activeTerm.semester_type || activeTerm.term}
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              2026/2027 GANJIL
            </span>
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Susun Jadwal (Navigates to workflow penyusunan jadwal) */}
            <button
              onClick={() => navigate('/penyusunan-jadwal')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              Susun Jadwal
            </button>

            {/* Unduh PDF */}
            <button
              disabled={isExportingPDF}
              onClick={async () => {
                if (schedule.length === 0) {
                  toast.error('Belum ada jadwal perkuliahan yang diterbitkan.');
                  return;
                }
                setIsExportingPDF(true);
                try {
                  await generateLectureSchedulePDF(schedule, activeTerm, { scope: 'ALL' });
                  toast.success('File PDF Jadwal Perkuliahan berhasil diunduh.');
                } catch (err) {
                  console.error('Download PDF error:', err);
                  toast.error('Gagal membuat PDF.');
                } finally {
                  setIsExportingPDF(false);
                }
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4 text-slate-500" />
              {isExportingPDF ? 'Membuat PDF...' : 'Unduh PDF'}
            </button>
          </div>
        }
      />

      {/* KPI Stat Cards (4 Cards matching UI screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Mata Kuliah */}
        <StatCard
          title="Total Mata Kuliah"
          value={loading ? '...' : courseStats.total}
          icon={<BookOpen className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          trend={{
            text: `${courseStats.schedulable || 0} siap jadwal`,
            type: 'positive',
          }}
          subtitle="master katalog kurikulum resmi"
        />

        {/* Total Dosen */}
        <StatCard
          title="Total Dosen"
          value={loading ? '...' : lecturerStats.total}
          icon={<Users className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          trend={{
            text: `${lecturerStats.active} aktif`,
            type: 'positive',
          }}
          subtitle="dosen pengampu semester ini"
        />

        {/* Konflik Terdeteksi */}
        <StatCard
          title="Konflik Terdeteksi"
          value={loading ? '...' : conflictStats.total}
          icon={<AlertTriangle className="w-6 h-6" />}
          iconBgColor="bg-rose-50 text-rose-600"
          trend={
            conflictStats.total > 0
              ? { text: 'perlu ditangani', type: 'negative' }
              : { text: 'bersih', type: 'positive' }
          }
          subtitle={conflictStats.total > 0 ? 'jadwal bentrok terdeteksi' : 'tidak ada bentrok'}
        />

        {/* Status Jadwal */}
        <StatCard
          title="Status Jadwal"
          value={loading ? '...' : scheduleStatus.status}
          icon={<Calendar className="w-6 h-6" />}
          iconBgColor="bg-purple-50 text-purple-600"
          progressBar={{
            percentage: scheduleStatus.percentage,
            color: scheduleStatus.status === 'Diterbitkan' ? 'bg-emerald-500' : 'bg-blue-500',
          }}
          subtitle={
            scheduleStatus.status === 'Diterbitkan'
              ? 'jadwal telah dipublikasikan'
              : 'dalam proses penyusunan'
          }
        />
      </div>

      {/* Master Data Quick Access Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Master Data & Konfigurasi Akademik
            </h4>
          </div>
          <span className="text-2xs text-slate-400 font-medium">Jurusan Teknik Elektro</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            onClick={() => navigate('/data-mata-kuliah')}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/70 hover:bg-blue-50/50 transition-all text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 truncate">Mata Kuliah</p>
              <p className="text-3xs text-slate-400">{courseStats.total || 231} Master MK</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/data-dosen')}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/70 hover:bg-blue-50/50 transition-all text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-600 truncate">Dosen</p>
              <p className="text-3xs text-slate-400">{lecturerStats.total || 55} Dosen ({lecturerStats.active || 54} Aktif)</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/ruangan')}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/70 hover:bg-blue-50/50 transition-all text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <DoorClosed className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 group-hover:text-amber-600 truncate">Ruangan</p>
              <p className="text-3xs text-slate-400">Ruang Perkuliahan</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/slot-waktu')}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/70 hover:bg-blue-50/50 transition-all text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 group-hover:text-purple-600 truncate">Slot Waktu</p>
              <p className="text-3xs text-slate-400">Slot Perkuliahan</p>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content: Analytics Panel (Left) & Bentrok/Saran (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Schedule Analytics Panel (Per Hari, Per Sesi, Ruangan) */}
        <div className="lg:col-span-8">
          <ScheduleAnalyticsPanel
            schedule={schedule}
            loading={loading}
            activeTerm={activeTerm}
          />
        </div>

        {/* Right Column: Bentrok & Saran (Matches screenshot exact layout) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Deteksi Bentrok Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Deteksi Bentrok</h4>
              </div>
              <button
                onClick={() => navigate('/konflik-jadwal')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            {loading ? (
              <LoadingState rows={3} message="Memeriksa konflik..." />
            ) : conflicts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                Tidak ada konflik jadwal terdeteksi saat ini.
              </div>
            ) : (
              <div className="space-y-3">
                {conflicts.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate('/konflik-jadwal')}
                    className="p-3 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50/20 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="text-xs font-semibold text-slate-800 group-hover:text-rose-700">
                        {c.title}
                      </h5>
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        Bentrok
                      </span>
                    </div>
                    <p className="text-2xs text-slate-500 mt-1 line-clamp-2">
                      {c.description}
                    </p>
                    {c.conflict_source && (
                      <p className="text-2xs text-slate-400 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {c.conflict_source}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saran Otomatis Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Saran Otomatis</h4>
              </div>
              <button
                onClick={() => navigate('/konflik-jadwal')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            {loading ? (
              <LoadingState rows={3} message="Memuat saran..." />
            ) : suggestions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Belum ada saran relokasi jadwal yang perlu diterapkan.
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-lg border border-slate-200 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800">{s.description}</p>
                      <span className="text-2xs text-slate-400 mt-0.5 inline-block">
                        {s.suggestion_type}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate('/konflik-jadwal')}
                      className="px-2.5 py-1 text-2xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md shrink-0 transition-colors cursor-pointer"
                    >
                      Tinjau
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
