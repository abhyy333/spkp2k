import React, { useState, useEffect, useMemo } from 'react';
import {
  ScheduleEntry,
  Room,
  TimeSlot,
  LecturerAvailability,
  CourseOffering,
  Lecturer,
} from '../../../types';
import {
  SmartSuggestion,
  SuggestionType,
} from '../../../scheduling/suggestions/types';
import {
  generateGlobalSuggestions,
  generateSuggestionsForEntry,
  generateSuggestionsForConflict,
  applySuggestionToEntries,
} from '../../../scheduling/suggestions/suggestionEngine';
import { scheduleSuggestionsService } from '../../../services/scheduleSuggestions.service';
import { SuggestionCard } from './SuggestionCard';
import { PartialOptimizationModal } from './PartialOptimizationModal';
import { detectAllScheduleConflicts, ClientConflict } from '../../../lib/scheduleValidator';
import {
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Repeat,
  RefreshCw,
  CheckCheck,
  Filter,
} from 'lucide-react';
import { toast } from '../../ui/Toast';

interface SmartSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionId: string;
  currentEntries: ScheduleEntry[];
  targetEntry?: ScheduleEntry | null;
  targetConflict?: ClientConflict | null;
  rooms: Room[];
  timeSlots: TimeSlot[];
  availabilities: LecturerAvailability[];
  offerings: CourseOffering[];
  lecturers: Lecturer[];
  onApplyEntries: (newEntries: ScheduleEntry[]) => void;
}

