/**
 * Room-Capacity-Aware distribution and target capacity calculations.
 * NO fixed max 40 capacity limit.
 * Real capacity derived from active rooms in Supabase matching required_room_type.
 */

export interface OfferingDistributionTarget {
  id: string;
  class_code: string;
  expectedStudents: number;
  active: boolean;
}

export interface DistributedResult {
  offeringId: string;
  expectedStudents: number;
  targetRoomCapacity: number | null;
  seatWaste: number;
  isOversized: boolean;
}

export interface TargetCapacityResult {
  targetRoomCapacity: number | null;
  seatWaste: number;
  isOversized: boolean;
}

/**
 * Universal helper to identify practicum courses across the workflow:
 * "Mata kuliah PRAKTIKUM tetap tampil di paket kurikulum dan tetap dapat dicentang pada Step 1,
 * tetapi TIDAK ikut proses penjadwalan perkuliahan."
 */
export function isPracticum(
  course: { name?: string | null; courseName?: string | null } | string | null | undefined
): boolean {
  if (!course) return false;
  const rawName = (typeof course === 'string' ? course : course.courseName || course.name)?.trim().toLowerCase() ?? '';
  return rawName.startsWith('praktikum') || rawName.startsWith('prak.');
}

/**
 * Universal helper to identify KKN courses
 */
export function isKKN(
  course: { name?: string | null; courseName?: string | null; code?: string | null; courseCode?: string | null } | string | null | undefined
): boolean {
  if (!course) return false;
  const rawName = (typeof course === 'string' ? course : course.courseName || course.name)?.trim().toLowerCase() ?? '';
  const rawCode = (typeof course === 'object' ? course.courseCode || course.code : '')?.trim().toLowerCase() ?? '';
  return rawName.startsWith('kkn') || rawCode.startsWith('kkn') || rawName.includes('kuliah kerja nyata');
}

/**
 * Universal helper to identify PKL / Magang / Kerja Praktek courses
 */
export function isPKL(
  course: { name?: string | null; courseName?: string | null; code?: string | null; courseCode?: string | null } | string | null | undefined
): boolean {
  if (!course) return false;
  const rawName = (typeof course === 'string' ? course : course.courseName || course.name)?.trim().toLowerCase() ?? '';
  const rawCode = (typeof course === 'object' ? course.courseCode || course.code : '')?.trim().toLowerCase() ?? '';
  return (
    rawName.startsWith('pkl') ||
    rawCode.startsWith('pkl') ||
    rawName.includes('praktik kerja lapangan') ||
    rawName.includes('praktek kerja lapangan') ||
    rawName.includes('kerja praktek') ||
    rawName.includes('kerja praktik') ||
    rawName.includes('magang')
  );
}

/**
 * Checks if a course is non-schedulable in regular lecture schedule (Praktikum, KKN, PKL)
 */
export function isNonSchedulableCourse(
  course: { name?: string | null; courseName?: string | null; code?: string | null; courseCode?: string | null } | string | null | undefined
): boolean {
  return isPracticum(course) || isKKN(course) || isPKL(course);
}

/**
 * Universal helper to identify Elective (Mata Kuliah Pilihan) courses
 */
