import React, { useState, useRef, useEffect } from 'react';
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
  MoreVertical,
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

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

          {/* Status Badge */}
          {mode && (
            isDraftSaved ? (
              isDirty ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                  <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
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
          Penyusunan jadwal perkuliahan terpadu 3 tahap: Persiapan (MK, Rombel & Dosen), Penyusunan & Optimasi SA, dan Hasil Jadwal.
        </p>
      </div>

      {/* Simplified Header Actions: 1 Primary Action + [...] Menu */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Primary Action Button */}
        {mode && onSaveDraft && (
          <button
            type="button"
            disabled={isSavingDraft || (!isDirty && isDraftSaved)}
            onClick={onSaveDraft}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer',
              !isDraftSaved || isDirty
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 active:scale-98'
                : 'bg-slate-100 text-slate-500 border border-slate-200 cursor-default'
            )}
            title={
              !isDraftSaved
                ? 'Simpan alur penyusunan ini sebagai draf di database'
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

        {/* [...] Dropdown Menu for Secondary and Destructive Actions */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl transition-colors cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Menu Aksi Tambahan"
            aria-label="Menu Aksi Tambahan"
            aria-expanded={isMenuOpen}
          >
            <MoreVertical className="w-4 h-4 text-slate-600" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-40 animate-in fade-in-50 zoom-in-95">
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenHistory();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium transition-colors cursor-pointer text-left"
                >
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>Riwayat Versi Jadwal</span>
                </button>
              )}

              {mode && onResetWorkflow && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onResetWorkflow();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium transition-colors cursor-pointer text-left"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mulai Ulang Alur</span>
                </button>
              )}

              {/* Destructive Actions */}
              {!isPublished && isDraftSaved && (
                <div className="my-1 border-t border-slate-100" />
              )}

              {!isPublished && isDraftSaved && onClearSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onClearSchedule();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-amber-700 hover:bg-amber-50 font-medium transition-colors cursor-pointer text-left"
                >
                  <Eraser className="w-3.5 h-3.5 text-amber-600" />
                  <span>Kosongkan Draft</span>
                </button>
              )}

              {!isPublished && isDraftSaved && onDeleteDraft && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDeleteDraft();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-700 hover:bg-rose-50 font-medium transition-colors cursor-pointer text-left"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Hapus Draft Jadwal</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