export const SmartSuggestionModal: React.FC<SmartSuggestionModalProps> = ({
  isOpen,
  onClose,
  versionId,
  currentEntries,
  targetEntry,
  targetConflict,
  rooms,
  timeSlots,
  availabilities,
  offerings,
  lecturers,
  onApplyEntries,
}) => {
  const [activeTab, setActiveTab] = useState<'SUGGESTIONS' | 'PARTIAL'>('SUGGESTIONS');
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isApplyingId, setIsApplyingId] = useState<string | null>(null);

  // Compute live conflicts
  const liveConflicts = useMemo(() => {
    return detectAllScheduleConflicts(currentEntries, rooms, availabilities);
  }, [currentEntries, rooms, availabilities]);

  // Generate suggestions on open or target change
  const refreshSuggestions = () => {
    setLoading(true);
    try {
      let generated: SmartSuggestion[] = [];

      if (targetEntry) {
        generated = generateSuggestionsForEntry({
          entry: targetEntry,
          currentEntries,
          rooms,
          activeTimeSlots: timeSlots,
          availabilities,
          offerings,
          lecturers,
          versionId,
          cachedConflicts: liveConflicts,
          maxSuggestions: 8,
        });
      } else if (targetConflict) {
        generated = generateSuggestionsForConflict({
          conflict: targetConflict,
          currentEntries,
          rooms,
          activeTimeSlots: timeSlots,
          availabilities,
          offerings,
          lecturers,
          versionId,
          maxSuggestions: 8,
        });
      } else {
        generated = generateGlobalSuggestions({
          versionId,
          currentEntries,
          rooms,
          activeTimeSlots: timeSlots,
          availabilities,
          offerings,
          lecturers,
          existingConflicts: liveConflicts,
          maxSuggestionsPerItem: 3,
        });
      }

      setSuggestions(generated);

      // Optionally save generated suggestions to Supabase
      if (versionId && generated.length > 0) {
        scheduleSuggestionsService.saveSuggestions(versionId, generated);
      }
    } catch (err: any) {
      console.error('Error generating suggestions:', err);
      toast.error('Gagal menghasilkan rekomendasi penyesuaian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshSuggestions();
    }
  }, [isOpen, targetEntry, targetConflict, currentEntries]);

  if (!isOpen) return null;

  // Apply single suggestion
  const handleApplySuggestion = async (suggestion: SmartSuggestion) => {
    setIsApplyingId(suggestion.id);
    try {
      const updatedEntries = applySuggestionToEntries(currentEntries, suggestion, rooms);
      onApplyEntries(updatedEntries);

      // Update suggestion status in local state and db
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestion.id ? { ...s, status: 'APPLIED' } : s))
      );
      await scheduleSuggestionsService.applySuggestion(suggestion.id);

      toast.success(`Saran untuk ${suggestion.courseName} berhasil diterapkan!`);
    } catch (err: any) {
      console.error('Apply suggestion error:', err);
      toast.error('Gagal menerapkan rekomendasi.');
    } finally {
      setIsApplyingId(null);
    }
  };

  // Reject single suggestion
  const handleRejectSuggestion = async (suggestion: SmartSuggestion) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === suggestion.id ? { ...s, status: 'REJECTED' } : s))
    );
    await scheduleSuggestionsService.rejectSuggestion(suggestion.id);
    toast.info(`Saran untuk ${suggestion.courseName} ditolak.`);
  };

  // Apply all pending top suggestions (one per course)
  const handleApplyAllTop = async () => {
    const appliedOffIds = new Set<string>();
    let workingEntries = [...currentEntries];
    let count = 0;

    for (const s of suggestions) {
      if (s.status === 'PENDING' && !appliedOffIds.has(s.courseOfferingId)) {
        workingEntries = applySuggestionToEntries(workingEntries, s, rooms);
        appliedOffIds.add(s.courseOfferingId);
        count++;
      }
    }

    if (count > 0) {
      onApplyEntries(workingEntries);
      setSuggestions((prev) =>
        prev.map((s) => (appliedOffIds.has(s.courseOfferingId) ? { ...s, status: 'APPLIED' } : s))
      );
      toast.success(`${count} rekomendasi teratas berhasil diterapkan sekaligus.`);
    } else {
      toast.info('Tidak ada rekomendasi aktif yang dapat diterapkan.');
    }
  };

  // Filtered suggestions
  const filteredSuggestions = suggestions.filter((s) => {
    if (typeFilter === 'all') return true;
    return s.suggestionType === typeFilter;
  });

  const pendingCount = suggestions.filter((s) => s.status === 'PENDING').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Sistem Rekomendasi Pintar (Smart Suggestions)
                {liveConflicts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    {liveConflicts.length} Bentrok Aktif
                  </span>
                )}
              </h3>
              <p className="text-2xs text-slate-500">
                {targetEntry
                  ? `Rekomendasi penyesuaian khusus untuk: ${targetEntry.course_name} (${targetEntry.class_code})`
                  : targetConflict
                  ? `Solusi untuk mengatasi: ${targetConflict.title}`
                  : 'Algoritma mendeteksi alternatif slot, ruangan, atau pertukaran (swap) bebas bentrok'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch buttons */}
            <div className="flex p-0.5 bg-slate-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('SUGGESTIONS')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'SUGGESTIONS'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Saran Solusi ({suggestions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PARTIAL')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'PARTIAL'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Optimasi Parsial
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab 1: Suggestions Content */}
        {activeTab === 'SUGGESTIONS' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Filter & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/90">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  Jenis Saran:
                </span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
                >
                  <option value="all">Semua Tipe Solusi</option>
                  <option value="MOVE_TIME">Pindah Waktu Saja</option>
                  <option value="MOVE_ROOM">Ganti Ruangan Saja</option>
                  <option value="MOVE_TIME_ROOM">Pindah Waktu & Ruang</option>
                  <option value="SWAP">Tukar Slot Jadwal (Swap)</option>
                </select>

                <button
                  type="button"
                  onClick={refreshSuggestions}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  Hitung Ulang
                </button>
              </div>

              {pendingCount > 1 && (
                <button
                  type="button"
                  onClick={handleApplyAllTop}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-2xs cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Terapkan Semua Saran Teratas
                </button>
              )}
            </div>

            {/* Suggestions List */}
            {loading ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                <p className="text-xs font-semibold">Menganalisis alternatif slot dan ruangan bebas bentrok...</p>
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">
                  {liveConflicts.length === 0
                    ? 'Tidak ada konflik jadwal aktif'
                    : 'Tidak ada alternatif sederhana yang ditemukan'}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {liveConflicts.length === 0
                    ? 'Seluruh jadwal perkuliahan pada versi ini sudah optimal dan bebas dari bentrok ruangan atau dosen.'
                    : 'Gunakan tab "Optimasi Parsial" untuk mencari kombinasi pemindahan multi-kelas menggunakan Simulated Annealing.'}
                </p>
                {liveConflicts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('PARTIAL')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all cursor-pointer mt-2"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Buka Optimasi Parsial
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSuggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={handleApplySuggestion}
                    onReject={handleRejectSuggestion}
                    isApplying={isApplyingId === suggestion.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Partial Optimization Content */}
        {activeTab === 'PARTIAL' && (
          <div className="flex-1 overflow-y-auto">
            <PartialOptimizationModal
              isOpen={true}
              onClose={() => setActiveTab('SUGGESTIONS')}
              versionId={versionId}
              currentEntries={currentEntries}
              rooms={rooms}
              timeSlots={timeSlots}
              availabilities={availabilities}
              offerings={offerings}
              lecturers={lecturers}
              onApplyResult={(optimized) => {
                onApplyEntries(optimized);
                setActiveTab('SUGGESTIONS');
              }}
            />
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-2xs text-slate-500">
            Perubahan yang diterapkan akan langsung masuk ke rancangan (draft) jadwal Anda.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
