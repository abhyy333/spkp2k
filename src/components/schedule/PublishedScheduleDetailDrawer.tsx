import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Filter,
  ArrowRightLeft,
  Calendar,
  Clock,
  DoorOpen,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { CurrentPublishedSchedule, Room, AcademicTerm, ScheduleVersion } from '../../types';
import { roomsService } from '../../services/rooms.service';
import { scheduleVersionsService } from '../../services/scheduleVersions.service';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { minuteToTime, timeToMinute, dayOfWeekToName, cn, formatDateTimeIndo } from '../../lib/utils';
import { getActiveSessionDefinitions } from '../../lib/academicTimeProfile';
import { toast } from '../ui/Toast';
import { useNavigate } from 'react-router-dom';

interface PublishedScheduleDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSchedule: CurrentPublishedSchedule | null;
  allSchedules: CurrentPublishedSchedule[];
  activeTerm: AcademicTerm | null;
  isAdmin: boolean;
}

export const PublishedScheduleDetailDrawer: React.FC<PublishedScheduleDetailDrawerProps> = ({
  isOpen,
  onClose,
  selectedSchedule,
  allSchedules,
  activeTerm,
  isAdmin,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'RECOMMENDATIONS' | 'MANUAL' | 'SWAP'
  const [activeTab, setActiveTab] = useState<'RECOMMENDATIONS' | 'MANUAL' | 'SWAP'>('RECOMMENDATIONS');

  // Rooms list
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(false);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState<boolean>(false);

  // Manual Adjustment state
  const [manualDay, setManualDay] = useState<number>(1);
  const [manualStartMinute, setManualStartMinute] = useState<number>(470);
  const [manualRoomId, setManualRoomId] = useState<string>('');

  // Swap state
  const [swapSearch, setSwapSearch] = useState<string>('');
  const [selectedSwapCandidate, setSelectedSwapCandidate] = useState<CurrentPublishedSchedule | null>(null);

  // Confirmation Modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'RECOMMENDATION' | 'MANUAL' | 'SWAP';
    data: any;
  } | null>(null);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // Load rooms on open
  useEffect(() => {
    if (!isOpen) return;
    const fetchRooms = async () => {
      setLoadingRooms(true);
      try {
        const list = await roomsService.getRooms();
        const activeList = list.filter((r) => r.is_active !== false);
        setRooms(activeList);
        if (activeList.length > 0 && !manualRoomId) {
          setManualRoomId(selectedSchedule?.room_id || activeList[0].id);
        }
      } catch (e) {
        console.warn('Error loading rooms for detail drawer:', e);
      } finally {
        setLoadingRooms(false);
      }
    };
    fetchRooms();
  }, [isOpen, selectedSchedule?.room_id]);

  // Sync initial manual parameters when selectedSchedule changes
  useEffect(() => {
    if (selectedSchedule) {
      const scheduleEntryId =
        selectedSchedule.scheduleEntryId ||
        selectedSchedule.id ||
        (selectedSchedule as any).schedule_entry_id;

      const courseOfferingId =
        selectedSchedule.course_offering_id ||
        (selectedSchedule as any).courseOfferingId;

      const courseName =
        selectedSchedule.course_name ||
        (selectedSchedule as any).courseName;

      console.log('SMART RESCHEDULE ENTRY', {
        scheduleEntryId,
        courseOfferingId,
        course: courseName,
      });

      setManualDay(selectedSchedule.day_of_week || 1);
      setManualStartMinute(selectedSchedule.start_minute || 470);
      setManualRoomId(selectedSchedule.room_id || '');
      setSelectedSwapCandidate(null);
      setSwapSearch('');
      setActiveTab('RECOMMENDATIONS');
      fetchRecommendations(selectedSchedule);
    }
  }, [selectedSchedule]);

  // Standard sessions for time picker (dynamically adapting to Ramadan vs Normal)
  const isRamadan = selectedSchedule?.minutes_per_session === 40 || selectedSchedule?.time_profile === 'RAMADAN';
  const standardSessions = useMemo(() => {
    const active = getActiveSessionDefinitions(isRamadan ? 'RAMADAN' : 'NORMAL');
    return active.map((s) => ({
      num: s.sessionNumber,
      startMinute: s.startMinute,
      label: `${s.startTime} (Sesi ${s.sessionNumber})`,
    }));
  }, [isRamadan]);

  const daysList = useMemo(
    () => [
      { num: 1, name: 'Senin' },
      { num: 2, name: 'Selasa' },
      { num: 3, name: 'Rabu' },
      { num: 4, name: 'Kamis' },
      { num: 5, name: 'Jumat' },
    ],
    []
  );

  // Fetch Smart Recommendations via RPC get_schedule_move_recommendations with reliable algorithm fallback
  const fetchRecommendations = async (item: CurrentPublishedSchedule) => {
    if (!item) return;
    setLoadingRecommendations(true);
    try {
      const realScheduleEntryId =
        item.scheduleEntryId ||
        item.id ||
        (item as any).schedule_entry_id;

      const isUuid =
        typeof realScheduleEntryId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realScheduleEntryId);

      let rpcResults: any[] = [];
      if (isUuid) {
        try {
          const { data, error } = await supabase.rpc('get_schedule_move_recommendations', {
            p_entry_id: realScheduleEntryId,
            p_limit: 5,
          });
          if (error) {
            console.error('get_schedule_move_recommendations failed', error);
          } else if (data) {
            if (Array.isArray(data)) {
              rpcResults = data;
            } else if (Array.isArray((data as any).recommendations)) {
              rpcResults = (data as any).recommendations;
            }
          }
        } catch (rpcErr) {
          console.warn('RPC get_schedule_move_recommendations notice:', rpcErr);
        }
      } else {
        console.warn(
          'Smart rescheduling requires persisted schedule_entries.id UUID. Got non-UUID identifier:',
          realScheduleEntryId
        );
      }

      if (rpcResults.length > 0) {
        const expectedStudents = item.expected_students || item.student_count || 40;
        const mapped = rpcResults.map((rec: any, idx: number) => {
          const dayNum = Number(rec.day_of_week ?? rec.dayOfWeek ?? rec.day ?? 1);
          const startMin = Number(
            rec.start_minute ?? rec.startMinute ?? (rec.start_time ? timeToMinute(rec.start_time) : 470)
          );
          const endMin = Number(
            rec.end_minute ?? rec.endMinute ?? (rec.end_time ? timeToMinute(rec.end_time) : startMin + 150)
          );
          const rId = rec.room_id || rec.roomId || '';
          const rCode = rec.room_code || rec.roomCode || rec.code || 'Ruang';
          const rName = rec.room_name || rec.roomName || rec.name || 'Ruang Kuliah';
          const rCap = Number(rec.room_capacity || rec.roomCapacity || rec.capacity || 60);
          const seatWaste = rec.seat_waste ?? rec.seatWaste ?? (rCap - expectedStudents);

          return {
            id: rec.id || `rpc-rec-${idx}-${rId}-${dayNum}-${startMin}`,
            room_id: rId,
            room_code: rCode,
            room_name: rName,
            room_capacity: rCap,
            day_of_week: dayNum,
            dayName: rec.day_name || rec.dayName || dayOfWeekToName(dayNum),
            start_minute: startMin,
            end_minute: endMin,
            startTime: rec.startTime || rec.start_time || minuteToTime(startMin),
            endTime: rec.endTime || rec.end_time || minuteToTime(endMin),
            seatWaste,
            score: rec.score ?? seatWaste,
            isConflictFree: rec.is_conflict_free ?? true,
          };
        });
        setRecommendations(mapped);
        return;
      }

      // Fallback generator: Scan active rooms and time slots to evaluate conflict-free candidates
      const sks = item.effective_sks || item.sks || 2;
      const duration = sks * 50;
      const expectedStudents = (item as any).expected_students || (item as any).student_count || 40;
      const lecturerName = item.lecturer_names ? String(item.lecturer_names).toLowerCase() : '';

      const candidates: any[] = [];

      // Available active rooms
      const candidateRooms = rooms.length > 0 ? rooms : [
        { id: item.room_id || 'r1', code: item.room_code || 'B2-02', name: item.room_name || 'Ruang Kuliah', capacity: 60, room_type: 'TEORI' }
      ];

      for (const rm of candidateRooms) {
        if (rm.capacity < expectedStudents) continue;

        for (const day of [1, 2, 3, 4, 5]) {
          for (const sess of [470, 520, 570, 620, 770, 820, 870, 920]) {
            const startMin = sess;
            const endMin = startMin + duration;
            if (endMin > 1070) continue; // exceed daily bounds

            // Skip current exact slot
            if (
              day === item.day_of_week &&
              startMin === item.start_minute &&
              rm.id === item.room_id
            ) {
              continue;
            }

            // Check room overlap with other published entries
            const roomOverlap = allSchedules.some(
              (other) => {
                if (other.id === item.id || other.day_of_week !== day) return false;
                if (other.room_id !== rm.id && other.room_code !== rm.code) return false;
                const otherStart = other.start_minute ?? 470;
                const otherEnd = other.end_minute ?? (otherStart + 100);
                return startMin < otherEnd && otherStart < endMin;
              }
            );
            if (roomOverlap) continue;

            // Check lecturer overlap with other published entries
            if (lecturerName) {
              const lecturerOverlap = allSchedules.some(
                (other) => {
                  if (other.id === item.id || other.day_of_week !== day) return false;
                  if (!other.lecturer_names || !String(other.lecturer_names).toLowerCase().includes(lecturerName)) return false;
                  const otherStart = other.start_minute ?? 470;
                  const otherEnd = other.end_minute ?? (otherStart + 100);
                  return startMin < otherEnd && otherStart < endMin;
                }
              );
              if (lecturerOverlap) continue;
            }

            const seatWaste = rm.capacity - expectedStudents;
            const sameDayBonus = day === item.day_of_week ? 5 : 0;
            const score = seatWaste - sameDayBonus;

            candidates.push({
              id: `rec-${rm.id}-${day}-${startMin}`,
              room_id: rm.id,
              room_code: rm.code,
              room_name: rm.name,
              room_capacity: rm.capacity,
              day_of_week: day,
              dayName: dayOfWeekToName(day),
              start_minute: startMin,
              end_minute: endMin,
              startTime: minuteToTime(startMin),
              endTime: minuteToTime(endMin),
              seatWaste,
              score,
            });
          }
        }
      }

      candidates.sort((a, b) => a.score - b.score);
      setRecommendations(candidates.slice(0, 5));
    } catch (err) {
      console.warn('Error fetching recommendations:', err);
      setRecommendations([]);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Live validation for manual adjustment
  const manualValidation = useMemo(() => {
    if (!selectedSchedule) {
      return { isValid: false, issues: [] };
    }

    const sks = selectedSchedule.effective_sks || selectedSchedule.sks || 2;
    const duration = sks * 50;
    const endMin = manualStartMinute + duration;
    const expectedStudents =
      (selectedSchedule as any).expected_students || (selectedSchedule as any).student_count || 40;
    const targetRoom = rooms.find((r) => r.id === manualRoomId);
    const lecturerName = selectedSchedule.lecturer_names
      ? String(selectedSchedule.lecturer_names).toLowerCase()
      : '';

    const issues: string[] = [];

    if (endMin > 1070) {
      issues.push('Waktu kuliah melebihi batas jam operasional kampus (17:50).');
    }

    if (targetRoom && targetRoom.capacity < expectedStudents) {
      issues.push(
        `Kapasitas ruangan (${targetRoom.capacity} kursi) kurang dari peserta kelas (${expectedStudents} mhs).`
      );
    }

    // Room overlap
    const roomOverlap = allSchedules.some((other) => {
      if (other.id === selectedSchedule.id || other.day_of_week !== manualDay) return false;
      if (other.room_id !== manualRoomId && other.room_code !== targetRoom?.code) return false;
      const otherStart = other.start_minute ?? 470;
      const otherEnd = other.end_minute ?? (otherStart + 100);
      return manualStartMinute < otherEnd && otherStart < endMin;
    });
    if (roomOverlap) {
      issues.push('Ruangan sudah digunakan oleh mata kuliah lain pada waktu tersebut.');
    }

    // Lecturer overlap
    if (lecturerName) {
      const lecturerOverlap = allSchedules.some((other) => {
        if (other.id === selectedSchedule.id || other.day_of_week !== manualDay) return false;
        if (!other.lecturer_names || !String(other.lecturer_names).toLowerCase().includes(lecturerName)) return false;
        const otherStart = other.start_minute ?? 470;
        const otherEnd = other.end_minute ?? (otherStart + 100);
        return manualStartMinute < otherEnd && otherStart < endMin;
      });
      if (lecturerOverlap) {
        issues.push('Dosen pengampu memiliki jadwal mengajar lain pada waktu tersebut.');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      targetRoom,
      duration,
      endMin,
      endTime: minuteToTime(endMin),
    };
  }, [selectedSchedule, manualDay, manualStartMinute, manualRoomId, rooms, allSchedules]);

  // Filtered swap candidates
  const swapCandidates = useMemo(() => {
    if (!selectedSchedule) return [];
    return allSchedules.filter((item) => {
      if (item.id === selectedSchedule.id) return false;
      if (!swapSearch.trim()) return true;
      const s = swapSearch.toLowerCase();
      return (
        item.course_name.toLowerCase().includes(s) ||
        item.course_code.toLowerCase().includes(s) ||
        String(item.class_name || '').toLowerCase().includes(s) ||
        String(item.lecturer_names || '').toLowerCase().includes(s)
      );
    });
  }, [allSchedules, selectedSchedule, swapSearch]);

  // Live validation for swap candidate
  const swapValidation = useMemo(() => {
    if (!selectedSchedule || !selectedSwapCandidate) {
      return { isValid: false, issues: [] };
    }

    const issues: string[] = [];
    const durA = (selectedSchedule.effective_sks || 2) * 50;
    const durB = (selectedSwapCandidate.effective_sks || 2) * 50;

    const studentsA = (selectedSchedule as any).expected_students || 40;
    const studentsB = (selectedSwapCandidate as any).expected_students || 40;

    // Check capacity A in Room B
    const roomB = rooms.find((r) => r.id === selectedSwapCandidate.room_id) || {
      capacity: (selectedSwapCandidate as any).room_capacity || 60,
    };
    if (roomB.capacity < studentsA) {
      issues.push(`Kapasitas ruangan ${selectedSwapCandidate.room_code} (${roomB.capacity}) kurang untuk kelas A (${studentsA} mhs).`);
    }

    // Check capacity B in Room A
    const roomA = rooms.find((r) => r.id === selectedSchedule.room_id) || {
      capacity: (selectedSchedule as any).room_capacity || 60,
    };
    if (roomA.capacity < studentsB) {
      issues.push(`Kapasitas ruangan ${selectedSchedule.room_code} (${roomA.capacity}) kurang untuk kelas B (${studentsB} mhs).`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      durA,
      durB,
    };
  }, [selectedSchedule, selectedSwapCandidate, rooms]);

  // Prompt confirmation modal before creating draft revision
  const handleInitiateAction = (type: 'RECOMMENDATION' | 'MANUAL' | 'SWAP', data: any) => {
    setPendingAction({ type, data });
    setConfirmModalOpen(true);
  };

  // Execution: Create Draft Revision from Published -> Update Target Entry -> Save Draft RPC -> Refresh Conflicts -> Navigate to Step 6
  const handleConfirmRevisionAndApply = async () => {
    if (!selectedSchedule || !pendingAction || !activeTerm?.id) return;
    setIsApplying(true);

    try {
      // 1. Get published version ID
      const versions = await scheduleVersionsService.getVersions(activeTerm.id);
      const publishedVersion =
        versions.find((v) => v.status === 'PUBLISHED') || versions[0];

      if (!publishedVersion?.id) {
        throw new Error('Versi jadwal terbit tidak ditemukan.');
      }

      // 2. Create new draft revision using RPC create_schedule_draft(copy_from = publishedVersion.id)
      const termTitle = `Revisi ${publishedVersion.title || `Jadwal Perkuliahan ${activeTerm.academic_year || ''}`}`;
      const newDraft = await scheduleVersionsService.createDraft(
        activeTerm.id,
        termTitle,
        publishedVersion.id
      );

      // 3. Set active draft in localStorage
      const activeKey = `spk:active-schedule-version:LECTURE:${user?.id || 'anonymous'}:${activeTerm.id}`;
      localStorage.setItem(activeKey, newDraft.id);

      // 4. Fetch all schedule entries of the newly created draft
      const { data: draftEntries, error: fetchErr } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('schedule_version_id', newDraft.id);

      if (fetchErr || !draftEntries || draftEntries.length === 0) {
        throw new Error('Gagal memuat entri draf jadwal baru dari database.');
      }

      // 5. Determine new slot values based on action type
      let targetOfferingId = (selectedSchedule as any).course_offering_id;
      let newRoomId = selectedSchedule.room_id;
      let newDay = selectedSchedule.day_of_week;
      let newStartMinute = selectedSchedule.start_minute;

      let swapPartnerOfferingId: string | null = null;
      let swapPartnerRoomId: string | null = null;
      let swapPartnerDay: number | null = null;
      let swapPartnerStartMinute: number | null = null;

      if (pendingAction.type === 'RECOMMENDATION') {
        const rec = pendingAction.data;
        newRoomId = rec.room_id || rec.roomId;
        newDay = Number(rec.day_of_week || rec.dayOfWeek);
        newStartMinute = Number(rec.start_minute || rec.startMinute);
      } else if (pendingAction.type === 'MANUAL') {
        newRoomId = manualRoomId;
        newDay = Number(manualDay);
        newStartMinute = Number(manualStartMinute);
      } else if (pendingAction.type === 'SWAP') {
        const candidate = pendingAction.data as CurrentPublishedSchedule;
        swapPartnerOfferingId = (candidate as any).course_offering_id;

        // Swap target gets candidate's slot
        newRoomId = candidate.room_id;
        newDay = Number(candidate.day_of_week);
        newStartMinute = Number(candidate.start_minute);

        // Candidate gets target's original slot
        swapPartnerRoomId = selectedSchedule.room_id;
        swapPartnerDay = Number(selectedSchedule.day_of_week);
        swapPartnerStartMinute = Number(selectedSchedule.start_minute);
      }

      // 6. Build clean all entries payload for save_draft_entries RPC
      const entriesPayload = draftEntries.map((e: any) => {
        const isTarget =
          (targetOfferingId && e.course_offering_id === targetOfferingId) ||
          e.id === selectedSchedule.id ||
          (e.day_of_week === selectedSchedule.day_of_week &&
            e.start_minute === selectedSchedule.start_minute &&
            e.room_id === selectedSchedule.room_id);

        if (isTarget) {
          return {
            course_offering_id: e.course_offering_id,
            room_id: newRoomId,
            day_of_week: Number(newDay),
            exam_date: null,
            start_minute: Number(newStartMinute),
          };
        }

        const isSwapPartner =
          swapPartnerOfferingId &&
          (e.course_offering_id === swapPartnerOfferingId ||
            (selectedSwapCandidate &&
              e.day_of_week === selectedSwapCandidate.day_of_week &&
              e.start_minute === selectedSwapCandidate.start_minute &&
              e.room_id === selectedSwapCandidate.room_id));

        if (isSwapPartner && swapPartnerRoomId && swapPartnerDay && swapPartnerStartMinute) {
          return {
            course_offering_id: e.course_offering_id,
            room_id: swapPartnerRoomId,
            day_of_week: Number(swapPartnerDay),
            exam_date: null,
            start_minute: Number(swapPartnerStartMinute),
          };
        }

        return {
          course_offering_id: e.course_offering_id,
          room_id: e.room_id,
          day_of_week: Number(e.day_of_week),
          exam_date: null,
          start_minute: Number(e.start_minute),
        };
      });

      // 7. Save draft entries via backend RPC with optimistic revision tracking
      await scheduleVersionsService.saveDraft(
        newDraft.id,
        newDraft.revision,
        entriesPayload,
        `REVISI_JADWAL_RESMI: ${selectedSchedule.course_name} (${selectedSchedule.class_name || 'A'})`
      );

      // 8. Refresh conflicts on new draft
      await scheduleVersionsService.refreshConflicts(newDraft.id);

      // 9. Save workflow state so Step 6 opens directly
      await scheduleVersionsService.saveWorkflowState(newDraft.id, newDraft.revision + 1, {
        activeStep: 6,
        creationMode: 'TEMPLATE',
        academicTermId: activeTerm.id,
        sourceVersionId: publishedVersion.id,
        isRevision: true,
      });

      // 10. Store Step 1 localStorage for smooth hydration
      const step1Key = `spk:scheduling-step1:${user?.id || 'anonymous'}:${activeTerm.id}`;
      localStorage.setItem(
        step1Key,
        JSON.stringify({
          activeStep: 6,
          scheduleCreationMode: 'TEMPLATE',
          updatedAt: new Date().toISOString(),
        })
      );

      setConfirmModalOpen(false);
      onClose();
      toast.success('Draf revisi jadwal berhasil dibuat dari jadwal resmi.');
      navigate('/penyusunan-jadwal');
    } catch (err: any) {
      console.error('Error applying revision:', err);
      toast.error(err.message || 'Gagal membuat draf revisi jadwal.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen || !selectedSchedule) return null;

  const displayedSks =
    selectedSchedule.effective_sks ||
    selectedSchedule.sks ||
    selectedSchedule.session_count ||
    2;
  const durationMinutes = displayedSks * 50;
  const expectedStudents =
    (selectedSchedule as any).expected_students ||
    (selectedSchedule as any).student_count ||
    60;
  const lecturerNames = selectedSchedule.lecturer_names || 'Dr. Kasnawi Al Hadi, S.Pd, M.Si.';
  const roomCapacity = (selectedSchedule as any).room_capacity || 60;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs transition-opacity"
      />

      {/* Right Drawer (Design System Compliant) */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-[460px] lg:max-w-[480px] bg-white/95 backdrop-blur-md border-l border-slate-200/80 shadow-xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-150">
        {/* Drawer Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/70 bg-white/90">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200/80">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  Detail Jadwal Perkuliahan
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Published (Resmi)
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                {selectedSchedule.course_name}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Tutup Detail"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Detailed Info Cards */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {/* 1. Kode MK */}
            <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Kode MK</span>
              <p className="font-mono font-bold text-slate-900 mt-0.5 text-xs">
                {selectedSchedule.course_code || 'MPS1071101'}
              </p>
            </div>

            {/* 2. Kelas & Semester */}
            <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Kelas & Semester</span>
              <p className="font-bold text-slate-900 mt-0.5 text-xs">
                Kelas {selectedSchedule.class_name || 'A'} • Sem {(selectedSchedule as any).semester || 1}
              </p>
            </div>

            {/* 3. Bobot SKS */}
            <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Bobot SKS</span>
              <p className="font-bold text-slate-900 mt-0.5 text-xs">
                {displayedSks} SKS ({durationMinutes} Menit)
              </p>
            </div>

            {/* 4. Peserta Terdaftar */}
            <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200/70 shadow-2xs">
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Peserta Terdaftar</span>
              <p className="font-bold text-slate-900 mt-0.5 text-xs">
                {expectedStudents} Mahasiswa
              </p>
            </div>
          </div>

          {/* Lecturer & Schedule Info */}
          <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/70 space-y-3 shadow-2xs text-xs">
            {/* Dosen Pengampu Utama */}
            <div>
              <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                Dosen Pengampu Utama
              </span>
              <p className="font-bold text-slate-900 mt-0.5 text-xs leading-snug">
                {lecturerNames}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/60">
              {/* Hari & Waktu */}
              <div>
                <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                  Hari & Waktu
                </span>
                <p className="font-semibold text-slate-900 mt-0.5 text-xs">
                  {selectedSchedule.day}, {selectedSchedule.start_time} – {selectedSchedule.end_time}
                </p>
              </div>

              {/* Ruangan */}
              <div>
                <span className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                  Ruangan
                </span>
                <p className="font-semibold text-slate-900 mt-0.5 text-xs">
                  {selectedSchedule.room_code || 'B2-02'} ({roomCapacity} Kursi)
                </p>
              </div>
            </div>
          </div>

          {/* Admin Smart Rescheduling Section */}
          {isAdmin ? (
            <div className="space-y-4 pt-2 border-t border-slate-200/80">
              {/* Notice that published schedule is immutable */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/70 text-2xs text-blue-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Penyesuaian Jadwal Terbit (Smart Rescheduling)</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Jadwal resmi bersifat permanen. Setiap penyesuaian akan dibuat secara otomatis ke dalam{' '}
                  <strong className="text-blue-800">Draf Revisi Baru</strong> tanpa mengganggu jadwal resmi yang sedang aktif.
                </p>
              </div>

              {/* 3 Admin Action Tabs */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('RECOMMENDATIONS')}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer text-2xs',
                    activeTab === 'RECOMMENDATIONS'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Rekomendasi Cerdas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('MANUAL')}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer text-2xs',
                    activeTab === 'MANUAL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <Filter className="w-3 h-3" />
                  <span>Manual</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('SWAP')}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer text-2xs',
                    activeTab === 'SWAP'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  <span>Tukar</span>
                </button>
              </div>

              {/* TAB 1: Smart Recommendations */}
              {activeTab === 'RECOMMENDATIONS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        ✨ Rekomendasi Pindah Jadwal Bebas Bentrok
                      </h4>
                      <p className="text-3xs text-slate-500 mt-0.5">
                        Sistem mendeteksi slot sesi dan ruangan terbaik yang bebas bentrok dan efisien kapasitas.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={loadingRecommendations}
                      onClick={() => fetchRecommendations(selectedSchedule)}
                      className="text-3xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
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
                        Slot saat ini merupakan opsi paling optimal atau Anda dapat menggunakan tab Manual.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {recommendations.map((rec: any, idx: number) => {
                        const dayName = rec.dayName || dayOfWeekToName(rec.day_of_week || rec.dayOfWeek);
                        const startTime = rec.startTime || minuteToTime(rec.start_minute || rec.startMinute);
                        const endTime = rec.endTime || minuteToTime(rec.end_minute || rec.endMinute);
                        const roomCode = rec.roomCode || rec.room_code || 'Ruang';
                        const roomName = rec.roomName || rec.room_name || 'Ruang Kuliah';
                        const cap = rec.roomCapacity || rec.room_capacity || 60;
                        const seatWaste = rec.seatWaste ?? cap - expectedStudents;

                        return (
                          <div
                            key={rec.id || idx}
                            className={cn(
                              'p-3.5 rounded-2xl border transition-all shadow-2xs',
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
                                    {roomCode} • {roomName} ({cap} Kursi)
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleInitiateAction('RECOMMENDATION', rec)}
                                className="px-3 py-1.5 text-2xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                              >
                                Pilih Jadwal Ini
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
              {activeTab === 'MANUAL' && (
                <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-700" />
                    Penyesuaian Manual Slot & Ruangan
                  </h4>

                  <div className="space-y-3 text-xs">
                    {/* Select Day */}
                    <div>
                      <label className="block text-3xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Pilih Hari
                      </label>
                      <select
                        value={manualDay}
                        onChange={(e) => setManualDay(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 text-xs"
                      >
                        {daysList.map((d) => (
                          <option key={d.num} value={d.num}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Select Start Time */}
                    <div>
                      <label className="block text-3xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Sesi Jam Mulai
                      </label>
                      <select
                        value={manualStartMinute}
                        onChange={(e) => setManualStartMinute(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 text-xs"
                      >
                        {standardSessions.map((s) => (
                          <option key={s.num} value={s.startMinute}>
                            {s.label} ({minuteToTime(s.startMinute)} – {minuteToTime(s.startMinute + durationMinutes)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Select Room */}
                    <div>
                      <label className="block text-3xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Ruang Kuliah
                      </label>
                      <select
                        value={manualRoomId}
                        onChange={(e) => setManualRoomId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 text-xs"
                      >
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.code} — {r.name} ({r.capacity} Kursi, {r.room_type || 'Teori'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Validation Feedback */}
                    <div className="pt-2">
                      {manualValidation.isValid ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-2xs text-emerald-800 space-y-1">
                          <div className="flex items-center gap-1 font-bold">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Slot & Ruangan Bebas Bentrok</span>
                          </div>
                          <p className="text-3xs text-emerald-700">
                            Dosen pengampu dan ruangan tersedia, kapasitas ({manualValidation.targetRoom?.capacity || 60}) mencukupi {expectedStudents} mahasiswa.
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-2xs text-rose-800 space-y-1">
                          <div className="flex items-center gap-1 font-bold">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            <span>Terdapat Potensi Bentrok</span>
                          </div>
                          <ul className="text-3xs text-rose-700 list-disc pl-4 space-y-0.5">
                            {manualValidation.issues.map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!manualValidation.isValid}
                      onClick={() => handleInitiateAction('MANUAL', null)}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                    >
                      Terapkan Perubahan Manual
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: Swap (Tukar) */}
              {activeTab === 'SWAP' && (
                <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                    Tukar Jadwal dengan Kelas Lain
                  </h4>

                  <input
                    type="text"
                    placeholder="Cari mata kuliah atau kelas lain..."
                    value={swapSearch}
                    onChange={(e) => setSwapSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {swapCandidates.slice(0, 10).map((cand) => {
                      const isSelected = selectedSwapCandidate?.id === cand.id;
                      return (
                        <div
                          key={cand.id}
                          onClick={() => setSelectedSwapCandidate(cand)}
                          className={cn(
                            'p-2.5 rounded-xl border text-xs cursor-pointer transition-all',
                            isSelected
                              ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-900 leading-snug">
                                {cand.course_name} ({cand.class_name || 'A'})
                              </p>
                              <span className="text-3xs text-slate-500 block mt-0.5">
                                {cand.day}, {cand.start_time} – {cand.end_time} • {cand.room_code}
                              </span>
                            </div>
                            <span className="text-3xs font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                              {cand.effective_sks || cand.sks || 2} SKS
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedSwapCandidate && (
                    <div className="pt-2 border-t border-slate-200/70 space-y-2">
                      {swapValidation.isValid ? (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-3xs text-emerald-800">
                          ✓ Pertukaran slot dan ruangan valid & bebas bentrok.
                        </div>
                      ) : (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-3xs text-rose-800">
                          ✕ {swapValidation.issues.join(' • ')}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!swapValidation.isValid}
                        onClick={() => handleInitiateAction('SWAP', selectedSwapCandidate)}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                      >
                        Tukar Jadwal Ini
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Non-admin notice */
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-center text-3xs text-slate-500">
              Jadwal resmi ini telah diterbitkan dan berstatus aktif. Hak pengubahan hanya dimiliki oleh Administrator.
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200/70 bg-white/95 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/penyusunan-jadwal');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-xl transition-colors cursor-pointer"
            >
              <span>Buka Modul Penyusunan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal: "BUAT REVISI JADWAL?" */}
      {confirmModalOpen && pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  BUAT REVISI JADWAL?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Jadwal ini sudah diterbitkan secara resmi. Perubahan akan dibuat sebagai{' '}
                  <strong className="text-slate-900">draf revisi baru</strong>. Jadwal resmi yang sedang berlaku tidak akan berubah sampai revisi baru diterbitkan.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-2xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Target: {selectedSchedule.course_name} ({selectedSchedule.class_name || 'A'})</span>
              </div>
              <p className="text-3xs text-slate-500">
                Sistem akan menyalin seluruh entri jadwal resmi, menerapkan penyesuaian baru, dan membuka Tahap 6 (Preview & Publikasi) untuk ditinjau.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isApplying}
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={handleConfirmRevisionAndApply}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-600/20 cursor-pointer disabled:opacity-50"
              >
                {isApplying ? 'Memproses Revisi...' : 'Buat Revisi & Terapkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
