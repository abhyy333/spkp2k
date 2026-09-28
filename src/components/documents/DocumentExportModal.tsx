import React, { useState } from 'react';
import {
  Download,
  Printer,
  X,
  FileText,
  Calendar,
  CheckCircle2,
  Loader2,
  Eye,
  Filter,
} from 'lucide-react';
import { CurrentPublishedSchedule, CurrentPublishedExam, AcademicTerm } from '../../types';
import { PublishedSchedulePrintDocument } from './PublishedSchedulePrintDocument';
import { PublishedExamPrintDocument } from './PublishedExamPrintDocument';
import { generateLectureSchedulePDF, generateExamSchedulePDF } from '../../lib/pdf/pdfGenerator';
import { toast } from '../ui/Toast';

interface DocumentExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'KULIAH' | 'UTS' | 'UAS';
  allSchedules?: CurrentPublishedSchedule[];
  filteredSchedules?: CurrentPublishedSchedule[];
  allExams?: CurrentPublishedExam[];
  filteredExams?: CurrentPublishedExam[];
  term: AcademicTerm | null;
  filterDescription?: string;
}

export const DocumentExportModal: React.FC<DocumentExportModalProps> = ({
  isOpen,
  onClose,
  documentType,
  allSchedules = [],
  filteredSchedules = [],
  allExams = [],
  filteredExams = [],
  term,
  filterDescription,
}) => {
  const [exportScope, setExportScope] = useState<'ALL' | 'FILTERED'>('ALL');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const isLecture = documentType === 'KULIAH';
  const hasFilter = Boolean(filterDescription && filterDescription.trim().length > 0);

  // Active dataset based on scope
  const targetSchedules = exportScope === 'FILTERED' && hasFilter ? filteredSchedules : allSchedules;
  const targetExams = exportScope === 'FILTERED' && hasFilter ? filteredExams : allExams;

  const totalItems = isLecture ? targetSchedules.length : targetExams.length;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (totalItems === 0) {
      toast.error('Tidak ada data jadwal untuk diunduh.');
      return;
    }

    setIsGenerating(true);
    try {
      if (isLecture) {
        await generateLectureSchedulePDF(targetSchedules, term, {
          scope: exportScope,
          filterDescription: exportScope === 'FILTERED' ? filterDescription : undefined,
        });
      } else {
        await generateExamSchedulePDF(targetExams, term, documentType as 'UTS' | 'UAS', {
          scope: exportScope,
          filterDescription: exportScope === 'FILTERED' ? filterDescription : undefined,
        });
      }
      toast.success('File PDF resmi berhasil dibuat dan diunduh.');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getDocTitle = () => {
    if (documentType === 'KULIAH') return 'Dokumen Jadwal Perkuliahan Resmi';
    if (documentType === 'UTS') return 'Dokumen Jadwal Ujian Tengah Semester (UTS)';
    return 'Dokumen Jadwal Ujian Akhir Semester (UAS)';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto print:p-0 print:static print:inset-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity print:hidden"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col z-10 overflow-hidden print:border-none print:shadow-none print:max-h-none print:max-w-none print:w-full print:rounded-none">
        {/* Modal Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/80 bg-slate-50/70 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                {getDocTitle()}
              </h3>
              <p className="text-2xs text-slate-500 font-medium">
                Format Standar Akademik A4 Landscape • Teknik Elektro Universitas Mataram
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={totalItems === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Cetak</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGenerating || totalItems === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </>
              )}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scope Selector Bar (if filter is active) */}
        {hasFilter && (
          <div className="px-5 py-2.5 bg-blue-50/70 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden shrink-0">
            <div className="flex items-center gap-2 text-blue-950 font-medium">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Cakupan Output Dokumen:</span>
            </div>

            <div className="flex items-center p-1 bg-white/90 rounded-xl border border-blue-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setExportScope('ALL')}
                className={`px-3 py-1 rounded-lg text-2xs font-semibold transition-all cursor-pointer ${
                  exportScope === 'ALL'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Jadwal Lengkap ({isLecture ? allSchedules.length : allExams.length} Data)
              </button>
              <button
                type="button"
                onClick={() => setExportScope('FILTERED')}
                className={`px-3 py-1 rounded-lg text-2xs font-semibold transition-all cursor-pointer ${
                  exportScope === 'FILTERED'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sesuai Filter ({isLecture ? filteredSchedules.length : filteredExams.length} Data)
              </button>
            </div>
          </div>
        )}

        {/* Live Document Preview Scrollable Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70 print:p-0 print:bg-white print:overflow-visible">
          <div className="bg-white rounded-xl shadow-md border border-slate-200/90 overflow-hidden print:border-none print:shadow-none print:rounded-none">
            {isLecture ? (
              <PublishedSchedulePrintDocument
                schedules={targetSchedules}
                term={term}
                filterDescription={exportScope === 'FILTERED' ? filterDescription : undefined}
              />
            ) : (
              <PublishedExamPrintDocument
                exams={targetExams}
                term={term}
                examType={documentType as 'UTS' | 'UAS'}
                filterDescription={exportScope === 'FILTERED' ? filterDescription : undefined}
              />
            )}
          </div>
        </div>

        {/* Modal Bottom Status Bar */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-2xs text-slate-500 font-medium print:hidden shrink-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sumber Data: Dokumen resmi yang telah diterbitkan (Published View)</span>
          </div>
          <span>Total: {totalItems} Baris Data Terpilih</span>
        </div>
      </div>
    </div>
  );
};
