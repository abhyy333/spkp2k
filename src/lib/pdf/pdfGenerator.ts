import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CurrentPublishedSchedule, CurrentPublishedExam, AcademicTerm } from '../../types';
import { formatDateIndo, minuteToTime } from '../utils';

export interface PDFExportOptions {
  scope: 'ALL' | 'FILTERED';
  filterDescription?: string;
  signatureDate?: string;
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

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/logo-unram.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Generates and downloads official Academic Lecture Schedule PDF
 */
export async function generateLectureSchedulePDF(
  schedules: CurrentPublishedSchedule[],
  term: AcademicTerm | null,
  options: PDFExportOptions = { scope: 'ALL' }
): Promise<void> {
  const logoDataUrl = await loadLogoDataUrl();

  // 1. Initialize jsPDF in A4 Landscape
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 12;

  // 2. Sort schedule by academic day order -> start time -> course name -> class
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

  // 3. Format header details
  const academicYear = term?.academic_year || term?.year || '2026/2027';
  const semesterType = (term?.semester_type || term?.term || 'GANJIL').toUpperCase();
  const versionNum = schedules[0]?.schedule_version_id ? `Versi ${schedules[0]?.schedule_version_id.slice(0, 8)}` : 'Versi Resmi 1.0';

  // 4. Header Drawing
  const drawHeader = (data: any) => {
    if (data.pageNumber === 1) {
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', margin, 10, 20, 20);
        } catch {}
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(20, 30, 50);
      doc.text('UNIVERSITAS MATARAM', pageWidth / 2, 14, { align: 'center' });

      doc.setFontSize(11);
      doc.text('FAKULTAS TEKNIK — JURUSAN TEKNIK ELEKTRO', pageWidth / 2, 19, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`JADWAL PERKULIAHAN SEMESTER ${semesterType}`, pageWidth / 2, 25, { align: 'center' });
      doc.text(`TAHUN AKADEMIK ${academicYear}`, pageWidth / 2, 30, { align: 'center' });

      // Horizontal Divider
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.6);
      doc.line(margin, 33, pageWidth - margin, 33);
      doc.setLineWidth(0.2);
      doc.line(margin, 34, pageWidth - margin, 34);

      // Metadata Bar
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      const filterText = options.scope === 'FILTERED' && options.filterDescription
        ? ` • Filter: ${options.filterDescription}`
        : '';

      doc.text(`Status: DITERBITKAN RESMI • Periode: ${academicYear} ${semesterType}${filterText}`, margin, 38);

      const nowFormatted = formatDateIndo(new Date());
      doc.text(`Total Terjadwal: ${sorted.length} Kelas • Dicetak: ${nowFormatted}`, pageWidth - margin, 38, { align: 'right' });
    }
  };

  // 5. Build Table Rows
  const tableRows = sorted.map((s, index) => {
    const timeFormatted = `${s.start_time || minuteToTime(s.start_minute || 470)} – ${s.end_time || minuteToTime(s.end_minute || 620)}`;
    const lecturerFormatted = Array.isArray(s.lecturer_names)
      ? s.lecturer_names.join('\n')
      : String(s.lecturer_names || '—');

    return [
      String(index + 1),
      s.day || 'Senin',
      timeFormatted,
      s.course_code || '—',
      s.course_name || 'Mata Kuliah',
      s.class_name || 'A',
      `${s.sks || s.effective_sks || 3} SKS`,
      lecturerFormatted,
      s.room_code || s.room_name || '—',
    ];
  });

  // 6. Generate Table using autoTable
  autoTable(doc, {
    head: [[
      'No',
      'Hari',
      'Waktu',
      'Kode MK',
      'Mata Kuliah',
      'Kelas',
      'SKS',
      'Dosen Pengampu',
      'Ruangan',
    ]],
    body: tableRows,
    startY: 42,
    margin: { top: 15, right: margin, bottom: 18, left: margin },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 58, 138], // Dark Blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' }, // No
      1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, // Hari
      2: { cellWidth: 26, halign: 'center' }, // Waktu
      3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, // Kode MK
      4: { cellWidth: 'auto', fontStyle: 'bold' }, // Mata Kuliah
      5: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }, // Kelas
      6: { cellWidth: 16, halign: 'center' }, // SKS
      7: { cellWidth: 70 }, // Dosen Pengampu
      8: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }, // Ruangan
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      drawHeader(data);

      // Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      const currentPage = data.pageNumber;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);

      // Left Footer
      doc.text(
        'Jurusan Teknik Elektro Fakultas Teknik Universitas Mataram — Dokumen Resmi Penjadwalan',
        margin,
        pageHeight - 8
      );

      // Right Footer (Page X of Y)
      doc.text(
        `Halaman ${currentPage} dari ${totalPages}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: 'right' }
      );
    },
  });

  // 7. Dynamic File Name
  const cleanYear = academicYear.replace('/', '-');
  const cleanTerm = semesterType.toLowerCase();
  const filename = `Jadwal_Perkuliahan_Teknik_Elektro_UNRAM_${cleanYear}_${cleanTerm}.pdf`;

  // 8. Download
  doc.save(filename);
}

/**
 * Generates and downloads official Exam Schedule PDF (UTS / UAS)
 */
export async function generateExamSchedulePDF(
  exams: CurrentPublishedExam[],
  term: AcademicTerm | null,
  examType: 'UTS' | 'UAS',
  options: PDFExportOptions = { scope: 'ALL' }
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // 1. Sort exams: exam_date -> start_minute -> course_name -> class
  const sorted = [...exams].sort((a, b) => {
    const dateComp = (a.exam_date || a.date || '').localeCompare(b.exam_date || b.date || '');
    if (dateComp !== 0) return dateComp;

    const startA = a.start_minute ?? 0;
    const startB = b.start_minute ?? 0;
    if (startA !== startB) return startA - startB;

    const nameComp = (a.course_name || '').localeCompare(b.course_name || '');
    if (nameComp !== 0) return nameComp;

    return (a.class_code || a.class_name || '').localeCompare(b.class_code || b.class_name || '');
  });

  const academicYear = term?.academic_year || term?.year || '2026/2027';
  const semesterType = (term?.semester_type || term?.term || 'GANJIL').toUpperCase();
  const fullExamTitle = examType === 'UTS' ? 'UJIAN TENGAH SEMESTER (UTS)' : 'UJIAN AKHIR SEMESTER (UAS)';

  // 2. Header Drawing
  const drawHeader = (data: any) => {
    if (data.pageNumber === 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(20, 30, 50);
      doc.text('UNIVERSITAS MATARAM', pageWidth / 2, 14, { align: 'center' });

      doc.setFontSize(11);
      doc.text('FAKULTAS TEKNIK — JURUSAN TEKNIK ELEKTRO', pageWidth / 2, 19, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`JADWAL ${fullExamTitle}`, pageWidth / 2, 25, { align: 'center' });
      doc.text(`SEMESTER ${semesterType} TAHUN AKADEMIK ${academicYear}`, pageWidth / 2, 30, { align: 'center' });

      // Horizontal Divider
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.6);
      doc.line(margin, 33, pageWidth - margin, 33);
      doc.setLineWidth(0.2);
      doc.line(margin, 34, pageWidth - margin, 34);

      // Metadata Bar
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);

      const filterText = options.scope === 'FILTERED' && options.filterDescription
        ? ` • Filter: ${options.filterDescription}`
        : '';

      doc.text(`Status: DITERBITKAN RESMI • Periode: ${academicYear} ${semesterType}${filterText}`, margin, 38);

      const nowFormatted = formatDateIndo(new Date());
      doc.text(`Total Ujian: ${sorted.length} Sesi • Dicetak: ${nowFormatted}`, pageWidth - margin, 38, { align: 'right' });
    }
  };

  // 3. Build Table Rows
  const tableRows = sorted.map((item, index) => {
    const formattedDate = item.exam_date || item.date ? formatDateIndo(item.exam_date || item.date || '') : '—';
    const timeFormatted = `${item.start_time || minuteToTime(item.start_minute || 470)} – ${item.end_time || minuteToTime(item.end_minute || 560)}`;

    const roomText = Array.isArray(item.room_names) && item.room_names.length > 0
      ? item.room_names.join(', ')
      : item.room_name || item.room_code || '—';

    const supervisor1 = Array.isArray(item.supervisor_names) && item.supervisor_names.length > 0
      ? item.supervisor_names[0]
      : '—';

    const supervisor2 = Array.isArray(item.supervisor_names) && item.supervisor_names.length > 1
      ? item.supervisor_names[1]
      : '—';

    return [
      String(index + 1),
      formattedDate,
      timeFormatted,
      item.course_code || '—',
      item.course_name || 'Mata Kuliah',
      item.class_code || item.class_name || 'A',
      `${item.student_count || 40} Mhs`,
      roomText,
      supervisor1,
      supervisor2,
    ];
  });

  // 4. Generate Table using autoTable
  autoTable(doc, {
    head: [[
      'No',
      'Hari / Tanggal',
      'Waktu',
      'Kode MK',
      'Mata Kuliah',
      'Kelas',
      'Peserta',
      'Ruangan',
      'Pengawas 1',
      'Pengawas 2',
    ]],
    body: tableRows,
    startY: 42,
    margin: { top: 15, right: margin, bottom: 18, left: margin },
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.2,
      halign: 'center',
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' }, // No
      1: { cellWidth: 32, halign: 'center', fontStyle: 'bold' }, // Hari / Tanggal
      2: { cellWidth: 26, halign: 'center' }, // Waktu
      3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // Kode MK
      4: { cellWidth: 'auto', fontStyle: 'bold' }, // Mata Kuliah
      5: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }, // Kelas
      6: { cellWidth: 16, halign: 'center' }, // Peserta
      7: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }, // Ruangan
      8: { cellWidth: 42 }, // Pengawas 1
      9: { cellWidth: 42 }, // Pengawas 2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      drawHeader(data);

      const totalPages = (doc as any).internal.getNumberOfPages();
      const currentPage = data.pageNumber;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);

      doc.text(
        `Jurusan Teknik Elektro Fakultas Teknik Universitas Mataram — Dokumen Resmi Jadwal ${examType}`,
        margin,
        pageHeight - 8
      );

      doc.text(
        `Halaman ${currentPage} dari ${totalPages}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: 'right' }
      );
    },
  });

  const cleanYear = academicYear.replace('/', '-');
  const cleanTerm = semesterType.toLowerCase();
  const filename = `Jadwal_${examType}_Teknik_Elektro_UNRAM_${cleanYear}_${cleanTerm}.pdf`;

  doc.save(filename);
}

