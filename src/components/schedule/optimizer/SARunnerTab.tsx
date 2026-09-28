import React from 'react';
import { OptimizationProgress } from '../../../lib/optimizer/types';
import {
  Play,
  Pause,
  Square,
  Activity,
  Flame,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface SARunnerTabProps {
  progress: OptimizationProgress | null;
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onViewResults: () => void;
}

export const SARunnerTab: React.FC<SARunnerTabProps> = ({
  progress,
  isRunning,
  isPaused,
  onStart,
  onPause,
  onResume,
  onStop,
  onViewResults,
}) => {
  const iteration = progress?.iteration ?? 0;
  const totalIterations = progress?.totalIterations ?? 2000;
  const percentage = Math.min(100, Math.round((iteration / Math.max(1, totalIterations)) * 100));
  const isCompleted = progress?.status === 'COMPLETED' || progress?.status === 'STOPPED_EARLY';

  // Helper to render mini SVG convergence curve
  const renderChart = () => {
    if (!progress?.history || progress.history.length < 2) {
      return (
        <div className="h-36 flex items-center justify-center text-xs text-slate-400">
          Grafik konvergensi akan digambar secara real-time selama proses optimasi...
        </div>
      );
    }

    const points = progress.history;
    const maxCost = Math.max(...points.map((p) => p.currentCost), 100);
    const minCost = 0;
    const width = 600;
    const height = 140;
    const padX = 10;
    const padY = 15;

    // Build SVG path for Best Cost (Green line) and Current Cost (Blue line)
    const bestPathD = points
      .map((p, idx) => {
        const x = padX + (idx / (points.length - 1)) * (width - 2 * padX);
        const y = height - padY - ((p.bestCost - minCost) / Math.max(1, maxCost - minCost)) * (height - 2 * padY);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    const currentPathD = points
      .map((p, idx) => {
        const x = padX + (idx / (points.length - 1)) * (width - 2 * padX);
        const y = height - padY - ((p.currentCost - minCost) / Math.max(1, maxCost - minCost)) * (height - 2 * padY);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <div className="space-y-2">
        <div className="relative w-full h-36 bg-slate-900 rounded-xl overflow-hidden p-2">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
            {/* Grid lines */}
            <line x1={padX} y1={height / 2} x2={width - padX} y2={height / 2} stroke="#334155" strokeDasharray="3 3" />
            <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#334155" />

            {/* Current Cost path (Faint blue) */}
            <path d={currentPathD} fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.6" />

            {/* Best Cost path (Solid Emerald) */}
            <path d={bestPathD} fill="none" stroke="#34d399" strokeWidth="2.5" />
          </svg>
        </div>

        <div className="flex items-center justify-between text-3xs text-slate-500 px-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Solusi Terbaik (Global Best)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 opacity-60" />
              Eksplorasi Solusi Saat Ini (Current S)
            </span>
          </div>
          <span>Iterasi 0 → {iteration}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Progress & Temperature Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Progres Optimasi
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                  isRunning
                    ? 'bg-blue-100 text-blue-800 animate-pulse'
                    : isPaused
                    ? 'bg-amber-100 text-amber-800'
                    : isCompleted
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isRunning
                  ? 'Sedang Berjalan'
                  : isPaused
                  ? 'Dijeda (Paused)'
                  : isCompleted
                  ? 'Selesai'
                  : 'Siap Dijalankan'}
              </span>
            </div>
            <p className="text-2xs text-slate-500">
              Iterasi {iteration.toLocaleString()} dari {totalIterations.toLocaleString()} ({percentage}%)
            </p>
          </div>

          {/* Temperature indicator */}
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200/80 rounded-xl px-3.5 py-1.5">
            <Flame className="w-4 h-4 text-orange-500 animate-bounce" />
            <div className="text-left">
              <span className="text-3xs font-semibold text-orange-600 uppercase block">
                Suhu Saat Ini (T)
              </span>
              <span className="text-xs font-mono font-bold text-orange-800">
                {(progress?.temperature ?? 100).toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-150 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Best Cost */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-emerald-800 uppercase tracking-wider">
              Best Cost
            </span>
            <TrendingDown className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-mono font-extrabold text-emerald-900">
            {progress?.bestCost ?? '-'}
          </div>
          <div className="text-3xs text-emerald-700">
            Awal: {progress?.initialCost ?? '-'}
          </div>
        </div>

        {/* Hard Violations */}
        <div
          className={`border rounded-2xl p-3.5 space-y-1 ${
            (progress?.hardViolations ?? 0) === 0
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-rose-50/70 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider">
              Bentrok Hard
            </span>
            {(progress?.hardViolations ?? 0) === 0 ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div className="text-xl font-mono font-extrabold">
            {progress?.hardViolations ?? 0}
          </div>
          <div className="text-3xs opacity-80">
            {(progress?.hardViolations ?? 0) === 0 ? 'Semua Batasan Terpenuhi' : 'Ada Pelanggaran'}
          </div>
        </div>

        {/* Soft Violations */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-amber-800 uppercase tracking-wider">
              Pelanggaran Soft
            </span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-mono font-extrabold text-amber-900">
            {progress?.softViolations ?? 0}
          </div>
          <div className="text-3xs text-amber-700">
            Preferensi &amp; Beban Dosen
          </div>
        </div>

        {/* Acceptance Rate & Time */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-600 uppercase tracking-wider">
              Tingkat Penerimaan
            </span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl font-mono font-extrabold text-slate-800">
            {(progress?.acceptanceRate ?? 0).toFixed(1)}%
          </div>
          <div className="text-3xs text-slate-500">
            Waktu: {((progress?.timeElapsedMs ?? 0) / 1000).toFixed(1)} detik
          </div>
        </div>
      </div>

      {/* Real-time Convergence Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Kurva Konvergensi Biaya (Simulated Annealing Energy Landscape)
        </h5>
        {renderChart()}
      </div>

      {/* Controller Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {!isRunning && !isCompleted && (
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Jalankan Simulated Annealing
            </button>
          )}

          {isRunning && (
            <button
              type="button"
              onClick={onPause}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition-all cursor-pointer"
            >
              <Pause className="w-4 h-4" />
              Jeda (Pause)
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Lanjutkan
            </button>
          )}

          {(isRunning || isPaused) && (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 text-rose-600" />
              Hentikan &amp; Ambil Solusi Terbaik
            </button>
          )}
        </div>

        {isCompleted && (
          <button
            type="button"
            onClick={onViewResults}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Lihat Hasil Evaluasi Solusi →
          </button>
        )}
      </div>
    </div>
  );
};
