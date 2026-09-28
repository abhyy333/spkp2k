import React, { useState } from 'react';
import {
  Calendar,
  RotateCcw,
  Sparkles,
  History,
  Edit3,
  Trash2,
  Eraser,
  Check,
  X,
  Save,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { AcademicTerm, ScheduleVersion } from '../../../types';
import { cn } from '../../../lib/utils';

interface SchedulingActiveHeaderProps {
  activeTerm: AcademicTerm | null;
  mode: 'TEMPLATE' | 'MANUAL' | null;
  currentVersion?: ScheduleVersion | null;
  isDirty?: boolean;
  isSavingDraft?: boolean;
  onSaveDraft?: () => Promise<void>;
  onResetWorkflow?: () => void;
  onOpenHistory?: () => void;
  onUpdateTitle?: (newTitle: string) => Promise<void>;
  onClearSchedule?: () => void;
  onDeleteDraft?: () => void;
}

export const SchedulingActiveHeader: React.FC<SchedulingActiveHeaderProps> = ({
  activeTerm,
  mode,
  currentVersion,
  isDirty = false,
  isSavingDraft = false,
  onSaveDraft,
  onResetWorkflow,
  onOpenHistory,
  onUpdateTitle,
  onClearSchedule,
  onDeleteDraft,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(currentVersion?.title || '');
  const [savingTitle, setSavingTitle] = useState(false);

  const termLabel = activeTerm
    ? `${activeTerm.semester_type || activeTerm.term || 'GANJIL'} ${activeTerm.academic_year || activeTerm.year || '2026/2027'}`
    : 'GANJIL 2026/2027';

  const defaultScheduleName = `Jadwal Perkuliahan ${termLabel}`;
  const displayTitle = currentVersion?.title || defaultScheduleName;

  const handleSaveTitle = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = titleInput.trim();
    if (!clean || clean === currentVersion?.title) {
      setIsEditingTitle(false);
      return;
    }
    if (onUpdateTitle) {
      try {
        setSavingTitle(true);
        await onUpdateTitle(clean);
        setIsEditingTitle(false);
      } catch {
        // error handled by caller
      } finally {
        setSavingTitle(false);
      }
    } else {
      setIsEditingTitle(false);
    }
  };

  const handleStartEdit = () => {
    setTitleInput(currentVersion?.title || defaultScheduleName);
    setIsEditingTitle(true);
  };

  const isPublished = currentVersion?.status === 'PUBLISHED';
  const isDraftSaved = Boolean(currentVersion?.id);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Editable Schedule Name */}
          {isEditingTitle ? (
            <form onSubmit={handleSaveTitle} className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="Nama Jadwal..."
                className="text-base font-bold text-slate-900 px-2.5 py-1 border border-blue-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                maxLength={80}
              />
              <button
                type="submit"
                disabled={savingTitle}
                className="p-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                title="Simpan Nama"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTitle(false)}
                className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Batal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {displayTitle}
              </h1>
              {onUpdateTitle && currentVersion && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Ubah Nama Jadwal"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Term Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>{termLabel}</span>
          </div>

          {/* Mode Badge */}
          {mode && (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>{mode === 'TEMPLATE' ? 'Template Semester' : 'Kustom Manual'}</span>
            </div>
          )}

          {/* Dirty & Database Save Status Badge */}
          {mode && (
            isDraftSaved ? (
              isDirty ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>Ada Perubahan Belum Disimpan</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Tersimpan di Database</span>
                </div>
              )
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Belum Disimpan ke Database</span>
              </div>
            )
          )}
        </div>

        <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
          Alur penyusunan jadwal perkuliahan terpadu berdasarkan paket kurikulum, rombel kelas, dosen pengampu, ruangan, sesi waktu, dan optimasi Simulated Annealing.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {/* Explicit Save Draft Button */}
        {mode && onSaveDraft && (
          <button
            type="button"
            disabled={isSavingDraft || (!isDirty && isDraftSaved)}
            onClick={onSaveDraft}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer',
              !isDraftSaved || isDirty
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 active:scale-98'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            )}
            title={
              !isDraftSaved
                ? 'Simpan alur penyusunan ini sebagai draf resmi di database'
                : isDirty
                ? 'Simpan perubahan ke draf database'
                : 'Seluruh perubahan telah tersimpan'
            }
          >
            <Save className={cn('w-3.5 h-3.5', isSavingDraft && 'animate-spin')} />
            <span>
              {isSavingDraft
                ? 'Menyimpan...'
                : !isDraftSaved
                ? 'Simpan Draft'
                : isDirty
                ? 'Simpan Perubahan'
                : 'Tersimpan'}
            </span>
          </button>
        )}

        {/* Kosongkan Draft button on Draft */}
        {!isPublished && isDraftSaved && onClearSchedule && (
          <button
            type="button"
            onClick={onClearSchedule}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
            title="Kosongkan alokasi waktu dan ruangan pada draf ini untuk mulai susun ulang"
          >
            <Eraser className="w-3.5 h-3.5 text-amber-600" />
            <span>Kosongkan Draft</span>
          </button>
        )}

        {/* Hapus Draft button */}
        {!isPublished && isDraftSaved && onDeleteDraft && (
          <button
            type="button"
            onClick={onDeleteDraft}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
            title="Hapus draf jadwal yang tidak digunakan"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Hapus Draft</span>
          </button>
        )}

        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
            title="Buka Riwayat Penyusunan Jadwal"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Riwayat Versi</span>
          </button>
        )}

        {mode && onResetWorkflow && (
          <button
            type="button"
            onClick={onResetWorkflow}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            title="Mulai Ulang Alur Penyusunan"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Mulai Ulang</span>
          </button>
        )}
      </div>
    </div>
  );
};
