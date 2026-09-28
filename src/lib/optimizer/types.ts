import {
  CourseOffering,
  Room,
  TimeSlot,
  LecturerAvailability,
  Lecturer,
} from '../../types';

export interface SchedulableOffering {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  classCode: string;
  effectiveSks: number;
  expectedStudents: number;
  requiredRoomType: string;
  semester: number;
  lecturerIds: string[];
  lecturerNames: string[];
}

export interface ScheduleAssignment {
  courseOfferingId: string;
  dayOfWeek: number;     // 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat
  startMinute: number;   // e.g. 470 = 07:50
  roomId: string;
}

export type ScheduleSolution = ScheduleAssignment[];

export interface ConstraintWeights {
  hardRoomOverlap: number;          // Default 1000
  hardLecturerOverlap: number;      // Default 1000
  hardCapacity: number;             // Default 1000
  hardRoomType: number;             // Default 1000
  hardSlotContinuity: number;       // Default 1000
  hardLecturerUnavailable: number;  // Default 1000

  softLecturerPreference: number;   // Default 40 (avoid penalty)
  softFridayPrayer: number;         // Default 60 (Jumat 11:30 - 13:00)
  softLecturerDailyLoad: number;    // Default 25 (>3 kelas per hari)
  softSemesterConflict: number;     // Default 35 (semester sama tabrakan waktu)
  softRoomCompactness: number;      // Default 10 (kapasitas terlalu longgar)
}

export interface SAConfig {
  initialTemperature: number; // e.g. 100
  coolingRate: number;        // e.g. 0.98 (alpha)
  minTemperature: number;     // e.g. 0.01
  maxIterations: number;      // e.g. 2000
  seed: number;               // Reproducibility seed (e.g. 42)
  weights: ConstraintWeights;
  allowEarlyExitOnZeroHard: boolean;
}

export interface ConstraintViolation {
  id: string;
  type:
    | 'ROOM_OVERLAP'
    | 'LECTURER_OVERLAP'
    | 'CAPACITY_EXCEEDED'
    | 'ROOM_TYPE_MISMATCH'
    | 'TIME_SLOT_DISCONTINUOUS'
    | 'LECTURER_UNAVAILABLE'
    | 'LECTURER_PREFERENCE_AVOID'
    | 'FRIDAY_PRAYER_OVERLAP'
    | 'LECTURER_OVERLOAD'
    | 'SEMESTER_COLLISION'
    | 'ROOM_UNDERUTILIZED';
  category: 'HARD' | 'SOFT';
  penalty: number;
  title: string;
  description: string;
  offeringIds: string[];
  dayOfWeek?: number;
  startMinute?: number;
  roomId?: string;
  lecturerId?: string;
}

export interface CostBreakdown {
  totalCost: number;
  hardCost: number;
  softCost: number;
  hardViolationsCount: number;
  softViolationsCount: number;
  violations: ConstraintViolation[];
}

export interface PreValidationIssue {
  id: string;
  offeringId?: string;
  offeringName?: string;
  classCode?: string;
  issue: string;
  severity: 'ERROR' | 'WARNING';
}

export interface PreValidationResult {
  isReady: boolean;
  totalOfferings: number;
  readyOfferingsCount: number;
  errors: PreValidationIssue[];
  warnings: PreValidationIssue[];
  summary: {
    missingLecturersCount: number;
    missingStudentsCount: number;
    missingSksCount: number;
    missingRoomTypeCount: number;
    roomsCount: number;
    timeSlotsCount: number;
  };
}

export interface OptimizationMetricPoint {
  iteration: number;
  temperature: number;
  currentCost: number;
  bestCost: number;
  hardViolations: number;
  softViolations: number;
  acceptanceRate: number;
}

export type OptimizationStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED_EARLY';

export interface OptimizationProgress {
  iteration: number;
  totalIterations: number;
  temperature: number;
  currentCost: number;
  bestCost: number;
  initialCost: number;
  hardViolations: number;
  softViolations: number;
  acceptedMoves: number;
  rejectedMoves: number;
  improvedMoves: number;
  acceptanceRate: number;
  timeElapsedMs: number;
  status: OptimizationStatus;
  history: OptimizationMetricPoint[];
}

export interface OptimizationResult {
  success: boolean;
  initialSolution: ScheduleSolution;
  initialCostBreakdown: CostBreakdown;
  bestSolution: ScheduleSolution;
  bestCostBreakdown: CostBreakdown;
  totalIterations: number;
  timeElapsedMs: number;
  finalTemperature: number;
  acceptanceRate: number;
  seed: number;
  config: SAConfig;
  progressHistory: OptimizationMetricPoint[];
}

export interface ProblemData {
  offerings: SchedulableOffering[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  lecturers: Lecturer[];
}
