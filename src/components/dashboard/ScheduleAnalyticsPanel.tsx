import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  DoorClosed,
  TrendingUp,
  TrendingDown,
  Layers,
  BarChart3,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { CurrentPublishedSchedule, AcademicTerm } from '../../types';
import { cn } from '../../lib/utils';

interface ScheduleAnalyticsPanelProps {
  schedule: CurrentPublishedSchedule[];
  loading?: boolean;
  activeTerm?: AcademicTerm | null;
}

type TabType = 'HARI' | 'SESI' | 'RUANGAN';

export const ScheduleAnalyticsPanel: React.FC<ScheduleAnalyticsPanelProps> = ({
  schedule,
  loading = false,
  activeTerm,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('HARI');
  const [hoveredItem, setHoveredItem] = useState<{ label: string; count: number; subtext?: string } | null>(null);

  // 1. Memoized Aggregation Calculations (Zero re-render strain)
  const analyticsData = useMemo(() => {
    const totalClasses = schedule.length;

    // --- A. TAB 1: PER HARI ---
    const baseDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    // Include Saturday if any Saturday schedule exists
    const hasSaturday = schedule.some(
      (s) => s.day?.trim().toLowerCase() === 'sabtu' || s.day_of_week === 6
    );
    const targetDays = hasSaturday ? [...baseDays, 'Sabtu'] : baseDays;

    const dayDist = targetDays.map((day) => {
      const matching = schedule.filter(
        (s) => s.day?.trim().toLowerCase() === day.toLowerCase()
      );
      const sksSum = matching.reduce((acc, curr) => acc + (curr.sks || curr.effective_sks || 0), 0);
      return {
        label: day,
        count: matching.length,
        sks: sksSum,
        percentage: totalClasses > 0 ? Math.round((matching.length / totalClasses) * 100) : 0,
      };
    });

    const maxDayCount = Math.max(...dayDist.map((d) => d.count), 1);

    // Busiest and lightest day calculation
    const sortedDays = [...dayDist].sort((a, b) => b.count - a.count);
    const busiestDay = sortedDays[0]?.count > 0 ? sortedDays[0] : null;
    const nonZeroDays = sortedDays.filter((d) => d.count > 0);
    const lightestDay = nonZeroDays.length > 0 ? nonZeroDays[nonZeroDays.length - 1] : sortedDays[sortedDays.length - 1];

    // --- B. TAB 2: PER SESI ---
    // Categorize schedule entries into standard academic session blocks
    const sessionBuckets = [
      { id: 'S1', name: 'Sesi 1', range: '07:30 – 09:30', period: 'Pagi' },
      { id: 'S2', name: 'Sesi 2', range: '09:40 – 12:00', period: 'Menjelang Siang' },
      { id: 'S3', name: 'Sesi 3', range: '13:00 – 15:00', period: 'Siang' },
      { id: 'S4', name: 'Sesi 4', range: '15:00 – 17:30', period: 'Sore' },
    ];

    // Check if there are evening sessions (after 17:30)
    const hasEvening = schedule.some((s) => {
      const h = parseInt((s.start_time || '00').split(':')[0], 10);
      return h >= 17;
    });

    if (hasEvening) {
      sessionBuckets.push({
        id: 'S5',
        name: 'Sesi 5',
        range: '17:30 – 20:00',
        period: 'Petang/Malam',
      });
    }

    const sessionDist = sessionBuckets.map((bucket) => {
      const matching = schedule.filter((s) => {
        const timeStr = s.start_time || '';
        const h = parseInt(timeStr.split(':')[0], 10);
        const m = parseInt(timeStr.split(':')[1] || '0', 10);
        const totalMinutes = h * 60 + m;

        if (bucket.id === 'S1') return totalMinutes > 0 && totalMinutes < 570; // Before 09:30
        if (bucket.id === 'S2') return totalMinutes >= 570 && totalMinutes < 750; // 09:30 - 12:30
        if (bucket.id === 'S3') return totalMinutes >= 750 && totalMinutes < 900; // 12:30 - 15:00
        if (bucket.id === 'S4') return totalMinutes >= 900 && totalMinutes < 1050; // 15:00 - 17:30
        if (bucket.id === 'S5') return totalMinutes >= 1050; // 17:30+
        return false;
      });

      return {
        id: bucket.id,
        label: bucket.name,
        range: bucket.range,
        period: bucket.period,
        count: matching.length,
        percentage: totalClasses > 0 ? Math.round((matching.length / totalClasses) * 100) : 0,
      };
    });

    const maxSessionCount = Math.max(...sessionDist.map((s) => s.count), 1);
    const sortedSessions = [...sessionDist].sort((a, b) => b.count - a.count);
    const busiestSession = sortedSessions[0]?.count > 0 ? sortedSessions[0] : null;
    const lightestSession = sortedSessions[sortedSessions.length - 1];

    // --- C. TAB 3: RUANGAN (ROOM UTILIZATION) ---
    const roomMap = new Map<string, { code: string; name: string; count: number; courses: Set<string> }>();

    schedule.forEach((item) => {
      const roomKey = item.room_code || item.room_name || 'Ruangan Belum Ditentukan';
      const existing = roomMap.get(roomKey);
      if (existing) {
        existing.count += 1;
        existing.courses.add(item.course_name);
      } else {
        roomMap.set(roomKey, {
          code: item.room_code || roomKey,
          name: item.room_name || roomKey,
          count: 1,
          courses: new Set([item.course_name]),
        });
      }
    });

    const allRooms = Array.from(roomMap.values()).sort((a, b) => b.count - a.count);
    const topRooms = allRooms.slice(0, 7).map((r) => ({
      label: r.code,
      fullName: r.name,
      count: r.count,
      uniqueCourses: r.courses.size,
      percentage: totalClasses > 0 ? Math.round((r.count / totalClasses) * 100) : 0,
    }));

    const maxRoomCount = Math.max(...topRooms.map((r) => r.count), 1);
    const totalActiveRooms = allRooms.length;
    const busiestRoom = topRooms[0]?.count > 0 ? topRooms[0] : null;
    const avgClassesPerRoom = totalActiveRooms > 0 ? (totalClasses / totalActiveRooms).toFixed(1) : '0';

    return {
      totalClasses,
      dayDist,
      maxDayCount,
      busiestDay,
      lightestDay,
      sessionDist,
      maxSessionCount,
      busiestSession,
      lightestSession,
      topRooms,
      maxRoomCount,
      totalActiveRooms,
      busiestRoom,
      avgClassesPerRoom,
    };
  }, [schedule]);

  // If loading, render minimal skeleton
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs animate-pulse">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div className="h-6 w-48 bg-slate-200 rounded-lg" />
          <div className="h-6 w-32 bg-slate-200 rounded-lg" />
        </div>
        <div className="h-56 bg-slate-100 rounded-xl mb-4" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 bg-slate-100 rounded-lg" />
          <div className="h-16 bg-slate-100 rounded-lg" />
          <div className="h-16 bg-slate-100 rounded-lg" />
        </div>
      </div>
    );
  }

  // If no published schedule data exists
  if (analyticsData.totalClasses === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 sm:p-8 shadow-xs text-center">
        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5 shadow-2xs border border-blue-100">
            <BarChart3 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 tracking-tight">
            Belum ada data jadwal untuk divisualisasikan
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed max-w-sm">
            Distribusi kelas per hari, pemanfaatan sesi waktu, dan ranking penggunaan ruangan akan otomatis dihitung setelah jadwal perkuliahan disusun dan diterbitkan.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => navigate('/penyusunan-jadwal')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Mulai Penyusunan Jadwal
            </button>
            <button
              onClick={() => navigate('/jadwal-perkuliahan')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 transition-colors shadow-2xs cursor-pointer"
            >
              Lihat Jadwal Lengkap
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
      {/* Panel Header & Segmented Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Analisis Distribusi Penjadwalan
            </h3>
          </div>
          <p className="text-2xs text-slate-500 font-medium mt-0.5 ml-8">
            Ringkasan pemetaan {analyticsData.totalClasses} kelas terjadwal pada semester aktif
          </p>
        </div>

        {/* Segmented Control */}
        <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('HARI')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none',
              activeTab === 'HARI'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Per Hari</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SESI')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none',
              activeTab === 'SESI'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Per Sesi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RUANGAN')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none',
              activeTab === 'RUANGAN'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <DoorClosed className="w-3.5 h-3.5" />
            <span>Ruangan</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          TAB 1: PER HARI (DISTRIBUSI KELAS PER HARI)
         ======================================================== */}
      {activeTab === 'HARI' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Header area with reserved height for hover badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-h-[28px]">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Distribusi Kelas per Hari Perkuliahan
            </span>
            <div className="h-6 flex items-center shrink-0">
              {hoveredItem ? (
                <span className="text-2xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  {hoveredItem.label}: <strong>{hoveredItem.count} Kelas</strong> ({hoveredItem.subtext})
                </span>
              ) : (
                <span className="text-2xs font-semibold text-transparent px-2 py-0.5 select-none pointer-events-none" aria-hidden="true">
                  Placeholder
                </span>
              )}
            </div>
          </div>

          {/* Vertical Bar Chart with strictly fixed layout */}
          <div className="h-56 pt-4 pb-2 px-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-stretch justify-between gap-3 sm:gap-6 relative select-none">
            {/* Background horizontal guide lines */}
            <div className="absolute inset-0 pt-8 pb-10 px-4 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-b border-dashed border-slate-300 w-full" />
              <div className="border-b border-dashed border-slate-300 w-full" />
              <div className="border-b border-dashed border-slate-300 w-full" />
            </div>

            {analyticsData.dayDist.map((item) => {
              const heightPercent = Math.max(
                Math.round((item.count / analyticsData.maxDayCount) * 100),
                6
              );
              const isBusiest = analyticsData.busiestDay?.label === item.label && item.count > 0;

              return (
                <div
                  key={item.label}
                  className="flex-1 h-full flex flex-col items-center select-none cursor-pointer group z-10"
                  onMouseEnter={() =>
                    setHoveredItem({
                      label: item.label,
                      count: item.count,
                      subtext: `${item.percentage}% dari total • ${item.sks} SKS`,
                    })
                  }
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Total Value Label above bar with fixed height */}
                  <div className="h-5 flex items-center justify-center shrink-0 w-full">
                    <span
                      className={cn(
                        'text-2xs font-bold transition-colors duration-150',
                        isBusiest
                          ? 'text-blue-700'
                          : 'text-slate-600 group-hover:text-blue-600'
                      )}
                    >
                      {item.count}
                    </span>
                  </div>

                  {/* Bar Track Area - allocates remaining flex height without resizing */}
                  <div className="flex-1 w-full max-w-[48px] flex items-end justify-center relative min-h-0">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={cn(
                        'w-full rounded-t-lg relative transition-[opacity,filter] duration-150 ease-out',
                        isBusiest
                          ? 'bg-gradient-to-t from-blue-700 to-blue-500 shadow-sm opacity-95 group-hover:opacity-100 group-hover:brightness-105'
                          : 'bg-gradient-to-t from-blue-500/80 to-blue-400/80 opacity-85 group-hover:opacity-100 group-hover:brightness-105'
                      )}
                    >
                      {/* Top highlight cap */}
                      <div className="h-1 w-full bg-white/40 rounded-t-lg" />
                    </div>
                  </div>

                  {/* Day Label underneath with fixed height */}
                  <div className="h-6 mt-1 flex items-center justify-center shrink-0 w-full">
                    <span className="text-2xs font-semibold text-slate-700 truncate">
                      {item.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Insights for Hari */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Hari Terpadat
                </p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {analyticsData.busiestDay
                    ? `${analyticsData.busiestDay.label} (${analyticsData.busiestDay.count} Kelas)`
                    : '—'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Hari Paling Longgar
                </p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {analyticsData.lightestDay
                    ? `${analyticsData.lightestDay.label} (${analyticsData.lightestDay.count} Kelas)`
                    : '—'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Terjadwal
                </p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {analyticsData.totalClasses} Kelas Kuliah
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: PER SESI (DISTRIBUSI KELAS PER SESI WAKTU)
         ======================================================== */}
      {activeTab === 'SESI' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Header area with reserved height for hover badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-h-[28px]">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Distribusi Kelas per Blok Sesi Waktu
            </span>
            <div className="h-6 flex items-center shrink-0">
              {hoveredItem ? (
                <span className="text-2xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  {hoveredItem.label}: <strong>{hoveredItem.count} Kelas</strong> ({hoveredItem.subtext})
                </span>
              ) : (
                <span className="text-2xs font-semibold text-transparent px-2 py-0.5 select-none pointer-events-none" aria-hidden="true">
                  Placeholder
                </span>
              )}
            </div>
          </div>

          {/* Vertical Bar Chart for Sessions */}
          <div className="h-56 pt-4 pb-2 px-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-stretch justify-between gap-3 sm:gap-6 relative select-none">
            {/* Background horizontal guide lines */}
            <div className="absolute inset-0 pt-8 pb-12 px-4 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-b border-dashed border-slate-300 w-full" />
              <div className="border-b border-dashed border-slate-300 w-full" />
              <div className="border-b border-dashed border-slate-300 w-full" />
            </div>

            {analyticsData.sessionDist.map((item) => {
              const heightPercent = Math.max(
                Math.round((item.count / analyticsData.maxSessionCount) * 100),
                6
              );
              const isBusiest = analyticsData.busiestSession?.id === item.id && item.count > 0;

              return (
                <div
                  key={item.id}
                  className="flex-1 h-full flex flex-col items-center select-none cursor-pointer group z-10"
                  onMouseEnter={() =>
                    setHoveredItem({
                      label: `${item.label} (${item.range})`,
                      count: item.count,
                      subtext: `${item.percentage}% total jadwal • Waktu ${item.period}`,
                    })
                  }
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Total Value Label above bar */}
                  <div className="h-5 flex items-center justify-center shrink-0 w-full">
                    <span
                      className={cn(
                        'text-2xs font-bold transition-colors duration-150',
                        isBusiest
                          ? 'text-indigo-700'
                          : 'text-slate-600 group-hover:text-indigo-600'
                      )}
                    >
                      {item.count}
                    </span>
                  </div>

                  {/* Bar Track Area */}
                  <div className="flex-1 w-full max-w-[56px] flex items-end justify-center relative min-h-0">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={cn(
                        'w-full rounded-t-lg relative transition-[opacity,filter] duration-150 ease-out',
                        isBusiest
                          ? 'bg-gradient-to-t from-indigo-700 to-indigo-500 shadow-sm opacity-95 group-hover:opacity-100 group-hover:brightness-105'
                          : 'bg-gradient-to-t from-indigo-500/80 to-indigo-400/80 opacity-85 group-hover:opacity-100 group-hover:brightness-105'
                      )}
                    >
                      <div className="h-1 w-full bg-white/40 rounded-t-lg" />
                    </div>
                  </div>

                  {/* Session Label & Range underneath with fixed height */}
                  <div className="h-9 mt-1 flex flex-col items-center justify-center shrink-0 text-center w-full">
                    <p className="text-2xs font-bold text-slate-800 leading-tight truncate w-full">
                      {item.label}
                    </p>
                    <p className="text-3xs text-slate-400 font-medium truncate hidden sm:block w-full">
                      {item.range}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Insights for Sesi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Sesi Tersibuk
                </p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {analyticsData.busiestSession
                    ? `${analyticsData.busiestSession.label} (${analyticsData.busiestSession.count} Kelas)`
                    : '—'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Sesi Paling Longgar
                </p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {analyticsData.lightestSession
                    ? `${analyticsData.lightestSession.label} (${analyticsData.lightestSession.count} Kelas)`
                    : '—'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Karakteristik Sesi
                </p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {analyticsData.sessionDist.length} Sesi Terkonfigurasi
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: RUANGAN (PENGGUNAAN RUANGAN / TOP UTILIZATION)
         ======================================================== */}
      {activeTab === 'RUANGAN' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Header area with reserved height for hover badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-h-[28px]">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Peringkat Penggunaan Ruangan Perkuliahan (Top 7)
            </span>
            <div className="h-6 flex items-center shrink-0">
              {hoveredItem ? (
                <span className="text-2xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  {hoveredItem.label}: <strong>{hoveredItem.count} Kelas</strong> ({hoveredItem.subtext})
                </span>
              ) : (
                <span className="text-2xs font-semibold text-transparent px-2 py-0.5 select-none pointer-events-none" aria-hidden="true">
                  Placeholder
                </span>
              )}
            </div>
          </div>

          {/* Horizontal Ranking Bars */}
          <div className="space-y-2.5 p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
            {analyticsData.topRooms.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Belum ada data alokasi ruangan.
              </p>
            ) : (
              analyticsData.topRooms.map((room, idx) => {
                const widthPercent = Math.max(
                  Math.round((room.count / analyticsData.maxRoomCount) * 100),
                  8
                );
                const isTop = idx === 0;

                return (
                  <div
                    key={room.label}
                    className="flex items-center gap-3 group cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredItem({
                        label: room.label,
                        count: room.count,
                        subtext: `${room.percentage}% dari total kelas • ${room.uniqueCourses} Mata Kuliah`,
                      })
                    }
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    {/* Room Code & Name */}
                    <div className="w-24 sm:w-28 shrink-0 text-left">
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                        {room.label}
                      </p>
                      <p className="text-3xs text-slate-400 truncate">
                        {room.uniqueCourses} MK berbeda
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex-1 h-6 bg-slate-100/90 rounded-lg p-0.5 relative overflow-hidden flex items-center">
                      <div
                        style={{ width: `${widthPercent}%` }}
                        className={cn(
                          'h-full rounded-md relative flex items-center justify-end px-2 transition-[opacity,filter] duration-150 ease-out',
                          isTop
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-2xs opacity-95 group-hover:opacity-100 group-hover:brightness-105'
                            : 'bg-gradient-to-r from-slate-600 to-blue-600/80 opacity-85 group-hover:opacity-100 group-hover:brightness-105'
                        )}
                      >
                        <span className="text-3xs font-bold text-white leading-none">
                          {room.count}
                        </span>
                      </div>
                    </div>

                    {/* Percentage */}
                    <span className="w-12 text-right text-2xs font-semibold text-slate-500 shrink-0">
                      {room.percentage}%
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Insights for Ruangan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <DoorClosed className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Ruangan Terpadat
                </p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {analyticsData.busiestRoom
                    ? `${analyticsData.busiestRoom.label} (${analyticsData.busiestRoom.count} Kelas)`
                    : '—'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Rata-rata Pemakaian
                </p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {analyticsData.avgClassesPerRoom} Kelas / Ruang Aktif
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Ruangan Aktif
                </p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {analyticsData.totalActiveRooms} Ruangan Terpakai
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
