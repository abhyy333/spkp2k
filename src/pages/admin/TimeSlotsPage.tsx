import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Hourglass,
  Coffee,
  Plus,
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  AlertTriangle,
  Edit,
  Trash2,
  X,
  Power,
  Filter,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { timeSlotsService } from '../../services/timeSlots.service';
import { TimeSlot } from '../../types';
import { minuteToTime, timeToMinute, dayOfWeekToName } from '../../lib/utils';

export const TimeSlotsPage: React.FC = () => {
  const toast = useToast();

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'weekly'>('list');

  // Mode Perkuliahan: NORMAL vs RAMADAN
  const [academicMode, setAcademicMode] = useState<'NORMAL' | 'RAMADAN'>('NORMAL');

  // Filters
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form Fields (Default Normal Sesi 1: 07:50 - 08:40)
  const [formDayOfWeek, setFormDayOfWeek] = useState<number>(1);
  const [formStartTime, setFormStartTime] = useState<string>('07:50');
  const [formEndTime, setFormEndTime] = useState<string>('08:40');
  const [formLabel, setFormLabel] = useState<string>('Sesi 1 (1 SKS - 50m)');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Delete Confirm Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<TimeSlot | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Template / Reset Confirm
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (dayFilter !== 'all') {
        filters.day = parseInt(dayFilter, 10);
      }
      if (statusFilter === 'active') {
        filters.activeOnly = true;
      }
      const slots = await timeSlotsService.getTimeSlots(filters);
      let filtered = slots;
      if (statusFilter === 'inactive') {
        filtered = filtered.filter((s) => !s.is_active);
      }
      setTimeSlots(filtered);
    } catch (err: any) {
      console.error('Error fetching time slots:', err);
      setError(err.message || 'Gagal memuat slot waktu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, [dayFilter, statusFilter]);

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

  // Official Standard Normal Sesi (10 sesi aktif + 2 jeda break)
  const officialNormalSessions = [
    { num: 1, start: '07:50', end: '08:40', isBreak: false, label: 'Sesi 1 (50m)' },
    { num: 2, start: '08:40', end: '09:30', isBreak: false, label: 'Sesi 2 (50m)' },
    { num: 3, start: '09:30', end: '10:20', isBreak: false, label: 'Sesi 3 (50m)' },
    { num: 4, start: '10:20', end: '11:10', isBreak: false, label: 'Sesi 4 (50m)' },
    { num: 5, start: '11:10', end: '12:00', isBreak: false, label: 'Sesi 5 (50m)' },
    { num: 0, start: '12:00', end: '12:50', isBreak: true, label: 'BREAK 1 (Dzuhur)' },
    { num: 6, start: '12:50', end: '13:40', isBreak: false, label: 'Sesi 6 (50m)' },
    { num: 7, start: '13:40', end: '14:30', isBreak: false, label: 'Sesi 7 (50m)' },
    { num: 8, start: '14:30', end: '15:20', isBreak: false, label: 'Sesi 8 (50m)' },
    { num: 0, start: '15:20', end: '16:10', isBreak: true, label: 'BREAK 2 (Ashar)' },
    { num: 9, start: '16:10', end: '17:00', isBreak: false, label: 'Sesi 9 (50m)' },
    { num: 10, start: '17:00', end: '17:50', isBreak: false, label: 'Sesi 10 (50m)' },
  ];

  // Helper to calculate duration on form change
  const calcDurationMinutes = () => {
    const s = timeToMinute(formStartTime);
    const e = timeToMinute(formEndTime);
    if (e > s) return e - s;
    return 0;
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingSlot(null);
    setFormDayOfWeek(1);
    setFormStartTime('07:50');
    setFormEndTime('08:40');
    setFormLabel('Sesi 1 (1 SKS - 50m)');
    setFormIsActive(true);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (slot: TimeSlot) => {
    setEditingSlot(slot);
    setFormDayOfWeek(slot.day_of_week || 1);
    setFormStartTime(slot.start_time || minuteToTime(slot.start_minute));
    setFormEndTime(slot.end_time || minuteToTime(slot.end_minute));
    setFormLabel(slot.label || slot.slot_type || '');
    setFormIsActive(slot.is_active);
    setModalOpen(true);
  };

  // Save Slot (Create / Update)
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const duration = calcDurationMinutes();
    if (duration <= 0) {
      toast.error('Jam selesai harus lebih akhir dari jam mulai!');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingSlot) {
        await timeSlotsService.updateTimeSlot(editingSlot.id, {
          day_of_week: formDayOfWeek,
          start_time: formStartTime,
          end_time: formEndTime,
          label: formLabel,
          is_active: formIsActive,
        });
        toast.success('Slot waktu berhasil diperbarui.');
      } else {
        await timeSlotsService.createTimeSlot({
          day_of_week: formDayOfWeek,
          start_time: formStartTime,
          end_time: formEndTime,
          label: formLabel,
          is_active: formIsActive,
        });
        toast.success('Slot waktu baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadSlots();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan slot waktu.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Active
  const handleToggleActive = async (slot: TimeSlot) => {
    try {
      await timeSlotsService.toggleTimeSlotActive(slot.id, !slot.is_active);
      toast.success(`Slot berhasil di${slot.is_active ? 'nonaktifkan' : 'aktifkan'}.`);
      loadSlots();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status slot.');
    }
  };

  // Delete Action
  const handleDeleteClick = (slot: TimeSlot) => {
    setSlotToDelete(slot);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!slotToDelete) return;
    setDeleting(true);
    try {
      await timeSlotsService.deleteTimeSlot(slotToDelete.id);
      toast.success('Slot waktu berhasil dihapus.');
      setDeleteDialogOpen(false);
      setSlotToDelete(null);
      loadSlots();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus slot waktu.');
    } finally {
      setDeleting(false);
    }
  };

  // Apply Standard Normal Template (10 sesi aktif: 07:50 - 17:50, Senin s/d Jumat)
  const handleApplyTemplate = async () => {
    setActionLoading(true);
    try {
      // 10 active standard sessions per day
      const templates = [
        { start: '07:50', end: '08:40', label: 'Sesi 1 (1 SKS - 50m)' },
        { start: '08:40', end: '09:30', label: 'Sesi 2 (1 SKS - 50m)' },
        { start: '09:30', end: '10:20', label: 'Sesi 3 (1 SKS - 50m)' },
        { start: '10:20', end: '11:10', label: 'Sesi 4 (1 SKS - 50m)' },
        { start: '11:10', end: '12:00', label: 'Sesi 5 (1 SKS - 50m)' },
        { start: '12:50', end: '13:40', label: 'Sesi 6 (1 SKS - 50m)' },
        { start: '13:40', end: '14:30', label: 'Sesi 7 (1 SKS - 50m)' },
        { start: '14:30', end: '15:20', label: 'Sesi 8 (1 SKS - 50m)' },
        { start: '16:10', end: '17:00', label: 'Sesi 9 (1 SKS - 50m)' },
        { start: '17:00', end: '17:50', label: 'Sesi 10 (1 SKS - 50m)' },
      ];

      // Add template slots for Monday - Friday (1 to 5)
      for (let day = 1; day <= 5; day++) {
        for (const t of templates) {
          try {
            await timeSlotsService.createTimeSlot({
              day_of_week: day,
              start_time: t.start,
              end_time: t.end,
              label: t.label,
              is_active: true,
            });
          } catch {
            // continue if duplicate or exists
          }
        }
      }
      toast.success('Template 10 Sesi Normal (07:50 – 17:50) berhasil diterapkan.');
      setTemplateConfirmOpen(false);
      loadSlots();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menerapkan template.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset/Clear Slots
  const handleResetSlots = async () => {
    setActionLoading(true);
    try {
      for (const slot of timeSlots) {
        try {
          await timeSlotsService.deleteTimeSlot(slot.id);
        } catch {
          // ignore individual delete failure
        }
      }
      toast.success('Daftar slot waktu berhasil direset.');
      setResetConfirmOpen(false);
      loadSlots();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mereset slot.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Slot Waktu"
        subtitle="Atur periode waktu perkuliahan resmi Jurusan Teknik Elektro (Mode Normal: 07:50 – 17:50)"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Tambah Slot
            </button>
            <button
              onClick={() => setTemplateConfirmOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-blue-500" />
              Terapkan Template Standar
            </button>
            <button
              onClick={() => setResetConfirmOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-rose-500" />
              Reset Slot
            </button>
          </div>
        }
      />

      {/* Mode Perkuliahan Selector & Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Profil Waktu Operasional
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-2xs font-extrabold ${
                academicMode === 'NORMAL' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {academicMode === 'NORMAL' ? 'Mode Normal (Aktif Default)' : 'Mode Ramadan (Manual)'}
              </span>
            </div>
            <p className="text-2xs text-slate-500 mt-0.5">
              {academicMode === 'NORMAL'
                ? '07:50 – 17:50 WIB • 10 Sesi Aktif (50m/SKS) • 2 Periode Istirahat (12:00–12:50 & 15:20–16:10)'
                : 'Jadwal khusus bulan Ramadan hanya diterapkan jika diaktifkan manual oleh administrator.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAcademicMode('NORMAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              academicMode === 'NORMAL'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Mode Normal (07:50–17:50)
          </button>
          <button
            type="button"
            onClick={() => setAcademicMode('RAMADAN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              academicMode === 'RAMADAN'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Mode Ramadan
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Slot Waktu"
          value={timeSlots.length}
          icon={<Clock className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle="periode waktu terdaftar"
        />

        <StatCard
          title="Slot Aktif"
          value={timeSlots.filter((t) => t.is_active).length}
          icon={<CheckCircle2 className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          subtitle="slot dapat dijadwalkan"
        />

        <StatCard
          title="Durasi Standar"
          value="50 menit"
          icon={<Hourglass className="w-6 h-6" />}
          iconBgColor="bg-purple-50 text-purple-600"
          subtitle="1 SKS (Satuan Kredit Semester)"
        />

        <StatCard
          title="Waktu Istirahat"
          value="12:00 & 15:20"
          icon={<Coffee className="w-6 h-6" />}
          iconBgColor="bg-rose-50 text-rose-600"
          subtitle="Break 1 (12:00-12:50) & Break 2 (15:20-16:10)"
        />
      </div>

      {/* Main Grid: Slots & Rules Side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Table & Visualization */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          {/* Header Row: Tabs & Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveTab('list')}
                className={`text-xs font-semibold pb-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'list'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Daftar Slot Waktu ({timeSlots.length})
              </button>
              <button
                onClick={() => setActiveTab('weekly')}
                className={`text-xs font-semibold pb-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'weekly'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Visualisasi Mingguan (10 Sesi Normal + 2 Break)
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Semua Hari</option>
                <option value="1">Senin</option>
                <option value="2">Selasa</option>
                <option value="3">Rabu</option>
                <option value="4">Kamis</option>
                <option value="5">Jumat</option>
                <option value="6">Sabtu</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingState rows={6} message="Memuat slot waktu..." />
          ) : error ? (
            <ErrorState title="Gagal Memuat Slot" message={error} onRetry={loadSlots} />
          ) : activeTab === 'list' ? (
            timeSlots.length === 0 ? (
              <EmptyState
                title="Belum Ada Slot Waktu"
                description="Belum ada slot waktu terdaftar pada sistem atau filter yang dipilih."
                action={{
                  label: 'Terapkan Template 10 Sesi Normal',
                  onClick: () => setTemplateConfirmOpen(true),
                }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3">Hari</th>
                      <th className="py-2.5 px-3">Jam Mulai</th>
                      <th className="py-2.5 px-3">Jam Selesai</th>
                      <th className="py-2.5 px-3">Durasi</th>
                      <th className="py-2.5 px-3">Label / Jenis</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {timeSlots.map((slot, i) => (
                      <tr key={slot.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-400 font-mono">{i + 1}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {slot.day || dayOfWeekToName(slot.day_of_week)}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-700">
                          {slot.start_time || minuteToTime(slot.start_minute)}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-700">
                          {slot.end_time || minuteToTime(slot.end_minute)}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {slot.duration_minutes || (slot.end_minute - slot.start_minute)} menit
                        </td>
                        <td className="py-3 px-3">
                          <span className="flex items-center gap-1.5 font-medium text-slate-700">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                (slot.duration_minutes || 0) >= 150
                                  ? 'bg-emerald-500'
                                  : (slot.duration_minutes || 0) >= 100
                                  ? 'bg-purple-500'
                                  : 'bg-blue-500'
                              }`}
                            />
                            {slot.label || slot.slot_type || `Perkuliahan (${Math.round((slot.duration_minutes || 50) / 50)} SKS)`}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleToggleActive(slot)}
                            className="cursor-pointer"
                            title="Klik untuk beralih status aktif/nonaktif"
                          >
                            <StatusBadge label={slot.is_active ? 'Aktif' : 'Nonaktif'} showDot />
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditModal(slot)}
                              title="Edit Slot"
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(slot)}
                              title="Hapus Slot"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* Visualisasi Mingguan Resmi 10 Sesi + 2 Break */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-2xs text-slate-500 pb-2 border-b border-slate-100">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-400" /> Sesi Aktif Kuliah (50m)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-400" /> Jeda Break 1 (12:00–12:50) & Break 2 (15:20–16:10)
                </span>
              </div>

              <div className="space-y-3 overflow-x-auto pb-2">
                {days.map((day) => (
                  <div key={day} className="flex items-center gap-2 min-w-[760px]">
                    <span className="w-16 font-bold text-xs text-slate-800 shrink-0">{day}</span>
                    <div className="flex-1 grid grid-cols-12 gap-1.5 text-center">
                      {officialNormalSessions.map((sess, sIdx) => (
                        <div
                          key={sIdx}
                          className={`p-1.5 rounded-lg border text-3xs font-semibold ${
                            sess.isBreak
                              ? 'bg-amber-50 border-amber-300 text-amber-800'
                              : 'bg-blue-50 border-blue-200 text-blue-900'
                          }`}
                        >
                          <div className="font-extrabold truncate">
                            {sess.isBreak ? 'BREAK' : `Sesi ${sess.num}`}
                          </div>
                          <div className="font-mono text-4xs opacity-80">
                            {sess.start}–{sess.end}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Rules Cards */}
        <div className="lg:col-span-4 space-y-4">
          {/* Aturan Durasi Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-blue-600">
              <Info className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-slate-800">Aturan Durasi Resmi (Normal)</h4>
            </div>
            <p className="text-xl font-extrabold text-slate-900 tracking-tight">
              1 SKS = 50 menit
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hari akademik normal dimulai pukul <strong>07:50</strong> dan berakhir pukul <strong>17:50</strong> WITA dengan total 10 sesi aktif dan 2 jeda istirahat/sholat.
            </p>
          </div>

          {/* Struktur Sesi Perkuliahan Normal */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Struktur Sesi Harian Resmi
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/70 border border-blue-100">
                <span className="font-semibold text-blue-900">Sesi 1 – 5 (Pagi)</span>
                <span className="font-mono text-blue-700">07:50 – 12:00</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                <span className="font-bold">Break 1 (Dzuhur & Makan)</span>
                <span className="font-mono font-bold">12:00 – 12:50</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/70 border border-blue-100">
                <span className="font-semibold text-blue-900">Sesi 6 – 8 (Siang)</span>
                <span className="font-mono text-blue-700">12:50 – 15:20</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                <span className="font-bold">Break 2 (Ashar & Istirahat)</span>
                <span className="font-mono font-bold">15:20 – 16:10</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/70 border border-blue-100">
                <span className="font-semibold text-blue-900">Sesi 9 – 10 (Sore)</span>
                <span className="font-mono text-blue-700">16:10 – 17:50</span>
              </div>
            </div>
          </div>

          {/* Waktu Istirahat Warning */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Waktu Istirahat & Sholat</span>
            </div>
            <p className="text-2xs text-amber-700 leading-relaxed">
              Dua slot break (12:00–12:50 dan 15:20–16:10) tidak dialokasikan untuk perkuliahan maupun ujian teori reguler guna menjaga waktu ibadah dan istirahat civitas akademika.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Create / Edit Slot */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingSlot ? 'Edit Slot Waktu' : 'Tambah Slot Waktu Baru'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hari Perkuliahan *</label>
                <select
                  value={formDayOfWeek}
                  onChange={(e) => setFormDayOfWeek(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value={1}>Senin</option>
                  <option value={2}>Selasa</option>
                  <option value={3}>Rabu</option>
                  <option value={4}>Kamis</option>
                  <option value={5}>Jumat</option>
                  <option value={6}>Sabtu</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Mulai *</label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Selesai *</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Calculated Info */}
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-blue-900">
                <span>Durasi: <strong>{calcDurationMinutes()} menit</strong></span>
                <span>Setara: <strong>{Math.round(calcDurationMinutes() / 50)} SKS</strong></span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Label / Keterangan</label>
                <input
                  type="text"
                  placeholder="Contoh: Perkuliahan (2 SKS) / Praktikum"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="slot_active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="slot_active" className="font-medium text-slate-700 cursor-pointer">
                  Slot Aktif (dapat digunakan untuk alokasi jadwal)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Slot Waktu"
        message={`Apakah Anda yakin ingin menghapus slot waktu ${slotToDelete?.day || ''} (${slotToDelete?.start_time} - ${slotToDelete?.end_time})? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus Slot"
        variant="danger"
        isLoading={deleting}
      />

      {/* Apply Template Confirmation */}
      <ConfirmDialog
        isOpen={templateConfirmOpen}
        onClose={() => setTemplateConfirmOpen(false)}
        onConfirm={handleApplyTemplate}
        title="Terapkan Template 10 Sesi Normal"
        message="Sistem akan menambahkan 10 sesi perkuliahan standar Jurusan Teknik Elektro (Senin s/d Jumat, 07:50 – 17:50 dengan 2 jeda break). Lanjutkan?"
        confirmText="Terapkan Sekarang"
        variant="info"
        isLoading={actionLoading}
      />

      {/* Reset Confirmation */}
      <ConfirmDialog
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleResetSlots}
        title="Reset Slot Waktu"
        message="Apakah Anda yakin ingin mereset seluruh slot waktu yang ada? Tindakan ini akan menghapus slot waktu saat ini sehingga Anda dapat menerapkan template baru."
        confirmText="Reset Semua Slot"
        variant="danger"
        isLoading={actionLoading}
      />
    </div>
  );
};

export const SlotWaktuPage = TimeSlotsPage;
