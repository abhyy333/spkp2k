import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Users,
  DoorClosed,
  RotateCcw,
  Sparkles,
  Search,
  CheckCircle2,
  Info,
  ArrowLeft,
  Calendar,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { scheduleConflictsService } from '../../services/scheduleConflicts.service';
import { scheduleVersionsService } from '../../services/scheduleVersions.service';
import { ScheduleConflict, ScheduleVersion, Room, TimeSlot, ScheduleEntry, CourseOffering } from '../../types';
import { toast } from '../../components/ui/Toast';
import { SmartSuggestion } from '../../scheduling/suggestions/types';
import { generateSuggestionsForConflict } from '../../scheduling/suggestions/suggestionEngine';
import { SuggestionCard } from '../../components/schedule/suggestions/SuggestionCard';
import { roomsService } from '../../services/rooms.service';
import { timeSlotsService } from '../../services/timeSlots.service';
import { scheduleEntriesService } from '../../services/scheduleEntries.service';
import { courseOfferingsService } from '../../services/courseOfferings.service';

export const ScheduleConflictsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const versionParam = searchParams.get('version') || searchParams.get('versionId') || searchParams.get('draftId') || '';

  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>(versionParam || 'all');
  const [selectedConflict, setSelectedConflict] = useState<ScheduleConflict | null>(null);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Master data caches for suggestions
  const [rooms, setRooms] = useState<Room[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [versionEntries, setVersionEntries] = useState<ScheduleEntry[]>([]);
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);

  // Stats (NO student conflicts)
  const [stats, setStats] = useState({
    total: 0,
    lecturerConflicts: 0,
    roomConflicts: 0,
    capacityConflicts: 0,
  });

  // Filters
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Sync version from URL query param if present
  useEffect(() => {
    if (versionParam && versionParam !== selectedVersionId) {
      setSelectedVersionId(versionParam);
    }
  }, [versionParam]);

  const fetchConflictsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [verList, list, s, rList, tList, offList] = await Promise.all([
        scheduleVersionsService.getVersions(),
        scheduleConflictsService.getConflicts(
          selectedVersionId !== 'all' ? selectedVersionId : undefined,
          {
            severity: severityFilter,
            type: typeFilter,
          }
        ),
        scheduleConflictsService.getStats(
          selectedVersionId !== 'all' ? selectedVersionId : undefined
        ),
        roomsService.getRooms(),
        timeSlotsService.getTimeSlots({ activeOnly: true }),
        courseOfferingsService.getOfferings(),
      ]);

      setVersions(verList);
      setConflicts(list);
      setStats(s);
      setRooms(rList);
      setTimeSlots(tList);
      setOfferings(offList);

      if (selectedVersionId && selectedVersionId !== 'all') {
        const entries = await scheduleEntriesService.getEntriesByVersionId(selectedVersionId);
        setVersionEntries(entries);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat konflik jadwal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflictsData();
  }, [selectedVersionId, severityFilter, typeFilter]);

  // Selected Version Object
  const currentVersionObj = useMemo(() => {
    if (!selectedVersionId || selectedVersionId === 'all') return null;
    return versions.find((v) => v.id === selectedVersionId) || null;
  }, [versions, selectedVersionId]);

  // Handle selecting a conflict to compute suggestions
  const handleSelectConflict = async (conflict: ScheduleConflict) => {
    setSelectedConflict(conflict);
    setLoadingSuggestions(true);

    try {
      let entries = versionEntries;
      if (conflict.schedule_version_id && (!entries || entries.length === 0)) {
        entries = await scheduleEntriesService.getEntriesByVersionId(conflict.schedule_version_id);
        setVersionEntries(entries);
      }

      // Format ClientConflict
      const clientConf = {
        id: conflict.id,
        type: conflict.conflict_type as any,
        severity: (conflict.severity?.toUpperCase() || 'HIGH') as any,
        title: conflict.title,
        description: conflict.description,
        entryIds: [],
        courseOfferingIds: [],
      };

      const generated = generateSuggestionsForConflict({
        conflict: clientConf,
        currentEntries: entries,
        rooms,
        activeTimeSlots: timeSlots,
        availabilities: [],
        offerings,
        lecturers: [],
        versionId: conflict.schedule_version_id || undefined,
        maxSuggestions: 5,
      });

      setSuggestions(generated);
    } catch (err) {
      console.error('Error generating suggestions for conflict:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const filteredConflicts = conflicts.filter((c) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (c.title && c.title.toLowerCase().includes(s)) ||
      (c.description && c.description.toLowerCase().includes(s)) ||
      (c.course_name && c.course_name.toLowerCase().includes(s)) ||
      (c.conflict_source && c.conflict_source.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Konflik Jadwal"
        subtitle="Deteksi dan evaluasi bentrok jadwal perkuliahan berdasarkan alokasi dosen, ruangan, dan kapasitas."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedVersionId && selectedVersionId !== 'all' && (
              <button
                type="button"
                onClick={() => navigate(`/penyusunan-jadwal?version=${selectedVersionId}`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" />
                <span>Kembali ke Penyusunan Jadwal</span>
              </button>
            )}
            <button
              onClick={() => {
                fetchConflictsData();
                toast.success('Pemeriksaan ulang konflik jadwal telah dijalankan.');
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Deteksi Ulang
            </button>
          </div>
        }
      />

      {/* Draft Context Banner (when filtered by a specific version) */}
      {currentVersionObj && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-3xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  Konteks Draf Aktif
                </span>
                <h3 className="text-sm font-bold text-slate-900">{currentVersionObj.title || 'Draf Jadwal Perkuliahan'}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Periode:{' '}
                  <strong className="text-slate-700">
                    {(currentVersionObj as any).academic_term?.academic_year || '2026/2027'}{' '}
                    {(currentVersionObj as any).academic_term?.semester_type || 'Ganjil'}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Status:{' '}
                  <strong className="text-slate-700">{currentVersionObj.status || 'DRAFT'}</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  Jumlah Konflik:{' '}
                  <strong className="text-rose-600">{stats.total}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/penyusunan-jadwal?version=${currentVersionObj.id}`)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Buka di Draf Workspace</span>
          </button>
        </div>
      )}

      {/* 3 Main Stat Cards (NO student conflict) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Konflik"
          value={stats.total}
          icon={<AlertTriangle className="w-6 h-6" />}
          iconBgColor="bg-rose-50 text-rose-600"
          subtitle="perlu segera dievaluasi"
        />

        <StatCard
          title="Bentrok Dosen"
          value={stats.lecturerConflicts}
          icon={<Users className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle="dosen mengajar pada waktu bersamaan"
        />

        <StatCard
          title="Bentrok Ruangan"
          value={stats.roomConflicts}
          icon={<DoorClosed className="w-6 h-6" />}
          iconBgColor="bg-purple-50 text-purple-600"
          subtitle="ruangan dipakai lebih dari satu kelas"
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Conflicts Table */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 items-center justify-between bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-2">
              {/* Version filter */}
              <select
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
              >
                <option value="all">Semua Versi Jadwal</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title || `Jadwal Perkuliahan v${v.version_number || '1'}`} ({v.status === 'PUBLISHED' ? `TERBIT · v${v.version_number || '1'}` : (v.status || 'DRAFT')})
                  </option>
                ))}
              </select>

              {/* Severity filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
              >
                <option value="all">Semua Tingkat</option>
                <option value="kritis">Kritis</option>
                <option value="tinggi">Tinggi</option>
                <option value="sedang">Sedang</option>
                <option value="rendah">Rendah</option>
              </select>

              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
              >
                <option value="all">Semua Jenis Konflik</option>
                <option value="LECTURER">Bentrok Dosen</option>
                <option value="ROOM">Bentrok Ruangan</option>
                <option value="CAPACITY">Kapasitas Ruangan</option>
              </select>

              <button
                onClick={() => {
                  setSelectedVersionId('all');
                  setSeverityFilter('all');
                  setTypeFilter('all');
                  setSearch('');
                }}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Reset
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari deskripsi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none w-48 bg-white"
              />
            </div>
          </div>

          {error && (
            <div className="p-4">
              <ErrorState message={error} onRetry={fetchConflictsData} />
            </div>
          )}

          {loading && <LoadingState type="table-skeleton" rows={5} />}

          {!loading && !error && filteredConflicts.length === 0 && (
            <div className="p-8">
              <EmptyState
                icon={<CheckCircle2 className="w-8 h-8 text-emerald-500" />}
                title="Tidak ada konflik jadwal yang terdeteksi"
                description="Semua alokasi dosen, ruangan, dan kapasitas tidak memiliki bentrok waktu."
              />
            </div>
          )}

          {!loading && !error && filteredConflicts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                  <tr>
                    <th className="py-3 px-3 w-8">#</th>
                    <th className="py-3 px-3">Tingkat</th>
                    <th className="py-3 px-3">Jenis</th>
                    <th className="py-3 px-4">Informasi Mata Kuliah</th>
                    <th className="py-3 px-4">Deskripsi Konflik</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredConflicts.map((c, idx) => (
                    <tr
                      key={c.id}
                      onClick={() => handleSelectConflict(c)}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                        selectedConflict?.id === c.id ? 'bg-blue-50/70 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-3xs font-bold uppercase ${
                            c.severity?.toLowerCase().includes('kritis') ||
                            c.severity?.toLowerCase().includes('critical')
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {c.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-3xs font-semibold bg-slate-100 text-slate-700">
                          {c.conflict_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800">{c.title || c.course_name || 'Mata Kuliah'}</p>
                        {c.course_code && (
                          <span className="font-mono text-2xs text-slate-400">{c.course_code}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 leading-relaxed max-w-xs">
                        {c.description}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                            c.is_resolved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {c.is_resolved ? 'Terselesaikan' : 'Belum Selesai'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Schedule Suggestions Panel */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-800">Rekomendasi Penyesuaian</h4>
            </div>
            {selectedConflict && (
              <span className="text-3xs font-mono text-slate-400">
                {selectedConflict.conflict_type}
              </span>
            )}
          </div>

          {loadingSuggestions ? (
            <div className="py-8 text-center text-slate-500 space-y-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">Menganalisis alternatif bebas bentrok...</p>
            </div>
          ) : selectedConflict && suggestions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-2xs text-slate-500">
                Pilih solusi untuk mengatasi bentrok pada{' '}
                <strong className="text-slate-700">{selectedConflict.title}</strong>:
              </p>
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onApply={async (sugg) => {
                    toast.success(`Saran untuk ${sugg.courseName} dipilih.`);
                  }}
                />
              ))}
            </div>
          ) : selectedConflict && suggestions.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
              <Info className="w-6 h-6 text-amber-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                Tidak ada saran langsung sederhana
              </p>
              <p className="text-2xs text-slate-500">
                Konflik ini memerlukan penyesuaian multi-kelas. Buka Draft Workspace untuk menjalankan Optimasi Parsial.
              </p>
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
              <Info className="w-8 h-8 text-blue-500 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                Pilih Baris Konflik
              </p>
              <p className="text-2xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                Klik salah satu baris konflik di tabel sebelah kiri untuk melihat rekomendasi alternatif slot waktu atau ruangan bebas bentrok.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

