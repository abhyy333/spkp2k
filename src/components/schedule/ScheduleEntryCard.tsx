import React from 'react';
import { ScheduleEntry, Room } from '../../types';
import { ClientConflict } from '../../lib/scheduleValidator';
import { minuteToTime } from '../../lib/utils';
import { AlertTriangle, Clock, MapPin, User, Users } from 'lucide-react';

interface ScheduleEntryCardProps {
  entry: ScheduleEntry;
  room?: Room | null;
  conflicts: ClientConflict[];
  isSelected?: boolean;
  onClick: (entry: ScheduleEntry) => void;
  style?: React.CSSProperties;
  className?: string;
  isCompact?: boolean;
}

export const ScheduleEntryCard: React.FC<ScheduleEntryCardProps> = ({
  entry,
  room,
  conflicts,
  isSelected = false,
  onClick,
  style,
  className = '',
  isCompact = false,
}) => {
  const course = entry.course_offering?.course;
  const courseName = entry.course_name || course?.name || 'Mata Kuliah';
  const courseCode = entry.course_code || course?.code || '';
  const classCode = entry.class_code || entry.course_offering?.class_code || 'A';
  const semester = course?.semester;

  // Session count and SKS: Source of truth: effective_sks -> session_count -> duration/50
  const durationSks =
    entry.start_minute != null && entry.end_minute != null && entry.end_minute > entry.start_minute
      ? Math.max(1, Math.round((entry.end_minute - entry.start_minute) / 50))
      : null;
  const sks = course?.effective_sks || entry.session_count || durationSks || 3;
  const sessionCount = entry.session_count || durationSks || sks || 3;

  // Timing: use start_minute and end_minute if present
  const startMin = entry.start_minute ?? 470;
  const endMin = entry.end_minute ?? (startMin + sessionCount * 50);
  const timeRange = `${minuteToTime(startMin)} – ${minuteToTime(endMin)}`;

  const roomName = room ? `${room.code} (${room.name})` : (entry.room_id || 'Ruangan');
  const studentCount = entry.student_count ?? entry.course_offering?.expected_students ?? 0;

  // Team teaching lecturers list
  const getLecturersList = (): string[] => {
    if (Array.isArray(entry.lecturer_names)) {
      return entry.lecturer_names.filter((name): name is string => Boolean(name));
    }
    if (typeof entry.lecturer_names === 'string' && entry.lecturer_names.trim() !== '-' && entry.lecturer_names.trim() !== '') {
      return entry.lecturer_names.split(',').map((s) => s.trim()).filter((name): name is string => Boolean(name));
    }
    const fromOffering = entry.course_offering?.course_offering_lecturers
      ?.map((l) => l.lecturer?.name)
      .filter((name): name is string => Boolean(name));
    if (fromOffering && fromOffering.length > 0) {
      return fromOffering;
    }
    return [];
  };

  const lecturersList = getLecturersList();
  const displayedLecturers = lecturersList.slice(0, 2);
  const remainingLecturersCount = lecturersList.length - 2;

  // Conflict state
  const entryConflicts = conflicts.filter(
    (c) =>
      c.entryIds.includes(entry.id) ||
      c.courseOfferingIds.includes(entry.course_offering_id)
  );
  const hasConflict = entryConflicts.length > 0;
  const isUnsaved = entry.id.startsWith('draft-entry-') || Boolean((entry as any)._unsaved);

  return (
    <div
      onClick={() => onClick(entry)}
      style={style}
      className={`group relative h-full flex flex-col justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none text-left shadow-2xs hover:shadow-md ${
        hasConflict
          ? 'bg-rose-50/90 border-rose-300 hover:border-rose-500 ring-1 ring-rose-400/30'
          : isSelected
          ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/30 shadow-xs'
          : isUnsaved
          ? 'bg-amber-50/50 border-amber-300 hover:border-amber-500 hover:bg-amber-50/80'
          : 'bg-white border-slate-200/90 hover:border-blue-400 hover:bg-slate-50/80'
      } ${className}`}
    >
      {/* Card Top / Header */}
      <div className="space-y-1.5">
        {/* Row 1: Code, Class badge, Semester & SKS, Status Badges */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            {courseCode && (
              <span className="font-mono text-3xs font-bold text-slate-500 bg-slate-100/90 px-1.5 py-0.5 rounded tracking-tight shrink-0">
                {courseCode}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-blue-100 text-blue-700 shrink-0">
              Kelas {classCode}
            </span>
            {semester && (
              <span className="px-1 py-0.5 rounded text-3xs font-medium text-slate-600 bg-slate-100 shrink-0">
                Sem {semester}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded text-3xs font-semibold text-slate-700 bg-slate-100 shrink-0">
              {sks} SKS
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isUnsaved && (
              <span className="px-1.5 py-0.5 rounded text-4xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                Belum disimpan
              </span>
            )}
            {hasConflict && (
              <span
                title={`Konflik: ${entryConflicts.map((c) => c.title).join('; ')}`}
                className="px-1.5 py-0.5 rounded text-4xs font-bold bg-rose-600 text-white flex items-center gap-0.5 shrink-0 shadow-2xs animate-pulse"
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                Bentrok
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Course Title */}
        <h5
          className={`font-bold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors ${
            sessionCount === 1 ? 'text-2xs line-clamp-1' : 'text-xs line-clamp-2'
          }`}
          title={courseName}
        >
          {courseName}
        </h5>
      </div>

      {/* Card Body / Metadata */}
      <div className="mt-2 pt-1.5 border-t border-slate-100/90 space-y-1 text-3xs text-slate-600">
        {/* Time & Duration */}
        <div className="flex items-center gap-1 font-mono font-semibold text-slate-800">
          <Clock className="w-3 h-3 text-blue-600 shrink-0" />
          <span className="truncate">{timeRange}</span>
          <span className="text-4xs text-slate-400 font-sans font-normal ml-auto">
            ({sessionCount * 50} mnt)
          </span>
        </div>

        {/* Room */}
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="font-medium text-slate-700 truncate" title={roomName}>
            {roomName}
          </span>
        </div>

        {/* Lecturers (Team Teaching: Max 2 names + "+N lainnya") */}
        {sessionCount > 1 && displayedLecturers.length > 0 && (
          <div className="flex items-start gap-1 text-slate-600">
            <User className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 truncate">
              {displayedLecturers.map((lecName, idx) => (
                <div key={idx} className="truncate text-3xs leading-tight" title={lecName}>
                  {lecName}
                </div>
              ))}
              {remainingLecturersCount > 0 && (
                <span className="text-4xs font-semibold text-blue-600 block">
                  +{remainingLecturersCount} dosen lainnya
                </span>
              )}
            </div>
          </div>
        )}

        {/* Student Count */}
        <div className="flex items-center justify-between text-4xs text-slate-500 pt-0.5">
          <span className="flex items-center gap-1">
            <Users className="w-2.5 h-2.5 text-slate-400 shrink-0" />
            <span>{studentCount > 0 ? `${studentCount} peserta` : '0 peserta'}</span>
          </span>
          {course?.course_type && (
            <span className="text-slate-400 uppercase font-medium">
              {course.course_type}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
