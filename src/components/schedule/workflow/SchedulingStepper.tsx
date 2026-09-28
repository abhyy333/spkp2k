import React from 'react';
import {
  CheckCircle2,
  BookOpen,
  Users,
  UserCheck,
  Calendar,
  Sparkles,
  Send,
  Lock,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

export interface StepItem {
  number: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const STEPS: StepItem[] = [
  {
    number: 1,
    title: 'Pemilihan Mata Kuliah',
    subtitle: 'Pilih Paket & Mata Kuliah',
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    number: 2,
    title: 'Pembagian Rombel',
    subtitle: 'Review Kelas',
    icon: <Users className="w-4 h-4" />,
  },
  {
    number: 3,
    title: 'Penugasan Dosen',
    subtitle: 'Dosen Pengampu',
    icon: <UserCheck className="w-4 h-4" />,
  },
  {
    number: 4,
    title: 'Generate Jadwal Awal',
    subtitle: 'Ruangan & Sesi Waktu',
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    number: 5,
    title: 'Optimasi Simulated Annealing',
    subtitle: 'Eliminasi Bentrok',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    number: 6,
    title: 'Preview & Publikasi',
    subtitle: 'Review & Terbitkan',
    icon: <Send className="w-4 h-4" />,
  },
];

interface SchedulingStepperProps {
  currentStep: number;
  onStepClick?: (stepNumber: number) => void;
}

export const SchedulingStepper: React.FC<SchedulingStepperProps> = React.memo(({
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
    <div
      className="w-full p-2.5 shadow-[0_4px_16px_rgba(15,23,42,0.03)]"
      style={{
        background: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(12px) saturate(130%)',
        WebkitBackdropFilter: 'blur(12px) saturate(130%)',
        border: '1px solid rgba(255, 255, 255, 0.85)',
        borderRadius: '20px',
      }}
    >
      <div className="overflow-x-auto pb-1 -mb-1">
        <ol className="flex items-center min-w-[760px] lg:min-w-full justify-between gap-1.5">
          {STEPS.map((step, idx) => {
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
                      'w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all group',
                      isActive && 'bg-blue-50/80 border border-blue-200/80 shadow-2xs',
                      isCompleted && 'hover:bg-slate-50 cursor-pointer',
                      isLocked && 'cursor-not-allowed opacity-75 hover:opacity-90'
                    )}
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors',
                        isActive && 'bg-blue-600 text-white shadow-2xs shadow-blue-500/30',
                        isCompleted && 'bg-emerald-600 text-white',
                        isLocked && 'bg-slate-100 text-slate-400 group-hover:bg-slate-200/70'
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : isLocked ? (
                        <Lock className="w-3 h-3 text-slate-400" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-4xs font-bold uppercase tracking-wider',
                            isActive ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                          )}
                        >
                          Tahap {step.number}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-4xs font-semibold bg-blue-100 text-blue-700">
                            Aktif
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          'text-xs font-semibold truncate',
                          isActive ? 'text-slate-900 font-bold' : isCompleted ? 'text-slate-800' : 'text-slate-500'
                        )}
                        title={step.title}
                      >
                        {step.title}
                      </p>
                    </div>
                  </button>
                </li>
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'hidden xl:block w-3 h-0.5 shrink-0 rounded-full mx-0.5',
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
});
