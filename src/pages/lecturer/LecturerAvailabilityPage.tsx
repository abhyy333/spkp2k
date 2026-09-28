import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Clock,
  Info,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Ban,
  X,
  User,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { lecturersService } from '../../services/lecturers.service';
import { lecturerAvailabilityService } from '../../services/lecturerAvailability.service';
import { academicTermsService } from '../../services/academicTerms.service';
import { Lecturer, LecturerAvailability, AvailabilityPreference, AcademicTerm } from '../../types';
import { timeToMinute, minuteToTime, dayOfWeekToName } from '../../lib/utils';

export const LecturerAvailabilityPage: React.FC = () => {
  const { profile, role } = useAuth();
  const toast = useToast();

  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [selectedLecturer, setSelectedLecturer] = useState<Lecturer | null>(null);
  const [academicTerms, setAcademicTerms] = useState<AcademicTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('all');

  const [availability, setAvailability] = useState<LecturerAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Add Slot
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formDayOfWeek, setFormDayOfWeek] = useState<number>(1);
  const [formStartTime, setFormStartTime] = useState<string>('08:00');
  const [formEndTime, setFormEndTime] = useState<string>('10:00');
  const [formIsAvailable, setFormIsAvailable] = useState<boolean>(true);
  const [formPreference, setFormPreference] = useState<AvailabilityPreference>('preferred');
  const [formNotes, setFormNotes] = useState<string>('');

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<LecturerAvailability | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [allTerms, allLecturers] = await Promise.all([
          academicTermsService.getAcademicTerms(),
          lecturersService.getLecturers(),
        ]);
        setAcademicTerms(allTerms);
        setLecturers(allLecturers);

        // Find lecturer corresponding to profile or default to first
        let currentLecturer: Lecturer | null = null;
        if (profile?.id) {
          currentLecturer = await lecturersService.getLecturerByProfileId(profile.id);
        }
        if (!currentLecturer && allLecturers.length > 0) {
          currentLecturer = allLecturers[0];
        }
        setSelectedLecturer(currentLecturer);

        const activeTerm = allTerms.find((t) => t.is_active);
        if (activeTerm) {
          setSelectedTermId(activeTerm.id);
        }
      } catch (err) {
        console.error('Error initializing availability page:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [profile]);

  // Load availability when lecturer or term changes
  const loadAvailability = async () => {
    if (!selectedLecturer?.id) return;
    try {
      const data = await lecturerAvailabilityService.getAvailability(
        selectedLecturer.id,
        selectedTermId
      );
      setAvailability(data);
    } catch (err) {
      console.error('Error loading lecturer availability:', err);
    }
  };

  useEffect(() => {
    loadAvailability();
  }, [selectedLecturer, selectedTermId]);

  const days = [
    { num: 1, name: 'Senin' },
    { num: 2, name: 'Selasa' },
    { num: 3, name: 'Rabu' },
    { num: 4, name: 'Kamis' },
    { num: 5, name: 'Jumat' },
  ];

  // Stats calculation
  const totalSlots = availability.length;
  const preferredSlots = availability.filter((a) => a.is_available && a.preference === 'preferred').length;
  const avoidSlots = availability.filter((a) => a.is_available && a.preference === 'avoid').length;
  const unavailableSlots = availability.filter((a) => !a.is_available).length;

  // Add Slot Handler
  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLecturer?.id) return;

    const startMin = timeToMinute(formStartTime);
    const endMin = timeToMinute(formEndTime);

    if (endMin <= startMin) {
      toast.error('Jam selesai harus lebih akhir dari jam mulai!');
      return;
    }

    setSubmitting(true);
    try {
      await lecturerAvailabilityService.addAvailabilitySlot({
        lecturer_id: selectedLecturer.id,
        academic_term_id: selectedTermId === 'all' ? null : selectedTermId,
        day_of_week: formDayOfWeek,
        start_minute: startMin,
        end_minute: endMin,
        is_available: formIsAvailable,
        preference: formIsAvailable ? formPreference : 'neutral',
        notes: formNotes,
      });

      toast.success('Preferensi ketersediaan mengajar berhasil disimpan.');
      setModalOpen(false);
      setFormNotes('');
      loadAvailability();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan ketersediaan.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Slot Handler
  const handleDeleteClick = (slot: LecturerAvailability) => {
    setSlotToDelete(slot);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!slotToDelete) return;
    setDeleting(true);
    try {
      await lecturerAvailabilityService.deleteAvailabilitySlot(slotToDelete.id);
      toast.success('Preferensi slot waktu berhasil dihapus.');
      setDeleteDialogOpen(false);
      setSlotToDelete(null);
      loadAvailability();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus slot ketersediaan.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ketersediaan Waktu Mengajar"
        subtitle="Kelola preferensi dan batasan waktu mengajar dosen Teknik Elektro Universitas Mataram"
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Tambah Preferensi Waktu
          </button>
        }
      />

      {/* Admin / Lecturer Selector Toolbar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
            {selectedLecturer?.lecturer_code || <User className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
              {role === 'ADMIN' ? 'Mengatur Jadwal Dosen:' : 'Profil Dosen:'}
            </div>
            {role === 'ADMIN' ? (
              <select
                value={selectedLecturer?.id || ''}
                onChange={(e) => {
                  const lect = lecturers.find((l) => l.id === e.target.value);
                  setSelectedLecturer(lect || null);
                }}
                className="font-bold text-slate-800 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {lecturers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.lecturer_code ? `(${l.lecturer_code})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <h3 className="font-bold text-slate-800 text-sm">{selectedLecturer?.name}</h3>
            )}
          </div>
        </div>

        {/* Term Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Semester:</span>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Semua Semester</option>
            {academicTerms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.is_active ? '(Aktif)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Preferensi"
          value={totalSlots}
          icon={<Clock className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle="slot waktu khusus terdaftar"
        />

        <StatCard
          title="Diutamakan"
          value={preferredSlots}
          icon={<ThumbsUp className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          subtitle="waktu prioritas mengajar"
        />

        <StatCard
          title="Dihindari"
          value={avoidSlots}
          icon={<ThumbsDown className="w-6 h-6" />}
          iconBgColor="bg-amber-50 text-amber-600"
          subtitle="diutamakan untuk tidak dijadwalkan"
        />

        <StatCard
          title="Tidak Bersedia"
          value={unavailableSlots}
          icon={<Ban className="w-6 h-6" />}
          iconBgColor="bg-rose-50 text-rose-600"
          subtitle="berhalangan / tugas lain"
        />
      </div>

      {/* Information Banner */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-3 text-xs text-sky-900">
        <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Ketentuan Ketersediaan Mengajar:</p>
          <p className="text-2xs text-sky-800 leading-relaxed">
            Data preferensi ini digunakan oleh Sistem Pendukung Keputusan untuk meminimalkan konflik waktu dosen pengampu. Slot berstatus <strong>Tidak Bersedia</strong> akan menjadi batasan ketat (hard constraint), sedangkan slot <strong>Diutamakan / Dihindari</strong> menjadi preferensi optimasi (soft constraint).
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingState rows={5} message="Memuat ketersediaan dosen..." />
      ) : (
        /* Weekly Days Grid */
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            Jadwal Preferensi Mengajar per Hari
          </h3>

          <div className="space-y-4">
            {days.map((day) => {
              const daySlots = availability.filter((a) => a.day_of_week === day.num);
              return (
                <div
                  key={day.num}
                  className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center">
                        {day.name.slice(0, 3)}
                      </span>
                      <h4 className="font-bold text-sm text-slate-800">{day.name}</h4>
                      <span className="text-2xs text-slate-400">
                        ({daySlots.length} preferensi)
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setFormDayOfWeek(day.num);
                        setModalOpen(true);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah di Hari {day.name}
                    </button>
                  </div>

                  {daySlots.length === 0 ? (
                    <p className="text-2xs text-slate-500 italic py-1">
                      Tersedia untuk semua slot perkuliahan reguler pada hari ini (tidak ada batasan khusus).
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {daySlots.map((slot) => {
                        const isUnavailable = !slot.is_available;
                        const isPref = slot.is_available && slot.preference === 'preferred';
                        const isAvoid = slot.is_available && slot.preference === 'avoid';

                        const badgeColor = isUnavailable
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : isPref
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : isAvoid
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-blue-50 border-blue-200 text-blue-800';

                        return (
                          <div
                            key={slot.id}
                            className={`p-3 rounded-xl border ${badgeColor} flex items-start justify-between gap-2 transition-all`}
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-xs font-mono">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                {slot.start_time} – {slot.end_time}
                              </div>

                              <div className="flex items-center gap-1">
                                {isUnavailable && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-bold bg-rose-200 text-rose-900">
                                    <Ban className="w-3 h-3" /> Tidak Bersedia
                                  </span>
                                )}
                                {isPref && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-bold bg-emerald-200 text-emerald-900">
                                    <ThumbsUp className="w-3 h-3" /> Diutamakan
                                  </span>
                                )}
                                {isAvoid && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-bold bg-amber-200 text-amber-900">
                                    <ThumbsDown className="w-3 h-3" /> Dihindari
                                  </span>
                                )}
                                {slot.is_available && slot.preference === 'neutral' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-bold bg-blue-200 text-blue-900">
                                    Bersedia
                                  </span>
                                )}
                              </div>

                              {slot.notes && (
                                <p className="text-3xs text-slate-600 line-clamp-2 pt-0.5 italic">
                                  "{slot.notes}"
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteClick(slot)}
                              title="Hapus slot ketersediaan"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100/50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Add Availability Slot */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Tambah Preferensi Ketersediaan Waktu
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSlot} className="space-y-4 text-xs">
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

              {/* Status Ketersediaan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Ketersediaan *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormIsAvailable(true)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      formIsAvailable
                        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    Tersedia Mengajar
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormIsAvailable(false)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      !formIsAvailable
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-600" />
                    Tidak Bisa (Berhalangan)
                  </button>
                </div>
              </div>

              {/* Preference Type (if available) */}
              {formIsAvailable && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tingkat Preferensi</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormPreference('preferred')}
                      className={`py-2 px-2 text-2xs font-bold rounded-lg border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        formPreference === 'preferred'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                      Diutamakan
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormPreference('neutral')}
                      className={`py-2 px-2 text-2xs font-bold rounded-lg border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        formPreference === 'neutral'
                          ? 'bg-blue-50 border-blue-500 text-blue-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      Netral
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormPreference('avoid')}
                      className={`py-2 px-2 text-2xs font-bold rounded-lg border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        formPreference === 'avoid'
                          ? 'bg-amber-50 border-amber-500 text-amber-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5 text-amber-600" />
                      Dihindari
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan / Alasan</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Rapat Struktural Dekanat / Mengajar Pascasarjana"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Preferensi'}
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
        title="Hapus Preferensi Waktu"
        message={`Apakah Anda yakin ingin menghapus slot preferensi waktu ${slotToDelete?.day || ''} (${slotToDelete?.start_time} - ${slotToDelete?.end_time})? Tindakan ini akan mengembalikan slot ke status ketersediaan normal.`}
        confirmText="Hapus Preferensi"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
};
