import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  RotateCcw,
  Download,
  Trash2,
  FileSpreadsheet,
  Eye,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  AlertTriangle,
  X,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { scheduleVersionsService } from '../../services/scheduleVersions.service';
import { scheduleEntriesService } from '../../services/scheduleEntries.service';
import { academicTermsService } from '../../services/academicTerms.service';
import { ScheduleVersion, AcademicTerm, ScheduleEntry } from '../../types';
import { formatDateTimeIndo } from '../../lib/utils';
import { generateLectureSchedulePDF } from '../../lib/pdf/pdfGenerator';
import { generateLectureScheduleExcel } from '../../lib/excel/excelGenerator';

export const VersionHistoryPage: React.FC = () => {
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // View entries modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedVersionForView, setSelectedVersionForView] = useState<ScheduleVersion | null>(null);
  const [viewEntries, setViewEntries] = useState<ScheduleEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Restore confirm modal
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [targetVersionToRestore, setTargetVersionToRestore] = useState<ScheduleVersion | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Delete confirm modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetVersionToDelete, setTargetVersionToDelete] = useState<ScheduleVersion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVersionsData = async () => {
    setLoading(true);
    try {
      const [termList, list] = await Promise.all([
        academicTermsService.getAcademicTerms(),
        scheduleVersionsService.getVersions(selectedTermId === 'all' ? undefined : selectedTermId),
      ]);
      setTerms(termList);
      setVersions(list);
    } catch (err: any) {
      toast.error('Gagal memuat riwayat versi jadwal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersionsData();
  }, [selectedTermId]);

  // View entries
  const handleOpenView = async (version: ScheduleVersion) => {
    setSelectedVersionForView(version);
    setViewModalOpen(true);
    setLoadingEntries(true);
    try {
      const entries = await scheduleEntriesService.getEntriesByVersionId(version.id);
      setViewEntries(entries);
    } catch (err) {
      toast.error('Gagal memuat daftar kelas untuk versi ini.');
    } finally {
      setLoadingEntries(false);
    }
  };

  // Restore snapshot to workspace
  const handleConfirmRestore = async () => {
    if (!targetVersionToRestore) return;
    setRestoring(true);
    try {
      const termId = targetVersionToRestore.academic_term_id || targetVersionToRestore.term_id;
      if (!termId) {
        throw new Error('Informasi semester pada versi ini tidak ditemukan.');
      }

      await scheduleVersionsService.restoreVersionToDraft(targetVersionToRestore.id, termId);
      toast.success(
        `Versi "${targetVersionToRestore.title}" berhasil disalin ke Workspace aktif.`
      );
      setRestoreModalOpen(false);
      setTargetVersionToRestore(null);
      await fetchVersionsData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulihkan versi ke Workspace.');
    } finally {
      setRestoring(false);
    }
  };

  // Delete version
  const handleConfirmDelete = async () => {
    if (!targetVersionToDelete) return;
    setDeleting(true);
    try {
      await scheduleVersionsService.deleteVersion(targetVersionToDelete.id);
      toast.success('Versi riwayat berhasil dihapus.');
      setDeleteModalOpen(false);
      setTargetVersionToDelete(null);
      await fetchVersionsData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus versi.');
    } finally {
      setDeleting(false);
    }
  };

  // Export PDF for version
  const handleExportPDF = async (version: ScheduleVersion) => {
    try {
      toast.info('Menyiapkan file PDF...');
      const entries = await scheduleEntriesService.getEntriesByVersionId(version.id);
      if (entries.length === 0) {
        toast.error('Versi ini tidak memiliki entri kelas.');
        return;
      }
      const mappedSchedules = entries.map((e: any) => ({
        id: e.id,
        course_name: e.course_name || e.course_offering?.course?.name || 'Mata Kuliah',
        course_code: e.course_code || e.course_offering?.course?.code || '-',
        effective_sks: e.course_offering?.course?.effective_sks || 3,
        sks: e.course_offering?.course?.effective_sks || 3,
        class_name: e.class_code || 'A',
        semester: e.course_offering?.course?.semester || 1,
        day: e.day || 'Senin',
        day_of_week: e.day_of_week || 1,
        start_time: e.start_time || '07:30',
        end_time: e.end_time || '09:10',
        start_minute: e.start_minute || 450,
        end_minute: e.end_minute || 550,
        room_name: e.room?.name || 'Ruang ?',
        room_code: e.room?.code || 'Ruang ?',
        lecturer_names: Array.isArray(e.lecturer_names) ? e.lecturer_names.join(', ') : e.lecturer_names || '-',
        student_count: e.student_count || 40,
        room_id: e.room_id,
        course_offering_id: e.course_offering_id,
        course_id: '',
        term_id: version.academic_term_id || '',
      }));

      const activeTermObj = terms.find((t) => t.id === version.academic_term_id) || null;
      await generateLectureSchedulePDF(mappedSchedules as any, activeTermObj);
      toast.success('PDF berhasil diunduh.');
    } catch (err) {
      toast.error('Gagal membuat PDF untuk versi ini.');
    }
  };

  // Export Excel for version
  const handleExportExcel = async (version: ScheduleVersion) => {
    try {
      toast.info('Menyiapkan file Excel...');
      const entries = await scheduleEntriesService.getEntriesByVersionId(version.id);
      if (entries.length === 0) {
        toast.error('Versi ini tidak memiliki entri kelas.');
        return;
      }
      const mappedSchedules = entries.map((e: any) => ({
        id: e.id,
        course_name: e.course_name || e.course_offering?.course?.name || 'Mata Kuliah',
        course_code: e.course_code || e.course_offering?.course?.code || '-',
        effective_sks: e.course_offering?.course?.effective_sks || 3,
        sks: e.course_offering?.course?.effective_sks || 3,
        class_name: e.class_code || 'A',
        semester: e.course_offering?.course?.semester || 1,
        day: e.day || 'Senin',
        day_of_week: e.day_of_week || 1,
        start_time: e.start_time || '07:30',
        end_time: e.end_time || '09:10',
        start_minute: e.start_minute || 450,
        end_minute: e.end_minute || 550,
        room_name: e.room?.name || 'Ruang ?',
        room_code: e.room?.code || 'Ruang ?',
        lecturer_names: Array.isArray(e.lecturer_names) ? e.lecturer_names.join(', ') : e.lecturer_names || '-',
        student_count: e.student_count || 40,
        room_id: e.room_id,
        course_offering_id: e.course_offering_id,
        course_id: '',
        term_id: version.academic_term_id || '',
      }));

      const activeTermObj = terms.find((t) => t.id === version.academic_term_id) || null;
      generateLectureScheduleExcel(
        mappedSchedules as any,
        activeTermObj
      );
      toast.success('Excel berhasil diunduh.');
    } catch (err) {
      toast.error('Gagal membuat Excel untuk versi ini.');
    }
  };

  const filteredVersions = useMemo(() => {
    return versions.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const matchTitle = (v.title || '').toLowerCase().includes(q);
      const matchType = (v.type || '').toLowerCase().includes(q);
      return matchTitle || matchType;
    });
  }, [versions, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Jadwal"
        subtitle="Snapshot versi jadwal perkuliahan dan jadwal ujian yang pernah disimpan atau ditetapkan sebagai Final."
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full sm:max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama versi jadwal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800"
          >
            <option value="all">Semua Periode Semester</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.academic_year || t.year} ({t.semester_type || t.term})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Versions List */}
      {loading ? (
        <LoadingState message="Memuat riwayat versi jadwal..." />
      ) : filteredVersions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-sm font-bold text-slate-700">Belum Ada Riwayat Tersimpan</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Riwayat hanya dibuat saat Admin menekan &quot;Simpan Versi&quot; atau &quot;Tetapkan sebagai Final&quot; pada tahap finalisasi penyusunan jadwal.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Versi</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tanggal Simpan</th>
                  <th className="py-3 px-4 text-center">Jumlah Kelas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVersions.map((version) => {
                  const isFinal = version.status === 'PUBLISHED' || version.status === 'FINAL';
                  return (
                    <tr key={version.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 leading-snug">
                          {version.title || `Versi ${version.version_number || '1.0'}`}
                        </div>
                        <div className="text-2xs text-slate-400 mt-0.5">
                          ID: {version.id.slice(0, 8)} • Rev {version.revision || 1}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md font-bold text-2xs bg-slate-100 text-slate-700">
                          {version.type || 'KULIAH'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isFinal ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Final Aktif
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 text-slate-600">
                            Snapshot
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDateTimeIndo(version.created_at)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {version.entries_count ?? '-'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Lihat */}
                          <button
                            type="button"
                            onClick={() => handleOpenView(version)}
                            title="Lihat Rincian Jadwal"
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Pulihkan */}
                          <button
                            type="button"
                            onClick={() => {
                              setTargetVersionToRestore(version);
                              setRestoreModalOpen(true);
                            }}
                            title="Pulihkan (Salin ke Workspace)"
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>

                          {/* Unduh PDF */}
                          <button
                            type="button"
                            onClick={() => handleExportPDF(version)}
                            title="Unduh PDF Resmi"
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Unduh Excel */}
                          <button
                            type="button"
                            onClick={() => handleExportExcel(version)}
                            title="Unduh Excel (.xlsx)"
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>

                          {/* Hapus */}
                          <button
                            type="button"
                            onClick={() => {
                              setTargetVersionToDelete(version);
                              setDeleteModalOpen(true);
                            }}
                            title="Hapus Versi Riwayat"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal View Entries */}
      {viewModalOpen && selectedVersionForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Rincian Entri: {selectedVersionForView.title}
                </h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Dibuat {formatDateTimeIndo(selectedVersionForView.created_at)} • {viewEntries.length} Sesi Terjadwal
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {loadingEntries ? (
                <LoadingState message="Memuat daftar kelas..." />
              ) : viewEntries.length === 0 ? (
                <p className="text-center py-10 text-xs text-slate-400">Versi ini kosong.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Hari & Jam</th>
                      <th className="py-2 px-3">Mata Kuliah</th>
                      <th className="py-2 px-3">Kelas</th>
                      <th className="py-2 px-3">Ruangan</th>
                      <th className="py-2 px-3">Dosen Pengampu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewEntries.map((e, idx) => (
                      <tr key={e.id || idx}>
                        <td className="py-2 px-3 text-slate-900 font-medium">
                          {e.day}, {e.start_time} - {e.end_time}
                        </td>
                        <td className="py-2 px-3 text-slate-800 font-semibold">
                          {e.course_name}
                        </td>
                        <td className="py-2 px-3 text-blue-600 font-bold">{e.class_code}</td>
                        <td className="py-2 px-3 text-slate-700">{e.room?.name || 'Ruang ?'}</td>
                        <td className="py-2 px-3 text-slate-600">
                          {Array.isArray(e.lecturer_names) ? e.lecturer_names.join(', ') : e.lecturer_names || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Restore Modal */}
      {restoreModalOpen && targetVersionToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Pulihkan Snapshot ke Workspace?</h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  Jadwal dari versi <strong>&quot;{targetVersionToRestore.title}&quot;</strong> akan disalin ke Workspace draf Anda. Snapshot lama ini tetap aman dan tidak akan berubah.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={restoring}
                onClick={() => {
                  setRestoreModalOpen(false);
                  setTargetVersionToRestore(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={handleConfirmRestore}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 cursor-pointer disabled:opacity-50"
              >
                {restoring ? 'Memulihkan...' : 'Ya, Pulihkan ke Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteModalOpen && targetVersionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Hapus Versi Riwayat?</h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  Anda akan menghapus riwayat <strong>&quot;{targetVersionToDelete.title}&quot;</strong>. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setTargetVersionToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Hapus Riwayat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
