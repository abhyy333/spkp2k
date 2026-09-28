import { TimeSlot } from '../types';
import { minuteToTime, dayOfWeekToName } from './utils';

export type AcademicTimeProfileType = 'NORMAL' | 'RAMADAN';

export interface AcademicTimeProfilePayload {
  activeProfile: AcademicTimeProfileType;
  NORMAL: {
    minutesPerSks: number;
    startMinute?: number;
    endMinute?: number;
  };
  RAMADAN: {
    minutesPerSks: number;
    startMinute: number;
    endMinute: number;
    breaks: Array<{
      startMinute: number;
      endMinute: number;
      label?: string;
    }>;
  };
}

export const DEFAULT_ACADEMIC_TIME_PROFILE_PAYLOAD: AcademicTimeProfilePayload = {
  activeProfile: 'NORMAL',
  NORMAL: {
    minutesPerSks: 50,
    startMinute: 470, // 07:50
    endMinute: 1070,  // 17:50
  },
  RAMADAN: {
    minutesPerSks: 40,
    startMinute: 480, // 08:00
    endMinute: 980,   // 16:20
    breaks: [
      {
        startMinute: 720, // 12:00
        endMinute: 780,   // 13:00
        label: 'Istirahat & Sholat Dzuhur',
      },
    ],
  },
};

export interface SessionDefinition {
  sessionNumber: number;
  startMinute: number;
  endMinute: number;
  startTime: string;
  endTime: string;
  label: string;
  isBreak?: boolean;
}

/**
 * Standard Normal sessions (10 active sessions, 50m each)
 */
export const NORMAL_SESSION_DEFINITIONS: SessionDefinition[] = [
  { sessionNumber: 1, startMinute: 470, endMinute: 520, startTime: '07:50', endTime: '08:40', label: '07:50 – 08:40' },
  { sessionNumber: 2, startMinute: 520, endMinute: 570, startTime: '08:40', endTime: '09:30', label: '08:40 – 09:30' },
  { sessionNumber: 3, startMinute: 570, endMinute: 620, startTime: '09:30', endTime: '10:20', label: '09:30 – 10:20' },
  { sessionNumber: 4, startMinute: 620, endMinute: 670, startTime: '10:20', endTime: '11:10', label: '10:20 – 11:10' },
  { sessionNumber: 5, startMinute: 670, endMinute: 720, startTime: '11:10', endTime: '12:00', label: '11:10 – 12:00' },
  { sessionNumber: 0, startMinute: 720, endMinute: 770, startTime: '12:00', endTime: '12:50', label: '12:00 – 12:50', isBreak: true },
  { sessionNumber: 6, startMinute: 770, endMinute: 820, startTime: '12:50', endTime: '13:40', label: '12:50 – 13:40' },
  { sessionNumber: 7, startMinute: 820, endMinute: 870, startTime: '13:40', endTime: '14:30', label: '13:40 – 14:30' },
  { sessionNumber: 8, startMinute: 870, endMinute: 920, startTime: '14:30', endTime: '15:20', label: '14:30 – 15:20' },
  { sessionNumber: 0, startMinute: 920, endMinute: 970, startTime: '15:20', endTime: '16:10', label: '15:20 – 16:10', isBreak: true },
  { sessionNumber: 9, startMinute: 970, endMinute: 1020, startTime: '16:10', endTime: '17:00', label: '16:10 – 17:00' },
  { sessionNumber: 10, startMinute: 1020, endMinute: 1070, startTime: '17:00', endTime: '17:50', label: '17:00 – 17:50' },
];

/**
 * Ramadan sessions (11 active sessions, 40m each, Break: 12:00–13:00)
 */
export const RAMADAN_SESSION_DEFINITIONS: SessionDefinition[] = [
  { sessionNumber: 1, startMinute: 480, endMinute: 520, startTime: '08:00', endTime: '08:40', label: '08:00 – 08:40' },
  { sessionNumber: 2, startMinute: 520, endMinute: 560, startTime: '08:40', endTime: '09:20', label: '08:40 – 09:20' },
  { sessionNumber: 3, startMinute: 560, endMinute: 600, startTime: '09:20', endTime: '10:00', label: '09:20 – 10:00' },
  { sessionNumber: 4, startMinute: 600, endMinute: 640, startTime: '10:00', endTime: '10:40', label: '10:00 – 10:40' },
  { sessionNumber: 5, startMinute: 640, endMinute: 680, startTime: '10:40', endTime: '11:20', label: '10:40 – 11:20' },
  { sessionNumber: 6, startMinute: 680, endMinute: 720, startTime: '11:20', endTime: '12:00', label: '11:20 – 12:00' },
  { sessionNumber: 0, startMinute: 720, endMinute: 780, startTime: '12:00', endTime: '13:00', label: '12:00 – 13:00', isBreak: true },
  { sessionNumber: 7, startMinute: 780, endMinute: 820, startTime: '13:00', endTime: '13:40', label: '13:00 – 13:40' },
  { sessionNumber: 8, startMinute: 820, endMinute: 860, startTime: '13:40', endTime: '14:20', label: '13:40 – 14:20' },
  { sessionNumber: 9, startMinute: 860, endMinute: 900, startTime: '14:20', endTime: '15:00', label: '14:20 – 15:00' },
  { sessionNumber: 10, startMinute: 900, endMinute: 940, startTime: '15:00', endTime: '15:40', label: '15:00 – 15:40' },
  { sessionNumber: 11, startMinute: 940, endMinute: 980, startTime: '15:40', endTime: '16:20', label: '15:40 – 16:20' },
];

