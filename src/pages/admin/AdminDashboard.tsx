import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Users,
  DoorClosed,
  CalendarPlus,
  CalendarCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  FileCheck,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { LoadingState } from '../../components/ui/LoadingState';
import { coursesService } from '../../services/courses.service';
import { lecturersService } from '../../services/lecturers.service';
import { roomsService } from '../../services/rooms.service';
import { schedulesService } from '../../services/schedules.service';
import { conflictsService } from '../../services/conflicts.service';
import { scheduleVersionsService } from '../../services/scheduleVersions.service';
import { useAcademicTerm } from '../../contexts/AcademicTermContext';
import { AcademicTerm, ScheduleVersion, CurrentPublishedSchedule } from '../../types';
import { formatDateTimeIndo } from '../../lib/utils';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { activeTerm } = useAcademicTerm();
  const [loading, setLoading] = useState(true);

  // Stats
  const [totalCourses, setTotalCourses] = useState<number>(0);
  const [totalLecturers, setTotalLecturers] = useState<number>(0);
  const [totalRooms, setTotalRooms] = useState<number>(0);
  const [activeConflictsCount, setActiveConflictsCount] = useState<number>(0);
  const [scheduleStatus, setScheduleStatus] = useState<string>('Memuat...');
  const [latestFinalVersion, setLatestFinalVersion] = useState<ScheduleVersion | null>(null);
  const [recentFinalEntries, setRecentFinalEntries] = useState<CurrentPublishedSchedule[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      try {
        const [cStats, lStats, rList, confList, statusRes, finalVersions, pubSched] =
          await Promise.all([
            coursesService.getStats().catch(() => ({ total: 0 })),
            lecturersService.getStats().catch(() => ({ total: 0 })),
            roomsService.getRooms().catch(() => []),
            conflictsService.getConflicts({ isResolved: false }).catch(() => []),
            schedulesService.getScheduleStatus().catch(() => ({ status: 'Belum ada jadwal' })),
            scheduleVersionsService.getVersions().catch(() => []),
            schedulesService.getPublishedSchedule().catch(() => []),
          ]);

        if (mounted) {
          setTotalCourses(cStats.total || 0);
          setTotalLecturers(lStats.total || 0);
          setTotalRooms(rList.length || 0);
          setActiveConflictsCount(confList.length || 0);
          setScheduleStatus(statusRes.status || 'Draft');

          const finalVer = finalVersions.find(
            (v) => v.status === 'PUBLISHED' || v.status === 'FINAL'
          );
          setLatestFinalVersion(finalVer || null);
          setRecentFinalEntries(pubSched.slice(0, 5));
        }
      } catch (err) {
        console.error('Error loading admin dashboard:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [activeTerm]);

  if (loading) {
    return <LoadingState message="Memuat ringkasan dashboard..." />;
  }

  const termDisplay = activeTerm
    ? `${activeTerm.academic_year || activeTerm.year} (${activeTerm.semester_type || activeTerm.term})`
    : 'Belum diatur';

  return (
    <div className="space-y-6">
      {/* Page Header with CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Dashboard Admin"
          subtitle="Sistem Pendukung Keputusan Penjadwalan Perkuliahan Jurusan Teknik Elektro"
        />

        <button
          type="button"
          onClick={() => navigate('/penyusunan-jadwal')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-xs transition-all cursor-pointer shrink-0"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>Lanjutkan Penyusunan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main 7 Key Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Periode Aktif */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center gap-2.5 text-slate-500 mb-2">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-medium">Periode Aktif</span>
          </div>
          <p className="text-base font-bold text-slate-900 truncate">
            {termDisplay}
          </p>
          <p className="text-2xs text-slate-400 mt-1">Semester Perkuliahan</p>
        </div>

        {/* Jumlah MK */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center gap-2.5 text-slate-500 mb-2">
            <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-medium">Jumlah Mata Kuliah</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalCourses}</p>
          <p className="text-2xs text-slate-400 mt-1">Mata kuliah kurikulum</p>
        </div>

        {/* Jumlah Dosen */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center gap-2.5 text-slate-500 mb-2">
            <Users className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-medium">Jumlah Dosen</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalLecturers}</p>
          <p className="text-2xs text-slate-400 mt-1">Dosen pengampu JTE</p>
        </div>

        {/* Jumlah Ruangan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center gap-2.5 text-slate-500 mb-2">
            <DoorClosed className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-xs font-medium">Jumlah Ruangan</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalRooms}</p>
          <p className="text-2xs text-slate-400 mt-1">Ruang kelas & lab</p>
        </div>

        {/* Status Penyusunan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center gap-2.5 text-slate-500 mb-2">
            <CalendarCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-medium">Status Penyusunan</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                scheduleStatus === 'Diterbitkan' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <p className="text-base font-bold text-slate-900">{scheduleStatus}</p>
          </div>
          <p className="text-2xs text-slate-400 mt-1">Status jadwal semester ini</p>
        </div>

        {/* Konflik Aktif */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center gap-2.5 text-slate-500 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="text-xs font-medium">Konflik Aktif</span>
          </div>
          <p
            className={`text-2xl font-bold ${
              activeConflictsCount > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {activeConflictsCount}
          </p>
          <p className="text-2xs text-slate-400 mt-1">
            {activeConflictsCount === 0 ? 'Tidak ada bentrok' : 'Perlu penyesuaian'}
          </p>
        </div>

        {/* Jadwal Final Terakhir */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-slate-500 mb-2">
              <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-medium">Jadwal Final Terakhir</span>
            </div>
            {latestFinalVersion ? (
              <div>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {latestFinalVersion.title || `Versi ${latestFinalVersion.version_number || '1.0'}`}
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Ditetapkan:{' '}
                  {latestFinalVersion.published_at || latestFinalVersion.created_at
                    ? formatDateTimeIndo(
                        latestFinalVersion.published_at || latestFinalVersion.created_at
                      )
                    : '-'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Belum ada jadwal yang ditetapkan sebagai Final</p>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/jadwal-perkuliahan')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Buka Jadwal Perkuliahan &rarr;
            </button>
            <button
              type="button"
              onClick={() => navigate('/riwayat')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Lihat Riwayat Versi
            </button>
          </div>
        </div>
      </div>

      {/* Quick Access Action Card */}
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Alur Penyusunan SPK 4 Tahap
          </div>
          <h3 className="text-lg font-bold">Siapkan, Susun, Optimalkan, dan Finalisasi</h3>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Penyusunan jadwal otomatis terintegrasi dengan Simulated Annealing dan Smart Rescheduling untuk mengeliminasi bentrok ruang dan dosen.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/penyusunan-jadwal')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Lanjutkan Penyusunan
          </button>
          <button
            type="button"
            onClick={() => navigate('/master-data')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            Kelola Master Data
          </button>
        </div>
      </div>

      {/* Recent Final Schedule Sample Table */}
      {recentFinalEntries.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Pratinjau Jadwal Final Aktif
            </h4>
            <button
              type="button"
              onClick={() => navigate('/jadwal-perkuliahan')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Lihat Seluruhnya
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Hari & Waktu</th>
                  <th className="py-2.5 px-4">Mata Kuliah</th>
                  <th className="py-2.5 px-4">Kelas</th>
                  <th className="py-2.5 px-4">Ruangan</th>
                  <th className="py-2.5 px-4">Dosen Pengampu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentFinalEntries.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {item.day}, {item.start_time} - {item.end_time}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      {item.course_name}
                      <span className="text-2xs text-slate-400 font-normal ml-1">
                        ({item.course_code})
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-blue-600">{item.class_name}</td>
                    <td className="py-2.5 px-4 text-slate-700">{item.room_name || item.room_code}</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {Array.isArray(item.lecturer_names)
                        ? item.lecturer_names.join(', ')
                        : item.lecturer_names || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
