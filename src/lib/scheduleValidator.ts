import { ScheduleEntry, Room, LecturerAvailability, TimeSlot, CourseOffering } from '../types';
import { AcademicTimeProfileType, isPlacementCrossingBreak } from './academicTimeProfile';

export interface ClientConflict {
  id: string;
  type: 'ROOM' | 'LECTURER' | 'CAPACITY' | 'ROOM_TYPE' | 'UNAVAILABLE' | 'TIME_SLOT';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  entryIds: string[];
  courseOfferingIds: string[];
}

export interface ValidationResult {
  isValid: boolean;
  conflicts: ClientConflict[];
  hasHardConflict: boolean;
  warnings: string[];
}

/**
 * Check if two time intervals overlap on the same day:
 * startA < endB && startB < endA
 */
export function isTimeOverlapping(
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
 * Validate a candidate placement or entire schedule against all constraints
 */
export function validatePlacement(params: {
  offering: CourseOffering;
  roomId: string;
  dayOfWeek: number;
  startMinute: number;
  rooms: Room[];
  currentEntries: ScheduleEntry[];
  availabilities: LecturerAvailability[];
  activeTimeSlots: TimeSlot[];
  excludeEntryId?: string;
  minutesPerSession?: number;
  timeProfile?: AcademicTimeProfileType;
}): ValidationResult {
  const {
    offering,
    roomId,
    dayOfWeek,
    startMinute,
    rooms,
    currentEntries,
    availabilities,
    activeTimeSlots,
    excludeEntryId,
    minutesPerSession = 50,
    timeProfile = 'NORMAL',
  } = params;

  const conflicts: ClientConflict[] = [];
  const warnings: string[] = [];
  let hasHardConflict = false;

  const room = rooms.find((r) => r.id === roomId);
  const sks = offering.course?.effective_sks || 2;
  const duration = sks * minutesPerSession;
  const endMinute = startMinute + duration;
  const expectedStudents = offering.expected_students || 0;

  // Check if placement crosses an academic break
  if (isPlacementCrossingBreak(startMinute, endMinute, timeProfile)) {
    hasHardConflict = true;
    conflicts.push({
      id: `break-${offering.id}`,
      type: 'TIME_SLOT',
      severity: 'CRITICAL',
      title: 'Melewati Waktu Istirahat',
      description: `Jadwal ${sks} SKS (${startMinute} - ${endMinute}) memotong jam jeda/istirahat akademik yang tidak diperkenankan.`,
      entryIds: [],
      courseOfferingIds: [offering.id],
    });
  }

  // 1. CAPACITY VALIDATION: expected_students <= room.capacity
  if (room && expectedStudents > room.capacity) {
    hasHardConflict = true;
    conflicts.push({
      id: `cap-${offering.id}-${room.id}`,
      type: 'CAPACITY',
      severity: 'CRITICAL',
      title: 'Kapasitas Ruangan Tidak Mencukupi',
      description: `Jumlah peserta (${expectedStudents} mahasiswa) melebihi kapasitas ${room.name} (${room.capacity} kursi).`,
      entryIds: [],
      courseOfferingIds: [offering.id],
    });
  }

  // 2. ROOM TYPE VALIDATION: room.room_type === offering.required_room_type
  if (room && offering.required_room_type) {
    const required = offering.required_room_type.toLowerCase().trim();
    const actual = (room.room_type || '').toLowerCase().trim();
    if (required !== actual) {
      hasHardConflict = true;
      conflicts.push({
        id: `room-type-${offering.id}`,
        type: 'ROOM_TYPE',
        severity: 'HIGH',
        title: 'Tipe Ruangan Tidak Sesuai',
        description: `Mata kuliah memerlukan ${offering.required_room_type}, sedangkan ${room.name} bertipe ${room.room_type}.`,
        entryIds: [],
        courseOfferingIds: [offering.id],
      });
    }
  }

  // 3. TIME SLOT CONSECUTIVE VALIDATION
  // Must have continuous active slots for all SKS
  const daySlots = activeTimeSlots
    .filter((s) => Number(s.day_of_week) === Number(dayOfWeek) && s.is_active)
    .sort((a, b) => a.start_minute - b.start_minute);

  let consecutiveCount = 0;
  let currentExpectedStart = startMinute;

  for (let i = 0; i < sks; i++) {
    const matchingSlot = daySlots.find(
      (s) => s.start_minute === currentExpectedStart
    );
    if (matchingSlot) {
      consecutiveCount++;
      const slotDur = matchingSlot.duration_minutes || (matchingSlot.end_minute - matchingSlot.start_minute) || minutesPerSession;
      currentExpectedStart += slotDur;
    } else {
      break;
    }
  }

  if (consecutiveCount < sks && daySlots.length > 0) {
    hasHardConflict = true;
    conflicts.push({
      id: `slot-${offering.id}`,
      type: 'TIME_SLOT',
      severity: 'CRITICAL',
      title: 'Slot Waktu Tidak Tersedia Berurutan',
      description: `Mata kuliah ${sks} SKS memerlukan ${sks} sesi berturut-turut (${duration} menit), tetapi slot aktif tidak tersedia lengkap dari menit ${startMinute}.`,
      entryIds: [],
      courseOfferingIds: [offering.id],
    });
  }

  // 4. ROOM CONFLICT: Same room, same day, time intervals overlap
  const otherEntries = currentEntries.filter(
    (e) => e.id !== excludeEntryId && e.course_offering_id !== offering.id
  );

  for (const other of otherEntries) {
    const otherMinutesPerSession = other.minutes_per_session || minutesPerSession;
    const otherSks = other.course_offering?.course?.effective_sks || 2;
    const otherStart = other.start_minute ?? 470;
    const otherEnd = other.end_minute ?? (otherStart + otherSks * otherMinutesPerSession);
    const otherDay = Number(other.day_of_week) || 1;

    if (other.room_id === roomId && isTimeOverlapping(dayOfWeek, startMinute, endMinute, otherDay, otherStart, otherEnd)) {
      hasHardConflict = true;
      conflicts.push({
        id: `room-conflict-${other.id}`,
        type: 'ROOM',
        severity: 'CRITICAL',
        title: 'Bentrok Ruangan',
        description: `Ruangan ${room?.name || 'terpilih'} sudah digunakan oleh ${other.course_name || 'mata kuliah lain'} (${other.class_code || ''}) pada waktu tersebut.`,
        entryIds: [other.id],
        courseOfferingIds: [offering.id, other.course_offering_id],
      });
    }

    // 5. LECTURER CONFLICT: Lecturer teaches another class at the same time
    const offeringLecturerIds = (offering.course_offering_lecturers || []).map((l) => l.lecturer_id);
    const otherLecturerIds = (other.course_offering?.course_offering_lecturers || []).map((l) => l.lecturer_id);

    const sharedLecturers = offeringLecturerIds.filter((lid) => otherLecturerIds.includes(lid));
    if (sharedLecturers.length > 0 && isTimeOverlapping(dayOfWeek, startMinute, endMinute, otherDay, otherStart, otherEnd)) {
      hasHardConflict = true;
      const lectNames = offering.course_offering_lecturers
        ?.filter((l) => sharedLecturers.includes(l.lecturer_id))
        .map((l) => l.lecturer?.name || 'Dosen')
        .join(', ');

      conflicts.push({
        id: `lect-conflict-${other.id}`,
        type: 'LECTURER',
        severity: 'CRITICAL',
        title: 'Bentrok Dosen Pengampu',
        description: `${lectNames} memiliki jadwal mengajar lain (${other.course_name} kelas ${other.class_code}) pada waktu yang sama.`,
        entryIds: [other.id],
        courseOfferingIds: [offering.id, other.course_offering_id],
      });
    }
  }

  // 6. LECTURER AVAILABILITY VALIDATION
  const offeringLecturers = offering.course_offering_lecturers || [];
  for (const col of offeringLecturers) {
    const lid = col.lecturer_id;
    const lName = col.lecturer?.name || 'Dosen';

    const lectAvails = availabilities.filter(
      (a) => a.lecturer_id === lid && Number(a.day_of_week) === Number(dayOfWeek)
    );

    for (const av of lectAvails) {
      if (isTimeOverlapping(dayOfWeek, startMinute, endMinute, av.day_of_week, av.start_minute, av.end_minute)) {
        if (!av.is_available) {
          hasHardConflict = true;
          conflicts.push({
            id: `unavail-${lid}`,
            type: 'UNAVAILABLE',
            severity: 'CRITICAL',
            title: 'Dosen Tidak Tersedia',
            description: `${lName} telah ditandai tidak tersedia pada waktu tersebut (${av.notes || 'keterangan ketersediaan'}).`,
            entryIds: [],
            courseOfferingIds: [offering.id],
          });
        } else if (av.preference === 'avoid') {
          warnings.push(`${lName} sebisa mungkin menghindari waktu ini (${av.notes || 'preferensi jadwal'}).`);
        } else if (av.preference === 'preferred') {
          warnings.push(`Waktu pilihan dosen (${lName}).`);
        }
      }
    }
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
    hasHardConflict,
    warnings,
  };
}

/**
 * Validate all entries currently on the schedule to detect room, lecturer, and capacity conflicts
 */
export function detectAllScheduleConflicts(
  entries: ScheduleEntry[],
  rooms: Room[],
  availabilities: LecturerAvailability[]
): ClientConflict[] {
  const conflicts: ClientConflict[] = [];

  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    const roomA = rooms.find((r) => r.id === a.room_id);
    const startA = a.start_minute ?? 470;
    const minPerSessA = a.minutes_per_session || 50;
    const sksA = a.course_offering?.course?.effective_sks || a.session_count || 2;
    const endA = a.end_minute ?? (startA + sksA * minPerSessA);
    const dayA = Number(a.day_of_week) || 1;
    const studentsA = a.student_count ?? a.course_offering?.expected_students ?? 0;

    // Capacity conflict
    if (roomA && studentsA > roomA.capacity) {
      conflicts.push({
        id: `cap-${a.id}`,
        type: 'CAPACITY',
        severity: 'CRITICAL',
        title: 'Kapasitas Ruangan Tidak Mencukupi',
        description: `Mata kuliah ${a.course_name} (${studentsA} peserta) melebihi kapasitas ${roomA.name} (${roomA.capacity} kursi).`,
        entryIds: [a.id],
        courseOfferingIds: [a.course_offering_id],
      });
    }

    // Room type conflict
    if (roomA && a.course_offering?.required_room_type) {
      const req = a.course_offering.required_room_type.toLowerCase().trim();
      const act = (roomA.room_type || '').toLowerCase().trim();
      if (req !== act) {
        conflicts.push({
          id: `room-type-${a.id}`,
          type: 'ROOM_TYPE',
          severity: 'HIGH',
          title: 'Tipe Ruangan Tidak Sesuai',
          description: `Mata kuliah ${a.course_name} memerlukan ${a.course_offering.required_room_type}, sedangkan ${roomA.name} bertipe ${roomA.room_type}.`,
          entryIds: [a.id],
          courseOfferingIds: [a.course_offering_id],
        });
      }
    }

    // Overlap checks with subsequent entries
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      const startB = b.start_minute ?? 470;
      const minPerSessB = b.minutes_per_session || 50;
      const sksB = b.course_offering?.course?.effective_sks || b.session_count || 2;
      const endB = b.end_minute ?? (startB + sksB * minPerSessB);
      const dayB = Number(b.day_of_week) || 1;

      if (isTimeOverlapping(dayA, startA, endA, dayB, startB, endB)) {
        // Room conflict
        if (a.room_id === b.room_id) {
          conflicts.push({
            id: `room-${a.id}-${b.id}`,
            type: 'ROOM',
            severity: 'CRITICAL',
            title: 'Bentrok Ruangan',
            description: `Ruangan ${roomA?.name || 'ruang'} digunakan secara bersamaan oleh ${a.course_name} (${a.class_code}) dan ${b.course_name} (${b.class_code}).`,
            entryIds: [a.id, b.id],
            courseOfferingIds: [a.course_offering_id, b.course_offering_id],
          });
        }

        // Lecturer conflict
        const lectsA = (a.course_offering?.course_offering_lecturers || []).map((l) => l.lecturer_id);
        const lectsB = (b.course_offering?.course_offering_lecturers || []).map((l) => l.lecturer_id);
        const shared = lectsA.filter((lid) => lectsB.includes(lid));

        if (shared.length > 0) {
          const names = a.course_offering?.course_offering_lecturers
            ?.filter((l) => shared.includes(l.lecturer_id))
            .map((l) => l.lecturer?.name || 'Dosen')
            .join(', ');

          conflicts.push({
            id: `lect-${a.id}-${b.id}`,
            type: 'LECTURER',
            severity: 'CRITICAL',
            title: 'Bentrok Dosen Pengampu',
            description: `${names} memiliki jadwal mengajar bersamaan pada ${a.course_name} (${a.class_code}) dan ${b.course_name} (${b.class_code}).`,
            entryIds: [a.id, b.id],
            courseOfferingIds: [a.course_offering_id, b.course_offering_id],
          });
        }
      }
    }

    // Lecturer availability
    const colList = a.course_offering?.course_offering_lecturers || [];
    for (const col of colList) {
      const lid = col.lecturer_id;
      const lName = col.lecturer?.name || 'Dosen';
      const avList = availabilities.filter(
        (av) => av.lecturer_id === lid && Number(av.day_of_week) === Number(dayA) && !av.is_available
      );

      for (const av of avList) {
        if (isTimeOverlapping(dayA, startA, endA, av.day_of_week, av.start_minute, av.end_minute)) {
          conflicts.push({
            id: `unavail-${a.id}-${lid}`,
            type: 'UNAVAILABLE',
            severity: 'CRITICAL',
            title: 'Dosen Tidak Tersedia',
            description: `${lName} tidak bersedia mengajar pada waktu mata kuliah ${a.course_name} (${a.class_code}).`,
            entryIds: [a.id],
            courseOfferingIds: [a.course_offering_id],
          });
        }
      }
    }
  }

  return conflicts;
}
