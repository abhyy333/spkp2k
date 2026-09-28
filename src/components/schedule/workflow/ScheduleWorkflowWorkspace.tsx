import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAcademicTerm } from '../../../contexts/AcademicTermContext';
import {
  AcademicTerm,
  ScheduleVersion,
  CourseOffering,
  ScheduleEntry,
  Room,
  TimeSlot,
  Lecturer,
  LecturerAvailability,
} from '../../../types';
import { academicTermsService } from '../../../services/academicTerms.service';
import { scheduleVersionsService } from '../../../services/scheduleVersions.service';
import { scheduleEntriesService } from '../../../services/scheduleEntries.service';
import { scheduleConflictsService } from '../../../services/scheduleConflicts.service';
import { courseOfferingsService } from '../../../services/courseOfferings.service';
import { roomsService } from '../../../services/rooms.service';
import { timeSlotsService } from '../../../services/timeSlots.service';
import { lecturersService } from '../../../services/lecturers.service';
import { lecturerAvailabilityService } from '../../../services/lecturerAvailability.service';
import {
  ProblemData,
  SchedulableOffering,
  generateInitialSolution,
  PRNG,
  OptimizationResult,
} from '../../../lib/optimizer';
import { ScheduleWorkflowHeader } from './ScheduleWorkflowHeader';
import { WorkflowStepper } from './WorkflowStepper';
import { Step1CourseSelection } from './Step1CourseSelection';
import { Step2RombelReview } from './Step2RombelReview';
import { Step3LecturerAssignment } from './Step3LecturerAssignment';
import { Step4InitialSchedule } from './Step4InitialSchedule';
import { Step5SimulatedAnnealing } from './Step5SimulatedAnnealing';
import { Step6PreviewPublish } from './Step6PreviewPublish';
import { VersionHistoryDrawer } from '../versioning/VersionHistoryDrawer';
import {
  ScheduleActionConfirmDialog,
  ScheduleActionDialogState,
} from '../versioning/ScheduleActionConfirmDialog';
import { LoadingState } from '../../ui/LoadingState';
import { ErrorState } from '../../ui/ErrorState';
import { Modal } from '../../ui/Modal';
import { toast } from '../../ui/Toast';
import { Calendar, Plus, Sparkles, Layers, BookOpen, Trash2, AlertTriangle, Check } from 'lucide-react';

