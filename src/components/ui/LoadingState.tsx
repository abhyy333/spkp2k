import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingStateProps {
  message?: string;
  rows?: number;
  type?: 'spinner' | 'skeleton' | 'table-skeleton';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Memuat data...',
  rows = 5,
  type = 'skeleton',
  className,
}) => {
  if (type === 'spinner') {
    return (
      <div className={cn('flex flex-col items-center justify-center p-12 text-center', className)}>
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">{message}</p>
      </div>
    );
  }

  if (type === 'table-skeleton') {
    return (
      <div className={cn('w-full bg-white rounded-xl border border-slate-200 p-4 space-y-3', className)}>
        <div className="h-9 bg-slate-100 rounded-lg animate-pulse w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center py-2 border-b border-slate-100 last:border-0">
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/6" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-2/6" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/6" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/6" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/6" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('w-full space-y-3 p-4', className)}>
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        <span className="text-xs font-medium text-slate-500">{message}</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse w-full" />
      ))}
    </div>
  );
};
