import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  PlannedCourse,
  CourseOfferingRombelItem,
  CourseRombelGroup,
  RombelOfferingDraft,
  Course,
  Room,
} from '../types';
import { verifyOwnerAdmin } from '../lib/authGuard';
import { parseSupabaseError } from '../lib/utils';
import { calculateTargetRoomCapacity, isPracticum } from '../lib/distributionUtils';

export const schedulingRombelService = {
  /**
   * Fetches courses, course_offerings, and active rooms from Supabase
   * to build room-capacity-aware CourseRombelGroup[] for Step 2.
   */
  async loadRombelDataForStep2(
    termId: string,
    plannedCourses: PlannedCourse[],
    savedDraft: Record<string, RombelOfferingDraft> = {}
  ): Promise<CourseRombelGroup[]> {
    if (!isSupabaseConfigured() || plannedCourses.length === 0 || !termId) {
      return [];
    }

    try {
      const isOwner = await verifyOwnerAdmin();
      const coursesTable = isOwner ? 'courses' : 'guest_courses';
      const offeringsTable = isOwner ? 'course_offerings' : 'guest_course_offerings';
      const roomsTable = isOwner ? 'rooms' : 'guest_rooms';

      // 1. Fetch active rooms to extract eligible capacities by room_type
      let { data: rawRooms, error: roomsError } = await supabase
        .from(roomsTable)
        .select('id, name, code, capacity, room_type, is_active')
        .eq('is_active', true);

      if (roomsError && !isOwner) {
        const fbRooms = await supabase
          .from('rooms')
          .select('id, name, code, capacity, room_type, is_active')
          .eq('is_active', true);
        rawRooms = fbRooms.data;
      }

      const activeRooms: Room[] = (rawRooms as Room[]) || [];
      const roomTypeCapacitiesMap = new Map<string, number[]>();

      activeRooms.forEach((r) => {
        const type = r.room_type || 'Ruang Kuliah Teori';
        const cap = Number(r.capacity || 0);
        if (cap > 0) {
          const arr = roomTypeCapacitiesMap.get(type) || [];
          if (!arr.includes(cap)) {
            arr.push(cap);
          }
          roomTypeCapacitiesMap.set(type, arr);
        }
      });

      // Sort capacities ascending
      roomTypeCapacitiesMap.forEach((caps, type) => {
        roomTypeCapacitiesMap.set(type, caps.sort((a, b) => a - b));
      });

      // 2. Fetch courses matching codes
      const courseCodes = Array.from(
        new Set(plannedCourses.map((pc) => pc.courseCode.trim().toUpperCase()))
      );

      let { data: rawCourses, error: coursesError } = await supabase
        .from(coursesTable)
        .select('*')
        .in('code', courseCodes);

      if (coursesError && !isOwner) {
        const fb = await supabase
          .from('courses')
          .select('*')
          .in('code', courseCodes);
        rawCourses = fb.data;
      }

      const coursesList: Course[] = (rawCourses as Course[]) || [];
      const courseIdMap = new Map<string, Course[]>(); // code -> Course[]

      coursesList.forEach((c) => {
        const code = c.code ? c.code.trim().toUpperCase() : '';
        const arr = courseIdMap.get(code) || [];
        arr.push(c);
        courseIdMap.set(code, arr);
      });

      // Collect all course IDs
      const allCourseIds = coursesList.map((c) => c.id);

      // 3. Fetch course_offerings for these courses and active term
      let offeringsList: any[] = [];
      if (allCourseIds.length > 0) {
        let { data: rawOfferings, error: offError } = await supabase
          .from(offeringsTable)
          .select(
            'id, academic_term_id, course_id, class_code, effective_sks, expected_students, required_room_type, assignment_confirmed'
          )
          .eq('academic_term_id', termId)
          .in('course_id', allCourseIds)
          .order('class_code', { ascending: true });

        if (offError && !isOwner) {
          const fbOff = await supabase
            .from('course_offerings')
            .select(
              'id, academic_term_id, course_id, class_code, effective_sks, expected_students, required_room_type, assignment_confirmed'
            )
            .eq('academic_term_id', termId)
            .in('course_id', allCourseIds)
            .order('class_code', { ascending: true });
          rawOfferings = fbOff.data;
        }

        offeringsList = rawOfferings || [];
      }

      // Map offerings by course_id
      const offeringsByCourseId = new Map<string, any[]>();
      offeringsList.forEach((off) => {
        const arr = offeringsByCourseId.get(off.course_id) || [];
        arr.push(off);
        offeringsByCourseId.set(off.course_id, arr);
      });

      // 4. Assemble CourseRombelGroup for each planned course
      const groups: CourseRombelGroup[] = plannedCourses.map((planned) => {
        const code = planned.courseCode.trim().toUpperCase();
        const candidateCourses = courseIdMap.get(code) || [];

        // Match the specific course
        let matchedCourse: Course | undefined = candidateCourses[0];
        if (candidateCourses.length > 1) {
          matchedCourse =
            candidateCourses.find((c) => c.semester === planned.semester) ||
            candidateCourses[0];
        }

        const rawOfferings = matchedCourse ? offeringsByCourseId.get(matchedCourse.id) || [] : [];
        const isLabCourse =
          planned.courseName.toLowerCase().includes('praktikum') ||
          planned.courseName.toLowerCase().includes('lab');

        const defaultRoomType = isLabCourse ? 'Laboratorium' : 'Ruang Kuliah Teori';
        const requiredRoomType =
          rawOfferings[0]?.required_room_type || defaultRoomType;

        // Retrieve eligible room capacities for this room type
        let eligibleCapacities = roomTypeCapacitiesMap.get(requiredRoomType) || [];
        if (eligibleCapacities.length === 0) {
          // Fallback if no rooms seeded for this type
          eligibleCapacities = isLabCourse ? [35] : [25, 40, 60];
        }

        const maxEligibleCapacity = Math.max(...eligibleCapacities, 60);

        // Map offerings to CourseOfferingRombelItem
        const offeringItems: CourseOfferingRombelItem[] = rawOfferings.map((raw) => {
          const offeringId = raw.id;
          const dbExpected = Number(raw.expected_students || 0);
          const isInter = (raw.class_code || '').toUpperCase().includes('INTER');

          // Check draft first
          const draft = savedDraft[offeringId];
          let active: boolean;
          let currentParticipants: number;

          if (draft !== undefined) {
            active = draft.active;
            currentParticipants = draft.expectedStudents;
          } else {
            // Default initialization rules:
            if (dbExpected > 0) {
              active = true;
              currentParticipants = dbExpected;
            } else {
              // If only 1 offering (e.g. REG only), auto-fill planned participants
              if (rawOfferings.length === 1) {
                active = true;
                currentParticipants = planned.totalParticipants;
              } else if (isInter) {
                // INTER default false if dbExpected is 0
                active = false;
                currentParticipants = 0;
              } else {
                // A, B, C, REG default active = true, 0 participants
                active = true;
                currentParticipants = 0;
              }
            }
          }

          // Calculate target capacity & waste
          const capResult = calculateTargetRoomCapacity(
            active ? currentParticipants : 0,
            eligibleCapacities
          );

          return {
            id: raw.id,
            academic_term_id: raw.academic_term_id,
            course_id: raw.course_id,
            class_code: raw.class_code || 'A',
            effective_sks: Number(
              raw.effective_sks ?? matchedCourse?.effective_sks ?? planned.sks ?? 3
            ),
            expected_students: dbExpected,
            required_room_type: raw.required_room_type || requiredRoomType,
            assignment_confirmed: raw.assignment_confirmed ?? false,
            active,
            currentParticipants,
            targetRoomCapacity: active ? capResult.targetRoomCapacity : null,
            seatWaste: active ? capResult.seatWaste : 0,
            isOversized: active ? capResult.isOversized : false,
          };
        });

        // Compute total distributed among active offerings
        const totalDistributed = offeringItems.reduce((acc, off) => {
          return acc + (off.active ? Number(off.currentParticipants || 0) : 0);
        }, 0);

        const isPracticumCourse = isPracticum(planned);
        const targetTotal = isPracticumCourse ? 0 : Number(planned.totalParticipants || 0);
        const remaining = targetTotal - totalDistributed;
        const totalSeatWaste = isPracticumCourse
          ? 0
          : offeringItems.reduce((acc, off) => acc + (off.seatWaste || 0), 0);
        const hasOversizedOffering = isPracticumCourse
          ? false
          : offeringItems.some((off) => off.active && off.isOversized);
        const minimumSections = isPracticumCourse
          ? 0
          : Math.max(1, Math.ceil(targetTotal / maxEligibleCapacity));

        let status: 'LENGKAP' | 'KURANG' | 'LEBIH' | 'TIDAK_FEASIBLE' | 'TIDAK_ADA_KELAS';
        if (isPracticumCourse) {
          // Praktikum does not participate in room or rombel division
          status = 'LENGKAP';
        } else if (offeringItems.length === 0) {
          status = 'TIDAK_ADA_KELAS';
        } else if (hasOversizedOffering) {
          status = 'TIDAK_FEASIBLE';
        } else if (totalDistributed === targetTotal) {
          status = 'LENGKAP';
        } else if (totalDistributed < targetTotal) {
          status = 'KURANG';
        } else {
          status = 'LEBIH';
        }

        return {
          selectionKey: planned.selectionKey,
          packageId: planned.packageId,
          packageName: planned.packageName,
          courseId: matchedCourse?.id || null,
          courseCode: planned.courseCode,
          courseName: planned.courseName,
          semester: planned.semester,
          curriculumYear: planned.curriculumYear,
          sks: planned.sks,
          category: planned.category,
          requiredRoomType,
          totalParticipantsStep1: targetTotal,
          offerings: offeringItems,
          totalDistributed,
          remaining,
          maxEligibleCapacity,
          eligibleCapacities,
          minimumSections,
          totalSeatWaste,
          hasOversizedOffering,
          status,
        };
      });

      return groups;
    } catch (err: any) {
      console.error('Error loading rombel data for step 2:', err);
      throw err;
    }
  },

  /**
   * Saves distributed expected_students back to Supabase course_offerings table
   */
  async saveRombelDistribution(
    groups: CourseRombelGroup[]
  ): Promise<{ success: boolean; updatedCount: number }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const isOwner = await verifyOwnerAdmin();
    if (!isOwner) {
      // In guest mode, cannot write to Supabase directly
      return { success: true, updatedCount: 0 };
    }

    // Collect all offering updates
    const updates: { id: string; expected_students: number }[] = [];
    groups.forEach((group) => {
      group.offerings.forEach((offering) => {
        // If inactive, expected_students is saved as 0
        const finalExpected = offering.active ? Number(offering.currentParticipants || 0) : 0;
        updates.push({
          id: offering.id,
          expected_students: Math.max(0, finalExpected),
        });
      });
    });

    if (updates.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    try {
      // Execute sequential updates with proper error checking
      for (const update of updates) {
        const { error } = await supabase
          .from('course_offerings')
          .update({ expected_students: update.expected_students })
          .eq('id', update.id);

        if (error) {
          console.error(`Failed to update course_offering ${update.id}:`, error);
          throw new Error(parseSupabaseError(error));
        }
      }

      return { success: true, updatedCount: updates.length };
    } catch (err: any) {
      console.error('saveRombelDistribution error:', err);
      throw err;
    }
  },
};
