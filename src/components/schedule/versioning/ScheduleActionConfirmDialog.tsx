import React from 'react';
import { Eraser, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { ScheduleVersion } from '../../../types';

export type ScheduleActionType = 'CLEAR' | 'DELETE';

export interface ScheduleActionDialogState {
  type: ScheduleActionType | null;
  version: ScheduleVersion | null;
}

interface ScheduleActionConfirmDialogProps {
  dialogState: ScheduleActionDialogState;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isProcessing: boolean;
}

export const ScheduleActionConfirmDialog: React.FC<ScheduleActionConfirmDialogProps> = ({
  dialogState,
  onClose,
  onConfirm,
  isProcessing,
}) => {
  const { type, version } = dialogState;

  if (!type || !version) return null;

  const isClear = type === 'CLEAR';
  const versionName = version.title || `Versi ${version.version_number || '1'}`;
  const isPublished = version.status === 'PUBLISHED';
  const isDraft = version.status === 'DRAFT';

  const title = isClear
    ? 'Kosongkan Draft?'
    : isPublished
    ? 'Hapus jadwal aktif?'
    : isDraft
    ? 'Hapus Draft?'
    : 'Hapus Riwayat?';

  return (
    <Modal
      isOpen={Boolean(type && version)}
      onClose={isProcessing ? () => {} : onClose}
      title={title}
      size="sm"
    >
      <div className="space-y-4">
        {isClear ? (
          <div className="space-y-3">
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
              Draft &quot;<strong className="text-slate-700">{versionName}</strong>&quot; tetap tersimpan untuk dapat Anda susun ulang. Jadwal resmi yang sudah diterbitkan tidak akan terpengaruh.
            </p>
          </div>
        ) : isPublished ? (
          <div className="space-y-3">
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <p className="font-semibold text-rose-950 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Konfirmasi Penghapusan Jadwal Aktif</span>
              </p>
              <p className="text-slate-700 leading-relaxed">
                Jadwal ini sedang diterbitkan.
                <br />
                Jika dihapus, jadwal akan langsung hilang dari tampilan Dosen dan Publik.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <p className="font-semibold text-rose-950 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{isDraft ? 'Konfirmasi Penghapusan Draft' : 'Konfirmasi Penghapusan Riwayat'}</span>
              </p>
              <p className="text-slate-700 leading-relaxed">
                {isDraft
                  ? `Draft '${versionName}' dan seluruh alokasi di dalamnya akan dihapus permanen. Jadwal yang sudah diterbitkan tidak akan terpengaruh.`
                  : `Riwayat versi jadwal '${versionName}' akan dihapus permanen dari sistem.`}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          {isClear ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Mengosongkan...' : 'Kosongkan Draft'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isProcessing}
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {isProcessing
                  ? 'Menghapus...'
                  : isPublished
                  ? 'Hapus Jadwal'
                  : isDraft
                  ? 'Hapus Draft'
                  : 'Hapus Riwayat'}
              </span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
