import React from 'react';
import { Check, Lock, ChevronRight } from 'lucide-react';
import { toast } from '../../ui/Toast';

export interface WorkflowStep {
  number: number;
  title: string;
  subtitle: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    number: 1,
    title: 'Pemilihan Mata Kuliah',
    subtitle: 'Pilih Paket & Mata Kuliah',
  },
  {
    number: 2,
    title: 'Pembagian Rombel',
    subtitle: 'Review Kelas',
  },
  {
    number: 3,
    title: 'Penugasan Dosen',
    subtitle: 'Dosen Pengampu',
  },
  {
    number: 4,
    title: 'Generate Jadwal Awal',
    subtitle: 'Ruangan & Sesi Waktu',
  },
  {
    number: 5,
    title: 'Optimasi Simulated Annealing',
    subtitle: 'Eliminasi Bentrok',
  },
  {
    number: 6,
    title: 'Preview & Publikasi',
    subtitle: 'Review & Terbitkan',
  },
];

interface DraftingWorkflowStepperProps {
  currentStep: number;
  onStepClick?: (stepNumber: number) => void;
}

export const DraftingWorkflowStepper: React.FC<DraftingWorkflowStepperProps> = ({
  currentStep = 1,
  onStepClick,
}) => {
  const handleStepClick = (step: WorkflowStep) => {
    if (step.number === currentStep) return;
    if (step.number > 1) {
      toast.info('Selesaikan tahap sebelumnya terlebih dahulu.');
      return;
    }
    if (onStepClick) {
      onStepClick(step.number);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[820px] flex items-center justify-between">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.number < currentStep;
            const isLocked = step.number > currentStep;

            return (
              <React.Fragment key={step.number}>
                {/* Step Item */}
                <button
                  type="button"
                  onClick={() => handleStepClick(step)}
                  className={`flex items-start gap-3 p-2 rounded-xl text-left transition-all relative group cursor-pointer ${
                    isActive
                      ? 'bg-slate-50'
                      : isCompleted
                      ? 'hover:bg-slate-50/70'
                      : 'opacity-70 hover:opacity-90'
                  }`}
                >
                  {/* Step Number Badge */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors shadow-2xs ${
                      isActive
                        ? 'bg-slate-900 text-white ring-4 ring-slate-900/10'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </div>

                  {/* Step Labels */}
                  <div className="min-w-0 pr-1">
                    <div
                      className={`text-xs font-bold leading-snug tracking-tight ${
                        isActive
                          ? 'text-slate-900'
                          : isCompleted
                          ? 'text-slate-800'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.title}
                    </div>
                    <div className="text-3xs text-slate-400 mt-0.5 truncate max-w-[130px]">
                      {step.subtitle}
                    </div>
                  </div>

                  {/* Active Indicator Underline */}
                  {isActive && (
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-slate-900 rounded-full" />
                  )}
                </button>

                {/* Arrow Separator */}
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="px-1 text-slate-300 shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
