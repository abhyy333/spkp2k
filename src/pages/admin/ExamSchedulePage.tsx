import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarCheck,
  Calendar,
  Clock,
  DoorClosed,
  Users,
  AlertTriangle,
  Download,
  Sparkles,
  History,
  Search,
  Filter,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  BookOpen,
  ChevronRight,
  Eye,
  Plus,
  Printer,
  Loader2,
  FileText,
  EyeOff,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { toast } from '../../components/ui/Toast';
import { DocumentExportModal } from '../../components/documents/DocumentExportModal';
import { generateExamSchedulePDF } from '../../lib/pdf/pdfGenerator';
import { ClearActiveScheduleModal } from '../../components/admin/settings/ClearActiveScheduleModal';

import { useAuth } from '../../contexts/AuthContext';
import { useAcademicTerm } from '../../contexts/AcademicTermContext';

import {
  CurrentPublishedExam,
  ExamSession,
  Room,
  Lecturer,
  CourseOffering,
  Course,
  ScheduleVersion,
  ExamWorkflowConfig,
  ExamSourceOffering,
} from '../../types';

import { examsService } from '../../services/exams.service';
import { roomsService } from '../../services/rooms.service';
import { lecturersService } from '../../services/lecturers.service';
import { courseOfferingsService } from '../../services/courseOfferings.service';
import {
  generateExamSchedule,
  allocateRoomsForExam,
  validateExamSlots,
  mapDbEntriesToSlots,
  ExamGenerationResult,
  GeneratedExamSlot,
} from '../../services/examGenerator.service';

import { ExamHistoryModal } from '../../components/exam/ExamHistoryModal';
import { ExamStepper } from '../../components/exam/workflow/ExamStepper';
import { ExamActiveHeader } from '../../components/exam/workflow/ExamActiveHeader';
import { ExamStep1Config } from '../../components/exam/workflow/ExamStep1Config';
import { ExamStep2Courses } from '../../components/exam/workflow/ExamStep2Courses';
import { ExamStep3SupervisorsRooms } from '../../components/exam/workflow/ExamStep3SupervisorsRooms';
import { ExamStep4GenerateMatrix } from '../../components/exam/workflow/ExamStep4GenerateMatrix';
import { ExamStep5PreviewPublish } from '../../components/exam/workflow/ExamStep5PreviewPublish';

import { formatDateIndo, minuteToTime } from '../../lib/utils';

