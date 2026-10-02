import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Search,
  Download,
  FileSpreadsheet,
  Printer,
  Sparkles,
  LayoutGrid,
  List,
  Clock,
  DoorOpen,
  Users,
  MoreVertical,
  MoreHorizontal,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { schedulesService } from '../../services/schedules.service';
import { scheduleEntriesService } from '../../services/scheduleEntries.service';
import { lecturersService } from '../../services/lecturers.service';
import { roomsService } from '../../services/rooms.service';
import { timeSlotsService } from '../../services/timeSlots.service';
import { lecturerAvailabilityService } from '../../services/lecturerAvailability.service';
import { courseOfferingsService } from '../../services/courseOfferings.service';
import {
  CurrentPublishedSchedule,
  AcademicTerm,
  ScheduleEntry,
  Room,
  TimeSlot,
  LecturerAvailability,
  CourseOffering,
  Lecturer,
} from '../../types';
import { sortScheduleEntries, cn } from '../../lib/utils';
import { generateLectureSchedulePDF } from '../../lib/pdf/pdfGenerator';
import { generateLectureScheduleExcel } from '../../lib/excel/excelGenerator';
import { AppleWeeklyCalendar } from '../../components/schedule/AppleWeeklyCalendar';
import { AppleScheduleCardData } from '../../components/schedule/AppleScheduleCard';
import { SmartSuggestionModal } from '../../components/schedule/suggestions/SmartSuggestionModal';

