import React from 'react';
import {
  BookOpen,
  Sparkles,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

export interface SubStepItem {
  step: number;
  label: string;
}

export interface MainStageItem {
  stageNumber: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  subSteps: SubStepItem[];
}

const MAIN_STAGES: MainStageItem[] = [
  {
    stageNumber: 1,
    title: 'Persiapan Perkuliahan',
    subtitle: 'MK, Rombel & Dosen',
    icon: <BookOpen className="w-4 h-4" />,
    subSteps: [
      { step: 1, label: 'Pemilihan MK' },
      { step: 2, label: 'Pembagian Rombel' },
      { step: 3, label: 'Penugasan Dosen' },
    ],
  },
  {
    stageNumber: 2,
    title: 'Penyusunan & Optimasi',
    subtitle: 'Jadwal Awal & Simulated Annealing',
    icon: <Sparkles className="w-4 h-4" />,
    subSteps: [
      { step: 4, label: 'Jadwal Awal' },
      { step: 5, label: 'Optimasi SA' },
    ],
  },
  {
    stageNumber: 3,
    title: 'Hasil Jadwal',
    subtitle: 'Review & Kelola',
    icon: <CheckCircle2 className="w-4 h-4" />,
    subSteps: [
      { step: 6, label: 'Review & Kelola' },
    ],
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
  // Map internal step (1..6) to main stage (1..3)
  const currentMainStage = currentStep <= 3 ? 1 : currentStep <= 5 ? 2 : 3;

  const handleStepClick = (targetStep: number) => {
    if (targetStep === currentStep) return;
    if (targetStep > currentStep) {
      toast.info('Selesaikan tahap sebelumnya terlebih dahulu.');
      return;
    }
    if (onStepClick) {
      onStepClick(targetStep);
    }
  };

  const handleStageClick = (stage: MainStageItem) => {
    if (stage.stageNumber === currentMainStage) return;

    if (stage.stageNumber > currentMainStage) {
      toast.info('Selesaikan tahap sebelumnya terlebih dahulu.');
      return;
    }

    // When jumping to an earlier stage, default to its first sub-step or current active
    const targetFirstStep = stage.subSteps[0].step;
    if (onStepClick) {
      onStepClick(targetFirstStep);
    }
  };

  // Find active stage object to render sub-steps
  const activeStageObj = MAIN_STAGES.find((s) => s.stageNumber === currentMainStage);

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 space-y-3">
      {/* Top: 3 Main Stages Header */}
      <div className="overflow-x-auto pb-1 -mb-1">
        <ol className="flex items-center min-w-[560px] md:min-w-full justify-between gap-2">
          {MAIN_STAGES.map((stage, idx) => {
            const isStageActive = stage.stageNumber === currentMainStage;
            const isStageCompleted = stage.stageNumber < currentMainStage;
            const isClickable = isStageCompleted || isStageActive;

            return (
              <React.Fragment key={stage.stageNumber}>
                <li
                  onClick={() => isClickable && handleStageClick(stage)}
                  className={cn(
                    'flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all select-none border',
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                    isStageActive
                      ? 'bg-blue-50/80 border-blue-300 shadow-2xs'
                      : isStageCompleted
                      ? 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
                      : 'bg-slate-50/40 border-slate-100'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all shrink-0 shadow-2xs',
                      isStageActive && 'bg-blue-600 text-white shadow-blue-500/20',
                      isStageCompleted && 'bg-emerald-600 text-white',
                      !isStageActive && !isStageCompleted && 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {isStageCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <span>{stage.stageNumber}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-xs font-bold leading-tight truncate',
                        isStageActive && 'text-blue-950',
                        isStageCompleted && 'text-slate-800',
                        !isStageActive && !isStageCompleted && 'text-slate-500'
                      )}
                    >
                      {stage.title}
                    </p>
                    <p className="text-3xs text-slate-500 font-medium truncate mt-0.5">
                      {stage.subtitle}
                    </p>
                  </div>
                </li>

                {idx < MAIN_STAGES.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-6 shrink-0 rounded-full transition-colors hidden sm:block',
                      stage.stageNumber < currentMainStage ? 'bg-emerald-400' : 'bg-slate-200'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </ol>
      </div>

      {/* Bottom: Sub-Step Navigation Pills for the Active Stage */}
      {activeStageObj && activeStageObj.subSteps.length > 1 && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-3xs font-semibold text-slate-500">
            <span>Alur {activeStageObj.title}:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {activeStageObj.subSteps.map((sub, sIdx) => {
              const isSubActive = sub.step === currentStep;
              const isSubCompleted = sub.step < currentStep;
              const isSubClickable = isSubCompleted || isSubActive;

              return (
                <React.Fragment key={sub.step}>
                  <button
                    type="button"
                    onClick={() => isSubClickable && handleStepClick(sub.step)}
                    disabled={!isSubClickable}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-2xs font-semibold transition-all',
                      isSubActive
                        ? 'bg-blue-600 text-white shadow-2xs font-bold cursor-default'
                        : isSubCompleted
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-70'
                    )}
                  >
                    {isSubCompleted ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <span
                        className={cn(
                          'w-3.5 h-3.5 rounded-full flex items-center justify-center text-3xs',
                          isSubActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                        )}
                      >
                        {sIdx + 1}
                      </span>
                    )}
                    <span>{sub.label}</span>
                  </button>

                  {sIdx < activeStageObj.subSteps.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

SchedulingStepper.displayName = 'SchedulingStepper';