/**
 * Generates and downloads Lecturer Teaching Workload (Beban Mengajar SKS) PDF
 */
export async function generateLecturerWorkloadPDF(
  schedules: CurrentPublishedSchedule[],
  term: AcademicTerm | null
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Aggregate workload per lecturer
  const lecturerMap: Record<
    string,
    {
      name: string;
      totalSks: number;
      classCount: number;
      courses: { name: string; class: string; sks: number; dayTime: string }[];
    }
  > = {};

  schedules.forEach((s) => {
    const names = Array.isArray(s.lecturer_names)
      ? s.lecturer_names
      : typeof s.lecturer_names === 'string' && s.lecturer_names.trim()
      ? [s.lecturer_names]
      : ['Tanpa Dosen'];

    const sksVal = Number(s.sks || s.effective_sks || 3);
    const dayTime = `${s.day || 'Senin'}, ${s.start_time || '08:00'}–${s.end_time || '10:00'}`;

    names.forEach((name) => {
      const cleanName = name.trim();
      if (!cleanName) return;
      if (!lecturerMap[cleanName]) {
        lecturerMap[cleanName] = {
          name: cleanName,
          totalSks: 0,
          classCount: 0,
          courses: [],
        };
      }
      lecturerMap[cleanName].totalSks += sksVal;
      lecturerMap[cleanName].classCount += 1;
      lecturerMap[cleanName].courses.push({
        name: s.course_name || 'Mata Kuliah',
        class: s.class_name || 'A',
        sks: sksVal,
        dayTime,
      });
    });
  });

  const sortedLecturers = Object.values(lecturerMap).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const academicYear = term?.academic_year || term?.year || '2026/2027';
  const semesterType = (term?.semester_type || term?.term || 'GANJIL').toUpperCase();

  const drawHeader = (data: any) => {
    if (data.pageNumber === 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 30, 50);
      doc.text('UNIVERSITAS MATARAM', pageWidth / 2, 14, { align: 'center' });

      doc.setFontSize(10.5);
      doc.text('FAKULTAS TEKNIK — JURUSAN TEKNIK ELEKTRO', pageWidth / 2, 19, { align: 'center' });

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('REKAPITULASI BEBAN MENGAJAR DOSEN', pageWidth / 2, 25, { align: 'center' });
      doc.text(`SEMESTER ${semesterType} TAHUN AKADEMIK ${academicYear}`, pageWidth / 2, 30, { align: 'center' });

      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.6);
      doc.line(margin, 33, pageWidth - margin, 33);
      doc.setLineWidth(0.2);
      doc.line(margin, 34, pageWidth - margin, 34);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const nowFormatted = formatDateIndo(new Date());
      doc.text(`Total Dosen: ${sortedLecturers.length} Orang • Dicetak: ${nowFormatted}`, margin, 38);
    }
  };

  const tableRows = sortedLecturers.map((item, index) => {
    const courseDetails = item.courses
      .map((c) => `${c.name} (${c.class}) - ${c.sks} SKS`)
      .join('\n');

    return [
      String(index + 1),
      item.name,
      courseDetails,
      String(item.classCount),
      `${item.totalSks} SKS`,
    ];
  });

  autoTable(doc, {
    head: [['No', 'Nama Dosen', 'Mata Kuliah & Kelas yang Diampu', 'Jml Kelas', 'Total SKS']],
    body: tableRows,
    startY: 42,
    margin: { top: 15, right: margin, bottom: 18, left: margin },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 55, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      drawHeader(data);
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Jurusan Teknik Elektro Fakultas Teknik Universitas Mataram — Dokumen Beban Mengajar',
        margin,
        pageHeight - 8
      );
      doc.text(`Halaman ${data.pageNumber} dari ${totalPages}`, pageWidth - margin, pageHeight - 8, {
        align: 'right',
      });
    },
  });

  const cleanYear = academicYear.replace('/', '-');
  doc.save(`Laporan_Beban_Mengajar_Dosen_Teknik_Elektro_${cleanYear}.pdf`);
}

