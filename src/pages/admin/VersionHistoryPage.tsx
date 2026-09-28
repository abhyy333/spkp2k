import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Send,
  Layers,
  RotateCcw,
  Plus,
  Download,
  Scale,
  Trash2,
  Archive,
  ArchiveRestore,
  Eraser,
  EyeOff,
  Edit3,
  Search,
  Filter,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  CheckSquare,
  Square,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Modal } from '../../components/ui/Modal';
import { scheduleVersionsService } from '../../services/scheduleVersions.service';
import { academicTermsService } from '../../services/academicTerms.service';
import { ScheduleVersion, AcademicTerm } from '../../types';
import { formatDateTimeIndo } from '../../lib/utils';
import { VersionComparisonModal } from '../../components/schedule/versioning/VersionComparisonModal';
import { ClearActiveScheduleModal } from '../../components/admin/settings/ClearActiveScheduleModal';
import { toast } from '../../components/ui/Toast';
import { useNavigate } from 'react-router-dom';

export const VersionHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVersionIds, setSelectedVersionIds] = useState<Set<string>>(new Set());

  // Action Modals & States
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compVersionAId, setCompVersionAId] = useState<string>('');
  const [compVersionBId, setCompVersionBId] = useState<string>('');

  // Rename modal
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [targetVersionToRename, setTargetVersionToRename] = useState<ScheduleVersion | null>(null);
  const [newTitleInput, setNewTitleInput] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete modal (single / bulk)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [versionsToDelete, setVersionsToDelete] = useState<ScheduleVersion[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Clear modal (Kosongkan draf)
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [targetVersionToClear, setTargetVersionToClear] = useState<ScheduleVersion | null>(null);
  const [clearing, setClearing] = useState(false);

  // Tarik Jadwal modal
  const [clearActiveScheduleOpen, setClearActiveScheduleOpen] = useState(false);
  const [republishingId, setRepublishingId] = useState<string | null>(null);

  // Bulk cleanup empty drafts
  const [cleaningEmptyDrafts, setCleaningEmptyDrafts] = useState(false);

  const fetchVersionsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [termList, list] = await Promise.all([
        academicTermsService.getAcademicTerms(),
        scheduleVersionsService.getVersions(selectedTermId === 'all' ? undefined : selectedTermId),
      ]);
      setTerms(termList);
      setVersions(list);
      setSelectedVersionIds(new Set());
    } catch (err: any) {
      setError(err.message || 'Gagal memuat riwayat versi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersionsData();
  }, [selectedTermId]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = versions.length;
    const published = versions.filter((v) => v.status === 'PUBLISHED').length;
    const drafts = versions.filter((v) => v.status === 'DRAFT').length;
    const archived = versions.filter((v) => v.status === 'ARCHIVED' || v.status === 'REPLACED').length;
    return { total, published, drafts, archived };
  }, [versions]);

  // Meaningful versions for comparison (versions with entries or published)
  const meaningfulVersions = useMemo(() => {
    return versions.filter((v) => {
      const scopeLen = v.scope_offering_ids?.length || 0;
      const entryCount = (v as any).entry_count || (v as any).schedule_entries?.length || 0;
      return v.status === 'PUBLISHED' || scopeLen > 0 || entryCount > 0;
    });
  }, [versions]);

  // Filtered versions for table
  const filteredVersions = useMemo(() => {
    return versions.filter((v) => {
      if (statusFilter === 'PUBLISHED' && v.status !== 'PUBLISHED') return false;
      if (statusFilter === 'DRAFT' && v.status !== 'DRAFT') return false;
      if (statusFilter === 'ARCHIVED' && v.status !== 'ARCHIVED' && v.status !== 'REPLACED') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (v.title || '').toLowerCase().includes(q);
        const matchVer = String(v.version_number || '').toLowerCase().includes(q);
        const matchStatus = (v.status || '').toLowerCase().includes(q);
        if (!matchTitle && !matchVer && !matchStatus) return false;
      }
      return true;
    });
  }, [versions, statusFilter, searchQuery]);

  // Selection helpers
  const handleToggleSelect = (id: string) => {
    setSelectedVersionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedVersionIds.size === filteredVersions.length) {
      setSelectedVersionIds(new Set());
    } else {
      setSelectedVersionIds(new Set(filteredVersions.map((v) => v.id)));
    }
  };

  // 1. Rename Handler
  const handleOpenRename = (version: ScheduleVersion) => {
    setTargetVersionToRename(version);
    setNewTitleInput(version.title || `Jadwal Perkuliahan Versi ${version.version_number}`);
    setRenameModalOpen(true);
  };

  const handleConfirmRename = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!targetVersionToRename || !newTitleInput.trim()) return;

    try {
      setRenaming(true);
      const updated = await scheduleVersionsService.updateVersionTitle(
        targetVersionToRename.id,
        newTitleInput.trim()
      );
      toast.success('Nama jadwal berhasil diperbarui.');
      setVersions((prev) => prev.map((v) => (v.id === updated.id ? { ...v, title: updated.title } : v)));
      setRenameModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah nama jadwal.');
    } finally {
      setRenaming(false);
    }
  };

  // 2. Kosongkan Draft Handler
  const handleOpenClear = (version: ScheduleVersion) => {
    if (version.status === 'PUBLISHED') {
      toast.error('Jadwal yang sedang diterbitkan tidak dapat dikosongkan.');
      return;
    }
    setTargetVersionToClear(version);
    setClearModalOpen(true);
  };

  const handleConfirmClear = async () => {
    if (!targetVersionToClear) {
      toast.error('Draft tidak ditemukan.');
      return;
    }
    try {
      setClearing(true);
      await scheduleVersionsService.clearDraftEntries(targetVersionToClear.id);
      toast.success('Draft berhasil dikosongkan.');
      setClearModalOpen(false);
      await fetchVersionsData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengosongkan draf.');
    } finally {
      setClearing(false);
    }
  };

  // Republish / Restore Historical Version Handler
  const handleRepublish = async (version: ScheduleVersion) => {
    const isExam = version.type === 'UTS' || version.type === 'UAS';
    const typeLabel = isExam ? `Jadwal ${version.type}` : 'Jadwal Perkuliahan';
    const confirmMsg = `Pulihkan dan terbitkan kembali versi "${version.title || `Versi ${version.version_number}`}" sebagai ${typeLabel} resmi aktif? Jadwal ini akan langsung ditampilkan kepada Dosen dan Publik.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setRepublishingId(version.id);
      await scheduleVersionsService.republishVersion(version.id);
      toast.success(`${typeLabel} berhasil dipulihkan dan diterbitkan kembali sebagai jadwal resmi aktif!`);
      await fetchVersionsData();
    } catch (err: any) {
      console.error('Error republishing version:', err);
      toast.error(err.message || 'Gagal menerbitkan kembali versi jadwal.');
    } finally {
      setRepublishingId(null);
    }
  };

  // 3. Archive / Unarchive Handler
  const handleToggleArchive = async (version: ScheduleVersion) => {
    const isArchived = version.status === 'ARCHIVED';
    try {
      const updated = await scheduleVersionsService.archiveVersion(version.id, !isArchived);
      toast.success(
        !isArchived
          ? `Jadwal "${version.title}" berhasil diarsipkan.`
          : `Jadwal "${version.title}" dipulihkan dari arsip.`
      );
      setVersions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status arsip.');
    }
  };

  // 4. Single Delete Handler
  const handleOpenDeleteSingle = (version: ScheduleVersion) => {
    setVersionsToDelete([version]);
    setDeleteModalOpen(true);
  };

  // 5. Bulk Delete Handler
  const handleOpenDeleteBulk = () => {
    const toDelete = versions.filter((v) => selectedVersionIds.has(v.id));
    if (toDelete.length === 0) {
      toast.info('Pilih setidaknya satu versi jadwal untuk dihapus.');
      return;
    }
    setVersionsToDelete(toDelete);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (versionsToDelete.length === 0) {
      toast.error('Versi jadwal tidak ditemukan.');
      return;
    }

    const isSingle = versionsToDelete.length === 1;
    const singleTarget = versionsToDelete[0];
    const singleStatus = singleTarget?.status;
    const wasPublished = versionsToDelete.some((v) => v.status === 'PUBLISHED');
    const wasDraft = singleStatus === 'DRAFT';

    try {
      setDeleting(true);

      // 1. Call RPC and perform verified database deletion
      const res = await scheduleVersionsService.bulkDeleteVersions(versionsToDelete);

      // 2. Refetch fresh list directly from database (NO fake local state manipulation)
      const freshVersions = await scheduleVersionsService.getVersions(
        selectedTermId === 'all' ? undefined : selectedTermId
      );

      // 3. Verify IDs are eliminated from database
      const deletedIds = new Set(versionsToDelete.map((v) => v.id));
      const stillPresent = freshVersions.filter((v) => deletedIds.has(v.id));
      if (stillPresent.length > 0) {
        toast.error('Penghapusan belum tersinkronisasi. Silakan muat ulang data.');
        setVersions(freshVersions);
        return;
      }

      // Update state with fresh verified results
      setVersions(freshVersions);
      setSelectedVersionIds(new Set());
      setDeleteModalOpen(false);

      // Invalidate published caches if any published version was deleted
      if (wasPublished) {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('spk:cached-published-schedule');
          localStorage.removeItem('spk:cached-published-exams');
        }
        window.dispatchEvent(new CustomEvent('spk:published-schedule-updated'));
      }

      // 4. Toast success only after verified DB elimination
      if (isSingle) {
        if (singleStatus === 'DRAFT') {
          toast.success('Draft berhasil dihapus.');
        } else if (singleStatus === 'PUBLISHED') {
          toast.success('Jadwal aktif berhasil dihapus.');
        } else {
          toast.success('Riwayat jadwal berhasil dihapus.');
        }
      } else {
        if (wasPublished) {
          toast.success(`${res.count} versi jadwal (termasuk jadwal aktif) berhasil dihapus.`);
        } else if (wasDraft && res.types.has('DRAFT') && res.types.size === 1) {
          toast.success(`${res.count} draft berhasil dihapus.`);
        } else {
          toast.success(`${res.count} riwayat jadwal berhasil dihapus.`);
        }
      }
    } catch (err: any) {
      console.error('Delete error in VersionHistoryPage:', err);
      toast.error(err.message || 'Gagal menghapus jadwal. Silakan coba lagi.');
    } finally {
      setDeleting(false);
    }
  };

  // 6. Cleanup Empty Drafts Handler
  const handleCleanupEmptyDrafts = async () => {
    try {
      setCleaningEmptyDrafts(true);
      const res = await scheduleVersionsService.cleanupEmptyDrafts(
        selectedTermId === 'all' ? undefined : selectedTermId
      );
      if (res.deletedCount > 0) {
        toast.success(`${res.deletedCount} draf kosong tanpa entri berhasil dibersihkan.`);
        await fetchVersionsData();
      } else {
        toast.info('Tidak ditemukan draf kosong untuk dibersihkan.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal membersihkan draf kosong.');
    } finally {
      setCleaningEmptyDrafts(false);
    }
  };

  // 7. Open Comparison Handler
  const handleOpenComparison = (vAId?: string, vBId?: string) => {
    if (meaningfulVersions.length < 2) {
      toast.info('Diperlukan minimal dua versi yang memiliki susunan jadwal untuk komparasi.');
      return;
    }
    setCompVersionAId(vAId || meaningfulVersions[0].id);
    setCompVersionBId(vBId || meaningfulVersions[1]?.id || meaningfulVersions[0].id);
    setCompareModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Riwayat & Manajemen Versi Jadwal"
        subtitle="Kelola snapshot jadwal resmi, draf alternatif, penamaan manual, pengarsipan, dan pembersihan riwayat"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {meaningfulVersions.length >= 2 && (
              <button
                type="button"
                onClick={() => handleOpenComparison()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <Scale className="w-4 h-4 text-purple-600" />
                <span>Bandingkan Versi</span>
              </button>
            )}

            {stats.published > 0 && (
              <button
                type="button"
                onClick={() => setClearActiveScheduleOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                title="Tarik jadwal resmi yang sedang aktif dari publik"
              >
                <EyeOff className="w-4 h-4 text-rose-600" />
                <span>Tarik Jadwal</span>
              </button>
            )}

            <button
              type="button"
              disabled={cleaningEmptyDrafts}
              onClick={handleCleanupEmptyDrafts}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              title="Bersihkan draf yang dibuat tetapi tidak memiliki entri jadwal"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{cleaningEmptyDrafts ? 'Membersihkan...' : 'Bersihkan Draf Kosong'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/penyusunan-jadwal')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Susun Jadwal</span>
            </button>
          </div>
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Riwayat"
          value={stats.total}
          icon={<History className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle="seluruh riwayat tercatat"
        />

        <StatCard
          title="Versi Terbit Resmi"
          value={stats.published}
          icon={<Send className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          subtitle="jadwal aktif perkuliahan"
        />

        <StatCard
          title="Draf Aktif & Alternatif"
          value={stats.drafts}
          icon={<Layers className="w-6 h-6" />}
          iconBgColor="bg-indigo-50 text-indigo-600"
          subtitle="workspace penyusunan"
        />

        <StatCard
          title="Arsip Riwayat"
          value={stats.archived}
          icon={<Archive className="w-6 h-6" />}
          iconBgColor="bg-amber-50 text-amber-600"
          subtitle="versi lama yang diarsipkan"
        />
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PUBLISHED')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'PUBLISHED' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Terbit ({stats.published})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('DRAFT')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'DRAFT' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Draf ({stats.drafts})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ARCHIVED')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ARCHIVED' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Arsip ({stats.archived})
            </button>
          </div>

          {/* Search & Term Filter */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Term Select */}
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Semua Periode</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.semester_type || 'GANJIL'} {t.academic_year || '2026/2027'}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama jadwal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Bulk Action Bar (when selected) */}
        {selectedVersionIds.size > 0 && (
          <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 animate-in fade-in">
            <span className="font-semibold">
              {selectedVersionIds.size} jadwal terpilih
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenDeleteBulk}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-2xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus Terpilih</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedVersionIds(new Set())}
                className="px-2 py-1 text-2xs text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Version Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={fetchVersionsData} />
          </div>
        )}

        {loading && <LoadingState type="table-skeleton" rows={6} message="Memuat daftar riwayat versi jadwal..." />}

        {!loading && !error && filteredVersions.length === 0 && (
          <div className="p-10">
            <EmptyState
              title="Tidak ada riwayat jadwal yang cocok"
              description="Tidak ditemukan riwayat versi jadwal berdasarkan filter atau pencarian saat ini."
            />
          </div>
        )}

        {!loading && !error && filteredVersions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {selectedVersionIds.size === filteredVersions.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Nama Jadwal</th>
                  <th className="py-3 px-4">Status & Versi</th>
                  <th className="py-3 px-4">Periode</th>
                  <th className="py-3 px-4">Tanggal Update</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVersions.map((ver) => {
                  const isSelected = selectedVersionIds.has(ver.id);
                  const isPublished = ver.status === 'PUBLISHED';
                  const isArchived = ver.status === 'ARCHIVED';
                  const isReplaced = ver.status === 'REPLACED';
                  const isDraft = ver.status === 'DRAFT';
                  const termName = ver.academic_term
                    ? `${ver.academic_term.semester_type || 'GANJIL'} ${ver.academic_term.academic_year || '2026/2027'}`
                    : 'GANJIL 2026/2027';

                  return (
                    <tr
                      key={ver.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/50'
                          : isPublished
                          ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(ver.id)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {ver.title || `Jadwal Perkuliahan ${termName}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenRename(ver)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                            title="Ubah Nama Jadwal"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                        {ver.published_at && (
                          <p className="text-3xs text-slate-500 mt-0.5">
                            Diterbitkan: {formatDateTimeIndo(ver.published_at)}
                          </p>
                        )}
                        {ver.withdrawn_at && !isPublished && (
                          <p className="text-3xs text-rose-600 font-medium mt-0.5">
                            Ditarik: {formatDateTimeIndo(ver.withdrawn_at)}
                          </p>
                        )}
                        {ver.changelog && (
                          <p className="text-3xs text-slate-500 mt-0.5 max-w-md truncate">
                            {ver.changelog}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider ${
                              isPublished
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : ver.withdrawn_at
                                ? 'bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                : isArchived
                                ? 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                : isReplaced || ver.published_at
                                ? 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                            }`}
                          >
                            {isPublished
                              ? `DITERBITKAN · v${ver.version_number || '1'}`
                              : ver.withdrawn_at
                              ? `DITARIK · v${ver.version_number || '1'}`
                              : isArchived
                              ? 'DIARSIPKAN'
                              : isReplaced || ver.published_at
                              ? `VERSI LAMA · v${ver.version_number || '1'}`
                              : 'DRAFT'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {termName}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-2xs">
                        {formatDateTimeIndo(ver.updated_at || ver.created_at)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Resume Draft in Builder */}
                          {isDraft && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const termKey = ver.academic_term_id || 'active';
                                if (ver.type === 'UTS') {
                                  localStorage.setItem(`spk:active-schedule-version:UTS:anonymous:${termKey}`, ver.id);
                                  navigate(`/jadwal-ujian?type=UTS&version=${ver.id}`);
                                } else if (ver.type === 'UAS') {
                                  localStorage.setItem(`spk:active-schedule-version:UAS:anonymous:${termKey}`, ver.id);
                                  navigate(`/jadwal-ujian?type=UAS&version=${ver.id}`);
                                } else {
                                  localStorage.setItem(`spk:active-schedule-version:LECTURE:anonymous:${termKey}`, ver.id);
                                  navigate(`/penyusunan-jadwal?version=${ver.id}`);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <span>Buka Draf</span>
                            </button>
                          )}

                          {/* Kosongkan Draft on Draft */}
                          {isDraft && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenClear(ver);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                              title="Kosongkan alokasi waktu dan ruangan draf ini"
                            >
                              <Eraser className="w-3 h-3" />
                              <span>Kosongkan Draft</span>
                            </button>
                          )}

                          {/* Restore / Republish for Replaced / Archived version */}
                          {!isDraft && !isPublished && (
                            <button
                              type="button"
                              disabled={republishingId === ver.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRepublish(ver);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                              title="Pulihkan dan terbitkan kembali versi ini sebagai jadwal resmi aktif"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{republishingId === ver.id ? 'Memulihkan...' : 'Terbitkan Kembali'}</span>
                            </button>
                          )}

                          {/* Archive toggle for Published / Replaced */}
                          {!isDraft && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleArchive(ver);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                              title={isArchived ? 'Pulihkan dari Arsip' : 'Arsipkan Jadwal'}
                            >
                              {isArchived ? (
                                <>
                                  <ArchiveRestore className="w-3 h-3 text-emerald-600" />
                                  <span>Batal Arsip</span>
                                </>
                              ) : (
                                <>
                                  <Archive className="w-3 h-3 text-amber-600" />
                                  <span>Arsipkan</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Compare button */}
                          {meaningfulVersions.length >= 2 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenComparison(meaningfulVersions[0].id, ver.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-2xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                              title="Bandingkan dengan versi utama"
                            >
                              <Scale className="w-3 h-3" />
                              <span>Bandingkan</span>
                            </button>
                          )}

                          {/* Delete button (DRAFT: Hapus Draft, REPLACED/DITARIK: Hapus Riwayat, PUBLISHED: Hapus Jadwal) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDeleteSingle(ver);
                            }}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isPublished
                                ? 'text-rose-600 hover:text-rose-800 hover:bg-rose-100/70'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={
                              isDraft
                                ? 'Hapus Draft'
                                : isPublished
                                ? 'Hapus Jadwal'
                                : 'Hapus Riwayat'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RENAME MODAL */}
      <Modal
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title="Ubah Nama Jadwal"
        description="Beri nama yang mudah dikenali seperti 'Jadwal Kuliah Ganjil Final' atau 'Alternatif Distribusi Ruangan'."
        size="sm"
      >
        <form onSubmit={handleConfirmRename} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Nama / Judul Jadwal <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={newTitleInput}
              onChange={(e) => setNewTitleInput(e.target.value)}
              placeholder="Contoh: UTS Ganjil Final"
              maxLength={80}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRenameModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={renaming || !newTitleInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{renaming ? 'Menyimpan...' : 'Simpan Nama'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* KOSONGKAN DRAFT MODAL */}
      <Modal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title="Kosongkan Draft?"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
            <p className="font-semibold text-amber-950 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Konfirmasi Pengosongan Draft</span>
            </p>
            <p className="text-slate-700 leading-relaxed">
              Seluruh alokasi waktu dan ruangan pada draft ini akan dikosongkan.
              Scope, mata kuliah, kelas, dosen, peserta, dan konfigurasi penyusunan tetap dipertahankan.
            </p>
          </div>
          <p className="text-2xs text-slate-500">
            Draft &quot;<strong className="text-slate-700">{targetVersionToClear?.title || 'Draft'}</strong>&quot; tetap tersimpan untuk dapat Anda susun ulang. Jadwal resmi yang sudah diterbitkan tidak akan terpengaruh.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={clearing}
              onClick={() => setClearModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={clearing}
              onClick={handleConfirmClear}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>{clearing ? 'Mengosongkan...' : 'Kosongkan Draft'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* KOSONGKAN JADWAL RESMI / AKTIF MODAL */}
      <ClearActiveScheduleModal
        isOpen={clearActiveScheduleOpen}
        onClose={() => setClearActiveScheduleOpen(false)}
        academicTermId={selectedTermId === 'all' ? undefined : selectedTermId}
        onCleared={fetchVersionsData}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={
          versionsToDelete.length === 1 && versionsToDelete[0]?.status === 'PUBLISHED'
            ? 'Hapus jadwal aktif?'
            : versionsToDelete.some((v) => v.status === 'PUBLISHED')
            ? 'Hapus Jadwal (Termasuk Jadwal Aktif)?'
            : versionsToDelete.length === 1 && versionsToDelete[0]?.status === 'DRAFT'
            ? 'Hapus Draft?'
            : versionsToDelete.length === 1
            ? 'Hapus Riwayat?'
            : versionsToDelete.every((v) => v.status === 'DRAFT')
            ? `Hapus ${versionsToDelete.length} Draft?`
            : `Hapus ${versionsToDelete.length} Riwayat Jadwal?`
        }
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1.5">
            <p className="font-semibold text-rose-950 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {versionsToDelete.length === 1 && versionsToDelete[0]?.status === 'PUBLISHED'
                  ? 'Konfirmasi Penghapusan Jadwal Aktif'
                  : 'Konfirmasi Penghapusan'}
              </span>
            </p>
            <p className="text-slate-700 leading-relaxed">
              {versionsToDelete.length === 1 && versionsToDelete[0]?.status === 'PUBLISHED' ? (
                <>
                  Jadwal ini sedang diterbitkan.
                  <br />
                  Jika dihapus, jadwal akan langsung hilang dari tampilan Dosen dan Publik.
                </>
              ) : versionsToDelete.some((v) => v.status === 'PUBLISHED') ? (
                <>
                  Pilihan mencakup jadwal yang sedang aktif diterbitkan.
                  <br />
                  Jika dihapus, jadwal akan langsung hilang dari tampilan Dosen dan Publik.
                </>
              ) : versionsToDelete.length > 1 ? (
                `${versionsToDelete.length} versi jadwal terpilih dan seluruh alokasi di dalamnya akan dihapus permanen.`
              ) : (
                `Versi jadwal '${versionsToDelete[0]?.title || 'Jadwal'}' dan seluruh alokasi di dalamnya akan dihapus permanen.`
              )}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {deleting
                  ? 'Menghapus...'
                  : versionsToDelete.length === 1 && versionsToDelete[0]?.status === 'PUBLISHED'
                  ? 'Hapus Jadwal'
                  : versionsToDelete.some((v) => v.status === 'PUBLISHED')
                  ? 'Hapus Jadwal'
                  : versionsToDelete.length === 1 && versionsToDelete[0]?.status === 'DRAFT'
                  ? 'Hapus Draft'
                  : versionsToDelete.every((v) => v.status === 'DRAFT')
                  ? 'Hapus Draft'
                  : 'Hapus Riwayat'}
              </span>
            </button>
          </div>
        </div>
      </Modal>

      {/* COMPARISON MODAL */}
      <VersionComparisonModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        versions={meaningfulVersions}
        initialVersionAId={compVersionAId}
        initialVersionBId={compVersionBId}
      />
    </div>
  );
};
