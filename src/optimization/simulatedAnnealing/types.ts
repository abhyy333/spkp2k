export interface SAEntry {
  courseOfferingId: string;
  roomId: string;
  dayOfWeek: number;
  startMinute: number;
}

export type SASolution = SAEntry[];

export interface SAOfferingContext {
  id: string; // courseOfferingId
  courseId: string;
  courseCode: string;
  courseName: string;
  classCode: string;
  semester: number;
  curriculumYear: number;
  kbk?: string | null;
  effectiveSks: number;
  durationMinutes: number; // effectiveSks * 50
  expectedStudents: number;
  requiredRoomType: string;
  primaryLecturerId: string;
  primaryLecturerName: string;
  primaryLecturerCode?: string;
}

export interface SARoomContext {
  id: string;
  code: string;
  name: string;
  capacity: number;
  roomType: string;
  isActive: boolean;
}

export interface SATimeSlotContext {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
}

export interface SALecturerAvailabilityContext {
  lecturerId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  isAvailable: boolean;
  preference: 'preferred' | 'avoid' | 'neutral' | string;
}

export interface ConsecutiveSlot {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  sessionCount: number;
}

export interface SAProblemData {
  offerings: SAOfferingContext[];
  rooms: SARoomContext[];
  timeSlots: SATimeSlotContext[];
  availabilities: SALecturerAvailabilityContext[];
  validSequencesBySks: Record<number, ConsecutiveSlot[]>;
}

export interface SAWeights {
  hc1RoomOverlap: number;
  hc2LecturerOverlap: number;
  hc3ClassGroupConflict: number;
  hc4CapacityExceeded: number;
  hc5RoomTypeMismatch: number;
  hc6LecturerUnavailable: number;
  hc7InvalidSlotSequence: number;
  hc8FridayPrayer: number;
  hc9InactiveRoom: number;

  sc1LecturerAvoidPreference: number;
  sc1LecturerPreferredBonus: number;
  sc2RoomWaste: number;
  sc3LecturerDailyOverload: number;
  sc4CohortDaySpread: number;
}

export interface SAConfig {
  initialTemperature: number;
  coolingRate: number;
  minTemperature: number;
  maxIterations: number;
  seed: number;
  weights: SAWeights;
  stopOnZeroHardConflicts?: boolean;
}

export interface HardConflictDetail {
  type:
    | 'HC1_ROOM_OVERLAP'
    | 'HC2_LECTURER_OVERLAP'
    | 'HC3_CLASS_GROUP_CONFLICT'
    | 'HC4_CAPACITY_EXCEEDED'
    | 'HC5_ROOM_TYPE_MISMATCH'
    | 'HC6_LECTURER_UNAVAILABLE'
    | 'HC7_INVALID_SLOT'
    | 'HC8_FRIDAY_PRAYER'
    | 'HC9_INACTIVE_ROOM';
  description: string;
  offeringIds: string[];
  roomId?: string;
  lecturerId?: string;
  dayOfWeek?: number;
  startMinute?: number;
  endMinute?: number;
}

export interface SACostBreakdown {
  totalCost: number;
  hardCost: number;
  softCost: number;
  hardConflictsCount: number;
  softPenaltiesCount: number;
  hc1Count: number;
  hc2Count: number;
  hc3Count: number;
  hc4Count: number;
  hc5Count: number;
  hc6Count: number;
  hc7Count: number;
  hc8Count: number;
  hc9Count: number;
  conflicts: HardConflictDetail[];
}

export interface SAMetricPoint {
  iteration: number;
  temperature: number;
  currentCost: number;
  bestCost: number;
  currentHardCost: number;
  bestHardCost: number;
  hardConflictsCount: number;
  acceptedMoves: number;
}

export interface SAProgress {
  iteration: number;
  maxIterations: number;
  temperature: number;
  progressPercent: number;
  currentCost: number;
  bestCost: number;
  hardConflictsCount: number;
  acceptanceRate: number;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED';
  metrics: SAMetricPoint[];
}

export interface SAResult {
  bestSolution: SASolution;
  bestCost: SACostBreakdown;
  initialCost: SACostBreakdown;
  iterations: number;
  acceptedMoves: number;
  improvedMoves: number;
  executionTimeMs: number;
  seed: number;
  metrics: SAMetricPoint[];
}
