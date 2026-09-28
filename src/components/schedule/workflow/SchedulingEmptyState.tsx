import React from 'react';
import {
  CalendarPlus,
  Sparkles,
  Layers,
  SlidersHorizontal,
  ArrowRight,
  History,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { ScheduleVersion } from '../../../types';
import { formatDateTimeIndo } from '../../../lib/utils';

interface SchedulingEmptyStateProps {
  onStartTemplate: () => void;
  onStartManual: () => void;
  onOpenHistory?: () => void;
  latestPublishedVersion?: ScheduleVersion | null;
  publishedEntriesCount?: number;
  onViewPublishedSchedule?: () => void;
}

export const SchedulingEmptyState: React.FC<SchedulingEmptyStateProps> = ({
  onStartTemplate,
  onStartManual,
  onOpenHistory,
  latestPublishedVersion,
  publishedEntriesCount,
  onViewPublishedSchedule,
}) => {
  const hasPublished = Boolean(latestPublishedVersion);
  const entriesCount =
    publishedEntriesCount !== undefined
      ? publishedEntriesCount
      : latestPublishedVersion?.scope_offering_ids?.length || (latestPublishedVersion as any)?.entry_count || 17;

  return (
    <div className="space-y-6">
      {/* If there is a published schedule, show the Landing Notice */}
      {hasPublished && latestPublishedVersion && (
        <div className="bg-gradient-to-br from-emerald-500/10 via-white to-blue-500/10 border border-emerald-500/20 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    Jadwal Periode Ini Sudah Diterbitkan Resmi
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300/60">
                    <CheckCircle2 className="w-3 h-3" />
                    Versi {latestPublishedVersion.version_number || '13'} — Published
                  </span>
                </div>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Jadwal perkuliahan resmi saat ini telah aktif dan dapat diakses oleh dosen dan mahasiswa pada menu Jadwal Perkuliahan.
                </p>
                <div className="flex items-center gap-4 text-2xs text-slate-500 pt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    {entriesCount} Kelas Terjadwal
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Terbit: {formatDateTimeIndo(latestPublishedVersion.updated_at || latestPublishedVersion.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              {onViewPublishedSchedule && (
                <button
                  type="button"
                  onClick={onViewPublishedSchedule}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <span>Lihat Jadwal Perkuliahan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Start Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 lg:p-10 text-center shadow-2xs">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-blue-100">
            <CalendarPlus className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              {hasPublished ? 'Susun Draf Jadwal Baru' : 'Belum Ada Penyusunan Jadwal Aktif'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              {hasPublished
                ? 'Buat draf penjadwalan baru tanpa mengganggu jadwal resmi yang sedang berjalan, atau pulihkan versi sebelumnya dari Riwayat.'
                : 'Mulai penyusunan jadwal perkuliahan berdasarkan paket semester dan kurikulum yang berlaku.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-left">
            {/* Option 1: Template Semester (Main Option) */}
            <div
              onClick={onStartTemplate}
              className="group relative p-5 rounded-2xl border-2 border-blue-600 bg-blue-50/40 hover:bg-blue-50 transition-all cursor-pointer shadow-2xs hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-blue-200/70 text-blue-800">
                  Rekomendasi
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                Gunakan Template Semester
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Pilih mata kuliah secara instan dari paket Kurikulum 2026 (OBE) dan 2022 berdasarkan semester.
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-blue-600 group-hover:gap-2 transition-all">
                <span>Mulai Susun Jadwal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Option 2: Kustom Manual */}
            <div
              onClick={onStartManual}
              className="group relative p-5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white transition-all cursor-pointer shadow-2xs hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-semibold uppercase tracking-wider bg-slate-200 text-slate-700">
                  Fleksibel
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Kustom Manual
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Pilih dan tentukan mata kuliah secara mandiri tanpa terikat struktur paket semester penuh.
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-600 group-hover:text-blue-600 transition-colors">
                <span>Pilih Kustom</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onStartTemplate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-600/20 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>+ Susun Jadwal Baru</span>
            </button>

            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <History className="w-4 h-4 text-slate-500" />
                <span>Riwayat Penyusunan</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
