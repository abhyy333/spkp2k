import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AppleMiniCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  scheduledDayNumbers?: number[]; // Days of the current viewed month that have scheduled events
}

export const AppleMiniCalendar: React.FC<AppleMiniCalendarProps> = React.memo(({
  selectedDate,
  onSelectDate,
  scheduledDayNumbers = [],
}) => {
  // Calendar month view navigation state
  const [viewDate, setViewDate] = useState<Date>(new Date(selectedDate));

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const dayHeaders = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const prevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // First day of current month (0=Sun, 1=Mon, ..., 6=Sat)
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Total days in current month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Total days in previous month
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Days array to render
  const calendarCells: {
    dayNum: number;
    isCurrentMonth: boolean;
    dateObj: Date;
  }[] = [];

  // Trailing previous month days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    calendarCells.push({
      dayNum,
      isCurrentMonth: false,
      dateObj: new Date(year, month - 1, dayNum),
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    calendarCells.push({
      dayNum: d,
      isCurrentMonth: true,
      dateObj: new Date(year, month, d),
    });
  }

  // Leading next month days to fill rows of 7 (up to 35 or 42)
  const remainder = calendarCells.length % 7;
  if (remainder > 0) {
    const needed = 7 - remainder;
    for (let n = 1; n <= needed; n++) {
      calendarCells.push({
        dayNum: n,
        isCurrentMonth: false,
        dateObj: new Date(year, month + 1, n),
      });
    }
  }

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const handleCellClick = (cellDate: Date) => {
    if (!isSameDay(cellDate, selectedDate)) {
      onSelectDate(cellDate);
    }
  };

  return (
    <div
      className="p-5 shadow-[0_4px_16px_rgba(15,23,42,0.04)] space-y-4"
      style={{
        background: 'rgba(255, 255, 255, 0.88)',
        border: '1px solid rgba(255, 255, 255, 0.90)',
        borderRadius: '24px',
      }}
    >
      {/* Month Title & Prev/Next Buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
          {monthNames[month]} {year}
        </h3>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Bulan Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Bulan Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 text-center">
        {dayHeaders.map((dh) => (
          <div
            key={dh}
            className="text-3xs font-semibold text-slate-400 py-1"
          >
            {dh}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {calendarCells.map((cell, idx) => {
          const isSelected = isSameDay(cell.dateObj, selectedDate);
          const hasDot =
            cell.isCurrentMonth &&
            (scheduledDayNumbers.includes(cell.dayNum) || [1, 2, 3, 4, 5].includes(cell.dateObj.getDay()));

          return (
            <div
              key={`cal-cell-${idx}`}
              onClick={() => handleCellClick(cell.dateObj)}
              className="flex flex-col items-center justify-center py-1 cursor-pointer group"
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-full text-xs flex items-center justify-center font-medium transition-all select-none',
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : cell.isCurrentMonth
                    ? 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                    : 'text-slate-300 hover:text-slate-400'
                )}
              >
                {cell.dayNum}
              </div>

              {/* Blue Dot Indicator for Days with Scheduled Classes */}
              <div className="h-1 flex items-center justify-center">
                {hasDot && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-blue-500/80" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
