import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../ui/Toast';
import { cn } from '../../../lib/utils';
import { scheduleVersionsService } from '../../../services/scheduleVersions.service';

interface AdminResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetComplete: () => void;
}

export const AdminResetDataModal: React.FC<AdminResetDataModalProps> = ({
  isOpen,
  onClose,
  onResetComplete,
}) => {
  const [resetScope, setResetScope] = useState<'DRAFT_WORKFLOW' | 'OPTIMIZATION_RUNS'>('DRAFT_WORKFLOW');
  const [confirmText, setConfirmText] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExecuteReset = async () => {
    if (confirmText.trim() !== 'RESET') {
      toast.error('Ketik "RESET" dengan huruf kapital untuk mengonfirmasi.');
      return;
    }

    setProcessing(true);
    try {
      if (resetScope === 'DRAFT_WORKFLOW') {
        // Clear workflow state in draft schedule versions
        const { error: draftErr } = await supabase
          .from('schedule_versions')
          .update({
            workflow_state: null,
            updated_at: new Date().toISOString(),
          })
          .eq('status', 'DRAFT');

        if (draftErr) {
          console.warn('Draft workflow reset notice:', draftErr);
        }

        // Clean draft entries from schedule_entries for DRAFT versions
        const { data: draftVers } = await supabase
          .from('schedule_versions')
          .select('id')
          .eq('status', 'DRAFT');

        if (draftVers && draftVers.length > 0) {
          const draftIds = draftVers.map((v) => v.id);
          for (const dId of draftIds) {
            try {
              await scheduleVersionsService.clearDraftEntries(dId);
            } catch (clearErr) {
              console.warn(`Notice clearing draft ${dId}:`, clearErr);
            }
          }
        }

        // Clear local storage workflow caches
        try {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('spk:scheduling-') || key.startsWith('spk:active-schedule-')) {
              localStorage.removeItem(key);
            }
          });
        } catch (e) {
          console.warn('Local storage clear notice:', e);
        }

        toast.success('Draf penyusunan jadwal aktif berhasil direset bersih.');
      } else if (resetScope === 'OPTIMIZATION_RUNS') {
        const { error: runErr } = await supabase.from('optimization_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (runErr) {
          console.warn('Optimization runs reset notice:', runErr);
        }
        toast.success('Seluruh riwayat eksperimen optimasi berhasil dibersihkan.');
      }

      onResetComplete();
      onClose();
    } catch (err: any) {
      console.error('Reset error:', err);
      toast.error(err.message || 'Gagal melakukan reset data.');
    } finally {
      setProcessing(false);
    }
  };

  const isConfirmed = confirmText.trim() === 'RESET';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-rose-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Reset Data Sistem</h3>
              <p className="text-2xs text-rose-600 font-semibold">
                Tindakan administratif destruktif (Admin Only)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-bold text-xs">Perhatian: Tindakan Ini Bersifat Permanen</p>
              <p className="text-2xs text-rose-800">
                Pilih ruang lingkup data yang ingin direset. Akun login pengguna, otorisasi role, dan profil master
                <strong> tidak akan pernah dihapus</strong> oleh operasi ini.
              </p>
            </div>
          </div>

          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="block text-2xs font-bold uppercase tracking-wider text-slate-700">
              Pilih Ruang Lingkup Reset:
            </label>

            <div className="space-y-2">
              <label
                className={cn(
                  'flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer',
                  resetScope === 'DRAFT_WORKFLOW'
                    ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/10'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                )}
              >
                <input
                  type="radio"
                  name="resetScope"
                  checked={resetScope === 'DRAFT_WORKFLOW'}
                  onChange={() => setResetScope('DRAFT_WORKFLOW')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block text-xs">
                    Reset Draf Penjadwalan Aktif (Workflow Step 1–6)
                  </span>
                  <span className="text-2xs text-slate-500 leading-normal block mt-0.5">
                    Membersihkan draf jadwal, pemetaan rombel, dan cache workflow yang sedang berlangsung.
                    <strong> Jadwal yang sudah Diterbitkan (Published) tetap aman</strong>.
                  </span>
                </div>
              </label>

              <label
                className={cn(
                  'flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer',
                  resetScope === 'OPTIMIZATION_RUNS'
                    ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/10'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                )}
              >
                <input
                  type="radio"
                  name="resetScope"
                  checked={resetScope === 'OPTIMIZATION_RUNS'}
                  onChange={() => setResetScope('OPTIMIZATION_RUNS')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block text-xs">
                    Reset Riwayat Eksperimen SA (Tabel optimization_runs)
                  </span>
                  <span className="text-2xs text-slate-500 leading-normal block mt-0.5">
                    Menghapus seluruh log eksperimen pengujian algoritma Simulated Annealing dari database.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Explicit Confirmation Input */}
          <div className="pt-2">
            <label className="block text-2xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Ketik <span className="font-mono text-rose-600 font-black">RESET</span> untuk mengonfirmasi:
            </label>
            <input
              type="text"
              placeholder="RESET"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono font-bold text-slate-800 uppercase tracking-wider transition-all"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecuteReset}
              disabled={!isConfirmed || processing}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              <span>{processing ? 'Memproses Reset...' : 'Eksekusi Reset Data'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
