import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  BookOpen,
  CalendarCheck,
  DoorClosed,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { lecturersService } from '../../services/lecturers.service';
import { schedulesService } from '../../services/schedules.service';
import { examsService } from '../../services/exams.service';
import { Lecturer, CurrentPublishedSchedule, CurrentPublishedExam } from '../../types';
import { getDayNameIndo } from '../../lib/utils';

export const LecturerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [lecturer, setLecturer] = useState<Lecturer | null>(null);
  const [allMySchedules, setAllMySchedules] = useState<CurrentPublishedSchedule[]>([]);
  const [allMyExams, setAllMyExams] = useState<CurrentPublishedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  // Today's day name in Indonesian (e.g. "Senin", "Selasa", etc.)
  const todayDayName = getDayNameIndo(new Date());

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      if (!profile?.id) {
        setLoading(false);
        return;
      }

      try {
        let lect: Lecturer | null = null;

        // 1. If profile has lecturer_id
        if (profile.lecturer_id) {
          const res = await lecturersService.getLecturerById(profile.lecturer_id);
          lect = res?.lecturer || null;
        }

        // 2. Fallback search by profile_id or email
        if (!lect) {
          lect = await lecturersService.getLecturerByProfileId(profile.id);
        }
        if (!lect && profile.email) {
          lect = await lecturersService.getLecturerByEmail(profile.email);
        }

        if (!lect) {
          if (mounted) setNotLinked(true);
          return;
        }

        if (mounted) setLecturer(lect);

        // Fetch lecturer schedules & exams
        const [schedList, examList] = await Promise.all([
          schedulesService.getLecturerSchedule(lect.id),
          examsService.getPublishedExams().catch(() => []),
        ]);

        if (mounted) {
          setAllMySchedules(schedList);

          // Filter exams where this lecturer is supervisor or teaches course
          const myNameLower = (lect.name || '').toLowerCase();
          const myExams = examList.filter((ex) => {
            const supNames = Array.isArray(ex.supervisor_names)
              ? ex.supervisor_names.join(', ').toLowerCase()
              : String(ex.proctor_names || ex.supervisor_names || '').toLowerCase();
            const lecNames = Array.isArray(ex.lecturer_names)
              ? ex.lecturer_names.join(', ').toLowerCase()
              : String(ex.lecturer_names || '').toLowerCase();
            return supNames.includes(myNameLower) || lecNames.includes(myNameLower);
          });

          setAllMyExams(myExams);
        }
      } catch (err) {
        console.error('Error loading lecturer dashboard:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [profile]);

  if (loading) {
    return <LoadingState message="Memuat jadwal mengajar Anda..." />;
  }

  if (notLinked) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard Dosen"
          subtitle="Sistem Pendukung Keputusan Penjadwalan Perkuliahan JTE"
        />
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 text-amber-900">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Akun Dosen Belum Tertaut dengan Master Data</h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Akun Anda belum terhubung dengan nama Dosen di master data Teknik Elektro. Silakan hubungi Administrator Jurusan untuk menautkan akun Anda.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 1. Jadwal Hari Ini
  const todaySchedules = allMySchedules.filter(
    (s) => (s.day || '').trim().toLowerCase() === todayDayName.toLowerCase()
  );

  // 2. Jadwal Berikutnya (courses on other days)
  const upcomingSchedules = allMySchedules.filter(
    (s) => (s.day || '').trim().toLowerCase() !== todayDayName.toLowerCase()
  );

  // 3. Ujian Terdekat
  const upcomingExams = allMyExams.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Selamat Datang, {lecturer?.name || profile?.full_name || 'Bapak/Ibu Dosen'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {lecturer?.nip ? `NIP: ${lecturer.nip}` : 'Dosen Pengampu'}{' '}
            {lecturer?.code ? `• Kode: ${lecturer.code}` : ''} • Jurusan Teknik Elektro UNRAM
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/jadwal-perkuliahan')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Lihat Semua Jadwal</span>
          </button>
        </div>
      </div>

      {/* 3 Core Focus Cards for Dosen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FOCUS 1: JADWAL HARI INI */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Jadwal Hari Ini ({todayDayName})</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-blue-100 text-blue-800">
              {todaySchedules.length} Sesi
            </span>
          </div>

          <div className="p-4 flex-1 space-y-3">
            {todaySchedules.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium">Tidak ada jadwal kuliah hari ini</p>
                <p className="text-2xs mt-0.5">Nikmati waktu persiapan atau kegiatan tridharma lainnya.</p>
              </div>
            ) : (
              todaySchedules.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/30 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">
                      {item.course_name}
                    </h4>
                    <span className="px-2 py-0.5 rounded-md text-2xs font-bold bg-blue-600 text-white shrink-0">
                      Kelas {item.class_name}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate-600">
                    <span className="flex items-center gap-1 font-semibold text-blue-700">
                      <Clock className="w-3 h-3 text-blue-600" />
                      {item.start_time} - {item.end_time}
                    </span>
                    <span className="flex items-center gap-1">
                      <DoorClosed className="w-3 h-3 text-slate-400" />
                      {item.room_name || item.room_code}
                    </span>
                    <span>{item.effective_sks || item.sks} SKS</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* FOCUS 2: JADWAL BERIKUTNYA */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Jadwal Kuliah Berikutnya</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/jadwal-perkuliahan')}
              className="text-2xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Lihat Semua &rarr;
            </button>
          </div>

          <div className="p-4 flex-1 space-y-3">
            {upcomingSchedules.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium">Belum ada kelas berikutnya</p>
              </div>
            ) : (
              upcomingSchedules.slice(0, 4).map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {item.day} • {item.start_time}
                    </span>
                    <span className="text-2xs font-semibold text-slate-500">
                      Kelas {item.class_name}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 leading-snug">
                    {item.course_name}
                  </h4>
                  <div className="flex items-center gap-2 text-2xs text-slate-500">
                    <span>{item.room_name || item.room_code}</span>
                    <span>•</span>
                    <span>{item.effective_sks || item.sks} SKS</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* FOCUS 3: UJIAN TERDEKAT */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <CalendarCheck className="w-4 h-4 text-purple-600" />
              <span>Ujian Terdekat (UTS / UAS)</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/jadwal-ujian')}
              className="text-2xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Lihat Ujian &rarr;
            </button>
          </div>

          <div className="p-4 flex-1 space-y-3">
            {upcomingExams.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium">Belum ada jadwal ujian aktif</p>
                <p className="text-2xs mt-0.5">Jadwal ujian akan muncul setelah ditetapkan oleh Jurusan.</p>
              </div>
            ) : (
              upcomingExams.map((ex, idx) => (
                <div
                  key={ex.id || idx}
                  className="p-3 rounded-xl border border-purple-100 bg-purple-50/30 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                      {ex.exam_type || 'UJIAN'} • {ex.date || ex.exam_date || '-'}
                    </span>
                    <span className="text-2xs font-semibold text-slate-600">
                      {ex.start_time} - {ex.end_time}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {ex.course_name}
                  </h4>
                  <p className="text-2xs text-slate-500">
                    Ruang: {Array.isArray(ex.room_names) ? ex.room_names.join(', ') : ex.room_name || ex.room_code || '-'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
