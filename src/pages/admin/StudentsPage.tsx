import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Users,
  Layers,
  FileCheck,
  Search,
  Plus,
  RotateCcw,
  Edit,
  Trash2,
  X,
  ArrowUpDown,
  Lock,
  Unlock,
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
import { studentsService } from '../../services/students.service';
import { coursesService } from '../../services/courses.service';
import { Student, KBK } from '../../types';

export const StudentsPage: React.FC = () => {
  const toast = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [kbks, setKbks] = useState<KBK[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    activeBatches: 0,
    activeStudents: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [kbkFilter, setKbkFilter] = useState('all');

  // Sorting
  const [sortField, setSortField] = useState<'nim' | 'name' | 'cohort'>('nim');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Drawer
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<{
    student: Student;
    classAssignments: any[];
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Modal Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form Fields
  const [formNim, setFormNim] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formCohort, setFormCohort] = useState<number>(2024);
  const [formKbkId, setFormKbkId] = useState('');

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s, kbkList] = await Promise.all([
        studentsService.getStudents({
          search,
          batchYear: batchFilter,
          kbkId: kbkFilter,
        }),
        studentsService.getStats(),
        coursesService.getKBKs(),
      ]);

      setStudents(list);
      setStats(s);
      setKbks(kbkList);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data mahasiswa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [batchFilter, kbkFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Open Drawer Detail
  const handleOpenDetail = async (id: string) => {
    setSelectedStudentId(id);
    setDrawerLoading(true);
    try {
      const data = await studentsService.getStudentById(id);
      setDrawerData(data);
    } catch (err) {
      console.error('Error fetching student detail:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingStudent(null);
    setFormNim('');
    setFormFullName('');
    setFormCohort(2024);
    setFormKbkId('');
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (st: Student, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingStudent(st);
    setFormNim(st.nim);
    setFormFullName(st.full_name || st.name || '');
    setFormCohort(st.cohort || st.batch_year || 2024);
    setFormKbkId(st.kbk_id || '');
    setModalOpen(true);
  };

  // Save Student
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      if (editingStudent) {
        await studentsService.updateStudent(editingStudent.id, {
          nim: formNim,
          full_name: formFullName,
          cohort: formCohort,
          kbk_id: formKbkId || null,
        });
        toast.success('Data mahasiswa berhasil diperbarui.');
      } else {
        await studentsService.createStudent({
          nim: formNim,
          full_name: formFullName,
          cohort: formCohort,
          kbk_id: formKbkId || null,
        });
        toast.success('Mahasiswa baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan mahasiswa.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Action
  const handleDeleteClick = (st: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setStudentToDelete(st);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setDeleting(true);
    try {
      await studentsService.deleteStudent(studentToDelete.id);
      toast.success('Data mahasiswa berhasil dihapus.');
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus mahasiswa.');
    } finally {
      setDeleting(false);
    }
  };

  // Sorting
  const sortedStudents = [...students].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'nim') cmp = a.nim.localeCompare(b.nim);
    else if (sortField === 'name') cmp = (a.full_name || '').localeCompare(b.full_name || '');
    else if (sortField === 'cohort') cmp = (a.cohort || 0) - (b.cohort || 0);
    return sortAsc ? cmp : -cmp;
  });

  const handleSort = (field: 'nim' | 'name' | 'cohort') => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const paginatedStudents = sortedStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Data Mahasiswa"
        subtitle="Kelola master data mahasiswa dan alokasi anggota kelas tetap perkuliahan"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Mahasiswa
            </button>
          </div>
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Mahasiswa"
          value={stats.total}
          icon={<GraduationCap className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle="terdaftar di sistem"
        />

        <StatCard
          title="Angkatan Aktif"
          value={stats.activeBatches}
          icon={<Layers className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          subtitle="rentang angkatan kuliah"
        />

        <StatCard
          title="Akun Terhubung"
          value={students.filter((s) => s.profile_id).length}
          icon={<Users className="w-6 h-6" />}
          iconBgColor="bg-purple-50 text-purple-600"
          subtitle="profil user aktif"
        />

        <StatCard
          title="Metode Penjadwalan"
          value="Class Assignments"
          icon={<FileCheck className="w-6 h-6" />}
          iconBgColor="bg-amber-50 text-amber-600"
          subtitle="alokasi kelas tetap (Non-KRS)"
        />
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari NIM atau nama mahasiswa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={batchFilter}
              onChange={(e) => {
                setBatchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Angkatan</option>
              {[2024, 2023, 2022, 2021, 2020].map((y) => (
                <option key={y} value={y}>
                  Angkatan {y}
                </option>
              ))}
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
                setBatchFilter('all');
                setKbkFilter('all');
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg"
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

        {loading && <LoadingState type="table-skeleton" rows={8} message="Memuat data mahasiswa..." />}

        {!loading && !error && students.length === 0 && (
          <div className="p-8">
            <EmptyState
              title="Belum ada data mahasiswa"
              description="Tambahkan data mahasiswa baru untuk pengelolaan anggota kelas."
            />
          </div>
        )}

        {!loading && !error && students.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                <tr>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('nim')}
                  >
                    <div className="flex items-center gap-1">
                      NIM
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Nama Mahasiswa
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('cohort')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Angkatan
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">KBK</th>
                  <th className="py-3 px-4 text-center">Status Akun</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => handleOpenDetail(student.id)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      {student.nim}
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-800 group-hover:text-blue-600">
                      {student.full_name || student.name}
                    </td>

                    <td className="py-3 px-3 text-center text-slate-600 font-medium">
                      {student.cohort || student.batch_year || '—'}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {student.kbk?.name || <span className="text-slate-400 italic">Belum ditentukan</span>}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold ${
                          student.profile_id
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {student.profile_id ? 'Aktif' : 'Terdaftar'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => handleOpenEditModal(student, e)}
                          title="Edit Mahasiswa"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(student, e)}
                          title="Hapus Mahasiswa"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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
          totalItems={students.length}
          itemsPerPage={pageSize}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedStudentId)}
        onClose={() => setSelectedStudentId(null)}
        title="Detail Mahasiswa"
        subtitle={drawerData?.student.full_name || undefined}
      >
        {drawerLoading ? (
          <LoadingState type="spinner" message="Memuat detail mahasiswa..." />
        ) : !drawerData ? null : (
          <div className="space-y-6 text-xs">
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center shrink-0">
                {(drawerData.student.full_name || 'M').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {drawerData.student.full_name}
                </h4>
                <p className="text-2xs font-mono text-blue-600 font-semibold mt-0.5">
                  NIM: {drawerData.student.nim}
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Angkatan {drawerData.student.cohort} • KBK: {drawerData.student.kbk?.name || 'Umum'}
                </p>
              </div>
            </div>

            {/* Class Memberships (strictly NO KRS!) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">
                  Penempatan Anggota Kelas ({drawerData.classAssignments.length})
                </span>
              </div>

              {drawerData.classAssignments.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500">
                  <p>Mahasiswa belum ditempatkan ke kelas tertentu.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {drawerData.classAssignments.map((a: any) => (
                    <div
                      key={a.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800">
                          {a.course_offering?.course?.name}
                        </p>
                        <p className="text-2xs text-slate-400">
                          {a.course_offering?.course?.code || '—'} • Kelas {a.course_offering?.class_name}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-2xs font-bold bg-blue-50 text-blue-700">
                        Kelas {a.course_offering?.class_name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingStudent ? 'Edit Data Mahasiswa' : 'Tambah Mahasiswa Baru'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor Induk Mahasiswa (NIM) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: F1B021001"
                  value={formNim}
                  onChange={(e) => setFormNim(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ahmad Rizki Pratama"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tahun Angkatan *
                  </label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    required
                    value={formCohort}
                    onChange={(e) => setFormCohort(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kelompok Bidang (KBK)
                  </label>
                  <select
                    value={formKbkId}
                    onChange={(e) => setFormKbkId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Belum Ditentukan (Semester Awal)</option>
                    {kbks.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
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
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Mahasiswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Data Mahasiswa"
        message={`Apakah Anda yakin ingin menghapus data mahasiswa ${studentToDelete?.full_name} (${studentToDelete?.nim})?`}
        loading={deleting}
      />
    </div>
  );
};

export const DataMahasiswaPage = StudentsPage;
