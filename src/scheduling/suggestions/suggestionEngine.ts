import {
  ScheduleEntry,
  Room,
  TimeSlot,
  LecturerAvailability,
  CourseOffering,
  Lecturer,
} from '../../types';
import { SmartSuggestion, SuggestionEngineInput } from './types';
import { generateCandidateMoves } from './candidateGenerator';
import { evaluateCandidateMove } from './candidateValidator';
import { scoreAndFormatSuggestion } from './candidateScoring';
import { detectAllScheduleConflicts, ClientConflict } from '../../lib/scheduleValidator';

/**
 * Generate smart suggestions for a single specific ScheduleEntry
 */
export function generateSuggestionsForEntry(params: {
  entry: ScheduleEntry;
  currentEntries: ScheduleEntry[];
  rooms: Room[];
  activeTimeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  offerings: CourseOffering[];
  lecturers: Lecturer[];
  versionId?: string;
  targetConflictId?: string;
  cachedConflicts?: ClientConflict[];
  maxSuggestions?: number;
}): SmartSuggestion[] {
  const {
    entry,
    currentEntries,
    rooms,
    activeTimeSlots,
    availabilities,
    offerings,
    lecturers,
    versionId,
    targetConflictId,
    cachedConflicts,
    maxSuggestions = 5,
  } = params;

  const offering =
    offerings.find((o) => o.id === entry.course_offering_id) || entry.course_offering;

  if (!offering) return [];

  // 1. Generate candidate moves
  const candidateMoves = generateCandidateMoves({
    entry,
    currentEntries,
    rooms,
    activeTimeSlots,
    availabilities,
    offering: offering as CourseOffering,
    maxCandidates: 35,
  });

  // 2. Evaluate candidates
  const evaluatedList = candidateMoves.map((cand) =>
    evaluateCandidateMove({
      candidate: cand,
      currentEntries,
      rooms,
      activeTimeSlots,
      availabilities,
      offerings,
      lecturers,
      cachedInitialConflicts: cachedConflicts,
    })
  );

  // 3. Filter feasible candidates and score them
  const validEvaluated = evaluatedList.filter(
    (ev) => ev.isFeasible && ev.newConflicts.length === 0
  );

  // If no zero-new-conflicts candidate, allow minor new conflicts if net resolved > 0
  const candidatePool =
    validEvaluated.length > 0
      ? validEvaluated
      : evaluatedList.filter((ev) => ev.resolvedConflicts.length > ev.newConflicts.length);

  const formattedSuggestions = candidatePool.map((ev) =>
    scoreAndFormatSuggestion(ev, versionId, targetConflictId)
  );

  // 4. Sort by score descending and deduplicate by key placement
  formattedSuggestions.sort((a, b) => b.score - a.score);

  const seenKeys = new Set<string>();
  const uniqueSuggestions: SmartSuggestion[] = [];

  for (const s of formattedSuggestions) {
    const key = `${s.suggestionType}-${s.proposedPlacement.dayOfWeek}-${s.proposedPlacement.startMinute}-${s.proposedPlacement.roomId}-${s.swapDetails?.targetEntryId || ''}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueSuggestions.push(s);
      if (uniqueSuggestions.length >= maxSuggestions) break;
    }
  }

  return uniqueSuggestions;
}

/**
 * Generate smart suggestions for a specific conflict
 */
export function generateSuggestionsForConflict(params: {
  conflict: ClientConflict;
  currentEntries: ScheduleEntry[];
  rooms: Room[];
  activeTimeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  offerings: CourseOffering[];
  lecturers: Lecturer[];
  versionId?: string;
  maxSuggestions?: number;
}): SmartSuggestion[] {
  const {
    conflict,
    currentEntries,
    rooms,
    activeTimeSlots,
    availabilities,
    offerings,
    lecturers,
    versionId,
    maxSuggestions = 6,
  } = params;

  const relevantEntries = currentEntries.filter(
    (e) =>
      conflict.entryIds.includes(e.id) ||
      conflict.courseOfferingIds.includes(e.course_offering_id)
  );

  const allSuggestions: SmartSuggestion[] = [];

  for (const entry of relevantEntries) {
    const entrySuggestions = generateSuggestionsForEntry({
      entry,
      currentEntries,
      rooms,
      activeTimeSlots,
      availabilities,
      offerings,
      lecturers,
      versionId,
      targetConflictId: conflict.id,
      maxSuggestions: 3,
    });
    allSuggestions.push(...entrySuggestions);
  }

  allSuggestions.sort((a, b) => b.score - a.score);
  return allSuggestions.slice(0, maxSuggestions);
}

/**
 * Generate global suggestions across the entire schedule
 */
export function generateGlobalSuggestions(
  input: SuggestionEngineInput
): SmartSuggestion[] {
  const {
    versionId,
    currentEntries,
    rooms,
    activeTimeSlots,
    availabilities,
    offerings,
    lecturers,
    existingConflicts,
    maxSuggestionsPerItem = 3,
  } = input;

  const conflicts =
    existingConflicts ||
    detectAllScheduleConflicts(currentEntries, rooms, availabilities);

  if (conflicts.length === 0) {
    // Also check if any entry can be optimized for room tightness or lecturer preferences
    return [];
  }

  // Find all entries involved in conflicts
  const conflictedEntryIds = new Set<string>();
  const conflictedOfferingIds = new Set<string>();

  conflicts.forEach((c) => {
    c.entryIds.forEach((id) => conflictedEntryIds.add(id));
    c.courseOfferingIds.forEach((id) => conflictedOfferingIds.add(id));
  });

  const targetEntries = currentEntries.filter(
    (e) => conflictedEntryIds.has(e.id) || conflictedOfferingIds.has(e.course_offering_id)
  );

  const results: SmartSuggestion[] = [];

  targetEntries.forEach((entry) => {
    const suggestions = generateSuggestionsForEntry({
      entry,
      currentEntries,
      rooms,
      activeTimeSlots,
      availabilities,
      offerings,
      lecturers,
      versionId,
      cachedConflicts: conflicts,
      maxSuggestions: maxSuggestionsPerItem,
    });

    results.push(...suggestions);
  });

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Apply a suggestion to the draft schedule entries array
 */
export function applySuggestionToEntries(
  currentEntries: ScheduleEntry[],
  suggestion: SmartSuggestion,
  rooms: Room[]
): ScheduleEntry[] {
  if (suggestion.suggestionType === 'SWAP' && suggestion.swapDetails) {
    const { sourceEntryId, targetEntryId, sourcePlacement, targetPlacement } =
      suggestion.swapDetails;

    return currentEntries.map((e) => {
      if (e.id === sourceEntryId) {
        const r = rooms.find((room) => room.id === sourcePlacement.roomId);
        return {
          ...e,
          day_of_week: sourcePlacement.dayOfWeek,
          start_minute: sourcePlacement.startMinute,
          end_minute: sourcePlacement.endMinute,
          room_id: sourcePlacement.roomId,
          day: sourcePlacement.dayName,
          start_time: sourcePlacement.startTime,
          end_time: sourcePlacement.endTime,
          room: r || e.room,
        };
      }
      if (e.id === targetEntryId) {
        const r = rooms.find((room) => room.id === targetPlacement.roomId);
        return {
          ...e,
          day_of_week: targetPlacement.dayOfWeek,
          start_minute: targetPlacement.startMinute,
          end_minute: targetPlacement.endMinute,
          room_id: targetPlacement.roomId,
          day: targetPlacement.dayName,
          start_time: targetPlacement.startTime,
          end_time: targetPlacement.endTime,
          room: r || e.room,
        };
      }
      return e;
    });
  }

  // Single Move
  return currentEntries.map((e) => {
    if (e.id === suggestion.scheduleEntryId) {
      const r = rooms.find((room) => room.id === suggestion.proposedPlacement.roomId);
      return {
        ...e,
        day_of_week: suggestion.proposedPlacement.dayOfWeek,
        start_minute: suggestion.proposedPlacement.startMinute,
        end_minute: suggestion.proposedPlacement.endMinute,
        room_id: suggestion.proposedPlacement.roomId,
        day: suggestion.proposedPlacement.dayName,
        start_time: suggestion.proposedPlacement.startTime,
        end_time: suggestion.proposedPlacement.endTime,
        room: r || e.room,
      };
    }
    return e;
  });
}
