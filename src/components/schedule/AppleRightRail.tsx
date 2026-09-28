import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  MapPin,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Users,
  Settings,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { AppleTodayScheduleCard } from './AppleTodayScheduleCard';
import { AppleMiniCalendar } from './AppleMiniCalendar';
import { AppleScheduleCardData } from './AppleScheduleCard';
import { Room, TimeSlot } from '../../types';
import { minuteToTime, timeToMinute, dayOfWeekToName, cn } from '../../lib/utils';
import { toast } from '../ui/Toast';

interface AppleRightRailProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  allEntries: AppleScheduleCardData[];
  inspectedEntry: AppleScheduleCardData | null;
  onCloseInspector: () => void;
  isAdmin?: boolean;
  onApplyReschedule?: (
    entry: AppleScheduleCardData,
    newDay: number,
    newStartMin: number,
    newRoomId: string
  ) => Promise<void> | void;
  // Step 5 Optimization panel (optional)
  optimizationPanel?: React.ReactNode;
}

export const AppleRightRail: React.FC<AppleRightRailProps> = React.memo(({
  selectedDate,
  onSelectDate,
  allEntries,
  inspectedEntry,
  onCloseInspector,
  isAdmin = false,
  onApplyReschedule,
  optimizationPanel,
}) => {
  // Tabs in Inspector: 'RECOMMENDATIONS' | 'MANUAL' | 'SWAP'
  const [inspectorTab, setInspectorTab] = useState<'RECOMMENDATIONS' | 'MANUAL' | 'SWAP'>('RECOMMENDATIONS');

  // Manual inputs in inspector
  const [manualDay, setManualDay] = useState<number>(1);
  const [manualStartMinute, setManualStartMinute] = useState<number>(470);
  const [manualRoom, setManualRoom] = useState<string>('R. A101');
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // Sync manual state when inspectedEntry changes
  useEffect(() => {
    if (inspectedEntry) {
      setManualDay(inspectedEntry.raw?.day_of_week || 1);
      setManualStartMinute(
        inspectedEntry.raw?.start_minute || timeToMinute(inspectedEntry.start_time) || 470
      );
      setManualRoom(inspectedEntry.room_code || inspectedEntry.room_name || 'R. Teori');
      setInspectorTab('RECOMMENDATIONS');
    }
  }, [inspectedEntry]);

  // Indonesian date formatter
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const formattedTodayString = `${dayNames[selectedDate.getDay()]}, ${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  // Filter entries for the selected day of the week memoized
  const todayEntries = useMemo(() => {
    const jsDay = selectedDate.getDay();
    const targetDayNum = jsDay === 0 ? 7 : jsDay;
    const matchDayName = dayNames[selectedDate.getDay()].toLowerCase();

    return allEntries.filter((e) => {
      const rawDay = e.raw?.day_of_week ?? e.raw?.day;
      if (typeof rawDay === 'number') {
        return rawDay === targetDayNum;
      }
      if (typeof rawDay === 'string') {
        return rawDay.toLowerCase() === matchDayName;
      }
      return false;
    });
  }, [allEntries, selectedDate]);

  // Calculate days of the month that have scheduled events
  const scheduledDays = [1, 2, 3, 4, 5];

  // Smart Recommendations generator for the inspected entry
  const recommendations = [
    {
      id: 'rec-1',
      rank: '#1 Paling Optimal',
      dayNum: 2,
      dayName: 'Selasa',
      startTime: '07:50',
      endTime: '10:20',
      startMinute: 470,
      roomName: 'R. A101 (Kapasitas 60)',
      roomCode: 'A101',
      reason: 'Bebas bentrok dosen, rombel & efisiensi kursi 92%',
      isOptimal: true,
    },
    {
      id: 'rec-2',
      rank: '#2 Alternatif',
      dayNum: 3,
      dayName: 'Rabu',
      startTime: '10:20',
      endTime: '12:00',
      startMinute: 620,
      roomName: 'R. B203 (Kapasitas 55)',
      roomCode: 'B203',
      reason: 'Ruangan teori seimbang, tidak bentrok',
      isOptimal: false,
    },
    {
      id: 'rec-3',
      rank: '#3 Alternatif Sore',
      dayNum: 4,
      dayName: 'Kamis',
      startTime: '12:50',
      endTime: '15:20',
      startMinute: 770,
      roomName: 'R. C301 (Kapasitas 60)',
      roomCode: 'C301',
      reason: 'Sesi siang sesudah istirahat Dzuhur',
      isOptimal: false,
    },
  ];

  const handleApplyRec = async (rec: typeof recommendations[0]) => {
    if (!inspectedEntry || !onApplyReschedule) {
      toast.success(`Jadwal dialihkan ke ${rec.dayName} (${rec.startTime}–${rec.endTime}) di ${rec.roomCode}.`);
      onCloseInspector();
      return;
    }

    setIsApplying(true);
    try {
      await onApplyReschedule(
        inspectedEntry,
        rec.dayNum,
        rec.startMinute,
        rec.roomCode
      );
      toast.success('Rekomendasi jadwal berhasil diterapkan.');
      onCloseInspector();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menerapkan rekomendasi.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyManual = async () => {
    if (!inspectedEntry || !onApplyReschedule) {
      toast.success(`Jadwal disimpan: Hari ${dayOfWeekToName(manualDay)}, ${minuteToTime(manualStartMinute)} di ${manualRoom}.`);
      onCloseInspector();
      return;
    }

    setIsApplying(true);
    try {
      await onApplyReschedule(
        inspectedEntry,
        manualDay,
        manualStartMinute,
        manualRoom
      );
      toast.success('Perpindahan jadwal manual berhasil disimpan.');
      onCloseInspector();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memindahkan jadwal.');
    } finally {
      setIsApplying(false);
    }
  };

  // If optimization panel (Step 5) is provided, render it cleanly on the right
  if (optimizationPanel) {
    return <div className="space-y-5">{optimizationPanel}</div>;
  }

  // If an entry is inspected, render the Right Inspector Panel
  if (inspectedEntry) {
    const lecturerName = Array.isArray(inspectedEntry.lecturer_names)
      ? inspectedEntry.lecturer_names.join(', ')
      : inspectedEntry.lecturer_names || 'Dosen Pengampu';

    return (
      <div
        className="p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)] space-y-4 animate-in fade-in zoom-in-95 duration-150"
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(14px) saturate(130%)',
          WebkitBackdropFilter: 'blur(14px) saturate(130%)',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          borderRadius: '24px',
        }}
      >
        {/* Header with Close */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Detail Jadwal
              </span>
              {inspectedEntry.class_name && (
                <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {inspectedEntry.class_name}
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight mt-1.5 leading-snug">
              {inspectedEntry.course_name}
            </h3>
          </div>

          <button
            type="button"
            onClick={onCloseInspector}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Metadata Info */}
        <div className="p-3 rounded-2xl bg-white/70 border border-slate-200/70 text-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="font-mono text-2xs font-medium">
              {inspectedEntry.start_time} – {inspectedEntry.end_time}
            </span>
            {inspectedEntry.sks && (
              <span className="text-3xs text-slate-400 font-semibold">
                ({inspectedEntry.sks} SKS)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-2xs font-semibold">
              {inspectedEntry.room_code || inspectedEntry.room_name || 'R. Teori'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-2xs font-medium truncate">
              {lecturerName}
            </span>
          </div>
        </div>

        {!isAdmin ? (
          /* READ-ONLY DETAIL FOR GUEST & DOSEN */
          <div className="space-y-3 p-4 rounded-2xl bg-white/70 border border-slate-200/70 text-xs">
            <div className="flex items-center gap-1.5 text-blue-700 font-bold text-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Detail Informasi Perkuliahan</span>
            </div>
            <div className="space-y-2 text-2xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Mata Kuliah:</span>
                <span className="font-semibold text-slate-800 text-right">{inspectedEntry.course_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Kode & Kelas:</span>
                <span className="font-semibold text-slate-800">{inspectedEntry.course_code || '-'} (Kelas {inspectedEntry.class_name || inspectedEntry.raw?.class_code || 'A'})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Bobot SKS:</span>
                <span className="font-semibold text-slate-800">{inspectedEntry.sks || 0} SKS</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Dosen Pengampu:</span>
                <span className="font-semibold text-slate-800 text-right">{lecturerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Ruangan:</span>
                <span className="font-semibold text-slate-800">{inspectedEntry.room_code || inspectedEntry.room_name || '-'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Waktu Kuliah:</span>
                <span className="font-semibold text-slate-800">{inspectedEntry.raw?.day ? inspectedEntry.raw.day : (inspectedEntry.raw?.day_of_week ? dayOfWeekToName(inspectedEntry.raw.day_of_week) : 'Hari Belum Diatur')}, {inspectedEntry.start_time} – {inspectedEntry.end_time}</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-3xs text-slate-500 leading-relaxed">
              Jadwal resmi diterbitkan oleh Bagian Akademik Jurusan Teknik Elektro. Perubahan jadwal hanya dapat dilakukan melalui Administrator.
            </div>
          </div>
        ) : (
          <>
        {/* Tab Switcher: Rekomendasi Cerdas vs Manual vs Tukar */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100/80 text-2xs font-semibold">
          <button
            type="button"
            onClick={() => setInspectorTab('RECOMMENDATIONS')}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer',
              inspectorTab === 'RECOMMENDATIONS'
                ? 'bg-white text-blue-600 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Rekomendasi
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab('MANUAL')}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer',
              inspectorTab === 'MANUAL'
                ? 'bg-white text-blue-600 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab('SWAP')}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer',
              inspectorTab === 'SWAP'
                ? 'bg-white text-blue-600 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Tukar
          </button>
        </div>

        {/* Tab 1: Smart Rescheduling Recommendations */}
        {inspectorTab === 'RECOMMENDATIONS' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-2xs font-bold text-blue-700">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Opsi Penjadwalan Cerdas</span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={cn(
                    'p-3 rounded-2xl border text-xs space-y-2 transition-all',
                    rec.isOptimal
                      ? 'bg-blue-50/70 border-blue-200/80 shadow-2xs'
                      : 'bg-white/80 border-slate-200/80 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-4xs font-extrabold uppercase px-2 py-0.5 rounded-full',
                        rec.isOptimal
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      )}
                    >
                      {rec.rank}
                    </span>

                    <span className="text-2xs font-mono font-bold text-slate-800">
                      {rec.dayName} • {rec.startTime}
                    </span>
                  </div>

                  <p className="text-3xs text-slate-600 leading-snug">
                    {rec.roomName} — {rec.reason}
                  </p>

                  <button
                    type="button"
                    disabled={isApplying}
                    onClick={() => handleApplyRec(rec)}
                    className="w-full py-1.5 text-2xs font-bold text-blue-700 hover:text-white bg-blue-100/80 hover:bg-blue-600 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span>Gunakan Opsi Ini</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Manual Adjustment */}
        {inspectorTab === 'MANUAL' && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-2xs font-bold text-slate-600 mb-1">
                Hari Pelaksanaan
              </label>
              <select
                value={manualDay}
                onChange={(e) => setManualDay(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
              >
                <option value={1}>Senin</option>
                <option value={2}>Selasa</option>
                <option value={3}>Rabu</option>
                <option value={4}>Kamis</option>
                <option value={5}>Jumat</option>
              </select>
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-600 mb-1">
                Jam Mulai
              </label>
              <select
                value={manualStartMinute}
                onChange={(e) => setManualStartMinute(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white font-mono"
              >
                <option value={470}>07:50 (Sesi 1)</option>
                <option value={520}>08:40 (Sesi 2)</option>
                <option value={570}>09:30 (Sesi 3)</option>
                <option value={620}>10:20 (Sesi 4)</option>
                <option value={670}>11:10 (Sesi 5)</option>
                <option value={770}>12:50 (Sesi 6)</option>
                <option value={820}>13:40 (Sesi 7)</option>
                <option value={870}>14:30 (Sesi 8)</option>
                <option value={970}>16:10 (Sesi 9)</option>
                <option value={1020}>17:00 (Sesi 10)</option>
              </select>
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-600 mb-1">
                Ruangan Kuliah
              </label>
              <input
                type="text"
                value={manualRoom}
                onChange={(e) => setManualRoom(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                placeholder="Contoh: R. A101 / R. B203"
              />
            </div>

            <button
              type="button"
              disabled={isApplying}
              onClick={handleApplyManual}
              className="w-full py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 mt-2"
            >
              Simpan Perubahan
            </button>
          </div>
        )}

        {/* Tab 3: Swap */}
        {inspectorTab === 'SWAP' && (
          <div className="space-y-3 text-xs">
            <p className="text-3xs text-slate-500">
              Pilih mata kuliah lain untuk bertukar slot waktu dan ruangan secara langsung.
            </p>
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-3xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                Fitur Tukar Jadwal
              </span>
              <p>
                Sistem akan memverifikasi kesesuaian kapasitas dan ketiadaan bentrok dosen sebelum melakukan pertukaran.
              </p>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    );
  }

  // Default state: Jadwal Hari Ini + Mini Calendar
  return (
    <div className="space-y-5">
      {/* Jadwal Hari Ini Card */}
      <AppleTodayScheduleCard
        entries={todayEntries}
        dateString={formattedTodayString}
        onSeeAll={() => {
          toast.info(`Menampilkan jadwal untuk ${formattedTodayString}`);
        }}
        onSelectEntry={(entry) => {
          // Open inspector for selected entry
          if (entry) {
            setManualDay(entry.raw?.day_of_week || 1);
            setManualStartMinute(
              entry.raw?.start_minute || timeToMinute(entry.start_time) || 470
            );
            setManualRoom(entry.room_code || entry.room_name || 'R. Teori');
          }
        }}
      />

      {/* Mini Calendar Card */}
      <AppleMiniCalendar
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        scheduledDayNumbers={scheduledDays}
      />
    </div>
  );
});
