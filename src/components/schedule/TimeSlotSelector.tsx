import React from 'react';
import { TimeSlot } from '../../types';
import { minuteToTime } from '../../lib/utils';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TimeSlotSelectorProps {
  dayOfWeek: number;
  onDayChange: (day: number) => void;
  startMinute: number;
  onStartMinuteChange: (minute: number) => void;
  effectiveSks: number;
  activeTimeSlots: TimeSlot[];
  disabled?: boolean;
}

const DAYS = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
];

export const TimeSlotSelector: React.FC<TimeSlotSelectorProps> = ({
  dayOfWeek,
  onDayChange,
  startMinute,
  onStartMinuteChange,
  effectiveSks,
  activeTimeSlots,
  disabled = false,
}) => {
  const duration = effectiveSks * 50;
  const endMinute = startMinute + duration;

  // Active slots for selected day, sorted
  const daySlots = activeTimeSlots
    .filter((s) => Number(s.day_of_week) === Number(dayOfWeek) && s.is_active)
    .sort((a, b) => a.start_minute - b.start_minute);

  // Unique starting minutes available for this day
  const uniqueStarts = Array.from(new Set(daySlots.map((s) => s.start_minute))).sort(
    (a, b) => a - b
  );

  // Validate if starting at startMinute has `effectiveSks` consecutive active slots
  let consecutiveOk = false;
  let count = 0;
  let checkStart = startMinute;
  for (let i = 0; i < effectiveSks; i++) {
    if (daySlots.some((s) => s.start_minute === checkStart)) {
      count++;
      checkStart += 50;
    } else {
      break;
    }
  }
  consecutiveOk = count === effectiveSks;

  return (
    <div className="space-y-4">
      {/* Day Selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Hari Perkuliahan <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {DAYS.map((d) => {
            const isSelected = Number(dayOfWeek) === d.value;
            return (
              <button
                key={d.value}
                type="button"
                disabled={disabled}
                onClick={() => onDayChange(d.value)}
                className={`py-2 px-1 text-center text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Time Selector */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            Waktu Mulai <span className="text-rose-500">*</span>
          </label>
          <span className="text-2xs font-medium text-slate-500">
            Durasi: {effectiveSks} SKS ({duration} menit)
          </span>
        </div>

        <select
          value={startMinute}
          onChange={(e) => onStartMinuteChange(Number(e.target.value))}
          disabled={disabled || uniqueStarts.length === 0}
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          {uniqueStarts.length === 0 && (
            <option value="" disabled>
              Tidak ada slot waktu aktif pada hari ini
            </option>
          )}
          {uniqueStarts.map((min) => {
            const slotEnd = min + duration;
            return (
              <option key={min} value={min}>
                {minuteToTime(min)} (Selesai: {minuteToTime(slotEnd)})
              </option>
            );
          })}
        </select>
      </div>

      {/* Time & Consecutive feedback */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
        <div className="flex items-center justify-between font-mono font-semibold text-slate-800">
          <span className="flex items-center gap-1.5 text-xs text-slate-600 font-sans">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Rentang Waktu:
          </span>
          <span className="text-blue-700">
            {minuteToTime(startMinute)} – {minuteToTime(endMinute)} WITA
          </span>
        </div>

        <div className="pt-1 border-t border-slate-200/60">
          {consecutiveOk ? (
            <div className="flex items-center gap-1.5 text-emerald-700 text-3xs font-medium">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>Tersedia {effectiveSks} slot waktu berurutan secara penuh.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-700 text-3xs font-semibold">
              <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
              <span>Slot waktu tidak tersedia secara berurutan sesuai {effectiveSks} SKS.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