/**
 * Returns session definitions based on profile
 */
export function getSessionDefinitions(profile: AcademicTimeProfileType = 'NORMAL'): SessionDefinition[] {
  return profile === 'RAMADAN' ? RAMADAN_SESSION_DEFINITIONS : NORMAL_SESSION_DEFINITIONS;
}

/**
 * Returns active sessions (excluding break gaps)
 */
export function getActiveSessionDefinitions(profile: AcademicTimeProfileType = 'NORMAL'): SessionDefinition[] {
  return getSessionDefinitions(profile).filter((s) => !s.isBreak);
}

/**
 * Generates synthetic TimeSlot array for a profile across Monday - Friday
 */
export function generateTimeSlotsForProfile(profile: AcademicTimeProfileType = 'NORMAL'): TimeSlot[] {
  const activeSessions = getActiveSessionDefinitions(profile);
  const minutesPerSks = profile === 'RAMADAN' ? 40 : 50;
  const days = [1, 2, 3, 4, 5];
  const slots: TimeSlot[] = [];

  days.forEach((dayOfWeek) => {
    activeSessions.forEach((session) => {
      slots.push({
        id: `slot-${profile.toLowerCase()}-${dayOfWeek}-${session.startMinute}`,
        day_of_week: dayOfWeek,
        start_minute: session.startMinute,
        end_minute: session.endMinute,
        day: dayOfWeekToName(dayOfWeek),
        start_time: session.startTime,
        end_time: session.endTime,
        duration_minutes: session.endMinute - session.startMinute,
        slot_type: `Sesi ${session.sessionNumber} (${minutesPerSks}m)`,
        is_active: true,
      });
    });
  });

  return slots;
}

/**
 * Calculate end minute from start minute and session count / SKS
 */
export function calculateEndMinute(
  startMinute: number,
  sessionCount: number,
  minutesPerSession: number = 50
): number {
  return startMinute + sessionCount * minutesPerSession;
}

/**
 * Extract time profile information from workflow_state or schedule version
 */
export function getTimeProfileInfo(source?: {
  workflow_state?: any;
  minutes_per_session?: number;
  timeProfile?: AcademicTimeProfileType;
}): {
  timeProfile: AcademicTimeProfileType;
  minutesPerSks: number;
  label: string;
} {
  if (!source) {
    return {
      timeProfile: 'NORMAL',
      minutesPerSks: 50,
      label: 'Normal • 50 menit/SKS',
    };
  }

  // 1. Check direct properties
  if (source.timeProfile === 'RAMADAN' || source.minutes_per_session === 40) {
    return {
      timeProfile: 'RAMADAN',
      minutesPerSks: 40,
      label: 'Ramadan • 40 menit/SKS',
    };
  }

  // 2. Check workflow_state
  const ws = source.workflow_state;
  if (ws) {
    if (ws.timeProfile === 'RAMADAN' || ws.minutesPerSks === 40 || ws.minutes_per_session === 40) {
      return {
        timeProfile: 'RAMADAN',
        minutesPerSks: 40,
        label: 'Ramadan • 40 menit/SKS',
      };
    }
    if (typeof ws === 'string') {
      try {
        const parsed = JSON.parse(ws);
        if (parsed.timeProfile === 'RAMADAN' || parsed.minutesPerSks === 40) {
          return {
            timeProfile: 'RAMADAN',
            minutesPerSks: 40,
            label: 'Ramadan • 40 menit/SKS',
          };
        }
      } catch (_) {}
    }
  }

  return {
    timeProfile: 'NORMAL',
    minutesPerSks: 50,
    label: 'Normal • 50 menit/SKS',
  };
}

/**
 * Validates if a proposed placement crosses an academic break
 */
export function isPlacementCrossingBreak(
  startMinute: number,
  endMinute: number,
  profile: AcademicTimeProfileType = 'NORMAL'
): boolean {
  if (profile === 'RAMADAN') {
    // Ramadan Break: 12:00–13:00 (720 to 780)
    // A class starting before 12:00 (<= 720) and ending after 12:00 (> 720) crosses the break
    if (startMinute < 720 && endMinute > 720) return true;
    // A class starting during the break [720, 780) is also invalid
    if (startMinute >= 720 && startMinute < 780) return true;
  } else {
    // Normal Breaks: 12:00–12:50 (720-770) and 15:20–16:10 (920-970)
    if (startMinute < 720 && endMinute > 720) return true;
    if (startMinute >= 720 && startMinute < 770) return true;
    if (startMinute < 920 && endMinute > 920) return true;
    if (startMinute >= 920 && startMinute < 970) return true;
  }
  return false;
}
