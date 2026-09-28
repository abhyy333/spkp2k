import React, { useState, useEffect } from 'react';
import { EyeOff, AlertTriangle, BookOpen, Calendar, CalendarCheck, Undo2 } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { scheduleVersionsService } from '../../../services/scheduleVersions.service';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from '../../ui/Toast';

interface ClearActiveScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicTermId?: string;
  scheduleType?: 'LECTURE' | 'UTS' | 'UAS' | 'ALL';
  onCleared?: (clearedTypes: string[]) => void;
}

export const ClearActiveScheduleModal: React.FC<ClearActiveScheduleModalProps> = ({
  isOpen,
  onClose,
  academicTermId,
  scheduleType = 'ALL',
  onCleared,
}) => {
  const { isAdmin, isOwnerAdmin } = useAuth();

  // Selection states
  const [selectLecture, setSelectLecture] = useState(true);
  const [selectUts, setSelectUts] = useState(false);
  const [selectUas, setSelectUas] = useState(false);

  // Sync default selection when opened with specific scheduleType
  useEffect(() => {
    if (isOpen) {
      if (scheduleType === 'LECTURE') {
        setSelectLecture(true);
        setSelectUts(false);
        setSelectUas(false);
      } else if (scheduleType === 'UTS') {
        setSelectLecture(false);
        setSelectUts(true);
        setSelectUas(false);
      } else if (scheduleType === 'UAS') {
        setSelectLecture(false);
        setSelectUts(false);
        setSelectUas(true);
      } else {
        setSelectLecture(true);
        setSelectUts(false);
        setSelectUas(false);
      }
    }
  }, [isOpen, scheduleType]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  const allSelected = selectLecture && selectUts && selectUas;
  const anySelected = selectLecture || selectUts || selectUas;

  const modalTitle =
    scheduleType === 'UTS' || (selectUts && !selectLecture && !selectUas)
      ? 'Tarik Jadwal UTS?'
      : scheduleType === 'UAS' || (selectUas && !selectLecture && !selectUts)
      ? 'Tarik Jadwal UAS?'
      : scheduleType === 'LECTURE' || (selectLecture && !selectUts && !selectUas)
      ? 'Tarik Jadwal Perkuliahan?'
      : 'Tarik Jadwal?';

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectLecture(false);
      setSelectUts(false);
      setSelectUas(false);
    } else {
      setSelectLecture(true);
      setSelectUts(true);
      setSelectUas(true);
    }
  };

  const handleConfirmWithdraw = async () => {
    if (!isAdmin && !isOwnerAdmin) {
      toast.error('Akses ditolak: Hanya Administrator yang berhak menarik publikasi jadwal.');
      return;
    }

    if (!anySelected) {
      toast.info('Pilih setidaknya satu jenis jadwal aktif yang ingin ditarik.');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await scheduleVersionsService.withdrawActivePublishedSchedule({
        lecture: selectLecture,
        uts: selectUts,
        uas: selectUas,
        academicTermId,
      });

      if (res.cleared.length === 1) {
        toast.success(`${res.cleared[0]} berhasil ditarik dari publikasi.`);
      } else {
        const clearedList = res.cleared.join(', ');
        toast.success(`${clearedList} berhasil ditarik dari publikasi.`);
      }

      onClose();
      if (onCleared) {
        onCleared(res.cleared);
      }
    } catch (err: any) {
      console.error('Error withdrawing active schedule:', err);
      toast.error(err.message || 'Gagal menarik jadwal aktif.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isProcessing ? () => {} : onClose}
      title={modalTitle}
      description="Jadwal ini tidak lagi ditampilkan kepada Dosen dan publik. Versi jadwal tetap tersimpan di Riwayat dan dapat diterbitkan kembali kapan saja."
      size="md"
    >
      <div className="space-y-4">
        {/* Selection section */}
        {scheduleType === 'ALL' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-slate-800">
                Pilih jadwal yang ingin ditarik:
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-2xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                {allSelected ? '[ Batal Pilih Semua ]' : '[ Pilih Semua ]'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {/* Jadwal Perkuliahan */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  selectLecture
                    ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                    : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selectLecture ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Jadwal Perkuliahan</p>
                    <p className="text-3xs text-slate-500">
                      Jadwal perkuliahan mingguan resmi semester aktif
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={selectLecture}
                  onChange={(e) => setSelectLecture(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                />
              </label>

              {/* Jadwal UTS */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  selectUts
                    ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                    : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selectUts ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Jadwal UTS</p>
                    <p className="text-3xs text-slate-500">
                      Jadwal Ujian Tengah Semester resmi semester aktif
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={selectUts}
                  onChange={(e) => setSelectUts(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                />
              </label>

              {/* Jadwal UAS */}
              <label
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  selectUas
                    ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                    : 'bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selectUas ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Jadwal UAS</p>
                    <p className="text-3xs text-slate-500">
                      Jadwal Ujian Akhir Semester resmi semester aktif
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={selectUas}
                  onChange={(e) => setSelectUas(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}

        {/* Warning Confirmation Info */}
        <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/90 text-xs text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Tarik Publikasi Jadwal</span>
          </div>
          <p className="leading-relaxed text-slate-700">
            Jadwal yang dipilih tidak lagi ditampilkan kepada Dosen dan publik. Versi jadwal tetap
            tersimpan di Riwayat dan dapat diterbitkan kembali kapan saja.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isProcessing || !anySelected}
            onClick={handleConfirmWithdraw}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Menarik Jadwal...' : 'Tarik Jadwal'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
