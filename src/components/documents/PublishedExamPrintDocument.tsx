import React from 'react';
import { CurrentPublishedExam, AcademicTerm } from '../../types';
import { UnramLogo } from '../shared/UnramLogo';
import { formatDateIndo, minuteToTime } from '../../lib/utils';

interface PublishedExamPrintDocumentProps {
  exams: CurrentPublishedExam[];
  term: AcademicTerm | null;
  examType: 'UTS' | 'UAS';
  filterDescription?: string;
}

export const PublishedExamPrintDocument: React.FC<PublishedExamPrintDocumentProps> = ({
  exams,
  term,
  examType,
  filterDescription,
}) => {
  const sorted = React.useMemo(() => {
    return [...exams].sort((a, b) => {
      const dateComp = (a.exam_date || a.date || '').localeCompare(b.exam_date || b.date || '');
      if (dateComp !== 0) return dateComp;

      const startA = a.start_minute ?? 0;
      const startB = b.start_minute ?? 0;
      if (startA !== startB) return startA - startB;

      const nameComp = (a.course_name || '').localeCompare(b.course_name || '');
      if (nameComp !== 0) return nameComp;

      return (a.class_code || a.class_name || '').localeCompare(b.class_code || b.class_name || '');
    });
  }, [exams]);

  const academicYear = term?.academic_year || term?.year || '2026/2027';
  const semesterType = (term?.semester_type || term?.term || 'GANJIL').toUpperCase();
  const fullExamTitle = examType === 'UTS' ? 'Ujian Tengah Semester (UTS)' : 'Ujian Akhir Semester (UAS)';

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
          Jadwal {fullExamTitle}
        </h2>
        <p className="text-xs font-semibold text-slate-800 mt-1">
          Semester {semesterType} — Tahun Akademik {academicYear}
        </p>
        {filterDescription && (
          <p className="text-2xs italic text-slate-600 font-sans mt-1">
            Filter: {filterDescription} ({sorted.length} Sesi Ujian)
          </p>
        )}
      </div>

      {/* Official Table */}
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse text-xs border border-slate-900 font-sans">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-900 text-slate-900 text-center font-bold">
              <th className="border border-slate-900 px-2 py-1.5 w-8">No</th>
              <th className="border border-slate-900 px-2 py-1.5 w-24">Hari / Tanggal</th>
              <th className="border border-slate-900 px-2 py-1.5 w-20">Waktu</th>
              <th className="border border-slate-900 px-2 py-1.5 w-16">Kode MK</th>
              <th className="border border-slate-900 px-3 py-1.5 text-left">Mata Kuliah</th>
              <th className="border border-slate-900 px-2 py-1.5 w-10">Kelas</th>
              <th className="border border-slate-900 px-2 py-1.5 w-12">Peserta</th>
              <th className="border border-slate-900 px-2 py-1.5 w-20">Ruangan</th>
              <th className="border border-slate-900 px-3 py-1.5 text-left">Pengawas 1</th>
              <th className="border border-slate-900 px-3 py-1.5 text-left">Pengawas 2</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, idx) => {
              const formattedDate = item.exam_date || item.date ? formatDateIndo(item.exam_date || item.date || '') : '—';
              const timeFormatted = `${item.start_time || minuteToTime(item.start_minute || 470)}–${item.end_time || minuteToTime(item.end_minute || 560)}`;

              const roomText = Array.isArray(item.room_names) && item.room_names.length > 0
                ? item.room_names.join(', ')
                : item.room_name || item.room_code || '—';

              const supervisor1 = Array.isArray(item.supervisor_names) && item.supervisor_names.length > 0
                ? item.supervisor_names[0]
                : '—';

              const supervisor2 = Array.isArray(item.supervisor_names) && item.supervisor_names.length > 1
                ? item.supervisor_names[1]
                : '—';

              return (
                <tr
                  key={item.id || idx}
                  className="border-b border-slate-300 even:bg-slate-50/50 print:break-inside-avoid"
                >
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-semibold">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-bold text-2xs">
                    {formattedDate}
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
                    {item.class_code || item.class_name || 'A'}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center text-2xs">
                    {item.student_count || 40} Mhs
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-bold text-2xs">
                    {roomText}
                  </td>
                  <td className="border border-slate-400 px-3 py-1.5 text-slate-800 text-2xs">
                    {supervisor1}
                  </td>
                  <td className="border border-slate-400 px-3 py-1.5 text-slate-800 text-2xs">
                    {supervisor2}
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
          <p>Tata Tertib Ujian:</p>
          <ul className="list-disc list-inside space-y-0.5 mt-0.5">
            <li>Mahasiswa wajib hadir 15 menit sebelum ujian dimulai membawa Kartu Peserta Ujian.</li>
            <li>Pengawas wajib menandatangani Berita Acara Ujian di ruang sekretariat panitia.</li>
          </ul>
        </div>

        <div className="text-center min-w-[200px]">
          <p>Mataram, {formatDateIndo(new Date())}</p>
          <p className="font-semibold mt-1">Ketua Panitia Ujian,</p>
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
