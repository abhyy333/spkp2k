import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  CourseRombelGroup,
  CourseOfferingRombelItem,
  Step3OfferingLecturerRow,
  Step3LecturerItem,
  Lecturer,
} from '../types';
import { verifyOwnerAdmin } from '../lib/authGuard';
import { isPracticum } from '../lib/distributionUtils';
import { parseSupabaseError } from '../lib/utils';

export interface Step3DataResult {
  rows: Step3OfferingLecturerRow[];
  totalActiveOfferings: number;
  totalWithPengampu: number;
  totalMultiCandidate: number;
  totalTeamTeaching: number; // legacy alias for multi-candidate
  totalMissingPengampu: number;
  totalInactiveLecturers: number;
  isAllValid: boolean;
  // Conflict mappings for Step 4/5 scheduler (EXACTLY 1 PRIMARY LECTURER)
  offeringLecturerIdsMap: Record<string, string[]>;
  offeringLecturerRolesMap: Record<
    string,
    Array<{ lecturerId: string; assignmentRole: string; lecturerName: string; lecturerCode: string }>
  >;
}

/**
 * Natural ascending comparator for source_row_id (e.g. GANJIL-52 < GANJIL-53)
 */
function compareSourceRowId(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export const schedulingLecturersService = {
  /**
   * Loads lecturer assignments for all active offerings from Step 2.
   * STRICT RULES:
   * 1. Reads public.course_offering_lecturers (ONLY course_offering_id, lecturer_id, assignment_role)
   * 2. Reads public.lecturers (using lecturer_code, NOT code)
   * 3. Exactly 1 PRIMARY LECTURER per active offering
   * 4. Multi-pengampu treated as CANDIDATES, not team teaching
   * 5. Fallback deterministic: source_assignment_links.source_row_id ASC, then lecturer_code ASC
   * 6. Reads & saves choice to course_offerings.planning_metadata.primary_lecturer_id
   */
  async loadStep3Lecturers(
    activeGroups: CourseRombelGroup[]
  ): Promise<Step3DataResult> {
    if (!isSupabaseConfigured()) {
      return {
        rows: [],
        totalActiveOfferings: 0,
        totalWithPengampu: 0,
        totalMultiCandidate: 0,
        totalTeamTeaching: 0,
        totalMissingPengampu: 0,
        totalInactiveLecturers: 0,
        isAllValid: false,
        offeringLecturerIdsMap: {},
        offeringLecturerRolesMap: {},
      };
    }

    try {
      const isOwner = await verifyOwnerAdmin();
      const colTable = isOwner ? 'course_offering_lecturers' : 'guest_course_offering_lecturers';
      const lectTable = isOwner ? 'lecturers' : 'guest_lecturers';
      const offeringsTable = isOwner ? 'course_offerings' : 'guest_course_offerings';

      // 1. Gather all active offerings from Step 2 with expected_students > 0
      const activeOfferingsList: Array<{
        offering: CourseOfferingRombelItem;
        group: CourseRombelGroup;
      }> = [];

      activeGroups.forEach((group) => {
        // PRAKTIKUM EXCLUSION: Dosen/asisten praktikum dikelola terpisah dan tidak masuk jadwal perkuliahan
        if (isPracticum(group)) return;

        group.offerings.forEach((offering) => {
          const participantCount = offering.active
            ? offering.currentParticipants > 0
              ? offering.currentParticipants
              : offering.expected_students
            : 0;

          if (offering.active && participantCount > 0) {
            activeOfferingsList.push({
              offering,
              group,
            });
          }
        });
      });

      if (activeOfferingsList.length === 0) {
        return {
          rows: [],
          totalActiveOfferings: 0,
          totalWithPengampu: 0,
          totalMultiCandidate: 0,
          totalTeamTeaching: 0,
          totalMissingPengampu: 0,
          totalInactiveLecturers: 0,
          isAllValid: false,
          offeringLecturerIdsMap: {},
          offeringLecturerRolesMap: {},
        };
      }

      const activeOfferingIds = activeOfferingsList.map((item) => item.offering.id);

      // 2. Fetch planning_metadata from course_offerings to detect existing primary_lecturer_id
      const offeringMetaMap = new Map<string, Record<string, any>>();
      try {
        let { data: rawMeta, error: metaErr } = await supabase
          .from(offeringsTable)
          .select('id, planning_metadata')
          .in('id', activeOfferingIds);

        if (metaErr && !isOwner) {
          const fbMeta = await supabase
            .from('course_offerings')
            .select('id, planning_metadata')
            .in('id', activeOfferingIds);
          rawMeta = fbMeta.data;
        }

        if (rawMeta && Array.isArray(rawMeta)) {
          rawMeta.forEach((m: any) => {
            if (m.id && m.planning_metadata && typeof m.planning_metadata === 'object') {
              offeringMetaMap.set(m.id, m.planning_metadata);
            }
          });
        }
      } catch (err) {
        console.warn('[Step 3] Could not fetch planning_metadata from course_offerings:', err);
      }

      // 3. Fetch source_assignment_links for source_row_id sorting (GANJIL-52 < GANJIL-53)
      const sourceOrderMap = new Map<string, string>(); // `${offering_id}:${lecturer_id}` -> source_row_id
      try {
        const { data: sourceLinks } = await supabase
          .from('source_assignment_links')
          .select('course_offering_id, lecturer_id, source_row_id')
          .in('course_offering_id', activeOfferingIds);

        if (sourceLinks && Array.isArray(sourceLinks)) {
          sourceLinks.forEach((sl: any) => {
            if (sl.course_offering_id && sl.lecturer_id && sl.source_row_id) {
              sourceOrderMap.set(`${sl.course_offering_id}:${sl.lecturer_id}`, String(sl.source_row_id));
            }
          });
        }
      } catch {
        // Table may not exist or guest access; fallback to lecturer_code ASC
      }

      // 4. Fetch course_offering_lecturers
      // STRICT: ONLY query course_offering_id, lecturer_id, assignment_role
      let { data: rawCol, error: colError } = await supabase
        .from(colTable)
        .select('course_offering_id, lecturer_id, assignment_role')
        .in('course_offering_id', activeOfferingIds);

      if (colError && !isOwner) {
        const fallbackCol = await supabase
          .from('course_offering_lecturers')
          .select('course_offering_id, lecturer_id, assignment_role')
          .in('course_offering_id', activeOfferingIds);
        rawCol = fallbackCol.data;
      }

      const colList: Array<{
        course_offering_id: string;
        lecturer_id: string;
        assignment_role: string;
      }> = rawCol || [];

      // 5. Collect unique lecturer IDs
      const uniqueLecturerIds = Array.from(
        new Set(colList.map((c) => c.lecturer_id).filter(Boolean))
      );

      // 6. Fetch lecturers data
      // STRICT: uses lecturer_code, NOT code
      let rawLecturers: any[] = [];
      if (uniqueLecturerIds.length > 0) {
        let { data: lectData, error: lectError } = await supabase
          .from(lectTable)
          .select(
            'id, name, lecturer_code, nip, kbk_id, expertise, availability_days, preferred_time, status, email'
          )
          .in('id', uniqueLecturerIds);

        if (lectError && !isOwner) {
          const fbLect = await supabase
            .from('lecturers')
            .select(
              'id, name, lecturer_code, nip, kbk_id, expertise, availability_days, preferred_time, status, email'
            )
            .in('id', uniqueLecturerIds);
          lectData = fbLect.data;
        }

        rawLecturers = lectData || [];
      }

      const lecturerMap = new Map<string, Lecturer>();
      rawLecturers.forEach((l) => {
        lecturerMap.set(l.id, {
          id: l.id,
          name: l.name,
          lecturer_code: l.lecturer_code || '',
          code: l.lecturer_code || '',
          nip: l.nip || null,
          kbk_id: l.kbk_id || null,
          expertise: l.expertise || null,
          availability_days: l.availability_days || null,
          preferred_time: l.preferred_time || null,
          status: l.status || 'Aktif',
          email: l.email || null,
        });
      });

      // 7. Group assignments by course_offering_id
      const colMap = new Map<
        string,
        Array<{ lecturer_id: string; assignment_role: string }>
      >();

      colList.forEach((item) => {
        const arr = colMap.get(item.course_offering_id) || [];
        arr.push({
          lecturer_id: item.lecturer_id,
          assignment_role: item.assignment_role || 'PENGAMPU',
        });
        colMap.set(item.course_offering_id, arr);
      });

      // 8. Build Step3OfferingLecturerRow for each active offering
      const rows: Step3OfferingLecturerRow[] = [];
      const offeringLecturerIdsMap: Record<string, string[]> = {};
      const offeringLecturerRolesMap: Record<
        string,
        Array<{ lecturerId: string; assignmentRole: string; lecturerName: string; lecturerCode: string }>
      > = {};

      for (const item of activeOfferingsList) {
        const { offering, group } = item;
        const assignmentList = colMap.get(offering.id) || [];

        const lecturerItems: Step3LecturerItem[] = [];
        let hasInactive = false;
        let hasMissing = false;

        for (const assign of assignmentList) {
          const lec = lecturerMap.get(assign.lecturer_id);
          const roleUpper = (assign.assignment_role || 'PENGAMPU').trim().toUpperCase();
          const sourceRow = sourceOrderMap.get(`${offering.id}:${assign.lecturer_id}`) || null;

          if (!lec) {
            console.warn(
              `[Step 3] Relasi dosen untuk offering ${offering.id} (${group.courseName} - ${offering.class_code}) mengacu pada lecturer_id "${assign.lecturer_id}" yang tidak ditemukan pada tabel lecturers.`
            );
            hasMissing = true;
            lecturerItems.push({
              lecturerId: assign.lecturer_id,
              lecturerName: 'Data Dosen Tidak Ditemukan',
              lecturerCode: '?',
              nip: null,
              kbkId: null,
              expertise: null,
              status: 'Tidak Ditemukan',
              availabilityDays: null,
              preferredTime: null,
              assignmentRole: roleUpper,
              isLecturerMissing: true,
              isLecturerInactive: false,
              sourceRowId: sourceRow,
            });
            continue;
          }

          const isInactive = lec.status !== 'Aktif';
          if (isInactive) {
            hasInactive = true;
          }

          lecturerItems.push({
            lecturerId: lec.id,
            lecturerName: lec.name,
            lecturerCode: lec.lecturer_code || '',
            nip: lec.nip || null,
            kbkId: lec.kbk_id || null,
            expertise: (lec as any).expertise || null,
            status: lec.status || 'Aktif',
            availabilityDays: (lec as any).availability_days || null,
            preferredTime: (lec as any).preferred_time || null,
            assignmentRole: roleUpper,
            isLecturerMissing: false,
            isLecturerInactive: isInactive,
            sourceRowId: sourceRow,
          });
        }

        // Candidates: all with assignmentRole === 'PENGAMPU' and not missing
        const candidates = lecturerItems.filter(
          (l) => l.assignmentRole === 'PENGAMPU' && !l.isLecturerMissing
        );
        const koordinatorList = lecturerItems.filter(
          (l) => l.assignmentRole === 'KOORDINATOR' && !l.isLecturerMissing
        );

        // Sort candidates deterministically:
        // Priority 1: source_row_id ascending (e.g. GANJIL-52 < GANJIL-53)
        // Priority 2: lecturer_code ASC
        // Priority 3: lecturerName ASC
        const sortedCandidates = [...candidates].sort((a, b) => {
          const sA = sourceOrderMap.get(`${offering.id}:${a.lecturerId}`);
          const sB = sourceOrderMap.get(`${offering.id}:${b.lecturerId}`);
          if (sA && sB) {
            const cmp = compareSourceRowId(sA, sB);
            if (cmp !== 0) return cmp;
          } else if (sA) {
            return -1;
          } else if (sB) {
            return 1;
          }

          const cA = (a.lecturerCode || '').trim();
          const cB = (b.lecturerCode || '').trim();
          if (cA && cB && cA !== cB) return cA.localeCompare(cB);
          return a.lecturerName.localeCompare(b.lecturerName);
        });

        // Determine Primary Lecturer
        const existingMeta = offeringMetaMap.get(offering.id) || {};
        const savedPrimaryId = existingMeta.primary_lecturer_id as string | undefined;

        const savedCandidate = savedPrimaryId
          ? candidates.find((c) => c.lecturerId === savedPrimaryId && !c.isLecturerMissing)
          : null;

        let primaryLecturer: Step3LecturerItem | null = null;
        let isManuallySelected = false;

        if (savedCandidate) {
          primaryLecturer = savedCandidate;
          isManuallySelected = true;
        } else if (sortedCandidates.length > 0) {
          primaryLecturer = sortedCandidates[0];
          isManuallySelected = false;
        }

        const hasPengampu = primaryLecturer !== null;
        const hasMultipleCandidates = candidates.length > 1;

        // Status resolution according to Section 11:
        // SIAP: jika memiliki tepat 1 primary lecturer aktif
        // PILIH_DOSEN: jika memiliki >1 kandidat dan belum dipilih manual oleh admin
        // BELUM_ADA_PENGAMPU: jika tidak memiliki pengampu sama sekali
        // DOSEN_TIDAK_AKTIF: jika primary lecturer nonaktif
        // DOSEN_TIDAK_DITEMUKAN: jika data dosen tidak ditemukan di tabel lecturers
        let status: Step3OfferingLecturerRow['status'];
        if (hasMissing || (primaryLecturer && primaryLecturer.isLecturerMissing)) {
          status = 'DOSEN_TIDAK_DITEMUKAN';
        } else if (primaryLecturer && primaryLecturer.isLecturerInactive) {
          status = 'DOSEN_TIDAK_AKTIF';
        } else if (!hasPengampu) {
          status = 'BELUM_ADA_PENGAMPU';
        } else if (hasMultipleCandidates && !isManuallySelected) {
          status = 'PILIH_DOSEN';
        } else {
          status = 'SIAP';
        }

        const isValid =
          primaryLecturer !== null &&
          !primaryLecturer.isLecturerInactive &&
          !primaryLecturer.isLecturerMissing;

        // Map strictly 1 primary lecturer for Step 4 scheduler conflict checks
        if (primaryLecturer && !primaryLecturer.isLecturerMissing) {
          offeringLecturerIdsMap[offering.id] = [primaryLecturer.lecturerId];
          offeringLecturerRolesMap[offering.id] = [
            {
              lecturerId: primaryLecturer.lecturerId,
              assignmentRole: 'PENGAMPU',
              lecturerName: primaryLecturer.lecturerName,
              lecturerCode: primaryLecturer.lecturerCode,
            },
          ];
        } else {
          offeringLecturerIdsMap[offering.id] = [];
          offeringLecturerRolesMap[offering.id] = [];
        }

        const participantCount =
          offering.currentParticipants > 0
            ? offering.currentParticipants
            : offering.expected_students;

        rows.push({
          offeringId: offering.id,
          courseId: offering.course_id,
          courseCode: group.courseCode,
          courseName: group.courseName,
          classCode: offering.class_code || 'A',
          semester: group.semester,
          curriculumYear: group.curriculumYear,
          effectiveSks: offering.effective_sks || group.sks || 3,
          expectedStudents: participantCount,
          requiredRoomType: offering.required_room_type || group.requiredRoomType || 'Ruang Kuliah Teori',
          targetRoomCapacity: offering.targetRoomCapacity || null,
          primaryLecturer,
          primaryLecturerId: primaryLecturer?.lecturerId || null,
          candidates: sortedCandidates,
          pengampuList: sortedCandidates,
          koordinatorList,
          lecturers: lecturerItems,
          hasMultipleCandidates,
          totalCandidates: sortedCandidates.length,
          isManuallySelected,
          status,
          hasPengampu,
          isTeamTeaching: hasMultipleCandidates,
          hasInactiveLecturer: hasInactive,
          hasMissingLecturer: hasMissing,
          isValid,
        });
      }

      // Sort rows: by semester asc, then courseName asc, then classCode asc
      rows.sort((a, b) => {
        if (a.semester !== b.semester) return a.semester - b.semester;
        if (a.courseName !== b.courseName) return a.courseName.localeCompare(b.courseName);
        return a.classCode.localeCompare(b.classCode);
      });

      // Calculate summaries
      const totalActiveOfferings = rows.length;
      const totalWithPengampu = rows.filter(
        (r) => r.hasPengampu && r.primaryLecturer && !r.primaryLecturer.isLecturerInactive && !r.primaryLecturer.isLecturerMissing
      ).length;
      const totalMultiCandidate = rows.filter((r) => r.hasMultipleCandidates).length;
      const totalMissingPengampu = rows.filter(
        (r) => !r.hasPengampu || !r.primaryLecturer || r.primaryLecturer.isLecturerMissing
      ).length;
      const totalInactiveLecturers = rows.filter(
        (r) => r.primaryLecturer?.isLecturerInactive || r.hasInactiveLecturer
      ).length;
      const isAllValid = rows.length > 0 && rows.every((r) => r.isValid);

      return {
        rows,
        totalActiveOfferings,
        totalWithPengampu,
        totalMultiCandidate,
        totalTeamTeaching: totalMultiCandidate,
        totalMissingPengampu,
        totalInactiveLecturers,
        isAllValid,
        offeringLecturerIdsMap,
        offeringLecturerRolesMap,
      };
    } catch (err: any) {
      console.error('[schedulingLecturersService] Error loading Step 3 lecturers:', err);
      throw err;
    }
  },

  /**
   * Updates the single primary lecturer for a course offering in planning_metadata.
   * Merges JSON to never overwrite other planning fields.
   */
  async updatePrimaryLecturer(
    offeringId: string,
    lecturerId: string
  ): Promise<{ success: boolean; updatedMetadata: Record<string, any> }> {
    if (!isSupabaseConfigured() || !offeringId || !lecturerId) {
      return { success: false, updatedMetadata: {} };
    }

    try {
      const isOwner = await verifyOwnerAdmin();
      if (!isOwner) {
        // Guest mode fallback
        return { success: true, updatedMetadata: { primary_lecturer_id: lecturerId } };
      }

      // 1. Fetch current planning_metadata to merge without overwriting
      const { data: current, error: fetchErr } = await supabase
        .from('course_offerings')
        .select('planning_metadata')
        .eq('id', offeringId)
        .single();

      if (fetchErr) {
        console.warn('Could not read existing planning_metadata before update:', fetchErr);
      }

      const existingMeta =
        current?.planning_metadata && typeof current.planning_metadata === 'object'
          ? current.planning_metadata
          : {};

      const mergedMeta = {
        ...existingMeta,
        primary_lecturer_id: lecturerId,
        primary_lecturer_assigned_at: new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from('course_offerings')
        .update({ planning_metadata: mergedMeta })
        .eq('id', offeringId);

      if (updateErr) {
        console.error('Failed to update course_offerings.planning_metadata:', updateErr);
        throw new Error(parseSupabaseError(updateErr));
      }

      return { success: true, updatedMetadata: mergedMeta };
    } catch (err: any) {
      console.error('[schedulingLecturersService] Error updating primary lecturer:', err);
      throw err;
    }
  },
};
