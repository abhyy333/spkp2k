import React, { useState, useEffect } from 'react';
import { Calendar, Download, AlertCircle, Info } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { lecturersService } from '../../services/lecturers.service';
import { schedulesService } from '../../services/schedules.service';
import { Lecturer, CurrentPublishedSchedule } from '../../types';
import { sortScheduleEntries } from '../../lib/utils';

export const LecturerMySchedule: React.FC = () => {
  const { profile } = useAuth();
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
        setMySchedule(sortScheduleEntries(sched));
      } catch (err) {
        console.error('Error loading schedule:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jadwal Saya"
        subtitle={`Jadwal mengajar resmi untuk ${lecturer?.name || profile?.name || 'Dosen Elektro'}`}
        actions={
          mySchedule.length > 0 ? (
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4 text-slate-400" />
              Cetak Jadwal Saya
            </button>
          ) : undefined
        }
      />

      {/* Not Linked Warning */}
      {notLinked && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Profil dosen belum terhubung dengan akun pengguna.</h4>
            <p className="text-amber-800 mt-1 leading-relaxed">
              Hubungi administrator jurusan untuk menautkan akun email Anda dengan master data dosen Teknik Elektro.
            </p>
          </div>
        </div>
      )}

      {loading && <LoadingState rows={6} message="Memuat jadwal dosen..." />}

      {!loading && (mySchedule.length === 0 || notLinked) && (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-slate-400" />}
          title="Belum ada jadwal perkuliahan yang diterbitkan"
          description="Belum ada jadwal perkuliahan yang diterbitkan untuk semester aktif ini."
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
