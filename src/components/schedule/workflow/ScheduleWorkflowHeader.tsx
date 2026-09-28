import React, { useState } from 'react';
import { AcademicTerm, ScheduleVersion } from '../../../types';
import { Plus, Trash2, History, Calendar, Edit3, Eraser, Check, X } from 'lucide-react';

interface ScheduleWorkflowHeaderProps {
  activeTerm: AcademicTerm | null;
  currentVersion: ScheduleVersion | null;
  onNewScheduleClick: () => void;
  onDeleteScheduleClick?: () => void;
  onClearScheduleClick?: () => void;
  onHistoryClick: () => void;
  onUpdateTitle?: (title: string) => Promise<void>;
}

export const ScheduleWorkflowHeader: React.FC<ScheduleWorkflowHeaderProps> = ({
  activeTerm,
  currentVersion,
  onNewScheduleClick,
  onDeleteScheduleClick,
  onClearScheduleClick,
  onHistoryClick,
  onUpdateTitle,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(currentVersion?.title || '');
  const [savingTitle, setSavingTitle] = useState(false);

  const termBadge = activeTerm
    ? `${activeTerm.semester_type || 'GANJIL'} ${activeTerm.academic_year || '2026/2027'}`
    : 'GANJIL 2026/2027';

  const defaultTitle = `Jadwal Perkuliahan ${termBadge}`;
  const displayTitle = currentVersion?.title || defaultTitle;
  const isPublished = currentVersion?.status === 'PUBLISHED';

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
        // handled
      } finally {
        setSavingTitle(false);
      }
    } else {
      setIsEditingTitle(false);
    }
  };

  const handleStartEdit = () => {
    setTitleInput(currentVersion?.title || defaultTitle);
    setIsEditingTitle(true);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Title, Badge & Subtitle */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
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
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                {displayTitle}
              </h1>
              {onUpdateTitle && (
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

          <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {termBadge}
          </span>

          {currentVersion && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isPublished
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {isPublished
                ? `TERBIT · Versi ${currentVersion.version_number || '1'}`
                : 'DRAFT AKTIF'}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
          Alur lengkap pemilihan mata kuliah, review kelas, penugasan dosen, generate jadwal awal, optimasi Simulated Annealing, hingga publikasi.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button
          type="button"
          onClick={onNewScheduleClick}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          + Jadwal Baru
        </button>

        {currentVersion && !isPublished && onClearScheduleClick && (
          <button
            type="button"
            onClick={onClearScheduleClick}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer"
            title="Kosongkan alokasi draf ini"
          >
            <Eraser className="w-3.5 h-3.5 text-amber-600" />
            Kosongkan Draft
          </button>
        )}

        {currentVersion && !isPublished && onDeleteScheduleClick && (
          <button
            type="button"
            onClick={onDeleteScheduleClick}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus Draft
          </button>
        )}

        <button
          type="button"
          onClick={onHistoryClick}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
        >
          <History className="w-3.5 h-3.5 text-slate-500" />
          Riwayat
        </button>
      </div>
    </div>
  );
};
