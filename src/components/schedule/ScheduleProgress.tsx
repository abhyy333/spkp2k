import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

interface ScheduleProgressProps {
  scheduledCount: number;
  totalOfferings: number;
}

export const ScheduleProgress: React.FC<ScheduleProgressProps> = ({
  scheduledCount,
  totalOfferings,
}) => {
  const percentage = totalOfferings > 0 ? Math.round((scheduledCount / totalOfferings) * 100) : 0;
  const unscheduledCount = Math.max(0, totalOfferings - scheduledCount);

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex flex-col text-right">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          <span>{scheduledCount}</span>
          <span className="text-slate-400">/</span>
          <span>{totalOfferings}</span>
          <span className="text-slate-500 font-normal">kelas terjadwal</span>
        </div>
        <div className="text-3xs text-slate-400">
          {unscheduledCount > 0 ? `${unscheduledCount} kelas belum ditempatkan` : 'Semua kelas telah ditempatkan'}
        </div>
      </div>

      <div className="w-24 sm:w-28 flex flex-col gap-1">
        <div className="flex justify-between items-center text-3xs font-medium text-slate-500">
          <span>{percentage}%</span>
          {percentage === 100 ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          ) : (
            <Clock className="w-3 h-3 text-blue-500" />
          )}
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              percentage === 100
                ? 'bg-emerald-500'
                : percentage > 60
                ? 'bg-blue-600'
                : 'bg-amber-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