export const OfficialScheduleTablePage: React.FC = () => {
  const { role, profile, user, isAdmin, isDosen } = useAuth();
  const navigate = useNavigate();

  const [schedules, setSchedules] = useState<CurrentPublishedSchedule[]>([]);
  const [term, setTerm] = useState<AcademicTerm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myLecturer, setMyLecturer] = useState<Lecturer | null>(null);

  // Tab: 'ALL' vs 'MINE'
  const [scopeTab, setScopeTab] = useState<'ALL' | 'MINE'>(isDosen ? 'MINE' : 'ALL');

  // View Mode: Table vs Matrix
  const [viewMode, setViewMode] = useState<'table' | 'matrix'>('table');
  const [selectedMatrixDate, setSelectedMatrixDate] = useState<Date>(new Date());

  // Filters
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState('ALL');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');

  // Smart Reschedule Modal State
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [targetEntryForReschedule, setTargetEntryForReschedule] = useState<ScheduleEntry | null>(null);
  const [rescheduleMasterData, setRescheduleMasterData] = useState<{
    rooms: Room[];
    timeSlots: TimeSlot[];
    availabilities: LecturerAvailability[];
    offerings: CourseOffering[];
    lecturers: Lecturer[];
  }>({ rooms: [], timeSlots: [], availabilities: [], offerings: [], lecturers: [] });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [list, activeTerm] = await Promise.all([
          schedulesService.getPublishedSchedule(),
          schedulesService.getActiveTerm(),
        ]);
        setSchedules(list);
        setTerm(activeTerm);

        // If user is Dosen, fetch associated lecturer info
        if (profile?.id) {
          let lect: Lecturer | null = null;
          if (profile.lecturer_id) {
            const res = await lecturersService.getLecturerById(profile.lecturer_id);
            lect = res?.lecturer || null;
          }
          if (!lect) {
            lect = await lecturersService.getLecturerByProfileId(profile.id);
          }
          if (!lect && profile.email) {
            lect = await lecturersService.getLecturerByEmail(profile.email);
          }
          setMyLecturer(lect);
        }
      } catch (err: any) {
        console.error('Error loading schedule:', err);
        setError('Gagal memuat jadwal perkuliahan.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile]);

  // Load master data for Admin smart rescheduling on demand
  const handleOpenSmartReschedule = async (item: CurrentPublishedSchedule) => {
    try {
      toast.info('Memuat rekomendasi rescheduling...');
      const [rList, tsList, avList, offList, lectList] = await Promise.all([
        roomsService.getRooms(),
        timeSlotsService.getTimeSlots(),
        lecturerAvailabilityService.getAvailabilities(),
        courseOfferingsService.getOfferings(),
        lecturersService.getLecturers(),
      ]);

      setRescheduleMasterData({
        rooms: rList,
        timeSlots: tsList,
        availabilities: avList,
        offerings: offList,
        lecturers: lectList,
      });

      // Construct target ScheduleEntry from item
      const entryObj: ScheduleEntry = {
        id: item.id || `entry-${item.course_offering_id}`,
        schedule_version_id: item.schedule_version_id || 'workspace',
        course_offering_id: item.course_offering_id || '',
        room_id: item.room_id || '',
        day_of_week: item.day_of_week || 1,
        start_minute: item.start_minute || 470,
        end_minute: item.end_minute || 620,
        course_name: item.course_name,
        course_code: item.course_code,
        class_code: item.class_name,
        student_count: item.student_count,
        lecturer_names: item.lecturer_names,
      };

      setTargetEntryForReschedule(entryObj);
      setIsSuggestionModalOpen(true);
    } catch (err: any) {
      toast.error('Gagal menyiapkan data rescheduling.');
    }
  };

  // Filter schedules based on scopeTab (MINE vs ALL) + filters
  const filteredSchedules = useMemo(() => {
    let list = schedules;

    // Filter by scopeTab (MINE)
    if (scopeTab === 'MINE') {
      const myNameLower = (myLecturer?.name || profile?.full_name || '').toLowerCase();
      if (myNameLower) {
        list = list.filter((s) => {
          const namesStr = Array.isArray(s.lecturer_names)
            ? s.lecturer_names.join(', ').toLowerCase()
            : String(s.lecturer_names || '').toLowerCase();
          return namesStr.includes(myNameLower);
        });
      }
    }

    // Apply secondary filters
    list = list.filter((s) => {
      if (!s) return false;
      if (dayFilter !== 'ALL' && String(s.day || '').trim().toLowerCase() !== dayFilter.toLowerCase()) {
        return false;
      }
      if (semesterFilter !== 'ALL' && String(s.semester) !== semesterFilter) {
        return false;
      }
      if (classFilter !== 'ALL' && s.class_name !== classFilter) {
        return false;
      }
      if (roomFilter !== 'ALL' && s.room_name !== roomFilter && s.room_code !== roomFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCourse = s.course_name?.toLowerCase().includes(q) || s.course_code?.toLowerCase().includes(q);
        const matchLecturer = Array.isArray(s.lecturer_names)
          ? s.lecturer_names.some((l: string) => l.toLowerCase().includes(q))
          : String(s.lecturer_names || '').toLowerCase().includes(q);
        const matchRoom = s.room_name?.toLowerCase().includes(q) || s.room_code?.toLowerCase().includes(q);
        if (!matchCourse && !matchLecturer && !matchRoom) return false;
      }
      return true;
    });

    return sortScheduleEntries(list);
  }, [schedules, scopeTab, myLecturer, profile, dayFilter, semesterFilter, classFilter, roomFilter, search]);

  // Unique lists for dropdowns
  const uniqueSemesters = useMemo(() => {
    const sems = new Set<number>();
    schedules.forEach((s) => {
      if (typeof s.semester === 'number' && s.semester > 0) sems.add(s.semester);
    });
    return Array.from(sems).sort((a, b) => a - b);
  }, [schedules]);

  const uniqueClasses = useMemo(() => {
    const cls = new Set<string>();
    schedules.forEach((s) => {
      if (s.class_name) cls.add(s.class_name);
    });
    return Array.from(cls).sort();
  }, [schedules]);

  const uniqueRooms = useMemo(() => {
    const rms = new Set<string>();
    schedules.forEach((s) => {
      if (s.room_name || s.room_code) rms.add(s.room_name || s.room_code || '');
    });
    return Array.from(rms).sort();
  }, [schedules]);

  // Map to AppleScheduleCardData for Matrix View
  const appleCardEntries = useMemo<AppleScheduleCardData[]>(() => {
    return filteredSchedules.map((item) => {
      return {
        id: item.id || item.scheduleEntryId || String(Math.random()),
        course_name: item.course_name,
        course_code: item.course_code,
        class_name: item.class_name || 'A',
        start_time: item.start_time,
        end_time: item.end_time,
        room_name: item.room_name || item.room_code || 'Ruang ?',
        lecturer_names: Array.isArray(item.lecturer_names) ? item.lecturer_names.join(', ') : item.lecturer_names || '',
        sks: item.effective_sks || item.sks || 3,
        raw: item,
      };
    });
  }, [filteredSchedules]);

  // Export handlers
  const handleDownloadPDF = async () => {
    if (filteredSchedules.length === 0) {
      toast.error('Tidak ada jadwal untuk diekspor.');
      return;
    }
    try {
      await generateLectureSchedulePDF(filteredSchedules, term);
      toast.success('File PDF Jadwal Perkuliahan berhasil diunduh.');
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Gagal membuat PDF.');
    }
  };

  const handleDownloadExcel = () => {
    if (filteredSchedules.length === 0) {
      toast.error('Tidak ada jadwal untuk diekspor.');
      return;
    }
    try {
      generateLectureScheduleExcel(filteredSchedules, term);
      toast.success('File Excel (.xlsx) Jadwal Perkuliahan berhasil diunduh.');
    } catch (err) {
      console.error('Excel error:', err);
      toast.error('Gagal membuat Excel.');
    }
  };

  if (loading) {
    return <LoadingState message="Memuat jadwal perkuliahan..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Export Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Jadwal Perkuliahan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tahun Akademik {term?.academic_year || term?.year || '2026/2027'} — Semester {term?.semester_type || term?.term || 'Ganjil'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Unduh PDF</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Unduh Excel</span>
          </button>
        </div>
      </div>

      {/* Scope Selector: [Semua Jadwal] [Jadwal Saya] */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="inline-flex p-1 bg-slate-200/80 rounded-xl">
          <button
            type="button"
            onClick={() => setScopeTab('ALL')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              scopeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Semua Jadwal
          </button>
          <button
            type="button"
            onClick={() => setScopeTab('MINE')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              scopeTab === 'MINE'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Jadwal Saya {myLecturer ? `(${myLecturer.code || 'Dosen'})` : ''}
          </button>
        </div>

        {/* View Switcher: Tabel vs Matriks */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabel</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                viewMode === 'matrix' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Matriks</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari mata kuliah, dosen, ruangan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
            />
          </div>

          {/* Hari Filter */}
          <div>
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
            >
              <option value="ALL">Semua Hari</option>
              <option value="Senin">Senin</option>
              <option value="Selasa">Selasa</option>
              <option value="Rabu">Rabu</option>
              <option value="Kamis">Kamis</option>
              <option value="Jumat">Jumat</option>
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
            >
              <option value="ALL">Semua Semester</option>
              {uniqueSemesters.map((sem) => (
                <option key={sem} value={String(sem)}>Semester {sem}</option>
              ))}
            </select>
          </div>

          {/* Ruangan Filter */}
          <div>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
            >
              <option value="ALL">Semua Ruangan</option>
              {uniqueRooms.map((rm) => (
                <option key={rm} value={rm}>{rm}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-2xs text-slate-500 pt-1">
          <span>Menampilkan <strong>{filteredSchedules.length}</strong> kelas perkuliahan</span>
          {(dayFilter !== 'ALL' || semesterFilter !== 'ALL' || roomFilter !== 'ALL' || search) && (
            <button
              type="button"
              onClick={() => {
                setDayFilter('ALL');
                setSemesterFilter('ALL');
                setClassFilter('ALL');
                setRoomFilter('ALL');
                setSearch('');
              }}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          {filteredSchedules.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">Tidak ada jadwal perkuliahan</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {scopeTab === 'MINE'
                  ? 'Anda tidak memiliki jadwal mengajar pada filter yang dipilih.'
                  : 'Belum ada jadwal yang cocok dengan kriteria pencarian.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">No</th>
                    <th className="py-3 px-4">Hari & Waktu</th>
                    <th className="py-3 px-4">Kode MK</th>
                    <th className="py-3 px-4">Mata Kuliah</th>
                    <th className="py-3 px-4">SKS</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Ruangan</th>
                    <th className="py-3 px-4">Dosen Pengampu</th>
                    <th className="py-3 px-4 text-center">Peserta</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchedules.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{item.day}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600 font-normal">{item.start_time} - {item.end_time}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-2xs text-slate-500 font-semibold">
                        {item.course_code || '-'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {item.course_name}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {item.effective_sks || item.sks}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md font-bold text-2xs bg-blue-50 text-blue-700 border border-blue-200/60">
                          {item.class_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium whitespace-nowrap">
                        {item.room_name || item.room_code}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {Array.isArray(item.lecturer_names)
                          ? item.lecturer_names.join(', ')
                          : item.lecturer_names || '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">
                        {item.student_count || item.expected_students || '-'}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenSmartReschedule(item)}
                            title="Atur Ulang Jadwal (Smart Rescheduling)"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs font-semibold text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs group"
                          >
                            <span className="font-bold text-slate-400 group-hover:text-blue-600">⋯</span>
                            <span>Atur Ulang Jadwal</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Matrix / Calendar View */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <AppleWeeklyCalendar
            entries={appleCardEntries}
            selectedDate={selectedMatrixDate}
            onSelectDate={setSelectedMatrixDate}
            onSelectEntry={(entry) => {
              if (isAdmin && entry.raw) {
                handleOpenSmartReschedule(entry.raw);
              }
            }}
          />
        </div>
      )}

      {/* Smart Rescheduling Modal for Admin */}
      {isSuggestionModalOpen && targetEntryForReschedule && (
        <SmartSuggestionModal
          isOpen={isSuggestionModalOpen}
          onClose={() => {
            setIsSuggestionModalOpen(false);
            setTargetEntryForReschedule(null);
          }}
          versionId={targetEntryForReschedule.schedule_version_id || 'workspace'}
          currentEntries={schedules.map((s) => ({
            id: s.id || `entry-${s.course_offering_id}`,
            schedule_version_id: s.schedule_version_id || 'workspace',
            course_offering_id: s.course_offering_id || '',
            room_id: s.room_id || '',
            day_of_week: s.day_of_week || 1,
            start_minute: s.start_minute || 470,
            end_minute: s.end_minute || 620,
            course_name: s.course_name,
            course_code: s.course_code,
            class_code: s.class_name,
            student_count: s.student_count,
            lecturer_names: s.lecturer_names,
          }))}
          targetEntry={targetEntryForReschedule}
          rooms={rescheduleMasterData.rooms}
          timeSlots={rescheduleMasterData.timeSlots}
          availabilities={rescheduleMasterData.availabilities}
          offerings={rescheduleMasterData.offerings}
          lecturers={rescheduleMasterData.lecturers}
          onApplyEntries={async (newEntries) => {
            setIsSuggestionModalOpen(false);
            setTargetEntryForReschedule(null);
            try {
              // Direct update to schedule entries in workspace/active schedule without creating an auto-version
              const updates = newEntries
                .filter((e) => e.id && !e.id.startsWith('temp-'))
                .map((e) => ({
                  id: e.id,
                  room_id: e.room_id,
                  day_of_week: e.day_of_week,
                  start_minute: e.start_minute,
                  end_minute: e.end_minute,
                }));
              if (updates.length > 0) {
                await scheduleEntriesService.batchUpdateEntries(updates);
              }
              toast.success('Rekomendasi jadwal berhasil diterapkan ke Jadwal Perkuliahan.');
            } catch (err: any) {
              console.error('Error applying rescheduling updates:', err);
              toast.error('Gagal menyimpan hasil perubahan jadwal.');
            }
            // Refresh schedule
            const refreshed = await schedulesService.getPublishedSchedule();
            setSchedules(refreshed);
          }}
        />
      )}
    </div>
  );
};
