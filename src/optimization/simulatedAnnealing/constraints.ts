import {
  SAEntry,
  SAOfferingContext,
  SARoomContext,
  SALecturerAvailabilityContext,
  ConsecutiveSlot,
  HardConflictDetail,
} from './types';

/**
 * Checks if two time intervals on the same day overlap.
 * startA < endB && startB < endA
 */
export function intervalsOverlap(
  dayA: number,
  startA: number,
  endA: number,
  dayB: number,
  startB: number,
  endB: number
): boolean {
  if (Number(dayA) !== Number(dayB)) return false;
  return startA < endB && startB < endA;
}

/**
 * Checks if class codes overlap (e.g. 'A' overlaps with 'A', 'A/B' overlaps with 'A' or 'B')
 */
export function classCodesOverlap(classA: string, classB: string): boolean {
  if (!classA || !classB) return false;
  if (classA.trim().toUpperCase() === classB.trim().toUpperCase()) return true;

  const partsA = classA
    .split(/[/,-]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const partsB = classB
    .split(/[/,-]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  for (const a of partsA) {
    if (partsB.includes(a)) return true;
  }
  return false;
}

/**
 * Checks HC8: Friday Prayer interval (Jumat 11:30 - 13:00 -> 690 to 780 minutes)
 */
export function isFridayPrayerOverlap(dayOfWeek: number, startMinute: number, endMinute: number): boolean {
  if (Number(dayOfWeek) !== 5) return false;
  // Overlaps with 11:30 (690) - 13:00 (780)
  return startMinute < 780 && endMinute > 690;
}

/**
 * Helper to check whether an assigned slot sequence is valid and consecutive
 */
export function isValidConsecutiveSequence(
  dayOfWeek: number,
  startMinute: number,
  sks: number,
  validSequencesBySks: Record<number, ConsecutiveSlot[]>
): boolean {
  const sequences = validSequencesBySks[sks] || [];
  return sequences.some(
    (seq) => Number(seq.dayOfWeek) === Number(dayOfWeek) && seq.startMinute === startMinute
  );
}

/**
 * Checks if offering's scheduled time overlaps with any lecturer unavailable block
 */
export function isLecturerUnavailable(
  lecturerId: string,
  dayOfWeek: number,
  startMinute: number,
  endMinute: number,
  availabilitiesMap: Map<string, SALecturerAvailabilityContext[]>
): boolean {
  const avails = availabilitiesMap.get(lecturerId);
  if (!avails || avails.length === 0) return false;

  for (const av of avails) {
    if (
      Number(av.dayOfWeek) === Number(dayOfWeek) &&
      av.isAvailable === false &&
      startMinute < av.endMinute &&
      av.startMinute < endMinute
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if offering's scheduled time hits a lecturer preferred or avoid preference
 */
export function getLecturerPreference(
  lecturerId: string,
  dayOfWeek: number,
  startMinute: number,
  endMinute: number,
  availabilitiesMap: Map<string, SALecturerAvailabilityContext[]>
): 'preferred' | 'avoid' | 'neutral' {
  const avails = availabilitiesMap.get(lecturerId);
  if (!avails || avails.length === 0) return 'neutral';

  for (const av of avails) {
    if (
      Number(av.dayOfWeek) === Number(dayOfWeek) &&
      startMinute < av.endMinute &&
      av.startMinute < endMinute
    ) {
      if (av.preference === 'preferred') return 'preferred';
      if (av.preference === 'avoid') return 'avoid';
    }
  }
  return 'neutral';
}
