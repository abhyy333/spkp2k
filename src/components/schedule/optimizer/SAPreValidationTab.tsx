import React from 'react';
import { PreValidationResult } from '../../../lib/optimizer/types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  GraduationCap,
  DoorClosed,
  Clock,
  BookOpen,
} from 'lucide-react';

interface SAPreValidationTabProps {
  validation: PreValidationResult;
  onRefresh: () => void;
  onProceed: () => void;
}

export const SAPreValidationTab: React.FC<SAPreValidationTabProps> = ({
  validation,
  onRefresh,
  onProceed,
}) => {
  const { isReady, totalOfferings, readyOfferingsCount, errors, warnings, summary } = validation;

  return (
    <div className="space-y-6">
      {/* Overall Status Banner */}
      <div
        className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
          isReady
            ? 'bg-emerald-50/80 border-emerald-200/90 text-emerald-900'
            : 'bg-rose-50/80 border-rose-200/90 text-rose-900'
        }`}
      >
        {isReady ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <h4 className="text-sm font-bold">
            {isReady
              ? 'Data Siap untuk Optimasi Otomatis (Simulated Annealing)'
              : 'Data Belum Siap untuk Optimasi Otomatis'}
          </h4>
          <p className="text-xs opacity-90 leading-relaxed">
            {isReady
              ? `Seluruh ${totalOfferings} kelas penawaran memiliki data lengkap (dosen, peserta, SKS, dan tipe ruangan). Algoritma siap dijalankan.`
              : 'Ditemukan ketidaklengkapan data kritis. Sesuai aturan sistem, perbaiki data penawaran kelas sebelum menjalankan Simulated Annealing.'}
          </p>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
          <BookOpen className="w-4 h-4 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-slate-800">
            {readyOfferingsCount}/{totalOfferings}
          </div>
          <div className="text-2xs text-slate-500 font-medium">Kelas Siap</div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
          <Users className="w-4 h-4 text-purple-600 mx-auto mb-1" />
          <div
            className={`text-lg font-bold ${
              summary.missingLecturersCount > 0 ? 'text-rose-600' : 'text-slate-800'
            }`}
          >
            {summary.missingLecturersCount}
          </div>
          <div className="text-2xs text-slate-500 font-medium">Belum Ada Dosen</div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
          <GraduationCap className="w-4 h-4 text-amber-600 mx-auto mb-1" />
          <div
            className={`text-lg font-bold ${
              summary.missingStudentsCount > 0 ? 'text-rose-600' : 'text-slate-800'
            }`}
          >
            {summary.missingStudentsCount}
          </div>
          <div className="text-2xs text-slate-500 font-medium">Peserta = 0</div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center">
          <DoorClosed className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-slate-800">
            {summary.roomsCount} Ruang
          </div>
          <div className="text-2xs text-slate-500 font-medium">
            {summary.timeSlotsCount} Slot Aktif
          </div>
        </div>
      </div>

      {/* Checklist Requirements */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Daftar Kelengkapan Parameter Masukan
        </h5>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-700 font-medium">
              1. Setiap kelas memiliki minimal 1 dosen pengampu
            </span>
            {summary.missingLecturersCount === 0 ? (
              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-emerald-100 text-emerald-800">
                Lengkap
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-rose-100 text-rose-800">
                {summary.missingLecturersCount} Bermasalah
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-700 font-medium">
              2. Jumlah peserta (expected_students) terisi &gt; 0
            </span>
            {summary.missingStudentsCount === 0 ? (
              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-emerald-100 text-emerald-800">
                Lengkap
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-rose-100 text-rose-800">
                {summary.missingStudentsCount} Bermasalah
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-700 font-medium">
              3. Bobot SKS mata kuliah terdefinisi (1 – 6 SKS)
            </span>
            {summary.missingSksCount === 0 ? (
              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-emerald-100 text-emerald-800">
                Lengkap
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-rose-100 text-rose-800">
                {summary.missingSksCount} Bermasalah
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-700 font-medium">
              4. Ketersediaan ruangan & slot waktu aktif
            </span>
            {summary.roomsCount > 0 && summary.timeSlotsCount > 0 ? (
              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-emerald-100 text-emerald-800">
                Tersedia
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-2xs font-bold bg-rose-100 text-rose-800">
                Belum Siap
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Blocking Issues List */}
      {errors.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Rincian Masalah yang Harus Diselesaikan ({errors.length})
          </h5>

          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {errors.map((err) => (
              <div
                key={err.id}
                className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/70 text-xs flex items-start justify-between gap-2"
              >
                <div>
                  {err.offeringName && (
                    <span className="font-bold text-rose-900 block">
                      {err.offeringName}
                    </span>
                  )}
                  <span className="text-rose-700 text-2xs">{err.issue}</span>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-3xs font-bold bg-rose-200/80 text-rose-800">
                  Wajib Diisi
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onRefresh}
          className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        >
          Muat Ulang Validasi
        </button>

        <button
          type="button"
          disabled={!isReady}
          onClick={onProceed}
          className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
        >
          Lanjut ke Konfigurasi Parameter →
        </button>
      </div>
    </div>
  );
};
