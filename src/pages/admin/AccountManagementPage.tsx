import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  ShieldCheck,
  GraduationCap,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  Mail,
  UserCheck,
  Crown,
  X,
  RefreshCw,
  Info,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from '../../components/ui/Toast';
import { authorizedAccountsService } from '../../services/authorizedAccounts.service';
import { lecturersService } from '../../services/lecturers.service';
import { AuthorizedAccount, Lecturer } from '../../types';
import { OWNER_EMAIL } from '../../lib/authGuard';
import { useAuth } from '../../contexts/AuthContext';

export const AccountManagementPage: React.FC = () => {
  const { user } = useAuth();
  const currentUserEmail = user?.email?.trim().toLowerCase() || '';

  const [activeTab, setActiveTab] = useState<'ADMIN' | 'DOSEN'>('ADMIN');
  const [accounts, setAccounts] = useState<AuthorizedAccount[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isLoadingRef = useRef(false);
  const lastErrorToastRef = useRef<number>(0);

  // Modal Add Admin
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  // Modal Add Lecturer Account
  const [lecturerModalOpen, setLecturerModalOpen] = useState(false);
  const [selectedLecturerId, setSelectedLecturerId] = useState('');
  const [lecturerEmail, setLecturerEmail] = useState('');
  const [submittingLecturer, setSubmittingLecturer] = useState(false);

  // Confirmation Dialog
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Konfirmasi',
    variant: 'danger',
    action: async () => {},
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Load Data with in-flight guard and centralized error handling
  const loadData = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const [accs, lects] = await Promise.all([
        authorizedAccountsService.getAuthorizedAccounts(),
        lecturersService.getLecturers(),
      ]);
      setAccounts(accs);
      setLecturers(lects);
    } catch (err: any) {
      const msg = 'Data akun gagal dimuat. Silakan coba lagi.';
      setLoadError(msg);
      const now = Date.now();
      if (now - lastErrorToastRef.current > 2000) {
        lastErrorToastRef.current = now;
        toast.error(msg);
      }
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter accounts by tab and search
  const adminAccounts = accounts.filter((a) => a.role === 'ADMIN');
  const lecturerAccounts = accounts.filter((a) => a.role === 'DOSEN');

  const filteredAccounts = (activeTab === 'ADMIN' ? adminAccounts : lecturerAccounts).filter((acc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchEmail = acc.email.toLowerCase().includes(q);
    const matchName = acc.lecturer?.name?.toLowerCase().includes(q) || false;
    const matchCode =
      acc.lecturer?.lecturer_code?.toLowerCase().includes(q) ||
      false;
    return matchEmail || matchName || matchCode;
  });

  // Calculate stats from loaded query data
  const totalAdmins = adminAccounts.length;
  const registeredAdmins = adminAccounts.filter((a) => a.user_id !== null).length;
  const totalLecturersAuth = lecturerAccounts.length;
  const registeredLecturers = lecturerAccounts.filter((a) => a.user_id !== null).length;

  // Handle Add Admin
  const handleAddAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = adminEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Silakan masukkan alamat email yang valid.');
      return;
    }

    setSubmittingAdmin(true);
    try {
      await authorizedAccountsService.addAdmin(cleanEmail);
      toast.success(`Email ${cleanEmail} berhasil ditambahkan sebagai Administrator.`);
      setAdminModalOpen(false);
      setAdminEmail('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan Administrator.');
    } finally {
      setSubmittingAdmin(false);
    }
  };

  // Handle Add Lecturer Account
  const handleAddLecturerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLecturerId) {
      toast.error('Silakan pilih dosen terlebih dahulu.');
      return;
    }

    const cleanEmail = lecturerEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Silakan masukkan alamat email dosen yang valid.');
      return;
    }

    setSubmittingLecturer(true);
    try {
      await authorizedAccountsService.addLecturerAccount(cleanEmail, selectedLecturerId);
      toast.success('Akun dosen berhasil diotorisasi.');
      setLecturerModalOpen(false);
      setSelectedLecturerId('');
      setLecturerEmail('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mendaftarkan akun dosen.');
    } finally {
      setSubmittingLecturer(false);
    }
  };

  // Handle Status Toggle (Activate / Deactivate) using email as Primary Key
  const handleToggleStatus = (acc: AuthorizedAccount) => {
    const targetEmail = acc.email.trim().toLowerCase();

    if (!acc.is_active && targetEmail === currentUserEmail) {
      // Reactivation of self is harmless; this branch should not normally be reachable.
    } else if (acc.is_active && targetEmail === currentUserEmail) {
      toast.error('Anda tidak dapat menonaktifkan akun yang sedang digunakan.');
      return;
    }

    if (acc.is_system_owner || targetEmail === OWNER_EMAIL.toLowerCase()) {
      toast.error('System Owner tidak boleh dinonaktifkan.');
      return;
    }

    const newStatus = !acc.is_active;
    const actionLabel = newStatus ? 'Mengaktifkan kembali' : 'Menonaktifkan';

    setDialogConfig({
      isOpen: true,
      title: `${actionLabel} Akses`,
      message: `Apakah Anda yakin ingin ${actionLabel.toLowerCase()} akses untuk akun ${acc.email}? ${
        !newStatus
          ? 'Pengguna tidak akan dapat mengakses fitur berwenang hingga diaktifkan kembali.'
          : 'Pengguna akan kembali mendapatkan hak akses sesuai perannya.'
      }`,
      confirmText: newStatus ? 'Aktifkan Kembali' : 'Nonaktifkan Akses',
      variant: newStatus ? 'primary' : 'warning',
      action: async () => {
        setActionLoading(true);
        try {
          await authorizedAccountsService.setStatus(acc.email, newStatus, acc.is_system_owner);
          toast.success(`Akses untuk ${acc.email} berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.`);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          toast.error(err.message || 'Gagal mengubah status akses.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Handle Delete Authorization using email as Primary Key
  const handleDeleteAccount = (acc: AuthorizedAccount) => {
    const targetEmail = acc.email.trim().toLowerCase();
    if (targetEmail === currentUserEmail) {
      toast.error('Anda tidak dapat menghapus otorisasi akun yang sedang digunakan.');
      return;
    }

    if (acc.is_system_owner || targetEmail === OWNER_EMAIL.toLowerCase()) {
      toast.error('System Owner tidak boleh dihapus.');
      return;
    }

    setDialogConfig({
      isOpen: true,
      title: 'Hapus Otorisasi Akun',
      message: `Apakah Anda yakin ingin menghapus otorisasi untuk ${acc.email}? Tindakan ini akan mencabut izin peran ${acc.role} dari email ini.`,
      confirmText: 'Hapus Otorisasi',
      variant: 'danger',
      action: async () => {
        setActionLoading(true);
        try {
          await authorizedAccountsService.deleteAuthorizedAccount(acc.email, acc.is_system_owner);
          toast.success(`Otorisasi ${acc.email} berhasil dihapus.`);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
          await loadData();
        } catch (err: any) {
          toast.error(err.message || 'Gagal menghapus otorisasi.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // Helper for lecturer selection: auto fill lecturer email if available
  const handleLecturerSelectChange = (lecturerId: string) => {
    setSelectedLecturerId(lecturerId);
    const lect = lecturers.find((l) => l.id === lecturerId);
    if (lect && lect.email) {
      setLecturerEmail(lect.email);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Akun & Akses"
        subtitle="Kelola otorisasi akun pengguna untuk Administrator dan Dosen Teknik Elektro"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
            {activeTab === 'ADMIN' ? (
              <button
                onClick={() => setAdminModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tambah Admin
              </button>
            ) : (
              <button
                onClick={() => setLecturerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Daftarkan Akun Dosen
              </button>
            )}
          </div>
        }
      />

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Administrator"
          value={totalAdmins}
          icon={<ShieldCheck className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle={`${registeredAdmins} terdaftar aktif`}
        />
        <StatCard
          title="Admin Menunggu"
          value={totalAdmins - registeredAdmins}
          icon={<Clock className="w-6 h-6" />}
          iconBgColor="bg-amber-50 text-amber-600"
          subtitle="belum mendaftar di sistem"
        />
        <StatCard
          title="Akun Dosen Terdaftar"
          value={registeredLecturers}
          icon={<UserCheck className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          subtitle={`dari ${totalLecturersAuth} dosen diotorisasi`}
        />
        <StatCard
          title="Dosen Belum Klaim"
          value={totalLecturersAuth - registeredLecturers}
          icon={<GraduationCap className="w-6 h-6" />}
          iconBgColor="bg-purple-50 text-purple-600"
          subtitle="menunggu registrasi mandiri"
        />
      </div>

      {/* Information Banner */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-3 text-xs text-sky-900">
        <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Ketentuan Manajemen Akses Terpusat:</p>
          <p className="text-2xs text-sky-800 leading-relaxed">
            Sistem otorisasi akun terpusat Jurusan Teknik Elektro. Akses registrasi akun hanya dibuka bagi Administrator dan Dosen yang emailnya telah diotorisasi di bawah. Saat pengguna mendaftar dengan email yang cocok, sistem otomatis menetapkan peran dan menautkan data dosen terkait. Mahasiswa dan publik dapat langsung mengakses jadwal kuliah dan ujian tanpa perlu membuat akun.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Tab Header & Search Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl">
            <button
              onClick={() => setActiveTab('ADMIN')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'ADMIN'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ADMIN</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-blue-100 text-blue-800">
                {adminAccounts.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('DOSEN')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'DOSEN'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>DOSEN</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-purple-100 text-purple-800">
                {lecturerAccounts.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={activeTab === 'ADMIN' ? 'Cari email admin...' : 'Cari nama, kode, email dosen...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && <LoadingState rows={5} message="Memuat daftar otorisasi akun..." />}

        {/* Error State */}
        {!loading && loadError && (
          <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
            <p className="text-xs font-semibold text-rose-900">{loadError}</p>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !loadError && filteredAccounts.length === 0 && (
          <EmptyState
            icon={<Users className="w-8 h-8 text-slate-400" />}
            title={activeTab === 'ADMIN' ? 'Belum Ada Administrator' : 'Belum Ada Akun Dosen Terdaftar'}
            description={
              searchQuery
                ? 'Tidak ditemukan akun yang sesuai dengan kata kunci pencarian Anda.'
                : activeTab === 'ADMIN'
                ? 'Tambahkan email pengguna untuk memberikan hak akses Administrator.'
                : 'Daftarkan email dosen untuk memberikan akses jadwal dan ketersediaan waktu mengajar.'
            }
          />
        )}

        {/* TAB 1: ADMIN TABLE */}
        {!loading && filteredAccounts.length > 0 && activeTab === 'ADMIN' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-2xs">
                <tr>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Status Akun</th>
                  <th className="py-3 px-4">Status Akses</th>
                  <th className="py-3 px-4">Ditambahkan</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((acc) => {
                  const isOwner =
                    acc.is_system_owner ||
                    acc.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
                  const isRegistered = Boolean(acc.user_id);
                  const isAccountActive = acc.is_active;

                  return (
                    <tr key={acc.email} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{acc.email}</span>
                          {isOwner && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                              <Crown className="w-3 h-3 text-amber-600" />
                              System Owner
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isRegistered ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Terdaftar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Menunggu Pendaftaran
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {isAccountActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {acc.created_at
                          ? new Date(acc.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isOwner ? (
                          <span className="text-3xs text-slate-400 font-medium italic">
                            Terlindungi Sistem
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleStatus(acc)}
                              className={`px-2.5 py-1 rounded-lg text-2xs font-semibold transition-colors cursor-pointer ${
                                isAccountActive
                                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                            >
                              {isAccountActive ? 'Nonaktifkan Akses' : 'Aktifkan Kembali'}
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(acc)}
                              title="Hapus Otorisasi"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: DOSEN TABLE */}
        {!loading && filteredAccounts.length > 0 && activeTab === 'DOSEN' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-2xs">
                <tr>
                  <th className="py-3 px-4">Nama Dosen</th>
                  <th className="py-3 px-3 text-center">Kode Dosen</th>
                  <th className="py-3 px-4">Email Terdaftar</th>
                  <th className="py-3 px-4">Status Akun</th>
                  <th className="py-3 px-4">Status Akses</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((acc) => {
                  const isRegistered = Boolean(acc.user_id);
                  const isAccountActive = acc.is_active;

                  return (
                    <tr key={acc.email} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {acc.lecturer?.name ? (
                          <span>{acc.lecturer.name}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-2xs font-bold">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            Belum terhubung ke data dosen
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {acc.lecturer ? (
                          <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {acc.lecturer.lecturer_code || '—'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setLecturerEmail(acc.email);
                              setLecturerModalOpen(true);
                            }}
                            className="text-2xs font-bold text-blue-600 hover:underline cursor-pointer"
                          >
                            Hubungkan Dosen
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {acc.email}
                      </td>
                      <td className="py-3.5 px-4">
                        {isRegistered ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Terdaftar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Menunggu Pendaftaran
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {isAccountActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(acc)}
                            className={`px-2.5 py-1 rounded-lg text-2xs font-semibold transition-colors cursor-pointer ${
                              isAccountActive
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          >
                            {isAccountActive ? 'Nonaktifkan Akses' : 'Aktifkan Kembali'}
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(acc)}
                            title="Hapus Otorisasi"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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

      {/* MODAL 1: TAMBAH ADMIN */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Tambah Administrator Baru</h3>
              </div>
              <button
                onClick={() => setAdminModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-2xs text-blue-900 leading-relaxed">
              Admin baru harus mendaftar sendiri menggunakan alamat email yang dimasukkan. Peran ADMIN akan otomatis ditetapkan oleh backend saat proses pendaftaran selesai.
            </div>

            <form onSubmit={handleAddAdminSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Alamat Email Admin *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="admin@unram.ac.id"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submittingAdmin}
                  onClick={() => setAdminModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAdmin}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingAdmin ? 'Menambahkan...' : 'Tambahkan Otorisasi Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DAFTARKAN AKUN DOSEN */}
      {lecturerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">Daftarkan Akun Dosen</h3>
              </div>
              <button
                onClick={() => setLecturerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-2xs text-purple-900 leading-relaxed">
              Satu dosen hanya boleh terhubung ke satu email otorisasi aktif. Dosen dapat mendaftar sendiri menggunakan email ini untuk mengelola ketersediaan dan melihat jadwal mengampu.
            </div>

            <form onSubmit={handleAddLecturerSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Pilih Dosen Pengampu *
                </label>
                <select
                  required
                  value={selectedLecturerId}
                  onChange={(e) => handleLecturerSelectChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">-- Pilih Dosen --</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.lecturer_code ? `(${l.lecturer_code})` : ''} — {l.status || 'Aktif'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Alamat Email Dosen *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="dosen@unram.ac.id"
                    value={lecturerEmail}
                    onChange={(e) => setLecturerEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submittingLecturer}
                  onClick={() => setLecturerModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingLecturer}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingLecturer ? 'Mendaftarkan...' : 'Daftarkan Akun Dosen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        onClose={() => setDialogConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={dialogConfig.action}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmText={dialogConfig.confirmText}
        variant={dialogConfig.variant}
        isLoading={actionLoading}
      />
    </div>
  );
};
