import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Printer,
  History,
  Lock,
  ArrowLeft,
  Search,
  Filter,
  Layers,
  LayoutGrid,
  List,
  DoorOpen,
  Info,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  TrendingDown,
  Sparkles,
  ArrowRightLeft,
  X,
  FileCheck,
  ExternalLink,
  PlusCircle,
  Save,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  InitialScheduleEntry,
  InitialScheduleConflict,
  InitialScheduleOffering,
} from '../../../services/schedulingInitial.service';
import {
  Room,
  TimeSlot,
  LecturerAvailability,
  ScheduleVersion,
  ScheduleConflict,
} from '../../../types';
import { scheduleVersionsService } from '../../../services/scheduleVersions.service';
import { scheduleConflictsService } from '../../../services/scheduleConflicts.service';
import { schedulingOptimizationService } from '../../../services/schedulingOptimization.service';
import { minuteToTime, timeToMinute, dayOfWeekToName, cn, parseSupabaseError, sortScheduleEntries } from '../../../lib/utils';
import { getTimeProfileInfo, getSessionDefinitions } from '../../../lib/academicTimeProfile';
import { toast } from '../../ui/Toast';
import { useNavigate } from 'react-router-dom';
import { AppleWeeklyCalendar } from '../../schedule/AppleWeeklyCalendar';
import { AppleScheduleCardData } from '../../schedule/AppleScheduleCard';

interface SchedulingPreviewPublishViewProps {
  entries: InitialScheduleEntry[];
  allOfferings?: InitialScheduleOffering[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  activeTerm: any;
  selectedSemesterType: 'GANJIL' | 'GENAP';
  onBackToStep4?: () => void;
  onBackToStep5: () => void;
  onRefreshEntries: () => Promise<void>;
  optimizationMeta?: {
    initialConflicts: number;
    bestConflicts: number;
    initialCost: number;
    bestCost: number;
    executionTimeMs: number;
    seed: number;
  } | null;
  currentVersion?: ScheduleVersion | null;
  onUpdateVersion?: (version: ScheduleVersion) => void;
  onPublishSuccess?: () => void;
  workflowStateSnapshot?: any;
}

export const SchedulingPreviewPublishView: React.FC<SchedulingPreviewPublishViewProps> = ({
  entries,
  allOfferings,
  rooms,
  timeSlots,
  availabilities,
  activeTerm,
  selectedSemesterType,
  onBackToStep4,
  onBackToStep5,
  onRefreshEntries,
  optimizationMeta,
  currentVersion,
  onUpdateVersion,
  onPublishSuccess,
  workflowStateSnapshot,
}) => {
  const navigate = useNavigate();

  // Version and Conflict states
  const [version, setVersion] = useState<ScheduleVersion | null>(currentVersion || null);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [backendEntries, setBackendEntries] = useState<InitialScheduleEntry[]>([]);
  const [loadingVersion, setLoadingVersion] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [showUnscheduledModal, setShowUnscheduledModal] = useState<boolean>(false);
  const [publishTitle, setPublishTitle] = useState<string>('');

  const handleOpenPublishModal = async () => {
    if (publishing) return;

    // 1. Completeness Check: Do not allow publishing if incomplete
    if (checklist.unscheduledCount > 0 || !checklist.isComplete) {
      toast.error(
        `Gagal menerbitkan: Masih ada ${checklist.unscheduledCount} kelas aktif yang belum dijadwalkan. Lengkapi seluruh kelas terlebih dahulu.`
      );
      setShowUnscheduledModal(true);
      return;
    }

    // 2. Conflict Check: Do not allow publishing if hard conflicts exist
    if (conflicts.length > 0 || checklist.hasHardConflict) {
      if (version?.id) {
        await scheduleVersionsService.refreshConflicts(version.id);
      }
      toast.error(
        `${conflicts.length} konflik ditemukan. Silakan selesaikan konflik sebelum melanjutkan.`
      );
      if (version?.id) {
        navigate(`/konflik-jadwal?version=${version.id}`);
      }
      return;
    }

    setPublishTitle(
      version?.title ||
        `Jadwal Perkuliahan - ${activeTerm?.academic_year || '2026/2027'} ${activeTerm?.semester_type || selectedSemesterType}`
    );
    setShowPublishModal(true);
  };

  // View modes: MATRIKS_HARI, MATRIKS_RUANGAN, TABEL_DAFTAR
  const [viewMode, setViewMode] = useState<'MATRIKS_HARI' | 'MATRIKS_RUANGAN' | 'TABEL_DAFTAR'>('MATRIKS_HARI');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<number | 'ALL'>('ALL');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | 'ALL'>('ALL');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string | 'ALL'>('ALL');
  const [selectedLecturerFilter, setSelectedLecturerFilter] = useState<string | 'ALL'>('ALL');
  const [selectedRoomMatrixDay, setSelectedRoomMatrixDay] = useState<number>(1);

  // Selected entry for Detail Drawer & Final Adjustment
  const [selectedEntry, setSelectedEntry] = useState<InitialScheduleEntry | null>(null);
  const [drawerTab, setDrawerTab] = useState<'RECOMMENDATIONS' | 'MANUAL' | 'SWAP'>('RECOMMENDATIONS');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);
  const [adjustRoomId, setAdjustRoomId] = useState<string>('');
  const [adjustDay, setAdjustDay] = useState<number>(1);
  const [adjustStartMinute, setAdjustStartMinute] = useState<number>(470);
  const [adjustingLoading, setAdjustingLoading] = useState<boolean>(false);

  // Smart Move Recommendations state
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState<boolean>(false);
  const [applyingRecommendationId, setApplyingRecommendationId] = useState<string | null>(null);

  // Swap Schedule Modal state
  const [showSwapModal, setShowSwapModal] = useState<boolean>(false);
  const [swapTargetEntryId, setSwapTargetEntryId] = useState<string>('');
  const [swappingLoading, setSwappingLoading] = useState<boolean>(false);

  // Active entries to display: persisted database entries if available, otherwise in-memory bestSolution
  const activeEntries = useMemo(() => {
    return backendEntries.length > 0 ? backendEntries : entries;
  }, [backendEntries, entries]);

  // Quick save optimized solution to backend draft if navigated before applying
  const [savingToDraft, setSavingToDraft] = useState<boolean>(false);

  const handleQuickSaveDraft = async () => {
    if (entries.length === 0) return;
    setSavingToDraft(true);
    try {
      // 0. PREFLIGHT GUARD: Ensure version is a valid LECTURE draft
      let targetVersion = version;
      let check = scheduleVersionsService.assertDraftContext({
        version: targetVersion,
        expectedType: 'LECTURE',
        academicTermId: activeTerm?.id,
      });

      if (!check.valid || !targetVersion) {
        // Attempt recovery: resolve active LECTURE draft from DB
        const recovered = await scheduleVersionsService.resolveActiveDraft({
          academicTermId: activeTerm.id,
          type: 'LECTURE',
        });

        if (recovered) {
          targetVersion = recovered;
          setVersion(recovered);
          if (onUpdateVersion) onUpdateVersion(recovered);
          check = { valid: true };
        } else {
          // If no draft exists, create a new LECTURE draft
          const title = `Jadwal Perkuliahan - ${activeTerm.academic_year || '2026/2027'} ${activeTerm.semester_type || 'GANJIL'}`;
          const newDraft = await scheduleVersionsService.createDraft(activeTerm.id, title);
          targetVersion = newDraft;
          setVersion(newDraft);
          if (onUpdateVersion) onUpdateVersion(newDraft);
          check = { valid: true };
        }
      }

      if (!targetVersion?.id) {
        throw new Error('Konteks draft perkuliahan tidak valid. Silakan muat ulang halaman.');
      }

      // Fetch fresh revision directly from DB before sending RPC
      const freshTarget = await scheduleVersionsService.getVersionById(targetVersion.id);
      if (freshTarget) {
        targetVersion = freshTarget;
        setVersion(freshTarget);
      }

      // 1. Get unique offering IDs from bestSolution in memory (e.g. 17 items)
      const offeringIds = Array.from(
        new Set(entries.map((item) => item.courseOfferingId))
      );

      // 2. STAGE 1: set_schedule_scope
      const { data: scopeData, error: scopeError } = await supabase.rpc('set_schedule_scope', {
        p_version_id: targetVersion.id,
        p_expected_revision: targetVersion.revision,
        p_offering_ids: offeringIds,
      });

      if (scopeError) {
        console.error('set_schedule_scope RPC error:', scopeError);
        throw new Error(parseSupabaseError(scopeError));
      }

      // Parse revisionAfterScope
      let revisionAfterScope = targetVersion.revision + 1;
      if (typeof scopeData === 'number') {
        revisionAfterScope = scopeData;
      } else if (scopeData && typeof (scopeData as any).revision === 'number') {
        revisionAfterScope = (scopeData as any).revision;
      }

      // 3. STAGE 2: save_draft_entries using revisionAfterScope
      // Send ONLY course_offering_id, room_id, day_of_week, start_minute
      const entriesPayload = entries.map((item) => ({
        course_offering_id: item.courseOfferingId,
        room_id: item.roomId,
        day_of_week: Number(item.dayOfWeek),
        start_minute: Number(item.startMinute),
      }));

      const { data: saveData, error: saveError } = await supabase.rpc('save_draft_entries', {
        p_version_id: targetVersion.id,
        p_expected_revision: revisionAfterScope,
        p_entries: entriesPayload,
        p_reason: 'SIMULATED_ANNEALING',
      });

      if (saveError) {
        console.error('save_draft_entries RPC error:', saveError);
        throw new Error(parseSupabaseError(saveError));
      }

      // 4. Refetch schedule_versions & schedule_entries
      const updatedVersions = await scheduleVersionsService.getLectureVersions(activeTerm.id);
      const latestDraft = updatedVersions.find((v) => v.id === targetVersion.id);
      if (latestDraft) {
        setVersion(latestDraft);
        if (onUpdateVersion) onUpdateVersion(latestDraft);
      }

      const dbEntries = await schedulingOptimizationService.fetchVersionScheduleEntries(
        targetVersion.id,
        rooms
      );
      setBackendEntries(dbEntries);

      // 5. Refresh conflicts RPC & refetch conflicts
      await supabase.rpc('refresh_schedule_conflicts', { p_version_id: targetVersion.id });

      const backendConflicts = await scheduleConflictsService.getConflicts(targetVersion.id, {
        isResolved: false,
      });
      setConflicts(backendConflicts);

      // 6. VERIFIKASI DATABASE
      const verifiedScopeCount = latestDraft?.scope_offering_ids?.length || 0;
      const verifiedEntriesCount = dbEntries.length;

      if (verifiedScopeCount !== offeringIds.length || verifiedEntriesCount !== offeringIds.length) {
        const mismatchMsg = `Database persistence mismatch: scope=${verifiedScopeCount}, entries=${verifiedEntriesCount}, expected=${offeringIds.length}`;
        console.error(mismatchMsg);
        throw new Error(mismatchMsg);
      }

      toast.success(`${verifiedEntriesCount} jadwal berhasil disimpan ke draft.`);
    } catch (err: any) {
      console.error('Quick save to draft error:', err);
      toast.error('Gagal menyimpan hasil optimasi ke database: ' + (err?.message || 'Error tidak diketahui'));
    } finally {
      setSavingToDraft(false);
    }
  };