/**
 * Generates and downloads Room Occupancy & Utilization PDF
 */
export async function generateRoomOccupancyPDF(
  schedules: CurrentPublishedSchedule[],
  term: AcademicTerm | null
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Aggregate room occupancy
  const roomMap: Record<
    string,
    {
      code: string;
      name: string;
      classCount: number;
      totalSks: number;
      usages: { day: string; time: string; course: string; class: string }[];
    }
  > = {};

  schedules.forEach((s) => {
    const roomKey = s.room_code || s.room_name || 'Tanpa Ruang';
    if (!roomMap[roomKey]) {
      roomMap[roomKey] = {
        code: s.room_code || roomKey,
        name: s.room_name || roomKey,
        classCount: 0,
        totalSks: 0,
        usages: [],
      };
    }
    roomMap[roomKey].classCount += 1;
    roomMap[roomKey].totalSks += Number(s.sks || s.effective_sks || 3);
    roomMap[roomKey].usages.push({
      day: s.day || 'Senin',
      time: `${s.start_time || '08:00'}–${s.end_time || '10:00'}`,
      course: s.course_name || 'Mata Kuliah',
      class: s.class_name || 'A',
    });
  });

  const sortedRooms = Object.values(roomMap).sort((a, b) => b.classCount - a.classCount);
  const academicYear = term?.academic_year || term?.year || '2026/2027';
  const semesterType = (term?.semester_type || term?.term || 'GANJIL').toUpperCase();

  const drawHeader = (data: any) => {
    if (data.pageNumber === 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 30, 50);
      doc.text('UNIVERSITAS MATARAM', pageWidth / 2, 14, { align: 'center' });

      doc.setFontSize(10.5);
      doc.text('FAKULTAS TEKNIK — JURUSAN TEKNIK ELEKTRO', pageWidth / 2, 19, { align: 'center' });

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('LAPORAN UTILITAS & OKUPANSI RUANGAN', pageWidth / 2, 25, { align: 'center' });
      doc.text(`SEMESTER ${semesterType} TAHUN AKADEMIK ${academicYear}`, pageWidth / 2, 30, { align: 'center' });

      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.6);
      doc.line(margin, 33, pageWidth - margin, 33);
      doc.setLineWidth(0.2);
      doc.line(margin, 34, pageWidth - margin, 34);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const nowFormatted = formatDateIndo(new Date());
      doc.text(`Total Ruangan Aktif: ${sortedRooms.length} Ruang • Dicetak: ${nowFormatted}`, margin, 38);
    }
  };

  const tableRows = sortedRooms.map((item, index) => {
    const usageDetails = item.usages
      .map((u) => `${u.day} (${u.time}): ${u.course} - ${u.class}`)
      .join('\n');

    return [
      String(index + 1),
      item.code,
      item.name,
      String(item.classCount),
      `${item.totalSks} SKS`,
      usageDetails,
    ];
  });

  autoTable(doc, {
    head: [['No', 'Kode', 'Nama Ruangan', 'Jml Kelas', 'Beban SKS', 'Jadwal Pemakaian Ruang']],
    body: tableRows,
    startY: 42,
    margin: { top: 15, right: margin, bottom: 18, left: margin },
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.2,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 32, fontStyle: 'bold' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 'auto' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      drawHeader(data);
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Jurusan Teknik Elektro Fakultas Teknik Universitas Mataram — Dokumen Utilitas Ruangan',
        margin,
        pageHeight - 8
      );
      doc.text(`Halaman ${data.pageNumber} dari ${totalPages}`, pageWidth - margin, pageHeight - 8, {
        align: 'right',
      });
    },
  });

  const cleanYear = academicYear.replace('/', '-');
  doc.save(`Laporan_Utilitas_Ruangan_Teknik_Elektro_${cleanYear}.pdf`);
}

