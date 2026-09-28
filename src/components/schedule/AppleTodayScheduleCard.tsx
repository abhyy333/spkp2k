import React from 'react';
import { MapPin, MoreVertical, Calendar, Clock } from 'lucide-react';
import { AppleScheduleCardData, getAppleTheme } from './AppleScheduleCard';
import { cn } from '../../lib/utils';

interface AppleTodayScheduleCardProps {
  entries: AppleScheduleCardData[];
  dateString: string;
  onSeeAll?: () => void;
  onSelectEntry?: (entry: AppleScheduleCardData) => void;
}

export const AppleTodayScheduleCard: React.FC<AppleTodayScheduleCardProps> = React.memo(({
  entries,
  dateString,
  onSeeAll,
  onSelectEntry,
}) => {
  return (
    <div
      className="p-5 shadow-[0_4px_16px_rgba(15,23,42,0.04)] space-y-4"
      style={{
        background: 'rgba(255, 255, 255, 0.88)',
        border: '1px solid rgba(255, 255, 255, 0.90)',
        borderRadius: '24px',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Jadwal Hari Ini
          </h3>
          <p className="text-2xs text-slate-400 font-medium mt-0.5">
            {dateString}
          </p>
        </div>

        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="px-2.5 py-1 rounded-full text-2xs font-semibold text-blue-600 bg-blue-50/80 hover:bg-blue-100/70 border border-blue-200/50 transition-colors cursor-pointer"
          >
            Lihat Semua
          </button>
        )}
      </div>

      {/* List of Entries */}
      <div className="space-y-2.5">
        {entries.length === 0 ? (
          <div className="py-6 text-center text-slate-400 space-y-2">
            <div className="w-9 h-9 mx-auto rounded-full bg-slate-100/80 flex items-center justify-center text-slate-400">
              <Calendar className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium">Tidak ada perkuliahan pada hari ini.</p>
          </div>
        ) : (
          entries.map((item) => {
            const theme = getAppleTheme(
              item.course_code || item.course_name || item.id,
              item.isConflict
            );

            const lecturerName = Array.isArray(item.lecturer_names)
              ? item.lecturer_names.join(', ')
              : item.lecturer_names || 'Dosen Pengampu';

            return (
              <div
                key={item.id}
                onClick={() => onSelectEntry && onSelectEntry(item)}
                className={cn(
                  'group p-3 rounded-2xl border transition-all duration-150 flex items-center gap-3 cursor-pointer select-none',
                  'hover:shadow-xs hover:border-slate-300/80 active:scale-[0.99]'
                )}
                style={{
                  background: 'rgba(255, 255, 255, 0.65)',
                  borderColor: 'rgba(226, 232, 240, 0.7)',
                }}
              >
                {/* Time stacked column */}
                <div className="flex flex-col items-center justify-center font-mono text-2xs text-slate-600 w-11 shrink-0 font-medium leading-tight">
                  <span>{item.start_time.replace(':', '.')}</span>
                  <span className="text-slate-400 text-3xs my-0.5">•</span>
                  <span>{item.end_time.replace(':', '.')}</span>
                </div>

                {/* Vertical colored accent line */}
                <div
                  className="w-1 h-9 rounded-full shrink-0"
                  style={{ backgroundColor: theme.accent }}
                />

                {/* Course, Room, Lecturer */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-900 transition-colors">
                      {item.course_name}
                    </h4>
                    {item.class_name && (
                      <span className="text-4xs font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                        {item.class_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-2xs font-semibold text-slate-700 mt-1">
                    <MapPin
                      className="w-3 h-3 shrink-0"
                      style={{ color: theme.pin }}
                    />
                    <span className="truncate">{item.room_code || item.room_name || 'R. Teori'}</span>
                  </div>

                  <div className="text-3xs text-slate-400 font-medium truncate mt-0.5">
                    {lecturerName}
                  </div>
                </div>

                {/* More icon */}
                <button
                  type="button"
                  className="text-slate-300 group-hover:text-slate-600 transition-colors p-1"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
