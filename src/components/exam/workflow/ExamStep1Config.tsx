import React from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Info,
  Layers,
} from 'lucide-react';
import { AcademicTerm, ExamSession, ExamWorkflowConfig } from '../../../types';
import { minuteToTime } from '../../../lib/utils';

interface ExamStep1ConfigProps {
  activeTerm: AcademicTerm | null;
  config: ExamWorkflowConfig;
  onChangeConfig: (updated: Partial<ExamWorkflowConfig>) => void;
  sessions: ExamSession[];
  onNext: () => void;
  isDraftLocked?: boolean;
}

export const ExamStep1Config: React.FC<ExamStep1ConfigProps> = ({
  activeTerm,
  config,
  onChangeConfig,
  sessions,
  onNext,
  isDraftLocked = false,
}) => {
  const activeSessions = sessions.filter((s) => s.is_active);

  // Validation
  const hasDates = Boolean(config.startDate && config.endDate);
  const isValidDateOrder =
    hasDates && new Date(config.startDate) <= new Date(config.endDate);
  const hasAllowedDays = config.allowedDays.length > 0;
  const hasSessions = activeSessions.length > 0;
  const isDurationValid = config.defaultDurationMinutes >= 30;

  const canProceed =
    hasDates &&
    isValidDateOrder &&
    hasAllowedDays &&
    hasSessions &&
    isDurationValid;

  const toggleDay = (dayNum: number) => {
    if (config.allowedDays.includes(dayNum)) {
      onChangeConfig({
        allowedDays: config.allowedDays.filter((d) => d !== dayNum),
      });
    } else {
      onChangeConfig({
        allowedDays: [...config.allowedDays, dayNum].sort(),
      });
    }
  };

  const dayOptions = [
    { num: 1, label: 'Senin' },
    { num: 2, label: 'Selasa' },
    { num: 3, label: 'Rabu' },
    { num: 4, label: 'Kamis' },
    { num: 5, label: 'Jumat' },
    { num: 6, label: 'Sabtu' },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header Info */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800">
                Tahap 1 dari 5
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Konfigurasi Parameter Ujian
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Pengaturan Jadwal {config.examType === 'UTS' ? 'Ujian Tengah Semester (UTS)' : 'Ujian Akhir Semester (UAS)'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tentukan rentang tanggal pelaksanaan, hari yang diperbolehkan, durasi ujian, dan sinkronisasi sesi waktu perkuliahan.
            </p>
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-right">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
              Tahun Ajaran Aktif
            </span>
            <span className="text-xs font-black text-slate-800 font-mono">
              {activeTerm ? `${activeTerm.academic_year || activeTerm.year} (${activeTerm.semester_type || activeTerm.term})` : '2026/2027 GANJIL'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Exam Type & Dates */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
          {/* Exam Type Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Jenis Ujian
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isDraftLocked}
                onClick={() => onChangeConfig({ examType: 'UTS' })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  config.examType === 'UTS'
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                } ${isDraftLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900">UTS</span>
                  {config.examType === 'UTS' && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <p className="text-2xs text-slate-500 mt-1">Ujian Tengah Semester</p>
              </button>

              <button
                type="button"
                disabled={isDraftLocked}
                onClick={() => onChangeConfig({ examType: 'UAS' })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  config.examType === 'UAS'
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                } ${isDraftLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900">UAS</span>
                  {config.examType === 'UAS' && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <p className="text-2xs text-slate-500 mt-1">Ujian Akhir Semester</p>
              </button>
            </div>
            {isDraftLocked && (
              <p className="text-2xs text-amber-600 mt-1.5 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Jenis ujian terkunci pada draf yang sedang berjalan.
              </p>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800">
              Periode Rentang Tanggal Ujian
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-2xs font-semibold text-slate-500 mb-1">
                  Tanggal Mulai
                </span>
                <input
                  type="date"
                  value={config.startDate}
                  onChange={(e) => onChangeConfig({ startDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <span className="block text-2xs font-semibold text-slate-500 mb-1">
                  Tanggal Selesai
                </span>
                <input
                  type="date"
                  value={config.endDate}
                  onChange={(e) => onChangeConfig({ endDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                />
              </div>
            </div>
            {hasDates && !isValidDateOrder && (
              <p className="text-2xs text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Tanggal selesai harus lebih besar atau sama dengan tanggal mulai.
              </p>
            )}
          </div>

          {/* Allowed Days */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Hari Pelaksanaan yang Diperbolehkan
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {dayOptions.map((opt) => {
                const checked = config.allowedDays.includes(opt.num);
                return (
                  <button
                    type="button"
                    key={opt.num}
                    onClick={() => toggleDay(opt.num)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                      checked
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Sessions & Duration */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
          {/* Exam Sessions Overview (Synchronized from time_slots) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                Struktur Sesi Waktu Perkuliahan & Ujian
              </label>
              <span className="text-2xs font-semibold text-slate-400">
                {activeSessions.length} Sesi Aktif
              </span>
            </div>

            {/* Info Notice about sync with master slot waktu */}
            <div className="p-3 mb-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-800 text-2xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Sesi Mengikuti Slot Waktu Perkuliahan</span>
              </div>
              <p className="text-blue-700 leading-relaxed">
                Struktur sesi ujian disinkronkan otomatis dari konfigurasi Slot Waktu aktif (termasuk penyesuaian otomatis saat Mode Ramadan). Untuk mengatur jam dan istirahat, buka menu <strong>Master Data → Slot Waktu</strong>.
              </p>
            </div>

            {sessions.length === 0 ? (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-800 space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Memuat Sesi Waktu...
                </div>
                <p className="text-2xs text-amber-700">
                  Sinkronisasi sesi waktu perkuliahan sedang berlangsung.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                      sess.is_active
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-amber-50/60 border-amber-200/70 text-amber-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{sess.name}</span>
                      <span className="font-mono text-2xs text-slate-500">
                        {minuteToTime(sess.start_minute)} – {minuteToTime(sess.end_minute)}
                      </span>
                    </div>
                    {sess.is_active ? (
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                        {sess.end_minute - sess.start_minute} mnt
                      </span>
                    ) : (
                      <span className="text-2xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                        ISTIRAHAT / BREAK
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Default Exam Duration */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Durasi Ujian Default (Menit)
            </label>
            <p className="text-2xs text-slate-500 mb-2">
              Panjang durasi pelaksanaan ujian per mata kuliah (dapat mencakup beberapa slot aktif berturutan).
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="30"
                max="240"
                step="10"
                value={config.defaultDurationMinutes}
                onChange={(e) =>
                  onChangeConfig({ defaultDurationMinutes: Number(e.target.value) })
                }
                className="w-32 px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono font-bold text-slate-900"
              />
              <div className="flex items-center gap-1.5">
                {[90, 100, 120].map((dur) => (
                  <button
                    type="button"
                    key={dur}
                    onClick={() => onChangeConfig({ defaultDurationMinutes: dur })}
                    className={`px-2.5 py-1 text-2xs font-bold rounded-lg border transition-all ${
                      config.defaultDurationMinutes === dur
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {dur} mnt
                  </button>
                ))}
              </div>
            </div>
            <p className="text-2xs text-slate-500 mt-1.5">
              Sistem akan otomatis memvalidasi agar jam selesai ujian tidak memotong slot istirahat.
            </p>
          </div>
        </div>
      </div>

      {/* Action Next */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200/80">
        <div className="text-xs text-slate-500">
          {!canProceed ? (
            <span className="text-amber-600 font-medium">
              Lengkapi tanggal, hari pelaksanaan, dan pastikan sesi aktif terhubung.
            </span>
          ) : (
            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Parameter konfigurasi valid, siap melanjutkan ke penelaahan mata kuliah ujian.
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!canProceed}
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
        >
          Lanjut ke Tahap 2: Mata Kuliah Ujian
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
