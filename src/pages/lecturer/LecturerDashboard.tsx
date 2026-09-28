import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  BookOpen,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Building,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { lecturersService } from '../../services/lecturers.service';
import { schedulesService } from '../../services/schedules.service';
import { Lecturer, CurrentPublishedSchedule } from '../../types';

export const LecturerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [lecturer, setLecturer] = useState<Lecturer | null>(null);
  const [mySchedule, setMySchedule] = useState<CurrentPublishedSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      if (!profile?.id) {
        setLoading(false);
        return;
      }

      try {
        const lect = await lecturersService.getLecturerByProfileId(profile.id);
        if (!lect) {
          setNotLinked(true);
          setLoading(false);
          return;
        }

        setLecturer(lect);
        const sched = await schedulesService.getLecturerSchedule(lect.id);
        setMySchedule(sched);
      } catch (err) {
        console.error('Error loading lecturer dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile]);

  if (notLinked) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard Dosen"
          subtitle="Sistem Pendukung Keputusan Penjadwalan Perkuliahan"
        />
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 text-amber-900">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Profil dosen belum terhubung dengan akun pengguna</h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Hubungi administrator jurusan untuk menautkan akun email Anda dengan master data dosen Teknik Elektro.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalSks = mySchedule.reduce((acc, item) => acc + (item.sks || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Dosen"
        subtitle={`Selamat datang, ${lecturer?.name || profile?.name || 'Bapak/Ibu Dosen'}`}
        badge={
          lecturer?.code ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Kode: {lecturer.code}
            </span>
          ) : undefined
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Kelas Mengajar"
          value={mySchedule.length}
          icon={<BookOpen className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle="kelas pada jadwal resmi"
        />

        <StatCard
          title="Beban Mengajar"
          value={`${totalSks} SKS`}
          icon={<Clock className="w-6 h-6" />}
          iconBgColor="bg-purple-50 text-purple-600"
          subtitle="total beban semester ini"
        />

        <StatCard
          title="Bidang Keahlian"
          value={lecturer?.kbk?.name || 'Teknik Elektro'}
          icon={<UserCheck className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          subtitle="Kelompok Bidang Keahlian"
        />
      </div>

      {/* Jadwal Mengajar Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-slate-800">Jadwal Mengajar Saya</h4>
          </div>
          <button
            onClick={() => navigate('/dosen/jadwal-saya')}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Lihat Detail Jadwal
          </button>
        </div>

        {loading ? (
          <LoadingState rows={4} message="Memuat jadwal mengajar..." />
        ) : mySchedule.length === 0 ? (
          <EmptyState
            title="Belum ada jadwal perkuliahan yang diterbitkan"
            description="Belum ada jadwal perkuliahan yang diterbitkan oleh administrator jurusan."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-2xs">
                <tr>
                  <th className="py-2.5 px-3">Hari</th>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Mata Kuliah</th>
                  <th className="py-2.5 px-3 text-center">Kelas</th>
                  <th className="py-2.5 px-3 text-center">SKS</th>
                  <th className="py-2.5 px-3">Ruangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mySchedule.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-bold text-slate-800">{item.day}</td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-700">
                      {item.start_time} – {item.end_time}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-800">{item.course_name}</p>
                      <span className="text-2xs text-slate-400">{item.course_code}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700">
                        {item.class_name}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">{item.sks}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {item.room_code || item.room_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
