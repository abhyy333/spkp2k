import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant =
  | 'wajib'
  | 'pilihan'
  | 'aktif'
  | 'nonaktif'
  | 'cuti'
  | 'terjadwal'
  | 'bentrok'
  | 'kritis'
  | 'tinggi'
  | 'sedang'
  | 'rendah'
  | 'terbit'
  | 'ditarik'
  | 'versi-lama'
  | 'draft'
  | 'tersedia'
  | 'terbatas'
  | 'tidak-tersedia'
  | 'reguler'
  | 'default';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  showDot?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant,
  showDot = false,
  className,
  size = 'md',
}) => {
  // Infer variant if not provided
  let computedVariant: BadgeVariant = variant || 'default';
  if (!variant) {
    const l = label.toLowerCase();
    if (l === 'wajib') computedVariant = 'wajib';
    else if (l === 'pilihan') computedVariant = 'pilihan';
    else if (l === 'aktif' || l === 'terjadwal' || l === 'tersedia' || l === 'diterbitkan') computedVariant = 'aktif';
    else if (l === 'ditarik' || l === 'withdrawn') computedVariant = 'ditarik';
    else if (l === 'versi lama' || l === 'versi-lama' || l === 'tergantikan' || l === 'diarsipkan' || l === 'archived' || l === 'replaced') computedVariant = 'versi-lama';
    else if (l === 'nonaktif' || l === 'cuti') computedVariant = 'nonaktif';
    else if (l === 'bentrok' || l === 'kritis') computedVariant = 'kritis';
    else if (l === 'tinggi') computedVariant = 'tinggi';
    else if (l === 'sedang') computedVariant = 'sedang';
    else if (l === 'rendah') computedVariant = 'rendah';
    else if (l === 'terbit' || l === 'published') computedVariant = 'terbit';
    else if (l === 'draft') computedVariant = 'draft';
    else if (l === 'terbatas') computedVariant = 'terbatas';
    else if (l === 'tidak tersedia' || l === 'tidak-tersedia') computedVariant = 'tidak-tersedia';
    else if (l === 'reguler') computedVariant = 'reguler';
  }

  const styles: Record<BadgeVariant, { bg: string; text: string; border: string; dot?: string }> = {
    wajib: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      dot: 'bg-blue-600',
    },
    pilihan: {
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
      dot: 'bg-purple-600',
    },
    aktif: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
    },
    terjadwal: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
    },
    tersedia: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
    },
    terbit: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
    },
    ditarik: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800',
      dot: 'bg-rose-500',
    },
    'versi-lama': {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400',
    },
    nonaktif: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800',
      dot: 'bg-rose-500',
    },
    cuti: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
    },
    bentrok: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800',
      dot: 'bg-rose-600',
    },
    kritis: {
      bg: 'bg-rose-100 dark:bg-rose-900/50',
      text: 'text-rose-800 dark:text-rose-200 font-semibold',
      border: 'border-rose-300 dark:border-rose-700',
      dot: 'bg-rose-600',
    },
    tinggi: {
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      text: 'text-orange-700 dark:text-orange-300 font-semibold',
      border: 'border-orange-200 dark:border-orange-800',
      dot: 'bg-orange-500',
    },
    sedang: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-800 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
    },
    rendah: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400',
    },
    draft: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      dot: 'bg-blue-500',
    },
    terbatas: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-800 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
    },
    'tidak-tersedia': {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800',
      dot: 'bg-rose-500',
    },
    reguler: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      dot: 'bg-blue-500',
    },
    default: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400',
    },
  };

  const style = styles[computedVariant] || styles.default;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border transition-colors',
        style.bg,
        style.text,
        style.border,
        sizeClasses,
        className
      )}
    >
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />
      )}
      {label}
    </span>
  );
};
