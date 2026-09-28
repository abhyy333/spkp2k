import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingDown,
  Layers,
  Sparkles,
  X,
  FileSpreadsheet,
  Code,
  ArrowRight,
} from 'lucide-react';
import { OptimizationRun } from '../../../types';
import { saEvaluationService } from '../../../services/saEvaluation.service';
import { SAConvergenceChart } from './SAConvergenceChart';
import { formatDateIndo, cn } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

interface SARunHistoryTableProps {
  runs: OptimizationRun[];
  onRefresh: () => void;
  onSelectRunForReport?: (run: OptimizationRun) => void;
}

export const SARunHistoryTable: React.FC<SARunHistoryTableProps> = ({
  runs,
  onRefresh,
  onSelectRunForReport,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'WITH_WARNINGS'>('ALL');
  const [selectedRun, setSelectedRun] = useState<OptimizationRun | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (statusFilter === 'COMPLETED' && (r.hard_conflicts_count ?? 0) > 0) return false;
      if (statusFilter === 'WITH_WARNINGS' && (r.hard_conflicts_count ?? 0) === 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const verTitle = r.schedule_version?.title?.toLowerCase() || '';
        const runId = r.id.toLowerCase();
        const alg = (r.algorithm || '').toLowerCase();
        if (!verTitle.includes(q) && !runId.includes(q) && !alg.includes(q)) return false;
      }
      return true;
    });
  }, [runs, statusFilter, searchQuery]);

  // Handle Delete
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Hapus rekaman eksperimen ini? Data tidak dapat dikembalikan.')) return;

    setDeletingId(id);
    try {
      const ok = await saEvaluationService.deleteRun(id);
      if (ok) {
        toast.success('Rekaman eksperimen berhasil dihapus.');
        if (selectedRun?.id === id) setSelectedRun(null);
        onRefresh();
      } else {
        toast.error('Gagal menghapus rekaman eksperimen.');
      }
    } catch {
      toast.error('Terjadi kesalahan saat menghapus.');
    } finally {
      setDeletingId(null);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (runs.length === 0) {
      toast.warning('Tidak ada data eksperimen untuk diekspor.');
      return;
    }
    const csvContent = saEvaluationService.exportRunsToCSV(runs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Dataset_Eksperimen_SA_UNRAM_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Dataset CSV berhasil diunduh.');
  };

  // Export to JSON
  const handleExportJSON = () => {
    if (runs.length === 0) {
      toast.warning('Tidak ada data eksperimen untuk diekspor.');
      return;
    }
    const jsonContent = saEvaluationService.exportRunsToJSON(runs);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Dataset_Eksperimen_SA_UNRAM_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Dataset JSON berhasil diunduh.');
  };

  return (
    <div className="space-y-4">
      {/* 1. Header and Controls */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Riwayat Eksperimen & Optimization Runs</h3>
            <p className="text-xs text-slate-500">
              Daftar seluruh pengujian algoritma Simulated Annealing yang tersimpan di basis data
            </p>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Ekspor CSV untuk SPSS / Excel / Python Pandas"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Ekspor CSV
            </button>
            <button
              type="button"
              onClick={handleExportJSON}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Ekspor Raw JSON Dataset"
            >
              <Code className="w-4 h-4 text-blue-600" />
              Ekspor JSON
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan ID run, judul jadwal, atau status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">Semua Status (Feasible & Warnings)</option>
              <option value="COMPLETED">100% Feasible (0 Bentrok Keras)</option>
              <option value="WITH_WARNINGS">Tersisa Bentrok Keras (&gt; 0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Historical Runs Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
        {filteredRuns.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {runs.length === 0
              ? 'Belum ada eksperimen yang dijalankan.'
              : 'Tidak ditemukan rekaman eksperimen yang sesuai dengan filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-3xs">
                <tr>
                  <th className="p-3">Waktu Eksperimen</th>
                  <th className="p-3">Target Versi Jadwal</th>
                  <th className="p-3">Parameter SA</th>
                  <th className="p-3">Initial Cost</th>
                  <th className="p-3">Final Cost</th>
                  <th className="p-3">Hard Conflict</th>
                  <th className="p-3">Runtime</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRuns.map((r) => {
                  const cfg = r.config || {};
                  const initCost = r.initial_cost || 0;
                  const finalCost = r.best_cost || r.final_cost || 0;
                  const hardCount = r.hard_conflicts_count ?? 0;
                  const runtime = r.runtime_ms || r.execution_time_ms || 0;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRun(r)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3 text-slate-600 font-medium">
                        <div>{formatDateIndo(new Date(r.created_at))}</div>
                        <div className="text-3xs text-slate-400 font-mono">ID: {r.id.slice(0, 8)}</div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-800">
                          {r.schedule_version?.title || 'Draft Jadwal'}
                        </div>
                        <div className="text-3xs text-slate-400">
                          Versi {r.schedule_version?.version_number || '1'} (Rev {r.schedule_version?.revision || '1'})
                        </div>
                      </td>

                      <td className="p-3 font-mono text-2xs text-slate-600">
                        <div>T₀={cfg.initialTemperature ?? 100}, α={cfg.coolingRate ?? 0.985}</div>
                        <div className="text-3xs text-slate-400">
                          N={r.iterations || cfg.maxIterations || 3000} | Seed={cfg.seed ?? 42}
                        </div>
                      </td>

                      <td className="p-3 font-mono text-slate-500">
                        {initCost.toLocaleString()}
                      </td>

                      <td className="p-3 font-mono font-bold text-blue-600">
                        {finalCost.toLocaleString()}
                      </td>

                      <td className="p-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-2xs font-bold inline-flex items-center gap-1',
                            hardCount === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          )}
                        >
                          {hardCount === 0 ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> 0 Bentrok
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3" /> {hardCount} Bentrok
                            </>
                          )}
                        </span>
                      </td>

                      <td className="p-3 font-mono text-slate-700">
                        {runtime} ms
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedRun(r)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Lihat Detail Eksperimen"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(r.id, e)}
                            disabled={deletingId === r.id}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Rekaman"
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
        )}
      </div>

      {/* 3. Run Detail Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <span className="text-3xs font-bold uppercase tracking-wider text-blue-600">
                  Detail Rekaman Eksperimen
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedRun.schedule_version?.title || 'Draft Jadwal'} (Run #{selectedRun.id.slice(0, 8)})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-5">
              {/* Top Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-3xs text-slate-400 uppercase font-bold block">Status Kelayakan</span>
                  <span
                    className={cn(
                      'font-black text-sm block mt-0.5',
                      (selectedRun.hard_conflicts_count ?? 0) === 0 ? 'text-emerald-600' : 'text-rose-600'
                    )}
                  >
                    {(selectedRun.hard_conflicts_count ?? 0) === 0 ? '100% Feasible (0 Konflik)' : `${selectedRun.hard_conflicts_count} Konflik`}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-3xs text-slate-400 uppercase font-bold block">Waktu Eksekusi</span>
                  <span className="font-black text-sm text-slate-900 block mt-0.5">
                    {selectedRun.runtime_ms || selectedRun.execution_time_ms || 0} ms
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-3xs text-slate-400 uppercase font-bold block">Initial vs Final Cost</span>
                  <span className="font-black text-sm text-blue-600 block mt-0.5">
                    {selectedRun.initial_cost?.toLocaleString()} → {selectedRun.best_cost?.toLocaleString()}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-3xs text-slate-400 uppercase font-bold block">Iterasi Dieksekusi</span>
                  <span className="font-black text-sm text-slate-900 block mt-0.5">
                    {selectedRun.iterations || 3000} Iterasi
                  </span>
                </div>
              </div>

              {/* Convergence Chart if sampled metrics exist */}
              {selectedRun.metrics?.sampleConvergence && selectedRun.metrics.sampleConvergence.length > 0 && (
                <SAConvergenceChart
                  metrics={selectedRun.metrics.sampleConvergence}
                  title="Kurva Konvergensi Eksperimen"
                  initialCost={selectedRun.initial_cost}
                  finalCost={selectedRun.best_cost || selectedRun.final_cost}
                  runtimeMs={selectedRun.runtime_ms || selectedRun.execution_time_ms}
                />
              )}

              {/* Parameter Configuration Used */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <h4 className="font-bold text-slate-800 mb-2">Parameter Algoritma yang Digunakan:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs font-mono">
                  <div>Initial Temp: <strong>{selectedRun.config?.initialTemperature ?? 100}</strong></div>
                  <div>Cooling Rate: <strong>{selectedRun.config?.coolingRate ?? 0.985}</strong></div>
                  <div>Min Temp: <strong>{selectedRun.config?.minTemperature ?? 0.01}</strong></div>
                  <div>Max Iterations: <strong>{selectedRun.config?.maxIterations ?? 3000}</strong></div>
                  <div>Random Seed: <strong>{selectedRun.config?.seed ?? 42}</strong></div>
                  <div>Waktu: <strong>{formatDateIndo(new Date(selectedRun.created_at))}</strong></div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