  // Load latest Draft Version, backend entries, and backend conflicts
  const loadVersionAndConflicts = async () => {
    if (!activeTerm?.id) return;
    setLoadingVersion(true);
    try {
      let draft = version;
      if (!draft || !draft.id) {
        const versions = await scheduleVersionsService.getVersions(activeTerm.id);
        draft = versions.find((v) => v.status === 'DRAFT') || versions[0] || null;
      } else {
        const fresh = await scheduleVersionsService.getVersionById(draft.id);
        if (fresh) draft = fresh;
      }

      setVersion(draft);
      if (draft && onUpdateVersion) {
        onUpdateVersion(draft);
      }

      if (draft) {
        // Step 5 requirement: refresh_schedule_conflicts before preview
        await scheduleVersionsService.refreshConflicts(draft.id);
        const backendConflicts = await scheduleConflictsService.getConflicts(draft.id, {
          isResolved: false,
        });
        setConflicts(backendConflicts);

        // Fetch backend entries directly from Supabase schedule_entries table
        const dbEntries = await schedulingOptimizationService.fetchVersionScheduleEntries(
          draft.id,
          rooms
        );
        setBackendEntries(dbEntries);
      }
    } catch (err: any) {
      console.error('Error loading version/conflicts in Step 6:', err);
    } finally {
      setLoadingVersion(false);
    }
  };

  useEffect(() => {
    loadVersionAndConflicts();
  }, [activeTerm?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshEntries();
      await loadVersionAndConflicts();
      toast.success('Data jadwal dan status konflik berhasil diperbarui.');
    } catch (e) {
      toast.error('Gagal memperbarui data.');
    } finally {
      setRefreshing(false);
    }
  };

  // Academic Time Profile Info for this schedule version
  const scheduleTimeProfileInfo = useMemo(() => {
    const isRamadanFromSlots = timeSlots.some((s) => s.duration_minutes === 40 || s.start_minute === 480);
    const profileFromVersion = getTimeProfileInfo({
      workflow_state: currentVersion?.workflow_state || workflowStateSnapshot,
      minutes_per_session: (entries[0] as any)?.minutes_per_session,
    });

    if (isRamadanFromSlots && profileFromVersion.timeProfile === 'NORMAL') {
      return {
        timeProfile: 'RAMADAN' as const,
        minutesPerSks: 40,
        label: 'Ramadan • 40 menit/SKS',
      };
    }
    return profileFromVersion;
  }, [currentVersion, workflowStateSnapshot, entries, timeSlots]);

  // Dynamic teaching sessions (Normal: 10 active + 2 breaks, Ramadan: 11 active + 1 break)
  const standardSessions = useMemo(() => {
    const rawSessions = getSessionDefinitions(scheduleTimeProfileInfo.timeProfile);
    return rawSessions.map((s) => ({
      num: s.sessionNumber,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
      label: s.label,
      isBreak: s.isBreak,
    }));
  }, [scheduleTimeProfileInfo]);

  const daysList = [
    { num: 1, name: 'SENIN' },
    { num: 2, name: 'SELASA' },
    { num: 3, name: 'RABU' },
    { num: 4, name: 'KAMIS' },
    { num: 5, name: 'JUMAT' },
  ];

