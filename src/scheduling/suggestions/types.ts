import {
  ScheduleEntry,
  Room,
  TimeSlot,
  LecturerAvailability,
  CourseOffering,
  Lecturer,
} from '../../types';
import { ClientConflict } from '../../lib/scheduleValidator';

export type SuggestionType = 'MOVE_TIME' | 'MOVE_ROOM' | 'MOVE_TIME_ROOM' | 'SWAP';
export type SuggestionStatus = 'PENDING' | 'APPLIED' | 'REJECTED';

export interface ProposedPlacement {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  roomId: string;
  dayName: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  roomName: string;
}

export interface ProposedSwapChange {
  sourceEntryId: string;
  targetEntryId: string;
  sourceOfferingId: string;
  targetOfferingId: string;
  sourceCourseName: string;
  targetCourseName: string;
  sourcePlacement: ProposedPlacement;
  targetPlacement: ProposedPlacement;
}

export interface SmartSuggestion {
  id: string;
  scheduleVersionId?: string;
  conflictId?: string;
  scheduleEntryId: string;
  courseOfferingId: string;
  courseName: string;
  courseCode?: string;
  classCode: string;
  suggestionType: SuggestionType;
  title: string;
  rationale: string;
  currentPlacement: ProposedPlacement;
  proposedPlacement: ProposedPlacement;
  swapDetails?: ProposedSwapChange;
  score: number; // 0 to 100
  status: SuggestionStatus;
  impact: {
    resolvedConflictsCount: number;
    newConflictsCount: number;
    resolvedConflictTitles: string[];
    hardConflictFree: boolean;
    softCostImprovement: number;
  };
  createdAt: string;
  appliedAt?: string | null;
  appliedBy?: string | null;
}

export interface SuggestionEngineInput {
  versionId?: string;
  currentEntries: ScheduleEntry[];
  targetEntryId?: string;
  targetConflictId?: string;
  rooms: Room[];
  activeTimeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  offerings: CourseOffering[];
  lecturers: Lecturer[];
  existingConflicts?: ClientConflict[];
  maxSuggestionsPerItem?: number;
}

export interface LockedEntryState {
  entryId: string;
  courseOfferingId: string;
  courseName: string;
  classCode: string;
  isLocked: boolean;
  day: string;
  timeRange: string;
  roomName: string;
  hasConflict: boolean;
}

export interface PartialOptimizationParams {
  versionId: string;
  currentEntries: ScheduleEntry[];
  lockedEntryIds: string[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  offerings: CourseOffering[];
  lecturers: Lecturer[];
  maxIterations?: number;
  initialTemperature?: number;
  coolingRate?: number;
  seed?: number;
}

export interface PartialOptimizationResult {
  success: boolean;
  optimizedEntries: ScheduleEntry[];
  initialConflictsCount: number;
  finalConflictsCount: number;
  unlockedMovedCount: number;
  lockedCount: number;
  iterations: number;
  timeElapsedMs: number;
  seed: number;
  changelog: string[];
}