export const ScheduleWorkflowWorkspace: React.FC = () => {
  // Global Active Academic Term
  const {
    activeTerm,
    terms: globalTerms,
    activeTermLoading,
  } = useAcademicTerm();

  // Master References State
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [availabilities, setAvailabilities] = useState<LecturerAvailability[]>([]);

  // Versions and Draft state
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<ScheduleVersion | null>(null);

  // Term Offerings & Selected Offerings
  const [termOfferings, setTermOfferings] = useState<CourseOffering[]>([]);
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<Set<string>>(new Set());

  // Schedule Entries
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);

  // Workflow Navigation State (1 - 6)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxVisitedStep, setMaxVisitedStep] = useState<number>(1);

  // UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingInitial, setIsGeneratingInitial] = useState<boolean>(false);

  // Modals
  const [createDraftModalOpen, setCreateDraftModalOpen] = useState<boolean>(false);
  const [draftTitleInput, setDraftTitleInput] = useState<string>('');
  const [creatingDraft, setCreatingDraft] = useState<boolean>(false);

  const [versionHistoryOpen, setVersionHistoryOpen] = useState<boolean>(false);
  const [actionDialog, setActionDialog] = useState<ScheduleActionDialogState>({
    type: null,
    version: null,
  });
  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  // 1. Sync terms & active term
  useEffect(() => {
    if (globalTerms && globalTerms.length > 0) {
      setTerms(globalTerms);
    }
  }, [globalTerms]);

  useEffect(() => {
    if (activeTerm?.id && !selectedTermId) {
      setSelectedTermId(activeTerm.id);
    }
  }, [activeTerm, selectedTermId]);

  // 2. Load Master Data (Rooms, Slots, Lecturers)
  useEffect(() => {
    async function loadMasterData() {
      setLoading(true);
      setError(null);
      try {
        const [termList, roomList, slotList, lecList] = await Promise.all([
          academicTermsService.getAcademicTerms(),
          roomsService.getRooms(),
          timeSlotsService.getTimeSlots({ activeOnly: true }),
          lecturersService.getLecturers(),
        ]);

        setTerms(termList);
        setRooms(roomList);
        setTimeSlots(slotList);
        setLecturers(lecList);

        const active = termList.find((t) => t.is_active) || termList[0];
        if (active && !selectedTermId) {
          setSelectedTermId(active.id);
        }
      } catch (err: any) {
        console.error('Failed to load master data:', err);
        setError(err.message || 'Gagal memuat data master.');
      } finally {
        setLoading(false);
      }
    }

    loadMasterData();
  }, []);

  // 3. Load Term Data (Versions & Course Offerings)
  const loadTermData = useCallback(async (termId: string) => {
    if (!termId) return;
    try {
      const [verList, offList] = await Promise.all([
        scheduleVersionsService.getVersions(termId),
        courseOfferingsService.getOfferings({ termId }),
      ]);

      const validOfferings = offList.filter(
        (o) => o.course?.is_schedulable !== false && o.course?.activity_type !== 'KKN'
      );
      setTermOfferings(validOfferings);
      setVersions(verList);

      // Prioritize latest DRAFT version for LECTURE, then any draft, then first
      const draftVer =
        verList.find((v) => (v.type === 'LECTURE' || !v.type) && v.status === 'DRAFT') ||
        verList.find((v) => v.status === 'DRAFT') ||
        verList[0] ||
        null;

      if (draftVer) {
        setSelectedVersionId(draftVer.id);
        setSelectedVersion(draftVer);
      } else {
        setSelectedVersionId('');
        setSelectedVersion(null);
        setEntries([]);
      }
    } catch (err: any) {
      console.error('Failed to load term data:', err);
      toast.error('Gagal memuat versi jadwal dan penawaran kelas.');
    }
  }, []);

  useEffect(() => {
    if (selectedTermId) {
      loadTermData(selectedTermId);
    }
  }, [selectedTermId, loadTermData]);

  // 4. Load Version Entries when selectedVersionId changes
  const loadVersionEntries = useCallback(async (versionId: string) => {
    if (!versionId) {
      setEntries([]);
      return;
    }

    try {
      const [entryList, ver] = await Promise.all([
        scheduleEntriesService.getEntriesByVersionId(versionId),
        scheduleVersionsService.getVersionById(versionId),
      ]);

      setEntries(entryList);
      if (ver) setSelectedVersion(ver);

      // Sync selectedOfferingIds with entries or all term offerings
      if (entryList.length > 0) {
        const scheduledIds = new Set(entryList.map((e) => e.course_offering_id));
        setSelectedOfferingIds(scheduledIds);
      }
    } catch (err: any) {
      console.error('Failed to load version entries:', err);
      toast.error('Gagal memuat entri jadwal.');
    }
  }, []);

  useEffect(() => {
    if (selectedVersionId) {
      loadVersionEntries(selectedVersionId);
    }
  }, [selectedVersionId, loadVersionEntries]);

  // 5. Restore or Save Step in localStorage for Workflow Persistence
  useEffect(() => {
    if (!selectedVersionId) return;

    const storageKey = `unram_schedule_workflow_step_${selectedVersionId}`;
    const savedStepStr = localStorage.getItem(storageKey);
    let targetStep = 1;

    if (savedStepStr) {
      const parsed = parseInt(savedStepStr, 10);
      if (parsed >= 1 && parsed <= 6) {
        targetStep = parsed;
      }
    } else if (entries.length > 0) {
      // If version already has entries and no stored step, jump to Step 4 or Step 6
      targetStep = selectedVersion?.status === 'PUBLISHED' ? 6 : 4;
    }

    setCurrentStep(targetStep);
    setMaxVisitedStep((prev) => Math.max(prev, targetStep));
  }, [selectedVersionId]);

  const handleStepChange = (stepId: number) => {
    setCurrentStep(stepId);
    setMaxVisitedStep((prev) => Math.max(prev, stepId));
    if (selectedVersionId) {
      localStorage.setItem(`unram_schedule_workflow_step_${selectedVersionId}`, String(stepId));
    }
  };

  // 6. Load Lecturer Availabilities across lecturers in term
  useEffect(() => {
    async function loadAvails() {
      if (termOfferings.length === 0 || !selectedTermId) return;
      const assignedLecturerIds = Array.from(
        new Set(
          termOfferings.flatMap((o) =>
            (o.course_offering_lecturers || []).map((l) => l.lecturer_id)
          )
        )
      );

      try {
        const promises = assignedLecturerIds.slice(0, 50).map((lid) =>
          lecturerAvailabilityService.getAvailability(lid, selectedTermId)
        );
        const results = await Promise.all(promises);
        setAvailabilities(results.flat());
      } catch (err) {
        console.warn('Error loading lecturer availabilities:', err);
      }
    }

    loadAvails();
  }, [termOfferings, selectedTermId]);

  // Selected offerings objects
  const selectedOfferings = useMemo(() => {
    if (selectedOfferingIds.size === 0) {
      // Default to offerings matching active template if not yet selected
      return termOfferings;
    }
    return termOfferings.filter((o) => selectedOfferingIds.has(o.id));
  }, [termOfferings, selectedOfferingIds]);

  // Initial selection setup if empty
  useEffect(() => {
    if (termOfferings.length > 0 && selectedOfferingIds.size === 0 && !selectedVersionId) {
      const isGanjil = (activeTerm?.semester_type || 'GANJIL').toUpperCase() === 'GANJIL';
      const templateSemesters = isGanjil ? [1, 3, 5, 7] : [2, 4, 6, 8];
      const initialIds = new Set(
        termOfferings
          .filter((o) => templateSemesters.includes(o.course?.semester || 1))
          .map((o) => o.id)
      );
      setSelectedOfferingIds(initialIds);
    }
  }, [termOfferings, selectedOfferingIds.size, activeTerm, selectedVersionId]);

  // STEP 1 HANDLERS
  const handleToggleOffering = (offeringId: string) => {
    setSelectedOfferingIds((prev) => {
      const next = new Set(prev);
      if (next.has(offeringId)) {
        next.delete(offeringId);
      } else {
        next.add(offeringId);
      }
      return next;
    });
  };

  const handleSelectMultipleOfferings = (offeringIds: string[], select: boolean) => {
    setSelectedOfferingIds((prev) => {
      const next = new Set(prev);
      offeringIds.forEach((id) => {
        if (select) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const handleUpdateExpectedStudents = async (offeringId: string, count: number) => {
    await courseOfferingsService.updateOffering(offeringId, {
      expected_students: count,
    });
    setTermOfferings((prev) =>
      prev.map((o) => (o.id === offeringId ? { ...o, expected_students: count } : o))
    );
  };

  // STEP 3 HANDLERS
  const handleRefreshLecturersFromMaster = async () => {
    if (!selectedTermId) return;
    const offList = await courseOfferingsService.getOfferings({ termId: selectedTermId });
    const validOfferings = offList.filter(
      (o) => o.course?.is_schedulable !== false && o.course?.activity_type !== 'KKN'
    );
    setTermOfferings(validOfferings);
  };

  const handleSaveOfferingLecturers = async (
    offeringId: string,
    assignments: { lecturer_id: string; assignment_role: string }[]
  ) => {
    await courseOfferingsService.updateOffering(offeringId, {}, assignments);
    await handleRefreshLecturersFromMaster();
  };

  // STEP 4: INITIAL SCHEDULE GENERATION (Greedy Placement)
  const handleGenerateInitialPlacement = async () => {
    if (!selectedVersion) {
      toast.error('Draft jadwal belum dibuat.');
      return;
    }

    if (selectedOfferings.length === 0) {
      toast.error('Tidak ada mata kuliah yang terpilih.');
      return;
    }

    try {
      setIsGeneratingInitial(true);

      const schedOfferings: SchedulableOffering[] = selectedOfferings.map((o) => {
        const col = o.course_offering_lecturers || o.lecturers || [];
        return {
          id: o.id,
          courseId: o.course_id,
          courseCode: o.course?.code || '',
          courseName: o.course?.name || 'Mata Kuliah',
          classCode: o.class_code,
          effectiveSks: o.course?.effective_sks || 2,
          expectedStudents: o.expected_students || 0,
          requiredRoomType: o.required_room_type || 'Ruang Kuliah Teori',
          semester: o.course?.semester || 1,
          lecturerIds: col.map((l) => l.lecturer_id),
          lecturerNames: col.map((l) => l.lecturer?.name || 'Dosen'),
        };
      });

      const problem: ProblemData = {
        offerings: schedOfferings,
        rooms: rooms.filter((r) => r.is_active),
        timeSlots: timeSlots.filter((s) => s.is_active),
        availabilities,
        lecturers,
      };

      const prng = new PRNG(42);
      const initialAssignments = generateInitialSolution(problem, prng);

      const payload = initialAssignments.map((a) => ({
        course_offering_id: a.courseOfferingId,
        room_id: a.roomId,
        day_of_week: a.dayOfWeek,
        exam_date: null,
        start_minute: a.startMinute,
      }));

      const res = await scheduleVersionsService.saveDraft(
        selectedVersion.id,
        selectedVersion.revision,
        payload,
        'GENERATE_INITIAL_SCHEDULE'
      );

      await scheduleVersionsService.refreshConflicts(selectedVersion.id);
      const freshEntries = await scheduleEntriesService.getEntriesByVersionId(selectedVersion.id);

      setEntries(freshEntries);
      if (res.version) {
        setSelectedVersion(res.version);
      }

      toast.success(
        `Jadwal awal untuk ${freshEntries.length} kelas berhasil ditempatkan dan disimpan ke draft.`
      );
    } catch (err: any) {
      console.error('Failed to generate initial placement:', err);
      toast.error(err.message || 'Gagal membuat penempatan jadwal awal.');
    } finally {
      setIsGeneratingInitial(false);
    }
  };

  // STEP 4 & 6: MANUAL PLACEMENT UPDATE
  const handleUpdateEntryPlacement = async (
    entryId: string,
    data: { room_id: string; day_of_week: number; start_minute: number }
  ) => {
    if (!selectedVersion) return;

    const updatedEntries = entries.map((e) =>
      e.id === entryId
        ? {
            ...e,
            room_id: data.room_id,
            day_of_week: data.day_of_week,
            start_minute: data.start_minute,
          }
        : e
    );

    const payload = updatedEntries.map((e) => ({
      course_offering_id: e.course_offering_id,
      room_id: e.room_id,
      day_of_week: Number(e.day_of_week),
      exam_date: null,
      start_minute: Number(e.start_minute),
    }));

    const res = await scheduleVersionsService.saveDraft(
      selectedVersion.id,
      selectedVersion.revision,
      payload,
      'MANUAL_MOVE_ENTRY'
    );

    await scheduleVersionsService.refreshConflicts(selectedVersion.id);
    const freshEntries = await scheduleEntriesService.getEntriesByVersionId(selectedVersion.id);
    setEntries(freshEntries);
    if (res.version) setSelectedVersion(res.version);
  };

  // STEP 5: APPLY SA SOLUTION
  const handleApplyOptimizedSolution = async (
    newEntries: ScheduleEntry[],
    result: OptimizationResult
  ) => {
    if (!selectedVersion) return;

    const payload = newEntries.map((e) => ({
      course_offering_id: e.course_offering_id,
      room_id: e.room_id,
      day_of_week: Number(e.day_of_week),
      exam_date: null,
      start_minute: Number(e.start_minute),
    }));

    const res = await scheduleVersionsService.saveDraft(
      selectedVersion.id,
      selectedVersion.revision,
      payload,
      'APPLY_SA_OPTIMIZATION'
    );

    // Save optimization run to DB if table exists
    try {
      await supabase.from('optimization_runs').insert({
        schedule_version_id: selectedVersion.id,
        initial_cost: result.initialCostBreakdown.totalCost,
        final_cost: result.bestCostBreakdown.totalCost,
        hard_violations: result.bestCostBreakdown.hardViolationsCount,
        soft_violations: result.bestCostBreakdown.softViolationsCount,
        iterations_completed: result.totalIterations,
        execution_time_ms: result.timeElapsedMs,
        parameters: result.config,
      });
    } catch (e) {
      console.warn('optimization_runs logging notice:', e);
    }

    await scheduleVersionsService.refreshConflicts(selectedVersion.id);
    const freshEntries = await scheduleEntriesService.getEntriesByVersionId(selectedVersion.id);
    setEntries(freshEntries);
    if (res.version) setSelectedVersion(res.version);
  };

  // STEP 6: PUBLISH SCHEDULE
  const handlePublishSchedule = async (changelog?: string) => {
    if (!selectedVersion) return;

    await scheduleVersionsService.publishVersion(selectedVersion.id, changelog);
    const updatedVer = await scheduleVersionsService.getVersionById(selectedVersion.id);
    if (updatedVer) {
      setSelectedVersion(updatedVer);
    }
    await loadTermData(selectedTermId);
  };

  // CREATE DRAFT MODAL ACTIONS
  const handleOpenCreateDraftModal = (suggestedMode?: 'TEMPLATE' | 'CUSTOM') => {
    const term =
      terms.find((t) => t.id === selectedTermId) || activeTerm || terms[0];
    const termLabel = `${term?.academic_year || '2026/2027'} ${term?.semester_type || 'GANJIL'}`;
    setDraftTitleInput(`Jadwal Perkuliahan ${termLabel}`.trim());
    setCreateDraftModalOpen(true);
  };

  const handleConfirmCreateDraft = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (creatingDraft) return;

    const term =
      terms.find((t) => t.id === selectedTermId) || activeTerm || terms[0];
    if (!term?.id) {
      toast.error('Periode akademik aktif belum tersedia.');
      return;
    }

    if (!draftTitleInput.trim()) {
      toast.error('Judul draft wajib diisi.');
      return;
    }

    try {
      setCreatingDraft(true);
      const newVer = await scheduleVersionsService.createDraft(
        term.id,
        draftTitleInput.trim()
      );

      await loadTermData(term.id);
      setSelectedVersionId(newVer.id);
      setSelectedVersion(newVer);
      setCurrentStep(1);
      setMaxVisitedStep(1);
      setCreateDraftModalOpen(false);
      toast.success('Draft jadwal baru berhasil dibuat.');
    } catch (err: any) {
      console.error('Create draft error:', err);
      toast.error(err.message || 'Gagal membuat draft jadwal baru.');
    } finally {
      setCreatingDraft(false);
    }
  };

  // UPDATE DRAFT TITLE ACTION
  const handleUpdateTitle = async (newTitle: string) => {
    if (!selectedVersion?.id || !newTitle.trim()) return;
    try {
      const updated = await scheduleVersionsService.updateVersionTitle(selectedVersion.id, newTitle.trim());
      setSelectedVersion(updated);
      setVersions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      toast.success('Nama jadwal berhasil diperbarui.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah nama jadwal.');
    }
  };

  // CLEAR DRAFT ENTRIES MODAL OPENER
  const handleOpenClearSchedule = () => {
    if (!selectedVersion) {
      toast.error('Draft tidak ditemukan.');
      return;
    }
    if (selectedVersion.status === 'PUBLISHED') {
      toast.error('Jadwal yang sedang diterbitkan tidak dapat dikosongkan.');
      return;
    }
    setActionDialog({
      type: 'CLEAR',
      version: selectedVersion,
    });
  };

  // DELETE DRAFT MODAL OPENER
  const handleOpenDeleteSchedule = () => {
    if (!selectedVersion) {
      toast.error('Draft tidak ditemukan.');
      return;
    }
    if (selectedVersion.status === 'PUBLISHED') {
      toast.error('Jadwal yang sedang diterbitkan tidak dapat dihapus.');
      return;
    }
    setActionDialog({
      type: 'DELETE',
      version: selectedVersion,
    });
  };

  // CONFIRM ACTION DIALOG (CLEAR OR DELETE)
  const handleConfirmActionDialog = async () => {
    if (!actionDialog.type || !actionDialog.version) {
      toast.error('Draft tidak ditemukan.');
      return;
    }

    const target = actionDialog.version;

    try {
      setActionProcessing(true);
      if (actionDialog.type === 'CLEAR') {
        await scheduleVersionsService.clearDraftEntries(target.id);
        setEntries([]);
        setCurrentStep(1);
        setMaxVisitedStep(1);
        toast.success('Draft berhasil dikosongkan.');
        setActionDialog({ type: null, version: null });
        const fresh = await scheduleVersionsService.getVersionById(target.id);
        if (fresh) setSelectedVersion(fresh);
        if (selectedTermId) await loadTermData(selectedTermId);
      } else if (actionDialog.type === 'DELETE') {
        const result = await scheduleVersionsService.deleteVersion(target.id, target);
        setSelectedVersion(null);
        setSelectedVersionId('');
        setEntries([]);
        setCurrentStep(1);
        setMaxVisitedStep(1);
        setActionDialog({ type: null, version: null });
        if (selectedTermId) await loadTermData(selectedTermId);

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
      console.error('Action error in ScheduleWorkflowWorkspace:', err);
      toast.error(err.message || 'Gagal memproses aksi.');
    } finally {
      setActionProcessing(false);
    }
  };

  // Auto ensure initial schedule is placed when advancing to Step 4 if empty
  const handleNavigateToStep4 = async () => {
    handleStepChange(4);
    if (entries.length === 0 && selectedOfferings.length > 0) {
      await handleGenerateInitialPlacement();
    }
  };

  if (loading) {
    return <LoadingState type="table-skeleton" rows={8} message="Memuat alur penyusunan jadwal perkuliahan..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  const currentTerm = terms.find((t) => t.id === selectedTermId) || activeTerm;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <ScheduleWorkflowHeader
        activeTerm={currentTerm || null}
        currentVersion={selectedVersion}
        onNewScheduleClick={() => handleOpenCreateDraftModal()}
        onClearScheduleClick={selectedVersion?.status === 'DRAFT' ? handleOpenClearSchedule : undefined}
        onDeleteScheduleClick={selectedVersion?.status === 'DRAFT' ? handleOpenDeleteSchedule : undefined}
        onHistoryClick={() => setVersionHistoryOpen(true)}
        onUpdateTitle={selectedVersion ? handleUpdateTitle : undefined}
      />

      {/* When NO Draft exists: Show Clean Reference Empty State */}
      {!selectedVersion ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 md:p-14 text-center shadow-xs space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
            <Calendar className="w-8 h-8" />
          </div>

          <div className="max-w-xl mx-auto space-y-2">
            <h3 className="text-lg md:text-xl font-bold text-slate-900">
              Belum ada jadwal perkuliahan aktif.
            </h3>
            <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
              Mulai penyusunan jadwal perkuliahan terpadu berdasarkan periode akademik, penawaran kelas, dosen pengampu, ruangan, dan optimasi Simulated Annealing.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleOpenCreateDraftModal()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Susun Jadwal Baru</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateDraftModal('TEMPLATE')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Gunakan Template Semester</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateDraftModal('CUSTOM')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-slate-500" />
              <span>Kustom Manual</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Visual 6-Step Progress Bar */}
          <WorkflowStepper
            currentStep={currentStep}
            maxVisitedStep={maxVisitedStep}
            onStepClick={handleStepChange}
          />

          {/* STEP 1: PEMILIHAN MATA KULIAH */}
          {currentStep === 1 && (
            <Step1CourseSelection
              activeTerm={currentTerm || null}
              offerings={termOfferings}
              selectedOfferingIds={selectedOfferingIds}
              onToggleOffering={handleToggleOffering}
              onSelectMultipleOfferings={handleSelectMultipleOfferings}
              onUpdateExpectedStudents={handleUpdateExpectedStudents}
              onNext={() => handleStepChange(2)}
            />
          )}

          {/* STEP 2: PEMBAGIAN ROMBEL / REVIEW KELAS */}
          {currentStep === 2 && (
            <Step2RombelReview
              selectedOfferings={selectedOfferings}
              onUpdateExpectedStudents={handleUpdateExpectedStudents}
              onBack={() => handleStepChange(1)}
              onNext={() => handleStepChange(3)}
            />
          )}

          {/* STEP 3: PENUGASAN DOSEN */}
          {currentStep === 3 && (
            <Step3LecturerAssignment
              selectedOfferings={selectedOfferings}
              lecturersList={lecturers}
              onRefreshFromMaster={handleRefreshLecturersFromMaster}
              onSaveOfferingLecturers={handleSaveOfferingLecturers}
              onBack={() => handleStepChange(2)}
              onNext={handleNavigateToStep4}
            />
          )}

          {/* STEP 4: GENERATE JADWAL AWAL */}
          {currentStep === 4 && (
            <Step4InitialSchedule
              entries={entries}
              selectedOfferings={selectedOfferings}
              rooms={rooms}
              timeSlots={timeSlots}
              availabilities={availabilities}
              lecturers={lecturers}
              isGenerating={isGeneratingInitial}
              onGenerateInitialPlacement={handleGenerateInitialPlacement}
              onUpdateEntryPlacement={handleUpdateEntryPlacement}
              onBack={() => handleStepChange(3)}
              onNext={() => handleStepChange(5)}
            />
          )}

          {/* STEP 5: OPTIMASI SIMULATED ANNEALING */}
          {currentStep === 5 && (
            <Step5SimulatedAnnealing
              entries={entries}
              selectedOfferings={selectedOfferings}
              rooms={rooms}
              timeSlots={timeSlots}
              availabilities={availabilities}
              lecturers={lecturers}
              onApplyOptimizedSolution={handleApplyOptimizedSolution}
              onBack={() => handleStepChange(4)}
              onNext={() => handleStepChange(6)}
            />
          )}

          {/* STEP 6: PREVIEW & PUBLIKASI */}
          {currentStep === 6 && (
            <Step6PreviewPublish
              currentVersion={selectedVersion}
              entries={entries}
              selectedOfferings={selectedOfferings}
              rooms={rooms}
              timeSlots={timeSlots}
              availabilities={availabilities}
              lecturers={lecturers}
              onUpdateEntryPlacement={handleUpdateEntryPlacement}
              onPublishSchedule={handlePublishSchedule}
              onBack={() => handleStepChange(5)}
            />
          )}
        </>
      )}

      {/* CREATE DRAFT MODAL */}
      <Modal
        isOpen={createDraftModalOpen}
        onClose={() => setCreateDraftModalOpen(false)}
        title="Buat Draft Jadwal Perkuliahan"
        description={`Rancangan jadwal baru akan dibuat untuk periode ${
          currentTerm?.academic_year || '2026/2027'
        } ${currentTerm?.semester_type || 'GANJIL'}.`}
        size="md"
      >
        <form onSubmit={handleConfirmCreateDraft} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Judul / Label Draft Jadwal <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={draftTitleInput}
              onChange={(e) => setDraftTitleInput(e.target.value)}
              placeholder="Contoh: Jadwal Perkuliahan 2026/2027 GANJIL"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setCreateDraftModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={creatingDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{creatingDraft ? 'Membuat...' : 'Buat Draft'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ACTION CONFIRM DIALOG (CLEAR & DELETE DRAFT) */}
      <ScheduleActionConfirmDialog
        dialogState={actionDialog}
        onClose={() => {
          if (!actionProcessing) setActionDialog({ type: null, version: null });
        }}
        onConfirm={handleConfirmActionDialog}
        isProcessing={actionProcessing}
      />

      {/* VERSION HISTORY DRAWER */}
      <VersionHistoryDrawer
        isOpen={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        versions={versions}
        selectedVersionId={selectedVersionId}
        onSelectVersion={(vId) => {
          setSelectedVersionId(vId);
          setVersionHistoryOpen(false);
        }}
        onOpenComparison={() => {}}
        onVersionCreated={() => {
          if (selectedTermId) loadTermData(selectedTermId);
        }}
        termId={selectedTermId}
      />
    </div>
  );
};
