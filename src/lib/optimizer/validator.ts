import { CourseOffering, Room, TimeSlot, LecturerAvailability } from '../../types';
import { PreValidationResult, PreValidationIssue, SchedulableOffering } from './types';

/**
 * Validates whether the dataset is complete and ready for Automated Simulated Annealing Optimization.
 * According to specification:
 * - course must exist and be schedulable (not KKN)
 * - effective_sks must be defined and > 0
 * - minimal 1 lecturer must be assigned
 * - expected_students must be > 0 (0 is treated as incomplete)
 * - required_room_type must be specified
 * - rooms and active time slots must be available
 */
export function validateOptimizationReadiness(
  rawOfferings: CourseOffering[],
  rooms: Room[],
  timeSlots: TimeSlot[]
): PreValidationResult {
  const errors: PreValidationIssue[] = [];
  const warnings: PreValidationIssue[] = [];

  let missingLecturersCount = 0;
  let missingStudentsCount = 0;
  let missingSksCount = 0;
  let missingRoomTypeCount = 0;

  // Filter schedulable offerings (exclude KKN and unschedulables)
  const targetOfferings = rawOfferings.filter((o) => {
    if (o.course?.is_schedulable === false) return false;
    if (o.course?.activity_type === 'KKN') return false;
    return true;
  });

  const activeRooms = rooms.filter((r) => r.is_active !== false);
  const activeTimeSlots = timeSlots.filter((s) => s.is_active !== false);

  if (targetOfferings.length === 0) {
    errors.push({
      id: 'no-offerings',
      issue: 'Tidak ada penawaran kelas aktif untuk periode yang dipilih.',
      severity: 'ERROR',
    });
  }

  if (activeRooms.length === 0) {
    errors.push({
      id: 'no-rooms',
      issue: 'Belum ada ruangan aktif yang terdaftar dalam sistem.',
      severity: 'ERROR',
    });
  }

  if (activeTimeSlots.length === 0) {
    errors.push({
      id: 'no-timeslots',
      issue: 'Belum ada slot waktu aktif yang dikonfigurasi dalam sistem.',
      severity: 'ERROR',
    });
  }

  let readyOfferingsCount = 0;

  targetOfferings.forEach((offering) => {
    let hasError = false;
    const course = offering.course;
    const courseName = course?.name || 'Mata Kuliah Tanpa Nama';
    const classCode = offering.class_code || 'A';
    const fullName = `${courseName} (${classCode})`;

    // 1. Check Course & SKS
    const sks = offering.effective_sks || course?.effective_sks || course?.sks || 0;
    if (sks <= 0) {
      missingSksCount++;
      hasError = true;
      errors.push({
        id: `missing-sks-${offering.id}`,
        offeringId: offering.id,
        offeringName: fullName,
        classCode,
        issue: `Mata kuliah belum memiliki bobot SKS yang valid (${sks} SKS).`,
        severity: 'ERROR',
      });
    }

    // 2. Check Lecturers (minimal 1)
    const lecturers = offering.course_offering_lecturers || offering.lecturers || [];
    if (lecturers.length === 0) {
      missingLecturersCount++;
      hasError = true;
      errors.push({
        id: `missing-lecturer-${offering.id}`,
        offeringId: offering.id,
        offeringName: fullName,
        classCode,
        issue: 'Belum ditentukan dosen pengampu untuk kelas ini.',
        severity: 'ERROR',
      });
    }

    // 3. Check Expected Students (> 0)
    const students = offering.expected_students ?? 0;
    if (students <= 0) {
      missingStudentsCount++;
      hasError = true;
      errors.push({
        id: `missing-students-${offering.id}`,
        offeringId: offering.id,
        offeringName: fullName,
        classCode,
        issue: 'Jumlah perkiraan peserta (expected_students) masih 0 atau belum diisi.',
        severity: 'ERROR',
      });
    }

    // 4. Check Required Room Type
    const roomType = offering.required_room_type?.trim();
    if (!roomType) {
      missingRoomTypeCount++;
      warnings.push({
        id: `missing-room-type-${offering.id}`,
        offeringId: offering.id,
        offeringName: fullName,
        classCode,
        issue: 'Tipe ruangan belum dispesifikasikan (default: Ruang Kuliah Teori).',
        severity: 'WARNING',
      });
    } else {
      // Check if any room matches this type
      const hasMatchingRoom = activeRooms.some(
        (r) => (r.room_type || '').toLowerCase().trim() === roomType.toLowerCase().trim()
      );
      if (!hasMatchingRoom) {
        errors.push({
          id: `no-matching-room-type-${offering.id}`,
          offeringId: offering.id,
          offeringName: fullName,
          classCode,
          issue: `Tidak ada ruangan aktif dengan tipe "${roomType}".`,
          severity: 'ERROR',
        });
        hasError = true;
      }
    }

    // 5. Capacity feasibility check
    if (students > 0 && activeRooms.length > 0) {
      const maxCapacity = Math.max(...activeRooms.map((r) => r.capacity || 0));
      if (students > maxCapacity) {
        errors.push({
          id: `capacity-exceeded-${offering.id}`,
          offeringId: offering.id,
          offeringName: fullName,
          classCode,
          issue: `Peserta kelas (${students} mahasiswa) melebihi kapasitas ruangan terbesar yang tersedia (${maxCapacity} kursi).`,
          severity: 'ERROR',
        });
        hasError = true;
      }
    }

    if (!hasError) {
      readyOfferingsCount++;
    }
  });

  const isReady = errors.length === 0 && targetOfferings.length > 0;

  return {
    isReady,
    totalOfferings: targetOfferings.length,
    readyOfferingsCount,
    errors,
    warnings,
    summary: {
      missingLecturersCount,
      missingStudentsCount,
      missingSksCount,
      missingRoomTypeCount,
      roomsCount: activeRooms.length,
      timeSlotsCount: activeTimeSlots.length,
    },
  };
}

/**
 * Transforms CourseOffering database objects into sanitized SchedulableOffering instances
 */
export function extractSchedulableOfferings(
  rawOfferings: CourseOffering[]
): SchedulableOffering[] {
  return rawOfferings
    .filter((o) => {
      if (o.course?.is_schedulable === false) return false;
      if (o.course?.activity_type === 'KKN') return false;
      return true;
    })
    .map((o) => {
      const course = o.course;
      const effectiveSks = o.effective_sks || course?.effective_sks || course?.sks || 2;
      const expectedStudents = o.expected_students || 0;
      const requiredRoomType = (o.required_room_type || 'Ruang Kuliah Teori').trim();
      const semester = course?.semester || 1;

      const lecturersList = o.course_offering_lecturers || o.lecturers || [];
      const lecturerIds = lecturersList
        .map((l) => l.lecturer_id)
        .filter((id): id is string => Boolean(id));

      const lecturerNames = lecturersList
        .map((l) => l.lecturer?.name)
        .filter((name): name is string => Boolean(name));

      return {
        id: o.id,
        courseId: o.course_id || course?.id || '',
        courseCode: course?.code || '',
        courseName: course?.name || 'Mata Kuliah',
        classCode: o.class_code || 'A',
        effectiveSks,
        expectedStudents,
        requiredRoomType,
        semester,
        lecturerIds,
        lecturerNames,
      };
    });
}