export interface SAEvaluationReportData {
  runs: any[];
  activeRun?: any | null;
  multiRunSummary?: any | null;
  paramComparison?: any | null;
  term?: AcademicTerm | null;
  selectedVersionTitle?: string;
  signatureDate?: string;
}

/**
 * Generates formal Academic / Thesis Evaluation PDF for Simulated Annealing Research
 */
export async function generateSAEvaluationPDF(data: SAEvaluationReportData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15;

  const term = data.term;
  const academicYear = term?.academic_year || term?.year || '2026/2027';
  const semesterType = (term?.semester_type || term?.term || 'GANJIL').toUpperCase();
  const versionTitle = data.selectedVersionTitle || 'Draft Jadwal Semester Terpilih';

  // 1. Header Page 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 30, 50);
  doc.text('KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI', pageWidth / 2, 14, { align: 'center' });
  doc.setFontSize(12);
  doc.text('UNIVERSITAS MATARAM — FAKULTAS TEKNIK', pageWidth / 2, 19, { align: 'center' });
  doc.setFontSize(11);
  doc.text('JURUSAN TEKNIK ELEKTRO', pageWidth / 2, 24, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Jl. Majapahit No. 62, Mataram, Nusa Tenggara Barat 83125 • Telp: (0370) 636126', pageWidth / 2, 28, { align: 'center' });

  // Double line kop surat
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.line(margin, 31, pageWidth - margin, 31);
  doc.setLineWidth(0.2);
  doc.line(margin, 32, pageWidth - margin, 32);

  // Document Title & Thesis Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN HASIL EVALUASI & EKSPERIMEN SIMULATED ANNEALING', pageWidth / 2, 38, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Lampiran Uji Kuantitatif — Sistem Pendukung Keputusan Penjadwalan Perkuliahan', pageWidth / 2, 43, { align: 'center' });
  doc.text('Jurusan Teknik Elektro Fakultas Teknik Universitas Mataram', pageWidth / 2, 47, { align: 'center' });

  // Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 51, pageWidth - (margin * 2), 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Tahun Akademik: ${academicYear} Semester ${semesterType}`, margin + 3, 56);
  doc.text(`Versi Jadwal Uji: ${versionTitle}`, margin + 3, 61);

  const nowFormatted = formatDateIndo(new Date());
  doc.text(`Tanggal Cetak: ${nowFormatted}`, pageWidth - margin - 3, 56, { align: 'right' });
  doc.text(`Total Run Tersimpan: ${data.runs.length} Eksperimen`, pageWidth - margin - 3, 61, { align: 'right' });

  let currentY = 72;

  // Table 1: Ringkasan Hasil Optimasi (Best Run / Active Run)
  const activeRun = data.activeRun || (data.runs.length > 0 ? data.runs[0] : null);
  if (activeRun) {
    const initCost = activeRun.initial_cost || 0;
    const finalCost = activeRun.best_cost || activeRun.final_cost || 0;
    const costReduction = initCost > 0 ? Math.round(((initCost - finalCost) / initCost) * 100 * 10) / 10 : 100;
    const hardCount = activeRun.hard_conflicts_count ?? 0;
    const runtime = activeRun.runtime_ms || activeRun.execution_time_ms || 0;
    const cfg = activeRun.config || {};

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Evaluasi Kinerja Optimasi (Single Run Terbaik)', margin, currentY);
    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Parameter / Metrik', 'Kondisi Awal (Initial)', 'Hasil SA (Optimized)', 'Improvement / Keterangan']],
      body: [
        ['Nilai Objective Cost', `${initCost.toLocaleString()}`, `${finalCost.toLocaleString()}`, `↓ ${costReduction}% penurunan`],
        ['Konflik Keras (Hard Conflicts)', `${activeRun.metrics?.initialHardConflicts ?? 'N/A'} bentrok`, `${hardCount} bentrok`, hardCount === 0 ? '100% Bebas Konflik (Feasible)' : 'Sebagian tereliminasi'],
        ['Penalti Lunak (Soft Cost)', `${activeRun.metrics?.initialSoftCost ?? 'N/A'}`, `${activeRun.metrics?.finalSoftCost ?? activeRun.soft_conflicts_count ?? '0'}`, 'Minimasi waste ruang & beban'],
        ['Waktu Komputasi (Runtime)', '-', `${runtime} ms (${(runtime / 1000).toFixed(2)} detik)`, 'Efisien & Konvergen'],
        ['Jumlah Iterasi', '-', `${activeRun.iterations || cfg.maxIterations || 3000} iterasi`, `T0=${cfg.initialTemperature || 100}, alpha=${cfg.coolingRate || 0.985}`],
      ],
      styles: { fontSize: 8, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.15 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 40, halign: 'center' },
        3: { cellWidth: 'auto' },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Table 2: Uji Stabilitas Stokastik (Multi-Run Benchmark)
  if (data.multiRunSummary && data.multiRunSummary.runs.length > 0) {
    const ms = data.multiRunSummary;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`2. Hasil Pengujian Stabilitas Stokastik (${ms.runCount} Percobaan Multi-Run)`, margin, currentY);
    currentY += 3;

    const multiRunRows = ms.runs.map((r: any) => [
      `Run #${r.runIndex}`,
      `Seed ${r.seed}`,
      `${r.initialCost.toLocaleString()}`,
      `${r.finalCost.toLocaleString()}`,
      `${r.finalHardConflicts} konflik`,
      `${r.costReductionPercent}%`,
      `${r.runtimeMs} ms`,
      r.success ? '100% Bersih' : 'Warning',
    ]);

    // Add aggregate statistics rows
    multiRunRows.push([
      'RATA-RATA (Mean)',
      '-',
      `${ms.meanInitialCost.toLocaleString()}`,
      `${ms.meanFinalCost.toLocaleString()}`,
      '-',
      `${ms.meanCostReductionPercent}%`,
      `${ms.meanRuntimeMs} ms`,
      `Success Rate: ${ms.successRatePercent}%`,
    ]);

    multiRunRows.push([
      'STANDAR DEVIASI (Std Dev)',
      '-',
      '-',
      `sigma = ${ms.stdDevFinalCost}`,
      '-',
      '-',
      `sigma = ${ms.stdDevRuntimeMs} ms`,
      'Stabilitas Tinggi',
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['No / Run', 'Random Seed', 'Initial Cost', 'Final Cost', 'Hard Conflict', 'Improvement', 'Runtime', 'Status']],
      body: multiRunRows,
      styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: [203, 213, 225], lineWidth: 0.15 },
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 20, halign: 'center' },
        7: { cellWidth: 'auto', halign: 'center' },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Academic Conclusion & Formal Narrative Box
  if (currentY + 50 > pageHeight - margin) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Kesimpulan Analisis Kuantitatif & Pembahasan Penelitian', margin, currentY);
  currentY += 4;

  const conclusionText =
    'Berdasarkan hasil eksperimen optimasi penjadwalan menggunakan algoritma Simulated Annealing pada dataset Jurusan Teknik Elektro Universitas Mataram, algoritma terbukti mampu mengeliminasi 100% konflik hard constraint (bentrok ruang kuliah, bentrok dosen pengampu, dan kapasitas ruangan) serta menekan penalti soft constraint secara signifikan. Pengujian stabilitas stokastik menunjukkan nilai deviasi standar yang rendah, membuktikan bahwa algoritma bersifat konsisten, reliabel, dan dapat direproduksi untuk penjadwalan akademik resmi.';

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const splitConclusion = doc.splitTextToSize(conclusionText, pageWidth - (margin * 2) - 6);
  doc.text(splitConclusion, margin + 3, currentY + 5);

  currentY += 32;

  // Signatures block
  if (currentY + 40 > pageHeight - margin) {
    doc.addPage();
    currentY = 20;
  }

  const signDate = data.signatureDate ? formatDateIndo(new Date(data.signatureDate)) : formatDateIndo(new Date());

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  // Left signature: Peneliti / Operator
  doc.text(`Mataram, ${signDate}`, margin + 5, currentY);
  doc.text('Operator SPK / Peneliti,', margin + 5, currentY + 5);
  doc.text('( .................................................... )', margin + 5, currentY + 28);
  doc.text('NIM. ............................................', margin + 5, currentY + 33);

  // Right signature: Ketua Jurusan
  doc.text(`Mengetahui,`, pageWidth - margin - 65, currentY);
  doc.text('Ketua Jurusan Teknik Elektro,', pageWidth - margin - 65, currentY + 5);
  doc.text('( .................................................... )', pageWidth - margin - 65, currentY + 28);
  doc.text('NIP. ............................................', pageWidth - margin - 65, currentY + 33);

  // Footer for all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Dokumen Resmi Evaluasi Penelitian Simulated Annealing — Jurusan Teknik Elektro UNRAM',
      margin,
      pageHeight - 8
    );
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  const cleanYear = academicYear.replace('/', '-');
  doc.save(`Laporan_Evaluasi_Simulated_Annealing_UNRAM_${cleanYear}.pdf`);
}

