import React from 'react';
import { SmartSuggestion } from '../../../scheduling/suggestions/types';
import {
  Clock,
  MapPin,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Repeat,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface SuggestionCardProps {
  suggestion: SmartSuggestion;
  onApply: (suggestion: SmartSuggestion) => void;
  onReject?: (suggestion: SmartSuggestion) => void;
  isApplying?: boolean;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onApply,
  onReject,
  isApplying = false,
}) => {
  const isSwap = suggestion.suggestionType === 'SWAP';
  const isApplied = suggestion.status === 'APPLIED';
  const isRejected = suggestion.status === 'REJECTED';

  const getTypeBadge = () => {
    switch (suggestion.suggestionType) {
      case 'MOVE_TIME':
        return (
          <span className="px-2 py-0.5 rounded text-3xs font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
            Pindah Waktu
          </span>
        );
      case 'MOVE_ROOM':
        return (
          <span className="px-2 py-0.5 rounded text-3xs font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200">
            Ganti Ruangan
          </span>
        );
      case 'MOVE_TIME_ROOM':
        return (
          <span className="px-2 py-0.5 rounded text-3xs font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
            Waktu & Ruang
          </span>
        );
      case 'SWAP':
        return (
          <span className="px-2 py-0.5 rounded text-3xs font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
            Tukar Slot (Swap)
          </span>
        );
      default:
        return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-blue-700 bg-blue-50 border-blue-200';
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  return (
    <div
      className={`p-4 rounded-2xl border transition-all ${
        isApplied
          ? 'bg-emerald-50/40 border-emerald-200 opacity-90'
          : isRejected
          ? 'bg-slate-50 border-slate-200 opacity-60'
          : 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-xs'
      }`}
    >
      {/* Top Header: Badge, Title, Score */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          {getTypeBadge()}
          <h4 className="text-xs font-bold text-slate-900">
            {suggestion.courseName} ({suggestion.classCode})
          </h4>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded-full text-3xs font-bold border ${getScoreColor(
              suggestion.score
            )}`}
          >
            Skor Kualitas: {suggestion.score}%
          </span>

          {isApplied && (
            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-600 text-white flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Diterapkan
            </span>
          )}

          {isRejected && (
            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-slate-500 text-white">
              Ditolak
            </span>
          )}
        </div>
      </div>

      {/* Rationale Text */}
      <p className="text-2xs text-slate-600 leading-relaxed mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
        <span className="font-semibold text-slate-800">Alasan: </span>
        {suggestion.rationale}
      </p>

      {/* Before vs After Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        {/* Before */}
        <div className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-100 text-2xs space-y-1">
          <span className="text-3xs font-bold uppercase tracking-wider text-rose-600 block">
            Jadwal Saat Ini (Bermasalah)
          </span>
          <div className="flex items-center gap-1.5 text-slate-700">
            <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>
              {suggestion.currentPlacement.dayName}, {suggestion.currentPlacement.startTime} –{' '}
              {suggestion.currentPlacement.endTime}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>
              {suggestion.currentPlacement.roomCode} ({suggestion.currentPlacement.roomName})
            </span>
          </div>
        </div>

        {/* After */}
        <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200 text-2xs space-y-1">
          <span className="text-3xs font-bold uppercase tracking-wider text-emerald-700 block">
            Rekomendasi Penyesuaian
          </span>
          <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
            <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              {suggestion.proposedPlacement.dayName}, {suggestion.proposedPlacement.startTime} –{' '}
              {suggestion.proposedPlacement.endTime}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              {suggestion.proposedPlacement.roomCode} ({suggestion.proposedPlacement.roomName})
            </span>
          </div>
        </div>
      </div>

      {/* If Swap Details */}
      {isSwap && suggestion.swapDetails && (
        <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200 text-2xs mb-3 space-y-1">
          <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
            <Repeat className="w-3.5 h-3.5 text-indigo-600" />
            Pertukaran Jadwal Timbal Balik:
          </div>
          <p className="text-indigo-800">
            {suggestion.swapDetails.targetCourseName} akan bergeser ke{' '}
            <strong className="text-indigo-950">
              {suggestion.swapDetails.targetPlacement.dayName}{' '}
              {suggestion.swapDetails.targetPlacement.startTime} (
              {suggestion.swapDetails.targetPlacement.roomCode})
            </strong>
          </p>
        </div>
      )}

      {/* Impact Badges & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-1.5">
          {suggestion.impact.resolvedConflictsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Menyelesaikan {suggestion.impact.resolvedConflictsCount} Konflik
            </span>
          )}

          {suggestion.impact.hardConflictFree && (
            <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-blue-100 text-blue-800">
              100% Bebas Bentrok
            </span>
          )}

          {suggestion.impact.newConflictsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              +{suggestion.impact.newConflictsCount} Konflik Baru
            </span>
          )}
        </div>

        {/* Actions */}
        {!isApplied && !isRejected && (
          <div className="flex items-center gap-1.5">
            {onReject && (
              <button
                type="button"
                onClick={() => onReject(suggestion)}
                className="px-2.5 py-1.5 text-2xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Tolak
              </button>
            )}

            <button
              type="button"
              disabled={isApplying}
              onClick={() => onApply(suggestion)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-2xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              {isApplying ? 'Menerapkan...' : 'Terapkan Saran'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
