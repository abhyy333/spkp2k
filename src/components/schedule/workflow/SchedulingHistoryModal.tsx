import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  RotateCcw,
  Eye,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Search,
  Calendar,
  Edit3,
  Eraser,
  Trash2,
  Check,
} from 'lucide-react';
import { ScheduleVersion, AcademicTerm } from '../../../types';
import { scheduleVersionsService } from '../../../services/scheduleVersions.service';
import { toast } from '../../ui/Toast';
import {
  ScheduleActionConfirmDialog,
  ScheduleActionDialogState,
} from '../versioning/ScheduleActionConfirmDialog';

interface SchedulingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTerm: AcademicTerm | null;
  onRestoreVersion: (version: ScheduleVersion) => Promise<void>;
  onResumeDraft: (version: ScheduleVersion) => Promise<void>;
  onOpenPublishedViewer: () => void;
}

export const SchedulingHistoryModal: React.FC<SchedulingHistoryModalProps> = ({
  isOpen,
  onClose,
  activeTerm,
  onRestoreVersion,
  onResumeDraft,
  onOpenPublishedViewer,
}) => {
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEmptyDrafts, setShowEmptyDrafts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected version for Detail View
  const [detailVersion, setDetailVersion] = useState<ScheduleVersion | null>(null);

  // Selected version for Restore Confirmation
  const [restoreTargetVersion, setRestoreTargetVersion] = useState<ScheduleVersion | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Rename state
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  // Clear and Delete Action Dialog state
  const [actionDialog, setActionDialog] = useState<ScheduleActionDialogState>({
    type: null,
    version: null,
  });
  const [actionProcessing, setActionProcessing] = useState(false);

  // Fetch versions
  const fetchVersions = async () => {
    if (!activeTerm?.id) return;
    setLoading(true);
    try {
      const list = await scheduleVersionsService.getVersions(activeTerm.id);
      setVersions(list);
    } catch (err) {
      console.error('Failed to load schedule versions:', err);
      toast.error('Gagal memuat riwayat penyusunan jadwal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
      setDetailVersion(null);
      setRestoreTargetVersion(null);
      setEditingVersionId(null);
    }
  }, [isOpen, activeTerm?.id]);

  if (!isOpen) return null;

  // Filter versions
  const filteredVersions = versions.filter((v) => {
    const isEmptyDraft =
      v.status === 'DRAFT' &&
      (!v.scope_offering_ids || v.scope_offering_ids.length === 0) &&
      !v.workflow_state;

    if (!showEmptyDrafts && isEmptyDraft) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (v.title || '').toLowerCase().includes(q);
      const matchStatus = (v.status || '').toLowerCase().includes(q);
      const matchNum = String(v.version_number || '').includes(q);
      if (!matchTitle && !matchStatus && !matchNum) return false;
    }

    return true;
  });

  const handleConfirmRestore = async () => {
    if (!restoreTargetVersion) return;
    setRestoring(true);
    try {
      await onRestoreVersion(restoreTargetVersion);
      setRestoreTargetVersion(null);
      onClose();
    } catch (err: any) {
      console.error('Restore error:', err);
      toast.error(err?.message || 'Gagal memulihkan versi jadwal.');
    } finally {
      setRestoring(false);
    }
  };

  const handleStartRename = (v: ScheduleVersion) => {
    setEditingVersionId(v.id);
    setNewTitle(v.title || `Jadwal Perkuliahan Versi ${v.version_number}`);
  };

  const handleSaveRename = async (vId: string) => {
    if (!newTitle.trim()) return;
    try {
      setSavingTitle(true);
      await scheduleVersionsService.updateVersionTitle(vId, newTitle.trim());
      toast.success('Nama jadwal berhasil diperbarui.');
      setVersions((prev) => prev.map((item) => (item.id === vId ? { ...item, title: newTitle.trim() } : item)));
      setEditingVersionId(null);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah nama jadwal.');
    } finally {
      setSavingTitle(false);
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
        await fetchVersions();
      } else if (actionDialog.type === 'DELETE') {
        const result = await scheduleVersionsService.deleteVersion(target.id, target);
        setActionDialog({ type: null, version: null });
        await fetchVersions();

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
      console.error('Action error in SchedulingHistoryModal:', err);
      toast.error(err.message || 'Gagal memproses aksi.');
    } finally {
      setActionProcessing(false);
    }
  };

  const getSourceLabel = (v: ScheduleVersion) => {
    if (v.source_version_id) {
      const found = versions.find((item) => item.id === v.source_version_id);
      const numLabel = found?.version_number ? `Versi ${found.version_number}` : 'Versi Sebelumnya';
      return `Dipulihkan dari ${numLabel}`;
    }
    return 'Penyusunan Baru';
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Riwayat Penyusunan Jadwal
              </h2>
              <p className="text-xs text-slate-500">
                Daftar semua versi draf, publikasi resmi, dan pemulihan jadwal untuk periode {activeTerm?.semester_type || 'GANJIL'} {activeTerm?.academic_year || '2026/2027'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama jadwal, versi, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-2xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showEmptyDrafts}
                onChange={(e) => setShowEmptyDrafts(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Tampilkan Draf Kosong</span>
            </label>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Memuat riwayat jadwal...
            </div>
          ) : filteredVersions.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <History className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">
                Tidak ada riwayat penyusunan yang sesuai
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? 'Coba ubah kata kunci pencarian Anda.'
                  : 'Belum ada versi jadwal lain yang tersimpan untuk periode aktif ini.'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white text-3xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Nama Jadwal</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Jumlah Kelas</th>
                      <th className="py-3 px-4">Dibuat</th>
                      <th className="py-3 px-4">Diterbitkan</th>
                      <th className="py-3 px-4">Sumber</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVersions.map((v) => {
                      const scopeCount = v.scope_offering_ids?.length || 0;
                      const isPub = v.status === 'PUBLISHED';
                      const isDraft = v.status === 'DRAFT';
                      const isReplaced = v.status === 'REPLACED';
                      const isEditing = editingVersionId === v.id;

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  autoFocus
                                  value={newTitle}
                                  onChange={(e) => setNewTitle(e.target.value)}
                                  className="px-2 py-1 text-xs border border-blue-400 rounded-lg focus:outline-none"
                                />
                                <button
                                  type="button"
                                  disabled={savingTitle}
                                  onClick={() => handleSaveRename(v.id)}
                                  className="p-1 text-white bg-blue-600 rounded"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingVersionId(null)}
                                  className="p-1 text-slate-500 bg-slate-100 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{v.title || 'Jadwal Perkuliahan'}</span>
                                <button
                                  type="button"
                                  onClick={() => handleStartRename(v)}
                                  className="p-1 text-slate-400 hover:text-blue-600 rounded"
                                  title="Ubah Nama"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {isPub ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>TERBIT · v{v.version_number || '1'}</span>
                              </span>
                            ) : isDraft ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Clock className="w-3 h-3" />
                                <span>DRAFT</span>
                              </span>
                            ) : isReplaced ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <span>TERGANTIKAN</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-700">
                                {v.status}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                            {scopeCount > 0 ? `${scopeCount} Kelas` : '0 Kelas'}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {formatDate(v.created_at)}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {formatDate(v.published_at)}
                          </td>

                          <td className="py-3.5 px-4 text-slate-500 text-3xs whitespace-nowrap">
                            {getSourceLabel(v)}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {/* Detail button */}
                              <button
                                type="button"
                                onClick={() => setDetailVersion(v)}
                                className="px-2.5 py-1 text-3xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Lihat Detail Riwayat"
                              >
                                <Eye className="w-3 h-3 text-slate-500" />
                                <span>Detail</span>
                              </button>

                              {/* Action: Buka Jadwal Resmi for Published */}
                              {isPub && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenPublishedViewer();
                                  }}
                                  className="px-2.5 py-1 text-3xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  title="Buka Halaman Jadwal Resmi"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Jadwal Resmi</span>
                                </button>
                              )}

                              {/* Action: Lanjutkan Draft if active/draft */}
                              {isDraft && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onResumeDraft(v);
                                  }}
                                  className="px-2.5 py-1 text-3xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  title="Lanjutkan Penyusunan Draf Ini"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  <span>Buka Draf</span>
                                </button>
                              )}

                              {/* Kosongkan Draft on Draft */}
                              {isDraft && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenClear(e, v)}
                                  className="px-2.5 py-1 text-3xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  title="Kosongkan alokasi draf ini"
                                >
                                  <Eraser className="w-3 h-3" />
                                  <span>Kosongkan Draft</span>
                                </button>
                              )}

                              {/* Action: Pulihkan sebagai Draft Baru */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRestoreTargetVersion(v);
                                }}
                                className="px-2.5 py-1 text-3xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Salin dan pulihkan sebagai draft baru"
                              >
                                <RotateCcw className="w-3 h-3 text-blue-600" />
                                <span>Pulihkan</span>
                              </button>

                              {/* Delete Draft on Non-Published */}
                              {!isPub && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenDelete(e, v)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center cursor-pointer"
                                  title="Hapus Draft"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Total: <strong>{filteredVersions.length}</strong> riwayat versi
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* 2. Detail Modal (Read Only) */}
      {detailVersion && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Detail Riwayat: {detailVersion.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {detailVersion.status === 'PUBLISHED' ? `Versi Resmi ${detailVersion.version_number}` : 'Draf Jadwal'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailVersion(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-3xs font-semibold text-slate-400 uppercase">Status</span>
                  <div className="font-bold text-slate-800 mt-0.5">{detailVersion.status}</div>
                </div>
                <div>
                  <span className="text-3xs font-semibold text-slate-400 uppercase">Jumlah Kelas</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {detailVersion.scope_offering_ids?.length || 0} Kelas
                  </div>
                </div>
                <div>
                  <span className="text-3xs font-semibold text-slate-400 uppercase">Waktu Dibuat</span>
                  <div className="text-slate-700 mt-0.5">{formatDate(detailVersion.created_at)}</div>
                </div>
                <div>
                  <span className="text-3xs font-semibold text-slate-400 uppercase">Waktu Diterbitkan</span>
                  <div className="text-slate-700 mt-0.5">{formatDate(detailVersion.published_at)}</div>
                </div>
                <div>
                  <span className="text-3xs font-semibold text-slate-400 uppercase">Sumber</span>
                  <div className="text-slate-700 mt-0.5">{getSourceLabel(detailVersion)}</div>
                </div>
              </div>

              {/* Workflow State Summary if present */}
              {detailVersion.workflow_state ? (
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Ringkasan State Penyusunan</span>
                  </h4>

                  <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-2 text-xs text-slate-700">
                    <div className="flex justify-between pb-1.5 border-b border-blue-200/60">
                      <span className="text-slate-500">Tahap Terakhir:</span>
                      <strong className="text-blue-900">
                        Tahap {detailVersion.workflow_state.activeStep || '6'}
                      </strong>
                    </div>
                    <div className="flex justify-between pb-1.5 border-b border-blue-200/60">
                      <span className="text-slate-500">Mode:</span>
                      <span className="font-semibold text-slate-800">
                        {detailVersion.workflow_state.creationMode || 'TEMPLATE'}
                      </span>
                    </div>
                    {Array.isArray(detailVersion.workflow_state.plannedCourses) && (
                      <div className="flex justify-between pb-1.5 border-b border-blue-200/60">
                        <span className="text-slate-500">Mata Kuliah Terpilih:</span>
                        <strong className="text-slate-800">
                          {detailVersion.workflow_state.plannedCourses.length} Mata Kuliah
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailVersion(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Restore Confirmation Modal */}
      {restoreTargetVersion && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Pulihkan Jadwal Ini Sebagai Draf Baru?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Data jadwal dari &quot;{restoreTargetVersion.title}&quot; akan disalin ke workspace draf aktif baru tanpa menghapus riwayat yang sudah ada.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={restoring}
                onClick={() => setRestoreTargetVersion(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={handleConfirmRestore}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{restoring ? 'Memulihkan...' : 'Ya, Pulihkan Sebagai Draf'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Action Confirmation Dialog (Clear & Delete Draft) */}
      <ScheduleActionConfirmDialog
        dialogState={actionDialog}
        onClose={() => {
          if (!actionProcessing) setActionDialog({ type: null, version: null });
        }}
        onConfirm={handleConfirmActionDialog}
        isProcessing={actionProcessing}
      />
    </div>
  );
};
