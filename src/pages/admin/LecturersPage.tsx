import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  TrendingUp,
  Calendar,
  Search,
  Plus,
  RotateCcw,
  Edit,
  Trash2,
  X,
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  Building,
  Mail,
  Phone,
  UserX,
  Eye,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Drawer } from '../../components/ui/Drawer';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { lecturersService } from '../../services/lecturers.service';
import { coursesService } from '../../services/courses.service';
import { Lecturer, LecturerAvailability, KBK } from '../../types';
import { getInitials } from '../../lib/utils';
import { LecturerCourseAssignmentsTab } from '../../components/lecturers/LecturerCourseAssignmentsTab';

export const LecturersPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();

  const [mainTab, setMainTab] = useState<'data-dosen' | 'dosen-pengampu'>('data-dosen');
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [kbks, setKbks] = useState<KBK[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    highLoad: 0,
    available: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [kbkFilter, setKbkFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Aktif' | 'Nonaktif'>('Aktif');

  // Sorting
  const [sortField, setSortField] = useState<'name' | 'code' | 'offerings'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Detail Drawer
  const [selectedLecturerId, setSelectedLecturerId] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<{
    lecturer: Lecturer;
    assignedOfferings: any[];
    availability: LecturerAvailability[];
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'courses' | 'availability'>('info');

  // Modal Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLecturer, setEditingLecturer] = useState<Lecturer | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formKbkId, setFormKbkId] = useState('');
  const [formNip, setFormNip] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [similarLecturers, setSimilarLecturers] = useState<Lecturer[]>([]);

  // Deactivate & Delete Dialogs
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [lecturerToDeactivate, setLecturerToDeactivate] = useState<Lecturer | null>(null);
  const [isDeactivateFromDelete, setIsDeactivateFromDelete] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lecturerToDelete, setLecturerToDelete] = useState<Lecturer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s, kbkList] = await Promise.all([
        lecturersService.getLecturers({
          search,
          kbkId: kbkFilter,
          status: statusFilter,
        }),
        lecturersService.getStats(),
        coursesService.getKBKs(),
      ]);

      setLecturers(list);
      setStats(s);
      setKbks(kbkList);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data dosen.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [kbkFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Open Drawer Detail
  const handleOpenDetail = async (id: string) => {
    setSelectedLecturerId(id);
    setDrawerLoading(true);
    setActiveTab('info');
    try {
      const data = await lecturersService.getLecturerById(id);
      setDrawerData(data);
    } catch (err) {
      console.error('Error fetching lecturer detail:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingLecturer(null);
    setFormName('');
    setFormCode('');
    setFormKbkId(kbks[0]?.id || '');
    setFormNip('');
    setFormEmail('');
    setFormPhone('');
    setSimilarLecturers([]);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (l: Lecturer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingLecturer(l);
    setFormName(l.name);
    setFormCode(l.lecturer_code || l.code || '');
    setFormKbkId(l.kbk_id || '');
    setFormNip(l.nip || '');
    setFormEmail(l.email || '');
    setFormPhone(l.phone || '');
    setSimilarLecturers([]);
    setModalOpen(true);
  };

  // Detect similar names on typing
  useEffect(() => {
    if (!modalOpen || !formName || formName.trim().length < 4) {
      setSimilarLecturers([]);
      return;
    }
    const timer = setTimeout(async () => {
      const similar = await lecturersService.checkSimilarLecturerNames(
        formName,
        editingLecturer?.id
      );
      setSimilarLecturers(similar);
    }, 300);
    return () => clearTimeout(timer);
  }, [formName, modalOpen, editingLecturer]);

  // Save Lecturer
  const handleSaveLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      if (editingLecturer) {
        await lecturersService.updateLecturer(editingLecturer.id, {
          name: formName,
          lecturer_code: formCode,
          kbk_id: formKbkId || undefined,
          nip: formNip,
          email: formEmail,
          phone: formPhone,
        });
        toast.success('Data dosen berhasil diperbarui.');
      } else {
        await lecturersService.createLecturer({
          name: formName,
          lecturer_code: formCode,
          kbk_id: formKbkId || undefined,
          nip: formNip,
          email: formEmail,
          phone: formPhone,
        });
        toast.success('Dosen baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan data dosen.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Status (Aktifkan / Nonaktifkan)
  const handleToggleStatus = async (l: Lecturer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (l.status === 'Nonaktif') {
      try {
        await lecturersService.updateLecturerStatus(l.id, 'Aktif');
        toast.success(`Dosen ${l.name} berhasil diaktifkan kembali.`);
        loadData();
      } catch (err: any) {
        toast.error(err.message || 'Gagal mengaktifkan kembali dosen.');
      }
    } else {
      setLecturerToDeactivate(l);
      setIsDeactivateFromDelete(false);
      setDeactivateDialogOpen(true);
    }
  };

  // Delete Action (Protected by dependency check)
  const handleDeleteClick = async (l: Lecturer, e: React.MouseEvent) => {
    e.stopPropagation();
    // 6 & 8. Check dependencies: if lecturer is used, don't allow delete -> offer deactivation
    const offeringsCount = l.offerings_count || 0;
    if (offeringsCount > 0) {
      setLecturerToDeactivate(l);
      setIsDeactivateFromDelete(true);
      setDeactivateDialogOpen(true);
      return;
    }

    try {
      const deps = await lecturersService.checkLecturerDependencies(l.id);
      if (deps.inUse) {
        setLecturerToDeactivate(l);
        setIsDeactivateFromDelete(true);
        setDeactivateDialogOpen(true);
      } else {
        setLecturerToDelete(l);
        setDeleteDialogOpen(true);
      }
    } catch {
      setLecturerToDelete(l);
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!lecturerToDeactivate) return;
    setUpdatingStatus(true);
    try {
      await lecturersService.updateLecturerStatus(lecturerToDeactivate.id, 'Nonaktif');
      toast.success(`Dosen ${lecturerToDeactivate.name} berhasil dinonaktifkan.`);
      setDeactivateDialogOpen(false);
      setLecturerToDeactivate(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menonaktifkan dosen.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!lecturerToDelete) return;
    setDeleting(true);
    try {
      await lecturersService.deleteLecturer(lecturerToDelete.id);
      toast.success('Data dosen berhasil dihapus.');
      setDeleteDialogOpen(false);
      setLecturerToDelete(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus dosen.');
    } finally {
      setDeleting(false);
    }
  };

  // Sorting
  const sortedLecturers = [...lecturers].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortField === 'code') cmp = (a.lecturer_code || '').localeCompare(b.lecturer_code || '');
    else if (sortField === 'offerings') cmp = (a.offerings_count || 0) - (b.offerings_count || 0);
    return sortAsc ? cmp : -cmp;
  });

  const handleSort = (field: 'name' | 'code' | 'offerings') => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const paginatedLecturers = sortedLecturers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={mainTab === 'data-dosen' ? 'Data Dosen' : 'Dosen Pengampu MK'}
        subtitle={
          mainTab === 'data-dosen'
            ? 'Kelola master data dosen, kode inisial, KBK, dan beban penawaran mengajar'
            : 'Pemetaan penugasan dosen pengampu mata kuliah per semester (Semester 1–8)'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Dosen
            </button>
            <button
              onClick={() => navigate('/dosen/ketersediaan')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-colors shadow-2xs"
            >
              <Calendar className="w-4 h-4 text-slate-400" />
              Atur Ketersediaan
            </button>
          </div>
        }
      />

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setMainTab('data-dosen')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            mainTab === 'data-dosen'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Data Dosen
        </button>
        <button
          onClick={() => setMainTab('dosen-pengampu')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            mainTab === 'dosen-pengampu'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Dosen Pengampu MK
        </button>
      </div>

      {mainTab === 'dosen-pengampu' ? (
        <LecturerCourseAssignmentsTab />
      ) : (
        <>
          {/* 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Dosen"
              value={stats.total}
              icon={<Users className="w-6 h-6" />}
              iconBgColor="bg-emerald-50 text-emerald-600"
              subtitle="terdaftar di sistem"
            />

            <StatCard
              title="Dosen Aktif Mengajar"
              value={stats.active}
              icon={<UserCheck className="w-6 h-6" />}
              iconBgColor="bg-blue-50 text-blue-600"
              subtitle="memiliki alokasi kelas"
            />

            <StatCard
              title="Beban Mengajar Tinggi"
              value={stats.highLoad}
              icon={<TrendingUp className="w-6 h-6" />}
              iconBgColor="bg-rose-50 text-rose-600"
              subtitle="≥ 12 SKS penugasan"
            />

            <StatCard
              title="Status Akun"
              value={lecturers.filter((l) => l.profile_id).length}
              icon={<Calendar className="w-6 h-6" />}
              iconBgColor="bg-purple-50 text-purple-600"
              subtitle="akun terhubung login"
            />
          </div>

          {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama dosen, kode, atau NIP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none font-medium"
            >
              <option value="Aktif">Status: Aktif</option>
              <option value="Nonaktif">Status: Nonaktif</option>
              <option value="all">Semua Status</option>
            </select>

            <select
              value={kbkFilter}
              onChange={(e) => {
                setKbkFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">Semua KBK</option>
              {kbks.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch('');
                setKbkFilter('all');
                setStatusFilter('Aktif');
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={loadData} />
          </div>
        )}

        {loading && <LoadingState type="table-skeleton" rows={8} message="Memuat data dosen..." />}

        {!loading && !error && lecturers.length === 0 && (
          <div className="p-8">
            <EmptyState
              title="Tidak ada dosen ditemukan"
              description="Periksa kata kunci pencarian atau filter yang dipilih."
            />
          </div>
        )}

        {!loading && !error && lecturers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                <tr>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Nama Dosen
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('code')}
                  >
                    <div className="flex items-center gap-1">
                      Kode
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">KBK</th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('offerings')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Jumlah Penawaran
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLecturers.map((lecturer) => (
                  <tr
                    key={lecturer.id}
                    onClick={() => handleOpenDetail(lecturer.id)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                          {lecturer.lecturer_code || getInitials(lecturer.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 group-hover:text-blue-600">
                            {lecturer.name}
                          </p>
                          <span className="text-2xs text-slate-400 font-mono">
                            NIP: {lecturer.nip || '—'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      {lecturer.lecturer_code || lecturer.code || '—'}
                    </td>

                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {lecturer.kbk?.name || 'Teknik Elektro'}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700">
                        {lecturer.offerings_count || 0} Kelas
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-semibold ${
                          lecturer.status === 'Nonaktif'
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            lecturer.status === 'Nonaktif' ? 'bg-slate-400' : 'bg-emerald-500'
                          }`}
                        />
                        {lecturer.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Detail */}
                        <button
                          onClick={() => handleOpenDetail(lecturer.id)}
                          title="Detail Profil Dosen"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={(e) => handleOpenEditModal(lecturer, e)}
                          title="Edit Data Dosen"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Nonaktifkan / Aktifkan Kembali (Section 7) */}
                        {lecturer.status === 'Nonaktif' ? (
                          <button
                            onClick={(e) => handleToggleStatus(lecturer, e)}
                            title="Aktifkan Kembali Dosen"
                            className="p-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 cursor-pointer font-semibold"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleToggleStatus(lecturer, e)}
                            title="Nonaktifkan Dosen"
                            className="p-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 cursor-pointer font-semibold"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Hapus Dosen (Protected) */}
                        <button
                          onClick={(e) => handleDeleteClick(lecturer, e)}
                          title="Hapus Dosen"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
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
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={lecturers.length}
          itemsPerPage={pageSize}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>
      </>
      )}

      {/* Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedLecturerId)}
        onClose={() => setSelectedLecturerId(null)}
        title="Detail Dosen"
        subtitle={drawerData?.lecturer.name}
      >
        {drawerLoading ? (
          <LoadingState type="spinner" message="Memuat profil dosen..." />
        ) : !drawerData ? null : (
          <div className="space-y-6 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                {drawerData.lecturer.lecturer_code || getInitials(drawerData.lecturer.name)}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {drawerData.lecturer.name}
                </h4>
                <p className="text-2xs text-slate-500 font-mono mt-0.5">
                  Kode: {drawerData.lecturer.lecturer_code || '—'} • NIP: {drawerData.lecturer.nip || '—'}
                </p>
                <p className="text-2xs text-slate-400 mt-0.5">
                  KBK: {drawerData.lecturer.kbk?.name || 'Teknik Elektro'}
                </p>
              </div>
            </div>

            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab('info')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 ${
                  activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                }`}
              >
                Informasi
              </button>
              <button
                onClick={() => setActiveTab('courses')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 ${
                  activeTab === 'courses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                }`}
              >
                Mata Kuliah Diampu ({drawerData.assignedOfferings.length})
              </button>
              <button
                onClick={() => setActiveTab('availability')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 ${
                  activeTab === 'availability' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                }`}
              >
                Ketersediaan ({drawerData.availability.length})
              </button>
            </div>

            {activeTab === 'info' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                  <BookOpen className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-2xs font-semibold text-slate-400 uppercase">Kelompok Keahlian (KBK)</p>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {drawerData.lecturer.kbk?.name || 'Sistem Kendali & Tenaga Listrik'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-2xs font-semibold text-slate-400 uppercase">Email Kontak</p>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {drawerData.lecturer.email || `${drawerData.lecturer.lecturer_code?.toLowerCase() || 'dosen'}@unram.ac.id`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'courses' && (
              <div className="space-y-2">
                {drawerData.assignedOfferings.length === 0 ? (
                  <p className="text-center text-slate-500 py-4">Belum ada penugasan kelas untuk dosen ini.</p>
                ) : (
                  drawerData.assignedOfferings.map((item: any, idx: number) => (
                    <div key={`${item.course_offering_id || item.course_offering?.id || idx}-${item.lecturer_id || idx}`} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">
                          {item.course_offering?.course?.name}
                        </p>
                        <p className="text-2xs text-slate-500">
                          Kelas {item.course_offering?.class_code} • Sem {item.course_offering?.course?.semester} •{' '}
                          {item.course_offering?.course?.effective_sks} SKS
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-2xs font-bold bg-blue-50 text-blue-700">
                        {item.assignment_role}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'availability' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
                    Daftar Preferensi Waktu ({drawerData.availability.length})
                  </span>
                  <button
                    onClick={() => navigate('/dosen/ketersediaan')}
                    className="text-2xs font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    Buka Pengelola Lengkap
                  </button>
                </div>

                {drawerData.availability.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <p className="text-slate-600 font-medium text-xs">Belum ada batasan waktu khusus.</p>
                    <p className="text-2xs text-slate-400 mt-1">
                      Dosen ini bersedia mengajar di semua slot perkuliahan reguler.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {drawerData.availability.map((a: any) => (
                      <div
                        key={a.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          !a.is_available
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : a.preference === 'preferred'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : a.preference === 'avoid'
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      >
                        <div>
                          <span className="font-bold">{a.day}</span>
                          <span className="font-mono text-2xs ml-2">
                            {a.start_time} - {a.end_time}
                          </span>
                          {a.notes && <p className="text-3xs text-slate-500 mt-0.5">"{a.notes}"</p>}
                        </div>
                        <span className="text-3xs font-bold uppercase px-1.5 py-0.5 rounded bg-white/80">
                          {!a.is_available ? 'Tidak Bisa' : a.preference === 'preferred' ? 'Diutamakan' : a.preference === 'avoid' ? 'Dihindari' : 'Bersedia'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingLecturer ? 'Edit Data Dosen' : 'Tambah Dosen Baru'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLecturer} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap & Gelar *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dr. Ir. I G. A. Wiryawan, M.T."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Duplicate Name Warning (Requirement: Contoh Dr.Ir. vs Dr. Ir. - tampilkan warning) */}
              {similarLecturers.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Peringatan Nama Mirip
                  </div>
                  <p className="text-2xs text-amber-700 leading-relaxed">
                    Ditemukan nama dosen yang sangat mirip dalam database untuk mencegah duplikasi:
                  </p>
                  <ul className="list-disc pl-4 text-2xs space-y-0.5 text-amber-800">
                    {similarLecturers.map((s) => (
                      <li key={s.id}>
                        {s.name} (Kode: {s.lecturer_code || '—'})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode Dosen (Inisial)
                  </label>
                  <input
                    type="text"
                    placeholder="IK"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NIP / NIDN</label>
                  <input
                    type="text"
                    placeholder="197603152001121001"
                    value={formNip}
                    onChange={(e) => setFormNip(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kelompok Bidang Keahlian (KBK)
                </label>
                <select
                  value={formKbkId}
                  onChange={(e) => setFormKbkId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Pilih KBK</option>
                  {kbks.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="dosen@unram.ac.id"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon</label>
                  <input
                    type="tel"
                    placeholder="08123456789"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Data Dosen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Dialog (Sections 6, 8, 9) */}
      <ConfirmDialog
        isOpen={deactivateDialogOpen}
        onClose={() => setDeactivateDialogOpen(false)}
        onConfirm={handleConfirmDeactivate}
        title="Nonaktifkan Dosen?"
        message={
          isDeactivateFromDelete
            ? 'Dosen tidak dapat dihapus karena sudah digunakan pada data akademik. Anda dapat menonaktifkan dosen ini.'
            : 'Dosen ini sudah memiliki data pengampu pada penawaran kelas. Menonaktifkan dosen tidak akan menghapus riwayat akademik yang sudah ada.'
        }
        confirmLabel="Nonaktifkan Dosen"
        cancelLabel="Batalkan"
        variant="warning"
        loading={updatingStatus}
      />

      {/* Delete Confirmation Dialog (Section 8: only for unused lecturers) */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Data Dosen"
        message={`Apakah Anda yakin ingin menghapus data dosen ${lecturerToDelete?.name}? Data dosen ini belum pernah digunakan pada kegiatan akademik.`}
        confirmLabel="Hapus Dosen"
        cancelLabel="Batal"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};

export const DataDosenPage = LecturersPage;
