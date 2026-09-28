import React from 'react';
import { MapPin, MoreVertical, Clock, UserCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AppleScheduleCardData {
  id: string;
  course_name: string;
  course_code?: string;
  class_name?: string;
  start_time: string;
  end_time: string;
  room_code?: string;
  room_name?: string;
  lecturer_names?: string[] | string;
  sks?: number;
  isConflict?: boolean;
  conflictReason?: string;
  raw?: any;
}

export interface AppleScheduleCardTheme {
  bg: string;
  border: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
  text: string;
  pin: string;
}

export function getAppleTheme(seed: string, isConflict?: boolean): AppleScheduleCardTheme {
  if (isConflict) {
    return {
      bg: 'rgba(255, 241, 242, 0.95)',
      border: 'rgba(254, 205, 211, 0.90)',
      accent: '#F43F5E',
      badgeBg: 'rgba(244, 63, 94, 0.15)',
      badgeText: '#BE123C',
      text: '#1E293B',
      pin: '#F43F5E',
    };
  }

  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const themes: AppleScheduleCardTheme[] = [
    // Blue (e.g. Sistem Kendali)
    {
      bg: 'rgba(239, 246, 255, 0.94)',
      border: 'rgba(191, 219, 254, 0.85)',
      accent: '#3B82F6',
      badgeBg: 'rgba(59, 130, 246, 0.12)',
      badgeText: '#1D4ED8',
      text: '#1E293B',
      pin: '#3B82F6',
    },
    // Warm Amber / Peach (e.g. Pengolahan Citra)
    {
      bg: 'rgba(254, 247, 236, 0.94)',
      border: 'rgba(253, 230, 138, 0.85)',
      accent: '#F59E0B',
      badgeBg: 'rgba(245, 158, 11, 0.12)',
      badgeText: '#B45309',
      text: '#1E293B',
      pin: '#F59E0B',
    },
    // Emerald / Soft Green (e.g. Antena)
    {
      bg: 'rgba(238, 250, 243, 0.94)',
      border: 'rgba(167, 243, 208, 0.85)',
      accent: '#10B981',
      badgeBg: 'rgba(16, 185, 129, 0.12)',
      badgeText: '#047857',
      text: '#1E293B',
      pin: '#10B981',
    },
    // Soft Purple / Lavender (e.g. Rekayasa Trafik)
    {
      bg: 'rgba(245, 240, 255, 0.94)',
      border: 'rgba(221, 214, 254, 0.85)',
      accent: '#8B5CF6',
      badgeBg: 'rgba(139, 92, 246, 0.12)',
      badgeText: '#6D28D9',
      text: '#1E293B',
      pin: '#8B5CF6',
    },
  ];

  return themes[hash % themes.length];
}

interface AppleScheduleCardProps {
  data: AppleScheduleCardData;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  showClassBadge?: boolean;
}

export const AppleScheduleCard: React.FC<AppleScheduleCardProps> = React.memo(({
  data,
  onClick,
  style,
  className,
  showClassBadge = true,
}) => {
  const theme = getAppleTheme(
    data.course_code || data.course_name || data.id,
    data.isConflict
  );

  const lecturerName = Array.isArray(data.lecturer_names)
    ? data.lecturer_names.join(', ')
    : data.lecturer_names || 'Dosen Pengampu';

  const roomDisplay = data.room_code || data.room_name || 'R. Teori';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={cn(
        'group relative z-10 flex flex-col justify-between overflow-hidden cursor-pointer select-none',
        'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
        className
      )}
      style={{
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
        borderRadius: '14px',
        padding: '9px 11px',
        contain: 'paint',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        ...style,
      }}
    >
      {/* 4px Left Accent Colored Line */}
      <div
        className="absolute left-0 top-0 bottom-0 rounded-l-md"
        style={{
          width: '3.5px',
          backgroundColor: theme.accent,
        }}
      />

      {/* Top Header: Course Name, Class Pill & More Button */}
      <div className="pl-1">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <h4
              className="text-xs font-bold leading-snug tracking-tight text-slate-900 group-hover:text-blue-900 transition-colors line-clamp-2"
              title={data.course_name}
            >
              {data.course_name}
            </h4>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {showClassBadge && data.class_name && (
              <span
                className="px-1.5 py-0.5 rounded-full text-4xs font-extrabold uppercase tracking-wide shrink-0"
                style={{
                  backgroundColor: theme.badgeBg,
                  color: theme.badgeText,
                }}
              >
                {data.class_name}
              </span>
            )}
            <button
              type="button"
              className="text-slate-400 group-hover:text-slate-600 transition-colors p-0.5 rounded-md hover:bg-black/5"
              onClick={(e) => {
                e.stopPropagation();
                if (onClick) onClick();
              }}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Time formatted cleanly */}
        <div className="text-2xs font-mono font-medium text-slate-500 mt-1 flex items-center gap-1">
          <span>
            {data.start_time.replace(':', '.')} – {data.end_time.replace(':', '.')}
          </span>
          {data.sks && (
            <span className="text-4xs font-sans text-slate-400 font-semibold">
              ({data.sks} SKS)
            </span>
          )}
        </div>
      </div>

      {/* Bottom Section: Room and Lecturer */}
      <div className="pl-1 mt-2 pt-1.5 border-t border-black/5 text-2xs space-y-1">
        {/* Room with Pin */}
        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
          <MapPin
            className="w-3 h-3 shrink-0"
            style={{ color: theme.pin }}
          />
          <span className="truncate">{roomDisplay}</span>
        </div>

        {/* Lecturer Name */}
        <div className="text-slate-500 text-3xs truncate font-medium">
          {lecturerName}
        </div>

        {/* Conflict Warning Indicator if present */}
        {data.isConflict && (
          <div className="pt-0.5 flex items-center gap-1 text-rose-700 font-bold text-4xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>{data.conflictReason || 'Bentrok'}</span>
          </div>
        )}
      </div>
    </div>
  );
});
