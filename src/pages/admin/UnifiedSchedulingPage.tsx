import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { curriculumPackagesService, getDefaultCurriculumPackages } from '../../services/curriculumPackages.service';
import { schedulingRombelService } from '../../services/schedulingRombel.service';
import {
  schedulingLecturersService,
  Step3DataResult,
} from '../../services/schedulingLecturers.service';
import {
  CurriculumPackage,
  CurriculumPackageCourse,
  PlannedCourse,
  AcademicTerm,
  CourseRombelGroup,
  RombelOfferingDraft,
  Room,
  TimeSlot,
  LecturerAvailability,
  ScheduleVersion,
} from '../../types';
import { scheduleVersionsService } from '../../services/scheduleVersions.service';
import { scheduleConflictsService } from '../../services/scheduleConflicts.service';
import { supabase } from '../../lib/supabase';
import { SchedulingStepper } from '../../components/schedule/workflow/SchedulingStepper';
import { SchedulingActiveHeader } from '../../components/schedule/workflow/SchedulingActiveHeader';
import { SchedulingEmptyState } from '../../components/schedule/workflow/SchedulingEmptyState';
import { SchedulingTemplateView } from '../../components/schedule/workflow/SchedulingTemplateView';
import { SchedulingStickyBar } from '../../components/schedule/workflow/SchedulingStickyBar';
import { SchedulingRombelView } from '../../components/schedule/workflow/SchedulingRombelView';
import { SchedulingLecturersView } from '../../components/schedule/workflow/SchedulingLecturersView';
import { SchedulingInitialScheduleView } from '../../components/schedule/workflow/SchedulingInitialScheduleView';
import { SchedulingSimulatedAnnealingView } from '../../components/schedule/workflow/SchedulingSimulatedAnnealingView';
import { SchedulingPreviewPublishView } from '../../components/schedule/workflow/SchedulingPreviewPublishView';
import { VersionHistoryDrawer } from '../../components/schedule/versioning/VersionHistoryDrawer';
import { VersionComparisonModal } from '../../components/schedule/versioning/VersionComparisonModal';
import {
  ScheduleActionConfirmDialog,
  ScheduleActionDialogState,
} from '../../components/schedule/versioning/ScheduleActionConfirmDialog';
import {
  schedulingInitialService,
  InitialScheduleEntry,
  InitialScheduleConflict,
  InitialScheduleStats,
  InitialScheduleOffering,
} from '../../services/schedulingInitial.service';
import { schedulingOptimizationService } from '../../services/schedulingOptimization.service';
import {
  distributeParticipantsWithRoomCapacity,
  calculateTargetRoomCapacity,
  isPracticum,
  isKKN,
} from '../../lib/distributionUtils';
import { toast } from '../../components/ui/Toast';

