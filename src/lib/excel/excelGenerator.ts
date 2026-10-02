import * as XLSX from 'xlsx';
import { CurrentPublishedSchedule, CurrentPublishedExam, AcademicTerm } from '../../types';

const DAY_ORDER: Record<string, number> = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
  minggu: 7,
};

export function generateLectureScheduleExcel(
  schedules: CurrentPublishedSchedule[],
  term: AcademicTerm | null,
  filename?: string
): void {
  // Sort: Senin -> Jumat, start_minute earliest -> latest
  const sorted = [...schedules].sort((a, b) => {
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

  const yearStr = term?.academic_year || term?.year || '2026/2027';
  const semStr = (term?.semester_type || term?.term || 'GANJIL').toUpperCase();

  const dataRows = sorted.map((s, idx) => {
    const lecturerStr = Array.isArray(s.lecturer_names)
      ? s.lecturer_names.join(', ')
      : String(s.lecturer_names || '-');

    return {
      'No': idx + 1,
      'Hari': s.day || 'Senin',
      'Waktu Mulai': s.start_time || '-',
      'Waktu Selesai': s.end_time || '-',
      'Kode MK': s.course_code || '-',
      'Mata Kuliah': s.course_name || '-',
      'SKS': s.effective_sks || s.sks || 0,
      'Kelas': s.class_name || 'A',
      'Semester': s.semester || 1,
      'Ruangan': s.room_name || s.room_code || '-',
      'Dosen Pengampu': lecturerStr,
      'Jml Peserta': s.student_count || s.expected_students || 0,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataRows);

  // Set column widths for readability
  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 10 }, // Hari
    { wch: 12 }, // Mulai
    { wch: 12 }, // Selesai
    { wch: 12 }, // Kode MK
    { wch: 32 }, // Mata Kuliah
    { wch: 6 },  // SKS
    { wch: 8 },  // Kelas
    { wch: 10 }, // Semester
    { wch: 18 }, // Ruangan
    { wch: 35 }, // Dosen Pengampu
    { wch: 12 }, // Jml Peserta
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Jadwal_${semStr}`);

  const defaultFilename = `Jadwal_Perkuliahan_JTE_${semStr}_${yearStr.replace('/', '-')}.xlsx`;
  XLSX.writeFile(workbook, filename || defaultFilename);
}

export function generateExamScheduleExcel(
  exams: CurrentPublishedExam[],
  term: AcademicTerm | null,
  examType: 'UTS' | 'UAS' = 'UTS',
  filename?: string
): void {
  // Sort by date -> start_minute
  const sorted = [...exams].sort((a, b) => {
    const dateA = a.date || a.exam_date || '';
    const dateB = b.date || b.exam_date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const startA = a.start_minute ?? 0;
    const startB = b.start_minute ?? 0;
    return startA - startB;
  });

  const yearStr = term?.academic_year || term?.year || '2026/2027';
  const semStr = (term?.semester_type || term?.term || 'GANJIL').toUpperCase();

  const dataRows = sorted.map((ex, idx) => {
    const supervisors = Array.isArray(ex.supervisor_names)
      ? ex.supervisor_names.join(', ')
      : String(ex.proctor_names || ex.supervisor_names || '-');

    const rooms = Array.isArray(ex.room_names)
      ? ex.room_names.join(', ')
      : ex.room_name || ex.room_code || '-';

    return {
      'No': idx + 1,
      'Tanggal': ex.date || ex.exam_date || '-',
      'Hari': ex.day || '-',
      'Waktu Mulai': ex.start_time || '-',
      'Waktu Selesai': ex.end_time || '-',
      'Kode MK': ex.course_code || '-',
      'Mata Kuliah': ex.course_name || '-',
      'Kelas': ex.class_name || ex.class_code || 'A',
      'Semester': ex.semester || 1,
      'Ruangan': rooms,
      'Pengawas / Dosen': supervisors,
      'Jml Peserta': ex.student_count || 0,
      'Catatan': ex.notes || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataRows);

  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 14 }, // Tanggal
    { wch: 10 }, // Hari
    { wch: 12 }, // Mulai
    { wch: 12 }, // Selesai
    { wch: 12 }, // Kode MK
    { wch: 32 }, // Mata Kuliah
    { wch: 8 },  // Kelas
    { wch: 10 }, // Semester
    { wch: 20 }, // Ruangan
    { wch: 35 }, // Pengawas
    { wch: 12 }, // Peserta
    { wch: 25 }, // Catatan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Jadwal_${examType}`);

  const defaultFilename = `Jadwal_${examType}_JTE_${semStr}_${yearStr.replace('/', '-')}.xlsx`;
  XLSX.writeFile(workbook, filename || defaultFilename);
}
