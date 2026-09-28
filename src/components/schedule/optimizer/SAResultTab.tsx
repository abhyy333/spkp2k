import React from 'react';
import { OptimizationResult } from '../../../lib/optimizer/types';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  TrendingDown,
  Sparkles,
  Calendar,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface SAResultTabProps {
  result: OptimizationResult | null;
  onApplyToDraft: () => void;
}

export const SAResultTab: React.FC<SAResultTabProps> = ({
  result,
  onApplyToDraft,
}) => {
  if (!result) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Belum ada hasil optimasi yang tersedia. Jalankan algoritma terlebih dahulu.
      </div>
    );
  }

  const {
    initialCostBreakdown,
    bestCostBreakdown,
    totalIterations,
    timeElapsedMs,
    finalTemperature,
    acceptanceRate,
    seed,
  } = result;

  const costReduction = initialCostBreakdown.totalCost - bestCostBreakdown.totalCost;
  const costReductionPercent =
    initialCostBreakdown.totalCost > 0
      ? ((costReduction / initialCostBreakdown.totalCost) * 100).toFixed(1)
      : '0';

  const isHardZero = bestCostBreakdown.hardViolationsCount === 0;

  return (
    <div className="space-y-6">
      {/* Result Status Banner */}
      <div
        className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
          isHardZero
            ? 'bg-emerald-50/80 border-emerald-200/90 text-emerald-900'
            : 'bg-amber-50/80 border-amber-200/90 text-amber-900'
        }`}
      >
        {isHardZero ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <h4 className="text-sm font-bold">
            {isHardZero
              ? 'Optimasi Berhasil: Solusi Bebas Konflik Kritis (0 Hard Conflicts)'
              : `Optimasi Selesai dengan ${bestCostBreakdown.hardViolationsCount} Konflik Kritis Tersisa`}
          </h4>
          <p className="text-xs opacity-90 leading-relaxed">
            {isHardZero
              ? 'Seluruh batasan keras (bentrok ruangan, bentrok dosen, kapasitas, tipe ruangan, dan ketersediaan) berhasil diselesaikan 100% tanpa pelanggaran.'
              : 'Algoritma berhasil meminimalkan pelanggaran secara signifikan. Anda dapat menerapkan solusi ini atau menyesuaikan parameter untuk iterasi lebih dalam.'}
          </p>
        </div>
      </div>

      {/* Comparison Grid: Initial vs Best */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Initial Heuristic */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Solusi Awal (Greedy Heuristic)
            </span>
            <span className="text-2xs font-mono font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded">
              Iterasi 0
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Total Biaya Penalti:</span>
              <span className="font-mono font-bold text-slate-800">
                {initialCostBreakdown.totalCost} poin
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Pelanggaran Hard:</span>
              <span className="font-mono font-bold text-rose-600">
                {initialCostBreakdown.hardViolationsCount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Pelanggaran Soft:</span>
              <span className="font-mono font-bold text-amber-600">
                {initialCostBreakdown.softViolationsCount}
              </span>
            </div>
          </div>
        </div>

        {/* Optimized Solution */}
        <div className="bg-emerald-50/50 border border-emerald-200/90 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Solusi Hasil Simulated Annealing
            </span>
            <span className="text-2xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
              Optimal Global
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-emerald-800 font-medium">Total Biaya Penalti:</span>
              <span className="font-mono font-extrabold text-emerald-900 flex items-center gap-1">
                {bestCostBreakdown.totalCost} poin
                {costReduction > 0 && (
                  <span className="text-3xs text-emerald-600 font-bold">
                    (-{costReductionPercent}%)
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-emerald-800 font-medium">Pelanggaran Hard:</span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.2 rounded">
                {bestCostBreakdown.hardViolationsCount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-emerald-800 font-medium">Pelanggaran Soft:</span>
              <span className="font-mono font-bold text-amber-700">
                {bestCostBreakdown.softViolationsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Execution Statistics */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Metrik Komputasi &amp; Reproducibility
        </h5>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-3xs text-slate-500 uppercase block font-semibold">
              Waktu Eksekusi
            </span>
            <span className="font-mono font-bold text-slate-800">
              {(timeElapsedMs / 1000).toFixed(2)} detik
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-3xs text-slate-500 uppercase block font-semibold">
              Total Iterasi
            </span>
            <span className="font-mono font-bold text-slate-800">
              {totalIterations.toLocaleString()}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-3xs text-slate-500 uppercase block font-semibold">
              Suhu Akhir (T)
            </span>
            <span className="font-mono font-bold text-slate-800">
              {finalTemperature.toFixed(4)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-3xs text-slate-500 uppercase block font-semibold">
              Random Seed
            </span>
            <span className="font-mono font-bold text-blue-600">
              {seed}
            </span>
          </div>
        </div>
      </div>

      {/* Remaining Violations (if any) */}
      {bestCostBreakdown.violations.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Rincian Catatan Batasan ({bestCostBreakdown.violations.length})
          </h5>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {bestCostBreakdown.violations.map((v) => (
              <div
                key={v.id}
                className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                  v.category === 'HARD'
                    ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                    : 'bg-amber-50/50 border-amber-200/80 text-amber-900'
                }`}
              >
                <div>
                  <span className="font-bold block">{v.title}</span>
                  <span className="text-2xs opacity-90">{v.description}</span>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-3xs font-mono font-bold bg-white/80 border border-slate-200">
                  +{v.penalty} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onApplyToDraft}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-md cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
          Terapkan ke Draft Jadwal Perkuliahan
        </button>
      </div>
    </div>
  );
};
