import React from 'react';
import { AcademicTerm, ScheduleVersion } from '../../types';
import { ScheduleProgress } from './ScheduleProgress';
import {
  PlusCircle,
  Save,
  AlertTriangle,
  Send,
  Loader2,
  Calendar,
  Layers,
  History,
  Sparkles,
} from 'lucide-react';

interface ScheduleToolbarProps {
  terms: AcademicTerm[];
  selectedTermId: string;
  onTermChange: (termId: string) => void;
  versions: ScheduleVersion[];
  selectedVersionId: string;
  onVersionChange: (versionId: string) => void;
  selectedVersion: ScheduleVersion | null;
  scheduledCount: number;
  totalOfferings: number;
  conflictCount: number;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onCreateDraftClick: () => void;
  onSaveClick: () => void;
  onCheckConflictsClick: () => void;
  onOpenSAModalClick?: () => void;
  onOpenSuggestionsClick?: () => void;
  onOpenVersionDrawerClick?: () => void;
  onOpenComparisonClick?: () => void;
}

export const ScheduleToolbar: React.FC<ScheduleToolbarProps> = ({
  terms,
  selectedTermId,
  onTermChange,
  versions,
  selectedVersionId,
  onVersionChange,
  selectedVersion,
  scheduledCount,
  totalOfferings,
  conflictCount,
  hasUnsavedChanges,
  isSaving,
  onCreateDraftClick,
  onSaveClick,
  onCheckConflictsClick,
  onOpenSAModalClick,
  onOpenSuggestionsClick,
  onOpenVersionDrawerClick,
  onOpenComparisonClick,
}) => {
  const isDraft = selectedVersion?.status === 'DRAFT' || !selectedVersion?.status;
  const revision = selectedVersion?.revision ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
      {/* Top row: Selectors & Status */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Term & Version selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Term selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
              Periode:
            </span>
            <select
              value={selectedTermId}
              onChange={(e) => onTermChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.academic_year || t.year} {t.semester_type || t.term} {t.is_active ? '(Aktif)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Version selector */}
          {versions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
                Versi:
              </span>
              <select
                value={selectedVersionId}
                onChange={(e) => onVersionChange(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title || `Jadwal Perkuliahan v${v.version_number || '1'}`} ({v.status === 'PUBLISHED' ? `TERBIT · v${v.version_number || '1'}` : (v.status || 'DRAFT')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status & Version Badges */}
          {selectedVersion && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`px-2.5 py-1 rounded-full text-2xs font-bold ${
                  selectedVersion.status === 'PUBLISHED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {selectedVersion.status === 'PUBLISHED'
                  ? `TERBIT · Versi ${selectedVersion.version_number || '1'}`
                  : 'DRAFT'}
              </span>

              {hasUnsavedChanges && (
                <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  Belum Disimpan
                </span>
              )}
            </div>
          )}
        </div>

        {/* Progress Display */}
        {selectedVersion && (
          <ScheduleProgress
            scheduledCount={scheduledCount}
            totalOfferings={totalOfferings}
          />
        )}
      </div>

      {/* Bottom row: Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {/* Create Draft Button */}
          <button
            type="button"
            onClick={onCreateDraftClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
            Buat Draft Baru
          </button>

          {/* Check Conflicts Button */}
          {selectedVersion && (
            <button
              type="button"
              onClick={onCheckConflictsClick}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                conflictCount > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle
                className={`w-3.5 h-3.5 ${
                  conflictCount > 0 ? 'text-rose-600 animate-bounce' : 'text-slate-400'
                }`}
              />
              Periksa Konflik
              {conflictCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-3xs font-bold bg-rose-600 text-white">
                  {conflictCount}
                </span>
              )}
            </button>
          )}

          {/* Smart Suggestions Button (Phase 5) */}
          {selectedVersion && onOpenSuggestionsClick && (
            <button
              type="button"
              onClick={onOpenSuggestionsClick}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-2xs cursor-pointer ${
                conflictCount > 0
                  ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200 animate-pulse'
                  : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Saran Cerdas (Smart Suggestions)
            </button>
          )}

          {/* Simulated Annealing Optimization Button */}
          {selectedVersion && onOpenSAModalClick && (
            <button
              type="button"
              onClick={onOpenSAModalClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/90 rounded-xl transition-all shadow-2xs cursor-pointer group"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 group-hover:rotate-12 transition-transform" />
              Optimasi SA
            </button>
          )}

          {/* Version History & Compare Buttons */}
          {selectedVersion && onOpenVersionDrawerClick && (
            <button
              type="button"
              onClick={onOpenVersionDrawerClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-purple-600" />
              Riwayat Versi
            </button>
          )}

          {versions.length > 1 && onOpenComparisonClick && (
            <button
              type="button"
              onClick={onOpenComparisonClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              Bandingkan
            </button>
          )}
        </div>

        {/* Save & Publish Actions */}
        {selectedVersion && isDraft && (
          <div className="flex items-center gap-2">
            {/* Save Draft Button */}
            <button
              type="button"
              disabled={isSaving || !hasUnsavedChanges}
              onClick={onSaveClick}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Simpan Perubahan
                </>
              )}
            </button>

            {/* Publish Button (Disabled for Phase 3) */}
            <button
              type="button"
              disabled
              title="Publikasi tersedia setelah tahap validasi jadwal selesai."
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5 text-slate-400" />
              Publikasikan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
