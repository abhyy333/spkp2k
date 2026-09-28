import React, { useState, useMemo } from 'react';
import { ScheduleEntry, Room, TimeSlot, Lecturer } from '../../types';
import { ScheduleEntryCard } from './ScheduleEntryCard';
import { ClientConflict } from '../../lib/scheduleValidator';
import { minuteToTime } from '../../lib/utils';
import {
  Calendar,
  Building2,
  Filter,
  RotateCcw,
  Clock,
  Layers,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

interface ScheduleGridProps {
  entries: ScheduleEntry[];
  rooms: Room[];
  activeTimeSlots: TimeSlot[];
  lecturers: Lecturer[];
  conflicts: ClientConflict[];
  selectedEntryId?: string | null;
  onSelectEntry: (entry: ScheduleEntry) => void;
}

interface StandardSession {
  sessionNumber: number;
  startMinute: number;
  endMinute: number;
  label: string;
}

const DAYS = [
  { value: 1, name: 'Senin' },
  { value: 2, name: 'Selasa' },
  { value: 3, name: 'Rabu' },
  { value: 4, name: 'Kamis' },
  { value: 5, name: 'Jumat' },
];

// Standard academic 50-minute session slots for Teknik Elektro UNRAM
const DEFAULT_SESSIONS: StandardSession[] = [
  { sessionNumber: 1, startMinute: 470, endMinute: 520, label: 'Sesi 1' }, // 07:50 – 08:40
  { sessionNumber: 2, startMinute: 520, endMinute: 570, label: 'Sesi 2' }, // 08:40 – 09:30
  { sessionNumber: 3, startMinute: 570, endMinute: 620, label: 'Sesi 3' }, // 09:30 – 10:20
  { sessionNumber: 4, startMinute: 620, endMinute: 670, label: 'Sesi 4' }, // 10:20 – 11:10
  { sessionNumber: 5, startMinute: 670, endMinute: 720, label: 'Sesi 5' }, // 11:10 – 12:00
  { sessionNumber: 6, startMinute: 780, endMinute: 830, label: 'Sesi 6' }, // 13:00 – 13:50
  { sessionNumber: 7, startMinute: 830, endMinute: 880, label: 'Sesi 7' }, // 13:50 – 14:40
  { sessionNumber: 8, startMinute: 880, endMinute: 930, label: 'Sesi 8' }, // 14:40 – 15:30
  { sessionNumber: 9, startMinute: 930, endMinute: 980, label: 'Sesi 9' }, // 15:30 – 16:20
  { sessionNumber: 10, startMinute: 980, endMinute: 1030, label: 'Sesi 10' }, // 16:20 – 17:10
  { sessionNumber: 11, startMinute: 1030, endMinute: 1080, label: 'Sesi 11' }, // 17:10 – 18:00
];

interface PlacedCard {
  entry: ScheduleEntry;
  room?: Room | null;
  startRow: number;
  rowSpan: number;
  colIndex: number; // 1-based column for day/room
  laneIndex: number;
  totalLanes: number;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  entries,
  rooms,
  activeTimeSlots,
  lecturers,
  conflicts,
  selectedEntryId,
  onSelectEntry,
}) => {
  // Grid View Mode: 'DAY_MATRIX' (Senin-Jumat) vs 'ROOM_MATRIX' (Rooms for selected day)
  const [matrixMode, setMatrixMode] = useState<'DAY_MATRIX' | 'ROOM_MATRIX'>('DAY_MATRIX');
  const [selectedDayForRoomMatrix, setSelectedDayForRoomMatrix] = useState<number>(1);

  // Filters (view only)
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [lecturerFilter, setLecturerFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');

  // Active day filter for mobile / tablet tab switching
  const [mobileDayFilter, setMobileDayFilter] = useState<number | 'all'>('all');

  // Compute session slots dynamically from activeTimeSlots or default
  const sessions: StandardSession[] = useMemo(() => {
    const slotMap = new Map<number, { start: number; end: number; label?: string }>();

    activeTimeSlots.forEach((s) => {
      if (s.is_active && s.start_minute != null) {
        const start = s.start_minute;
        const end = s.end_minute ?? (start + 50);
        if (!slotMap.has(start)) {
          slotMap.set(start, { start, end, label: s.label || undefined });
        }
      }
    });

    if (slotMap.size > 0) {
      const sorted = Array.from(slotMap.values()).sort((a, b) => a.start - b.start);
      return sorted.map((item, idx) => ({
        sessionNumber: idx + 1,
        startMinute: item.start,
        endMinute: item.end,
        label: item.label || `Sesi ${idx + 1}`,
      }));
    }

    return DEFAULT_SESSIONS;
  }, [activeTimeSlots]);

  // Filtered entries for view
  const visibleEntries = useMemo(() => {
    return entries.filter((e) => {
      const course = e.course_offering?.course;

      if (semesterFilter !== 'all' && String(course?.semester) !== semesterFilter) {
        return false;
      }
      if (classFilter !== 'all' && (e.class_code || e.course_offering?.class_code) !== classFilter) {
        return false;
      }
      if (roomFilter !== 'all' && e.room_id !== roomFilter) {
        return false;
      }
      if (lecturerFilter !== 'all') {
        const hasLec =
          e.lecturer_ids?.includes(lecturerFilter) ||
          e.course_offering?.course_offering_lecturers?.some((l) => l.lecturer_id === lecturerFilter);
        if (!hasLec) return false;
      }

      return true;
    });
  }, [entries, semesterFilter, classFilter, roomFilter, lecturerFilter]);

  const uniqueClasses = useMemo(() => {
    return Array.from(
      new Set(entries.map((e) => e.class_code || e.course_offering?.class_code).filter(Boolean))
    ).sort();
  }, [entries]);

  const activeRooms = useMemo(() => {
    return rooms.filter((r) => r.is_active).sort((a, b) => a.code.localeCompare(b.code));
  }, [rooms]);

  // Helper: map start minute to session row index (1-based row index in CSS grid, header is row 1 so sessions start at row 2)
  const getSessionRow = (startMinute: number): number => {
    const idx = sessions.findIndex(
      (s) => startMinute >= s.startMinute && startMinute < s.endMinute
    );
    if (idx !== -1) return idx + 2;

    // Fallback: closest startMinute
    const closestIdx = sessions.findIndex((s) => s.startMinute >= startMinute);
    if (closestIdx !== -1) return closestIdx + 2;

    return 2; // Default first session row
  };

  // Helper: compute session count / row span
  const getEntrySpan = (entry: ScheduleEntry): number => {
    if (entry.session_count && entry.session_count > 0) {
      return entry.session_count;
    }
    const minPerSess = entry.minutes_per_session || 50;
    if (entry.start_minute != null && entry.end_minute != null && entry.end_minute > entry.start_minute) {
      const dur = entry.end_minute - entry.start_minute;
      return Math.max(1, Math.round(dur / minPerSess));
    }
    const sks = entry.course_offering?.course?.effective_sks;
    return sks && sks > 0 ? sks : 2;
  };

  // --- DAY MATRIX PLACEMENT CALCULATION WITH OVERLAP LANES ---
  const dayPlacedCards: PlacedCard[] = useMemo(() => {
    const result: PlacedCard[] = [];

    DAYS.forEach((day, dayIdx) => {
      const dayEntries = visibleEntries.filter((e) => (Number(e.day_of_week) || 1) === day.value);
      if (dayEntries.length === 0) return;

      // Sort entries by start_minute asc, then duration desc
      const sorted = [...dayEntries].sort((a, b) => {
        const aStart = a.start_minute ?? 470;
        const bStart = b.start_minute ?? 470;
        if (aStart !== bStart) return aStart - bStart;
        return getEntrySpan(b) - getEntrySpan(a);
      });

      // Group into overlapping clusters to assign side-by-side lanes
      const clusters: ScheduleEntry[][] = [];
      let currentCluster: ScheduleEntry[] = [];
      let clusterMaxEnd = -1;

      sorted.forEach((entry) => {
        const minPerSess = entry.minutes_per_session || 50;
        const start = entry.start_minute ?? 470;
        const span = getEntrySpan(entry);
        const end = entry.end_minute ?? (start + span * minPerSess);

        if (currentCluster.length === 0) {
          currentCluster.push(entry);
          clusterMaxEnd = end;
        } else if (start < clusterMaxEnd) {
          // Overlaps with current cluster
          currentCluster.push(entry);
          clusterMaxEnd = Math.max(clusterMaxEnd, end);
        } else {
          // New cluster
          clusters.push(currentCluster);
          currentCluster = [entry];
          clusterMaxEnd = end;
        }
      });
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }

      // Assign lanes within each cluster
      clusters.forEach((cluster) => {
        const lanes: { end: number }[] = [];
        const clusterPlaced: { entry: ScheduleEntry; lane: number }[] = [];

        cluster.forEach((entry) => {
          const start = entry.start_minute ?? 470;
          const span = getEntrySpan(entry);
          const end = entry.end_minute ?? (start + span * 50);

          let placedLane = -1;
          for (let l = 0; l < lanes.length; l++) {
            if (lanes[l].end <= start) {
              lanes[l].end = end;
              placedLane = l;
              break;
            }
          }
          if (placedLane === -1) {
            lanes.push({ end });
            placedLane = lanes.length - 1;
          }

          clusterPlaced.push({ entry, lane: placedLane });
        });

        const totalLanes = lanes.length;

        clusterPlaced.forEach(({ entry, lane }) => {
          const startMin = entry.start_minute ?? 470;
          const startRow = getSessionRow(startMin);
          const span = getEntrySpan(entry);
          const room = rooms.find((r) => r.id === entry.room_id);

          result.push({
            entry,
            room,
            startRow,
            rowSpan: span,
            colIndex: dayIdx + 2, // Col 1 is Time column, Col 2..6 are days
            laneIndex: lane,
            totalLanes,
          });
        });
      });
    });

    return result;
  }, [visibleEntries, rooms, sessions]);

  // --- ROOM MATRIX PLACEMENT CALCULATION ---
  const roomPlacedCards: PlacedCard[] = useMemo(() => {
    const result: PlacedCard[] = [];
    const dayEntries = visibleEntries.filter(
      (e) => (Number(e.day_of_week) || 1) === selectedDayForRoomMatrix
    );

    activeRooms.forEach((room, roomIdx) => {
      const roomEntries = dayEntries.filter((e) => e.room_id === room.id);
      if (roomEntries.length === 0) return;

      const sorted = [...roomEntries].sort((a, b) => (a.start_minute ?? 470) - (b.start_minute ?? 470));

      // Group overlaps if any
      const clusters: ScheduleEntry[][] = [];
      let currentCluster: ScheduleEntry[] = [];
      let clusterMaxEnd = -1;

      sorted.forEach((entry) => {
        const start = entry.start_minute ?? 470;
        const span = getEntrySpan(entry);
        const end = entry.end_minute ?? (start + span * 50);

        if (currentCluster.length === 0) {
          currentCluster.push(entry);
          clusterMaxEnd = end;
        } else if (start < clusterMaxEnd) {
          currentCluster.push(entry);
          clusterMaxEnd = Math.max(clusterMaxEnd, end);
        } else {
          clusters.push(currentCluster);
          currentCluster = [entry];
          clusterMaxEnd = end;
        }
      });
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }

      clusters.forEach((cluster) => {
        const lanes: { end: number }[] = [];
        const clusterPlaced: { entry: ScheduleEntry; lane: number }[] = [];

        cluster.forEach((entry) => {
          const start = entry.start_minute ?? 470;
          const span = getEntrySpan(entry);
          const end = entry.end_minute ?? (start + span * 50);

          let placedLane = -1;
          for (let l = 0; l < lanes.length; l++) {
            if (lanes[l].end <= start) {
              lanes[l].end = end;
              placedLane = l;
              break;
            }
          }
          if (placedLane === -1) {
            lanes.push({ end });
            placedLane = lanes.length - 1;
          }

          clusterPlaced.push({ entry, lane: placedLane });
        });

        const totalLanes = lanes.length;

        clusterPlaced.forEach(({ entry, lane }) => {
          const startMin = entry.start_minute ?? 470;
          const startRow = getSessionRow(startMin);
          const span = getEntrySpan(entry);

          result.push({
            entry,
            room,
            startRow,
            rowSpan: span,
            colIndex: roomIdx + 2, // Col 1 is Time, Col 2..N are rooms
            laneIndex: lane,
            totalLanes,
          });
        });
      });
    });

    return result;
  }, [visibleEntries, activeRooms, selectedDayForRoomMatrix, sessions]);

  // Filtered days based on mobile selection
  const displayedDays = useMemo(() => {
    if (mobileDayFilter === 'all') return DAYS;
    return DAYS.filter((d) => d.value === mobileDayFilter);
  }, [mobileDayFilter]);

  const hasActiveFilters =
    semesterFilter !== 'all' ||
    classFilter !== 'all' ||
    roomFilter !== 'all' ||
    lecturerFilter !== 'all';

  return (
    <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col h-[calc(100vh-210px)] max-h-[850px] overflow-hidden">
      {/* Top Bar: View Mode Switcher + Filters */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        {/* Left: Mode Tabs (Matriks Hari vs Matriks Ruangan) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setMatrixMode('DAY_MATRIX')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                matrixMode === 'DAY_MATRIX'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Matriks Hari
            </button>
            <button
              type="button"
              onClick={() => setMatrixMode('ROOM_MATRIX')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                matrixMode === 'ROOM_MATRIX'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Matriks Ruangan
            </button>
          </div>

          {/* If Room Matrix: Day selector */}
          {matrixMode === 'ROOM_MATRIX' && (
            <div className="flex items-center gap-1 text-2xs font-semibold">
              <span className="text-slate-400">Hari:</span>
              <select
                value={selectedDayForRoomMatrix}
                onChange={(e) => setSelectedDayForRoomMatrix(Number(e.target.value))}
                className="px-2.5 py-1 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
              >
                {DAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="text-2xs text-slate-500 hidden sm:inline">
            ({visibleEntries.length} kelas ditampilkan)
          </span>
        </div>

        {/* Right: Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-1.5 text-3xs">
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Smt</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={String(s)}>
                Semester {s}
              </option>
            ))}
          </select>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Kelas</option>
            {uniqueClasses.map((c) => (
              <option key={c} value={c}>
                Kelas {c}
              </option>
            ))}
          </select>

          {matrixMode === 'DAY_MATRIX' && (
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none max-w-[130px] truncate"
            >
              <option value="all">Semua Ruangan</option>
              {activeRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} ({r.name})
                </option>
              ))}
            </select>
          )}

          <select
            value={lecturerFilter}
            onChange={(e) => setLecturerFilter(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none max-w-[130px] truncate"
          >
            <option value="all">Semua Dosen</option>
            {lecturers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setSemesterFilter('all');
                setClassFilter('all');
                setRoomFilter('all');
                setLecturerFilter('all');
              }}
              title="Reset Filter Tampilan"
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Day Selector Tabs */}
      {matrixMode === 'DAY_MATRIX' && (
        <div className="flex sm:hidden items-center border-b border-slate-200 bg-slate-100/70 overflow-x-auto px-2 py-1 gap-1">
          <button
            type="button"
            onClick={() => setMobileDayFilter('all')}
            className={`px-2.5 py-1 rounded-md text-3xs font-bold shrink-0 transition-all ${
              mobileDayFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Hari
          </button>
          {DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setMobileDayFilter(d.value)}
              className={`px-2.5 py-1 rounded-md text-3xs font-bold shrink-0 transition-all ${
                mobileDayFilter === d.value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN MATRIX VIEW: CSS GRID with MULTI-ROW SPANNING CARDS */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-slate-100/40">
        {matrixMode === 'DAY_MATRIX' ? (
          /* ================= DAY MATRIX (Senin – Jumat) ================= */
          <div
            className="min-w-[840px] w-full grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `125px repeat(${displayedDays.length}, minmax(180px, 1fr))`,
              gridTemplateRows: `42px repeat(${sessions.length}, minmax(92px, auto))`,
            }}
          >
            {/* Header: Top-Left Time Corner */}
            <div
              className="bg-slate-900 text-white p-2.5 flex items-center justify-center font-bold text-2xs uppercase tracking-wider sticky top-0 left-0 z-30 border-r border-b border-slate-800 shadow-xs"
              style={{ gridRow: 1, gridColumn: 1 }}
            >
              <div className="flex items-center gap-1 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Waktu / Sesi</span>
              </div>
            </div>

            {/* Header: Day Columns (Dark Navy) */}
            {displayedDays.map((day, dIdx) => (
              <div
                key={day.value}
                className="bg-slate-900 text-white p-2.5 flex flex-col items-center justify-center font-bold text-2xs uppercase tracking-wider sticky top-0 z-20 border-r border-b border-slate-800 last:border-r-0 shadow-xs"
                style={{ gridRow: 1, gridColumn: dIdx + 2 }}
              >
                <span>{day.name}</span>
                <span className="text-4xs text-slate-400 font-normal lowercase">
                  {
                    dayPlacedCards.filter(
                      (c) => (Number(c.entry.day_of_week) || 1) === day.value
                    ).length
                  }{' '}
                  kelas
                </span>
              </div>
            ))}

            {/* Time Slot Labels (Left Column, Sticky) */}
            {sessions.map((session, sIdx) => {
              const rowNum = sIdx + 2;
              const startLabel = minuteToTime(session.startMinute);
              const endLabel = minuteToTime(session.endMinute);

              return (
                <div
                  key={`time-${session.sessionNumber}`}
                  className="bg-slate-50/95 border-r border-b border-slate-200 p-2 flex flex-col items-center justify-center font-mono sticky left-0 z-10 text-center select-none"
                  style={{ gridRow: rowNum, gridColumn: 1 }}
                >
                  <span className="font-bold text-2xs text-slate-800 font-sans uppercase tracking-tight">
                    {session.label}
                  </span>
                  <span className="text-3xs font-semibold text-slate-700 mt-0.5">
                    {startLabel}
                  </span>
                  <span className="text-4xs text-slate-400">s.d {endLabel}</span>
                  <span className="text-4xs text-blue-600 font-sans mt-0.5 font-medium">
                    50 menit
                  </span>
                </div>
              );
            })}

            {/* Background Grid Cells (Slots) */}
            {sessions.map((session, sIdx) => {
              const rowNum = sIdx + 2;
              return displayedDays.map((day, dIdx) => (
                <div
                  key={`cell-${day.value}-${session.sessionNumber}`}
                  className="border-r border-b border-slate-200/80 bg-white hover:bg-blue-50/20 transition-colors"
                  style={{ gridRow: rowNum, gridColumn: dIdx + 2 }}
                />
              ));
            })}

            {/* Render Spanning Schedule Cards */}
            {dayPlacedCards
              .filter((card) =>
                mobileDayFilter === 'all'
                  ? true
                  : (Number(card.entry.day_of_week) || 1) === mobileDayFilter
              )
              .map((card) => {
                const dayOffset =
                  mobileDayFilter === 'all'
                    ? card.colIndex
                    : displayedDays.findIndex(
                        (d) => d.value === (Number(card.entry.day_of_week) || 1)
                      ) + 2;

                const hasMultipleLanes = card.totalLanes > 1;
                const widthStyle = hasMultipleLanes
                  ? `calc(${100 / card.totalLanes}% - 6px)`
                  : 'calc(100% - 6px)';
                const leftStyle = hasMultipleLanes
                  ? `calc(${(card.laneIndex * 100) / card.totalLanes}% + 3px)`
                  : '3px';

                return (
                  <div
                    key={card.entry.id}
                    className="p-1 z-10"
                    style={{
                      gridRow: `${card.startRow} / span ${card.rowSpan}`,
                      gridColumn: dayOffset,
                      position: 'relative',
                      display: 'flex',
                    }}
                  >
                    <ScheduleEntryCard
                      entry={card.entry}
                      room={card.room}
                      conflicts={conflicts}
                      isSelected={selectedEntryId === card.entry.id}
                      onClick={onSelectEntry}
                      style={{
                        width: widthStyle,
                        marginLeft: leftStyle,
                        height: '100%',
                      }}
                    />
                  </div>
                );
              })}
          </div>
        ) : (
          /* ================= ROOM MATRIX (Per Ruangan) ================= */
          <div
            className="min-w-[900px] w-full grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `125px repeat(${activeRooms.length}, minmax(180px, 1fr))`,
              gridTemplateRows: `48px repeat(${sessions.length}, minmax(92px, auto))`,
            }}
          >
            {/* Header: Top-Left Time Corner */}
            <div
              className="bg-slate-900 text-white p-2.5 flex items-center justify-center font-bold text-2xs uppercase tracking-wider sticky top-0 left-0 z-30 border-r border-b border-slate-800 shadow-xs"
              style={{ gridRow: 1, gridColumn: 1 }}
            >
              <div className="flex items-center gap-1 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Waktu / Sesi</span>
              </div>
            </div>

            {/* Header: Room Columns (Dark Navy) */}
            {activeRooms.map((room, rIdx) => (
              <div
                key={room.id}
                className="bg-slate-900 text-white p-2 flex flex-col items-center justify-center sticky top-0 z-20 border-r border-b border-slate-800 last:border-r-0 shadow-xs"
                style={{ gridRow: 1, gridColumn: rIdx + 2 }}
              >
                <div className="flex items-center gap-1">
                  <span className="font-bold text-xs">{room.code}</span>
                  <span className="text-3xs text-slate-300">({room.capacity} krs)</span>
                </div>
                <span className="text-4xs text-slate-400 truncate max-w-[160px]">
                  {room.name} • {room.room_type || 'Teori'}
                </span>
              </div>
            ))}

            {/* Time Slot Labels (Left Column, Sticky) */}
            {sessions.map((session, sIdx) => {
              const rowNum = sIdx + 2;
              const startLabel = minuteToTime(session.startMinute);
              const endLabel = minuteToTime(session.endMinute);

              return (
                <div
                  key={`time-room-${session.sessionNumber}`}
                  className="bg-slate-50/95 border-r border-b border-slate-200 p-2 flex flex-col items-center justify-center font-mono sticky left-0 z-10 text-center select-none"
                  style={{ gridRow: rowNum, gridColumn: 1 }}
                >
                  <span className="font-bold text-2xs text-slate-800 font-sans uppercase tracking-tight">
                    {session.label}
                  </span>
                  <span className="text-3xs font-semibold text-slate-700 mt-0.5">
                    {startLabel}
                  </span>
                  <span className="text-4xs text-slate-400">s.d {endLabel}</span>
                  <span className="text-4xs text-blue-600 font-sans mt-0.5 font-medium">
                    50 menit
                  </span>
                </div>
              );
            })}

            {/* Background Grid Cells (Rooms) */}
            {sessions.map((session, sIdx) => {
              const rowNum = sIdx + 2;
              return activeRooms.map((room, rIdx) => (
                <div
                  key={`cell-room-${room.id}-${session.sessionNumber}`}
                  className="border-r border-b border-slate-200/80 bg-white hover:bg-blue-50/20 transition-colors"
                  style={{ gridRow: rowNum, gridColumn: rIdx + 2 }}
                />
              ));
            })}

            {/* Render Spanning Schedule Cards for Rooms */}
            {roomPlacedCards.map((card) => {
              const hasMultipleLanes = card.totalLanes > 1;
              const widthStyle = hasMultipleLanes
                ? `calc(${100 / card.totalLanes}% - 6px)`
                : 'calc(100% - 6px)';
              const leftStyle = hasMultipleLanes
                ? `calc(${(card.laneIndex * 100) / card.totalLanes}% + 3px)`
                : '3px';

              return (
                <div
                  key={card.entry.id}
                  className="p-1 z-10"
                  style={{
                    gridRow: `${card.startRow} / span ${card.rowSpan}`,
                    gridColumn: card.colIndex,
                    position: 'relative',
                    display: 'flex',
                  }}
                >
                  <ScheduleEntryCard
                    entry={card.entry}
                    room={card.room}
                    conflicts={conflicts}
                    isSelected={selectedEntryId === card.entry.id}
                    onClick={onSelectEntry}
                    style={{
                      width: widthStyle,
                      marginLeft: leftStyle,
                      height: '100%',
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
