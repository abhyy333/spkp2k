import React from 'react';
import { CurrentPublishedSchedule, AcademicTerm } from '../../types';
import { UnramLogo } from '../shared/UnramLogo';
import { formatDateIndo, minuteToTime } from '../../lib/utils';

interface PublishedSchedulePrintDocumentProps {
  schedules: CurrentPublishedSchedule[];
  term: AcademicTerm | null;
  filterDescription?: string;
}

const DAY_ORDER: Record<string, number> = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
  minggu: 7,
};

export const PublishedSchedulePrintDocument: React.FC<PublishedSchedulePrintDocumentProps> = ({
  schedules,
  term,
  filterDescription,
}) => {
  const sorted = React.useMemo(() => {
    return [...schedules].sort((a, b) => {
      const dayA = DAY_ORDER[String(a.day || '').trim().toLowerCase()] || (a.day_of_week ?? 99);
      const dayB = DAY_ORDER[String(b.day || '').trim().toLowerCase()] || (b.day_of_week ?? 99);
      if (dayA !== dayB) return dayA - dayB;

      const startA = a.start_minute ?? (a.start_time ? parseInt(a.start_time.replace(':', ''), 10) : 0);
      const startB = b.start_minute ?? (b.start_time ? parseInt(b.start_time.replace(':', ''), 10) : 0);
      if (startA !== startB) return startA - startB;

      const nameComp = (a.course_name || '').localeCompare(b.course_name || '');
      if (nameComp !== 0) return nameComp;

      return (a.class_name || '').localeCompare(b.class_name || '');
    });
  }, [schedules]);

  const academicYear = term?.academic_year || term?.year || '2026/2027';
  const semesterType = (term?.semester_type || term?.term || 'GANJIL').toUpperCase();

  return (
    <div className="bg-white text-slate-900 p-8 max-w-5xl mx-auto font-serif print:p-0 print:max-w-none print:font-sans">
      {/* Print Document Header */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between gap-4">
        <div className="shrink-0">
          <UnramLogo size={64} />
        </div>
        <div className="text-center flex-1">
          <h1 className="text-base font-bold tracking-tight uppercase leading-snug">
            Kementerian Pendidikan Tinggi, Sains, dan Teknologi
          </h1>
          <h2 className="text-sm font-bold tracking-tight uppercase leading-snug">
            Universitas Mataram — Fakultas Teknik
          </h2>
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-800 mt-0.5">
            Jurusan Teknik Elektro
          </h3>
          <p className="text-2xs text-slate-600 font-sans mt-0.5">
            Jl. Majapahit No. 62 Mataram, NTB 83125 • Telp/Fax: (0370) 636126 • Website: elektro.unram.ac.id
          </p>
        </div>
        <div className="w-16 shrink-0" />
      </div>

      {/* Document Title */}
      <div className="text-center my-4">
        <h2 className="text-sm sm:text-base font-bold uppercase tracking-wide underline underline-offset-4">
          Jadwal Perkuliahan Semester {semesterType}
        </h2>
        <p className="text-xs font-semibold text-slate-800 mt-1">
          Tahun Akademik {academicYear}
        </p>
        {filterDescription && (
          <p className="text-2xs italic text-slate-600 font-sans mt-1">
            Filter Tampilan: {filterDescription} ({sorted.length} Kelas)
          </p>
        )}
      </div>

      {/* Official Table */}
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse text-xs border border-slate-900 font-sans">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-900 text-slate-900 text-center font-bold">
              <th className="border border-slate-900 px-2 py-1.5 w-8">No</th>
              <th className="border border-slate-900 px-2 py-1.5 w-16">Hari</th>
              <th className="border border-slate-900 px-2 py-1.5 w-24">Waktu</th>
              <th className="border border-slate-900 px-2 py-1.5 w-16">Kode MK</th>
              <th className="border border-slate-900 px-3 py-1.5 text-left">Mata Kuliah</th>
              <th className="border border-slate-900 px-2 py-1.5 w-10">Kelas</th>
              <th className="border border-slate-900 px-2 py-1.5 w-12">SKS</th>
              <th className="border border-slate-900 px-3 py-1.5 text-left">Dosen Pengampu</th>
              <th className="border border-slate-900 px-2 py-1.5 w-20">Ruangan</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, idx) => {
              const timeFormatted = `${item.start_time || minuteToTime(item.start_minute || 470)}–${item.end_time || minuteToTime(item.end_minute || 620)}`;
              const lecturerFormatted = Array.isArray(item.lecturer_names)
                ? item.lecturer_names.join(', ')
                : String(item.lecturer_names || '—');

              return (
                <tr
                  key={item.id || idx}
                  className="border-b border-slate-300 even:bg-slate-50/50 print:break-inside-avoid"
                >
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-semibold">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-bold">
                    {item.day || 'Senin'}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center whitespace-nowrap text-2xs">
                    {timeFormatted}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-mono font-semibold text-2xs">
                    {item.course_code || '—'}
                  </td>
                  <td className="border border-slate-400 px-3 py-1.5 font-bold text-slate-900">
                    {item.course_name || 'Mata Kuliah'}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-bold">
                    {item.class_name || 'A'}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center text-2xs">
                    {item.sks || item.effective_sks || 3} SKS
                  </td>
                  <td className="border border-slate-400 px-3 py-1.5 text-slate-800 text-2xs">
                    {lecturerFormatted}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-bold text-2xs">
                    {item.room_code || item.room_name || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Signature Section */}
      <div className="mt-8 pt-4 flex justify-between items-start text-xs font-sans print:break-inside-avoid">
        <div className="text-2xs text-slate-500 max-w-sm">
          <p>Catatan:</p>
          <ul className="list-disc list-inside space-y-0.5 mt-0.5">
            <li>Jadwal ini merupakan jadwal resmi yang telah disahkan oleh Jurusan.</li>
            <li>Perubahan jadwal wajib melalui persetujuan Ketua Jurusan Teknik Elektro.</li>
          </ul>
        </div>

        <div className="text-center min-w-[200px]">
          <p>Mataram, {formatDateIndo(new Date())}</p>
          <p className="font-semibold mt-1">Ketua Jurusan Teknik Elektro,</p>
          <div className="h-16" />
          <p className="font-bold underline underline-offset-2">
            ( ............................................................ )
          </p>
          <p className="text-2xs text-slate-600 mt-0.5">NIP. ......................................................</p>
        </div>
      </div>
    </div>
  );
};
