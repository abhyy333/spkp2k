import React from 'react';
import {
  BookOpen,
  Users,
  UserCheck,
  CalendarDays,
  Sparkles,
  Send,
  CheckCircle2,
} from 'lucide-react';

export interface StepItem {
  id: number;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

export const WORKFLOW_STEPS: StepItem[] = [
  {
    id: 1,
    label: '1. Pemilihan Mata Kuliah',
    sublabel: 'Template & Kelas',
    icon: BookOpen,
  },
  {
    id: 2,
    label: '2. Pembagian Rombel',
    sublabel: 'Review Kelas & Peserta',
    icon: Users,
  },
  {
    id: 3,
    label: '3. Penugasan Dosen',
    sublabel: 'Alokasi Master Dosen',
    icon: UserCheck,
  },
  {
    id: 4,
    label: '4. Generate Jadwal Awal',
    sublabel: 'Ruangan & Waktu',
    icon: CalendarDays,
  },
  {
    id: 5,
    label: '5. Optimasi Simulated Annealing',
    sublabel: 'Eliminasi Bentrok',
    icon: Sparkles,
  },
  {
    id: 6,
    label: '6. Preview & Publikasi',
    sublabel: 'Matriks & Terbitkan',
    icon: Send,
  },
];

interface WorkflowStepperProps {
  currentStep: number;
  maxVisitedStep: number;
  onStepClick: (stepId: number) => void;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentStep,
  maxVisitedStep,
  onStepClick,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs overflow-x-auto">
      <div className="flex items-center justify-between min-w-[760px] gap-2">
        {WORKFLOW_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isCurrent = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          const isClickable = step.id <= maxVisitedStep;

          return (
            <React.Fragment key={step.id}>
              {/* Step Button */}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => onStepClick(step.id)}
                className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-left transition-all shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-50/80 border-2 border-blue-600 shadow-2xs'
                    : isCompleted
                    ? 'bg-emerald-50/40 border border-emerald-200 hover:bg-emerald-50 text-slate-800'
                    : isClickable
                    ? 'bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700'
                    : 'bg-slate-50/40 border border-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                }`}
              >
                {/* Step Circle / Checkmark */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                {/* Step Text */}
                <div className="min-w-0">
                  <p
                    className={`text-xs font-bold truncate leading-tight ${
                      isCurrent
                        ? 'text-blue-700'
                        : isCompleted
                        ? 'text-slate-800'
                        : 'text-slate-600'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-3xs text-slate-400 truncate mt-0.5">
                    {step.sublabel}
                  </p>
                </div>
              </button>

              {/* Connector Line */}
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 min-w-[16px] rounded transition-colors ${
                    currentStep > step.id ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