export const ExamSchedulePage: React.FC = () => {
  const { role, user, isOwnerAdmin, effectiveAccessMode } = useAuth();
  const { activeTerm } = useAcademicTerm();

  const isGuest = effectiveAccessMode === 'GUEST';
  const isAdmin = !isGuest && (role === 'ADMIN' || isOwnerAdmin);

  // Mode: 'VIEWER' | 'WORKFLOW'
  const [mode, setMode] = useState<'VIEWER' | 'WORKFLOW'>('VIEWER');
  const [examType, setExamType] = useState<'UTS' | 'UAS'>('UTS');

  // Guard: If in Guest mode, always force VIEWER mode
  useEffect(() => {
    if (isGuest && mode !== 'VIEWER') {
      setMode('VIEWER');
    }
  }, [isGuest, mode]);

  // Modals state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Published Viewer States
  const [publishedExams, setPublishedExams] = useState<CurrentPublishedExam[]>([]);
  const [publishedVersions, setPublishedVersions] = useState<ScheduleVersion[]>([]);
  const [loadingPublished, setLoadingPublished] = useState(true);
  const [publishedError, setPublishedError] = useState<string | null>(null);

  // Filters for Published Viewer
  const [viewerSearch, setViewerSearch] = useState('');
  const [viewerDateFilter, setViewerDateFilter] = useState('ALL');
  const [viewerSemesterFilter, setViewerSemesterFilter] = useState('ALL');
  const [viewerOnlyMySupervision, setViewerOnlyMySupervision] = useState(false);

  // Export & Print modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Filter description for exam export
  const filterDescription = useMemo(() => {
    const parts: string[] = [];
    if (viewerDateFilter !== 'ALL') parts.push(`Tanggal ${formatDateIndo(viewerDateFilter)}`);
    if (viewerSemesterFilter !== 'ALL') parts.push(`Semester ${viewerSemesterFilter}`);
    if (viewerSearch.trim()) parts.push(`Cari "${viewerSearch.trim()}"`);
    if (viewerOnlyMySupervision) parts.push('Pengawasan Saya');
    return parts.join(' • ');
  }, [viewerDateFilter, viewerSemesterFilter, viewerSearch, viewerOnlyMySupervision]);

  const handleQuickDownloadPDF = async () => {
    if (publishedExams.length === 0) {
      toast.error(`Jadwal ${examType} belum diterbitkan.`);
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const hasActiveFilter = filterDescription.length > 0;
      const dataToExport = hasActiveFilter ? filteredPublishedExams : publishedExams;

      await generateExamSchedulePDF(dataToExport, activeTerm, examType, {
        scope: hasActiveFilter ? 'FILTERED' : 'ALL',
        filterDescription: hasActiveFilter ? filterDescription : undefined,
      });
      toast.success(`File PDF resmi Jadwal ${examType} berhasil diunduh.`);
    } catch (err: any) {
      console.error('Download Exam PDF error:', err);
      toast.error('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Workflow States
  const [activeStep, setActiveStep] = useState(1);
  const [currentDraftVersion, setCurrentDraftVersion] = useState<ScheduleVersion | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Step 1: Config
  const [workflowConfig, setWorkflowConfig] = useState<ExamWorkflowConfig>({
    examType: 'UTS',
    startDate: '',
    endDate: '',
    allowedDays: [1, 2, 3, 4, 5],
    defaultDurationMinutes: 90,
    selectedSessionIds: [],
  });

  // Step 2: Source Offerings from Published Lecture Schedule
  const [sourceOfferings, setSourceOfferings] = useState<ExamSourceOffering[]>([]);
  const [loadingSourceOfferings, setLoadingSourceOfferings] = useState(false);

  // Step 3: Supervisors & Room Preferences
  const [supervisorAssignments, setSupervisorAssignments] = useState<
    Record<string, { primaryId: string; secondaryId?: string }>
  >({});
  const [roomPreferences, setRoomPreferences] = useState<Record<string, string[]>>({});

  // Step 4: Generation Result
  const [generationResult, setGenerationResult] = useState<ExamGenerationResult | null>(null);

  // Master Data Resources for Workflow
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // LocalStorage Key for Draft Persistence
  const storageKey = useMemo(() => {
    if (!activeTerm?.id) return null;
    return `spk:exam-workflow:${user?.id || 'anon'}:${workflowConfig.examType}:${activeTerm.id}`;
  }, [activeTerm?.id, user?.id, workflowConfig.examType]);

  // ========================================================
  // LOAD MASTER DATA & SESSIONS (SYNC FROM TIME_SLOTS)
  // ========================================================

  const loadSessions = useCallback(async () => {
    if (!activeTerm?.id) return;
    try {
      // Sync from lecture time slots to guarantee exact match
      const data = await examsService.syncExamSessionsFromTimeSlots(activeTerm.id);
      setSessions(data);
    } catch (err) {
      console.warn('Failed to sync/load exam sessions:', err);
      const fallback = await examsService.getExamSessions();
      setSessions(fallback);
    }
  }, [activeTerm?.id]);

  const loadResources = useCallback(async () => {
    if (!activeTerm?.id) return;
    setLoadingResources(true);
    try {
      const [roomsData, lecturersData] = await Promise.all([
        roomsService.getRooms(),
        lecturersService.getLecturers(),
      ]);

      setRooms(roomsData);
      setLecturers(lecturersData);
    } catch (err: any) {
      console.error('Error loading workflow resources:', err);
    } finally {
      setLoadingResources(false);
    }
  }, [activeTerm?.id]);

  // ========================================================
  // LOAD SOURCE OFFERINGS FROM PUBLISHED LECTURE SCHEDULE
  // ========================================================

  const loadWorkflowOfferings = useCallback(
    async (versionId: string, currentRev: number) => {
      if (!versionId) return;
      setLoadingSourceOfferings(true);
      try {
        // 1. Sync scope from published lecture schedule
        const scopeResult = await examsService.syncExamScopeFromPublishedLecture(
          versionId,
          currentRev
        );
        if (scopeResult?.revision) {
          setCurrentDraftVersion((prev) =>
            prev ? { ...prev, revision: scopeResult.revision } : prev
          );
        }

        // 2. Fetch source offerings
        const list = await examsService.getExamSourceOfferings(versionId);
        setSourceOfferings(list);

        // 3. Pre-populate supervisor assignments (Primary lecturer + distinct Secondary lecturer)
        const currentLecturers = await lecturersService.getLecturers();
        setSupervisorAssignments((prev) => {
          const next = { ...prev };
          const activeLecs = currentLecturers.filter((l: any) => l.is_active !== false && l.status !== 'INACTIVE');
          list.forEach((item, idx) => {
            if (!next[item.course_offering_id]) {
              const eligibleSecondaries = activeLecs.filter(
                (l) => l.id !== item.primary_lecturer_id
              );
              const secondary =
                eligibleSecondaries.length > 0
                  ? eligibleSecondaries[idx % eligibleSecondaries.length].id
                  : item.primary_lecturer_id;

              next[item.course_offering_id] = {
                primaryId: item.primary_lecturer_id,
                secondaryId: secondary,
              };
            }
          });
          return next;
        });

        // 4. Pre-populate room preferences from lecture schedule
        setRoomPreferences((prev) => {
          const next = { ...prev };
          list.forEach((item) => {
            if (!next[item.course_offering_id] && item.preferred_room_id) {
              next[item.course_offering_id] = [item.preferred_room_id];
            }
          });
          return next;
        });
      } catch (err: any) {
        console.error('Error loading exam source offerings:', err);
        toast.error(err.message || 'Gagal memuat mata kuliah ujian dari jadwal perkuliahan.');
      } finally {
        setLoadingSourceOfferings(false);
      }
    },
    []
  );

  // ========================================================
  // LOAD PUBLISHED EXAMS & VERSIONS
  // ========================================================

  const loadPublishedData = useCallback(async () => {
    if (!activeTerm?.id) return;
    setLoadingPublished(true);
    setPublishedError(null);
    try {
      if (isGuest) {
        const examsList = await examsService.getPublishedExams(activeTerm.id, examType);
        setPublishedExams(examsList);
        setPublishedVersions([]);
      } else {
        const [examsList, versionsList] = await Promise.all([
          examsService.getPublishedExams(activeTerm.id, examType),
          examsService.getExamVersions(activeTerm.id, examType).catch(() => []),
        ]);

        setPublishedExams(examsList);
        setPublishedVersions(versionsList);
      }
    } catch (err: any) {
      console.warn('Notice loading published exams:', err);
      setPublishedExams([]);
    } finally {
      setLoadingPublished(false);
    }
  }, [activeTerm?.id, examType, isGuest]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadPublishedData();
  }, [loadPublishedData]);

  // ========================================================
  // WORKFLOW LIFECYCLE & DRAFT RESTORATION
  // ========================================================

  // Check and restore existing DRAFT from database
  const restoreActiveDraftIfExists = useCallback(
    async (type: 'UTS' | 'UAS'): Promise<ScheduleVersion | null> => {
      if (!activeTerm?.id) return null;
      try {
        const versions = await examsService.getExamVersions(activeTerm.id, type);
        const draft = versions.find((v) => v.status === 'DRAFT');
        if (!draft) return null;

        setCurrentDraftVersion(draft);
        await loadResources();
        await loadSessions();

        // Load source offerings
        const list = await examsService.getExamSourceOfferings(draft.id);
        setSourceOfferings(list);

        // Fetch existing database entries for this draft
        const dbEntries = await examsService.getExamEntriesByVersion(draft.id);
        if (dbEntries.length > 0) {
          const currentRooms = await roomsService.getRooms();
          const currentLecturers = await lecturersService.getLecturers();
          const currentSessions = await examsService.getExamSessions();

          const dbSlots = mapDbEntriesToSlots(
            dbEntries,
            list,
            currentSessions,
            currentRooms,
            currentLecturers
          );

          const draftPayload = dbSlots.map((s) => ({
            course_offering_id: s.courseOfferingId,
            exam_session_id: s.sessionId,
            exam_date: s.examDate,
            duration_minutes: s.durationMinutes,
            room_ids: s.roomIds,
            supervisor_ids: s.supervisorIds.slice(0, 2),
            notes: null,
          }));

          const usedRooms = new Set(dbSlots.flatMap((s) => s.roomIds));
          const usedSupervisors = new Set(dbSlots.flatMap((s) => s.supervisorIds));

          setGenerationResult({
            slots: dbSlots,
            unscheduled: [],
            draftEntriesPayload: draftPayload,
            summary: {
              totalExams: list.length || dbSlots.length,
              scheduledExams: dbSlots.length,
              unscheduledExams: 0,
              conflictCount: dbSlots.filter((s) => s.isConflict).length,
              roomsUsedCount: usedRooms.size,
              supervisorsUsedCount: usedSupervisors.size,
            },
          });
        }

        return draft;
      } catch (err) {
        console.warn('Error checking/restoring active draft:', err);
        return null;
      }
    },
    [activeTerm?.id, loadResources, loadSessions]
  );

  // Start or resume a scheduling workflow (NEVER creates duplicates)
  const handleStartWorkflow = async (type: 'UTS' | 'UAS', copyFromId?: string) => {
    if (!activeTerm?.id) {
      toast.error('Periode akademik aktif belum ditemukan.');
      return;
    }

    await loadResources();
    await loadSessions();

    // 1. First check if an active DRAFT already exists in Supabase
    const existingDraft = await restoreActiveDraftIfExists(type);

    if (existingDraft) {
      setCurrentDraftVersion(existingDraft);
      setMode('WORKFLOW');
      const dbEntries = await examsService.getExamEntriesByVersion(existingDraft.id);
      if (dbEntries.length > 0) {
        setActiveStep(4);
      } else {
        setActiveStep(1);
      }
      toast.info(`Melanjutkan Draf Jadwal ${type} (${existingDraft.title || 'Aktif'}).`);
      return;
    }

    // 2. ONLY if NO draft active exists, create a new schedule version draft
    const today = new Date();
    const startDefault = new Date(today);
    startDefault.setDate(today.getDate() + 7);
    const endDefault = new Date(startDefault);
    endDefault.setDate(startDefault.getDate() + 12);

    const startStr = startDefault.toISOString().split('T')[0];
    const endStr = endDefault.toISOString().split('T')[0];

    setWorkflowConfig({
      examType: type,
      startDate: startStr,
      endDate: endStr,
      allowedDays: [1, 2, 3, 4, 5],
      defaultDurationMinutes: 90,
      selectedSessionIds: [],
    });

    try {
      const termLabel = activeTerm.academic_year || activeTerm.year || '';
      const draft = await examsService.createExamDraft(
        activeTerm.id,
        type,
        `Jadwal ${type} ${termLabel}`,
        copyFromId || null
      );

      setCurrentDraftVersion(draft);
      setActiveStep(1);
      setMode('WORKFLOW');

      await loadWorkflowOfferings(draft.id, draft.revision);
      toast.success(`Draf alur ${type} berhasil disiapkan.`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai penyusunan jadwal ujian.');
    }
  };

  // Auto allocate rooms for all source offerings
  const handleAutoAllocateAllRooms = () => {
    const newPrefs: Record<string, string[]> = {};
    sourceOfferings.forEach((offering) => {
      const students = offering.student_count || 40;
      const prefIds = offering.preferred_room_id ? [offering.preferred_room_id] : undefined;
      const alloc = allocateRoomsForExam(
        students,
        rooms,
        prefIds,
        offering.required_room_type
      );
      newPrefs[offering.course_offering_id] = alloc ? alloc.roomIds : [];
    });
    setRoomPreferences(newPrefs);
    toast.success('Kombinasi ruangan optimal berhasil dialokasikan untuk seluruh mata kuliah.');
  };

  // Run initial generator in Step 4
  const handleRunGenerator = () => {
    const result = generateExamSchedule({
      examType: workflowConfig.examType,
      startDate: workflowConfig.startDate,
      endDate: workflowConfig.endDate,
      allowedDays: workflowConfig.allowedDays,
      defaultDurationMinutes: workflowConfig.defaultDurationMinutes,
      sessions,
      offerings: sourceOfferings,
      rooms,
      lecturers,
      supervisorAssignments,
      roomPreferences,
    });

    setGenerationResult(result);
    if (result.summary.conflictCount === 0) {
      toast.success(`Matriks ${workflowConfig.examType} berhasil digenerate bebas bentrok!`);
    } else {
      toast.info(
        `Matriks ${workflowConfig.examType} digenerate dengan ${result.summary.conflictCount} potensi bentrok.`
      );
    }
  };

  // Save Draft RPC to Supabase (Source of Truth)
  const handleSaveDraft = async (): Promise<boolean> => {
    if (!currentDraftVersion?.id || !generationResult) return false;

    setIsSavingDraft(true);
    try {
      // Fetch fresh version to guarantee latest expected revision
      const fresh = await examsService.getVersionById(currentDraftVersion.id);
      const expectedRev = fresh?.revision ?? currentDraftVersion.revision;

      const res = await examsService.saveExamDraftEntries(
        currentDraftVersion.id,
        expectedRev,
        generationResult.draftEntriesPayload,
        `Penyusunan jadwal ${workflowConfig.examType}`
      );

      if (res.version) {
        setCurrentDraftVersion(res.version);
      } else if (res.revision) {
        setCurrentDraftVersion((prev) => (prev ? { ...prev, revision: res.revision } : prev));
      }

      // Refetch exam_entries directly from Supabase (Source of Truth)
      const dbEntries = await examsService.getExamEntriesByVersion(currentDraftVersion.id);
      if (dbEntries.length > 0 && sourceOfferings.length > 0) {
        const refreshedSlots = mapDbEntriesToSlots(
          dbEntries,
          sourceOfferings,
          sessions,
          rooms,
          lecturers
        );

        const draftPayload = refreshedSlots.map((s) => ({
          course_offering_id: s.courseOfferingId,
          exam_session_id: s.sessionId,
          exam_date: s.examDate,
          duration_minutes: s.durationMinutes,
          room_ids: s.roomIds,
          supervisor_ids: s.supervisorIds.slice(0, 2),
          notes: null,
        }));

        const usedRooms = new Set(refreshedSlots.flatMap((s) => s.roomIds));
        const usedSupervisors = new Set(refreshedSlots.flatMap((s) => s.supervisorIds));

        setGenerationResult({
          slots: refreshedSlots,
          unscheduled: [],
          draftEntriesPayload: draftPayload,
          summary: {
            totalExams: sourceOfferings.length,
            scheduledExams: refreshedSlots.length,
            unscheduledExams: 0,
            conflictCount: refreshedSlots.filter((s) => s.isConflict).length,
            roomsUsedCount: usedRooms.size,
            supervisorsUsedCount: usedSupervisors.size,
          },
        });
      }

      toast.success('Draf entri jadwal ujian berhasil disimpan ke database.');
      return true;
    } catch (err: any) {
      console.error('Error save_exam_draft_entries:', err);
      toast.error(err.message || 'Gagal menyimpan draf ujian.');
      return false;
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Proceed from Step 4 (Generate) to Step 5 (Preview) with Database Source of Truth
  const handleProceedToPreview = async () => {
    if (!currentDraftVersion?.id || !generationResult) {
      toast.error('Belum ada matriks jadwal yang digenerate.');
      return;
    }

    // 1. Save entries to Supabase first via RPC
    const saveSuccess = await handleSaveDraft();
    if (!saveSuccess) {
      // SAVE FAILURE: JANGAN lanjut ke Preview seolah berhasil!
      toast.error('Gagal menyimpan draf ke database. Tetap berada pada tahap Generate.');
      return;
    }

    // 2. Refetch database exam_entries to confirm database source of truth
    const dbEntries = await examsService.getExamEntriesByVersion(currentDraftVersion.id);
    const expectedCount = sourceOfferings.length;

    // PREVIEW GUARD: saved entries in Supabase must exist
    if (dbEntries.length === 0) {
      toast.error('Jumlah entri tersimpan di database adalah 0. Preview tidak dapat ditampilkan.');
      return;
    }

    // 3. Render final preview from database results
    const dbSlots = mapDbEntriesToSlots(
      dbEntries,
      sourceOfferings,
      sessions,
      rooms,
      lecturers
    );

    setGenerationResult((prev) =>
      prev
        ? {
            ...prev,
            slots: dbSlots,
            summary: {
              ...prev.summary,
              conflictCount: dbSlots.filter((s) => s.isConflict).length,
            },
          }
        : prev
    );

    setActiveStep(5);
  };

  // Publish Schedule RPC (Guarded strictly by database state)
  const handlePublish = async () => {
    if (isPublishing) return;
    if (!currentDraftVersion?.id) return;

    setIsPublishing(true);
    try {
      // 1. Refetch current schedule_version directly from Supabase
      const freshVersion = await examsService.getVersionById(currentDraftVersion.id);

      if (!freshVersion) {
        throw new Error('Draf jadwal ujian tidak ditemukan di database.');
      }

      if (freshVersion.status === 'PUBLISHED') {
        if (storageKey) localStorage.removeItem(storageKey);
        setCurrentDraftVersion(null);
        setGenerationResult(null);
        setMode('VIEWER');
        toast.success(`Jadwal ${workflowConfig.examType} resmi berhasil dipublikasikan.`);
        await loadPublishedData();
        return;
      }

      if (freshVersion.status !== 'DRAFT') {
        throw new Error('Hanya draf jadwal ujian yang dapat diterbitkan.');
      }

      // 2. Refetch current exam entries directly from Supabase
      const dbEntries = await examsService.getExamEntriesByVersion(freshVersion.id);
      const expectedScopeCount = sourceOfferings.length;

      // PUBLISH GUARD 1: Scope count > 0 & exam_entries count == scope count
      if (expectedScopeCount === 0) {
        throw new Error('Lingkup mata kuliah ujian kosong.');
      }

      if (dbEntries.length !== expectedScopeCount) {
        throw new Error(
          `Jumlah entri tersimpan (${dbEntries.length}) belum sesuai dengan jumlah mata kuliah (${expectedScopeCount}). Silakan simpan draf kembali.`
        );
      }

      // PUBLISH GUARD 2: Validation conflict count == 0
      const dbSlots = mapDbEntriesToSlots(
        dbEntries,
        sourceOfferings,
        sessions,
        rooms,
        lecturers
      );
      const conflictCount = dbSlots.filter((s) => s.isConflict).length;

      if (conflictCount > 0) {
        throw new Error(
          `Jadwal tidak dapat diterbitkan karena masih terdapat ${conflictCount} bentrok. Selesaikan seluruh bentrok terlebih dahulu.`
        );
      }

      let revisionToPublish = freshVersion.revision;

      // 3. Publish schedule version once with the exact updated revision
      const published = await examsService.publishExamVersion(
        freshVersion.id,
        revisionToPublish
      );

      // 4. Reset workflow state & navigate to official viewer
      if (storageKey) localStorage.removeItem(storageKey);
      setCurrentDraftVersion(null);
      setGenerationResult(null);
      setMode('VIEWER');

      toast.success(`Jadwal ${workflowConfig.examType} resmi berhasil dipublikasikan!`);
      await loadPublishedData();
    } catch (err: any) {
      console.error('Publish exam schedule failed:', err);

      // Double-check if version was published despite network timeout
      try {
        const check = await examsService.getVersionById(currentDraftVersion.id);
        if (check && check.status === 'PUBLISHED') {
          if (storageKey) localStorage.removeItem(storageKey);
          setCurrentDraftVersion(null);
          setGenerationResult(null);
          setMode('VIEWER');
          toast.success(`Jadwal ${workflowConfig.examType} resmi berhasil dipublikasikan!`);
          await loadPublishedData();
          return;
        } else if (check) {
          setCurrentDraftVersion(check);
        }
      } catch (checkErr) {
        console.warn('Double check error:', checkErr);
      }

      const msg = err.message || '';
      if (msg.includes('STALE_REVISION')) {
        toast.error('Data jadwal telah berubah. Silakan tekan Terbitkan kembali.');
      } else {
        toast.error(err.message || 'Gagal menerbitkan jadwal ujian.');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // Exit workflow safely
  const handleExitWorkflow = () => {
    if (window.confirm('Keluar dari alur penyusunan jadwal ujian? Draf yang sudah tersimpan tetap aman.')) {
      setMode('VIEWER');
    }
  };

  // Filtered Published Exams
  const filteredPublishedExams = useMemo(() => {
    return publishedExams.filter((item) => {
      const cName = (item.course_name || '').toLowerCase();
      const cCode = (item.course_code || '').toLowerCase();
      const date = item.date || item.exam_date || '';

      if (
        viewerSearch &&
        !cName.includes(viewerSearch.toLowerCase()) &&
        !cCode.includes(viewerSearch.toLowerCase())
      ) {
        return false;
      }

      if (viewerDateFilter !== 'ALL' && date !== viewerDateFilter) {
        return false;
      }

      if (viewerSemesterFilter !== 'ALL' && String(item.semester || '') !== viewerSemesterFilter) {
        return false;
      }

      if (viewerOnlyMySupervision && user) {
        const userEmail = (user.email || '').toLowerCase();
        const proctors = (item.proctor_names || '').toLowerCase();
        if (!proctors.includes(userEmail)) return false;
      }

      return true;
    });
  }, [
    publishedExams,
    viewerSearch,
    viewerDateFilter,
    viewerSemesterFilter,
    viewerOnlyMySupervision,
    user,
  ]);

  // Unique published dates for filter dropdown
  const publishedDates = useMemo(() => {
    return Array.from(new Set(publishedExams.map((e) => e.date || e.exam_date || ''))).filter(
      Boolean
    );
  }, [publishedExams]);

  // Published status summary
  const latestPublished = publishedVersions.find((v) => v.status === 'PUBLISHED');
  const isUtsPublished = publishedVersions.some((v) => v.type === 'UTS' && v.status === 'PUBLISHED');
  const isUasPublished = publishedVersions.some((v) => v.type === 'UAS' && v.status === 'PUBLISHED');

  return (
    <div className="space-y-6">
      {/* ========================================================
          MODE 1: PUBLISHED VIEWER & LANDING
         ======================================================== */}
      {mode === 'VIEWER' && (
        <>
          <PageHeader
            title="Jadwal Ujian"
            subtitle={
              isGuest
                ? "Jadwal resmi Ujian Tengah Semester dan Ujian Akhir Semester Teknik Elektro Universitas Mataram."
                : "Kelola penyusunan dan publikasi jadwal Ujian Tengah Semester dan Ujian Akhir Semester."
            }
            actions={
              <div className="flex items-center gap-2">
                {isAdmin && !isGuest && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-colors shadow-2xs cursor-pointer"
                    >
                      <History className="w-4 h-4 text-purple-600" />
                      Riwayat Versi
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartWorkflow(examType)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      Susun Jadwal {examType}
                    </button>

                    {/* Tarik Jadwal (Admin Only) */}
                    {publishedExams.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowClearModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
                        title={`Tarik jadwal resmi ${examType} yang sedang aktif`}
                      >
                        <EyeOff className="w-4 h-4 text-rose-600" />
                        <span>Tarik Jadwal</span>
                      </button>
                    )}
                  </>
                )}

                {/* Unduh PDF Resmi */}
                <button
                  type="button"
                  disabled={isGeneratingPDF || publishedExams.length === 0}
                  onClick={handleQuickDownloadPDF}
                  title={publishedExams.length === 0 ? `Jadwal ${examType} belum diterbitkan.` : `Unduh PDF Jadwal ${examType} Resmi`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingPDF ? (
                    <>
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>Membuat PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-slate-400" />
                      <span>Unduh PDF</span>
                    </>
                  )}
                </button>

                {/* Cetak & Format Dokumen */}
                <button
                  type="button"
                  disabled={publishedExams.length === 0}
                  onClick={() => setIsExportModalOpen(true)}
                  title={publishedExams.length === 0 ? `Jadwal ${examType} belum diterbitkan.` : `Cetak Dokumen Jadwal ${examType}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4 text-slate-400" />
                  <span>Cetak</span>
                </button>
              </div>
            }
          />

          {/* UTS & UAS Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => setExamType('UTS')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                examType === 'UTS'
                  ? 'bg-blue-50/50 border-blue-400/80 shadow-md ring-2 ring-blue-500/20'
                  : 'bg-white/80 border-slate-200/80 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-black text-sm shadow-xs">
                    UTS
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Ujian Tengah Semester</h3>
                    <p className="text-2xs text-slate-500">
                      {activeTerm ? `${activeTerm.academic_year || activeTerm.year} (${activeTerm.semester_type || activeTerm.term})` : 'Periode Semester Aktif'}
                    </p>
                  </div>
                </div>
                <StatusBadge
                  label={
                    isGuest
                      ? isUtsPublished
                        ? 'Diterbitkan'
                        : 'Belum Diterbitkan'
                      : isUtsPublished
                      ? 'Diterbitkan'
                      : publishedVersions.some((v) => v.type === 'UTS' && v.status === 'DRAFT')
                      ? 'Draft'
                      : 'Belum Disusun'
                  }
                />
              </div>
            </div>

            <div
              onClick={() => setExamType('UAS')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                examType === 'UAS'
                  ? 'bg-blue-50/50 border-blue-400/80 shadow-md ring-2 ring-blue-500/20'
                  : 'bg-white/80 border-slate-200/80 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-black text-sm shadow-xs">
                    UAS
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Ujian Akhir Semester</h3>
                    <p className="text-2xs text-slate-500">
                      {activeTerm ? `${activeTerm.academic_year || activeTerm.year} (${activeTerm.semester_type || activeTerm.term})` : 'Periode Semester Aktif'}
                    </p>
                  </div>
                </div>
                <StatusBadge
                  label={
                    isGuest
                      ? isUasPublished
                        ? 'Diterbitkan'
                        : 'Belum Diterbitkan'
                      : isUasPublished
                      ? 'Diterbitkan'
                      : publishedVersions.some((v) => v.type === 'UAS' && v.status === 'DRAFT')
                      ? 'Draft'
                      : 'Belum Disusun'
                  }
                />
              </div>
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={`Total Sesi ${examType}`}
              value={publishedExams.length}
              icon={<CalendarCheck className="w-6 h-6" />}
              iconBgColor="bg-blue-50 text-blue-600"
              subtitle={`mata kuliah terbit`}
            />

            <StatCard
              title="Ruangan Digunakan"
              value={new Set(publishedExams.map((e) => e.room_code)).size || 0}
              icon={<DoorClosed className="w-6 h-6" />}
              iconBgColor="bg-purple-50 text-purple-600"
              subtitle="ruang kelas & ujian"
            />

            <StatCard
              title="Pengawas Bertugas"
              value={
                new Set(
                  publishedExams.flatMap((e) =>
                    (e.proctor_names || '').split(',').map((p) => p.trim())
                  )
                ).size || 0
              }
              icon={<Users className="w-6 h-6" />}
              iconBgColor="bg-emerald-50 text-emerald-600"
              subtitle="dosen pengampu & pengawas"
            />

            <StatCard
              title="Status Jadwal"
              value={publishedExams.length > 0 ? 'Resmi Terbit' : 'Belum Diterbitkan'}
              icon={<Calendar className="w-6 h-6" />}
              iconBgColor="bg-slate-50 text-slate-600"
              subtitle={latestPublished?.title || (activeTerm ? `${activeTerm.academic_year || activeTerm.year} ${activeTerm.semester_type || activeTerm.term}` : 'Periode Aktif')}
            />
          </div>

          {/* Published Table / Empty State Container */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari kode atau nama mata kuliah..."
                    value={viewerSearch}
                    onChange={(e) => setViewerSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={viewerDateFilter}
                  onChange={(e) => setViewerDateFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
                >
                  <option value="ALL">Semua Tanggal</option>
                  {publishedDates.map((d) => (
                    <option key={d} value={d}>
                      {formatDateIndo(d)}
                    </option>
                  ))}
                </select>

                <select
                  value={viewerSemesterFilter}
                  onChange={(e) => setViewerSemesterFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
                >
                  <option value="ALL">Semua Semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={String(s)}>
                      Semester {s}
                    </option>
                  ))}
                </select>

                {role === 'DOSEN' && !isGuest && (
                  <button
                    type="button"
                    onClick={() => setViewerOnlyMySupervision(!viewerOnlyMySupervision)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                      viewerOnlyMySupervision
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Jadwal Pengawasan Saya
                  </button>
                )}

                {!isGuest && isAdmin && latestPublished && (
                  <button
                    type="button"
                    onClick={() => handleStartWorkflow(examType, latestPublished.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Buat Revisi Jadwal
                  </button>
                )}
              </div>
            </div>

            {publishedError && <ErrorState message={publishedError} />}

            {loadingPublished && <LoadingState type="table-skeleton" rows={6} />}

            {!loadingPublished && !publishedError && publishedExams.length === 0 && (
              <div className="py-12 px-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
                  <CalendarCheck className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-base font-black text-slate-900">
                    Belum ada jadwal {examType} yang diterbitkan.
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Jadwal resmi {examType} untuk periode semester ini belum diterbitkan oleh bagian akademik jurusan.
                  </p>
                </div>

                {!isGuest && isAdmin && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleStartWorkflow(examType)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      Mulai Susun Jadwal {examType}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!loadingPublished && !publishedError && publishedExams.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">No</th>
                      <th className="py-3 px-4">Tanggal Pelaksanaan</th>
                      <th className="py-3 px-4">Waktu Ujian</th>
                      <th className="py-3 px-4">Mata Kuliah</th>
                      <th className="py-3 px-3 text-center">Kelas</th>
                      <th className="py-3 px-4">Ruangan</th>
                      <th className="py-3 px-4">Dosen Pengawas</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPublishedExams.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatDateIndo(item.date || item.exam_date || '')}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">
                          {item.start_time} – {item.end_time}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{item.course_name}</p>
                          <span className="text-2xs font-mono text-slate-400">
                            {item.course_code}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 text-2xs">
                            {item.class_name || item.class_code || 'A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {item.room_name || item.room_code || 'R. Ujian'}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {item.proctor_names ||
                            (item.supervisor_names && item.supervisor_names.join(', ')) ||
                            'Tim Dosen Pengawas'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <StatusBadge label={item.status || 'Terjadwal'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================
          MODE 2: 5-STAGE EXAM SCHEDULING WORKFLOW
         ======================================================== */}
      {mode === 'WORKFLOW' && (
        <div className="space-y-6">
          <ExamActiveHeader
            activeTerm={activeTerm}
            examType={workflowConfig.examType}
            onOpenHistory={() => setIsHistoryModalOpen(true)}
            onExitWorkflow={handleExitWorkflow}
            onResetWorkflow={() => handleStartWorkflow(workflowConfig.examType)}
          />

          <ExamStepper
            currentStep={activeStep}
            onStepClick={(stepNumber) => setActiveStep(stepNumber)}
          />

          {/* Workflow Stage Components */}
          {activeStep === 1 && (
            <ExamStep1Config
              activeTerm={activeTerm}
              config={workflowConfig}
              onChangeConfig={(updated) =>
                setWorkflowConfig((prev) => ({ ...prev, ...updated }))
              }
              sessions={sessions}
              onNext={() => setActiveStep(2)}
              isDraftLocked={Boolean(currentDraftVersion)}
            />
          )}

          {activeStep === 2 && (
            <ExamStep2Courses
              examType={workflowConfig.examType}
              sourceOfferings={sourceOfferings}
              rooms={rooms}
              isLoading={loadingSourceOfferings}
              onRefreshSource={() =>
                currentDraftVersion
                  ? loadWorkflowOfferings(
                      currentDraftVersion.id,
                      currentDraftVersion.revision
                    )
                  : Promise.resolve()
              }
              onNext={() => {
                // Pre-populate room preferences & supervisors if needed
                if (Object.keys(roomPreferences).length === 0) {
                  handleAutoAllocateAllRooms();
                }
                setActiveStep(3);
              }}
              onBack={() => setActiveStep(1)}
            />
          )}

          {activeStep === 3 && (
            <ExamStep3SupervisorsRooms
              sourceOfferings={sourceOfferings}
              rooms={rooms}
              lecturers={lecturers}
              supervisorAssignments={supervisorAssignments}
              roomPreferences={roomPreferences}
              onChangeSupervisor={(offeringId, assignment) =>
                setSupervisorAssignments((prev) => ({
                  ...prev,
                  [offeringId]: assignment,
                }))
              }
              onChangeRoomPreference={(offeringId, roomIds) =>
                setRoomPreferences((prev) => ({
                  ...prev,
                  [offeringId]: roomIds,
                }))
              }
              onAutoAllocateAllRooms={handleAutoAllocateAllRooms}
              onNext={() => {
                handleRunGenerator();
                setActiveStep(4);
              }}
              onBack={() => setActiveStep(2)}
            />
          )}

          {activeStep === 4 && (
            <ExamStep4GenerateMatrix
              examType={workflowConfig.examType}
              config={workflowConfig}
              sessions={sessions}
              rooms={rooms}
              lecturers={lecturers}
              offerings={sourceOfferings}
              generationResult={generationResult}
              onGenerate={handleRunGenerator}
              onUpdateSlots={(updatedSlots) => {
                if (generationResult) {
                  setGenerationResult({
                    ...generationResult,
                    slots: updatedSlots,
                    draftEntriesPayload: updatedSlots.map((s) => {
                      let finalSups = [...s.supervisorIds];
                      if (finalSups.length === 1) {
                        const fallback = lecturers.find((l) => l.id !== finalSups[0]);
                        if (fallback) finalSups.push(fallback.id);
                        else if (lecturers.length > 0) finalSups.push(lecturers[0].id);
                      }
                      return {
                        course_offering_id: s.courseOfferingId,
                        exam_session_id: s.sessionId,
                        exam_date: s.examDate,
                        duration_minutes: s.durationMinutes,
                        room_ids: s.roomIds,
                        supervisor_ids: finalSups.slice(0, 2),
                        notes: null,
                      };
                    }),
                    summary: {
                      ...generationResult.summary,
                      conflictCount: updatedSlots.filter((s) => s.isConflict).length,
                    },
                  });
                }
              }}
              onSaveDraft={async () => {
                await handleSaveDraft();
              }}
              isSaving={isSavingDraft}
              currentVersion={currentDraftVersion}
              onNext={handleProceedToPreview}
              onBack={() => setActiveStep(3)}
            />
          )}

          {activeStep === 5 && (
            <ExamStep5PreviewPublish
              examType={workflowConfig.examType}
              activeTerm={activeTerm}
              currentVersion={currentDraftVersion}
              slots={generationResult?.slots || []}
              sessions={sessions}
              rooms={rooms}
              lecturers={lecturers}
              onPublish={handlePublish}
              isPublishing={isPublishing}
              onBack={() => setActiveStep(4)}
            />
          )}
        </div>
      )}

      {/* ========================================================
          MODALS: HISTORY & DOCUMENT EXPORT
         ======================================================== */}
      {activeTerm?.id && (
        <ExamHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          termId={activeTerm.id}
          examType={examType}
          onRestoreVersion={(newDraft) => {
            setCurrentDraftVersion(newDraft);
            setWorkflowConfig((prev) => ({
              ...prev,
              examType: (newDraft.type as any) || examType,
            }));
            loadResources();
            loadSessions();
            loadWorkflowOfferings(newDraft.id, newDraft.revision);
            setActiveStep(1);
            setMode('WORKFLOW');
          }}
        />
      )}

      {/* Official Exam Academic Document Export & Print Modal */}
      <DocumentExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        documentType={examType}
        allExams={publishedExams}
        filteredExams={filteredPublishedExams}
        term={activeTerm}
        filterDescription={filterDescription}
      />

      {/* Tarik Jadwal Aktif Modal */}
      <ClearActiveScheduleModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        academicTermId={activeTerm?.id}
        scheduleType={examType}
        onCleared={loadPublishedData}
      />
    </div>
  );
};
