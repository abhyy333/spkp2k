import React from 'react';
import { ArrowRight, CheckCircle2, AlertCircle, Users, BookOpen } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

interface SchedulingStickyBarProps {
  selectedCount: number;
  theoryCount?: number;
  practicumCount?: number;
  totalParticipants: number;
  hasInvalidParticipants: boolean;
  onContinue: () => void;
}

export const SchedulingStickyBar: React.FC<SchedulingStickyBarProps> = ({
  selectedCount,
  theoryCount,
  practicumCount,
  totalParticipants,
  hasInvalidParticipants,
  onContinue,
}) => {
  if (selectedCount === 0) return null;

  const handleButtonClick = () => {
    if (hasInvalidParticipants) {
      toast.error('Isi jumlah peserta untuk seluruh mata kuliah teori yang dipilih.');
      // Find first invalid input on page
      const firstInvalid = document.querySelector('input[data-invalid-participant="true"]') as HTMLInputElement;
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
      }
      return;
    }

    onContinue();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-4 py-3 sm:py-3.5 transition-all animate-in slide-in-from-bottom duration-200">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Summary Stats */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900">
              <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="flex items-center gap-1.5">
                {theoryCount !== undefined ? (
                  <>
                    <span>{theoryCount} MK Teori</span>
                    {practicumCount !== undefined && practicumCount > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-3xs font-semibold bg-emerald-100 text-emerald-800">
                        + {practicumCount} Praktikum
                      </span>
                    )}
                  </>
                ) : (
                  <span>{selectedCount} Mata Kuliah Terpilih</span>
                )}
              </div>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700">
            <Users className="w-4 h-4 text-slate-500 shrink-0" />
            <span>{totalParticipants} Total Peserta Terencana</span>
          </div>

          {hasInvalidParticipants && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-2xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Isi jumlah peserta untuk seluruh mata kuliah teori yang dipilih.</span>
            </div>
          )}
        </div>

        {/* Right: Action Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            disabled={hasInvalidParticipants}
            onClick={handleButtonClick}
            className={cn(
              'w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm',
              hasInvalidParticipants
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 cursor-pointer'
            )}
          >
            <span>Lanjut ke Pembagian Rombel</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
