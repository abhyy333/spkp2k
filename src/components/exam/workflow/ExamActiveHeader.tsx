import React from 'react';
import { Calendar, RotateCcw, Sparkles, History, LogOut } from 'lucide-react';
import { AcademicTerm } from '../../../types';

interface ExamActiveHeaderProps {
  activeTerm: AcademicTerm | null;
  examType: 'UTS' | 'UAS';
  onResetWorkflow?: () => void;
  onOpenHistory?: () => void;
  onExitWorkflow?: () => void;
}

export const ExamActiveHeader: React.FC<ExamActiveHeaderProps> = ({
  activeTerm,
  examType,
  onResetWorkflow,
  onOpenHistory,
  onExitWorkflow,
}) => {
  const termLabel = activeTerm
    ? `${activeTerm.semester_type || activeTerm.term || 'GANJIL'} ${
        activeTerm.academic_year || activeTerm.year || '2026/2027'
      }`
    : 'GANJIL 2026/2027';

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Penyusunan Jadwal Ujian
          </h1>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>{termLabel}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles className="w-3 h-3 text-purple-600" />
            <span>{examType === 'UTS' ? 'UTS (Ujian Tengah Semester)' : 'UAS (Ujian Akhir Semester)'}</span>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
          Alur penyusunan jadwal ujian berdasarkan mata kuliah, kelas, pengawas, ruangan, sesi waktu, dan validasi bentrok.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
            title="Buka Riwayat Versi Jadwal Ujian"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Riwayat Versi</span>
          </button>
        )}

        {onResetWorkflow && (
          <button
            type="button"
            onClick={onResetWorkflow}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            title="Mulai Ulang Alur Penyusunan"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Mulai Ulang</span>
          </button>
        )}

        {onExitWorkflow && (
          <button
            type="button"
            onClick={onExitWorkflow}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            title="Keluar dari Alur Penyusunan"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Keluar Alur</span>
          </button>
        )}
      </div>
    </div>
  );
};
