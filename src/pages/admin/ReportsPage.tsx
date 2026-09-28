import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  BarChart3,
  Calendar,
  Users,
  Building,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { schedulesService } from '../../services/schedules.service';
import { examsService } from '../../services/exams.service';
import { CurrentPublishedSchedule, CurrentPublishedExam, AcademicTerm } from '../../types';
import {
  generateLectureSchedulePDF,
  generateExamSchedulePDF,
  generateLecturerWorkloadPDF,
  generateRoomOccupancyPDF,
} from '../../lib/pdf/pdfGenerator';
import { DocumentExportModal } from '../../components/documents/DocumentExportModal';
import { toast } from '../../components/ui/Toast';

export const ReportsPage: React.FC = () => {
  const [schedules, setSchedules] = useState<CurrentPublishedSchedule[]>([]);
  const [utsExams, setUtsExams] = useState<CurrentPublishedExam[]>([]);
  const [uasExams, setUasExams] = useState<CurrentPublishedExam[]>([]);
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);

  // Document modal
  const [modalType, setModalType] = useState<'KULIAH' | 'UTS' | 'UAS' | null>(null);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const term = await schedulesService.getActiveTerm();
        setActiveTerm(term);
        const [scheds, uts, uas] = await Promise.all([
          schedulesService.getPublishedSchedule(),
          examsService.getPublishedExams(term?.id, 'UTS'),
          examsService.getPublishedExams(term?.id, 'UAS'),
        ]);
        setSchedules(scheds);
        setUtsExams(uts);
        setUasExams(uas);
      } catch (err: any) {
        console.error('Error loading reports data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const handleDownloadReport = async (key: string) => {
    if (generatingKey) return;
    setGeneratingKey(key);

    try {
      if (key === 'LECTURE') {
        if (schedules.length === 0) {
          toast.error('Belum ada jadwal perkuliahan yang diterbitkan.');
          return;
        }
        await generateLectureSchedulePDF(schedules, activeTerm);
        toast.success('Laporan Jadwal Perkuliahan berhasil diunduh.');
      } else if (key === 'WORKLOAD') {
        if (schedules.length === 0) {
          toast.error('Belum ada data jadwal terbit untuk beban dosen.');
          return;
        }
        await generateLecturerWorkloadPDF(schedules, activeTerm);
        toast.success('Laporan Beban Mengajar Dosen berhasil diunduh.');
      } else if (key === 'ROOMS') {
        if (schedules.length === 0) {
          toast.error('Belum ada data jadwal terbit untuk utilitas ruangan.');
          return;
        }
        await generateRoomOccupancyPDF(schedules, activeTerm);
        toast.success('Laporan Utilitas Ruangan berhasil diunduh.');
      } else if (key === 'EXAMS_UTS') {
        if (utsExams.length === 0) {
          toast.error('Belum ada jadwal UTS yang diterbitkan.');
          return;
        }
        await generateExamSchedulePDF(utsExams, activeTerm, 'UTS');
        toast.success('Laporan Jadwal UTS berhasil diunduh.');
      } else if (key === 'EXAMS_UAS') {
        if (uasExams.length === 0) {
          toast.error('Belum ada jadwal UAS yang diterbitkan.');
          return;
        }
        await generateExamSchedulePDF(uasExams, activeTerm, 'UAS');
        toast.success('Laporan Jadwal UAS berhasil diunduh.');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error('Gagal membuat dokumen PDF.');
    } finally {
      setGeneratingKey(null);
    }
  };

  const reports = [
    {
      key: 'LECTURE',
      title: 'Laporan Jadwal Perkuliahan Lengkap',
      desc: 'Rekapitulasi jadwal seluruh mata kuliah, kelas, dosen pengampu, dan ruangan semester aktif format akademik resmi.',
      type: 'PDF / Cetak Resmi',
      count: `${schedules.length} Kelas Terjadwal`,
      icon: <Calendar className="w-5 h-5" />,
      iconColor: 'bg-blue-50 text-blue-600',
      onPreview: () => setModalType('KULIAH'),
    },
    {
      key: 'WORKLOAD',
      title: 'Laporan Beban Mengajar Dosen (SKS)',
      desc: 'Rekapitulasi distribusi beban SKS mengajar seluruh dosen Jurusan Teknik Elektro.',
      type: 'PDF Format A4',
      count: `${schedules.length > 0 ? 'Data Tersedia' : 'Belum Ada Data'}`,
      icon: <Users className="w-5 h-5" />,
      iconColor: 'bg-purple-50 text-purple-600',
    },
    {
      key: 'ROOMS',
      title: 'Laporan Utilitas & Okupansi Ruangan',
      desc: 'Tingkat keterisian dan utilisasi ruang kelas dan laboratorium perkuliahan per hari.',
      type: 'PDF Format A4',
      count: `${schedules.length > 0 ? 'Data Tersedia' : 'Belum Ada Data'}`,
      icon: <Building className="w-5 h-5" />,
      iconColor: 'bg-emerald-50 text-emerald-600',
    },
    {
      key: 'EXAMS_UTS',
      title: 'Laporan Jadwal Ujian Tengah Semester (UTS)',
      desc: 'Matriks jadwal ujian UTS, penugasan pengawas, dan alokasi ruang ujian terbit.',
      type: 'PDF / Cetak Resmi',
      count: `${utsExams.length} Sesi Terjadwal`,
      icon: <FileText className="w-5 h-5" />,
      iconColor: 'bg-indigo-50 text-indigo-600',
      onPreview: utsExams.length > 0 ? () => setModalType('UTS') : undefined,
    },
    {
      key: 'EXAMS_UAS',
      title: 'Laporan Jadwal Ujian Akhir Semester (UAS)',
      desc: 'Matriks jadwal ujian UAS, penugasan pengawas, dan alokasi ruang ujian terbit.',
      type: 'PDF / Cetak Resmi',
      count: `${uasExams.length} Sesi Terjadwal`,
      icon: <FileText className="w-5 h-5" />,
      iconColor: 'bg-rose-50 text-rose-600',
      onPreview: uasExams.length > 0 ? () => setModalType('UAS') : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan & Ekspor"
        subtitle="Unduh rekapitulasi data akademik dan jadwal resmi Teknik Elektro Universitas Mataram"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => {
          const isGenerating = generatingKey === r.key;

          return (
            <div
              key={r.key}
              className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-4 hover:border-blue-200 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.iconColor}`}>
                    {r.icon}
                  </div>
                  <span className="text-3xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {r.count}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-800 leading-snug">{r.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{r.desc}</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-2xs font-semibold text-slate-400">{r.type}</span>
                <div className="flex items-center gap-1.5">
                  {r.onPreview && (
                    <button
                      type="button"
                      onClick={r.onPreview}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>Cetak</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isGenerating || loading}
                    onClick={() => handleDownloadReport(r.key)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Document Modal */}
      {modalType && (
        <DocumentExportModal
          isOpen={true}
          onClose={() => setModalType(null)}
          documentType={modalType}
          allSchedules={schedules}
          allExams={modalType === 'UTS' ? utsExams : uasExams}
          term={activeTerm}
        />
      )}
    </div>
  );
};
