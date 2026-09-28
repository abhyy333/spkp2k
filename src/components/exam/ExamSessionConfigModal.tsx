import React, { useState } from 'react';
import {
  X,
  Plus,
  Clock,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { ExamSession } from '../../types';
import { examsService } from '../../services/exams.service';
import { minuteToTime, timeToMinute } from '../../lib/utils';
import { toast } from '../ui/Toast';

interface ExamSessionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ExamSession[];
  onSessionsUpdated: () => void;
}

export const ExamSessionConfigModal: React.FC<ExamSessionConfigModalProps> = ({
  isOpen,
  onClose,
  sessions,
  onSessionsUpdated,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setFormName('');
    setFormStartTime('08:00');
    setFormEndTime('10:00');
    setFormIsActive(true);
    setEditingId(null);
    setIsAdding(false);
    setErrorMsg(null);
  };

  const handleStartAdd = () => {
    resetForm();
    const nextIdx = sessions.length + 1;
    setFormName(`Sesi ${nextIdx}`);
    setIsAdding(true);
  };

  const handleStartEdit = (session: ExamSession) => {
    setEditingId(session.id);
    setFormName(session.name);
    setFormStartTime(minuteToTime(session.start_minute));
    setFormEndTime(minuteToTime(session.end_minute));
    setFormIsActive(session.is_active);
    setIsAdding(false);
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const startMin = timeToMinute(formStartTime);
    const endMin = timeToMinute(formEndTime);

    if (startMin >= endMin) {
      setErrorMsg('Jam mulai harus lebih awal dari jam selesai.');
      return;
    }

    if (!formName.trim()) {
      setErrorMsg('Nama sesi wajib diisi.');
      return;
    }

    // Check duplicate times in other sessions
    const hasDuplicate = sessions.some(
      (s) =>
        s.id !== editingId &&
        s.start_minute === startMin &&
        s.end_minute === endMin
    );
    if (hasDuplicate) {
      setErrorMsg('Sudah ada sesi dengan rentang waktu yang sama persis.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await examsService.updateExamSession(editingId, {
          name: formName.trim(),
          start_minute: startMin,
          end_minute: endMin,
          is_active: formIsActive,
        });
        toast.success('Sesi ujian berhasil diperbarui.');
      } else {
        await examsService.createExamSession({
          name: formName.trim(),
          start_minute: startMin,
          end_minute: endMin,
          is_active: formIsActive,
        });
        toast.success('Sesi ujian baru berhasil ditambahkan.');
      }

      resetForm();
      onSessionsUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan sesi ujian.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (session: ExamSession) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus "${session.name}"?`)) return;

    try {
      await examsService.deleteExamSession(session.id);
      toast.success('Sesi ujian berhasil dihapus.');
      onSessionsUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus sesi ujian.');
    }
  };

  const handleToggleActive = async (session: ExamSession) => {
    try {
      await examsService.updateExamSession(session.id, {
        is_active: !session.is_active,
      });
      onSessionsUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui status sesi.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Konfigurasi Sesi Ujian</h3>
              <p className="text-xs text-slate-500">
                Atur slot waktu pelaksanaan ujian yang digunakan dalam penjadwalan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Action Bar */}
          {!isAdding && !editingId && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Total Sesi Terdaftar: {sessions.length}
              </span>
              <button
                type="button"
                onClick={handleStartAdd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Tambah Sesi
              </button>
            </div>
          )}

          {/* Form Create / Edit */}
          {(isAdding || editingId) && (
            <form
              onSubmit={handleSave}
              className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/40 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  {editingId ? 'Edit Sesi Ujian' : 'Tambah Sesi Ujian Baru'}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Nama Sesi
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Sesi 1"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-md border-slate-300"
                  />
                  <span>Sesi Aktif untuk Penjadwalan</span>
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Sesi'}
                </button>
              </div>
            </form>
          )}

          {/* Sessions List */}
          {sessions.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Belum Ada Sesi Ujian</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Tambahkan minimal 1 sesi ujian (contoh: 08:00 – 10:00) agar penjadwalan ujian dapat dilakukan.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((sess) => {
                const duration = sess.end_minute - sess.start_minute;
                return (
                  <div
                    key={sess.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      sess.is_active
                        ? 'bg-white border-slate-200/90 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(sess)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          sess.is_active
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : 'bg-slate-200 text-slate-400 border border-slate-300'
                        }`}
                        title={sess.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{sess.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-50 text-blue-700 font-mono">
                            {minuteToTime(sess.start_minute)} – {minuteToTime(sess.end_minute)}
                          </span>
                        </div>
                        <span className="text-2xs text-slate-500">
                          Durasi slot: {duration} menit
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(sess)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Edit Sesi"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sess)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Hapus Sesi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
