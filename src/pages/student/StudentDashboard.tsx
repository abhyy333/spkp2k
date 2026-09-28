import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  BookOpen,
  GraduationCap,
  Layers,
  Download,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { studentsService } from '../../services/students.service';
import { schedulesService } from '../../services/schedules.service';
import { Student, CurrentPublishedSchedule } from '../../types';

export const StudentDashboard: React.FC = () => {
  const { user, profile, previewRole } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [mySchedule, setMySchedule] = useState<CurrentPublishedSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAssignments, setHasAssignments] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      if (!profile?.id) {
        setLoading(false);
        return;
      }

      try {
        const sched = await schedulesService.getStudentSchedule();
        setMySchedule(sched);
        setHasAssignments(true);
      } catch (err) {
        console.error('Error loading student dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile]);

  const totalSks = mySchedule.reduce((acc, item) => acc + (item.sks || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Mahasiswa"
        subtitle={`Selamat datang, ${student?.name || profile?.name || 'Mahasiswa Teknik Elektro'}`}
        badge={
          student?.nim ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              NIM: {student.nim}
            </span>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Mata Kuliah Terdaftar"
          value={mySchedule.length}
          icon={<BookOpen className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle="kelas perkuliahan tetap"
        />

        <StatCard
          title="Total Beban SKS"
          value={`${totalSks} SKS`}
          icon={<Layers className="w-6 h-6" />}
          iconBgColor="bg-purple-50 text-purple-600"
          subtitle="semester perkuliahan aktif"
        />

        <StatCard
          title="Angkatan & KBK"
          value={student?.batch_year || '2023'}
          icon={<GraduationCap className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          subtitle={student?.kbk?.name || 'Teknik Elektro'}
        />
      </div>

      {/* Main Schedule Viewer */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-slate-800">Jadwal Kuliah Saya</h4>
          </div>
          <button
            onClick={() => navigate('/mahasiswa/jadwal-saya')}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Lihat Jadwal Lengkap
          </button>
        </div>

        {loading ? (
          <LoadingState rows={4} message="Memuat jadwal kuliah..." />
        ) : !hasAssignments ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-600 space-y-1">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-slate-800 text-sm">
              Kelas mahasiswa belum ditetapkan.
            </p>
            <p className="text-slate-500 max-w-md mx-auto">
              Silakan hubungi administrator jurusan untuk informasi pembagian kelas tetap Anda.
            </p>
          </div>
        ) : mySchedule.length === 0 ? (
          <EmptyState
            title="Belum ada jadwal yang diterbitkan"
            description="Jadwal kelas Anda akan tampil setelah jadwal resmi dipublikasikan oleh bagian akademik."
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
                  <th className="py-2.5 px-3">Dosen</th>
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
                    <td className="py-3 px-3 text-slate-600">
                      {Array.isArray(item.lecturer_names)
                        ? item.lecturer_names.join(', ')
                        : item.lecturer_names}
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
