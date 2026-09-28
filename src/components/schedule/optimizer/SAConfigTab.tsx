import React, { useState } from 'react';
import { SAConfig } from '../../../lib/optimizer/types';
import { SA_PRESETS } from '../../../lib/optimizer/simulatedAnnealing';
import { Sliders, Zap, Sparkles, RefreshCw, Info, ShieldCheck } from 'lucide-react';

interface SAConfigTabProps {
  config: SAConfig;
  onChangeConfig: (newConfig: SAConfig) => void;
  onProceed: () => void;
  onBack: () => void;
}

export const SAConfigTab: React.FC<SAConfigTabProps> = ({
  config,
  onChangeConfig,
  onProceed,
  onBack,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('BALANCED');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const handleApplyPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const preset = SA_PRESETS[presetKey];
    if (preset) {
      onChangeConfig({
        ...config,
        ...preset.config,
      });
    }
  };

  const handleGenerateRandomSeed = () => {
    const randomSeed = Math.floor(Math.random() * 900000) + 100000;
    onChangeConfig({
      ...config,
      seed: randomSeed,
    });
  };

  return (
    <div className="space-y-6">
      {/* Presets Selection */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-blue-600" />
          Pilih Profil Optimasi (Presets)
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(SA_PRESETS).map(([key, item]) => {
            const isSelected = selectedPreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleApplyPreset(key)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800">{item.label}</span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </div>
                <p className="text-2xs text-slate-500 leading-relaxed">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Parameters Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-slate-600" />
            Parameter Utama Simulated Annealing
          </h4>
          <span className="text-2xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
            Metode Probabilistik
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Initial Temperature (T0) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-700">
                Suhu Awal (<span className="italic font-serif">T₀</span>)
              </label>
              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {config.initialTemperature}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={config.initialTemperature}
              onChange={(e) => {
                setSelectedPreset('CUSTOM');
                onChangeConfig({ ...config, initialTemperature: Number(e.target.value) });
              }}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <p className="text-3xs text-slate-400">
              Menentukan probabilitas awal menerima solusi yang lebih buruk untuk keluar dari local optima.
            </p>
          </div>

          {/* Cooling Rate (Alpha) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-700">
                Laju Pendinginan (<span className="italic font-serif">α</span>)
              </label>
              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {config.coolingRate}
              </span>
            </div>
            <input
              type="range"
              min={0.85}
              max={0.999}
              step={0.005}
              value={config.coolingRate}
              onChange={(e) => {
                setSelectedPreset('CUSTOM');
                onChangeConfig({ ...config, coolingRate: Number(e.target.value) });
              }}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <p className="text-3xs text-slate-400">
              Faktor penurunan suhu per iterasi: <span className="font-serif">Tₖ₊₁ = α · Tₖ</span>.
            </p>
          </div>

          {/* Max Iterations */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-700">
                Maksimum Iterasi
              </label>
              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {config.maxIterations}
              </span>
            </div>
            <input
              type="range"
              min={200}
              max={10000}
              step={200}
              value={config.maxIterations}
              onChange={(e) => {
                setSelectedPreset('CUSTOM');
                onChangeConfig({ ...config, maxIterations: Number(e.target.value) });
              }}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <p className="text-3xs text-slate-400">
              Batas jumlah iterasi pencarian tetangga sebelum proses dihentikan.
            </p>
          </div>

          {/* PRNG Seed (Reproducibility) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-700">
                Seed Acak (Reproducibility)
              </label>
              <button
                type="button"
                onClick={handleGenerateRandomSeed}
                className="inline-flex items-center gap-1 text-3xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                Acak Baru
              </button>
            </div>
            <input
              type="number"
              value={config.seed}
              onChange={(e) =>
                onChangeConfig({ ...config, seed: Number(e.target.value) || 42 })
              }
              className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
            <p className="text-3xs text-slate-400">
              Menjamin hasil 100% konsisten &amp; dapat direplikasi untuk pengujian sidang.
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Constraint Weights Toggle */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer"
        >
          <span>{showAdvanced ? '▼ Sembunyikan' : '▶ Tampilkan'} Bobot Penalti Batasan (Constraint Weights)</span>
        </button>

        {showAdvanced && (
          <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                <span className="font-bold text-rose-700 text-2xs block">
                  Hard Constraint Penalty (W_hard)
                </span>
                <p className="text-3xs text-slate-500">
                  Penalti besar untuk bentrok ruangan, bentrok dosen, kapasitas terlampaui, tipe ruang salah, dan dosen tidak bersedia.
                </p>
                <div className="font-mono font-bold text-slate-800 text-xs">
                  {config.weights.hardRoomOverlap} poin per pelanggaran
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                <span className="font-bold text-amber-700 text-2xs block">
                  Soft Constraint Penalty (W_soft)
                </span>
                <p className="text-3xs text-slate-500">
                  Penalti lebih ringan untuk preferensi dosen dihindari (40), waktu Shalat Jumat (60), dan tabrakan kurikulum semester yang sama (35).
                </p>
                <div className="font-mono font-bold text-slate-800 text-xs">
                  25 – 60 poin per pelanggaran
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        >
          ← Kembali ke Validasi
        </button>

        <button
          type="button"
          onClick={onProceed}
          className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Mulai Eksekusi Simulated Annealing →
        </button>
      </div>
    </div>
  );
};
