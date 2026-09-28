import { EvaluatedCandidate } from './candidateValidator';
import { SmartSuggestion, ProposedSwapChange } from './types';

/**
 * Score an evaluated candidate and produce a detailed SmartSuggestion with rationale
 */
export function scoreAndFormatSuggestion(
  evaluated: EvaluatedCandidate,
  versionId?: string,
  conflictId?: string
): SmartSuggestion {
  const {
    candidate,
    resolvedConflicts,
    newConflicts,
    hardViolationsCount,
    softScoreImprovement,
  } = evaluated;

  // 1. Scoring Logic (Base 50, +30 for resolving conflicts, +20 for 0 hard violations, -30 for new conflicts)
  let score = 50;

  // Bonus for resolving conflicts
  score += Math.min(35, resolvedConflicts.length * 20);

  // Bonus for clean solution (0 hard conflicts)
  if (hardViolationsCount === 0) {
    score += 15;
  } else {
    score -= hardViolationsCount * 15;
  }

  // Penalty for introducing new conflicts
  score -= newConflicts.length * 25;

  // Soft constraint adjustment
  score += Math.max(-15, Math.min(15, softScoreImprovement));

  // Clamping score between 10 and 99
  const finalScore = Math.max(10, Math.min(99, Math.round(score)));

  // 2. Generate Clear Rationale in Indonesian
  const courseName =
    candidate.offering.course?.name || candidate.offering.class_name || 'Mata Kuliah';
  const classCode = candidate.offering.class_code;
  const currentLoc = `${candidate.currentPlacement.dayName} ${candidate.currentPlacement.startTime} (${candidate.currentPlacement.roomCode})`;
  const targetLoc = `${candidate.targetPlacement.dayName} ${candidate.targetPlacement.startTime} (${candidate.targetPlacement.roomCode})`;

  let rationale = '';
  let title = '';

  const resolvedTitles = resolvedConflicts.map((c) => c.title);

  switch (candidate.type) {
    case 'MOVE_TIME':
      title = `Pindahkan Waktu: ${candidate.targetPlacement.dayName} ${candidate.targetPlacement.startTime}`;
      if (resolvedConflicts.length > 0) {
        rationale = `Memindahkan jadwal ${courseName} (Kelas ${classCode}) dari ${currentLoc} ke slot waktu ${targetLoc} berhasil meniadakan ${resolvedConflicts.length} konflik (${resolvedTitles.join(', ')}) tanpa menambah bentrok baru pada ruangan ${candidate.targetPlacement.roomCode}.`;
      } else {
        rationale = `Menggeser jadwal ${courseName} (Kelas ${classCode}) ke ${targetLoc} memberikan distribusi waktu yang lebih seimbang dan sesuai ketersediaan dosen.`;
      }
      break;

    case 'MOVE_ROOM':
      title = `Ganti Ruangan: ${candidate.targetPlacement.roomCode} (${candidate.targetPlacement.roomName})`;
      if (resolvedConflicts.length > 0) {
        rationale = `Mengalihkan alokasi ruang dari ${candidate.currentPlacement.roomCode} ke ${candidate.targetPlacement.roomCode} menyelesaikan masalah kapasitas dan ketersediaan ruang (${resolvedTitles.join(', ')}).`;
      } else {
        rationale = `Ruangan ${candidate.targetPlacement.roomCode} memiliki kapasitas yang pas dan fasilitas sesuai kebutuhan kelas ${courseName}.`;
      }
      break;

    case 'MOVE_TIME_ROOM':
      title = `Pindah Waktu & Ruang: ${targetLoc}`;
      if (resolvedConflicts.length > 0) {
        rationale = `Penyesuaian terkoordinasi ke ${targetLoc} mengeliminasi seluruh bentrok jadwal (${resolvedTitles.join(', ')}) serta menjamin ruangan yang cukup.`;
      } else {
        rationale = `Pemindahan alternatif ke ${targetLoc} bebas dari bentrok waktu dan dosen.`;
      }
      break;

    case 'SWAP':
      const swapCourse =
        candidate.swapTargetEntry?.course_name ||
        candidate.swapTargetEntry?.course_offering?.course?.name ||
        'Kelas Lain';
      title = `Tukar Slot dengan ${swapCourse}`;
      if (resolvedConflicts.length > 0) {
        rationale = `Saling menukar jadwal antara ${courseName} (${currentLoc}) dengan ${swapCourse} (${targetLoc}) berhasil memecahkan konflik (${resolvedTitles.join(', ')}) karena bobot SKS kedua mata kuliah sama.`;
      } else {
        rationale = `Pertukaran jadwal antara ${courseName} dan ${swapCourse} mempertahankan kontinuitas sesi dan bebas bentrok.`;
      }
      break;
  }

  // 3. Prepare Swap Details if applicable
  let swapDetails: ProposedSwapChange | undefined;
  if (candidate.type === 'SWAP' && candidate.swapTargetEntry && candidate.swapTargetPlacement) {
    swapDetails = {
      sourceEntryId: candidate.entryId,
      targetEntryId: candidate.swapTargetEntry.id,
      sourceOfferingId: candidate.offering.id,
      targetOfferingId: candidate.swapTargetEntry.course_offering_id,
      sourceCourseName: courseName,
      targetCourseName:
        candidate.swapTargetEntry.course_name ||
        candidate.swapTargetEntry.course_offering?.course?.name ||
        'Kelas Lain',
      sourcePlacement: candidate.targetPlacement,
      targetPlacement: candidate.swapTargetPlacement,
    };
  }

  const suggestionId = `sugg-${candidate.type.toLowerCase()}-${candidate.entryId.slice(-5)}-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 5)}`;

  return {
    id: suggestionId,
    scheduleVersionId: versionId,
    conflictId: conflictId,
    scheduleEntryId: candidate.entryId,
    courseOfferingId: candidate.offering.id,
    courseName,
    courseCode: candidate.offering.course?.code || undefined,
    classCode,
    suggestionType: candidate.type,
    title,
    rationale,
    currentPlacement: candidate.currentPlacement,
    proposedPlacement: candidate.targetPlacement,
    swapDetails,
    score: finalScore,
    status: 'PENDING',
    impact: {
      resolvedConflictsCount: resolvedConflicts.length,
      newConflictsCount: newConflicts.length,
      resolvedConflictTitles: resolvedTitles,
      hardConflictFree: hardViolationsCount === 0,
      softCostImprovement: softScoreImprovement,
    },
    createdAt: new Date().toISOString(),
  };
}
