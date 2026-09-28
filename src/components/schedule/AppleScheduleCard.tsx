import React, { useState } from 'react';
import { MapPin, MoreVertical, Clock, User, Sparkles, Eye } from 'lucide-react';
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
      badgeBg: '#FFE4E6',
      badgeText: '#BE123C',
      text: '#1E293B',
      pin: '#F43F5E',
    };
  }

  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const themes: AppleScheduleCardTheme[] = [
    // Blue (e.g. Fisika Mekanika)
    {
      bg: '#EFF6FF',
      border: '#BFDBFE',
      accent: '#3B82F6',
      badgeBg: '#DBEAFE',
      badgeText: '#1D4ED8',
      text: '#1E293B',
      pin: '#3B82F6',
    },
    // Warm Amber (e.g. Rangkaian Logika, Kimia)
    {
      bg: '#FEF3C7',
      border: '#FDE68A',
      accent: '#F59E0B',
      badgeBg: '#FDE68A',
      badgeText: '#B45309',
      text: '#1E293B',
      pin: '#F59E0B',
    },
    // Emerald / Soft Green (e.g. Agama)
    {
      bg: '#ECFDF5',
      border: '#A7F3D0',
      accent: '#10B981',
      badgeBg: '#D1FAE5',
      badgeText: '#047857',
      text: '#1E293B',
      pin: '#10B981',
    },
    // Soft Purple / Lavender (e.g. Fisika Listrik, Pancasila)
    {
      bg: '#F3E8FF',
      border: '#DDD6FE',
      accent: '#8B5CF6',
      badgeBg: '#E9D5FF',
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
  onReschedule?: (data: AppleScheduleCardData) => void;
  style?: React.CSSProperties;
  className?: string;
  showClassBadge?: boolean;
}

export const AppleScheduleCard: React.FC<AppleScheduleCardProps> = React.memo(({
  data,
  onClick,
  onReschedule,
  style,
  className,
  showClassBadge = true,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const theme = getAppleTheme(
    data.course_code || data.course_name || data.id,
    data.isConflict
  );

  const lecturerName = Array.isArray(data.lecturer_names)
    ? data.lecturer_names.join(', ')
    : data.lecturer_names || 'Dosen Pengampu';

  const roomDisplay = data.room_code || data.room_name || 'Ruang Kuliah';
  const startTimeDisplay = (data.start_time || '08:00').replace(':', '.');
  const endTimeDisplay = (data.end_time || '09:40').replace(':', '.');

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={cn(
        'group relative z-10 flex flex-col justify-between overflow-visible cursor-pointer select-none rounded-xl border border-l-4 transition-all duration-150',
        'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
        className
      )}
      style={{
        backgroundColor: theme.bg,
        borderColor: theme.border,
        borderLeftColor: theme.accent,
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        padding: '10px 12px',
        ...style,
      }}
    >
      {/* Top Header: Course Name, Class Badge & Action Menu */}
      <div>
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
          <h4
            className="text-xs font-bold leading-snug tracking-tight text-slate-900 group-hover:text-blue-950 transition-colors line-clamp-2"
            title={data.course_name}
          >
            {data.course_name}
          </h4>

          <div className="flex items-center gap-1 shrink-0 relative">
            {showClassBadge && (data.class_name || 'A') && (
              <span
                className="px-2 py-0.5 rounded-md text-3xs font-extrabold uppercase tracking-wide shrink-0 shadow-2xs"
                style={{
                  backgroundColor: theme.badgeBg,
                  color: theme.badgeText,
                }}
              >
                {data.class_name || 'A'}
              </span>
            )}
            
            <button
              type="button"
              className="text-slate-400 group-hover:text-slate-700 transition-colors p-0.5 rounded-md hover:bg-black/5 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              title="Opsi Jadwal"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div
                className="absolute right-0 top-6 z-50 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 text-xs animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    if (onClick) onClick();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Detail Jadwal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    if (onReschedule) {
                      onReschedule(data);
                    } else if (onClick) {
                      onClick();
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-purple-950/30 flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Smart Reschedule</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Line 1: Clock Icon + Time & SKS */}
        <div className="flex items-center gap-1.5 text-3xs font-medium text-slate-600 mb-1">
          <Clock className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="font-mono font-semibold text-slate-800">
            {startTimeDisplay} – {endTimeDisplay}
          </span>
          <span className="text-slate-500">
            ({data.sks || 3} SKS)
          </span>
        </div>

        {/* Line 2: Room Icon + Room Name */}
        <div className="flex items-center gap-1.5 text-3xs font-semibold text-slate-700 mb-1">
          <MapPin
            className="w-3 h-3 shrink-0"
            style={{ color: theme.pin }}
          />
          <span className="truncate">{roomDisplay}</span>
        </div>

        {/* Line 3: User Icon + Lecturer Name */}
        <div className="flex items-center gap-1.5 text-3xs text-slate-600 font-medium">
          <User className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate" title={lecturerName}>{lecturerName}</span>
        </div>
      </div>

      {/* Conflict Warning Indicator if present */}
      {data.isConflict && (
        <div className="mt-1.5 pt-1 border-t border-rose-200/80 flex items-center gap-1 text-rose-700 font-bold text-4xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span>{data.conflictReason || 'Bentrok'}</span>
        </div>
      )}
    </div>
  );
});