export const UnifiedSchedulingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 1. Data loading states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<CurriculumPackage[]>([]);
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map());
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(null);

  // 2. Workflow & Step State
  const [activeStep, setActiveStep] = useState<number>(1);
  const [scheduleCreationMode, setScheduleCreationMode] = useState<'TEMPLATE' | 'MANUAL' | null>(null);

  // 3. Step 1 Filter & Selection State
  const [selectedSemesterType, setSelectedSemesterType] = useState<'GANJIL' | 'GENAP'>('GANJIL');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<number | 'ALL'>('ALL');
  const [activeCurricula, setActiveCurricula] = useState<number[]>([2026, 2022]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 4. Step 1 Selections & Participant Map
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourse[]>([]);
  const [participantInputMap, setParticipantInputMap] = useState<Record<string, number>>({});

  // 5. Step 2 Rombel State
  const [rombelGroups, setRombelGroups] = useState<CourseRombelGroup[]>([]);
  const [loadingRombel, setLoadingRombel] = useState<boolean>(false);
  const [savingRombel, setSavingRombel] = useState<boolean>(false);
  const [hasUnsavedRombelChanges, setHasUnsavedRombelChanges] = useState<boolean>(false);

  // 6. Step 3 Lecturers State
  const [step3Data, setStep3Data] = useState<Step3DataResult | null>(null);
  const [loadingStep3, setLoadingStep3] = useState<boolean>(false);
  const [syncingStep3, setSyncingStep3] = useState<boolean>(false);

  // 7. Step 4 Initial Schedule State
  const [loadingStep4, setLoadingStep4] = useState<boolean>(false);
  const [generatingStep4, setGeneratingStep4] = useState<boolean>(false);
  const [savingStep4, setSavingStep4] = useState<boolean>(false);
  const [hasAttemptedRombelRestore, setHasAttemptedRombelRestore] = useState<boolean>(false);
  const [hasAttemptedStep4Load, setHasAttemptedStep4Load] = useState<boolean>(false);
  const [step4Entries, setStep4Entries] = useState<InitialScheduleEntry[]>([]);
  const [step4Conflicts, setStep4Conflicts] = useState<InitialScheduleConflict[]>([]);
  const [step4Stats, setStep4Stats] = useState<InitialScheduleStats>({
    totalOfferings: 0,
    scheduledCount: 0,
    unscheduledCount: 0,
    roomsUsedCount: 0,
    totalSks: 0,
    totalConflicts: 0,
    roomConflictCount: 0,
    lecturerConflictCount: 0,
    capacityViolationCount: 0,
    availabilityConflictCount: 0,
    averageSeatWaste: 0,
  });
  const [step4Rooms, setStep4Rooms] = useState<Room[]>([]);
  const [step4Offerings, setStep4Offerings] = useState<InitialScheduleOffering[]>([]);
  const [step4TimeSlots, setStep4TimeSlots] = useState<TimeSlot[]>([]);
  const [step4Availabilities, setStep4Availabilities] = useState<LecturerAvailability[]>([]);

  // 8. Single Unified DRAFT Schedule Version (Workflow Step 2 -> 4 -> 5 -> 6 source of truth)
  const [currentVersion, setCurrentVersion] = useState<ScheduleVersion | null>(null);

  // 9. Step 5 Simulated Annealing State
  const [savingStep5, setSavingStep5] = useState<boolean>(false);
  const [optimizationMeta, setOptimizationMeta] = useState<any>(null);

  // 10. Version History & Published Schedule Awareness State
  const [latestPublishedVersion, setLatestPublishedVersion] = useState<ScheduleVersion | null>(null);
  const [publishedEntriesCount, setPublishedEntriesCount] = useState<number>(0);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [allVersionsList, setAllVersionsList] = useState<ScheduleVersion[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState<boolean>(false);
  const [compareVersionAId, setCompareVersionAId] = useState<string>('');
  const [compareVersionBId, setCompareVersionBId] = useState<string>('');

  // 11. Modal Action Confirmation State (Kosongkan & Hapus Draft)
  const [actionDialog, setActionDialog] = useState<ScheduleActionDialogState>({
    type: null,
    version: null,
  });
  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  const [searchParams] = useSearchParams();
  const urlVersionId = searchParams.get('version') || searchParams.get('versionId') || searchParams.get('draftId');

  // Scoped localStorage storage keys
  const step1StorageKey = useMemo(() => {
    const userId = user?.id || 'anonymous';
    const termId = activeTerm?.id || 'active';
    return `spk:scheduling-step1:${userId}:${termId}`;
  }, [user?.id, activeTerm?.id]);

  const step2StorageKey = useMemo(() => {
    const userId = user?.id || 'anonymous';
    const termId = activeTerm?.id || 'active';
    return `spk:scheduling-step2:${userId}:${termId}`;
  }, [user?.id, activeTerm?.id]);

  const step4StorageKey = useMemo(() => {
    const userId = user?.id || 'anonymous';
    const termId = activeTerm?.id || 'active';
    return `spk:scheduling-step4:${userId}:${termId}`;
  }, [user?.id, activeTerm?.id]);

  const activeVersionStorageKey = useMemo(() => {
    const userId = user?.id || 'anonymous';
    const termId = activeTerm?.id || 'active';
    return `spk:active-schedule-version:LECTURE:${userId}:${termId}`;
  }, [user?.id, activeTerm?.id]);

  // Helper: Validates if a draft is an active meaningful workflow (NOT empty/stale artifact)
  const isValidActiveDraft = useCallback((v: ScheduleVersion | null | undefined): boolean => {
    if (!v || v.status !== 'DRAFT') return false;
    // CRITICAL: Reject non-LECTURE drafts immediately
    if (!scheduleVersionsService.isLectureVersion(v)) return false;
    const hasScope = Array.isArray(v.scope_offering_ids) && v.scope_offering_ids.length > 0;
    const hasEntries =
      ((v as any).entry_count && (v as any).entry_count > 0) ||
      (Array.isArray((v as any).schedule_entries) && (v as any).schedule_entries.length > 0);
    const hasWorkflowState =
      v.workflow_state &&
      typeof v.workflow_state === 'object' &&
      Object.keys(v.workflow_state).length > 0 &&
      Array.isArray((v.workflow_state as any).plannedCourses) &&
      (v.workflow_state as any).plannedCourses.length > 0;
    return hasScope || hasEntries || Boolean(hasWorkflowState);
  }, []);

  // Helper: Guarantees a single DRAFT version across Step 1-6 and browser refreshes
  const ensureCurrentDraftVersion = useCallback(async (): Promise<ScheduleVersion> => {
    const termId = activeTerm?.id;
    if (!termId) throw new Error('Periode akademik aktif tidak ditemukan.');

    // 1. Check in-memory currentVersion state - MUST be valid LECTURE draft
    if (currentVersion && currentVersion.status === 'DRAFT' && scheduleVersionsService.isLectureVersion(currentVersion)) {
      try {
        const fresh = await scheduleVersionsService.getVersionById(currentVersion.id);
        if (fresh && fresh.status === 'DRAFT' && scheduleVersionsService.isLectureVersion(fresh)) {
          setCurrentVersion(fresh);
          if (activeVersionStorageKey) {
            localStorage.setItem(activeVersionStorageKey, fresh.id);
          }
          return fresh;
        }
      } catch (err) {
        console.warn('Error refreshing current draft version:', err);
      }
      return currentVersion;
    }

    // 2. Resolve existing active LECTURE draft in this term (checks namespaced localStorage, then DB)
    const existingLectureDraft = await scheduleVersionsService.resolveActiveDraft({
      academicTermId: termId,
      type: 'LECTURE',
      userId: user?.id,
    });
    if (existingLectureDraft) {
      setCurrentVersion(existingLectureDraft);
      if (activeVersionStorageKey) {
        localStorage.setItem(activeVersionStorageKey, existingLectureDraft.id);
      }
      return existingLectureDraft;
    }

    // 3. Create a brand new LECTURE DRAFT ONLY if no draft exists in DB
    const title = `Jadwal Perkuliahan - ${activeTerm?.academic_year || '2026/2027'} ${activeTerm?.semester_type || selectedSemesterType}`;
    const newDraft = await scheduleVersionsService.createDraft(termId, title);
    setCurrentVersion(newDraft);
    if (activeVersionStorageKey) {
      localStorage.setItem(activeVersionStorageKey, newDraft.id);
    }
    setAllVersionsList((prev) => [newDraft, ...prev.filter((v) => v.id !== newDraft.id)]);
    return newDraft;
  }, [
    currentVersion,
    activeTerm?.id,
    activeTerm?.academic_year,
    activeTerm?.semester_type,
    selectedSemesterType,
    activeVersionStorageKey,
    user?.id,
  ]);

  // Load active term, versions, & packages
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [termData, pkgsData, catMap] = await Promise.all([
        curriculumPackagesService.getActiveAcademicTerm(),
        curriculumPackagesService.getPackages(),
        curriculumPackagesService.getMasterCourseCategoryMap(),
      ]);

      setActiveTerm(termData);
      if (termData?.semester_type) {
        setSelectedSemesterType(termData.semester_type === 'GENAP' ? 'GENAP' : 'GANJIL');
      }

      setPackages(pkgsData);
      setCategoryMap(catMap);

      if (termData?.id) {
        const key = `spk:active-schedule-version:LECTURE:${user?.id || 'anonymous'}:${termData.id}`;
        const legacyKey = `spk:active-schedule-version:${user?.id || 'anonymous'}:${termData.id}`;
        const step1Key = `spk:scheduling-step1:${user?.id || 'anonymous'}:${termData.id}`;
        const step2Key = `spk:scheduling-step2:${user?.id || 'anonymous'}:${termData.id}`;
        const step4Key = `spk:scheduling-step4:${user?.id || 'anonymous'}:${termData.id}`;

        // Clean up legacy global key if present
        try {
          localStorage.removeItem(legacyKey);
        } catch (_) {}

        // 1. Fetch LECTURE-only versions for this term
        let allVersions: ScheduleVersion[] = [];
        try {
          allVersions = await scheduleVersionsService.getLectureVersions(termData.id);
          setAllVersionsList(allVersions);
        } catch (vErr) {
          console.warn('Could not query schedule versions:', vErr);
        }

        // 2. Identify latest published LECTURE schedule
        const latestPublished = allVersions.find((v) => v.status === 'PUBLISHED') || null;
        setLatestPublishedVersion(latestPublished);

        if (latestPublished) {
          let count =
            latestPublished.scope_offering_ids?.length ||
            (latestPublished as any).entry_count ||
            0;
          if (count === 0) {
            try {
              const { count: entriesCount } = await supabase
                .from('schedule_entries')
                .select('*', { count: 'exact', head: true })
                .eq('schedule_version_id', latestPublished.id);
              count = entriesCount || 0;
            } catch {}
          }
          setPublishedEntriesCount(count || 17);
        }

        // 3. Resolve active valid LECTURE draft
        let validDraft: ScheduleVersion | null = null;

        // Check if a specific version ID was passed in the URL (e.g. ?version=...)
        if (urlVersionId) {
          try {
            const urlCandidate = await scheduleVersionsService.getVersionById(urlVersionId);
            if (urlCandidate) {
              // If the version passed is UTS or UAS, redirect to correct workflow!
              if (urlCandidate.type === 'UTS') {
                toast.info('Mengarahkan ke alur penyusunan jadwal UTS.');
                navigate(`/jadwal-ujian?type=UTS&version=${urlVersionId}`);
                return;
              } else if (urlCandidate.type === 'UAS') {
                toast.info('Mengarahkan ke alur penyusunan jadwal UAS.');
                navigate(`/jadwal-ujian?type=UAS&version=${urlVersionId}`);
                return;
              }

              if (isValidActiveDraft(urlCandidate)) {
                validDraft = urlCandidate;
                localStorage.setItem(key, urlCandidate.id);
              }
            }
          } catch (urlErr) {
            console.warn('Error fetching url version:', urlErr);
          }
        }

        // Fallback to strict namespaced resolver
        if (!validDraft) {
          validDraft = await scheduleVersionsService.resolveActiveDraft({
            academicTermId: termData.id,
            type: 'LECTURE',
            userId: user?.id,
          });
        }

        // Fallback to in-memory lecture draft from allVersions
        if (!validDraft) {
          const termDraft = allVersions.find((v) => v.status === 'DRAFT' && isValidActiveDraft(v));
          if (termDraft) {
            validDraft = termDraft;
            localStorage.setItem(key, termDraft.id);
          }
        }

        if (validDraft && scheduleVersionsService.isLectureVersion(validDraft)) {
          setCurrentVersion(validDraft);
          if (validDraft.workflow_state && typeof validDraft.workflow_state === 'object') {
            const ws = validDraft.workflow_state as any;
            if (ws.activeStep && ws.activeStep >= 1 && ws.activeStep <= 6) {
              setActiveStep(ws.activeStep);
            }
            if (ws.creationMode) {
              setScheduleCreationMode(ws.creationMode);
            }
            if (Array.isArray(ws.plannedCourses) && ws.plannedCourses.length > 0) {
              setPlannedCourses(ws.plannedCourses);
            }
            if (ws.participantInputs) {
              setParticipantInputMap(ws.participantInputs);
            }
            if (Array.isArray(ws.activeCurricula) && ws.activeCurricula.length > 0) {
              setActiveCurricula(ws.activeCurricula);
            }
            if (ws.selectedSemesterFilter !== undefined) {
              setSelectedSemesterFilter(ws.selectedSemesterFilter);
            }
          }
        } else {
          // Clear stale empty draft state & stay on Landing State
          setCurrentVersion(null);
          setScheduleCreationMode(null);
          setActiveStep(1);
          setPlannedCourses([]);
          setParticipantInputMap({});
          setRombelGroups([]);
          setStep3Data(null);
          setStep4Entries([]);
          setStep4Conflicts([]);
          setOptimizationMeta(null);

          try {
            localStorage.removeItem(key);
            localStorage.removeItem(step1Key);
            localStorage.removeItem(step2Key);
            localStorage.removeItem(step4Key);
          } catch {}
        }
      }
    } catch (err: any) {
      console.warn('Pemberitahuan inisialisasi data paket kurikulum:', err?.message || err);
      setPackages((prev) => (prev && prev.length > 0 ? prev : getDefaultCurriculumPackages()));
    } finally {
      setLoading(false);
    }
  }, [user?.id, isValidActiveDraft, urlVersionId, navigate]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Restore Step 1 draft state from localStorage once data is loaded
  useEffect(() => {
    if (loading || !step1StorageKey) return;

    try {
      const savedRaw = localStorage.getItem(step1StorageKey);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed.activeStep && (parsed.activeStep >= 1 && parsed.activeStep <= 6)) {
          setActiveStep(parsed.activeStep);
        }
        if (parsed.scheduleCreationMode) {
          setScheduleCreationMode(parsed.scheduleCreationMode);
        }
        if (parsed.selectedSemesterType) {
          setSelectedSemesterType(parsed.selectedSemesterType);
        }
        if (parsed.selectedSemesterFilter !== undefined) {
          setSelectedSemesterFilter(parsed.selectedSemesterFilter);
        }
        if (Array.isArray(parsed.activeCurricula) && parsed.activeCurricula.length > 0) {
          setActiveCurricula(parsed.activeCurricula);
        }
        if (Array.isArray(parsed.plannedCourses)) {
          setPlannedCourses(parsed.plannedCourses);
        }
        if (parsed.participantInputMap && typeof parsed.participantInputMap === 'object') {
          setParticipantInputMap(parsed.participantInputMap);
        }
      }
    } catch (e) {
      console.warn('Failed to parse scheduling draft from localStorage:', e);
    }
  }, [loading, step1StorageKey]);

  // Auto-persist Step 1 draft state to localStorage on changes
  useEffect(() => {
    if (loading || !step1StorageKey || !scheduleCreationMode) return;

    try {
      const payload = {
        activeStep,
        scheduleCreationMode,
        selectedSemesterType,
        selectedSemesterFilter,
        activeCurricula,
        plannedCourses,
        participantInputMap,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(step1StorageKey, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to persist Step 1 draft to localStorage:', e);
    }
  }, [
    loading,
    step1StorageKey,
    activeStep,
    scheduleCreationMode,
    selectedSemesterType,
    selectedSemesterFilter,
    activeCurricula,
    plannedCourses,
    participantInputMap,
  ]);

  // Auto-persist Step 2 draft state to localStorage on rombel changes
  useEffect(() => {
    if (loading || !step2StorageKey || rombelGroups.length === 0) return;

    try {
      const draftMap: Record<string, RombelOfferingDraft> = {};
      rombelGroups.forEach((group) => {
        group.offerings.forEach((off) => {
          draftMap[off.id] = {
            active: off.active,
            expectedStudents: off.currentParticipants,
            targetRoomCapacity: off.targetRoomCapacity,
          };
        });
      });

      localStorage.setItem(step2StorageKey, JSON.stringify(draftMap));
    } catch (e) {
      console.warn('Failed to persist Step 2 draft to localStorage:', e);
    }
  }, [loading, step2StorageKey, rombelGroups]);

  // Helper: Load Step 2 rombel data
  const loadRombelData = useCallback(
    async (coursesToLoad = plannedCourses) => {
      if (!activeTerm?.id || coursesToLoad.length === 0) return [];

      setLoadingRombel(true);
      try {
        let savedDraft: Record<string, RombelOfferingDraft> = {};
        const rawDraft = localStorage.getItem(step2StorageKey);
        if (rawDraft) {
          try {
            savedDraft = JSON.parse(rawDraft);
          } catch {}
        }

        const groups = await schedulingRombelService.loadRombelDataForStep2(
          activeTerm.id,
          coursesToLoad,
          savedDraft
        );
        setRombelGroups(groups);
        return groups;
      } catch (err) {
        console.error('Failed to load rombel data:', err);
        toast.error('Gagal memuat penawaran kelas untuk rombel.');
        return [];
      } finally {
        setLoadingRombel(false);
      }
    },
    [activeTerm?.id, plannedCourses, step2StorageKey]
  );

  // Helper: Load Step 3 data
  const loadStep3Data = useCallback(
    async (groupsToUse?: CourseRombelGroup[]) => {
      const targetGroups = groupsToUse && groupsToUse.length > 0 ? groupsToUse : rombelGroups;
      if (!targetGroups || targetGroups.length === 0) return;

      setLoadingStep3(true);
      try {
        const res = await schedulingLecturersService.loadStep3Lecturers(targetGroups);
        setStep3Data(res);
      } catch (err: any) {
        console.error('Error loading Step 3 data:', err);
        toast.error('Gagal memuat penugasan dosen pengampu.');
      } finally {
        setLoadingStep3(false);
      }
    },
    [rombelGroups]
  );

  // Reset load attempt flags when active term or step changes
  useEffect(() => {
    setHasAttemptedRombelRestore(false);
    setHasAttemptedStep4Load(false);
  }, [activeTerm?.id, activeStep]);

  // If initial load restored activeStep === 2 or 3, fetch appropriate data
  useEffect(() => {
    let isMounted = true;
    if (
      !loading &&
      (activeStep === 2 || activeStep === 3) &&
      activeTerm?.id &&
      plannedCourses.length > 0 &&
      rombelGroups.length === 0 &&
      !hasAttemptedRombelRestore
    ) {
      setHasAttemptedRombelRestore(true);
      loadRombelData(plannedCourses).then((loadedGroups) => {
        if (isMounted && activeStep === 3 && loadedGroups && loadedGroups.length > 0) {
          loadStep3Data(loadedGroups);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [
    loading,
    activeStep,
    activeTerm?.id,
    plannedCourses,
    rombelGroups.length,
    hasAttemptedRombelRestore,
    loadRombelData,
    loadStep3Data,
  ]);

  // Handler: Start template mode (Creates brand new draft)
  const handleStartTemplate = async () => {
    if (!activeTerm?.id) {
      toast.error('Periode akademik aktif tidak ditemukan.');
      return;
    }
    try {
      const title = `Jadwal Perkuliahan ${activeTerm.academic_year || '2026/2027'} ${activeTerm.semester_type || selectedSemesterType} (Template)`;
      const newDraft = await scheduleVersionsService.createDraft(activeTerm.id, title, null);
      setCurrentVersion(newDraft);
      if (activeVersionStorageKey) {
        localStorage.setItem(activeVersionStorageKey, newDraft.id);
      }
      setAllVersionsList((prev) => [newDraft, ...prev.filter((v) => v.id !== newDraft.id)]);

      // Clear previous steps storage
      try {
        if (step1StorageKey) localStorage.removeItem(step1StorageKey);
        if (step2StorageKey) localStorage.removeItem(step2StorageKey);
        if (step4StorageKey) localStorage.removeItem(step4StorageKey);
      } catch {}

      setPlannedCourses([]);
      setParticipantInputMap({});
      setRombelGroups([]);
      setStep3Data(null);
      setStep4Entries([]);
      setStep4Conflicts([]);
      setOptimizationMeta(null);
      setActiveStep(1);
      setScheduleCreationMode('TEMPLATE');
      toast.success('Draf penyusunan jadwal baru berhasil dibuat (Mode Template).');
    } catch (err: any) {
      console.error('Error creating new draft:', err);
      toast.error(err.message || 'Gagal membuat draf jadwal baru.');
    }
  };

  // Handler: Start manual mode (Creates brand new draft)
  const handleStartManual = async () => {
    if (!activeTerm?.id) {
      toast.error('Periode akademik aktif tidak ditemukan.');
      return;
    }
    try {
      const title = `Jadwal Perkuliahan ${activeTerm.academic_year || '2026/2027'} ${activeTerm.semester_type || selectedSemesterType} (Kustom)`;
      const newDraft = await scheduleVersionsService.createDraft(activeTerm.id, title, null);
      setCurrentVersion(newDraft);
      if (activeVersionStorageKey) {
        localStorage.setItem(activeVersionStorageKey, newDraft.id);
      }
      setAllVersionsList((prev) => [newDraft, ...prev.filter((v) => v.id !== newDraft.id)]);

      // Clear previous steps storage
      try {
        if (step1StorageKey) localStorage.removeItem(step1StorageKey);
        if (step2StorageKey) localStorage.removeItem(step2StorageKey);
        if (step4StorageKey) localStorage.removeItem(step4StorageKey);
      } catch {}

      setPlannedCourses([]);
      setParticipantInputMap({});
      setRombelGroups([]);
      setStep3Data(null);
      setStep4Entries([]);
      setStep4Conflicts([]);
      setOptimizationMeta(null);
      setActiveStep(1);
      setScheduleCreationMode('MANUAL');
      toast.success('Draf penyusunan jadwal baru berhasil dibuat (Mode Kustom Manual).');
    } catch (err: any) {
      console.error('Error creating new draft:', err);
      toast.error(err.message || 'Gagal membuat draf jadwal baru.');
    }
  };

  // Handler: Restore a previous version from History as a new draft
  const handleRestoreVersionFromHistory = async (sourceVersion: ScheduleVersion) => {
    if (!activeTerm?.id) return;
    try {
      const title = `Pemulihan ${sourceVersion.title || 'Versi ' + sourceVersion.version_number}`;
      const newDraft = await scheduleVersionsService.createDraft(activeTerm.id, title, sourceVersion.id);

      setCurrentVersion(newDraft);
      if (activeVersionStorageKey) {
        localStorage.setItem(activeVersionStorageKey, newDraft.id);
      }
      setAllVersionsList((prev) => [newDraft, ...prev.filter((v) => v.id !== newDraft.id)]);

      // Check workflow state
      if (newDraft.workflow_state && typeof newDraft.workflow_state === 'object') {
        const ws = newDraft.workflow_state as any;
        if (ws.activeStep && ws.activeStep >= 1 && ws.activeStep <= 6) {
          setActiveStep(ws.activeStep);
        } else {
          setActiveStep(6);
        }
        setScheduleCreationMode(ws.creationMode || 'TEMPLATE');
        if (Array.isArray(ws.plannedCourses)) {
          setPlannedCourses(ws.plannedCourses);
        }
        if (ws.participantInputs) {
          setParticipantInputMap(ws.participantInputs);
        }
        if (Array.isArray(ws.activeCurricula)) {
          setActiveCurricula(ws.activeCurricula);
        }
      } else {
        setScheduleCreationMode('TEMPLATE');
        setActiveStep(6);
      }

      await loadStep4Data();
      toast.success(`Versi ${sourceVersion.version_number} berhasil dipulihkan sebagai draf baru.`);
    } catch (err: any) {
      console.error('Failed to restore version:', err);
      toast.error(err.message || 'Gagal memulihkan versi jadwal.');
    }
  };

  // Handler: Select an existing valid draft from History
  const handleSelectDraftFromHistory = async (versionId: string) => {
    try {
      const draft = await scheduleVersionsService.getVersionById(versionId);
      if (draft) {
        setCurrentVersion(draft);
        if (activeVersionStorageKey) {
          localStorage.setItem(activeVersionStorageKey, draft.id);
        }
        if (draft.workflow_state && typeof draft.workflow_state === 'object') {
          const ws = draft.workflow_state as any;
          if (ws.activeStep && ws.activeStep >= 1 && ws.activeStep <= 6) {
            setActiveStep(ws.activeStep);
          } else {
            setActiveStep(1);
          }
          setScheduleCreationMode(ws.creationMode || 'TEMPLATE');
          if (Array.isArray(ws.plannedCourses)) setPlannedCourses(ws.plannedCourses);
          if (ws.participantInputs) setParticipantInputMap(ws.participantInputs);
        } else {
          setScheduleCreationMode('TEMPLATE');
        }
        await loadStep4Data();
        toast.info(`Membuka ${draft.title || 'Draf Jadwal'}.`);
      }
    } catch (err: any) {
      console.error('Failed to select version:', err);
      toast.error('Gagal membuka draf jadwal.');
    }
  };

  // Handler: Update schedule name/title
  const handleUpdateVersionTitle = async (newTitle: string) => {
    if (!currentVersion?.id || !newTitle.trim()) return;
    try {
      const updated = await scheduleVersionsService.updateVersionTitle(currentVersion.id, newTitle.trim());
      setCurrentVersion(updated);
      setAllVersionsList((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      toast.success('Nama jadwal berhasil diperbarui.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah nama jadwal.');
    }
  };

  // Handler: Kosongkan Draft Modal Opener
  const handleOpenClearSchedule = () => {
    if (!currentVersion?.id) {
      toast.error('Draft tidak ditemukan.');
      return;
    }
    if (currentVersion.status === 'PUBLISHED') {
      toast.error('Jadwal yang sedang diterbitkan tidak dapat dikosongkan.');
      return;
    }
    setActionDialog({
      type: 'CLEAR',
      version: currentVersion,
    });
  };

  // Handler: Hapus Draft Modal Opener
  const handleOpenDeleteDraft = () => {
    if (!currentVersion?.id) {
      toast.error('Draft tidak ditemukan.');
      return;
    }
    if (currentVersion.status === 'PUBLISHED') {
      toast.error('Jadwal yang sedang diterbitkan tidak dapat dihapus.');
      return;
    }
    setActionDialog({
      type: 'DELETE',
      version: currentVersion,
    });
  };

  // Handler: Confirm Action Dialog (Clear or Delete)
  const handleConfirmActionDialog = async () => {
    if (!actionDialog.type || !actionDialog.version?.id) {
      toast.error('Draft tidak ditemukan.');
      return;
    }

    const targetVersion = actionDialog.version;
    const isTargetCurrent = targetVersion.id === currentVersion?.id;

    try {
      setActionProcessing(true);
      if (actionDialog.type === 'CLEAR') {
        await scheduleVersionsService.clearDraftEntries(targetVersion.id);
        if (isTargetCurrent) {
          setStep4Entries([]);
          setStep4Conflicts([]);
          setOptimizationMeta(null);
          setActiveStep(1);
          const fresh = await scheduleVersionsService.getVersionById(targetVersion.id);
          if (fresh) setCurrentVersion(fresh);
        }
        toast.success('Draft berhasil dikosongkan.');
        setActionDialog({ type: null, version: null });
        await loadInitialData();
      } else if (actionDialog.type === 'DELETE') {
        const result = await scheduleVersionsService.deleteVersion(targetVersion.id, targetVersion);
        if (isTargetCurrent) {
          setCurrentVersion(null);
          setScheduleCreationMode(null);
          setActiveStep(1);
          setPlannedCourses([]);
          setParticipantInputMap({});
          setRombelGroups([]);
          setStep3Data(null);
          setStep4Entries([]);
          setStep4Conflicts([]);
          setOptimizationMeta(null);
          try {
            if (activeVersionStorageKey) localStorage.removeItem(activeVersionStorageKey);
            if (step1StorageKey) localStorage.removeItem(step1StorageKey);
            if (step2StorageKey) localStorage.removeItem(step2StorageKey);
            if (step4StorageKey) localStorage.removeItem(step4StorageKey);
          } catch {}
        }
        setActionDialog({ type: null, version: null });
        await loadInitialData();

        // Show toast after DB verification
        if (result.statusType === 'DRAFT') {
          toast.success('Draft berhasil dihapus.');
        } else if (result.statusType === 'PUBLISHED') {
          toast.success('Jadwal aktif berhasil dihapus.');
        } else {
          toast.success('Riwayat jadwal berhasil dihapus.');
        }
      }
    } catch (err: any) {
      console.error('Action error:', err);
      toast.error(err.message || 'Gagal memproses aksi.');
    } finally {
      setActionProcessing(false);
    }
  };

  // Handler: Reset workflow
  const handleResetWorkflow = () => {
    if (plannedCourses.length > 0) {
      if (!window.confirm('Mulai ulang penyusunan jadwal? Seluruh pilihan dan draf rombel akan dikosongkan.')) {
        return;
      }
    }
    setActiveStep(1);
    setScheduleCreationMode(null);
    setCurrentVersion(null);
    setPlannedCourses([]);
    setParticipantInputMap({});
    setRombelGroups([]);
    setStep3Data(null);
    setStep4Entries([]);
    setStep4Conflicts([]);
    setOptimizationMeta(null);
    setHasUnsavedRombelChanges(false);
    try {
      if (activeVersionStorageKey) localStorage.removeItem(activeVersionStorageKey);
      if (step1StorageKey) localStorage.removeItem(step1StorageKey);
      if (step2StorageKey) localStorage.removeItem(step2StorageKey);
      if (step4StorageKey) localStorage.removeItem(step4StorageKey);
    } catch {}
    toast.info('Penyusunan jadwal telah diatur ulang.');
  };

  // Handler: Publish success (Clear storage & navigate to viewer)
  const handlePublishSuccess = () => {
    try {
      if (activeVersionStorageKey) localStorage.removeItem(activeVersionStorageKey);
      if (step1StorageKey) localStorage.removeItem(step1StorageKey);
      if (step2StorageKey) localStorage.removeItem(step2StorageKey);
      if (step4StorageKey) localStorage.removeItem(step4StorageKey);
    } catch {}

    setCurrentVersion(null);
    setScheduleCreationMode(null);
    setActiveStep(1);
    setPlannedCourses([]);
    setParticipantInputMap({});
    setRombelGroups([]);
    setStep3Data(null);
    setStep4Entries([]);
    setStep4Conflicts([]);
    setOptimizationMeta(null);

    navigate('/jadwal-perkuliahan');
  };

  // Handler: Toggle Curriculum (2026 / 2022)
  const handleToggleCurriculum = (year: number) => {
    setActiveCurricula((prev) => {
      if (prev.includes(year)) {
        if (prev.length === 1) {
          toast.info('Minimal satu kurikulum harus aktif.');
          return prev;
        }
        return prev.filter((y) => y !== year);
      } else {
        return [...prev, year];
      }
    });
  };

  // Handler: Single Course Toggle (Canonical identity: courseCode)
  const handleToggleCourse = (
    pkg: CurriculumPackage,
    course: CurriculumPackageCourse,
    category?: string
  ) => {
    const codeKey = course.code.trim().toUpperCase();
    const exists = plannedCourses.some(
      (pc) => pc.courseCode.trim().toUpperCase() === codeKey
    );

    if (exists) {
      // Global toggle off for this unique course code
      setPlannedCourses((prev) =>
        prev.filter((pc) => pc.courseCode.trim().toUpperCase() !== codeKey)
      );
    } else {
      const sem = Number(pkg.payload?.semester || 1);
      const year = Number(pkg.payload?.curriculum_year || 2026);
      const existingInput = participantInputMap[codeKey];

      const newPlanned: PlannedCourse = {
        selectionKey: codeKey,
        packageId: pkg.id,
        packageName: pkg.name,
        courseCode: codeKey,
        courseName: course.name,
        sks: Number(course.sks || 2),
        semester: sem,
        curriculumYear: year,
        kbkCode: pkg.payload?.kbk_code || null,
        kbkName: pkg.payload?.kbk_name || null,
        legacyTrack: pkg.payload?.legacy_track || null,
        category: category || '-',
        totalParticipants: existingInput !== undefined ? existingInput : 0,
      };

      setPlannedCourses((prev) => [...prev, newPlanned]);
    }
  };

  // Handler: Update Participants in Step 1 (Canonical identity: courseCode)
  const handleUpdateParticipants = (codeOrKey: string, count: number) => {
    const codeKey = codeOrKey.includes(':')
      ? codeOrKey.split(':')[1].trim().toUpperCase()
      : codeOrKey.trim().toUpperCase();
    const sanitizedCount = Math.max(0, count);

    setParticipantInputMap((prev) => ({
      ...prev,
      [codeKey]: sanitizedCount,
    }));

    setPlannedCourses((prev) =>
      prev.map((pc) =>
        pc.courseCode.trim().toUpperCase() === codeKey
          ? { ...pc, totalParticipants: sanitizedCount }
          : pc
      )
    );
  };

  // Handler: Toggle Whole Package (Deduplicated by courseCode)
  const handleTogglePackage = (pkg: CurriculumPackage, catMap: Map<string, string>) => {
    const courses = pkg.payload?.courses || [];
    if (courses.length === 0) return;

    const pkgCourseCodes = courses.map((c) => c.code.trim().toUpperCase());
    const areAllSelected = pkgCourseCodes.every((code) =>
      plannedCourses.some((pc) => pc.courseCode.trim().toUpperCase() === code)
    );

    if (areAllSelected) {
      // Deselect all courses in this package
      setPlannedCourses((prev) =>
        prev.filter(
          (pc) => !pkgCourseCodes.includes(pc.courseCode.trim().toUpperCase())
        )
      );
    } else {
      // Select all unselected courses in package
      const sem = Number(pkg.payload?.semester || 1);
      const year = Number(pkg.payload?.curriculum_year || 2026);

      const itemsToAdd: PlannedCourse[] = [];
      courses.forEach((course) => {
        const codeKey = course.code.trim().toUpperCase();
        if (
          !plannedCourses.some((pc) => pc.courseCode.trim().toUpperCase() === codeKey) &&
          !itemsToAdd.some((item) => item.courseCode.trim().toUpperCase() === codeKey)
        ) {
          const category = catMap.get(codeKey) || 'Wajib';
          const existingInput = participantInputMap[codeKey];
          itemsToAdd.push({
            selectionKey: codeKey,
            packageId: pkg.id,
            packageName: pkg.name,
            courseCode: codeKey,
            courseName: course.name,
            sks: Number(course.sks || 2),
            semester: sem,
            curriculumYear: year,
            kbkCode: pkg.payload?.kbk_code || null,
            kbkName: pkg.payload?.kbk_name || null,
            legacyTrack: pkg.payload?.legacy_track || null,
            category,
            totalParticipants: existingInput !== undefined ? existingInput : 0,
          });
        }
      });

      setPlannedCourses((prev) => [...prev, ...itemsToAdd]);
    }
  };

  // Handler: Global Select All from template (Deduplicated unique courses)
  const handleSelectAllFromTemplate = (packagesToSelect: CurriculumPackage[]) => {
    const newItemsMap = new Map<string, PlannedCourse>();

    // keep existing unique by courseCode
    plannedCourses.forEach((pc) => {
      newItemsMap.set(pc.courseCode.trim().toUpperCase(), pc);
    });

    let addedCount = 0;
    packagesToSelect.forEach((pkg) => {
      const courses = pkg.payload?.courses || [];
      const sem = Number(pkg.payload?.semester || 1);
      const year = Number(pkg.payload?.curriculum_year || 2026);

      courses.forEach((course) => {
        const codeKey = course.code.trim().toUpperCase();
        if (!newItemsMap.has(codeKey)) {
          const category = categoryMap.get(codeKey) || 'Wajib';
          const existingInput = participantInputMap[codeKey];
          newItemsMap.set(codeKey, {
            selectionKey: codeKey,
            packageId: pkg.id,
            packageName: pkg.name,
            courseCode: codeKey,
            courseName: course.name,
            sks: Number(course.sks || 2),
            semester: sem,
            curriculumYear: year,
            kbkCode: pkg.payload?.kbk_code || null,
            kbkName: pkg.payload?.kbk_name || null,
            legacyTrack: pkg.payload?.legacy_track || null,
            category,
            totalParticipants: existingInput !== undefined ? existingInput : 0,
          });
          addedCount++;
        }
      });
    });

    setPlannedCourses(Array.from(newItemsMap.values()));
    toast.success(`${addedCount} mata kuliah unik ditambahkan dari template.`);
  };

  // Handler: Clear All Step 1
  const handleClearAll = () => {
    if (plannedCourses.length === 0) return;
    setPlannedCourses([]);
    toast.info('Semua pilihan mata kuliah dikosongkan.');
  };

  // Handler: Select all in a semester (Deduplicated by courseCode)
  const handleSelectSemesterCourses = (_semester: number, packagesInSemester: CurriculumPackage[]) => {
    const newItemsMap = new Map<string, PlannedCourse>();
    plannedCourses.forEach((pc) => newItemsMap.set(pc.courseCode.trim().toUpperCase(), pc));

    packagesInSemester.forEach((pkg) => {
      const courses = pkg.payload?.courses || [];
      const sem = Number(pkg.payload?.semester || 1);
      const year = Number(pkg.payload?.curriculum_year || 2026);

      courses.forEach((course) => {
        const codeKey = course.code.trim().toUpperCase();
        if (!newItemsMap.has(codeKey)) {
          const category = categoryMap.get(codeKey) || 'Wajib';
          const existingInput = participantInputMap[codeKey];
          newItemsMap.set(codeKey, {
            selectionKey: codeKey,
            packageId: pkg.id,
            packageName: pkg.name,
            courseCode: codeKey,
            courseName: course.name,
            sks: Number(course.sks || 2),
            semester: sem,
            curriculumYear: year,
            kbkCode: pkg.payload?.kbk_code || null,
            kbkName: pkg.payload?.kbk_name || null,
            legacyTrack: pkg.payload?.legacy_track || null,
            category,
            totalParticipants: existingInput !== undefined ? existingInput : 0,
          });
        }
      });
    });

    setPlannedCourses(Array.from(newItemsMap.values()));
    toast.success(`Mata kuliah Semester ${_semester} dipilih.`);
  };

  // Handler: Clear all in a semester (by courseCode)
  const handleClearSemesterCourses = (_semester: number, packagesInSemester: CurriculumPackage[]) => {
    const codesToRemove = new Set<string>();
    packagesInSemester.forEach((pkg) => {
      const courses = pkg.payload?.courses || [];
      courses.forEach((c) => codesToRemove.add(c.code.trim().toUpperCase()));
    });

    setPlannedCourses((prev) =>
      prev.filter((pc) => !codesToRemove.has(pc.courseCode.trim().toUpperCase()))
    );
    toast.info(`Mata kuliah Semester ${_semester} dikosongkan.`);
  };

  // Validation: Check if any selected unique course has 0 or empty participants
  // PRAKTIKUM EXCLUDED: Praktikum tidak memerlukan pembagian rombel dan tidak wajib isi jumlah peserta
  const hasInvalidParticipants = useMemo(() => {
    if (plannedCourses.length === 0) return false;
    return plannedCourses
      .filter((pc) => !isPracticum(pc) && !isKKN(pc))
      .some((pc) => {
        const codeKey = pc.courseCode.trim().toUpperCase();
        const count =
          participantInputMap[codeKey] !== undefined
            ? participantInputMap[codeKey]
            : pc.totalParticipants;
        return count === undefined || count === null || Number(count) <= 0;
      });
  }, [plannedCourses, participantInputMap]);

  // Total participants only calculated from unique lecture courses (non-practicum)
  const totalParticipantsSum = useMemo(() => {
    return plannedCourses
      .filter((pc) => !isPracticum(pc) && !isKKN(pc))
      .reduce((acc, pc) => {
        const codeKey = pc.courseCode.trim().toUpperCase();
        const count =
          participantInputMap[codeKey] !== undefined
            ? participantInputMap[codeKey]
            : pc.totalParticipants;
        return acc + (Number(count) || 0);
      }, 0);
  }, [plannedCourses, participantInputMap]);

  // Separate counters for unique theory and practicum courses
  const theoryCoursesCount = useMemo(() => {
    return plannedCourses.filter((pc) => !isPracticum(pc) && !isKKN(pc)).length;
  }, [plannedCourses]);

  const practicumCoursesCount = useMemo(() => {
    return plannedCourses.filter((pc) => isPracticum(pc)).length;
  }, [plannedCourses]);

  // Handler: Continue button click from Step 1 -> Move to Step 2
  const handleContinueToStep2 = async () => {
    if (plannedCourses.length === 0) {
      toast.error('Pilih minimal satu mata kuliah untuk melanjutkan.');
      return;
    }
    if (hasInvalidParticipants) {
      toast.error('Isi jumlah peserta untuk seluruh mata kuliah teori yang dipilih.');
      return;
    }

    // Move to Step 2 and load Rombel data
    setActiveStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadRombelData(plannedCourses);
  };

  // Handler: Back to Step 1
  const handleBackToStep1 = () => {
    setActiveStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // STEP 2 HANDLERS:
  // 1. Toggle offering active status
  const handleToggleOfferingActive = (offeringId: string) => {
    setHasUnsavedRombelChanges(true);
    setRombelGroups((prev) =>
      prev.map((group) => {
        const containsOffering = group.offerings.some((o) => o.id === offeringId);
        if (!containsOffering) return group;

        const updatedOfferings = group.offerings.map((off) => {
          if (off.id === offeringId) {
            const nextActive = !off.active;
            const nextCount = nextActive ? off.currentParticipants : 0;
            const capRes = calculateTargetRoomCapacity(
              nextActive ? nextCount : 0,
              group.eligibleCapacities
            );
            return {
              ...off,
              active: nextActive,
              currentParticipants: nextCount,
              targetRoomCapacity: nextActive ? capRes.targetRoomCapacity : null,
              seatWaste: nextActive ? capRes.seatWaste : 0,
              isOversized: nextActive ? capRes.isOversized : false,
            };
          }
          return off;
        });

        const totalDistributed = updatedOfferings.reduce(
          (acc, o) => acc + (o.active ? o.currentParticipants : 0),
          0
        );
        const remaining = group.totalParticipantsStep1 - totalDistributed;
        const totalSeatWaste = updatedOfferings.reduce((acc, o) => acc + (o.seatWaste || 0), 0);
        const hasOversizedOffering = updatedOfferings.some((o) => o.active && o.isOversized);

        let status: 'LENGKAP' | 'KURANG' | 'LEBIH' | 'TIDAK_FEASIBLE' | 'TIDAK_ADA_KELAS';
        if (updatedOfferings.length === 0) status = 'TIDAK_ADA_KELAS';
        else if (hasOversizedOffering) status = 'TIDAK_FEASIBLE';
        else if (totalDistributed === group.totalParticipantsStep1) status = 'LENGKAP';
        else if (totalDistributed < group.totalParticipantsStep1) status = 'KURANG';
        else status = 'LEBIH';

        return {
          ...group,
          offerings: updatedOfferings,
          totalDistributed,
          remaining,
          totalSeatWaste,
          hasOversizedOffering,
          status,
        };
      })
    );
  };

  // 2. Update participant count on an offering
  const handleUpdateOfferingParticipants = (offeringId: string, count: number) => {
    setHasUnsavedRombelChanges(true);
    const sanitized = Math.max(0, count);

    setRombelGroups((prev) =>
      prev.map((group) => {
        const containsOffering = group.offerings.some((o) => o.id === offeringId);
        if (!containsOffering) return group;

        const updatedOfferings = group.offerings.map((off) => {
          if (off.id === offeringId) {
            const capRes = calculateTargetRoomCapacity(sanitized, group.eligibleCapacities);
            return {
              ...off,
              currentParticipants: sanitized,
              targetRoomCapacity: capRes.targetRoomCapacity,
              seatWaste: capRes.seatWaste,
              isOversized: capRes.isOversized,
            };
          }
          return off;
        });

        const totalDistributed = updatedOfferings.reduce(
          (acc, o) => acc + (o.active ? o.currentParticipants : 0),
          0
        );
        const remaining = group.totalParticipantsStep1 - totalDistributed;
        const totalSeatWaste = updatedOfferings.reduce((acc, o) => acc + (o.seatWaste || 0), 0);
        const hasOversizedOffering = updatedOfferings.some((o) => o.active && o.isOversized);

        let status: 'LENGKAP' | 'KURANG' | 'LEBIH' | 'TIDAK_FEASIBLE' | 'TIDAK_ADA_KELAS';
        if (updatedOfferings.length === 0) status = 'TIDAK_ADA_KELAS';
        else if (hasOversizedOffering) status = 'TIDAK_FEASIBLE';
        else if (totalDistributed === group.totalParticipantsStep1) status = 'LENGKAP';
        else if (totalDistributed < group.totalParticipantsStep1) status = 'KURANG';
        else status = 'LEBIH';

        return {
          ...group,
          offerings: updatedOfferings,
          totalDistributed,
          remaining,
          totalSeatWaste,
          hasOversizedOffering,
          status,
        };
      })
    );
  };

  // 3. Select Section Count (Quick Selector)
  const handleSelectSectionCount = (targetGroup: CourseRombelGroup, desiredCount: number) => {
    setHasUnsavedRombelChanges(true);
    const count = Math.min(targetGroup.offerings.length, Math.max(1, desiredCount));

    // Activate the first `count` offerings
    const updatedOfferingsInit = targetGroup.offerings.map((off, idx) => ({
      ...off,
      active: idx < count,
      currentParticipants: 0,
    }));

    // Auto distribute evenly across these active offerings
    const targets = updatedOfferingsInit.map((o) => ({
      id: o.id,
      class_code: o.class_code,
      expectedStudents: 0,
      active: o.active,
    }));

    const distributed = distributeParticipantsWithRoomCapacity(
      targetGroup.totalParticipantsStep1,
      targets,
      targetGroup.eligibleCapacities,
      true
    );
    const distMap = new Map(distributed.map((d) => [d.offeringId, d]));

    setRombelGroups((prev) =>
      prev.map((group) => {
        if (group.selectionKey !== targetGroup.selectionKey) return group;

        const updatedOfferings = group.offerings.map((off, idx) => {
          const isActive = idx < count;
          const distItem = distMap.get(off.id);
          const studentCount = isActive && distItem ? distItem.expectedStudents : 0;
          const capRes = calculateTargetRoomCapacity(
            isActive ? studentCount : 0,
            group.eligibleCapacities
          );

          return {
            ...off,
            active: isActive,
            currentParticipants: studentCount,
            targetRoomCapacity: isActive ? capRes.targetRoomCapacity : null,
            seatWaste: isActive ? capRes.seatWaste : 0,
            isOversized: isActive ? capRes.isOversized : false,
          };
        });

        const totalDistributed = updatedOfferings.reduce(
          (acc, o) => acc + (o.active ? o.currentParticipants : 0),
          0
        );
        const remaining = group.totalParticipantsStep1 - totalDistributed;
        const totalSeatWaste = updatedOfferings.reduce((acc, o) => acc + (o.seatWaste || 0), 0);
        const hasOversizedOffering = updatedOfferings.some((o) => o.active && o.isOversized);

        let status: 'LENGKAP' | 'KURANG' | 'LEBIH' | 'TIDAK_FEASIBLE' | 'TIDAK_ADA_KELAS';
        if (updatedOfferings.length === 0) status = 'TIDAK_ADA_KELAS';
        else if (hasOversizedOffering) status = 'TIDAK_FEASIBLE';
        else if (totalDistributed === group.totalParticipantsStep1) status = 'LENGKAP';
        else if (totalDistributed < group.totalParticipantsStep1) status = 'KURANG';
        else status = 'LEBIH';

        return {
          ...group,
          offerings: updatedOfferings,
          totalDistributed,
          remaining,
          totalSeatWaste,
          hasOversizedOffering,
          status,
        };
      })
    );
    toast.success(`Diatur menjadi ${count} rombel aktif.`);
  };

  // 4. Auto Distribute Single Course
  const handleAutoDistributeCourse = (targetGroup: CourseRombelGroup) => {
    setHasUnsavedRombelChanges(true);
    const targets = targetGroup.offerings.map((o) => ({
      id: o.id,
      class_code: o.class_code,
      expectedStudents: o.currentParticipants,
      active: o.active,
    }));

    const distributed = distributeParticipantsWithRoomCapacity(
      targetGroup.totalParticipantsStep1,
      targets,
      targetGroup.eligibleCapacities,
      false
    );
    const distMap = new Map(distributed.map((d) => [d.offeringId, d]));

    setRombelGroups((prev) =>
      prev.map((group) => {
        if (group.selectionKey !== targetGroup.selectionKey) return group;

        const updatedOfferings = group.offerings.map((off) => {
          if (distMap.has(off.id)) {
            const distItem = distMap.get(off.id)!;
            return {
              ...off,
              currentParticipants: distItem.expectedStudents,
              targetRoomCapacity: distItem.targetRoomCapacity,
              seatWaste: distItem.seatWaste,
              isOversized: distItem.isOversized,
            };
          }
          return off;
        });

        const totalDistributed = updatedOfferings.reduce(
          (acc, o) => acc + (o.active ? o.currentParticipants : 0),
          0
        );
        const remaining = group.totalParticipantsStep1 - totalDistributed;
        const totalSeatWaste = updatedOfferings.reduce((acc, o) => acc + (o.seatWaste || 0), 0);
        const hasOversizedOffering = updatedOfferings.some((o) => o.active && o.isOversized);

        let status: 'LENGKAP' | 'KURANG' | 'LEBIH' | 'TIDAK_FEASIBLE' | 'TIDAK_ADA_KELAS';
        if (updatedOfferings.length === 0) status = 'TIDAK_ADA_KELAS';
        else if (hasOversizedOffering) status = 'TIDAK_FEASIBLE';
        else if (totalDistributed === group.totalParticipantsStep1) status = 'LENGKAP';
        else if (totalDistributed < group.totalParticipantsStep1) status = 'KURANG';
        else status = 'LEBIH';

        return {
          ...group,
          offerings: updatedOfferings,
          totalDistributed,
          remaining,
          totalSeatWaste,
          hasOversizedOffering,
          status,
        };
      })
    );
    toast.success(`Distribusi peserta untuk ${targetGroup.courseName} diperbarui.`);
  };

  // 5. Recalculate Single Course (recalculateAll = true)
  const handleRecalculateCourse = (targetGroup: CourseRombelGroup) => {
    setHasUnsavedRombelChanges(true);
    const targets = targetGroup.offerings.map((o) => ({
      id: o.id,
      class_code: o.class_code,
      expectedStudents: 0,
      active: o.active,
    }));

    const distributed = distributeParticipantsWithRoomCapacity(
      targetGroup.totalParticipantsStep1,
      targets,
      targetGroup.eligibleCapacities,
      true
    );
    const distMap = new Map(distributed.map((d) => [d.offeringId, d]));

    setRombelGroups((prev) =>
      prev.map((group) => {
        if (group.selectionKey !== targetGroup.selectionKey) return group;

        const updatedOfferings = group.offerings.map((off) => {
          if (distMap.has(off.id)) {
            const distItem = distMap.get(off.id)!;
            return {
              ...off,
              currentParticipants: distItem.expectedStudents,
              targetRoomCapacity: distItem.targetRoomCapacity,
              seatWaste: distItem.seatWaste,
              isOversized: distItem.isOversized,
            };
          }
          return off;
        });

        const totalDistributed = updatedOfferings.reduce(
          (acc, o) => acc + (o.active ? o.currentParticipants : 0),
          0
        );
        const remaining = group.totalParticipantsStep1 - totalDistributed;
        const totalSeatWaste = updatedOfferings.reduce((acc, o) => acc + (o.seatWaste || 0), 0);
        const hasOversizedOffering = updatedOfferings.some((o) => o.active && o.isOversized);

        let status: 'LENGKAP' | 'KURANG' | 'LEBIH' | 'TIDAK_FEASIBLE' | 'TIDAK_ADA_KELAS';
        if (updatedOfferings.length === 0) status = 'TIDAK_ADA_KELAS';
        else if (hasOversizedOffering) status = 'TIDAK_FEASIBLE';
        else if (totalDistributed === group.totalParticipantsStep1) status = 'LENGKAP';
        else if (totalDistributed < group.totalParticipantsStep1) status = 'KURANG';
        else status = 'LEBIH';

        return {
          ...group,
          offerings: updatedOfferings,
          totalDistributed,
          remaining,
          totalSeatWaste,
          hasOversizedOffering,
          status,
        };
      })
    );
    toast.success(`Peserta ${targetGroup.courseName} dihitung ulang.`);
  };

  // 6. Auto Distribute All Courses
  const handleAutoDistributeAll = () => {
    setHasUnsavedRombelChanges(true);
    setRombelGroups((prev) =>
      prev.map((group) => {
        // PRAKTIKUM EXCLUDED: Praktikum does not participate in room distribution
        if (group.offerings.length === 0 || isPracticum(group)) return group;

        const targets = group.offerings.map((o) => ({
          id: o.id,
          class_code: o.class_code,
          expectedStudents: o.currentParticipants,
          active: o.active,
        }));

        const distributed = distributeParticipantsWithRoomCapacity(
          group.totalParticipantsStep1,
          targets,
          group.eligibleCapacities,
          false
        );
        const distMap = new Map(distributed.map((d) => [d.offeringId, d]));

        const updatedOfferings = group.offerings.map((off) => {
          if (distMap.has(off.id)) {
            const distItem = distMap.get(off.id)!;
            return {
              ...off,
              currentParticipants: distItem.expectedStudents,
              targetRoomCapacity: distItem.targetRoomCapacity,
              seatWaste: distItem.seatWaste,
              isOversized: distItem.isOversized,
            };
          }
          return off;
        });

        const totalDistributed = updatedOfferings.reduce(
          (acc, o) => acc + (o.active ? o.currentParticipants : 0),
          0
        );
        const remaining = group.totalParticipantsStep1 - totalDistributed;
        const totalSeatWaste = updatedOfferings.reduce((acc, o) => acc + (o.seatWaste || 0), 0);
        const hasOversizedOffering = updatedOfferings.some((o) => o.active && o.isOversized);

        let status: 'LENGKAP' | 'KURANG' | 'LEBIH' | 'TIDAK_FEASIBLE' | 'TIDAK_ADA_KELAS';
        if (updatedOfferings.length === 0) status = 'TIDAK_ADA_KELAS';
        else if (hasOversizedOffering) status = 'TIDAK_FEASIBLE';
        else if (totalDistributed === group.totalParticipantsStep1) status = 'LENGKAP';
        else if (totalDistributed < group.totalParticipantsStep1) status = 'KURANG';
        else status = 'LEBIH';

        return {
          ...group,
          offerings: updatedOfferings,
          totalDistributed,
          remaining,
          totalSeatWaste,
          hasOversizedOffering,
          status,
        };
      })
    );
    toast.success('Bagi otomatis room-capacity aware diterapkan ke seluruh mata kuliah.');
  };

  // 7. Recalculate All Courses
  const handleRecalculateAll = () => {
    setHasUnsavedRombelChanges(true);
    setRombelGroups((prev) =>
      prev.map((group) => {
        // PRAKTIKUM EXCLUDED: Praktikum does not participate in room distribution
        if (group.offerings.length === 0 || isPracticum(group)) return group;

        const targets = group.offerings.map((o) => ({
          id: o.id,
          class_code: o.class_code,
          expectedStudents: 0,
          active: o.active,
        }));

        const distributed = distributeParticipantsWithRoomCapacity(
          group.totalParticipantsStep1,
          targets,
          group.eligibleCapacities,
          true
        );
        const distMap = new Map(distributed.map((d) => [d.offeringId, d]));

        const updatedOfferings = group.offerings.map((off) => {
          if (distMap.has(off.id)) {
            const distItem = distMap.get(off.id)!;
            return {
              ...off,
              currentParticipants: distItem.expectedStudents,
              targetRoomCapacity: distItem.targetRoomCapacity,
              seatWaste: distItem.seatWaste,
              isOversized: distItem.isOversized,
            };
          }
          return off;
        });

        const totalDistributed = updatedOfferings.reduce(
          (acc, o) => acc + (o.active ? o.currentParticipants : 0),
          0
        );
        const remaining = group.totalParticipantsStep1 - totalDistributed;
        const totalSeatWaste = updatedOfferings.reduce((acc, o) => acc + (o.seatWaste || 0), 0);
        const hasOversizedOffering = updatedOfferings.some((o) => o.active && o.isOversized);

        let status: 'LENGKAP' | 'KURANG' | 'LEBIH' | 'TIDAK_FEASIBLE' | 'TIDAK_ADA_KELAS';
        if (updatedOfferings.length === 0) status = 'TIDAK_ADA_KELAS';
        else if (hasOversizedOffering) status = 'TIDAK_FEASIBLE';
        else if (totalDistributed === group.totalParticipantsStep1) status = 'LENGKAP';
        else if (totalDistributed < group.totalParticipantsStep1) status = 'KURANG';
        else status = 'LEBIH';

        return {
          ...group,
          offerings: updatedOfferings,
          totalDistributed,
          remaining,
          totalSeatWaste,
          hasOversizedOffering,
          status,
        };
      })
    );
    toast.success('Seluruh pembagian rombel dihitung ulang merata.');
  };

  // 8. Save Rombel Distribution to Supabase
  const handleSaveRombel = async () => {
    const hasInfeasible = rombelGroups.some((g) => g.status === 'TIDAK_FEASIBLE');
    if (hasInfeasible) {
      toast.error('Ada kelas yang melebihi kapasitas ruang maksimal. Perbaiki sebelum menyimpan.');
      return;
    }

    setSavingRombel(true);
    try {
      await schedulingRombelService.saveRombelDistribution(rombelGroups);
      setHasUnsavedRombelChanges(false);
      toast.success('Pembagian rombel berhasil disimpan.');
      // Refetch to sync state
      await loadRombelData(plannedCourses);
    } catch (err: any) {
      console.error('Save rombel error:', err);
      toast.error('Gagal menyimpan pembagian rombel.');
    } finally {
      setSavingRombel(false);
    }
  };

  // 9. Continue to Step 3 (Validation check and activate Step 3)
  const handleContinueToStep3 = async () => {
    // PRAKTIKUM EXCLUDED: Praktikum does not participate in room or rombel distribution
    const invalidGroups = rombelGroups
      .filter((g) => !isPracticum(g))
      .filter((g) => g.status !== 'LENGKAP' && g.status !== 'TIDAK_ADA_KELAS');

    if (invalidGroups.length > 0) {
      const infeasible = invalidGroups.find((g) => g.status === 'TIDAK_FEASIBLE');
      if (infeasible) {
        toast.error('Ada kelas yang melebihi kapasitas ruang maksimal (Tidak Feasible).');
      } else {
        toast.error('Pastikan distribusi seluruh mata kuliah telah lengkap sebelum melanjutkan.');
      }
      return;
    }

    // Auto-save rombel distribution to database if dirty
    if (hasUnsavedRombelChanges) {
      try {
        await schedulingRombelService.saveRombelDistribution(rombelGroups);
        setHasUnsavedRombelChanges(false);
      } catch (err) {
        console.warn('Auto save before moving to step 3:', err);
      }
    }

    // 2. SIMPAN SCOPE JADWAL:
    // Kumpulkan semua course_offering_id yang:
    // - dipilih workflow
    // - expected_students > 0
    // - bukan praktikum
    // - bukan KKN
    try {
      const activeOfferingIds: string[] = [];
      for (const group of rombelGroups) {
        if (isPracticum(group.courseName) || isPracticum(group.courseCode)) continue;
        if (isKKN(group.courseName) || isKKN(group.courseCode)) continue;
        for (const off of group.offerings) {
          const students = off.currentParticipants || off.expected_students || 0;
          if (off.active !== false && students > 0) {
            activeOfferingIds.push(off.id);
          }
        }
      }

      if (activeOfferingIds.length > 0 && activeTerm?.id) {
        const draft = await ensureCurrentDraftVersion();
        const { data: newRevision, error: scopeErr } = await supabase.rpc('set_schedule_scope', {
          p_version_id: draft.id,
          p_expected_revision: draft.revision,
          p_offering_ids: activeOfferingIds,
        });

        if (scopeErr) {
          console.warn('set_schedule_scope RPC warning:', scopeErr);
        } else if (newRevision !== undefined && newRevision !== null) {
          const rev = typeof newRevision === 'number' ? newRevision : (newRevision as any).revision ?? draft.revision;
          setCurrentVersion((prev) =>
            prev ? { ...prev, revision: rev, scope_offering_ids: activeOfferingIds } : null
          );
        }
      }
    } catch (scopeErr) {
      console.warn('Warning setting schedule scope after Step 2:', scopeErr);
    }

    setActiveStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadStep3Data(rombelGroups);
  };

  // STEP 3 HANDLERS:
  // Back to Step 2
  const handleBackToStep2 = () => {
    setActiveStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync Step 3 from Master
  const handleSyncStep3FromMaster = async () => {
    setSyncingStep3(true);
    try {
      const res = await schedulingLecturersService.loadStep3Lecturers(rombelGroups);
      setStep3Data(res);
    } catch (err: any) {
      console.error('Sync step 3 error:', err);
      toast.error('Gagal menyinkronkan data dosen dari Master.');
    } finally {
      setSyncingStep3(false);
    }
  };

  // Handle selecting primary lecturer for an offering
  const handleSelectPrimaryLecturer = async (offeringId: string, lecturerId: string) => {
    await schedulingLecturersService.updatePrimaryLecturer(offeringId, lecturerId);

    setStep3Data((prev) => {
      if (!prev) return prev;
      const updatedRows = prev.rows.map((row) => {
        if (row.offeringId !== offeringId) return row;

        const newPrimary =
          row.candidates.find((c) => c.lecturerId === lecturerId) || row.primaryLecturer;
        const isNowValid =
          newPrimary !== null && !newPrimary.isLecturerInactive && !newPrimary.isLecturerMissing;

        return {
          ...row,
          primaryLecturer: newPrimary,
          primaryLecturerId: lecturerId,
          isManuallySelected: true,
          status: isNowValid ? ('SIAP' as const) : row.status,
          isValid: isNowValid,
        };
      });

      const isAllValid = updatedRows.length > 0 && updatedRows.every((r) => r.isValid);
      const totalWithPengampu = updatedRows.filter(
        (r) =>
          r.hasPengampu &&
          r.primaryLecturer &&
          !r.primaryLecturer.isLecturerInactive &&
          !r.primaryLecturer.isLecturerMissing
      ).length;
      const totalMissingPengampu = updatedRows.filter(
        (r) => !r.hasPengampu || !r.primaryLecturer || r.primaryLecturer.isLecturerMissing
      ).length;
      const totalInactiveLecturers = updatedRows.filter(
        (r) => r.primaryLecturer?.isLecturerInactive || r.hasInactiveLecturer
      ).length;

      // Update conflict maps for scheduler (strictly 1 primary lecturer per class)
      const offeringLecturerIdsMap = {
        ...prev.offeringLecturerIdsMap,
        [offeringId]: [lecturerId],
      };

      const targetRow = updatedRows.find((r) => r.offeringId === offeringId);
      const offeringLecturerRolesMap = {
        ...prev.offeringLecturerRolesMap,
        [offeringId]: [
          {
            lecturerId,
            assignmentRole: 'PENGAMPU',
            lecturerName: targetRow?.primaryLecturer?.lecturerName || '',
            lecturerCode: targetRow?.primaryLecturer?.lecturerCode || '',
          },
        ],
      };

      return {
        ...prev,
        rows: updatedRows,
        totalWithPengampu,
        totalMissingPengampu,
        totalInactiveLecturers,
        isAllValid,
        offeringLecturerIdsMap,
        offeringLecturerRolesMap,
      };
    });
  };

  // STEP 4 HANDLERS & LOADER:
  const loadStep4Data = useCallback(
    async (forceRegenerate: boolean = false) => {
      if (!activeTerm?.id) return;
      setLoadingStep4(true);
      try {
        const data = await schedulingInitialService.loadStep4Data(
          activeTerm.id,
          step3Data?.rows,
          rombelGroups
        );

        setStep4Rooms(data.rooms);
        setStep4Offerings(data.offerings);
        setStep4TimeSlots(data.timeSlots);
        setStep4Availabilities(data.availabilities);

        // Check if current draft version in database already has entries saved
        let loadedFromDb = false;
        const targetDraft = currentVersion || data.existingVersion;
        if (targetDraft?.id && !forceRegenerate) {
          try {
            const dbEntries = await schedulingOptimizationService.fetchVersionScheduleEntries(
              targetDraft.id,
              data.rooms,
              data.offerings
            );
            if (dbEntries.length > 0) {
              setStep4Entries(dbEntries);
              loadedFromDb = true;
            }
          } catch (dbErr) {
            console.warn('Could not load entries from DB draft:', dbErr);
          }
        }

        // Auto-synchronize scope_offering_ids on draft if not set yet
        if (targetDraft?.id && (!targetDraft.scope_offering_ids || targetDraft.scope_offering_ids.length === 0)) {
          const offeringIds = data.offerings.map((o) => o.id);
          if (offeringIds.length > 0) {
            try {
              const { data: newRev } = await supabase.rpc('set_schedule_scope', {
                p_version_id: targetDraft.id,
                p_expected_revision: targetDraft.revision,
                p_offering_ids: offeringIds,
              });
              if (newRev !== undefined && newRev !== null) {
                const rev = typeof newRev === 'number' ? newRev : (newRev as any).revision ?? targetDraft.revision;
                setCurrentVersion((prev) =>
                  prev ? { ...prev, revision: rev, scope_offering_ids: offeringIds } : null
                );
              }
            } catch (scopeErr) {
              console.warn('Auto set scope error in Step 4:', scopeErr);
            }
          }
        }

        if (!loadedFromDb) {
          // Check if there is already a cached schedule in localStorage
          let savedSchedule: {
            entries: InitialScheduleEntry[];
            conflicts: InitialScheduleConflict[];
            stats: InitialScheduleStats;
          } | null = null;

          if (!forceRegenerate && step4StorageKey) {
            try {
              const raw = localStorage.getItem(step4StorageKey);
              if (raw) savedSchedule = JSON.parse(raw);
            } catch (e) {
              console.warn('Failed to parse Step 4 draft from localStorage:', e);
            }
          }

          if (savedSchedule && savedSchedule.entries?.length > 0) {
            setStep4Entries(savedSchedule.entries);
            setStep4Conflicts(savedSchedule.conflicts || []);
            setStep4Stats(savedSchedule.stats);
          } else {
            // Generate fresh initial schedule
            const res = schedulingInitialService.generateInitialSchedule(
              data.offerings,
              data.rooms,
              data.timeSlots,
              data.availabilities
            );
            setStep4Entries(res.entries);
            setStep4Conflicts(res.conflicts);
            setStep4Stats(res.stats);

            if (step4StorageKey) {
              try {
                localStorage.setItem(step4StorageKey, JSON.stringify(res));
              } catch (e) {
                console.warn('Failed to save Step 4 draft to localStorage:', e);
              }
            }
          }
        }
      } catch (err: any) {
        console.error('Error loading Step 4 data:', err);
        toast.error('Gagal memuat data jadwal awal.');
      } finally {
        setLoadingStep4(false);
      }
    },
    [activeTerm?.id, step3Data?.rows, rombelGroups, step4StorageKey]
  );

  // Auto-load Step 4 data if (activeStep === 4 || activeStep === 5 || activeStep === 6) and entries are not yet loaded
  useEffect(() => {
    if (
      (activeStep === 4 || activeStep === 5 || activeStep === 6) &&
      step4Entries.length === 0 &&
      !loadingStep4 &&
      !hasAttemptedStep4Load &&
      activeTerm?.id
    ) {
      setHasAttemptedStep4Load(true);
      loadStep4Data();
    }
  }, [
    activeStep,
    step4Entries.length,
    loadingStep4,
    hasAttemptedStep4Load,
    activeTerm?.id,
    loadStep4Data,
  ]);

  const handleRegenerateStep4 = async () => {
    setGeneratingStep4(true);
    try {
      let offeringsToUse = step4Offerings;
      let roomsToUse = step4Rooms;
      let slotsToUse = step4TimeSlots;
      let availsToUse = step4Availabilities;

      if (offeringsToUse.length === 0 && activeTerm?.id) {
        const fresh = await schedulingInitialService.loadStep4Data(
          activeTerm.id,
          step3Data?.rows,
          rombelGroups
        );
        offeringsToUse = fresh.offerings;
        roomsToUse = fresh.rooms;
        slotsToUse = fresh.timeSlots;
        availsToUse = fresh.availabilities;
        setStep4Offerings(fresh.offerings);
        setStep4Rooms(fresh.rooms);
        setStep4TimeSlots(fresh.timeSlots);
        setStep4Availabilities(fresh.availabilities);
      }

      const res = schedulingInitialService.generateInitialSchedule(
        offeringsToUse,
        roomsToUse,
        slotsToUse,
        availsToUse
      );

      setStep4Entries(res.entries);
      setStep4Conflicts(res.conflicts);
      setStep4Stats(res.stats);

      if (step4StorageKey) {
        try {
          localStorage.setItem(step4StorageKey, JSON.stringify(res));
        } catch (e) {
          console.warn('Failed to save Step 4 draft to localStorage:', e);
        }
      }

      toast.success('Jadwal awal berhasil digenerate ulang.');
    } catch (err: any) {
      console.error('Regenerate step 4 error:', err);
      toast.error('Gagal menggenerate ulang jadwal awal.');
    } finally {
      setGeneratingStep4(false);
    }
  };

  const handleSaveStep4 = async () => {
    if (!activeTerm?.id || step4Entries.length === 0) return;
    setSavingStep4(true);
    try {
      const draft = await ensureCurrentDraftVersion();

      const res = await schedulingInitialService.saveInitialScheduleToSupabase(
        activeTerm.id,
        activeTerm.academic_year || '2026/2027',
        activeTerm.semester_type || selectedSemesterType,
        step4Entries,
        draft.id
      );

      setCurrentVersion(res.version);

      // Refetch entries from backend directly so step4Entries have real database IDs
      const backendEntries = await schedulingOptimizationService.fetchVersionScheduleEntries(
        res.version.id,
        step4Rooms,
        step4Offerings
      );
      if (backendEntries.length > 0) {
        setStep4Entries(backendEntries);
      }

      toast.success(`Jadwal awal berhasil disimpan (${res.savedCount} kelas).`);
    } catch (err: any) {
      console.error('Save step 4 error:', err);
      toast.error('Gagal menyimpan jadwal awal ke database.');
    } finally {
      setSavingStep4(false);
    }
  };

  const handleBackToStep3 = () => {
    setActiveStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Continue to Step 4 (Jadwal Awal)
  const handleContinueToStep4 = async () => {
    if (!step3Data?.isAllValid) {
      toast.error('Masih ada rombel yang belum memiliki dosen pengampu aktif.');
      return;
    }

    setActiveStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadStep4Data();
  };

  // Continue to Step 5 (Simulated Annealing Optimization)
  const handleContinueToStep5 = () => {
    if (step4Entries.length === 0) {
      toast.error('Belum ada jadwal awal yang digenerate.');
      return;
    }

    setActiveStep(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToStep4 = () => {
    setActiveStep(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 4. APPLY HASIL OPTIMASI (Step 5 -> Supabase DRAFT)
  const handleSaveStep5 = async (optimizedEntries: InitialScheduleEntry[]) => {
    if (!activeTerm?.id || optimizedEntries.length === 0) return;
    setSavingStep5(true);
    try {
      const draft = await ensureCurrentDraftVersion();

      // WAJIB memanggil save_draft_entries via service
      const res = await schedulingOptimizationService.saveOptimizedScheduleToSupabase(
        draft.id,
        draft.revision,
        optimizedEntries,
        'SIMULATED_ANNEALING'
      );

      // 5. SETELAH APPLY:
      // 1. refetch schedule_versions
      const updatedVersions = await scheduleVersionsService.getVersions(activeTerm.id);
      const latestDraft = updatedVersions.find((v) => v.id === draft.id) || res.version;
      setCurrentVersion(latestDraft);

      // 2. refetch schedule_entries
      const backendEntries = await schedulingOptimizationService.fetchVersionScheduleEntries(
        latestDraft.id,
        step4Rooms,
        step4Offerings
      );
      if (backendEntries.length > 0) {
        setStep4Entries(backendEntries);
      } else {
        setStep4Entries(optimizedEntries);
      }

      // 3. refresh_schedule_conflicts(currentVersion.id)
      await scheduleVersionsService.refreshConflicts(latestDraft.id);

      // 4. refetch schedule_conflicts
      const backendConflicts = await scheduleConflictsService.getConflicts(latestDraft.id, {
        isResolved: false,
      });
      setStep4Conflicts(
        backendConflicts.map((c) => ({
          id: c.id,
          type: (c.conflict_type === 'ROOM'
            ? 'ROOM_OVERLAP'
            : c.conflict_type === 'LECTURER'
            ? 'LECTURER_OVERLAP'
            : c.conflict_type === 'CAPACITY'
            ? 'CAPACITY_EXCEEDED'
            : 'ROOM_OVERLAP') as any,
          severity: (c.severity === 'KRITIS' || c.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH') as any,
          title: c.title,
          description: c.description,
          offeringIds: [c.conflict_source || ''],
        }))
      );

      toast.success(
        `Hasil optimasi berhasil disimpan ke draft database (${res.savedCount} kelas). Siap ditinjau pada Hasil Jadwal.`
      );
    } catch (err: any) {
      console.error('Save step 5 error:', err);
      toast.error('Gagal menyimpan hasil optimasi ke database.');
    } finally {
      setSavingStep5(false);
    }
  };

  const handleContinueToStep6 = (meta?: any) => {
    if (meta) {
      setOptimizationMeta(meta);
    }
    setActiveStep(6);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToStep5 = () => {
    setActiveStep(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const workflowStateSnapshot = useMemo(() => {
    return {
      activeStep: 6,
      completed: true,
      creationMode: scheduleCreationMode || 'TEMPLATE',
      academicTermId: activeTerm?.id,
      activeCurricula,
      selectedSemesterFilter,
      plannedCourses,
      participantInputs: participantInputMap,
      optimization: optimizationMeta
        ? {
            completed: true,
            seed: optimizationMeta.seed,
            bestCost: optimizationMeta.bestCost,
            bestConflicts: optimizationMeta.bestConflicts,
          }
        : null,
    };
  }, [
    scheduleCreationMode,
    activeTerm?.id,
    activeCurricula,
    selectedSemesterFilter,
    plannedCourses,
    participantInputMap,
    optimizationMeta,
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Page Header */}
      <SchedulingActiveHeader
        activeTerm={activeTerm}
        mode={scheduleCreationMode}
        currentVersion={currentVersion}
        onUpdateTitle={currentVersion ? handleUpdateVersionTitle : undefined}
        onClearSchedule={currentVersion && currentVersion.status === 'DRAFT' ? handleOpenClearSchedule : undefined}
        onDeleteDraft={currentVersion && currentVersion.status === 'DRAFT' ? handleOpenDeleteDraft : undefined}
        onResetWorkflow={scheduleCreationMode ? handleResetWorkflow : undefined}
        onOpenHistory={() => setIsHistoryDrawerOpen(true)}
      />

      {/* 2. Workflow 6-Step Progress Stepper (Only show during active workflow) */}
      {scheduleCreationMode && (
        <SchedulingStepper
          currentStep={activeStep}
          onStepClick={(step) => {
            if (step <= activeStep) {
              setActiveStep(step);
            }
          }}
        />
      )}

      {/* 3. Main Body */}
      {loading ? (
        /* Loading Skeleton */
        <div className="space-y-4 animate-pulse">
          <div className="h-20 bg-slate-200/70 rounded-2xl" />
          <div className="h-64 bg-slate-200/50 rounded-2xl" />
          <div className="h-64 bg-slate-200/50 rounded-2xl" />
        </div>
      ) : error ? (
        /* Error State */
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-rose-900">{error}</h3>
            <p className="text-xs text-rose-600 max-w-md mx-auto">
              Terjadi kendala saat menghubungkan ke database paket kurikulum. Pastikan koneksi dan tabel tersedia.
            </p>
          </div>
          <button
            type="button"
            onClick={loadInitialData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </button>
        </div>
      ) : !scheduleCreationMode ? (
        /* Empty / Landing State with Published Schedule Awareness */
        <SchedulingEmptyState
          onStartTemplate={handleStartTemplate}
          onStartManual={handleStartManual}
          onOpenHistory={() => setIsHistoryDrawerOpen(true)}
          latestPublishedVersion={latestPublishedVersion}
          publishedEntriesCount={publishedEntriesCount}
          onViewPublishedSchedule={() => navigate('/jadwal-perkuliahan')}
        />
      ) : activeStep === 1 ? (
        /* Step 1: Scheduling Template View */
        <>
          <SchedulingTemplateView
            packages={packages}
            categoryMap={categoryMap}
            selectedSemesterType={selectedSemesterType}
            onChangeSemesterType={setSelectedSemesterType}
            selectedSemesterFilter={selectedSemesterFilter}
            onChangeSemesterFilter={setSelectedSemesterFilter}
            activeCurricula={activeCurricula}
            onToggleCurriculum={handleToggleCurriculum}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            plannedCourses={plannedCourses}
            participantInputMap={participantInputMap}
            onToggleCourse={handleToggleCourse}
            onUpdateParticipants={handleUpdateParticipants}
            onSelectAllFromTemplate={handleSelectAllFromTemplate}
            onClearAll={handleClearAll}
            onSelectSemesterCourses={handleSelectSemesterCourses}
            onClearSemesterCourses={handleClearSemesterCourses}
            onTogglePackage={handleTogglePackage}
          />

          {/* Sticky Bottom Action Bar for Step 1 */}
          <SchedulingStickyBar
            selectedCount={plannedCourses.length}
            theoryCount={theoryCoursesCount}
            practicumCount={practicumCoursesCount}
            totalParticipants={totalParticipantsSum}
            hasInvalidParticipants={hasInvalidParticipants}
            onContinue={handleContinueToStep2}
          />
        </>
      ) : activeStep === 2 ? (
        /* Step 2: Scheduling Rombel View */
        loadingRombel ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-28 bg-slate-200/70 rounded-2xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
            </div>
            <div className="h-64 bg-slate-200/50 rounded-2xl" />
          </div>
        ) : (
          <SchedulingRombelView
            groups={rombelGroups}
            selectedSemesterType={selectedSemesterType}
            selectedSemesterFilter={selectedSemesterFilter}
            onChangeSemesterFilter={setSelectedSemesterFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onToggleOfferingActive={handleToggleOfferingActive}
            onUpdateOfferingParticipants={handleUpdateOfferingParticipants}
            onSelectSectionCount={handleSelectSectionCount}
            onAutoDistributeCourse={handleAutoDistributeCourse}
            onRecalculateCourse={handleRecalculateCourse}
            onAutoDistributeAll={handleAutoDistributeAll}
            onRecalculateAll={handleRecalculateAll}
            saving={savingRombel}
            hasUnsavedChanges={hasUnsavedRombelChanges}
            onSaveRombel={handleSaveRombel}
            onBackToStep1={handleBackToStep1}
            onContinueToStep3={handleContinueToStep3}
          />
        )
      ) : activeStep === 3 ? (
        /* Step 3: Scheduling Lecturers View */
        loadingStep3 ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-28 bg-slate-200/70 rounded-2xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
            </div>
            <div className="h-64 bg-slate-200/50 rounded-2xl" />
          </div>
        ) : (
          <SchedulingLecturersView
            rows={step3Data?.rows || []}
            totalActiveOfferings={step3Data?.totalActiveOfferings || 0}
            totalWithPengampu={step3Data?.totalWithPengampu || 0}
            totalMultiCandidate={step3Data?.totalMultiCandidate || 0}
            totalTeamTeaching={step3Data?.totalTeamTeaching || 0}
            totalMissingPengampu={step3Data?.totalMissingPengampu || 0}
            totalInactiveLecturers={step3Data?.totalInactiveLecturers || 0}
            isAllValid={Boolean(step3Data?.isAllValid)}
            selectedSemesterType={selectedSemesterType}
            syncing={syncingStep3}
            onSyncFromMaster={handleSyncStep3FromMaster}
            onSelectPrimaryLecturer={handleSelectPrimaryLecturer}
            onBackToStep2={handleBackToStep2}
            onContinueToStep4={handleContinueToStep4}
          />
        )
      ) : activeStep === 4 ? (
        /* Step 4: Scheduling Initial Schedule View */
        loadingStep4 ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-28 bg-slate-200/70 rounded-2xl" />
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
              <div className="h-24 bg-slate-200/50 rounded-2xl" />
            </div>
            <div className="h-64 bg-slate-200/50 rounded-2xl" />
          </div>
        ) : (
          <SchedulingInitialScheduleView
            entries={step4Entries}
            conflicts={step4Conflicts}
            stats={step4Stats}
            rooms={step4Rooms}
            selectedSemesterType={selectedSemesterType}
            generating={generatingStep4}
            saving={savingStep4}
            onRegenerate={handleRegenerateStep4}
            onSaveInitialSchedule={handleSaveStep4}
            onBackToStep3={handleBackToStep3}
            onContinueToStep5={handleContinueToStep5}
          />
        )
      ) : activeStep === 5 ? (
        /* Step 5: Scheduling Simulated Annealing View */
        <SchedulingSimulatedAnnealingView
          entries={step4Entries}
          rooms={step4Rooms}
          timeSlots={step4TimeSlots}
          availabilities={step4Availabilities}
          selectedSemesterType={selectedSemesterType}
          onBackToStep4={handleBackToStep4}
          onContinueToStep6={handleContinueToStep6}
          onSaveOptimizedSchedule={handleSaveStep5}
          saving={savingStep5}
        />
      ) : activeStep === 6 ? (
        /* Step 6: Preview & Publikasi */
        <SchedulingPreviewPublishView
          entries={step4Entries}
          allOfferings={step4Offerings}
          rooms={step4Rooms}
          timeSlots={step4TimeSlots}
          availabilities={step4Availabilities}
          activeTerm={activeTerm}
          selectedSemesterType={selectedSemesterType}
          onBackToStep4={handleBackToStep4}
          onBackToStep5={handleBackToStep5}
          onRefreshEntries={loadStep4Data}
          optimizationMeta={optimizationMeta}
          currentVersion={currentVersion}
          onUpdateVersion={setCurrentVersion}
          onPublishSuccess={handlePublishSuccess}
          workflowStateSnapshot={workflowStateSnapshot}
        />
      ) : (
        /* Fallback */
        <div className="p-8 text-center text-slate-500">Tahap tidak ditemukan</div>
      )}

      {/* 4. Version History Drawer */}
      <VersionHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        versions={allVersionsList}
        selectedVersionId={currentVersion?.id || ''}
        onSelectVersion={handleSelectDraftFromHistory}
        onRestoreVersion={handleRestoreVersionFromHistory}
        onVersionCreated={(newVer) => {
          setAllVersionsList((prev) => [newVer, ...prev.filter((v) => v.id !== newVer.id)]);
          handleSelectDraftFromHistory(newVer.id);
        }}
        onOpenComparison={(vA, vB) => {
          setCompareVersionAId(vA);
          setCompareVersionBId(vB);
          setCompareModalOpen(true);
        }}
        termId={activeTerm?.id || ''}
      />

      {/* 5. Version Comparison Modal */}
      {compareModalOpen && (
        <VersionComparisonModal
          isOpen={compareModalOpen}
          onClose={() => setCompareModalOpen(false)}
          initialVersionAId={compareVersionAId}
          initialVersionBId={compareVersionBId}
          versions={allVersionsList}
        />
      )}

      {/* 6. Action Confirmation Modal (Clear & Delete Draft) */}
      <ScheduleActionConfirmDialog
        dialogState={actionDialog}
        onClose={() => {
          if (!actionProcessing) setActionDialog({ type: null, version: null });
        }}
        onConfirm={handleConfirmActionDialog}
        isProcessing={actionProcessing}
      />
    </div>
  );
};

