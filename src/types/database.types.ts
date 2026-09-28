export type UserRole = 'ADMIN' | 'DOSEN' | 'MAHASISWA';

export interface AuthorizedAccount {
  email: string;
  role: 'ADMIN' | 'DOSEN';
  lecturer_id: string | null;
  user_id: string | null;
  is_active: boolean;
  is_system_owner: boolean;
  must_change_password?: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
  // joined relations
  lecturer?: Lecturer | null;
  profile?: Profile | null;
}

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  contact_email?: string | null;
  avatar_url?: string | null;
  preview_roles?: UserRole[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface AcademicTerm {
  id: string;
  academic_year: string; // e.g. "2024/2025"
  semester_type: 'GANJIL' | 'GENAP';
  is_active: boolean;
  starts_on?: string | null;
  ends_on?: string | null;
  created_at?: string;
  // Aliases for compatibility
  name?: string;
  year?: string;
  term?: 'GANJIL' | 'GENAP';
  start_date?: string;
  end_date?: string;
}

export interface Curriculum {
  id: string;
  name: string; // e.g. "Kurikulum 2022", "Kurikulum 2026"
  year: number;
  is_active: boolean;
  description?: string;
  created_at?: string;
}

export interface KBK {
  id: string;
  name: string; // "Komputer", "Sistem Tenaga Listrik", "Elektronika Komunikasi"
  code?: string;
  description?: string;
  head_lecturer_id?: string;
}

export interface Lecturer {
  id: string;
  profile_id?: string | null;
  name: string;
  lecturer_code?: string | null;
  code?: string | null; // alias
  nip?: string | null;
  nidn?: string | null;
  kbk_id?: string | null;
  expertise?: string | null;
  availability_days?: any;
  preferred_time?: any;
  email?: string | null;
  phone?: string | null;
  room_office?: string | null;
  consultation_hours?: string | null;
  status?: 'Aktif' | 'Nonaktif' | 'Cuti' | string;
  kbk?: KBK | null;
  // joined relations
  offerings_count?: number;
  total_sks?: number;
  profile?: Profile | null;
}

export interface Student {
  id: string;
  profile_id?: string | null;
  nim: string;
  full_name?: string | null;
  name?: string; // alias
  cohort?: number | null;
  batch_year?: number; // alias
  semester?: number;
  kbk_id?: string | null;
  status?: 'Aktif' | 'Cuti' | 'Lulus' | string;
  metadata?: Record<string, any> | null;
  advisor_lecturer_id?: string | null;
  kbk?: KBK | null;
  advisor?: Lecturer | null;
  profile?: Profile | null;
  // joined
  class_assignments_count?: number;
  total_sks?: number;
}

export type CourseType = 'WAJIB' | 'PILIHAN' | 'LAINNYA';

export interface Course {
  id: string;
  code?: string | null; // e.g. "TE207" or null
  name: string;
  effective_sks: number;
  sks?: number; // alias
  semester: number;
  course_type?: CourseType | string;
  category?: 'Wajib' | 'Pilihan' | string; // alias
  activity_type?: 'KULIAH' | 'PRAKTIKUM' | 'KKN' | string;
  kbk_id?: string | null;
  curriculum_id?: string | null;
  is_schedulable: boolean;
  managed_by?: string | null;
  scope?: string | null;
  legacy_id?: string | null;
  metadata?: Record<string, any> | null;
  description?: string | null;
  prerequisites?: string | null;
  kbk?: KBK | null;
  curriculum?: Curriculum | null;
  offerings_count?: number;
}

export interface CourseOffering {
  id: string;
  academic_term_id?: string;
  term_id?: string; // alias
  course_id: string;
  class_code: string; // e.g. "A", "B", "INTER", "REG"
  class_name?: string; // alias
  class_keys?: string[] | null;
  effective_sks?: number;
  expected_students: number;
  include_uts: boolean;
  include_uas: boolean;
  assignment_confirmed: boolean;
  required_room_type?: string | null;
  planning_metadata?: Record<string, any> | null;
  course?: Course | null;
  academic_term?: AcademicTerm | null;
  lecturers?: CourseOfferingLecturer[];
  course_offering_lecturers?: CourseOfferingLecturer[];
  class_assignments?: ClassAssignment[];
}

export interface CourseOfferingLecturer {
  course_offering_id: string;
  lecturer_id: string;
  assignment_role: 'PENGAMPU' | 'KOORDINATOR' | string;
  lecturer?: Lecturer | null;
  course_offering?: CourseOffering | null;
}

export interface Room {
  id: string;
  code: string; // e.g. "E101", "Lab Kom 1"
  name: string;
  capacity: number;
  room_type: string; // e.g. "KELAS", "LAB", "Ruang Kuliah Teori"
  facilities?: string | string[] | null;
  is_active: boolean;
  building?: string;
  floor?: number | string;
  metadata?: Record<string, any> | null;
  status?: string;
}

export interface TimeSlot {
  id: string;
  academic_term_id?: string | null;
  day_of_week: number; // 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu, 7 = Minggu
  start_minute: number; // e.g. 470 = 07:50
  end_minute: number; // e.g. 520 = 08:40
  is_active: boolean;
  label?: string | null;
  // helper fields
  day?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  slot_type?: string;
}

export type AvailabilityPreference = 'preferred' | 'neutral' | 'avoid';

export interface LecturerAvailability {
  id: string;
  lecturer_id: string;
  academic_term_id?: string | null;
  day_of_week: number;
  start_minute: number;
  end_minute: number;
  is_available: boolean; // false = HARD UNAVAILABLE
  preference: AvailabilityPreference;
  notes?: string | null;
  // joined
  lecturer?: Lecturer | null;
  time_slot?: TimeSlot | null;
  day?: string;
  start_time?: string;
  end_time?: string;
}

export interface ClassAssignment {
  id: string;
  academic_term_id?: string | null;
  student_id: string;
  course_offering_id: string;
  assignment_source: 'MANUAL' | 'IMPORT' | 'SYSTEM' | string;
  locked: boolean;
  assigned_at?: string;
  student?: Student | null;
  course_offering?: CourseOffering | null;
}

export interface ScheduleVersion {
  id: string;
  version_number?: string;
  title: string;
  term_id?: string;
  academic_term_id?: string;
  version_type?: string;
  type?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'REPLACED' | string;
  revision: number;
  scope_offering_ids?: string[] | null;
  workflow_state?: any;
  source_version_id?: string | null;
  source_version?: ScheduleVersion | null;
  entries_count?: number;
  created_at: string;
  updated_at?: string;
  published_at?: string | null;
  withdrawn_at?: string | null;
  withdrawn_by?: string | null;
  created_by?: string | null;
  changelog?: string | null;
  academic_term?: AcademicTerm | null;
}

export interface ScheduleDraftEntryInput {
  course_offering_id: string;
  room_id: string;
  day_of_week: number;
  exam_date?: string | null;
  start_minute: number;
  minutes_per_session?: number;
}

export interface ScheduleEntry {
  id: string;
  schedule_version_id: string;
  course_offering_id: string;
  room_id: string;
  time_slot_id?: string | null;
  day_of_week?: number;
  start_minute?: number;
  end_minute?: number;
  exam_date?: string | null;
  day?: string;
  start_time?: string;
  end_time?: string;
  minutes_per_session?: number;
  // Snapshots
  course_name?: string;
  course_code?: string;
  class_code?: string;
  student_count?: number;
  room_capacity?: number;
  lecturer_ids?: string[];
  lecturer_names?: string[] | string;
  session_count?: number;
  // Relations
  course_offering?: CourseOffering | null;
  room?: Room | null;
  time_slot?: TimeSlot | null;
}

export interface CurrentPublishedSchedule {
  id: string; // Real schedule_entries.id UUID
  scheduleEntryId?: string;
  uiKey?: string;
  schedule_version_id?: string;
  term_id: string;
  academic_term_id?: string;
  course_id: string;
  course_code: string;
  course_name: string;
  sks: number;
  class_name: string;
  day: string;
  day_of_week?: number;
  start_minute?: number;
  end_minute?: number;
  start_time: string;
  end_time: string;
  minutes_per_session?: number;
  time_profile?: string;
  room_id: string;
  room_code: string;
  room_name: string;
  lecturer_names: string | string[];
  kbk_name?: string;
  session_count?: number;
  effective_sks?: number;
  course_offering_id?: string;
  course_offering?: any;
  student_count?: number;
  expected_students?: number;
  semester?: number;
}

export interface ScheduleConflict {
  id: string;
  schedule_version_id?: string | null;
  conflict_type: 'ROOM' | 'LECTURER' | 'STUDENT' | 'CLASS' | 'CAPACITY';
  severity: 'KRITIS' | 'TINGGI' | 'SEDANG' | 'RENDAH' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  is_resolved: boolean;
  conflict_source?: string | null;
  suggested_action?: string | null;
  course_name?: string;
  course_code?: string;
  lecturer_name?: string;
  room_code?: string;
  day?: string;
  time?: string;
  created_at?: string;
}

export interface ScheduleSuggestion {
  id: string;
  conflict_id: string;
  suggestion_type: string;
  description: string;
  applied: boolean;
}

export interface ExamSession {
  id: string;
  legacy_id?: string | null;
  name: string;
  start_minute: number;
  end_minute: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExamEntry {
  id: string;
  schedule_version_id: string;
  course_offering_id: string;
  exam_session_id: string;
  exam_date: string; // YYYY-MM-DD
  start_minute: number;
  duration_minutes: number;
  end_minute: number;
  room_ids: string[];
  room_names?: string[];
  room_capacity?: number;
  student_count?: number;
  lecturer_ids?: string[];
  lecturer_names?: string[];
  supervisor_ids?: string[];
  supervisor_names?: string[];
  course_name?: string;
  course_code?: string;
  class_code?: string;
  class_keys?: string[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExamDraftEntryInput {
  course_offering_id: string;
  exam_session_id: string;
  exam_date: string; // YYYY-MM-DD
  duration_minutes: number;
  room_ids: string[];
  supervisor_ids: string[];
  notes?: string | null;
}

export interface CurrentPublishedExam {
  id: string;
  schedule_version_id?: string;
  course_offering_id?: string;
  exam_session_id?: string;
  academic_term_id?: string;
  term_id?: string;
  type?: 'UTS' | 'UAS';
  exam_type?: 'UTS' | 'UAS';
  date?: string;
  exam_date?: string;
  day?: string;
  start_time?: string;
  end_time?: string;
  start_minute?: number;
  end_minute?: number;
  duration_minutes?: number;
  course_name: string;
  course_code: string;
  class_name?: string;
  class_code?: string;
  class_keys?: string[];
  room_code?: string;
  room_name?: string;
  room_ids?: string[];
  room_names?: string[];
  room_capacity?: number;
  student_count?: number;
  proctor_names?: string;
  supervisor_names?: string[];
  supervisor_ids?: string[];
  lecturer_names?: string[];
  lecturer_ids?: string[];
  notes?: string | null;
  version_number?: string;
  published_at?: string;
  status?: string;
  session_name?: string;
  semester?: number;
}

export interface ExamWorkflowConfig {
  examType: 'UTS' | 'UAS';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  allowedDays: number[]; // 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
  defaultDurationMinutes: number;
  selectedSessionIds: string[];
}

export interface ExamSourceOffering {
  schedule_entry_id: string;
  course_offering_id: string;
  course_code: string;
  course_name: string;
  class_code: string;
  semester: number;
  effective_sks: number;
  student_count: number;
  required_room_type?: string;
  primary_lecturer_id: string;
  primary_lecturer_name: string;
  preferred_room_id?: string | null;
  preferred_room_code?: string | null;
  preferred_room_name?: string | null;
  preferred_room_capacity?: number | null;
}

export interface ExamWorkflowState {
  activeStep: number; // 1 to 5
  examType: 'UTS' | 'UAS';
  config: ExamWorkflowConfig;
  selectedOfferingIds: string[];
  supervisorAssignments: Record<string, { primaryId: string; secondaryId?: string }>;
  roomPreferences: Record<string, string[]>; // offeringId -> room_ids[]
  generationSummary?: {
    totalExams: number;
    scheduledExams: number;
    conflictCount: number;
    roomsUsedCount: number;
    supervisorsUsedCount: number;
  };
  lastSavedAt?: string;
}

export interface LecturerCourseAssignment {
  semester: number;
  course_code: string;
  course_name: string;
  class_code: string;
  effective_sks: number;
  lecturer_code?: string | null;
  lecturer_name: string;
  nip?: string | null;
  assignment_role?: 'PENGAMPU' | 'KOORDINATOR' | string | null;
  academic_year?: string | null;
  semester_type?: 'GANJIL' | 'GENAP' | string | null;
}

export interface CurriculumPackageCourse {
  code: string;
  name: string;
  sks: number;
  order: number;
  source_names?: string[];
  source_sheets?: string[];
}

export interface CurriculumPackagePayload {
  curriculum_year: number; // e.g. 2022 | 2026
  semester?: number | null; // e.g. 1..8
  scope?: string;
  kbk_code?: string | null; // 'STL' | 'KOMPUTER' | 'ELKOM'
  kbk_name?: string | null;
  legacy_track?: string | null; // 'TELEKOMUNIKASI' | 'ELEKTRONIKA'
  package_type?: string; // 'SEMESTER_REGULER' | 'ELECTIVE_CATALOG'
  course_count?: number;
  total_sks?: number;
  courses: CurriculumPackageCourse[];
  [key: string]: any;
}

export interface CurriculumPackage {
  id: string;
  curriculum_id?: string | null;
  legacy_id?: string | null;
  name: string;
  payload: CurriculumPackagePayload;
  created_at?: string;
  updated_at?: string;
}

export interface PlannedCourse {
  selectionKey: string; // `${packageId}:${course.code}`
  packageId: string;
  packageName: string;
  courseCode: string;
  courseName: string;
  sks: number;
  semester: number;
  curriculumYear: number;
  kbkCode?: string | null;
  kbkName?: string | null;
  legacyTrack?: string | null;
  category?: string;
  totalParticipants: number;
}

export interface CourseOfferingRombelItem {
  id: string; // course_offering.id
  academic_term_id: string;
  course_id: string;
  class_code: string;
  effective_sks: number;
  expected_students: number;
  required_room_type?: string | null;
  assignment_confirmed?: boolean;
  active: boolean;
  currentParticipants: number;
  targetRoomCapacity?: number | null;
  seatWaste?: number;
  isOversized?: boolean;
}

export interface CourseRombelGroup {
  selectionKey: string;
  packageId: string;
  packageName: string;
  courseId?: string | null;
  courseCode: string;
  courseName: string;
  semester: number;
  curriculumYear: number;
  sks: number;
  category?: string;
  requiredRoomType: string;
  totalParticipantsStep1: number;
  offerings: CourseOfferingRombelItem[];
  totalDistributed: number;
  remaining: number;
  maxEligibleCapacity: number;
  eligibleCapacities: number[];
  minimumSections: number;
  totalSeatWaste: number;
  hasOversizedOffering: boolean;
  status: 'LENGKAP' | 'KURANG' | 'LEBIH' | 'TIDAK_FEASIBLE' | 'TIDAK_ADA_KELAS';
}

export interface RombelOfferingDraft {
  active: boolean;
  expectedStudents: number;
  targetRoomCapacity?: number | null;
}

export interface Step3LecturerItem {
  lecturerId: string;
  lecturerName: string;
  lecturerCode: string;
  nip?: string | null;
  kbkId?: string | null;
  expertise?: string | null;
  status?: string | null;
  availabilityDays?: any;
  preferredTime?: any;
  assignmentRole: 'PENGAMPU' | 'KOORDINATOR' | string;
  isLecturerMissing: boolean;
  isLecturerInactive: boolean;
  sourceRowId?: string | null;
}

export interface OptimizationRun {
  id: string;
  schedule_version_id?: string | null;
  academic_term_id?: string | null;
  term_id?: string | null;
  algorithm: string;
  status: 'COMPLETED' | 'COMPLETED_WITH_WARNINGS' | 'RUNNING' | 'FAILED' | 'STOPPED' | string;
  iterations?: number;
  initial_cost?: number;
  best_cost?: number;
  final_cost?: number;
  runtime_ms?: number;
  execution_time_ms?: number;
  hard_conflicts_count?: number;
  soft_conflicts_count?: number;
  config?: Record<string, any> | null;
  metrics?: Record<string, any> | null;
  created_at: string;
  finished_at?: string | null;
  // joined relations
  schedule_version?: ScheduleVersion | null;
  academic_term?: AcademicTerm | null;
}

export interface SAExperimentConfig {
  initialTemperature: number;
  coolingRate: number;
  minTemperature: number;
  maxIterations: number;
  seed: number;
  stopOnZeroHardConflicts?: boolean;
}

export interface SAMultiRunSummary {
  runCount: number;
  runs: {
    runIndex: number;
    seed: number;
    initialCost: number;
    finalCost: number;
    initialHardConflicts: number;
    finalHardConflicts: number;
    costReductionPercent: number;
    runtimeMs: number;
    iterations: number;
    success: boolean;
  }[];
  meanInitialCost: number;
  meanFinalCost: number;
  meanCostReductionPercent: number;
  stdDevFinalCost: number;
  minFinalCost: number;
  maxFinalCost: number;
  meanRuntimeMs: number;
  stdDevRuntimeMs: number;
  successRatePercent: number; // percentage with 0 hard conflicts
  bestSeed: number;
  bestFinalCost: number;
}

export interface SAParameterComparison {
  parameterName: string;
  testedValues: (number | string)[];
  results: {
    value: number | string;
    label: string;
    meanFinalCost: number;
    meanRuntimeMs: number;
    meanIterations: number;
    hardConflictClearanceRate: number;
    convergenceSpeed: string;
  }[];
  recommendation: string;
}

export interface Step3OfferingLecturerRow {
  offeringId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  classCode: string;
  semester: number;
  curriculumYear: number;
  effectiveSks: number;
  expectedStudents: number;
  requiredRoomType: string;
  targetRoomCapacity?: number | null;
  // Candidates & Selected Primary Lecturer (EXACTLY 1 PRIMARY)
  primaryLecturer: Step3LecturerItem | null;
  primaryLecturerId: string | null;
  candidates: Step3LecturerItem[];
  pengampuList: Step3LecturerItem[];
  koordinatorList: Step3LecturerItem[];
  lecturers: Step3LecturerItem[];
  hasMultipleCandidates: boolean;
  totalCandidates: number;
  isManuallySelected: boolean;
  status:
    | 'SIAP'
    | 'PILIH_DOSEN'
    | 'BELUM_ADA_PENGAMPU'
    | 'DOSEN_TIDAK_AKTIF'
    | 'DOSEN_TIDAK_DITEMUKAN';
  hasPengampu: boolean;
  isTeamTeaching?: boolean; // legacy helper
  hasInactiveLecturer: boolean;
  hasMissingLecturer: boolean;
  isValid: boolean;
}



