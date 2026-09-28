import React, { useState, useEffect } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Check,
  X,
  UserPlus,
  Lock,
  Unlock,
  ShieldCheck,
  Building,
  RotateCcw,
  Sparkles,
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
import { courseOfferingsService, LecturerAssignmentInput } from '../../services/courseOfferings.service';
import { coursesService } from '../../services/courses.service';
import { lecturersService } from '../../services/lecturers.service';
import { roomsService } from '../../services/rooms.service';
import { academicTermsService } from '../../services/academicTerms.service';
import { classAssignmentsService } from '../../services/classAssignments.service';
import { useAcademicTerm } from '../../contexts/AcademicTermContext';
import { CourseOffering, Course, Lecturer, AcademicTerm, ClassAssignment } from '../../types';

export const CourseOfferingsPage: React.FC = () => {
  const toast = useToast();
  const { activeTerm: globalActiveTerm, terms: globalTerms } = useAcademicTerm();

  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [academicTerms, setAcademicTerms] = useState<AcademicTerm[]>(globalTerms || []);
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(globalActiveTerm);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    needsReview: 0,
    totalStudents: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
  const [termFilter, setTermFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Drawer / Detail
  const [selectedOffering, setSelectedOffering] = useState<CourseOffering | null>(null);
  const [drawerTab, setDrawerTab] = useState<'info' | 'lecturers' | 'students'>('info');
  const [classMembers, setClassMembers] = useState<ClassAssignment[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Modal Create/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOffering, setEditingOffering] = useState<CourseOffering | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form State
  const [formCourseId, setFormCourseId] = useState('');
  const [formTermId, setFormTermId] = useState('');
  const [formClassCode, setFormClassCode] = useState('A');
  const [formExpectedStudents, setFormExpectedStudents] = useState<number>(40);
  const [formRequiredRoomType, setFormRequiredRoomType] = useState('Ruang Kuliah Teori');
  const [formIncludeUts, setFormIncludeUts] = useState(true);
  const [formIncludeUas, setFormIncludeUas] = useState(true);
  const [formLecturers, setFormLecturers] = useState<LecturerAssignmentInput[]>([]);

  // Delete Dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [offeringToDelete, setOfferingToDelete] = useState<CourseOffering | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sList, lList, rTypes, terms, activeT] = await Promise.all([
        courseOfferingsService.getOfferings({
          search,
          semester: semesterFilter,
          confirmedStatus: statusFilter,
          termId: termFilter !== 'all' ? termFilter : undefined,
        }),
        coursesService.getCourses({ status: 'schedulable' }),
        lecturersService.getLecturers(),
        roomsService.getDistinctRoomTypes(),
        academicTermsService.getAcademicTerms(),
        academicTermsService.getActiveTerm(),
      ]);

      setOfferings(list);
      setCourses(sList);
      setLecturers(lList);
      setRoomTypes(rTypes);
      setAcademicTerms(terms);
      setActiveTerm(activeT);

      // Compute stats
      const total = list.length;
      const confirmed = list.filter((o) => o.assignment_confirmed).length;
      const needsReview = total - confirmed;
      const totalStud = list.reduce((acc, o) => acc + (o.expected_students || 0), 0);
      setStats({ total, confirmed, needsReview, totalStudents: totalStud });
    } catch (err: any) {
      setError(err.message || 'Gagal memuat penawaran kelas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [semesterFilter, statusFilter, termFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load details for Drawer
  const handleOpenDetail = async (offering: CourseOffering) => {
    setSelectedOffering(offering);
    setDrawerTab('info');
    setDrawerLoading(true);
    try {
      const members = await classAssignmentsService.getAssignmentsByOffering(offering.id);
      setClassMembers(members);
    } catch (err) {
      console.warn('Class members warning:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingOffering(null);
    setFormCourseId(courses[0]?.id || '');
    setFormTermId(activeTerm?.id || academicTerms[0]?.id || '');
    setFormClassCode('A');
    setFormExpectedStudents(40);
    setFormRequiredRoomType(roomTypes[0] || 'Ruang Kuliah Teori');
    setFormIncludeUts(true);
    setFormIncludeUas(true);
    const activeLecturers = lecturers.filter((l) => l.status !== 'Nonaktif');
    setFormLecturers(activeLecturers.length > 0 ? [{ lecturer_id: activeLecturers[0].id, assignment_role: 'KOORDINATOR' }] : []);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (offering: CourseOffering, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingOffering(offering);
    setFormCourseId(offering.course_id);
    setFormTermId(offering.academic_term_id || activeTerm?.id || '');
    setFormClassCode(offering.class_code);
    setFormExpectedStudents(offering.expected_students || 40);
    setFormRequiredRoomType(offering.required_room_type || roomTypes[0] || 'Ruang Kuliah Teori');
    setFormIncludeUts(offering.include_uts ?? true);
    setFormIncludeUas(offering.include_uas ?? true);
    setFormLecturers(
      (offering.lecturers || []).map((l) => ({
        lecturer_id: l.lecturer_id,
        assignment_role: l.assignment_role || 'PENGAMPU',
      }))
    );
    setModalOpen(true);
  };

  // Add/Remove lecturer row in form
  const handleAddLecturerToForm = () => {
    const activeLecturers = lecturers.filter((l) => l.status !== 'Nonaktif');
    if (activeLecturers.length === 0) {
      toast.error('Tidak ada dosen aktif yang tersedia.');
      return;
    }
    setFormLecturers([...formLecturers, { lecturer_id: activeLecturers[0].id, assignment_role: 'PENGAMPU' }]);
  };

  const handleRemoveLecturerFromForm = (idx: number) => {
    setFormLecturers(formLecturers.filter((_, i) => i !== idx));
  };

  const handleUpdateLecturerInForm = (idx: number, field: 'lecturer_id' | 'assignment_role', val: string) => {
    const updated = [...formLecturers];
    updated[idx] = { ...updated[idx], [field]: val };
    setFormLecturers(updated);
  };

  // Save Offering (Create or Update)
  const handleSaveOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      if (editingOffering) {
        await courseOfferingsService.updateOffering(
          editingOffering.id,
          {
            class_code: formClassCode,
            expected_students: formExpectedStudents,
            required_room_type: formRequiredRoomType,
            include_uts: formIncludeUts,
            include_uas: formIncludeUas,
          },
          formLecturers
        );
        toast.success('Perubahan berhasil disimpan.');
      } else {
        await courseOfferingsService.createOffering(
          {
            course_id: formCourseId,
            academic_term_id: formTermId,
            class_code: formClassCode,
            expected_students: formExpectedStudents,
            required_room_type: formRequiredRoomType,
            include_uts: formIncludeUts,
            include_uas: formIncludeUas,
          },
          formLecturers
        );
        toast.success('Data penawaran kelas berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan data.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Confirm Assignment
  const handleConfirmAssignment = async (offering: CourseOffering, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nextStatus = !offering.assignment_confirmed;
      await courseOfferingsService.confirmOfferingAssignment(offering.id, nextStatus);
      toast.success(
        nextStatus
          ? `Kelas ${offering.class_code} berhasil dikonfirmasi.`
          : `Status konfirmasi kelas ${offering.class_code} dibatalkan.`
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengonfirmasi assignment.');
    }
  };

  // Delete Action
  const handleDeleteClick = (offering: CourseOffering, e: React.MouseEvent) => {
    e.stopPropagation();
    setOfferingToDelete(offering);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!offeringToDelete) return;
    setDeleting(true);
    try {
      await courseOfferingsService.deleteOffering(offeringToDelete.id);
      toast.success('Penawaran kelas berhasil dihapus.');
      setDeleteConfirmOpen(false);
      setOfferingToDelete(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus penawaran kelas.');
    } finally {
      setDeleting(false);
    }
  };

  // Pagination Slice
  const paginatedOfferings = offerings.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Penawaran Kelas"
        subtitle="Manajemen alokasi kelas, dosen pengampu, kapasitas mahasiswa, dan konfirmasi penjadwalan"
        badge={
          activeTerm ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Periode: {activeTerm.semester_type} {activeTerm.academic_year}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Buka Kelas Baru
            </button>
          </div>
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Penawaran Kelas"
          value={stats.total}
          icon={<Layers className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle="kelas perkuliahan terdaftar"
        />

        <StatCard
          title="Terkonfirmasi"
          value={stats.confirmed}
          icon={<CheckCircle2 className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          subtitle={`${stats.total ? Math.round((stats.confirmed / stats.total) * 100) : 0}% assignment siap`}
        />

        <StatCard
          title="Perlu Peninjauan"
          value={stats.needsReview}
          icon={<AlertCircle className="w-6 h-6" />}
          iconBgColor="bg-amber-50 text-amber-600"
          subtitle="belum dikonfirmasi admin"
        />

        <StatCard
          title="Total Mahasiswa Terencana"
          value={stats.totalStudents}
          icon={<Users className="w-6 h-6" />}
          iconBgColor="bg-purple-50 text-purple-600"
          subtitle="estimasi kursi mahasiswa"
        />
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari mata kuliah, kelas, atau dosen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={semesterFilter}
              onChange={(e) => {
                setSemesterFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="unconfirmed">Needs Review</option>
            </select>

            <button
              onClick={() => {
                setSearch('');
                setSemesterFilter('all');
                setStatusFilter('all');
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

        {loading && <LoadingState type="table-skeleton" rows={8} message="Memuat daftar penawaran kelas..." />}

        {!loading && !error && offerings.length === 0 && (
          <div className="p-8">
            <EmptyState
              title="Belum ada penawaran kelas untuk periode ini"
              description="Tambahkan kelas baru atau import penawaran mata kuliah untuk memulai penyusunan jadwal."
              action={{
                label: 'Buka Kelas Baru',
                onClick: handleOpenCreateModal,
                icon: <Plus className="w-4 h-4" />,
              }}
            />
          </div>
        )}

        {!loading && !error && offerings.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                <tr>
                  <th className="py-3 px-4">Mata Kuliah</th>
                  <th className="py-3 px-3 text-center">Kelas</th>
                  <th className="py-3 px-3 text-center">Sem</th>
                  <th className="py-3 px-3 text-center">SKS</th>
                  <th className="py-3 px-4">Dosen Pengampu</th>
                  <th className="py-3 px-3 text-center">Mhs</th>
                  <th className="py-3 px-4">Tipe Ruang</th>
                  <th className="py-3 px-4 text-center">Status Assignment</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedOfferings.map((offering) => {
                  const leadLecturer = offering.lecturers?.[0]?.lecturer?.name || 'Belum ada dosen';
                  const extraLecturerCount = Math.max(0, (offering.lecturers?.length || 0) - 1);

                  return (
                    <tr
                      key={offering.id}
                      onClick={() => handleOpenDetail(offering)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800 group-hover:text-blue-600">
                          {offering.course?.name || 'Mata Kuliah'}
                        </p>
                        <span className="text-2xs text-slate-400 font-mono">
                          {offering.course?.code || '—'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                          {offering.class_code}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center text-slate-600 font-medium">
                        {offering.course?.semester || '—'}
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {offering.effective_sks || offering.course?.effective_sks || 3}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                            {leadLecturer}
                          </span>
                          {extraLecturerCount > 0 && (
                            <span className="text-3xs text-blue-600 font-bold mt-0.5">
                              +{extraLecturerCount} dosen lainnya
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {offering.expected_students}
                      </td>

                      <td className="py-3 px-4 text-slate-600 text-2xs truncate max-w-[140px]">
                        {offering.required_room_type || 'Ruang Kuliah Teori'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {offering.assignment_confirmed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Needs Review
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => handleConfirmAssignment(offering, e)}
                            title={offering.assignment_confirmed ? 'Batal Konfirmasi' : 'Konfirmasi Data Kelas'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              offering.assignment_confirmed
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleOpenEditModal(offering, e)}
                            title="Edit Penawaran Kelas"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(offering, e)}
                            title="Hapus Kelas"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={offerings.length}
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
        isOpen={Boolean(selectedOffering)}
        onClose={() => setSelectedOffering(null)}
        title={`Detail Penawaran Kelas — ${selectedOffering?.class_code || ''}`}
        subtitle={selectedOffering?.course?.name}
      >
        {drawerLoading ? (
          <LoadingState type="spinner" message="Memuat detail kelas..." />
        ) : !selectedOffering ? null : (
          <div className="space-y-6 text-xs">
            {/* Header info card */}
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {selectedOffering.course?.name}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-2xs font-bold ${
                      selectedOffering.assignment_confirmed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedOffering.assignment_confirmed ? 'Confirmed' : 'Needs Review'}
                  </span>
                </div>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Kode MK: {selectedOffering.course?.code || '—'} • Kelas {selectedOffering.class_code} •{' '}
                  {selectedOffering.effective_sks || 3} SKS
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setDrawerTab('info')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
                  drawerTab === 'info'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Informasi
              </button>
              <button
                onClick={() => setDrawerTab('lecturers')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
                  drawerTab === 'lecturers'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Dosen Pengampu ({selectedOffering.lecturers?.length || 0})
              </button>
              <button
                onClick={() => setDrawerTab('students')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
                  drawerTab === 'students'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Mahasiswa Kelas ({classMembers.length})
              </button>
            </div>

            {/* Tab: Info */}
            {drawerTab === 'info' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-2xs font-semibold text-slate-400 uppercase">Jumlah Mahasiswa Direncanakan</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5">
                    {selectedOffering.expected_students} mahasiswa
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-2xs font-semibold text-slate-400 uppercase">Kebutuhan Tipe Ruangan</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedOffering.required_room_type || 'Ruang Kuliah Teori'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-2xs font-semibold text-slate-400 uppercase">Jadwal UTS</p>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {selectedOffering.include_uts ? 'Diikutsertakan (Aktif)' : 'Tidak Ada UTS'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-2xs font-semibold text-slate-400 uppercase">Jadwal UAS</p>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {selectedOffering.include_uas ? 'Diikutsertakan (Aktif)' : 'Tidak Ada UAS'}
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={(e) => handleConfirmAssignment(selectedOffering, e)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all ${
                      selectedOffering.assignment_confirmed
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                    }`}
                  >
                    {selectedOffering.assignment_confirmed
                      ? 'Batalkan Konfirmasi Kelas'
                      : 'Konfirmasi Data Kelas (Siap Dijadwalkan)'}
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Lecturers */}
            {drawerTab === 'lecturers' && (
              <div className="space-y-3">
                {(!selectedOffering.lecturers || selectedOffering.lecturers.length === 0) ? (
                  <p className="text-center text-slate-500 py-4">Belum ada dosen yang ditugaskan ke kelas ini.</p>
                ) : (
                  selectedOffering.lecturers.map((item) => (
                    <div
                      key={`${item.course_offering_id || ''}-${item.lecturer_id}`}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{item.lecturer?.name || 'Dosen'}</p>
                        <p className="text-2xs text-slate-400 font-mono">
                          Kode: {item.lecturer?.lecturer_code || item.lecturer?.code || '—'} • NIP: {item.lecturer?.nip || '—'}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded font-semibold text-2xs bg-blue-50 text-blue-700 border border-blue-200">
                        {item.assignment_role}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Students (Anggota Kelas - strictly NO KRS!) */}
            {drawerTab === 'students' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Daftar Mahasiswa Kelas ({classMembers.length} mhs)
                  </span>
                </div>

                {classMembers.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500">
                    <p>Belum ada mahasiswa yang ditempatkan secara individual.</p>
                    <p className="text-3xs text-slate-400 mt-1">
                      Perhitungan penjadwalan menggunakan kuota <span className="font-semibold">{selectedOffering.expected_students} mahasiswa</span>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {classMembers.map((member) => (
                      <div
                        key={member.id}
                        className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{member.student?.full_name}</p>
                          <p className="text-2xs text-blue-600 font-mono font-medium">NIM: {member.student?.nim}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {member.locked ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-semibold bg-slate-100 text-slate-600">
                              <Unlock className="w-3 h-3" /> Unlocked
                            </span>
                          )}
                        </div>
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
          <div className="relative bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingOffering ? 'Edit Penawaran Kelas' : 'Buka Kelas Baru'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOffering} className="space-y-4 text-xs">
              {/* Mata Kuliah */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mata Kuliah</label>
                {editingOffering ? (
                  <input
                    type="text"
                    disabled
                    value={`${editingOffering.course?.name} (${editingOffering.course?.code || '—'})`}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-semibold"
                  />
                ) : (
                  <select
                    value={formCourseId}
                    onChange={(e) => setFormCourseId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : ''} — {c.effective_sks} SKS, Sem {c.semester}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Periode Akademik */}
              {!editingOffering && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Periode Akademik</label>
                  <select
                    value={formTermId}
                    onChange={(e) => setFormTermId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    {academicTerms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.semester_type} {t.academic_year} {t.is_active ? '(Aktif)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Class Code & Expected Students */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode Kelas (Contoh: A, B, INTER, REG)
                  </label>
                  <input
                    type="text"
                    required
                    value={formClassCode}
                    onChange={(e) => setFormClassCode(e.target.value.toUpperCase())}
                    placeholder="A"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah Mahasiswa Terencana
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formExpectedStudents}
                    onChange={(e) => setFormExpectedStudents(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Required Room Type */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kebutuhan Tipe Ruangan
                </label>
                <select
                  value={formRequiredRoomType}
                  onChange={(e) => setFormRequiredRoomType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                >
                  {roomTypes.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Teaching / Dosen Pengampu */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    Dosen Pengampu (Mendukung Team Teaching)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLecturerToForm}
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 px-2 py-1 rounded-md"
                  >
                    <Plus className="w-3 h-3" /> Tambah Dosen
                  </button>
                </div>

                {formLecturers.length === 0 ? (
                  <p className="text-3xs text-slate-400 italic">Belum ada dosen yang dipilih.</p>
                ) : (
                  <div className="space-y-2">
                    {formLecturers.map((fl, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={fl.lecturer_id}
                          onChange={(e) => handleUpdateLecturerInForm(idx, 'lecturer_id', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-2xs border border-slate-300 rounded-lg bg-white"
                        >
                          {lecturers
                            .filter((l) => l.status !== 'Nonaktif' || l.id === fl.lecturer_id)
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name} {l.lecturer_code ? `(${l.lecturer_code})` : ''} {l.status === 'Nonaktif' ? '[Nonaktif]' : ''}
                              </option>
                            ))}
                        </select>

                        <select
                          value={fl.assignment_role}
                          onChange={(e) => handleUpdateLecturerInForm(idx, 'assignment_role', e.target.value)}
                          className="w-32 px-2 py-1.5 text-2xs border border-slate-300 rounded-lg bg-white font-semibold"
                        >
                          <option value="KOORDINATOR">KOORDINATOR</option>
                          <option value="PENGAMPU">PENGAMPU</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveLecturerFromForm(idx)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          title="Hapus dosen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Include UTS / UAS Toggles */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIncludeUts}
                    onChange={(e) => setFormIncludeUts(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-700">Ikutkan Jadwal UTS</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIncludeUas}
                    onChange={(e) => setFormIncludeUas(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-700">Ikutkan Jadwal UAS</span>
                </label>
              </div>

              {/* Submit Buttons */}
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
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Penawaran Kelas"
        message={`Apakah Anda yakin ingin menghapus kelas ${offeringToDelete?.class_code} untuk mata kuliah ${offeringToDelete?.course?.name}? Penempatan dosen dan anggota kelas terkait juga akan dihapus.`}
        confirmLabel="Hapus Kelas"
        loading={deleting}
      />
    </div>
  );
};

export const PenawaranKelasPage = CourseOfferingsPage;
