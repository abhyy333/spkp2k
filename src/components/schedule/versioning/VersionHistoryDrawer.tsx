import React, { useState, useMemo } from 'react';
import { ScheduleVersion } from '../../../types';
import { Drawer } from '../../ui/Drawer';
import {
  History,
  Copy,
  Scale,
  RotateCcw,
  Sparkles,
  Trash2,
  Edit3,
  Eraser,
  Check,
} from 'lucide-react';
import { formatDateTimeIndo } from '../../../lib/utils';
import { scheduleVersionsService } from '../../../services/scheduleVersions.service';
import { toast } from '../../ui/Toast';
import {
  ScheduleActionConfirmDialog,
  ScheduleActionDialogState,
} from './ScheduleActionConfirmDialog';

interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  versions: ScheduleVersion[];
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
  onOpenComparison: (versionAId: string, versionBId: string) => void;
  onVersionCreated: (newVersion: ScheduleVersion) => void;
  onRestoreVersion?: (sourceVersion: ScheduleVersion) => Promise<void>;
  termId: string;
}

export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  isOpen,
  onClose,
  versions,
  selectedVersionId,
  onSelectVersion,
  onOpenComparison,
  onVersionCreated,
  onRestoreVersion,
  termId,
}) => {
  const [copyModalOpen, setCopyModalOpen] = useState<boolean>(false);
  const [sourceVersionToCopy, setSourceVersionToCopy] = useState<ScheduleVersion | null>(null);
  const [copyTitleInput, setCopyTitleInput] = useState<string>('');
  const [isCopying, setIsCopying] = useState<boolean>(false);

  // Rename state
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [targetVersionToRename, setTargetVersionToRename] = useState<ScheduleVersion | null>(null);
  const [newTitleInput, setNewTitleInput] = useState<string>('');
  const [renaming, setRenaming] = useState<boolean>(false);

  // Clear and Delete Action Dialog state
  const [actionDialog, setActionDialog] = useState<ScheduleActionDialogState>({
    type: null,
    version: null,
  });
  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [showEmptyDrafts, setShowEmptyDrafts] = useState<boolean>(false);
  const [cleaningEmpty, setCleaningEmpty] = useState<boolean>(false);

  const isVersionEmptyDraft = (v: ScheduleVersion) => {
    if (v.status !== 'DRAFT') return false;
    const scopeLen = v.scope_offering_ids?.length || 0;
    const entryCount = (v as any).entry_count || (v as any).schedule_entries?.length || 0;
    const hasState =
      v.workflow_state &&
      typeof v.workflow_state === 'object' &&
      Array.isArray((v.workflow_state as any).plannedCourses) &&
      (v.workflow_state as any).plannedCourses.length > 0;
    return scopeLen === 0 && entryCount === 0 && !hasState;
  };

  const visibleVersions = useMemo(() => {
    if (showEmptyDrafts) return versions;
    return versions.filter((v) => !isVersionEmptyDraft(v));
  }, [versions, showEmptyDrafts]);

  const emptyDraftsCount = useMemo(() => {
    return versions.filter((v) => isVersionEmptyDraft(v)).length;
  }, [versions]);

  const handleOpenCopy = (v: ScheduleVersion) => {
    setSourceVersionToCopy(v);
    setCopyTitleInput(`${v.title || `Versi ${v.version_number}`} (Salinan)`);
    setCopyModalOpen(true);
  };

  const handleConfirmCopy = async () => {
    if (!sourceVersionToCopy || !copyTitleInput.trim()) return;
    setIsCopying(true);
    try {
      const created = await scheduleVersionsService.copyVersion(
        sourceVersionToCopy.id,
        copyTitleInput.trim(),
        termId
      );
      toast.success(`Versi baru berhasil disalin dari "${sourceVersionToCopy.title}".`);
      setCopyModalOpen(false);
      onVersionCreated(created);
    } catch (err: any) {
      console.error('Copy version error:', err);
      toast.error(err.message || 'Gagal menyalin versi jadwal.');
    } finally {
      setIsCopying(false);
    }
  };

  const handleOpenRename = (v: ScheduleVersion) => {
    setTargetVersionToRename(v);
    setNewTitleInput(v.title || `Jadwal Perkuliahan Versi ${v.version_number}`);
    setRenameModalOpen(true);
  };

  const handleConfirmRename = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!targetVersionToRename || !newTitleInput.trim()) return;
    setRenaming(true);
    try {
      const updated = await scheduleVersionsService.updateVersionTitle(
        targetVersionToRename.id,
        newTitleInput.trim()
      );
      toast.success('Nama jadwal berhasil diperbarui.');
      setRenameModalOpen(false);
      onVersionCreated(updated);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah nama jadwal.');
    } finally {
      setRenaming(false);
    }
  };

  const handleOpenClear = (e: React.MouseEvent, v: ScheduleVersion) => {
    e.stopPropagation();
    if (v.status === 'PUBLISHED') {
      toast.error('Jadwal yang sedang diterbitkan tidak dapat dikosongkan.');
      return;
    }
    setActionDialog({ type: 'CLEAR', version: v });
  };

  const handleOpenDelete = (e: React.MouseEvent, v: ScheduleVersion) => {
    e.stopPropagation();
    if (v.status === 'PUBLISHED') {
      toast.error('Jadwal yang sedang diterbitkan tidak dapat dihapus.');
      return;
    }
    setActionDialog({ type: 'DELETE', version: v });
  };

  const handleConfirmActionDialog = async () => {
    if (!actionDialog.type || !actionDialog.version?.id) {
      toast.error('Draft tidak ditemukan.');
      return;
    }
    const target = actionDialog.version;

    try {
      setActionProcessing(true);
      if (actionDialog.type === 'CLEAR') {
        await scheduleVersionsService.clearDraftEntries(target.id);
        toast.success('Draft berhasil dikosongkan.');
        setActionDialog({ type: null, version: null });
        const updated = await scheduleVersionsService.getVersionById(target.id);
        if (updated) onVersionCreated(updated);
      } else if (actionDialog.type === 'DELETE') {
        const result = await scheduleVersionsService.deleteVersion(target.id, target);
        setActionDialog({ type: null, version: null });
        onVersionCreated({ ...target, id: 'deleted' });

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
      console.error('Action error in VersionHistoryDrawer:', err);
      toast.error(err.message || 'Gagal memproses aksi.');
    } finally {
      setActionProcessing(false);
    }
  };

  const handleCleanupEmpty = async () => {
    setCleaningEmpty(true);
    try {
      const res = await scheduleVersionsService.cleanupEmptyDrafts(termId);
      toast.success(`${res.deletedCount} draf kosong berhasil dibersihkan.`);
      onVersionCreated({ ...versions[0], id: 'cleaned' });
    } catch (err: any) {
      toast.error(err.message || 'Gagal membersihkan draf kosong.');
    } finally {
      setCleaningEmpty(false);
    }
  };

  const handleRestore = async (v: ScheduleVersion) => {
    if (onRestoreVersion) {
      setRestoringVersionId(v.id);
      try {
        await onRestoreVersion(v);
        onClose();
      } catch (err: any) {
        console.error('Restore error:', err);
      } finally {
        setRestoringVersionId(null);
      }
    } else {
      setRestoringVersionId(v.id);
      try {
        const title = `Pemulihan ${v.title || 'Versi ' + v.version_number}`;
        const newDraft = await scheduleVersionsService.createDraft(termId, title, v.id);
        toast.success(`Versi ${v.version_number} berhasil dipulihkan sebagai draft baru.`);
        onVersionCreated(newDraft);
        onClose();
      } catch (err: any) {
        console.error('Restore version error:', err);
        toast.error(err.message || 'Gagal memulihkan versi jadwal.');
      } finally {
        setRestoringVersionId(null);
      }
    }
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="Riwayat Versi & Snapshot Jadwal"
        subtitle="Lacak jadwal terbit, pulihkan sebagai draft, ubah nama, kosongkan alokasi, atau salin cabang alternatif"
        width="w-full sm:max-w-md lg:max-w-xl"
        footer={
          <div className="flex justify-end w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Top Bar: Filters & Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                Daftar Riwayat ({visibleVersions.length})
              </span>

              {emptyDraftsCount > 0 && (
                <button
                  type="button"
                  disabled={cleaningEmpty}
                  onClick={handleCleanupEmpty}
                  className="inline-flex items-center gap-1 text-3xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 cursor-pointer disabled:opacity-50"
                  title="Hapus draf tanpa penempatan jadwal"
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>Bersihkan Draf Kosong ({emptyDraftsCount})</span>
                </button>
              )}
            </div>

            {visibleVersions.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenComparison(visibleVersions[0].id, visibleVersions[1]?.id || visibleVersions[0].id);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
              >
                <Scale className="w-3 h-3" />
                Bandingkan Versi
              </button>
            )}
          </div>

          {/* Version List */}
          <div className="space-y-3">
            {visibleVersions.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500 text-xs">
                Belum ada riwayat versi jadwal perkuliahan.
              </div>
            ) : (
              visibleVersions.map((ver) => {
                const isSelected = ver.id === selectedVersionId;
                const isPublished = ver.status === 'PUBLISHED';
                const isReplaced = ver.status === 'REPLACED' || ver.status === 'ARCHIVED';
                const isEmpty = isVersionEmptyDraft(ver);
                const scopeCount = ver.scope_offering_ids?.length || 0;
                const isRestoring = restoringVersionId === ver.id;
                const isClearing = actionProcessing && actionDialog.type === 'CLEAR' && actionDialog.version?.id === ver.id;
                const isDeleting = actionProcessing && actionDialog.type === 'DELETE' && actionDialog.version?.id === ver.id;

                return (
                  <div
                    key={ver.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isPublished
                        ? 'bg-emerald-50/40 border-emerald-300/80 shadow-xs ring-1 ring-emerald-500/20'
                        : isSelected
                        ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900">
                            {ver.title || `Jadwal Perkuliahan Versi ${ver.version_number}`}
                          </h4>

                          <button
                            type="button"
                            onClick={() => handleOpenRename(ver)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                            title="Ubah Nama"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>

                          <span
                            className={`px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider ${
                              isPublished
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isReplaced
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : isEmpty
                                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {isPublished
                              ? `TERBIT · Versi ${ver.version_number || '1'}`
                              : ver.status || 'DRAFT'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-3xs text-slate-500 flex-wrap">
                          <span>Dibuat: {formatDateTimeIndo(ver.created_at)}</span>
                          {scopeCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-slate-700">{scopeCount} Kelas</span>
                            </>
                          )}
                          {isEmpty && (
                            <span className="text-amber-600 font-semibold">(Draft Kosong)</span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-blue-600 text-white shrink-0 shadow-2xs">
                          Aktif
                        </span>
                      )}
                    </div>

                    {ver.changelog && (
                      <p className="text-2xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 mb-3 font-mono">
                        {ver.changelog}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 flex-wrap">
                      {/* Restore as new draft button for Published/Replaced versions */}
                      {(isPublished || isReplaced) && (
                        <button
                          type="button"
                          disabled={isRestoring}
                          onClick={() => handleRestore(ver)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-2xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{isRestoring ? 'Memulihkan...' : `Pulihkan Versi ${ver.version_number}`}</span>
                        </button>
                      )}

                      {/* Open draft button for non-empty active drafts */}
                      {ver.status === 'DRAFT' && !isSelected && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectVersion(ver.id);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-2xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-2xs cursor-pointer"
                        >
                          <span>Buka Draf</span>
                        </button>
                      )}

                      {/* Kosongkan Draft on Draft */}
                      {ver.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenClear(e, ver)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                          title="Kosongkan alokasi draf ini"
                        >
                          <Eraser className="w-3 h-3" />
                          <span>Kosongkan Draft</span>
                        </button>
                      )}

                      {/* Salin / Cabang */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCopy(ver);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Buat alternatif cabang dari jadwal ini"
                      >
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>Cabang</span>
                      </button>

                      {/* Delete draft */}
                      {ver.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenDelete(e, ver)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Hapus Draf"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Drawer>

      {/* Copy Modal */}
      {copyModalOpen && sourceVersionToCopy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Salin Cabang Jadwal Alternatif</h3>
              <p className="text-2xs text-slate-500 mt-0.5">
                Semua entri jadwal dari <strong className="text-slate-700">{sourceVersionToCopy.title}</strong> akan disalin ke draf cabang baru.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Jadwal Baru <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={copyTitleInput}
                onChange={(e) => setCopyTitleInput(e.target.value)}
                maxLength={80}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isCopying}
                onClick={() => setCopyModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isCopying || !copyTitleInput.trim()}
                onClick={handleConfirmCopy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isCopying ? 'Menyalin...' : 'Buat Cabang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModalOpen && targetVersionToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Ubah Nama Jadwal</h3>
              <p className="text-2xs text-slate-500 mt-0.5">
                Ganti nama draf/versi jadwal agar mudah dikenali.
              </p>
            </div>

            <form onSubmit={handleConfirmRename} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Jadwal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newTitleInput}
                  onChange={(e) => setNewTitleInput(e.target.value)}
                  maxLength={80}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={renaming}
                  onClick={() => setRenameModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={renaming || !newTitleInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{renaming ? 'Menyimpan...' : 'Simpan Nama'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Confirm Dialog (Kosongkan & Hapus Draft) */}
      <ScheduleActionConfirmDialog
        dialogState={actionDialog}
        onClose={() => {
          if (!actionProcessing) setActionDialog({ type: null, version: null });
        }}
        onConfirm={handleConfirmActionDialog}
        isProcessing={actionProcessing}
      />
    </>
  );
};
