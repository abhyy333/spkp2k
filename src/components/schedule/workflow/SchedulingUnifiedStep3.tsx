import React, { useState } from 'react';
import {
  CheckCircle2,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Save,
  Clock,
  Sparkles,
  Layers,
  FileCheck,
} from 'lucide-react';
import { AcademicTerm } from '../../../types';
import { toast } from '../../ui/Toast';

interface SchedulingUnifiedStep3Props {
  totalScheduled: number;
  totalConflicts: number;
  activeTerm: AcademicTerm | null;
  optimizationStatus: string;
  onViewOfficialSchedule: () => void;
  onSaveSnapshot?: (title: string) => Promise<void>;
  onBackToStep2: () => void;
}

export const SchedulingUnifiedStep3: React.FC<SchedulingUnifiedStep3Props> = ({
  totalScheduled,
  totalConflicts,
  activeTerm,
  optimizationStatus,
  onViewOfficialSchedule,
  onSaveSnapshot,
  onBackToStep2,
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [snapshotTitle, setSnapshotTitle] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  const termDisplay = activeTerm
    ? `${activeTerm.academic_year || activeTerm.year || '2026/2027'} — Semester ${activeTerm.semester_type || activeTerm.term || 'Ganjil'}`
    : '2026/2027 — Semester Ganjil';

  const handleSaveSnapshot = async () => {
    if (!onSaveSnapshot) return;
    const titleToUse = snapshotTitle.trim() || `Snapshot Penyusunan Selesai (${new Date().toLocaleDateString('id-ID')})`;
    setSavingSnapshot(true);
    try {
      await onSaveSnapshot(titleToUse);
      toast.success(`Versi "${titleToUse}" berhasil disimpan ke Riwayat.`);
      setShowSaveModal(false);
      setSnapshotTitle('');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan snapshot ke Riwayat.');
    } finally {
      setSavingSnapshot(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-4">
      {/* 1. Success Hero Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2 max-w-lg mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Penyusunan Jadwal Selesai
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Seluruh rangkaian persiapan kelas, alokasi jadwal awal, dan optimasi Simulated Annealing telah berhasil diselesaikan.
          </p>
        </div>

        {/* 2. Key Summary Grid: 4 Essential Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left pt-2">
          {/* Jumlah Kelas Terjadwal */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <span className="text-3xs font-semibold text-slate-400 uppercase tracking-wider block">
              Kelas Terjadwal
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xl font-black text-slate-900">{totalScheduled}</span>
              <span className="text-xs text-slate-500">kelas</span>
            </div>
            <p className="text-3xs text-emerald-600 font-semibold mt-1">100% dialokasikan</p>
          </div>

          {/* Jumlah Konflik */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <span className="text-3xs font-semibold text-slate-400 uppercase tracking-wider block">
              Status Konflik
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`text-2xl font-black ${
                  totalConflicts === 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {totalConflicts}
              </span>
              <span className="text-xs text-slate-500">bentrok</span>
            </div>
            <p
              className={`text-3xs font-semibold mt-1 ${
                totalConflicts === 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {totalConflicts === 0 ? 'Bebas Bentrok' : 'Perlu ditinjau'}
            </p>
          </div>

          {/* Periode Akademik */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <span className="text-3xs font-semibold text-slate-400 uppercase tracking-wider block">
              Periode Akademik
            </span>
            <p className="text-xs font-bold text-slate-900 mt-1 line-clamp-2 leading-tight">
              {termDisplay}
            </p>
            <p className="text-3xs text-slate-400 font-medium mt-1">Semester Aktif</p>
          </div>

          {/* Status Hasil Optimasi */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <span className="text-3xs font-semibold text-slate-400 uppercase tracking-wider block">
              Hasil Optimasi
            </span>
            <div className="flex items-center gap-1 mt-1 text-xs font-bold text-emerald-700">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{optimizationStatus || 'Optimal (SA)'}</span>
            </div>
            <p className="text-3xs text-slate-400 font-medium mt-1">Simulated Annealing</p>
          </div>
        </div>

        {/* 3. Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBackToStep2}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Tahap 2</span>
          </button>

          {onSaveSnapshot && (
            <button
              type="button"
              onClick={() => {
                setSnapshotTitle(`Versi Final ${termDisplay}`);
                setShowSaveModal(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
            >
              <Save className="w-3.5 h-3.5 text-slate-400" />
              <span>Simpan Versi ke Riwayat</span>
            </button>
          )}

          {/* Aksi Utama: [Lihat Jadwal Perkuliahan] */}
          <button
            type="button"
            onClick={onViewOfficialSchedule}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
          >
            <span>Lihat Jadwal Perkuliahan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Save Snapshot Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
              <Save className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Simpan Versi ke Riwayat</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Snapshot ini akan disimpan di menu Riwayat sebagai arsip resmi yang dapat dipulihkan atau diunduh kapan saja.
              </p>
            </div>

            <div className="text-left space-y-1 pt-1">
              <label className="text-3xs font-bold text-slate-700 uppercase tracking-wider">
                Nama Versi
              </label>
              <input
                type="text"
                disabled={savingSnapshot}
                value={snapshotTitle}
                onChange={(e) => setSnapshotTitle(e.target.value)}
                placeholder="Contoh: Versi 1 — Hasil Optimasi SA"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={savingSnapshot}
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingSnapshot || !snapshotTitle.trim()}
                onClick={handleSaveSnapshot}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {savingSnapshot ? 'Menyimpan...' : 'Simpan ke Riwayat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
