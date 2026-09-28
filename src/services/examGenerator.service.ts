import {
  ExamSession,
  ExamEntry,
  ExamDraftEntryInput,
  Room,
  Lecturer,
  CourseOffering,
  Course,
  LecturerAvailability,
  ExamSourceOffering,
} from '../types';

export interface ExamGenerationInput {
  examType: 'UTS' | 'UAS';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  allowedDays: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  defaultDurationMinutes: number;
  sessions: ExamSession[];
  offerings: (CourseOffering | ExamSourceOffering)[];
  rooms: Room[];
  lecturers: Lecturer[];
  supervisorAssignments: Record<string, { primaryId: string; secondaryId?: string }>;
  roomPreferences: Record<string, string[]>; // offeringId -> room_ids[]
  availabilities?: LecturerAvailability[];
}

export interface GeneratedExamSlot {
  courseOfferingId: string;
  courseName: string;
  courseCode: string;
  classCode: string;
  semester: number;
  expectedStudents: number;
  examDate: string; // YYYY-MM-DD
  dayOfWeek: number;
  sessionId: string;
  sessionName: string;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  roomIds: string[];
  roomNames: string[];
  roomCapacity: number;
  supervisorIds: string[];
  supervisorNames: string[];
  isConflict: boolean;
  conflictReasons: string[];
}

export interface UnscheduledExamOffering {
  courseOfferingId: string;
  courseName: string;
  courseCode: string;
  classCode: string;
  semester: number;
  expectedStudents: number;
  reason: string;
}

export interface ExamGenerationResult {
  slots: GeneratedExamSlot[];
  unscheduled: UnscheduledExamOffering[];
  draftEntriesPayload: ExamDraftEntryInput[];
  summary: {
    totalExams: number;
    scheduledExams: number;
    unscheduledExams: number;
    conflictCount: number;
    roomsUsedCount: number;
    supervisorsUsedCount: number;
  };
}

/**
 * Generate dates array between startDate and endDate filtered by allowed days
 */