  const availableSemesters = useMemo(() => {
    return selectedSemesterType === 'GANJIL' ? [1, 3, 5, 7] : [2, 4, 6, 8];
  }, [selectedSemesterType]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    activeEntries.forEach((e) => {
      if (e.offering?.classCode) set.add(e.offering.classCode);
    });
    return Array.from(set).sort();
  }, [activeEntries]);

  const uniqueLecturers = useMemo(() => {
    const map = new Map<string, string>();
    activeEntries.forEach((e) => {
      if (e.offering?.primaryLecturerId && e.offering?.primaryLecturerName) {
        map.set(e.offering.primaryLecturerId, e.offering.primaryLecturerName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [activeEntries]);

  // Set of offering IDs that have conflicts
  const conflictedOfferingIds = useMemo(() => {
    const set = new Set<string>();
    conflicts.forEach((c) => {
      if (c.conflict_source) set.add(c.conflict_source);
    });
    // Also include entries with entry.conflicts
    activeEntries.forEach((e) => {
      if (e.conflicts && e.conflicts.length > 0) {
        set.add(e.courseOfferingId);
      }
    });
    return set;
  }, [conflicts, activeEntries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    const list = activeEntries.filter((entry) => {
      if (selectedSemesterFilter !== 'ALL' && entry.offering.semester !== selectedSemesterFilter) {
        return false;
      }
      if (selectedClassFilter !== 'ALL' && entry.offering.classCode !== selectedClassFilter) {
        return false;
      }
      if (selectedRoomFilter !== 'ALL' && entry.roomId !== selectedRoomFilter) {
        return false;
      }
      if (selectedLecturerFilter !== 'ALL' && entry.offering.primaryLecturerId !== selectedLecturerFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCourse =
          entry.offering.courseName.toLowerCase().includes(q) ||
          entry.offering.courseCode.toLowerCase().includes(q);
        const matchesLecturer = entry.offering.primaryLecturerName.toLowerCase().includes(q);
        const matchesRoom = entry.roomCode.toLowerCase().includes(q);
        if (!matchesCourse && !matchesLecturer && !matchesRoom) return false;
      }
      return true;
    });
    return sortScheduleEntries(list);
  }, [
    activeEntries,
    selectedSemesterFilter,
    selectedClassFilter,
    selectedRoomFilter,
    selectedLecturerFilter,
    searchQuery,
  ]);

  // Convert filteredEntries to AppleScheduleCardData for AppleWeeklyCalendar
  const calendarEntries: AppleScheduleCardData[] = useMemo(() => {
    return filteredEntries.map((entry) => ({
      id: entry.courseOfferingId,
      course_name: entry.offering.courseName,
      course_code: entry.offering.courseCode,
      class_name: entry.offering.classCode,
      start_time: entry.startTime,
      end_time: entry.endTime,
      room_code: entry.roomCode,
      room_name: entry.roomName,
      lecturer_names: entry.offering.primaryLecturerName,
      sks: entry.offering.effectiveSks,
      isConflict: conflictedOfferingIds.has(entry.courseOfferingId),
      conflictReason: 'Bentrok Terdeteksi',
      raw: {
        ...entry,
        day_of_week: entry.dayOfWeek,
        start_minute: entry.startMinute,
        end_minute: entry.endMinute,
      },
    }));
  }, [filteredEntries, conflictedOfferingIds]);

  // Semester badge colors
  const getSemesterColorClass = (semester: number) => {
    switch (semester) {
      case 1:
        return 'bg-blue-50/90 text-blue-900 border-blue-200 hover:border-blue-400';
      case 2:
        return 'bg-cyan-50/90 text-cyan-900 border-cyan-200 hover:border-cyan-400';
      case 3:
        return 'bg-indigo-50/90 text-indigo-900 border-indigo-200 hover:border-indigo-400';
      case 4:
        return 'bg-teal-50/90 text-teal-900 border-teal-200 hover:border-teal-400';
      case 5:
        return 'bg-purple-50/90 text-purple-900 border-purple-200 hover:border-purple-400';
      case 6:
        return 'bg-amber-50/90 text-amber-900 border-amber-200 hover:border-amber-400';
      case 7:
        return 'bg-emerald-50/90 text-emerald-900 border-emerald-200 hover:border-emerald-400';
      case 8:
        return 'bg-rose-50/90 text-rose-900 border-rose-200 hover:border-rose-400';
      default:
        return 'bg-slate-50/90 text-slate-900 border-slate-200 hover:border-slate-400';
    }
  };

  // Set of scheduled offering IDs
  const scheduledOfferingIds = useMemo(() => {
    const set = new Set<string>();
    activeEntries.forEach((e) => {
      if (e.courseOfferingId) set.add(e.courseOfferingId);
      if (e.offering?.id) set.add(e.offering.id);
    });
    return set;
  }, [activeEntries]);

  // Scope count & Unscheduled Offerings list with reason analysis
  const unscheduledOfferings = useMemo(() => {
    if (!allOfferings || allOfferings.length === 0) return [];

    return allOfferings
      .filter((off) => !scheduledOfferingIds.has(off.id))
      .map((off) => {
        let reason = 'Belum diproses pada penyusunan awal';
        const activeRooms = rooms.filter((r) => r.is_active !== false);
        const maxCapacity = activeRooms.reduce((max, r) => Math.max(max, r.capacity || 0), 0);

        if (off.expectedStudents > maxCapacity) {
          reason = `Tidak ada ruangan berkapasitas cukup (${off.expectedStudents} mhs > maks ${maxCapacity} kursi)`;
        } else if (off.requiredRoomType && !activeRooms.some((r) => r.room_type === off.requiredRoomType)) {
          reason = `Tidak ada ruangan jenis ${off.requiredRoomType} yang aktif`;
        } else if (!off.primaryLecturerId || off.isLecturerInactive) {
          reason = 'Dosen pengampu belum ditentukan atau nonaktif';
        } else {
          reason = 'Tidak ditemukan kombinasi slot dan ruangan yang feasible tanpa bentrok';
        }

        return {
          ...off,
          reason,
        };
      });
  }, [allOfferings, scheduledOfferingIds, rooms]);

  // Pre-Publish Checklist evaluation (Strict backend source of truth validation)
  const checklist = useMemo(() => {
    const backendCount = backendEntries.length;
    const scopeCount =
      allOfferings && allOfferings.length > 0
        ? allOfferings.length
        : version?.scope_offering_ids?.length ?? activeEntries.length;

    const scheduledCount = backendCount > 0 ? backendCount : activeEntries.length;
    const unscheduledCount = Math.max(0, scopeCount - scheduledCount);

    const roomConflicts = conflicts.filter((c) => c.conflict_type === 'ROOM').length;
    const lecturerConflicts = conflicts.filter((c) => c.conflict_type === 'LECTURER').length;
    const classConflicts = conflicts.filter((c) => c.conflict_type === 'CLASS').length;
    const capacityConflicts = conflicts.filter((c) => c.conflict_type === 'CAPACITY').length;
    const slotInvalidConflicts = conflicts.filter(
      (c) => (c as any).type === 'LECTURER_UNAVAILABLE' || (c as any).type === 'FRIDAY_PRAYER'
    ).length;

    // Capacity check
    const capacityViolations = activeEntries.filter(
      (e) => e.offering.expectedStudents > e.roomCapacity
    ).length;

    // Room type check
    const roomTypeViolations = activeEntries.filter((e) => {
      const r = rooms.find((rm) => rm.id === e.roomId);
      return r && e.offering.requiredRoomType && r.room_type !== e.offering.requiredRoomType;
    }).length;

    // Scope check: must be saved to backend draft and match scope
    const isSavedToDraft = backendCount > 0;
    const isComplete = scopeCount > 0 && scheduledCount >= scopeCount && unscheduledCount === 0;
    const hasHardConflict =
      conflicts.length > 0 || capacityViolations > 0 || roomTypeViolations > 0;

    const isReadyToPublish =
      version?.status === 'DRAFT' &&
      isSavedToDraft &&
      isComplete &&
      !hasHardConflict;

    // Detailed blocker explanations (Strict requirement 9)
    let blockerMessage = '';
    if (version?.status !== 'DRAFT') {
      blockerMessage = 'Jadwal versi ini telah diterbitkan resmi (read-only).';
    } else if (scopeCount === 0) {
      blockerMessage = 'Scope jadwal belum ditentukan (0 kelas dalam scope). Kembali ke Tahap 2 untuk menetapkan rombel.';
    } else if (!isSavedToDraft) {
      blockerMessage = `${scheduledCount} / ${scopeCount} kelas terjadwal, tetapi hasil optimasi belum disimpan ke draft database.`;
    } else if (unscheduledCount > 0) {
      blockerMessage = `Belum Lengkap: Masih terdapat ${unscheduledCount} kelas aktif yang belum memiliki alokasi jadwal.`;
    } else if (conflicts.length > 0) {
      blockerMessage = `Terdapat ${conflicts.length} bentrok hard constraint pada jadwal perkuliahan. Selesaikan seluruh bentrok sebelum publikasi.`;
    } else if (capacityViolations > 0) {
      blockerMessage = `Terdapat ${capacityViolations} kelas dengan kapasitas ruangan kurang dari jumlah peserta.`;
    } else if (roomTypeViolations > 0) {
      blockerMessage = `Terdapat ${roomTypeViolations} kelas dengan jenis ruangan tidak sesuai.`;
    }

    return {
      scopeCount,
      scheduledCount,
      unscheduledCount,
      roomConflicts,
      lecturerConflicts,
      classConflicts,
      capacityConflicts,
      capacityViolations,
      roomTypeViolations,
      slotInvalidConflicts,
      isComplete,
      hasHardConflict,
      allScheduled: isSavedToDraft && isComplete,
      noRoomConflict: isSavedToDraft && roomConflicts === 0,
      noLecturerConflict: isSavedToDraft && lecturerConflicts === 0,
      noClassConflict: isSavedToDraft && classConflicts === 0,
      capacityOk: isSavedToDraft && capacityConflicts === 0 && capacityViolations === 0,
      roomTypeOk: isSavedToDraft && roomTypeViolations === 0,
      slotsValid: isSavedToDraft && slotInvalidConflicts === 0,
      lecturerAvailable: isSavedToDraft && lecturerConflicts === 0,
      practicumExcluded: true, // strictly excluded from Step 4-6
      isReadyToPublish,
      blockerMessage,
      backendCount,
    };
  }, [backendEntries, activeEntries, allOfferings, conflicts, rooms, version?.status, version?.scope_offering_ids]);

  // Publication Status evaluation
  const publicationStatus: 'PUBLISHED' | 'READY' | 'INCOMPLETE' | 'CONFLICT' = useMemo(() => {
    if (version?.status === 'PUBLISHED') return 'PUBLISHED';
    if (checklist.hasHardConflict || conflicts.length > 0) return 'CONFLICT';
    if (checklist.unscheduledCount > 0 || !checklist.isComplete) return 'INCOMPLETE';
    return 'READY';
  }, [version?.status, checklist.hasHardConflict, conflicts.length, checklist.unscheduledCount, checklist.isComplete]);

  // Fetch Smart Move Recommendations
  const fetchRecommendations = async (entry: InitialScheduleEntry) => {
    setLoadingRecommendations(true);
    setRecommendations([]);
    try {
      // 1. Call backend RPC get_schedule_move_recommendations
      let rpcRecs: any[] = [];
      if (entry.id && !entry.id.startsWith('mock-')) {
        try {
          rpcRecs = await scheduleVersionsService.getMoveRecommendations(entry.id, 5);
        } catch (e) {
          console.warn('RPC recommendations call warning:', e);
        }
      }

      // 2. Client-side intelligent candidate evaluator as robust support
      const durationMinutes = (entry.offering.effectiveSks || 2) * 50;
      const activeRooms = rooms.filter((r) => r.is_active !== false);
      const otherEntries = activeEntries.filter((e) => e.courseOfferingId !== entry.courseOfferingId);

      const candidates: any[] = [];

      for (let day = 1; day <= 5; day++) {
        for (const session of standardSessions.slice(0, 13 - (entry.offering.effectiveSks || 2))) {
          const startMin = session.startMinute;
          const endMin = startMin + durationMinutes;

          // Check lecturer availability constraints
          const isLectUnavail = availabilities.some(
            (a) =>
              a.lecturer_id === entry.offering.primaryLecturerId &&
              a.day_of_week === day &&
              a.is_available === false &&
              startMin < a.end_minute &&
              a.start_minute < endMin
          );
          if (isLectUnavail) continue;

          // Check lecturer conflict with other entries
          const isLectOverlap = otherEntries.some(
            (e) =>
              e.offering.primaryLecturerId === entry.offering.primaryLecturerId &&
              e.dayOfWeek === day &&
              startMin < e.endMinute &&
              e.startMinute < endMin
          );
          if (isLectOverlap) continue;

          // Check class group conflict
          const isClassOverlap = otherEntries.some(
            (e) =>
              e.offering.semester === entry.offering.semester &&
              e.offering.classCode === entry.offering.classCode &&
              e.dayOfWeek === day &&
              startMin < e.endMinute &&
              e.startMinute < endMin
          );
          if (isClassOverlap) continue;

          // Find suitable conflict-free rooms
          for (const r of activeRooms) {
            if (r.capacity < entry.offering.expectedStudents) continue;
            if (entry.offering.requiredRoomType && r.room_type !== entry.offering.requiredRoomType) continue;

            // Check room overlap
            const isRoomOverlap = otherEntries.some(
              (e) =>
                e.roomId === r.id &&
                e.dayOfWeek === day &&
                startMin < e.endMinute &&
                e.startMinute < endMin
            );
            if (isRoomOverlap) continue;

            const isCurrentSlot =
              day === entry.dayOfWeek &&
              startMin === entry.startMinute &&
              r.id === entry.roomId;

            if (isCurrentSlot) continue;

            const seatWaste = r.capacity - entry.offering.expectedStudents;

            candidates.push({
              id: `rec-${day}-${startMin}-${r.id}`,
              dayOfWeek: day,
              dayName: dayOfWeekToName(day),
              startMinute: startMin,
              endMinute: endMin,
              startTime: minuteToTime(startMin),
              endTime: minuteToTime(endMin),
              sessionNumber: session.num,
              sessionLabel: session.label,
              roomId: r.id,
              roomCode: r.code,
              roomName: r.name,
              roomCapacity: r.capacity,
              roomType: r.room_type,
              seatWaste,
              conflictsCount: 0,
              isFeasible: true,
              score: 1000 - seatWaste,
            });
          }
        }
      }

      // Sort candidates by seat efficiency
      candidates.sort((a, b) => a.seatWaste - b.seatWaste);

      if (rpcRecs && rpcRecs.length > 0) {
        setRecommendations(rpcRecs);
      } else {
        setRecommendations(candidates.slice(0, 5));
      }
    } catch (err) {
      console.error('Error generating move recommendations:', err);
      setRecommendations([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Open Drawer for an entry
  const handleOpenDetail = (entry: InitialScheduleEntry) => {
    setSelectedEntry(entry);
    setDrawerTab('RECOMMENDATIONS');
    setAdjustRoomId(entry.roomId);
    setAdjustDay(entry.dayOfWeek);
    setAdjustStartMinute(entry.startMinute);
    setIsAdjusting(false);
    fetchRecommendations(entry);
  };

  // Apply Smart Move Recommendation
  const handleApplyRecommendation = async (rec: any) => {
    if (!selectedEntry || !version?.id) return;
    setApplyingRecommendationId(rec.id);

    try {
      const duration = selectedEntry.offering.effectiveSks * 50;
      const targetRoomId = rec.room_id || rec.roomId;
      const targetDay = Number(rec.day_of_week || rec.dayOfWeek);
      const targetStart = Number(rec.start_minute || rec.startMinute);

      const newEntries = activeEntries.map((e) => {
        if (e.courseOfferingId === selectedEntry.courseOfferingId) {
          const rm = rooms.find((r) => r.id === targetRoomId) || {
            id: targetRoomId,
            code: rec.room_code || rec.roomCode || e.roomCode,
            name: rec.room_name || rec.roomName || e.roomName,
            capacity: rec.room_capacity || rec.roomCapacity || e.roomCapacity,
            room_type: rec.room_type || rec.roomType || e.roomType,
          };
          return {
            ...e,
            roomId: targetRoomId,
            roomCode: rm.code,
            roomName: rm.name,
            roomCapacity: rm.capacity,
            roomType: (rm as any).room_type || e.roomType,
            dayOfWeek: targetDay,
            dayName: dayOfWeekToName(targetDay),
            startMinute: targetStart,
            endMinute: targetStart + duration,
            startTime: minuteToTime(targetStart),
            endTime: minuteToTime(targetStart + duration),
          };
        }
        return e;
      });

      const draftPayload = newEntries.map((e) => ({
        course_offering_id: e.courseOfferingId,
        room_id: e.roomId,
        day_of_week: Number(e.dayOfWeek),
        start_minute: Number(e.startMinute),
      }));

      await scheduleVersionsService.saveDraft(
        version.id,
        version.revision,
        draftPayload,
        `GANTI_JADWAL_CERDAS: ${selectedEntry.offering.courseName} (${selectedEntry.offering.classCode})`
      );

      await scheduleVersionsService.refreshConflicts(version.id);

      toast.success(
        `Jadwal berhasil dipindahkan ke ${dayOfWeekToName(targetDay)}, ${minuteToTime(targetStart)} (${rec.roomCode || 'Ruang'}) Bebas Bentrok.`
      );
      setSelectedEntry(null);
      await handleRefresh();
    } catch (err: any) {
      console.error('Error applying recommendation:', err);
      toast.error(err?.message || 'Gagal menerapkan rekomendasi jadwal.');
    } finally {
      setApplyingRecommendationId(null);
    }
  };

  // Save Manual Adjustment
  const handleSaveAdjustment = async () => {
    if (!selectedEntry || !version?.id) return;
    setAdjustingLoading(true);
    try {
      const duration = selectedEntry.offering.effectiveSks * 50;
      const targetEndMinute = adjustStartMinute + duration;
      const targetStartTime = minuteToTime(adjustStartMinute);
      const targetEndTime = minuteToTime(targetEndMinute);
      const rm = rooms.find((r) => r.id === adjustRoomId);

      const moveRes = await scheduleVersionsService.moveScheduleEntry(
        selectedEntry.id,
        version.id,
        {
          dayOfWeek: adjustDay,
          startMinute: adjustStartMinute,
          endMinute: targetEndMinute,
          startTime: targetStartTime,
          endTime: targetEndTime,
          roomId: adjustRoomId,
          roomName: rm?.name,
          roomCode: rm?.code,
        }
      );

      if (!moveRes.success) {
        throw new Error(moveRes.error || 'Gagal memindahkan jadwal.');
      }

      toast.success(
        `Jadwal ${selectedEntry.offering.courseName} (${selectedEntry.offering.classCode}) berhasil diperbarui manual.`
      );
      setSelectedEntry(null);
      await handleRefresh();

      // Check if resulting adjustment produced hard conflicts
      const postConflicts = await scheduleConflictsService.getConflicts(version.id, {
        isResolved: false,
      });
      if (postConflicts.length > 0) {
        toast.error(
          `${postConflicts.length} konflik ditemukan. Silakan selesaikan konflik sebelum melanjutkan.`
        );
        navigate(`/konflik-jadwal?version=${version.id}`);
      }
    } catch (err: any) {
      console.error('Error saving manual adjustment:', err);
      toast.error(err?.message || 'Gagal menyimpan penyesuaian manual.');
    } finally {
      setAdjustingLoading(false);
    }
  };

  // Swap Schedule between two entries
  const handleExecuteSwap = async () => {
    if (!selectedEntry || !swapTargetEntryId || !version?.id) return;
    const targetEntry = activeEntries.find(
      (e) => e.courseOfferingId === swapTargetEntryId || e.id === swapTargetEntryId
    );
    if (!targetEntry) return;

    setSwappingLoading(true);
    try {
      const newEntries = activeEntries.map((e) => {
        if (e.courseOfferingId === selectedEntry.courseOfferingId) {
          return {
            ...e,
            dayOfWeek: targetEntry.dayOfWeek,
            dayName: targetEntry.dayName,
            startMinute: targetEntry.startMinute,
            endMinute: targetEntry.endMinute,
            startTime: targetEntry.startTime,
            endTime: targetEntry.endTime,
            roomId: targetEntry.roomId,
            roomCode: targetEntry.roomCode,
            roomName: targetEntry.roomName,
            roomCapacity: targetEntry.roomCapacity,
            roomType: targetEntry.roomType,
          };
        }
        if (e.courseOfferingId === targetEntry.courseOfferingId) {
          return {
            ...e,
            dayOfWeek: selectedEntry.dayOfWeek,
            dayName: selectedEntry.dayName,
            startMinute: selectedEntry.startMinute,
            endMinute: selectedEntry.endMinute,
            startTime: selectedEntry.startTime,
            endTime: selectedEntry.endTime,
            roomId: selectedEntry.roomId,
            roomCode: selectedEntry.roomCode,
            roomName: selectedEntry.roomName,
            roomCapacity: selectedEntry.roomCapacity,
            roomType: selectedEntry.roomType,
          };
        }
        return e;
      });

      const draftPayload = newEntries.map((e) => ({
        course_offering_id: e.courseOfferingId,
        room_id: e.roomId,
        day_of_week: Number(e.dayOfWeek),
        start_minute: Number(e.startMinute),
      }));

      await scheduleVersionsService.saveDraft(
        version.id,
        version.revision,
        draftPayload,
        `SWAP: ${selectedEntry.offering.courseName} <-> ${targetEntry.offering.courseName}`
      );

      await scheduleVersionsService.refreshConflicts(version.id);

      toast.success(
        `Jadwal ${selectedEntry.offering.courseName} berhasil ditukar dengan ${targetEntry.offering.courseName}.`
      );
      setShowSwapModal(false);
      setSelectedEntry(null);
      await handleRefresh();

      // Check if resulting swap produced hard conflicts
      const postConflicts = await scheduleConflictsService.getConflicts(version.id, {
        isResolved: false,
      });
      if (postConflicts.length > 0) {
        toast.error(
          `${postConflicts.length} konflik ditemukan. Silakan selesaikan konflik sebelum melanjutkan.`
        );
        navigate(`/konflik-jadwal?version=${version.id}`);
      }
    } catch (err: any) {
      console.error('Error swapping entries:', err);
      toast.error(err?.message || 'Gagal menukar jadwal perkuliahan.');
    } finally {
      setSwappingLoading(false);
    }
  };

  const [fixingCapacity, setFixingCapacity] = useState(false);

  const handleAutoFixCapacity = async () => {
    if (!version?.id) return;
    setFixingCapacity(true);
    try {
      await scheduleVersionsService.ensureRoomCapacityIntegrity(version.id);
      await loadVersionAndConflicts();
      toast.success('Kapasitas ruangan berhasil disinkronkan dengan peserta kelas.');
    } catch (e: any) {
      toast.error('Gagal menyinkronkan kapasitas: ' + (e?.message || 'Error tidak diketahui'));
    } finally {
      setFixingCapacity(false);
    }
  };

  // Publish Version using single atomic RPC publish_schedule_version_named
  const handleConfirmPublish = async () => {
    if (!version?.id || publishing) return;
    setPublishing(true);

    try {
      // 1. PREFLIGHT FETCH: Fetch ONCE authoritative latest version directly from server
      const latestVersion = await scheduleVersionsService.getVersionById(version.id);
      if (!latestVersion) {
        throw new Error('Draft jadwal tidak ditemukan pada server.');
      }
      if (latestVersion.status !== 'DRAFT') {
        throw new Error(`Jadwal ini sudah tidak berstatus draf (status: ${latestVersion.status}).`);
      }

      // 2. Publish using the authoritative latest revision and title in 1 single atomic call
      const targetTitle = publishTitle.trim() || latestVersion.title;
      const res = await scheduleVersionsService.publishScheduleVersion(
        latestVersion.id,
        latestVersion.revision,
        targetTitle
      );

      if (res.version) {
        setVersion(res.version);
        if (onUpdateVersion) onUpdateVersion(res.version);
      }

      setShowPublishModal(false);
      toast.success('Jadwal perkuliahan berhasil diterbitkan secara resmi!');

      // 3. Clear workflow & navigate to Schedule Viewer
      if (onPublishSuccess) {
        onPublishSuccess();
      } else {
        navigate('/jadwal-perkuliahan');
      }
    } catch (err: any) {
      console.error('Publish error:', err);
      const isStale =
        err?.message?.includes('Versi draft telah berubah') ||
        err?.message?.includes('STALE_REVISION') ||
        err?.message?.includes('stale revision');

      if (isStale) {
        toast.error(
          'Draft berubah sejak terakhir dimuat. Data terbaru telah dimuat kembali. Periksa jadwal lalu tekan Terbitkan sekali lagi.'
        );
        // Refetch version ONCE to update UI
        try {
          const fresh = await scheduleVersionsService.getVersionById(version.id);
          if (fresh) {
            setVersion(fresh);
            if (onUpdateVersion) onUpdateVersion(fresh);
          }
        } catch (_) {}
      } else {
        toast.error(err?.message || 'Gagal menerbitkan jadwal resmi.');
      }
    } finally {
      setPublishing(false);
    }
  };

  // Helper for Session calculation
  const getSessionRowStart = (startMinute: number) => {
    const idx = standardSessions.findIndex((s) => s.startMinute === startMinute);
    return idx !== -1 ? idx + 2 : 2; // Row 1 is header
  };

  // Room Utilization statistics
  const roomUtilization = useMemo(() => {
    const dayEntries = activeEntries.filter((e) => e.dayOfWeek === selectedRoomMatrixDay);
    const map = new Map<string, number>();
    dayEntries.forEach((e) => {
      map.set(e.roomId, (map.get(e.roomId) || 0) + (e.sessionCount || 2));
    });

    const activeRoomsCount = rooms.filter((r) => r.is_active !== false).length;
    const totalSessionsCapacity = activeRoomsCount * 12; // 12 standard sessions per day
    const totalUsedSessions = Array.from(map.values()).reduce((a, b) => a + b, 0);
    const overallPercent =
      totalSessionsCapacity > 0 ? Math.round((totalUsedSessions / totalSessionsCapacity) * 100) : 0;

    return {
      usedByRoom: map,
      totalUsedSessions,
      overallPercent,
    };
  }, [activeEntries, rooms, selectedRoomMatrixDay]);

  const isPublished = version?.status === 'PUBLISHED';

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs',
                isPublished
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-blue-50 text-blue-600 border-blue-200'
              )}
            >
              {isPublished ? <CheckCircle2 className="w-6 h-6" /> : <Send className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">Preview & Publikasi Jadwal</h2>

                {/* Status Badge: Distinct Publication Readiness States */}
                {isPublished ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    DITERBITKAN (RESMI)
                  </span>
                ) : publicationStatus === 'CONFLICT' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    TERDAPAT KONFLIK ({conflicts.length} Konflik)
                  </span>
                ) : publicationStatus === 'INCOMPLETE' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    BELUM LENGKAP ({checklist.unscheduledCount} Kelas Belum Terjadwal)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    SIAP DITERBITKAN (Lengkap & Bebas Konflik)
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Tinjau hasil akhir penjadwalan, pastikan kelengkapan kelas dan validitas constraint, lalu terbitkan jadwal
                perkuliahan resmi.
              </p>

              {/* 6 Required Header Indicators */}
              <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-slate-100 text-xs">
                {/* 1. Periode Akademik */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-3xs text-slate-400 uppercase font-semibold">Periode:</span>
                  <span className="font-bold text-slate-900">
                    {activeTerm?.academic_year || '2026/2027'} {activeTerm?.semester_type || selectedSemesterType}
                  </span>
                </div>

                {/* 2. Versi */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-3xs text-slate-400 uppercase font-semibold">Versi:</span>
                  <span className="font-bold text-slate-900">{version?.version_number || '1'}</span>
                </div>

                {/* 3. Revision */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-3xs text-slate-400 uppercase font-semibold">Revision:</span>
                  <span className="font-bold text-slate-900">{version?.revision ?? 1}</span>
                </div>

                {/* 4. Status */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <span className="text-3xs text-slate-400 uppercase font-semibold">Status:</span>
                  <span
                    className={cn(
                      'font-bold px-1.5 py-0.2 rounded text-3xs',
                      isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    )}
                  >
                    {version?.status || 'DRAFT'}
                  </span>
                </div>

                {/* 5. Jumlah Kelas (Terjadwal vs Scope) */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-3xs text-slate-400 uppercase font-semibold">Kelas:</span>
                  <span className="font-bold text-slate-900">
                    {checklist.backendCount} / {checklist.scopeCount} Terjadwal
                  </span>
                </div>

                {/* 6. Jumlah Konflik */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <span className="text-3xs text-slate-400 uppercase font-semibold">Konflik:</span>
                  <span
                    className={cn(
                      'font-bold',
                      conflicts.length === 0 ? 'text-emerald-600' : 'text-rose-600'
                    )}
                  >
                    {conflicts.length} Konflik
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              title="Perbarui Data & Validasi Backend"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/riwayat-jadwal')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Jadwal</span>
            </button>

            {isPublished ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
                <Lock className="w-3.5 h-3.5" />
                Jadwal Read-Only
              </span>
            ) : (
              <button
                type="button"
                disabled={!checklist.isReadyToPublish || publishing}
                onClick={handleOpenPublishModal}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer',
                  checklist.isReadyToPublish && !publishing
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-emerald-500/20'
                    : 'bg-slate-400 opacity-60 cursor-not-allowed'
                )}
                title={checklist.isReadyToPublish ? 'Terbitkan jadwal' : checklist.blockerMessage}
              >
                <Send className="w-4 h-4" />
                <span>{publishing ? 'Menerbitkan...' : 'Konfirmasi & Terbitkan Jadwal Resmi'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Read-only notice if published */}
        {isPublished && (
          <div className="mt-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Jadwal ini telah diterbitkan dan bersifat read-only.</strong> Seluruh civitas akademika dapat
                mengakses jadwal perkuliahan resmi ini. Untuk melakukan perubahan, buat revisi draf baru melalui menu
                Riwayat Versi.
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/jadwal-perkuliahan')}
              className="inline-flex items-center gap-1 text-3xs font-bold text-emerald-700 hover:text-emerald-900 shrink-0 underline"
            >
              <span>Buka Viewer Publik</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Unscheduled Classes Card Alert */}
      {!isPublished && checklist.unscheduledCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold">{checklist.unscheduledCount} Kelas Belum Terjadwal</h4>
                <span className="px-2 py-0.5 rounded text-3xs font-bold bg-amber-200/80 text-amber-900 uppercase">
                  Belum Lengkap
                </span>
              </div>
              <p className="text-3xs text-amber-700 mt-0.5">
                Terdapat {checklist.unscheduledCount} dari {checklist.scopeCount} kelas dalam scope aktif yang belum memiliki alokasi waktu dan ruangan. Lengkapi seluruh kelas sebelum mempublikasikan jadwal resmi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowUnscheduledModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <List className="w-4 h-4" />
            <span>Lihat Kelas ({checklist.unscheduledCount})</span>
          </button>
        </div>
      )}

      {/* Unsaved Draft Alert Banner */}
      {!isPublished && backendEntries.length === 0 && entries.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold">Hasil Optimasi Belum Disimpan ke Draf Database</h4>
              <p className="text-3xs text-amber-700 mt-0.5">
                Hasil optimasi ({entries.length} kelas) telah dihitung di memori, tetapi draf database belum menyimpan entri jadwal tersebut.
                Klik tombol di samping untuk menyimpan ke draf database agar dapat diterbitkan secara resmi.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={savingToDraft}
            onClick={handleQuickSaveDraft}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Save className={cn('w-4 h-4', savingToDraft && 'animate-spin')} />
            <span>{savingToDraft ? 'Menyimpan ke Draft...' : 'Simpan ke Draft Sekarang'}</span>
          </button>
        </div>
      )}

      {/* 2. Before / After Optimization Summary & Two-Section Publication Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Before / After SA Optimization Summary */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Hasil Optimasi (Step 5)
            </h3>
            <span className="text-3xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              Hasil Terbaik
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
              <p className="text-3xs font-semibold text-slate-400 uppercase tracking-wider">Sebelum Optimasi</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-bold text-rose-600">
                  {optimizationMeta ? optimizationMeta.initialConflicts : conflicts.length}
                </span>
                <span className="text-3xs text-slate-500">konflik</span>
              </div>
              <p className="text-3xs text-slate-400 mt-1">
                Cost: {optimizationMeta ? Math.round(optimizationMeta.initialCost).toLocaleString() : '—'}
              </p>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-xl p-3">
              <p className="text-3xs font-semibold text-emerald-800 uppercase tracking-wider">Sesudah Optimasi</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-bold text-emerald-600">
                  {optimizationMeta ? optimizationMeta.bestConflicts : conflicts.length}
                </span>
                <span className="text-3xs text-emerald-700">konflik</span>
              </div>
              <p className="text-3xs text-emerald-700 font-semibold mt-1">
                Cost: {optimizationMeta ? Math.round(optimizationMeta.bestCost).toLocaleString() : '—'}
              </p>
            </div>
          </div>

          <div className="pt-1 text-3xs text-slate-500 space-y-1">
            <div className="flex items-center justify-between">
              <span>Waktu Eksekusi Worker:</span>
              <span className="font-mono font-bold text-slate-700">
                {optimizationMeta ? `${optimizationMeta.executionTimeMs} ms` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Random Seed (Reproducible):</span>
              <span className="font-mono font-bold text-slate-700">
                {optimizationMeta ? optimizationMeta.seed : '42'}
              </span>
            </div>
          </div>
        </div>

        {/* Two-Section Publication Checklist (A. KELENGKAPAN & B. VALIDASI KONFLIK) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              Checklist Kelaikan Publikasi
            </h3>
            <span
              className={cn(
                'text-3xs font-bold px-2.5 py-0.5 rounded-full uppercase',
                checklist.isReadyToPublish
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : checklist.unscheduledCount > 0
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
              )}
            >
              {checklist.isReadyToPublish
                ? 'Siap Diterbitkan'
                : checklist.unscheduledCount > 0
                ? 'Belum Lengkap'
                : 'Terdapat Konflik'}
            </span>
          </div>

          {/* Specific Blocker Alert if not ready */}
          {!checklist.isReadyToPublish && checklist.blockerMessage && (
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Status: </span>
                <span>{checklist.blockerMessage}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SECTION A: KELENGKAPAN JADWAL */}
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50/50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5 text-blue-600" />
                  A. Kelengkapan Jadwal
                </h4>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-3xs font-bold uppercase',
                    checklist.unscheduledCount === 0 && checklist.isComplete
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  )}
                >
                  {checklist.unscheduledCount === 0 && checklist.isComplete ? 'Lengkap' : 'Belum Lengkap'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Kelas dalam Scope:</span>
                  <span className="font-bold text-slate-900">{checklist.scopeCount}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Sudah Terjadwal:</span>
                  <span className="font-bold text-emerald-700">{checklist.scheduledCount}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Belum Terjadwal:</span>
                  <span
                    className={cn(
                      'font-bold',
                      checklist.unscheduledCount === 0 ? 'text-emerald-700' : 'text-amber-700'
                    )}
                  >
                    {checklist.unscheduledCount}
                  </span>
                </div>
              </div>

              {checklist.unscheduledCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUnscheduledModal(true)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-3xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Lihat {checklist.unscheduledCount} Kelas Belum Terjadwal
                </button>
              )}
            </div>

            {/* SECTION B: VALIDASI KONFLIK */}
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50/50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  B. Validasi Konflik
                </h4>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-3xs font-bold uppercase',
                    conflicts.length === 0 && checklist.capacityViolations === 0 && checklist.roomTypeViolations === 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  )}
                >
                  {conflicts.length === 0 && checklist.capacityViolations === 0 && checklist.roomTypeViolations === 0
                    ? 'Bebas Konflik'
                    : 'Terdapat Konflik'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Bentrok Ruangan:</span>
                  <span className={cn('font-bold', checklist.roomConflicts === 0 ? 'text-emerald-700' : 'text-rose-600')}>
                    {checklist.roomConflicts}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Bentrok Dosen:</span>
                  <span className={cn('font-bold', checklist.lecturerConflicts === 0 ? 'text-emerald-700' : 'text-rose-600')}>
                    {checklist.lecturerConflicts}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Bentrok Rombel:</span>
                  <span className={cn('font-bold', checklist.classConflicts === 0 ? 'text-emerald-700' : 'text-rose-600')}>
                    {checklist.classConflicts}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Pelanggaran Kapasitas:</span>
                  <span className={cn('font-bold', checklist.capacityViolations === 0 ? 'text-emerald-700' : 'text-rose-600')}>
                    {checklist.capacityViolations}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Slot Invalid / Dosen Tak Tersedia:</span>
                  <span className={cn('font-bold', checklist.slotInvalidConflicts === 0 ? 'text-emerald-700' : 'text-rose-600')}>
                    {checklist.slotInvalidConflicts}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Toolbar: View Tabs & Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* 3 View Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('MATRIKS_HARI')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                viewMode === 'MATRIKS_HARI'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Matriks Hari</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('MATRIKS_RUANGAN')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                viewMode === 'MATRIKS_RUANGAN'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>Matriks Ruangan</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('TABEL_DAFTAR')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                viewMode === 'TABEL_DAFTAR'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabel Daftar</span>
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari MK, Dosen, atau Ruang..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Semester Filter */}
            <select
              value={selectedSemesterFilter}
              onChange={(e) =>
                setSelectedSemesterFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
              }
              className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="ALL">Semua Semester</option>
              {availableSemesters.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>

            {/* Class Filter */}
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="ALL">Semua Kelas</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </select>

            {/* Room Filter */}
            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="ALL">Semua Ruang</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
            </select>

            {/* Lecturer Filter */}
            <select
              value={selectedLecturerFilter}
              onChange={(e) => setSelectedLecturerFilter(e.target.value)}
              className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg max-w-[180px]"
            >
              <option value="ALL">Semua Dosen</option>
              {uniqueLecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Room Matrix Day Selector */}
        {viewMode === 'MATRIKS_RUANGAN' && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1.5">
              <span className="text-3xs font-bold text-slate-500 uppercase mr-2">Pilih Hari:</span>
              {daysList.map((d) => (
                <button
                  key={d.num}
                  type="button"
                  onClick={() => setSelectedRoomMatrixDay(d.num)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    selectedRoomMatrixDay === d.num
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {d.name}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              Utilisasi Hari Ini:{' '}
              <strong className="text-slate-900">
                {roomUtilization.totalUsedSessions} Sesi ({roomUtilization.overallPercent}%)
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* 4. Main Timetable Views */}
      {viewMode === 'MATRIKS_HARI' ? (
        /* ========================================================================= */
        /* MODE 1: MATRIKS HARI (Apple Weekly Translucent Glass Calendar)            */
        /* ========================================================================= */
        <div className="space-y-4">
          <AppleWeeklyCalendar
            title="Pratinjau Jadwal Kuliah"
            subtitle="Tinjau draf jadwal perkuliahan sebelum dipublikasikan secara resmi ke seluruh civitas akademika."
            entries={calendarEntries}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onSelectEntry={(card) => {
              if (card.raw) {
                handleOpenDetail(card.raw);
              }
            }}
            onResetThisWeek={() => setSelectedDate(new Date())}
          />
        </div>
      ) : viewMode === 'MATRIKS_RUANGAN' ? (
        /* ========================================================================= */
        /* MODE 2: MATRIKS RUANGAN (Columns: Rooms, Rows: Sessions for selected day) */
        /* ========================================================================= */
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto min-w-full">
            <div
              className="grid min-w-[1100px]"
              style={{
                gridTemplateColumns: `120px repeat(${rooms.length}, minmax(150px, 1fr))`,
                gridTemplateRows: '60px repeat(12, minmax(80px, auto))',
              }}
            >
              {/* Header: Sesi label */}
              <div className="sticky top-0 z-10 bg-slate-900 text-slate-200 text-3xs font-bold uppercase tracking-wider p-3 flex items-center justify-center border-b border-r border-slate-800">
                SESI / RUANG
              </div>

              {/* Header: Room Columns */}
              {rooms.map((room, rIdx) => {
                const used = roomUtilization.usedByRoom.get(room.id) || 0;
                return (
                  <div
                    key={room.id}
                    className="sticky top-0 z-10 bg-slate-900 text-white p-2.5 flex flex-col justify-center border-b border-r border-slate-800"
                    style={{ gridColumn: rIdx + 2, gridRow: 1 }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{room.code}</span>
                      <span className="text-3xs px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                        {room.capacity} krs
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-3xs text-slate-400 mt-0.5">
                      <span className="truncate">{room.room_type}</span>
                      <span className="text-emerald-400 font-semibold">{used} sesi</span>
                    </div>
                  </div>
                );
              })}

              {/* Rows: Standard Sessions */}
              {standardSessions.map((session, sIdx) => (
                <div
                  key={session.num}
                  className="bg-slate-50/90 text-slate-600 p-2.5 flex flex-col justify-center items-center text-center border-b border-r border-slate-200"
                  style={{ gridColumn: 1, gridRow: sIdx + 2 }}
                >
                  <span className="text-3xs font-extrabold uppercase text-slate-700">SESI {session.num}</span>
                  <span className="text-3xs font-mono font-semibold text-slate-500 mt-0.5">
                    {session.label}
                  </span>
                </div>
              ))}

              {/* Empty background lines */}
              {standardSessions.map((_, sIdx) =>
                rooms.map((_, rIdx) => (
                  <div
                    key={`rm-bg-${sIdx}-${rIdx}`}
                    className="border-b border-r border-slate-100 bg-white"
                    style={{ gridColumn: rIdx + 2, gridRow: sIdx + 2 }}
                  />
                ))
              )}

              {/* Entries for selected day placed in room columns with vertical duration span */}
              {filteredEntries
                .filter((e) => e.dayOfWeek === selectedRoomMatrixDay)
                .map((entry) => {
                  const rIdx = rooms.findIndex((r) => r.id === entry.roomId);
                  if (rIdx === -1) return null;

                  const startRow = getSessionRowStart(entry.startMinute);
                  const span = Math.max(1, entry.sessionCount || entry.offering.effectiveSks || 2);
                  const hasConflict = conflictedOfferingIds.has(entry.courseOfferingId);

                  return (
                    <div
                      key={entry.courseOfferingId}
                      onClick={() => handleOpenDetail(entry)}
                      className={cn(
                        'm-1 p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer shadow-xs hover:shadow-md hover:scale-[1.01] z-2',
                        hasConflict
                          ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400 text-rose-900'
                          : getSemesterColorClass(entry.offering.semester)
                      )}
                      style={{
                        gridColumn: rIdx + 2,
                        gridRow: `${startRow} / span ${span}`,
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate">{entry.offering.courseName}</span>
                          <span className="text-3xs font-bold text-blue-600 bg-white px-1 py-0.2 rounded border border-blue-200">
                            {entry.offering.classCode}
                          </span>
                        </div>
                        <p className="text-3xs text-slate-600 truncate mt-0.5">
                          {entry.offering.primaryLecturerName}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-3xs font-mono text-slate-500 pt-1 border-t border-slate-200/50 mt-1">
                        <span>
                          {entry.startTime}–{entry.endTime}
                        </span>
                        <span>{entry.offering.expectedStudents} mhs</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 3: TABEL DAFTAR (Full Sortable Table) */
        /* ========================================================================= */
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-white text-3xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Hari</th>
                  <th className="py-3.5 px-4">Waktu</th>
                  <th className="py-3.5 px-4">Kode MK</th>
                  <th className="py-3.5 px-4">Mata Kuliah</th>
                  <th className="py-3.5 px-4 text-center">Kelas</th>
                  <th className="py-3.5 px-4 text-center">Sem</th>
                  <th className="py-3.5 px-4 text-center">SKS</th>
                  <th className="py-3.5 px-4">Dosen Pengampu Utama</th>
                  <th className="py-3.5 px-4">Ruangan</th>
                  <th className="py-3.5 px-4 text-center">Peserta</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-slate-400">
                      Tidak ada kelas yang memenuhi kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => {
                    const hasConflict = conflictedOfferingIds.has(entry.courseOfferingId);
                    return (
                      <tr
                        key={entry.courseOfferingId}
                        className={cn(
                          'hover:bg-slate-50/80 transition-colors',
                          hasConflict && 'bg-rose-50/40'
                        )}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900">{entry.dayName}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {entry.startTime} – {entry.endTime}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">{entry.offering.courseCode}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{entry.offering.courseName}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-3xs font-extrabold bg-blue-100 text-blue-800">
                            {entry.offering.classCode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">{entry.offering.semester}</td>
                        <td className="py-3 px-4 text-center font-semibold">{entry.offering.effectiveSks}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {entry.offering.primaryLecturerName}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {entry.roomCode}
                          <span className="text-3xs text-slate-400 ml-1 font-normal">
                            ({entry.roomCapacity} krs)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {entry.offering.expectedStudents}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {hasConflict ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              Bentrok
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Feasible
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(entry)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-3xs font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Sticky Bottom Action Bar */}
      <div className="sticky bottom-4 z-20">
        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left: Summary Info */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border',
                  isPublished
                    ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500/30'
                    : 'bg-blue-600/30 text-blue-400 border-blue-500/30'
                )}
              >
                {isPublished ? <CheckCircle2 className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  {isPublished
                    ? 'Jadwal Perkuliahan Resmi Telah Diterbitkan'
                    : `Jadwal Siap Diterbitkan: ${entries.length} Kelas`}
                </p>
                <p className="text-3xs text-slate-400">
                  {isPublished
                    ? 'Seluruh kelas bersifat read-only dan dapat diakses pada viewer publik.'
                    : conflicts.length === 0
                    ? '0 Bentrok Keras. Silakan tinjau dan klik Terbitkan Jadwal Resmi.'
                    : `${conflicts.length} konflik tersisa. Sesuaikan jadwal atau jalankan optimasi ulang.`}
                </p>
              </div>
            </div>

            {/* Right: Navigation Controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onBackToStep5}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Optimasi SA</span>
              </button>

              {!isPublished && (
                <button
                  type="button"
                  disabled={!checklist.isReadyToPublish || publishing}
                  onClick={handleOpenPublishModal}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer',
                    checklist.isReadyToPublish && !publishing
                      ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-emerald-500/20'
                      : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-70'
                  )}
                >
                  <Send className="w-4 h-4" />
                  <span>{publishing ? 'Menerbitkan...' : 'Konfirmasi & Terbitkan Jadwal Resmi'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Confirmation Modal: Publish Schedule Version */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <Send className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900">Terbitkan Jadwal Perkuliahan Resmi?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Setelah diterbitkan:
              </p>
              <ul className="text-xs text-slate-600 text-left space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-emerald-600">•</span>
                  <span>Jadwal menjadi <strong>read-only</strong> dan resmi berlaku untuk seluruh civitas akademika.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-emerald-600">•</span>
                  <span>Dosen dan mahasiswa dapat langsung melihat jadwal ini di akun masing-masing.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-emerald-600">•</span>
                  <span>Perubahan di masa mendatang harus melalui draf revisi baru.</span>
                </li>
              </ul>
            </div>

            {/* Input Nama Jadwal Resmi */}
            <div className="text-left space-y-1 pt-1">
              <label className="text-3xs font-bold text-slate-700 uppercase tracking-wider">
                Nama Jadwal Resmi
              </label>
              <input
                type="text"
                disabled={publishing}
                value={publishTitle}
                onChange={(e) => setPublishTitle(e.target.value)}
                placeholder="Contoh: Jadwal Perkuliahan TA 2026/2027 Ganjil"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={publishing}
                onClick={() => setShowPublishModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={handleConfirmPublish}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {publishing ? 'Menerbitkan...' : 'Terbitkan Jadwal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Drawer: Detail Jadwal & Final Adjustment (Admin only) */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-3xs font-extrabold uppercase text-blue-600 tracking-wider">
                    Detail Jadwal Perkuliahan
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedEntry.offering.courseName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Information Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-3xs font-semibold text-slate-400 uppercase">Kode MK</span>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">
                    {selectedEntry.offering.courseCode}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-3xs font-semibold text-slate-400 uppercase">Kelas & Semester</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    Kelas {selectedEntry.offering.classCode} • Sem {selectedEntry.offering.semester}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-3xs font-semibold text-slate-400 uppercase">Bobot SKS</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {selectedEntry.offering.effectiveSks} SKS ({selectedEntry.offering.effectiveSks * 50} Menit)
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-3xs font-semibold text-slate-400 uppercase">Peserta Terdaftar</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {selectedEntry.offering.expectedStudents} Mahasiswa
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-3xs font-semibold text-slate-400 uppercase">Dosen Pengampu Utama</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {selectedEntry.offering.primaryLecturerName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                  <div>
                    <span className="text-3xs font-semibold text-slate-400 uppercase">Hari & Waktu</span>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {selectedEntry.dayName}, {selectedEntry.startTime} – {selectedEntry.endTime}
                    </p>
                  </div>
                  <div>
                    <span className="text-3xs font-semibold text-slate-400 uppercase">Ruangan</span>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {selectedEntry.roomCode} ({selectedEntry.roomCapacity} Kursi)
                    </p>
                  </div>
                </div>
              </div>

              {/* Final Adjustment Section (Only available if status is DRAFT) */}
              {!isPublished && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  {/* Action Mode Tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setDrawerTab('RECOMMENDATIONS')}
                      className={cn(
                        'flex-1 py-1.5 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                        drawerTab === 'RECOMMENDATIONS'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Rekomendasi Cerdas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDrawerTab('MANUAL')}
                      className={cn(
                        'flex-1 py-1.5 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                        drawerTab === 'MANUAL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>Manual</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSwapModal(true)}
                      className="py-1.5 px-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Tukar</span>
                    </button>
                  </div>

                  {/* TAB 1: Smart Move Recommendations */}
                  {drawerTab === 'RECOMMENDATIONS' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Rekomendasi Pindah Jadwal Bebas Bentrok
                          </h4>
                          <p className="text-3xs text-slate-500 mt-0.5">
                            Sistem mendeteksi slot sesi dan ruangan terbaik yang bebas bentrok dan efisien kapasitas.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={loadingRecommendations}
                          onClick={() => fetchRecommendations(selectedEntry)}
                          className="text-3xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <RefreshCw className={cn('w-3 h-3', loadingRecommendations && 'animate-spin')} />
                          <span>Cari Ulang</span>
                        </button>
                      </div>

                      {loadingRecommendations ? (
                        <div className="space-y-2.5 animate-pulse">
                          <div className="h-16 bg-slate-100 rounded-xl" />
                          <div className="h-16 bg-slate-100 rounded-xl" />
                          <div className="h-16 bg-slate-100 rounded-xl" />
                        </div>
                      ) : recommendations.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                          <Info className="w-5 h-5 text-slate-400 mx-auto" />
                          <p className="text-xs font-semibold text-slate-700">
                            Tidak ditemukan rekomendasi alternatif bebas bentrok
                          </p>
                          <p className="text-3xs text-slate-400">
                            Slot saat ini mungkin merupakan opsi terbaik atau Anda dapat menggunakan penyesuaian manual.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                          {recommendations.map((rec: any, idx: number) => {
                            const isApplying = applyingRecommendationId === rec.id;
                            const dayName = rec.dayName || dayOfWeekToName(rec.day_of_week || rec.dayOfWeek);
                            const startTime = rec.startTime || minuteToTime(rec.start_minute || rec.startMinute);
                            const endTime = rec.endTime || minuteToTime(rec.end_minute || rec.endMinute);
                            const roomCode = rec.roomCode || rec.room_code || 'Ruang';
                            const roomName = rec.roomName || rec.room_name || 'Ruang Kuliah';
                            const roomCapacity = rec.roomCapacity || rec.room_capacity || 40;
                            const seatWaste = rec.seatWaste ?? (roomCapacity - selectedEntry.offering.expectedStudents);

                            return (
                              <div
                                key={rec.id || idx}
                                className={cn(
                                  'p-3 rounded-xl border transition-all',
                                  idx === 0
                                    ? 'bg-blue-50/70 border-blue-200 ring-1 ring-blue-500/20'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        className={cn(
                                          'text-3xs font-extrabold px-1.5 py-0.5 rounded',
                                          idx === 0
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-200 text-slate-700'
                                        )}
                                      >
                                        #{idx + 1} {idx === 0 ? 'Paling Optimal' : 'Alternatif'}
                                      </span>
                                      <span className="text-3xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                        ✓ Bebas Bentrok
                                      </span>
                                      <span className="text-3xs text-slate-500">
                                        Sisa {seatWaste} kursi
                                      </span>
                                    </div>

                                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mt-1">
                                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                      <span>
                                        {dayName}, {startTime} – {endTime}
                                      </span>
                                    </div>

                                    <div className="text-3xs text-slate-600 flex items-center gap-1.5">
                                      <DoorOpen className="w-3 h-3 text-slate-400" />
                                      <span>
                                        {roomCode} • {roomName} ({roomCapacity} Kursi)
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={applyingRecommendationId !== null}
                                    onClick={() => handleApplyRecommendation(rec)}
                                    className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50"
                                  >
                                    {isApplying ? 'Menerapkan...' : 'Pilih Jadwal Ini'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Manual Adjustment */}
                  {drawerTab === 'MANUAL' && (
                    <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-3 text-xs">
                      <div>
                        <label className="block text-3xs font-semibold text-slate-600 mb-1">Pilih Hari</label>
                        <select
                          value={adjustDay}
                          onChange={(e) => setAdjustDay(Number(e.target.value))}
                          className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                        >
                          {daysList.map((d) => (
                            <option key={d.num} value={d.num}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-3xs font-semibold text-slate-600 mb-1">Slot Sesi Mulai</label>
                        <select
                          value={adjustStartMinute}
                          onChange={(e) => setAdjustStartMinute(Number(e.target.value))}
                          className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                        >
                          {standardSessions.slice(0, 13 - (selectedEntry.offering.effectiveSks || 2)).map((s) => (
                            <option key={s.num} value={s.startMinute}>
                              Sesi {s.num}: {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-3xs font-semibold text-slate-600 mb-1">Pilih Ruangan</label>
                        <select
                          value={adjustRoomId}
                          onChange={(e) => setAdjustRoomId(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                        >
                          {rooms
                            .filter((r) => r.is_active !== false)
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.code} ({r.capacity} Kursi - {r.room_type})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          disabled={adjustingLoading}
                          onClick={handleSaveAdjustment}
                          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {adjustingLoading ? 'Menyimpan...' : 'Terapkan Penyesuaian Manual'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Swap Modal */}
      {showSwapModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              Tukar Jadwal dengan Kelas Lain
            </h3>
            <p className="text-xs text-slate-500">
              Pilih kelas lain dengan bobot SKS yang sama untuk saling bertukar hari, jam, dan ruangan.
            </p>

            <div>
              <label className="block text-3xs font-semibold text-slate-600 mb-1">Pilih Kelas Mitra Tukar</label>
              <select
                value={swapTargetEntryId}
                onChange={(e) => setSwapTargetEntryId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="">-- Pilih Kelas Lain --</option>
                {activeEntries
                  .filter(
                    (e) =>
                      e.courseOfferingId !== selectedEntry.courseOfferingId &&
                      e.offering.effectiveSks === selectedEntry.offering.effectiveSks
                  )
                  .map((e) => (
                    <option key={e.courseOfferingId} value={e.courseOfferingId}>
                      {e.offering.courseName} ({e.offering.classCode}) — {e.dayName}, {e.startTime} ({e.roomCode})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSwapModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!swapTargetEntryId || swappingLoading}
                onClick={handleExecuteSwap}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
              >
                {swappingLoading ? 'Menukar...' : 'Konfirmasi Tukar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal Daftar Kelas Belum Terjadwal */}
      {showUnscheduledModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Daftar Kelas Belum Terjadwal ({checklist.unscheduledCount} Kelas)
                  </h3>
                  <p className="text-2xs text-slate-500">
                    Mata kuliah aktif berikut belum memperoleh alokasi slot waktu dan ruangan pada jadwal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnscheduledModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-2xs sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Kode</th>
                    <th className="py-2.5 px-3">Mata Kuliah</th>
                    <th className="py-2.5 px-2 text-center">Kelas</th>
                    <th className="py-2.5 px-2 text-center">Sem / SKS</th>
                    <th className="py-2.5 px-2 text-center">Peserta</th>
                    <th className="py-2.5 px-3">Dosen Pengampu</th>
                    <th className="py-2.5 px-3">Alasan Belum Terjadwal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unscheduledOfferings.length > 0 ? (
                    unscheduledOfferings.map((off, idx) => (
                      <tr key={off.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 font-mono text-2xs text-slate-500">{off.courseCode}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{off.courseName}</td>
                        <td className="py-2 px-2 text-center font-bold text-blue-600">{off.classCode}</td>
                        <td className="py-2 px-2 text-center text-slate-600">
                          S{off.semester} • {off.effectiveSks} SKS
                        </td>
                        <td className="py-2 px-2 text-center font-semibold text-slate-700">{off.expectedStudents}</td>
                        <td className="py-2 px-3 text-slate-600">{off.primaryLecturerName || '—'}</td>
                        <td className="py-2 px-3 text-amber-700 text-2xs font-medium">{off.reason}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {checklist.unscheduledCount} kelas aktif belum memiliki alokasi jadwal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowUnscheduledModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Tutup
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnscheduledModal(false);
                    handleRefresh();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Coba Susun Ulang
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnscheduledModal(false);
                    if (onBackToStep4) onBackToStep4();
                    else onBackToStep5();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Kembali ke Penyusunan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
