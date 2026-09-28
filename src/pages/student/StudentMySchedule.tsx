import React, { useState, useEffect } from 'react';
import { Calendar, Download, AlertCircle, Info } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { studentsService } from '../../services/students.service';
import { schedulesService } from '../../services/schedules.service';
import { Student, CurrentPublishedSchedule } from '../../types';
import { sortScheduleEntries } from '../../lib/utils';

export const StudentMySchedule: React.FC = () => {
  const { profile, previewRole } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [mySchedule, setMySchedule] = useState<CurrentPublishedSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAssignments, setHasAssignments] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      if (!profile?.id) {
        setLoading(false);
        return;
      }

      try {
        const sched = await schedulesService.getStudentSchedule();
        setMySchedule(sortScheduleEntries(sched));
        setHasAssignments(true);
      } catch (err) {
        console.error('Error loading student schedule:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile]);

  const isStudentPreview = previewRole === 'MAHASISWA';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jadwal Saya"
        subtitle={`Jadwal perkuliahan tetap untuk ${student?.name || profile?.name || 'Mahasiswa Elektro'}`}
        actions={
          mySchedule.length > 0 ? (
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4 text-slate-400" />
              Cetak Jadwal
            </button>
          ) : undefined
        }
      />

      {loading && <LoadingState rows={6} message="Memeriksa penempatan kelas..." />}

      {!loading && notLinked && (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-slate-400" />}
          title="Profil Mahasiswa Belum Terhubung"
          description="Akun email Anda belum terhubung dengan data mahasiswa di sistem. Silakan hubungi administrator jurusan."
        />
      )}

      {!loading && !notLinked && !hasAssignments && (
        <div className="p-8 bg-white border border-slate-200/90 rounded-2xl text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-800">Kelas mahasiswa belum ditetapkan.</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Silakan hubungi administrator jurusan untuk memastikan pembagian kelas tetap Anda telah diinput ke dalam sistem.
          </p>
        </div>
      )}

      {!loading && !notLinked && hasAssignments && mySchedule.length === 0 && (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-slate-400" />}
          title="Jadwal belum diterbitkan"
          description="Kelas Anda telah terdaftar, namun jadwal resmi belum dipublikasikan oleh bagian akademik."
        />
      )}

      {!loading && !notLinked && mySchedule.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-2xs">
              <tr>
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
              {mySchedule.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-800">{item.day}</td>
                  <td className="py-3 px-4 font-mono text-slate-600 font-medium">
                    {item.start_time} – {item.end_time}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{item.course_name}</td>
                  <td className="py-3 px-3 text-center font-bold text-blue-600">{item.class_name}</td>
                  <td className="py-3 px-3 text-center text-slate-600">{item.sks}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                      {item.room_name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {Array.isArray(item.lecturer_names) ? item.lecturer_names.join(', ') : item.lecturer_names}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
