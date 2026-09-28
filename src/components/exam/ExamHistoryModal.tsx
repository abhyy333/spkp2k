import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  Copy,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { ScheduleVersion } from '../../types';
import { examsService } from '../../services/exams.service';
import { formatDateTimeIndo } from '../../lib/utils';
import { toast } from '../ui/Toast';

interface ExamHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  termId: string;
  examType: 'UTS' | 'UAS';
  onRestoreVersion: (version: ScheduleVersion) => void;
}

export const ExamHistoryModal: React.FC<ExamHistoryModalProps> = ({
  isOpen,
  onClose,
  termId,
  examType,
  onRestoreVersion,
}) => {
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'UTS' | 'UAS'>(examType);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && termId) {
      loadHistory();
    }
  }, [isOpen, termId, selectedType]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const list = await examsService.getExamVersions(termId, selectedType);
      setVersions(list);
    } catch (err: any) {
      toast.error('Gagal memuat riwayat versi ujian.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version: ScheduleVersion) => {
    if (
      !window.confirm(
        `Pulihkan versi "${version.title || `Versi ${version.version_number}`}" sebagai draf baru?`
      )
    ) {
      return;
    }

    setRestoringId(version.id);
    try {
      const newDraft = await examsService.createExamDraft(
        termId,
        selectedType,
        `Revisi dari ${version.title || `Versi ${version.version_number}`}`,
        version.id
      );

      toast.success('Draf revisi berhasil dibuat dari riwayat versi.');
      onRestoreVersion(newDraft);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulihkan versi jadwal ujian.');
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Riwayat Versi Jadwal Ujian</h3>
              <p className="text-xs text-slate-500">
                Daftar rekaman versi draf dan jadwal resmi yang pernah diterbitkan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Filter */}
        <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedType('UTS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedType === 'UTS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Riwayat UTS
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('UAS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedType === 'UAS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Riwayat UAS
          </button>
        </div>

        {/* Versions List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Memuat riwayat versi...</div>
          ) : versions.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Belum Ada Riwayat {selectedType}</p>
              <p className="text-xs text-slate-500 mt-1">
                Versi draf dan jadwal terbit {selectedType} akan tercatat di sini.
              </p>
            </div>
          ) : (
            versions.map((v) => {
              const isPublished = v.status === 'PUBLISHED';
              return (
                <div
                  key={v.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPublished
                      ? 'bg-emerald-50/40 border-emerald-200/80 shadow-2xs'
                      : 'bg-white border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {v.title || `Versi ${v.version_number}`}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-2xs font-extrabold uppercase ${
                            isPublished
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {v.status}
                        </span>
                        <span className="text-2xs font-mono text-slate-500">
                          Rev #{v.revision || 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-2xs text-slate-400 mt-1.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {v.created_at ? formatDateTimeIndo(v.created_at) : '-'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={restoringId === v.id}
                      onClick={() => handleRestore(v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {restoringId === v.id ? 'Memulihkan...' : 'Pulihkan sebagai Draf'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
