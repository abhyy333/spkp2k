import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Filter, Search, Calendar as CalendarIcon, Info } from 'lucide-react';
import { AppleScheduleCard, AppleScheduleCardData } from './AppleScheduleCard';
import { cn, timeToMinute, minuteToTime } from '../../lib/utils';
import { getSessionDefinitions } from '../../lib/academicTimeProfile';

export interface DayLaneEntry extends AppleScheduleCardData {
  laneIndex: number;
}

export interface DayLaneData {
  num: number;
  name: string;
  dateObj: Date;
  dateStr?: string;
  laneCount: number;
  startCol: number;
  entriesWithLanes: DayLaneEntry[];
  rawCount: number;
}

export interface StandardSession {
  num: number;
  startMinute: number;
  endMinute: number;
  label: string;
  isBreak?: boolean;
}

interface AppleWeeklyCalendarProps {
  title?: string;
  subtitle?: string;
  entries: AppleScheduleCardData[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onSelectEntry?: (entry: AppleScheduleCardData) => void;
  onResetThisWeek?: () => void;
  actions?: React.ReactNode;
  filterControls?: React.ReactNode;
}

export const AppleWeeklyCalendar: React.FC<AppleWeeklyCalendarProps> = React.memo(({
  title = 'Jadwal Kuliah',
  subtitle = 'Kelola dan lihat jadwal perkuliahan Anda dengan mudah.',
  entries,
  selectedDate,
  onSelectDate,
  onSelectEntry,
  onResetThisWeek,
  actions,
  filterControls,
}) => {
  // Indonesian month names
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
  ];

  // Calculate Monday of the selected week
  const mondayDate = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  }, [selectedDate]);

  // Generate 5 days (Senin s/d Jumat) with exact dates
  const weekDays = useMemo(() => {
    const names = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    return names.map((name, i) => {
      const dateObj = new Date(mondayDate);
      dateObj.setDate(mondayDate.getDate() + i);
      const dayNum = i + 1;
      const formattedDate = `${dateObj.getDate()} ${monthNames[dateObj.getMonth()]}`;
      return {
        num: dayNum,
        name,
        dateObj,
        formattedDate,
      };
    });
  }, [mondayDate]);

  // Week header range label: e.g. "20 – 24 Mei 2024"
  const weekRangeLabel = useMemo(() => {
    const fridayDate = new Date(mondayDate);
    fridayDate.setDate(mondayDate.getDate() + 4);

    const mDay = mondayDate.getDate();
    const fDay = fridayDate.getDate();
    const mMonth = monthNames[mondayDate.getMonth()];
    const fMonth = monthNames[fridayDate.getMonth()];
    const year = fridayDate.getFullYear();

    if (mondayDate.getMonth() === fridayDate.getMonth()) {
      return `${mDay} – ${fDay} ${fMonth} ${year}`;
    }
    return `${mDay} ${mMonth} – ${fDay} ${fMonth} ${year}`;
  }, [mondayDate]);

  // Prev / Next Week handlers
  const handlePrevWeek = () => {
    const prev = new Date(selectedDate);
    prev.setDate(selectedDate.getDate() - 7);
    onSelectDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(selectedDate.getDate() + 7);
    onSelectDate(next);
  };

  // Detect if entries belong to Ramadan time profile
  const isRamadan = useMemo(() => {
    return entries.some((e) => {
      const minPerSess = e.raw?.minutes_per_session;
      const timeProf = e.raw?.time_profile;
      const startMin = e.raw?.start_minute;
      return minPerSess === 40 || timeProf === 'RAMADAN' || startMin === 480;
    });
  }, [entries]);

  // Official sessions & breaks matching the active profile
  const sessions: StandardSession[] = useMemo(() => {
    const rawSessions = getSessionDefinitions(isRamadan ? 'RAMADAN' : 'NORMAL');
    return rawSessions.map((s) => ({
      num: s.sessionNumber,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
      label: s.startTime.replace(':', '.'),
      isBreak: s.isBreak,
    }));
  }, [isRamadan]);

  // Helper to extract start and end minute
  const getEntryMinutes = (entry: AppleScheduleCardData) => {
    let startMinute = 470;
    if (entry.raw?.start_minute !== undefined) {
      startMinute = entry.raw.start_minute;
    } else if (entry.start_time) {
      startMinute = timeToMinute(entry.start_time);
    }

    let endMinute = startMinute + 150;
    if (entry.raw?.end_minute !== undefined) {
      endMinute = entry.raw.end_minute;
    } else if (entry.end_time) {
      endMinute = timeToMinute(entry.end_time);
    }

    if (endMinute <= startMinute) {
      endMinute = startMinute + 100;
    }

    return { startMinute, endMinute };
  };

  // Helper to get grid start row and span
  const getSlotRowAndSpan = (entry: AppleScheduleCardData) => {
    const { startMinute, endMinute } = getEntryMinutes(entry);

    // Find nearest session
    const idx = sessions.findIndex((s) => !s.isBreak && Math.abs(s.startMinute - startMinute) <= 20);
    const startRow = idx !== -1 ? idx + 2 : 2;

    // Calculate row span
    let durationMin = endMinute - startMinute;
    if (entry.sks) {
      durationMin = entry.sks * 50;
    }
    const span = Math.max(1, Math.round(durationMin / 50));

    return { startRow, span };
  };

  // Multi-Lane Parallel Assignment per Day
  const dayLanesData: DayLaneData[] = useMemo(() => {
    let currentColumnStart = 2; // Col 1 is Time column

    return weekDays.map((day) => {
      // Filter entries for this day
      const dayEntries = entries.filter((e) => {
        const rawDay = e.raw?.day_of_week ?? e.raw?.day;
        if (typeof rawDay === 'number') {
          return rawDay === day.num;
        }
        if (typeof rawDay === 'string') {
          return rawDay.toLowerCase() === day.name.toLowerCase();
        }
        return false;
      });

      // Sort by startMinute ASC
      const sorted = [...dayEntries].sort((a, b) => {
        const aMin = getEntryMinutes(a);
        const bMin = getEntryMinutes(b);
        return aMin.startMinute - bMin.startMinute || aMin.endMinute - bMin.endMinute;
      });

      // Assign lanes
      const laneEndTimes: number[] = [];
      const entriesWithLanes: DayLaneEntry[] = sorted.map((entry) => {
        const { startMinute, endMinute } = getEntryMinutes(entry);

        let laneIndex = laneEndTimes.findIndex((endTime) => endTime <= startMinute);
        if (laneIndex === -1) {
          laneIndex = laneEndTimes.length;
          laneEndTimes.push(endMinute);
        } else {
          laneEndTimes[laneIndex] = endMinute;
        }

        return {
          ...entry,
          laneIndex,
        };
      });

      const laneCount = Math.max(1, laneEndTimes.length);
      const startCol = currentColumnStart;
      currentColumnStart += laneCount;

      return {
        num: day.num,
        name: day.name,
        dateObj: day.dateObj,
        dateStr: day.formattedDate,
        laneCount,
        startCol,
        entriesWithLanes,
        rawCount: dayEntries.length,
      };
    });
  }, [weekDays, entries]);

  const totalLaneColumns = useMemo(() => {
    return dayLanesData.reduce((acc, d) => acc + d.laneCount, 0);
  }, [dayLanesData]);

  // Mobile day selection (< md screens)
  const activeDayNum = useMemo(() => {
    const d = selectedDate.getDay();
    return d >= 1 && d <= 5 ? d : 1;
  }, [selectedDate]);

  const [mobileActiveDay, setMobileActiveDay] = React.useState<number>(activeDayNum);

  React.useEffect(() => {
    setMobileActiveDay(activeDayNum);
  }, [activeDayNum]);

  const mobileDayData = useMemo(() => {
    return dayLanesData.find((d) => d.num === mobileActiveDay) || dayLanesData[0];
  }, [dayLanesData, mobileActiveDay]);

  return (
    <div
      className="p-6 sm:p-7 shadow-[0_4px_16px_rgba(15,23,42,0.05)] space-y-6 calendar-containment"
      style={{
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(14px) saturate(130%)',
        WebkitBackdropFilter: 'blur(14px) saturate(130%)',
        border: '1px solid rgba(255, 255, 255, 0.85)',
        borderRadius: '28px',
        contain: 'layout paint',
      }}
    >
      {/* Top Header Row matching Reference */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Subtitle */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Right Navigation & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {actions}

          {/* Week Date Range Selector `< [ 20 - 24 Mei 2024 ] >` */}
          <div
            className="flex items-center gap-1.5 p-1 rounded-2xl border"
            style={{
              background: 'rgba(255, 255, 255, 0.75)',
              borderColor: 'rgba(226, 232, 240, 0.8)',
            }}
          >
            <button
              type="button"
              onClick={handlePrevWeek}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Minggu Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-800 select-none">
              <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>{weekRangeLabel}</span>
            </div>

            <button
              type="button"
              onClick={handleNextWeek}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Minggu Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Minggu Ini button */}
          {onResetThisWeek && (
            <button
              type="button"
              onClick={onResetThisWeek}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              Minggu Ini
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar if provided */}
      {filterControls && (
        <div className="pt-2 border-t border-slate-100/80">
          {filterControls}
        </div>
      )}

      {/* Mobile Day Selector Bar (Visible only on < md) */}
      <div className="flex md:hidden items-center justify-between gap-1 p-1 bg-slate-100/80 rounded-2xl">
        {weekDays.map((d) => {
          const isAct = d.num === mobileActiveDay;
          return (
            <button
              key={`mob-day-btn-${d.num}`}
              type="button"
              onClick={() => {
                setMobileActiveDay(d.num);
                onSelectDate(d.dateObj);
              }}
              className={cn(
                'flex-1 py-1.5 px-1 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer select-none',
                isAct
                  ? 'bg-white text-blue-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <span>{d.name.slice(0, 3)}</span>{' '}
              <span className="text-3xs text-slate-400">({d.dateObj.getDate()})</span>
            </button>
          );
        })}
      </div>

      {/* Mobile Day View: Lightweight Event Cards List (Visible only on < md) */}
      <div className="block md:hidden">
        {mobileDayData && mobileDayData.entriesWithLanes.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2 bg-slate-50/50 rounded-2xl border border-slate-100">
            <CalendarIcon className="w-6 h-6 mx-auto text-slate-300" />
            <p className="text-xs font-medium">Tidak ada perkuliahan pada hari {mobileDayData?.name || 'ini'}.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {mobileDayData?.entriesWithLanes.map((item) => (
              <AppleScheduleCard
                key={`mob-card-${item.id}`}
                data={item}
                onClick={() => onSelectEntry && onSelectEntry(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop Weekly Calendar Grid (Hidden on mobile < md) */}
      <div className="hidden md:block overflow-x-auto pb-2">
        <div
          className="min-w-[800px] grid"
          style={{
            gridTemplateColumns: `64px repeat(${totalLaneColumns}, minmax(130px, 1fr))`,
            gridTemplateRows: `48px repeat(${sessions.length}, minmax(44px, auto))`,
          }}
        >
          {/* Top-Left Empty Header Cell */}
          <div
            className="sticky top-0 z-30 flex items-center justify-center border-b border-slate-200/60"
            style={{
              gridColumn: 1,
              gridRow: 1,
              background: 'rgba(255, 255, 255, 0.85)',
            }}
          />

          {/* Day Headers (Senin, Selasa, etc. with exact dates and blue circle on active day) */}
          {dayLanesData.map((day) => {
            const isSelected =
              selectedDate.getFullYear() === day.dateObj.getFullYear() &&
              selectedDate.getMonth() === day.dateObj.getMonth() &&
              selectedDate.getDate() === day.dateObj.getDate();

            const isToday = (() => {
              const now = new Date();
              return (
                now.getFullYear() === day.dateObj.getFullYear() &&
                now.getMonth() === day.dateObj.getMonth() &&
                now.getDate() === day.dateObj.getDate()
              );
            })();

            return (
              <div
                key={`day-header-${day.name}`}
                onClick={() => onSelectDate(day.dateObj)}
                role="button"
                tabIndex={0}
                className={cn(
                  'sticky top-0 z-30 p-2 sm:p-2.5 flex flex-col items-center justify-center text-center border-b border-slate-200/60 cursor-pointer transition-colors group select-none',
                  isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'
                )}
                style={{
                  gridColumn: `${day.startCol} / span ${day.laneCount}`,
                  gridRow: 1,
                  background: isSelected ? 'rgba(239, 246, 255, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                }}
              >
                <span
                  className={cn(
                    'text-3xs font-bold uppercase tracking-wider transition-colors',
                    isSelected ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'
                  )}
                >
                  {day.name}
                </span>

                <div className="mt-1 flex items-center justify-center">
                  <span
                    className={cn(
                      'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all',
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30 ring-2 ring-blue-400/20'
                        : isToday
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-800 group-hover:bg-slate-100'
                    )}
                  >
                    {day.dateObj.getDate()}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Grid Rows: Time labels, Horizontal dividers, Break rows */}
          {sessions.map((session, sIdx) => {
            const rowNum = sIdx + 2;

            if (session.isBreak) {
              return (
                <React.Fragment key={`break-row-${session.startMinute}`}>
                  {/* Break Time Label */}
                  <div
                    className="flex items-center justify-center font-mono text-3xs font-semibold text-slate-400 border-b border-dashed border-slate-200/60 pr-2"
                    style={{
                      gridColumn: 1,
                      gridRow: rowNum,
                    }}
                  >
                    {session.label}
                  </div>

                  {/* Horizontal Shaded Break Strip */}
                  <div
                    className="flex items-center justify-center text-4xs font-bold uppercase tracking-wider text-slate-400 border-b border-dashed border-slate-200/60 select-none"
                    style={{
                      gridColumn: `2 / span ${totalLaneColumns}`,
                      gridRow: rowNum,
                      background: 'rgba(148, 163, 184, 0.07)',
                    }}
                  >
                    ISTIRAHAT
                  </div>
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={`session-row-${session.num}`}>
                {/* Time Label on Left */}
                <div
                  className="flex items-start justify-center pt-2 font-mono text-3xs font-semibold text-slate-400 border-b border-dashed border-slate-200/60 pr-2 select-none"
                  style={{
                    gridColumn: 1,
                    gridRow: rowNum,
                  }}
                >
                  {session.label}
                </div>

                {/* Day lane background cells with dashed dividers */}
                {dayLanesData.map((day) => {
                  return Array.from({ length: day.laneCount }).map((_, lIdx) => {
                    const colNum = day.startCol + lIdx;
                    const isLastLaneOfDay = lIdx === day.laneCount - 1;

                    return (
                      <div
                        key={`bg-cell-s${session.num}-d${day.name}-l${lIdx}`}
                        className={cn(
                          'border-b border-dashed border-slate-200/50',
                          isLastLaneOfDay
                            ? 'border-r border-slate-200/70'
                            : 'border-r border-dashed border-slate-200/35'
                        )}
                        style={{
                          gridColumn: colNum,
                          gridRow: rowNum,
                        }}
                      />
                    );
                  });
                })}
              </React.Fragment>
            );
          })}

          {/* Schedule Event Cards placed on the grid */}
          {dayLanesData.flatMap((day) =>
            day.entriesWithLanes.map((item) => {
              const { startRow, span } = getSlotRowAndSpan(item);
              const cardCol = day.startCol + item.laneIndex;

              return (
                <div
                  key={item.id}
                  style={{
                    gridColumn: cardCol,
                    gridRow: `${startRow} / span ${span}`,
                    padding: '3px 4px',
                    zIndex: 10,
                  }}
                >
                  <AppleScheduleCard
                    data={item}
                    onClick={() => onSelectEntry && onSelectEntry(item)}
                    style={{ height: '100%' }}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});
