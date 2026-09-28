import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBgColor?: string; // e.g. 'bg-blue-50 text-blue-600'
  trend?: {
    text: string;
    type?: 'positive' | 'negative' | 'neutral' | 'warning';
  };
  subtitle?: string;
  progressBar?: {
    percentage: number;
    color?: string;
  };
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  iconBgColor = 'bg-blue-50 text-blue-600',
  trend,
  subtitle,
  progressBar,
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs transition-all hover:shadow-sm',
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-slate-100',
            iconBgColor
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 truncate">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
            {trend && (
              <span
                className={cn(
                  'text-xs font-semibold px-1.5 py-0.5 rounded',
                  trend.type === 'positive' && 'text-emerald-700 bg-emerald-50',
                  trend.type === 'negative' && 'text-rose-700 bg-rose-50',
                  trend.type === 'warning' && 'text-amber-700 bg-amber-50',
                  (!trend.type || trend.type === 'neutral') && 'text-slate-600 bg-slate-50'
                )}
              >
                {trend.text}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>
          )}

          {progressBar && (
            <div className="mt-2.5">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-500',
                    progressBar.color || 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, progressBar.percentage))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