export function isElective(
  course: { name?: string | null; courseName?: string | null; category?: string | null; is_elective?: boolean } | string | null | undefined,
  categoryMap?: Map<string, string>
): boolean {
  if (!course) return false;
  if (typeof course === 'object' && course.is_elective) return true;
  if (typeof course === 'object' && course.category && course.category.toLowerCase().includes('pilihan')) return true;

  const rawName = (typeof course === 'string' ? course : course.courseName || course.name)?.trim().toLowerCase() ?? '';
  if (rawName.includes('(pilihan)') || rawName.includes('pilihan') || rawName.includes('elective')) return true;

  if (typeof course === 'object' && categoryMap) {
    const code = (course as any).courseCode || (course as any).code;
    if (code && categoryMap.get(code.trim().toUpperCase()) === 'Pilihan') {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes user input for participant counts:
 * - strips non-digit characters
 * - removes leading zeroes (e.g., '0123' -> 123, '00110' -> 110)
 * - ensures non-negative integer
 */
export function normalizeParticipantInput(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return Math.max(0, Math.floor(value));

  let cleaned = String(value).replace(/[^0-9]/g, '');
  if (cleaned.length > 1) {
    cleaned = cleaned.replace(/^0+/, '');
  }
  if (!cleaned) return 0;
  return parseInt(cleaned, 10) || 0;
}

/**
 * Calculates the smallest eligible room capacity that can accommodate participantCount.
 * 
 * Formula:
 * targetRoomCapacity = min(eligible room capacities where capacity >= participantCount)
 * 
 * Examples for Theory [25, 40, 60]:
 * 23 participants -> target = 25 (waste = 2)
 * 35 participants -> target = 40 (waste = 5)
 * 40 participants -> target = 40 (waste = 0)
 * 50 participants -> target = 60 (waste = 10)
 * 70 participants -> isOversized = true, target = null
 */
export function calculateTargetRoomCapacity(
  participantCount: number,
  eligibleCapacities: number[]
): TargetCapacityResult {
  if (participantCount <= 0) {
    return { targetRoomCapacity: null, seatWaste: 0, isOversized: false };
  }

  const sortedCapacities = [...eligibleCapacities].sort((a, b) => a - b);
  if (sortedCapacities.length === 0) {
    return { targetRoomCapacity: null, seatWaste: 0, isOversized: false };
  }

  const maxCapacity = sortedCapacities[sortedCapacities.length - 1];
  if (participantCount > maxCapacity) {
    return { targetRoomCapacity: null, seatWaste: 0, isOversized: true };
  }

  // Find the smallest capacity >= participantCount
  const target = sortedCapacities.find((cap) => cap >= participantCount);
  if (target !== undefined) {
    return {
      targetRoomCapacity: target,
      seatWaste: target - participantCount,
      isOversized: false,
    };
  }

  return { targetRoomCapacity: null, seatWaste: 0, isOversized: true };
}

/**
 * Room-capacity aware auto-distribution algorithm.
 * 
 * Objective:
 * 1. Total distributed equals totalParticipants
 * 2. No section exceeds max eligible capacity (if feasible)
 * 3. Minimize roomWaste = sum(targetRoomCapacity - participantCount)
 * 4. Maintain reasonable section balance
 */
export function distributeParticipantsWithRoomCapacity(
  totalParticipants: number,
  offerings: OfferingDistributionTarget[],
  eligibleCapacities: number[],
  recalculateAll: boolean = false
): DistributedResult[] {
  const activeOfferings = offerings.filter((o) => o.active);
  if (activeOfferings.length === 0) return [];

  const total = Math.max(0, totalParticipants);
  const sortedCapacities = [...eligibleCapacities].sort((a, b) => a - b);
  const maxCap = sortedCapacities.length > 0 ? sortedCapacities[sortedCapacities.length - 1] : 60;

  // Determine fixed vs unset offerings
  let fixedOfferings: OfferingDistributionTarget[] = [];
  let unsetOfferings: OfferingDistributionTarget[] = [];

  if (recalculateAll) {
    unsetOfferings = [...activeOfferings];
  } else {
    const alreadySet = activeOfferings.filter((o) => o.expectedStudents > 0);
    const unset = activeOfferings.filter((o) => o.expectedStudents <= 0);

    if (unset.length === 0 || alreadySet.length === 0) {
      unsetOfferings = [...activeOfferings];
    } else {
      fixedOfferings = alreadySet;
      unsetOfferings = unset;
    }
  }

  const fixedSum = fixedOfferings.reduce((acc, o) => acc + o.expectedStudents, 0);
  const remainingTotal = Math.max(0, total - fixedSum);
  const k = unsetOfferings.length;

  if (k === 0) {
    return fixedOfferings.map((o) => {
      const capRes = calculateTargetRoomCapacity(o.expectedStudents, sortedCapacities);
      return {
        offeringId: o.id,
        expectedStudents: o.expectedStudents,
        ...capRes,
      };
    });
  }

  // Generate candidate integer partitions for k sections with sum = remainingTotal
  const candidatePartitions: number[][] = [];

  // Candidate 1: Standard uniform split
  const base = Math.floor(remainingTotal / k);
  const rem = remainingTotal % k;
  const uniformPartition = Array.from({ length: k }, (_, idx) => base + (idx < rem ? 1 : 0));
  candidatePartitions.push(uniformPartition);

  // Candidate 2: Room-capacity fit partitions (e.g. trying combinations of available target capacities)
  if (sortedCapacities.length > 1 && remainingTotal > 0) {
    // Generate combinations of target capacities for k slots
    const targetCombos: number[][] = [];
    const generateCombos = (current: number[]) => {
      if (current.length === k) {
        targetCombos.push([...current]);
        return;
      }
      for (const cap of sortedCapacities) {
        generateCombos([...current, cap]);
      }
    };
    generateCombos([]);

    // Filter combos where sum of capacities >= remainingTotal
    const viableCombos = targetCombos
      .filter((combo) => combo.reduce((a, b) => a + b, 0) >= remainingTotal)
      .slice(0, 100); // limit for fast computation

    for (const combo of viableCombos) {
      // Sort combo descending
      combo.sort((a, b) => b - a);
      const comboCapSum = combo.reduce((a, b) => a + b, 0);
      
      // Allocate proportionally
      const partition: number[] = [];
      let currentAllocated = 0;

      for (let i = 0; i < k; i++) {
        if (i === k - 1) {
          partition.push(remainingTotal - currentAllocated);
        } else {
          // proportional allocation
          const raw = Math.round((combo[i] / comboCapSum) * remainingTotal);
          const val = Math.min(combo[i], Math.max(1, raw));
          partition.push(val);
          currentAllocated += val;
        }
      }

      // Check if all elements in partition <= maxCap and >= 0 and sum == remainingTotal
      const partSum = partition.reduce((a, b) => a + b, 0);
      if (partSum === remainingTotal && partition.every((p) => p > 0 && p <= maxCap)) {
        candidatePartitions.push(partition);
      }
    }
  }

  // Score candidate partitions
  const scorePartition = (partition: number[]): number => {
    let totalWaste = 0;
    let oversizedPenalty = 0;

    for (const p of partition) {
      const res = calculateTargetRoomCapacity(p, sortedCapacities);
      if (res.isOversized) {
        oversizedPenalty += 10000;
      } else {
        totalWaste += res.seatWaste;
      }
    }

    // Small balance penalty (variance) to keep sizes reasonably balanced
    const avg = remainingTotal / k;
    const variance = partition.reduce((acc, p) => acc + Math.pow(p - avg, 2), 0) / k;
    const balancePenalty = Math.sqrt(variance) * 0.1;

    return totalWaste + oversizedPenalty + balancePenalty;
  };

  let bestPartition = uniformPartition;
  let bestScore = scorePartition(uniformPartition);

  for (const partition of candidatePartitions) {
    const score = scorePartition(partition);
    if (score < bestScore) {
      bestScore = score;
      bestPartition = partition;
    }
  }

  // Construct results
  const results: DistributedResult[] = [];

  // Add fixed offerings
  fixedOfferings.forEach((o) => {
    const capRes = calculateTargetRoomCapacity(o.expectedStudents, sortedCapacities);
    results.push({
      offeringId: o.id,
      expectedStudents: o.expectedStudents,
      ...capRes,
    });
  });

  // Add unset offerings with best partition
  unsetOfferings.forEach((o, idx) => {
    const count = bestPartition[idx] || 0;
    const capRes = calculateTargetRoomCapacity(count, sortedCapacities);
    results.push({
      offeringId: o.id,
      expectedStudents: count,
      ...capRes,
    });
  });

  return results;
}
