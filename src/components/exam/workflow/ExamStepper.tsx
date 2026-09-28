import React from 'react';
import {
  CheckCircle2,
  Calendar,
  BookOpen,
  Users,
  Sparkles,
  Send,
  Lock,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

export interface ExamStepItem {
  number: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const EXAM_STEPS: ExamStepItem[] = [
  {
    number: 1,
    title: 'Konfigurasi Ujian',
    subtitle: 'Periode & Jenis Ujian',
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    number: 2,
    title: 'Mata Kuliah',
    subtitle: 'Pilih Kelas Ujian',
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    number: 3,
    title: 'Pengawas & Ruangan',
    subtitle: 'Review Pengawas',
    icon: <Users className="w-4 h-4" />,
  },
  {
    number: 4,
    title: 'Generate Jadwal',
    subtitle: 'Tanggal, Ruang & Sesi',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    number: 5,
    title: 'Preview & Publikasi',
    subtitle: 'Review & Terbitkan',
    icon: <Send className="w-4 h-4" />,
  },
];

interface ExamStepperProps {
  currentStep: number;
  onStepClick?: (stepNumber: number) => void;
}

export const ExamStepper: React.FC<ExamStepperProps> = ({
  currentStep = 1,
  onStepClick,
}) => {
  const handleStepClick = (stepNumber: number) => {
    if (stepNumber === currentStep) return;
    if (stepNumber > currentStep) {
      toast.info('Selesaikan tahap sebelumnya terlebih dahulu.');
      return;
    }
    if (onStepClick) {
      onStepClick(stepNumber);
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
      <div className="overflow-x-auto pb-1 -mb-1">
        <ol className="flex items-center min-w-[760px] lg:min-w-full justify-between gap-2">
          {EXAM_STEPS.map((step, idx) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.number < currentStep;
            const isLocked = step.number > currentStep;

            return (
              <React.Fragment key={step.number}>
                <li className="flex-1">
                  <button
                    type="button"
                    onClick={() => handleStepClick(step.number)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all group',
                      isActive && 'bg-blue-50/80 border border-blue-200/80 shadow-2xs',
                      isCompleted && 'hover:bg-slate-50 cursor-pointer',
                      isLocked && 'cursor-not-allowed opacity-75 hover:opacity-90'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors',
                        isActive && 'bg-blue-600 text-white shadow-2xs shadow-blue-500/30',
                        isCompleted && 'bg-emerald-600 text-white',
                        isLocked && 'bg-slate-100 text-slate-400 group-hover:bg-slate-200/70'
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isLocked ? (
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-3xs font-bold uppercase tracking-wider',
                            isActive
                              ? 'text-blue-600'
                              : isCompleted
                              ? 'text-emerald-600'
                              : 'text-slate-400'
                          )}
                        >
                          Tahap {step.number}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-3xs font-semibold bg-blue-100 text-blue-700">
                            Aktif
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          'text-xs font-semibold truncate',
                          isActive
                            ? 'text-slate-900 font-bold'
                            : isCompleted
                            ? 'text-slate-800'
                            : 'text-slate-500'
                        )}
                        title={step.title}
                      >
                        {step.title}
                      </p>
                      <p className="text-3xs text-slate-400 truncate">{step.subtitle}</p>
                    </div>
                  </button>
                </li>
                {idx < EXAM_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'hidden xl:block w-4 h-0.5 shrink-0 rounded-full mx-0.5',
                      step.number < currentStep ? 'bg-emerald-300' : 'bg-slate-200'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