export function generateDateRange(
  startDateStr: string,
  endDateStr: string,
  allowedDays: number[]
): { dateStr: string; dayOfWeek: number; formatted: string }[] {
  const dates: { dateStr: string; dayOfWeek: number; formatted: string }[] = [];
  if (!startDateStr || !endDateStr) return dates;

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return dates;
  }

  const current = new Date(start);
  while (current <= end) {
    // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    const jsDay = current.getDay();
    const appDay = jsDay === 0 ? 7 : jsDay; // 1=Mon, ..., 7=Sun

    if (allowedDays.includes(appDay)) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const formatted = `${dayNames[appDay]}, ${current.getDate()} ${monthNames[current.getMonth()]} ${year}`;

      dates.push({
        dateStr,
        dayOfWeek: appDay,
        formatted,
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Check if two time intervals on the same day overlap
 * candidateStart < existingEnd && candidateEnd > existingStart
 */
export function isIntervalOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

/**
 * Find best matching rooms for expected students capacity among available rooms
 */
export function allocateRoomsForExam(
  expectedStudents: number,
  availableRooms: Room[],
  preferredRoomIds?: string[],
  requiredRoomType?: string
): { roomIds: string[]; roomNames: string[]; totalCapacity: number; waste: number } | null {
  const isLabRequired =
    requiredRoomType &&
    (requiredRoomType.toUpperCase().includes('LAB') ||
      requiredRoomType.toUpperCase().includes('PRAKTIK') ||
      requiredRoomType.toUpperCase().includes('KOMPUTER'));

  // Filter compatible active rooms
  const compatibleRooms = availableRooms.filter((r) => {
    if (r.is_active === false) return false;
    const rType = (r.room_type || (r as any).type || '').toUpperCase();
    const isLabRoom = rType.includes('LAB') || rType.includes('KOMPUTER');

    if (isLabRequired) {
      return isLabRoom;
    } else {
      // For theory/general exams, exclude Labs unless specifically requested
      return !isLabRoom;
    }
  });

  if (compatibleRooms.length === 0) {
    return null;
  }

  // 1. If user provided specific valid preferred rooms, check and use them if fully available
  if (preferredRoomIds && preferredRoomIds.length > 0) {
    const selected = compatibleRooms.filter((r) => preferredRoomIds.includes(r.id));
    if (selected.length === preferredRoomIds.length) {
      const cap = selected.reduce((sum, r) => sum + r.capacity, 0);
      if (cap >= expectedStudents) {
        return {
          roomIds: selected.map((r) => r.id),
          roomNames: selected.map((r) => r.code || r.name),
          totalCapacity: cap,
          waste: cap - expectedStudents,
        };
      }
    }
  }

  // 2. Try single room with smallest capacity that fits (minimum waste)
  const singleRooms = compatibleRooms
    .filter((r) => r.capacity >= expectedStudents)
    .sort((a, b) => a.capacity - b.capacity);

  if (singleRooms.length > 0) {
    const best = singleRooms[0];
    return {
      roomIds: [best.id],
      roomNames: [best.code || best.name],
      totalCapacity: best.capacity,
      waste: best.capacity - expectedStudents,
    };
  }

  // 3. Try 2-room combinations with smallest total capacity that fits
  const sortedRooms = [...compatibleRooms].sort((a, b) => a.capacity - b.capacity);
  let bestPair: [Room, Room] | null = null;
  let minPairWaste = Infinity;

  for (let i = 0; i < sortedRooms.length; i++) {
    for (let j = i + 1; j < sortedRooms.length; j++) {
      const cap = sortedRooms[i].capacity + sortedRooms[j].capacity;
      if (cap >= expectedStudents) {
        const waste = cap - expectedStudents;
        if (waste < minPairWaste) {
          minPairWaste = waste;
          bestPair = [sortedRooms[i], sortedRooms[j]];
        }
      }
    }
  }

  if (bestPair) {
    return {
      roomIds: [bestPair[0].id, bestPair[1].id],
      roomNames: [bestPair[0].code || bestPair[0].name, bestPair[1].code || bestPair[1].name],
      totalCapacity: bestPair[0].capacity + bestPair[1].capacity,
      waste: minPairWaste,
    };
  }

  return null;
}

/**
 * Deterministic Hard-Constraint-Compliant Exam Schedule Generator
 * Guarantees ZERO room conflicts, ZERO supervisor conflicts, ZERO class overlaps, and NO forced conflicts.
 */
export function generateExamSchedule(input: ExamGenerationInput): ExamGenerationResult {
  const {
    startDate,
    endDate,
    allowedDays,
    defaultDurationMinutes = 90,
    sessions,
    offerings,
    rooms,
    lecturers,
    supervisorAssignments,
    roomPreferences,
    availabilities = [],
  } = input;

  const datePool = generateDateRange(startDate, endDate, allowedDays);
  const activeSessions = sessions.filter((s) => s.is_active);

  if (datePool.length === 0 || activeSessions.length === 0 || offerings.length === 0) {
    return {
      slots: [],
      unscheduled: offerings.map((o: any) => ({
        courseOfferingId: o.course_offering_id || o.id,
        courseName: o.course_name || o.course?.name || 'Mata Kuliah',
        courseCode: o.course_code || o.course?.code || '',
        classCode: o.class_code || 'A',
        semester: o.semester || o.course?.semester || 1,
        expectedStudents: o.student_count || o.expected_students || 40,
        reason: 'Tidak ada tanggal pelaksanaan atau sesi ujian yang aktif.',
      })),
      draftEntriesPayload: [],
      summary: {
        totalExams: offerings.length,
        scheduledExams: 0,
        unscheduledExams: offerings.length,
        conflictCount: 0,
        roomsUsedCount: 0,
        supervisorsUsedCount: 0,
      },
    };
  }

  // Map lecturers for fast lookup
  const lecturerMap = new Map<string, Lecturer>();
  lecturers.forEach((l) => lecturerMap.set(l.id, l));

  // Map rooms for fast lookup
  const roomMap = new Map<string, Room>();
  rooms.forEach((r) => roomMap.set(r.id, r));

  // Active lecturers pool
  const activeLecturers = lecturers.filter(
    (l: any) => l.is_active !== false && l.status !== 'INACTIVE' && l.status !== 'Nonaktif'
  );

  // Placed exams list for interval-based hard conflict checking
  interface PlacedExam {
    offeringId: string;
    courseCode: string;
    courseName: string;
    classCode: string;
    semester: number;
    classGroupKey: string;
    examDate: string;
    dayOfWeek: number;
    sessionId: string;
    sessionName: string;
    startMinute: number;
    endMinute: number;
    durationMinutes: number;
    roomIds: string[];
    roomNames: string[];
    roomCapacity: number;
    supervisorIds: string[];
    supervisorNames: string[];
    expectedStudents: number;
  }

  const placedExams: PlacedExam[] = [];
  const unscheduledOfferings: UnscheduledExamOffering[] = [];

  // Workload tracking for soft balancing
  const supervisorDailyCount = new Map<string, number>(); // `${dateStr}_${supervisorId}` -> count
  const classGroupDailyCount = new Map<string, number>(); // `${dateStr}_${classGroupKey}` -> count

  // Sort offerings by scheduling difficulty: highest student count first, then semester, then code
  const sortedOfferings = [...offerings].sort((a: any, b: any) => {
    const studentsA = a.student_count || a.expected_students || 40;
    const studentsB = b.student_count || b.expected_students || 40;
    if (studentsB !== studentsA) return studentsB - studentsA;
    return (a.semester || a.course?.semester || 1) - (b.semester || b.course?.semester || 1);
  });

  for (const rawOffering of sortedOfferings) {
    const offering = rawOffering as any;
    const offeringId = offering.course_offering_id || offering.id;
    const expectedStudents = offering.student_count || offering.expected_students || 40;
    const courseName = offering.course_name || offering.course?.name || 'Mata Kuliah';
    const courseCode = offering.course_code || offering.course?.code || '';
    const classCode = offering.class_code || 'A';
    const semester = offering.semester || offering.course?.semester || 1;
    const requiredRoomType = offering.required_room_type;
    const classGroupKey = `SEM${semester}_CLS${classCode}`;

    // Target duration
    const duration = defaultDurationMinutes || 90;

    // Preferred supervisors from configuration / primary lecturer
    const supAssignment = supervisorAssignments[offeringId];
    let preferredPrimaryId = supAssignment?.primaryId;
    let preferredSecondaryId = supAssignment?.secondaryId;

    if (!preferredPrimaryId) {
      preferredPrimaryId =
        offering.primary_lecturer_id ||
        offering.planning_metadata?.primary_lecturer_id ||
        (activeLecturers.length > 0 ? activeLecturers[0].id : undefined);
    }

    if (!preferredSecondaryId && preferredPrimaryId) {
      const otherLecs = activeLecturers.filter((l) => l.id !== preferredPrimaryId);
      if (otherLecs.length > 0) {
        preferredSecondaryId = otherLecs[0].id;
      }
    }

    // Preferred rooms
    const preferredRoomIds =
      roomPreferences[offeringId] ||
      (offering.preferred_room_id ? [offering.preferred_room_id] : undefined);

    // Search for the optimal FEASIBLE candidate slot (zero hard conflicts)
    let bestSlot: {
      dateStr: string;
      dayOfWeek: number;
      session: ExamSession;
      startMinute: number;
      endMinute: number;
      roomIds: string[];
      roomNames: string[];
      roomCapacity: number;
      supervisorIds: string[];
      supervisorNames: string[];
      score: number;
    } | null = null;

    let minScore = Infinity;

    for (let dIdx = 0; dIdx < datePool.length; dIdx++) {
      const dateInfo = datePool[dIdx];
      const { dateStr, dayOfWeek } = dateInfo;

      for (const session of activeSessions) {
        const candStartMin = session.start_minute;
        const candEndMin = session.start_minute + duration;

        // ========================================================
        // 1. HARD CONSTRAINT: BREAK TIME OVERLAP
        // ========================================================
        const crossesBreak = sessions.some(
          (s) =>
            !s.is_active &&
            isIntervalOverlap(candStartMin, candEndMin, s.start_minute, s.end_minute)
        );
        if (crossesBreak) {
          continue; // Infeasible: overlaps with break time
        }

        // ========================================================
        // 2. FIND ALL PLACED EXAMS OVERLAPPING IN TIME ON THIS DATE
        // ========================================================
        const overlappingExams = placedExams.filter(
          (e) =>
            e.examDate === dateStr &&
            isIntervalOverlap(candStartMin, candEndMin, e.startMinute, e.endMinute)
        );

        // ========================================================
        // 3. HARD CONSTRAINT: CLASS / STUDENT GROUP OVERLAP
        // ========================================================
        const hasGroupOverlap = overlappingExams.some(
          (e) => e.classGroupKey === classGroupKey || e.offeringId === offeringId
        );
        if (hasGroupOverlap) {
          continue; // Infeasible: same class group has another exam in this time interval
        }

        // ========================================================
        // 4. HARD CONSTRAINT: ROOM OVERLAP & COMPATIBLE ALLOCATION
        // ========================================================
        const occupiedRoomIds = new Set<string>();
        overlappingExams.forEach((e) => {
          e.roomIds.forEach((rId) => occupiedRoomIds.add(rId));
        });

        // Filter rooms that are completely FREE during this interval
        const freeRoomsForInterval = rooms.filter(
          (r) => r.is_active !== false && !occupiedRoomIds.has(r.id)
        );

        const roomAlloc = allocateRoomsForExam(
          expectedStudents,
          freeRoomsForInterval,
          preferredRoomIds,
          requiredRoomType
        );

        if (!roomAlloc || roomAlloc.totalCapacity < expectedStudents) {
          continue; // Infeasible: no available room fits expected students without overlap
        }

        // ========================================================
        // 5. HARD CONSTRAINT: SUPERVISOR OVERLAP & ASSIGNMENT
        // ========================================================
        const occupiedSupervisorIds = new Set<string>();
        overlappingExams.forEach((e) => {
          e.supervisorIds.forEach((sId) => occupiedSupervisorIds.add(sId));
        });

        // Check if a lecturer is unavailable via explicit unavailabilities
        const isLecturerUnavailable = (lecId: string): boolean => {
          return availabilities.some(
            (av) =>
              av.lecturer_id === lecId &&
              av.day_of_week === dayOfWeek &&
              isIntervalOverlap(candStartMin, candEndMin, av.start_minute, av.end_minute) &&
              !av.is_available
          );
        };

        // Determine 2 distinct, free, available supervisors
        let candidateSup1: string | null = null;
        let candidateSup2: string | null = null;

        if (
          preferredPrimaryId &&
          !occupiedSupervisorIds.has(preferredPrimaryId) &&
          !isLecturerUnavailable(preferredPrimaryId)
        ) {
          candidateSup1 = preferredPrimaryId;
        }

        if (
          preferredSecondaryId &&
          preferredSecondaryId !== candidateSup1 &&
          !occupiedSupervisorIds.has(preferredSecondaryId) &&
          !isLecturerUnavailable(preferredSecondaryId)
        ) {
          candidateSup2 = preferredSecondaryId;
        }

        // If candidateSup1 is missing, pick best available active lecturer
        if (!candidateSup1) {
          const freeLecs = activeLecturers.filter(
            (l) =>
              !occupiedSupervisorIds.has(l.id) &&
              !isLecturerUnavailable(l.id) &&
              l.id !== candidateSup2
          );
          if (freeLecs.length > 0) {
            candidateSup1 = freeLecs[0].id;
          }
        }

        // If candidateSup2 is missing, pick best available secondary
        if (!candidateSup2 && candidateSup1) {
          const freeLecs = activeLecturers.filter(
            (l) =>
              !occupiedSupervisorIds.has(l.id) &&
              !isLecturerUnavailable(l.id) &&
              l.id !== candidateSup1
          );
          if (freeLecs.length > 0) {
            candidateSup2 = freeLecs[0].id;
          }
        }

        // If still missing 2 distinct supervisors, candidate is infeasible
        if (!candidateSup1 || !candidateSup2 || candidateSup1 === candidateSup2) {
          continue; // Infeasible: cannot assign 2 non-overlapping supervisors
        }

        const chosenSupIds = [candidateSup1, candidateSup2];
        const chosenSupNames = chosenSupIds.map(
          (id) => lecturerMap.get(id)?.name || 'Dosen Pengawas'
        );

        // ========================================================
        // 6. SOFT CONSTRAINT SCORING (FOR FEASIBLE CANDIDATES ONLY)
        // ========================================================
        let score = 0;

        // Soft penalty: group already has an exam earlier/later today
        const groupDayKey = `${dateStr}_${classGroupKey}`;
        const dailyExamsForGroup = classGroupDailyCount.get(groupDayKey) || 0;
        score += dailyExamsForGroup * 300;

        // Soft penalty: supervisor busy today
        for (const sId of chosenSupIds) {
          const supDayKey = `${dateStr}_${sId}`;
          const dailyExamsForSup = supervisorDailyCount.get(supDayKey) || 0;
          score += dailyExamsForSup * 40;
        }

        // Soft penalty: room waste
        score += Math.max(0, roomAlloc.waste) * 0.1;

        // Soft penalty: balance exams across dates
        score += dIdx * 5;

        if (score < minScore) {
          minScore = score;
          bestSlot = {
            dateStr,
            dayOfWeek,
            session,
            startMinute: candStartMin,
            endMinute: candEndMin,
            roomIds: roomAlloc.roomIds,
            roomNames: roomAlloc.roomNames,
            roomCapacity: roomAlloc.totalCapacity,
            supervisorIds: chosenSupIds,
            supervisorNames: chosenSupNames,
            score,
          };
        }
      }
    }

    // ========================================================
    // DECISION: PLACE OR MARK AS UNSCHEDULED (NO FORCED CONFLICT)
    // ========================================================
    if (bestSlot) {
      const placed: PlacedExam = {
        offeringId,
        courseCode,
        courseName,
        classCode,
        semester,
        classGroupKey,
        examDate: bestSlot.dateStr,
        dayOfWeek: bestSlot.dayOfWeek,
        sessionId: bestSlot.session.id,
        sessionName: bestSlot.session.name,
        startMinute: bestSlot.startMinute,
        endMinute: bestSlot.endMinute,
        durationMinutes: duration,
        roomIds: bestSlot.roomIds,
        roomNames: bestSlot.roomNames,
        roomCapacity: bestSlot.roomCapacity,
        supervisorIds: bestSlot.supervisorIds,
        supervisorNames: bestSlot.supervisorNames,
        expectedStudents,
      };

      placedExams.push(placed);

      // Update soft tracking counts
      const groupDayKey = `${bestSlot.dateStr}_${classGroupKey}`;
      classGroupDailyCount.set(groupDayKey, (classGroupDailyCount.get(groupDayKey) || 0) + 1);

      bestSlot.supervisorIds.forEach((sId) => {
        const supDayKey = `${bestSlot.dateStr}_${sId}`;
        supervisorDailyCount.set(supDayKey, (supervisorDailyCount.get(supDayKey) || 0) + 1);
      });
    } else {
      // Mark as UNSCHEDULED with clear diagnostic message
      unscheduledOfferings.push({
        courseOfferingId: offeringId,
        courseName,
        courseCode,
        classCode,
        semester,
        expectedStudents,
        reason:
          'Tidak ditemukan slot feasible tanpa bentrok ruangan, pengawas, atau rombongan belajar.',
      });
    }
  }

  // Convert placed exams to GeneratedExamSlot[]
  const slots: GeneratedExamSlot[] = placedExams.map((p) => ({
    courseOfferingId: p.offeringId,
    courseName: p.courseName,
    courseCode: p.courseCode,
    classCode: p.classCode,
    semester: p.semester,
    expectedStudents: p.expectedStudents,
    examDate: p.examDate,
    dayOfWeek: p.dayOfWeek,
    sessionId: p.sessionId,
    sessionName: p.sessionName,
    startMinute: p.startMinute,
    endMinute: p.endMinute,
    durationMinutes: p.durationMinutes,
    roomIds: p.roomIds,
    roomNames: p.roomNames,
    roomCapacity: p.roomCapacity,
    supervisorIds: p.supervisorIds,
    supervisorNames: p.supervisorNames,
    isConflict: false,
    conflictReasons: [],
  }));

  // Prepare database payload for save_exam_draft_entries
  const draftEntriesPayload: ExamDraftEntryInput[] = slots.map((s) => ({
    course_offering_id: s.courseOfferingId,
    exam_session_id: s.sessionId,
    exam_date: s.examDate,
    duration_minutes: s.durationMinutes,
    room_ids: s.roomIds,
    supervisor_ids: s.supervisorIds.slice(0, 2),
    notes: null,
  }));

  const usedRooms = new Set(slots.flatMap((s) => s.roomIds));
  const usedSupervisors = new Set(slots.flatMap((s) => s.supervisorIds));

  return {
    slots,
    unscheduled: unscheduledOfferings,
    draftEntriesPayload,
    summary: {
      totalExams: offerings.length,
      scheduledExams: slots.length,
      unscheduledExams: unscheduledOfferings.length,
      conflictCount: 0, // Conflict-free generator guarantees 0 conflicts
      roomsUsedCount: usedRooms.size,
      supervisorsUsedCount: usedSupervisors.size,
    },
  };
}

/**
 * Validate an array of GeneratedExamSlot using interval overlap rules
 */
export function validateExamSlots(
  slots: GeneratedExamSlot[],
  sessions: ExamSession[]
): { validatedSlots: GeneratedExamSlot[]; totalConflicts: number } {
  let totalConflicts = 0;

  const validatedSlots = slots.map((s, idx) => {
    const conflicts: string[] = [];

    // Check break time
    const crossesBreak = sessions.some(
      (sess) =>
        !sess.is_active &&
        isIntervalOverlap(s.startMinute, s.endMinute, sess.start_minute, sess.end_minute)
    );
    if (crossesBreak) {
      conflicts.push('Waktu ujian bertabrakan dengan waktu istirahat.');
    }

    // Check room capacity
    if (s.roomCapacity < s.expectedStudents) {
      conflicts.push(`Kapasitas ruangan (${s.roomCapacity}) kurang dari peserta (${s.expectedStudents}).`);
    }

    // Check overlap with all other slots on the same date
    const otherSlots = slots.filter((_, oIdx) => oIdx !== idx && _.examDate === s.examDate);

    for (const other of otherSlots) {
      if (isIntervalOverlap(s.startMinute, s.endMinute, other.startMinute, other.endMinute)) {
        // Room overlap
        const roomOverlap = s.roomIds.filter((rId) => other.roomIds.includes(rId));
        if (roomOverlap.length > 0) {
          conflicts.push(`Ruangan digunakan bersamaan oleh ${other.courseName} (Kelas ${other.classCode}).`);
        }

        // Supervisor overlap
        const supOverlap = s.supervisorIds.filter((supId) => other.supervisorIds.includes(supId));
        if (supOverlap.length > 0) {
          conflicts.push(`Dosen pengawas bertugas bersamaan pada ujian ${other.courseName} (Kelas ${other.classCode}).`);
        }

        // Student group overlap
        if (other.semester === s.semester && other.classCode === s.classCode) {
          conflicts.push(`Kelas ${s.classCode} Semester ${s.semester} memiliki ujian bersamaan dengan ${other.courseName}.`);
        }
      }
    }

    const uniqueConflicts = Array.from(new Set(conflicts));
    const isConflict = uniqueConflicts.length > 0;
    if (isConflict) totalConflicts++;

    return {
      ...s,
      isConflict,
      conflictReasons: uniqueConflicts,
    };
  });

  return { validatedSlots, totalConflicts };
}

/**
 * Reconstruct GeneratedExamSlot[] from database ExamEntry[]
 */
export function mapDbEntriesToSlots(
  dbEntries: ExamEntry[],
  offerings: (CourseOffering | ExamSourceOffering)[],
  sessions: ExamSession[],
  rooms: Room[],
  lecturers: Lecturer[]
): GeneratedExamSlot[] {
  const offeringMap = new Map<string, any>();
  offerings.forEach((o: any) => {
    const id = o.course_offering_id || o.id;
    offeringMap.set(id, o);
  });

  const sessionMap = new Map<string, ExamSession>();
  sessions.forEach((s) => sessionMap.set(s.id, s));

  const roomMap = new Map<string, Room>();
  rooms.forEach((r) => roomMap.set(r.id, r));

  const lecturerMap = new Map<string, Lecturer>();
  lecturers.forEach((l) => lecturerMap.set(l.id, l));

  const rawSlots: GeneratedExamSlot[] = dbEntries.map((e) => {
    const offering = offeringMap.get(e.course_offering_id) || {};
    const session = sessionMap.get(e.exam_session_id);

    const courseName = e.course_name || offering.course_name || offering.course?.name || 'Mata Kuliah';
    const courseCode = e.course_code || offering.course_code || offering.course?.code || '';
    const classCode = e.class_code || offering.class_code || 'A';
    const semester = offering.semester || offering.course?.semester || 1;
    const expectedStudents = e.student_count || offering.student_count || offering.expected_students || 40;

    const startMinute = e.start_minute ?? session?.start_minute ?? 470;
    const durationMinutes = e.duration_minutes || 90;
    const endMinute = e.end_minute ?? (startMinute + durationMinutes);

    const roomIds = e.room_ids || [];
    const roomNames = roomIds.map((rId) => roomMap.get(rId)?.code || roomMap.get(rId)?.name || 'Ruang ?');
    const roomCapacity = roomIds.reduce((sum, rId) => sum + (roomMap.get(rId)?.capacity || 0), 0);

    const supervisorIds = e.supervisor_ids || [];
    const supervisorNames = supervisorIds.map((sId) => lecturerMap.get(sId)?.name || 'Dosen Pengawas');

    const dayNum = e.exam_date ? new Date(e.exam_date).getDay() : 1;
    const dayOfWeek = dayNum === 0 ? 7 : dayNum;

    return {
      courseOfferingId: e.course_offering_id,
      courseName,
      courseCode,
      classCode,
      semester,
      expectedStudents,
      examDate: e.exam_date,
      dayOfWeek,
      sessionId: e.exam_session_id,
      sessionName: session?.name || 'Sesi Ujian',
      startMinute,
      endMinute,
      durationMinutes,
      roomIds,
      roomNames,
      roomCapacity,
      supervisorIds,
      supervisorNames,
      isConflict: false,
      conflictReasons: [],
    };
  });

  const { validatedSlots } = validateExamSlots(rawSlots, sessions);
  return validatedSlots;
}
