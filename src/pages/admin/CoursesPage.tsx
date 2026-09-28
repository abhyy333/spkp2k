import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  GraduationCap,
  Layers,
  Users,
  Search,
  Plus,
  RotateCcw,
  Edit,
  Trash2,
  X,
  AlertCircle,
  ArrowUpDown,
  Filter,
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
import { coursesService } from '../../services/courses.service';
import { Course, CourseOffering, KBK, Curriculum, CourseType } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

export const CoursesPage: React.FC = () => {
  const toast = useToast();
  const { isOwnerAdmin } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [kbks, setKbks] = useState<KBK[]>([]);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    schedulable: 0,
    wajib: 0,
    pilihan: 0,
    totalClasses: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [courseTypeFilter, setCourseTypeFilter] = useState('all');
  const [kbkFilter, setKbkFilter] = useState('all');
  const [curriculumFilter, setCurriculumFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Sorting
  const [sortField, setSortField] = useState<'name' | 'code' | 'semester' | 'sks'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Detail Drawer
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<{
    course: Course;
    offerings: CourseOffering[];
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'info' | 'classes' | 'lecturers'>('info');

  // Modal Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form states
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formSks, setFormSks] = useState<number>(3);
  const [formSemester, setFormSemester] = useState<number>(1);
  const [formCourseType, setFormCourseType] = useState<CourseType>('WAJIB');
  const [formActivityType, setFormActivityType] = useState<string>('KULIAH');
  const [formKbkId, setFormKbkId] = useState('');
  const [formCurriculumId, setFormCurriculumId] = useState('');
  const [formIsSchedulable, setFormIsSchedulable] = useState(true);
  const [formDescription, setFormDescription] = useState('');

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s, kbkList, currList] = await Promise.all([
        coursesService.getCourses({
          search,
          semester: semesterFilter,
          courseType: courseTypeFilter,
          kbkId: kbkFilter,
          curriculumId: curriculumFilter,
          status: statusFilter,
        }),
        coursesService.getStats(),
        coursesService.getKBKs(),
        coursesService.getCurriculums(),
      ]);

      setCourses(list);
      setStats(s);
      setKbks(kbkList);
      setCurriculums(currList);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data mata kuliah.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [semesterFilter, courseTypeFilter, kbkFilter, curriculumFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Open Detail Drawer
  const handleOpenDetail = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setDrawerLoading(true);
    setActiveDrawerTab('info');
    try {
      const data = await coursesService.getCourseById(courseId);
      setDrawerData(data);
    } catch (err) {
      console.error('Error fetching course detail:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingCourse(null);
    setFormCode('');
    setFormName('');
    setFormSks(3);
    setFormSemester(1);
    setFormCourseType('WAJIB');
    setFormActivityType('KULIAH');
    setFormKbkId(kbks[0]?.id || '');
    setFormCurriculumId(curriculums[0]?.id || '');
    setFormIsSchedulable(true);
    setFormDescription('');
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (c: Course, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCourse(c);
    setFormCode(c.code || '');
    setFormName(c.name);
    setFormSks(c.effective_sks || c.sks || 3);
    setFormSemester(c.semester || 1);
    setFormCourseType((c.course_type as CourseType) || 'WAJIB');
    setFormActivityType(c.activity_type || 'KULIAH');
    setFormKbkId(c.kbk_id || '');
    setFormCurriculumId(c.curriculum_id || '');
    setFormIsSchedulable(c.is_schedulable);
    setFormDescription(c.description || '');
    setModalOpen(true);
  };

  // Save Course
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      if (editingCourse) {
        await coursesService.updateCourse(editingCourse.id, {
          code: formCode,
          name: formName,
          effective_sks: formSks,
          semester: formSemester,
          course_type: formCourseType,
          activity_type: formActivityType,
          kbk_id: formKbkId || null,
          curriculum_id: formCurriculumId || null,
          is_schedulable: formActivityType === 'KKN' ? false : formIsSchedulable,
          description: formDescription,
        });
        toast.success('Perubahan mata kuliah berhasil disimpan.');
      } else {
        await coursesService.createCourse({
          code: formCode,
          name: formName,
          effective_sks: formSks,
          semester: formSemester,
          course_type: formCourseType,
          activity_type: formActivityType,
          kbk_id: formKbkId || null,
          curriculum_id: formCurriculumId || null,
          is_schedulable: formActivityType === 'KKN' ? false : formIsSchedulable,
          description: formDescription,
        });
        toast.success('Mata kuliah baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan mata kuliah.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Action
  const handleDeleteClick = (c: Course, e: React.MouseEvent) => {
    e.stopPropagation();
    setCourseToDelete(c);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;
    setDeleting(true);
    try {
      await coursesService.deleteCourse(courseToDelete.id);
      toast.success('Data mata kuliah berhasil dihapus.');
      setDeleteDialogOpen(false);
      setCourseToDelete(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus mata kuliah.');
    } finally {
      setDeleting(false);
    }
  };

  // Sorting
  const sortedCourses = [...courses].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortField === 'code') cmp = (a.code || '').localeCompare(b.code || '');
    else if (sortField === 'semester') cmp = a.semester - b.semester;
    else if (sortField === 'sks') cmp = a.effective_sks - b.effective_sks;
    return sortAsc ? cmp : -cmp;
  });

  const handleSort = (field: 'name' | 'code' | 'semester' | 'sks') => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const paginatedCourses = sortedCourses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Data Mata Kuliah"
        subtitle="Kelola kurikulum, beban SKS, jenis, dan status penjadwalan mata kuliah Teknik Elektro"
        actions={
          isOwnerAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tambah Mata Kuliah
              </button>
            </div>
          ) : undefined
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Mata Kuliah"
          value={stats.total}
          icon={<BookOpen className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle="seluruh mata kuliah terdaftar"
        />

        <StatCard
          title="Mata Kuliah Wajib"
          value={stats.wajib}
          icon={<GraduationCap className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          subtitle={`${stats.total ? Math.round((stats.wajib / stats.total) * 100) : 0}% mata kuliah wajib`}
        />

        <StatCard
          title="Mata Kuliah Pilihan"
          value={stats.pilihan}
          icon={<Layers className="w-6 h-6" />}
          iconBgColor="bg-purple-50 text-purple-600"
          subtitle={`${stats.total ? Math.round((stats.pilihan / stats.total) * 100) : 0}% mata kuliah pilihan`}
        />

        <StatCard
          title="Kelas Aktif"
          value={stats.totalClasses}
          icon={<Users className="w-6 h-6" />}
          iconBgColor="bg-amber-50 text-amber-600"
          subtitle="penawaran kelas semester ini"
        />
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari kode atau nama mata kuliah..."
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
              value={courseTypeFilter}
              onChange={(e) => {
                setCourseTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Jenis</option>
              <option value="WAJIB">Wajib</option>
              <option value="PILIHAN">Pilihan</option>
              <option value="LAINNYA">Lainnya</option>
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
                setSemesterFilter('all');
                setCourseTypeFilter('all');
                setKbkFilter('all');
                setCurriculumFilter('all');
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

        {loading && <LoadingState type="table-skeleton" rows={8} message="Memuat data mata kuliah..." />}

        {!loading && !error && courses.length === 0 && (
          <div className="p-8">
            <EmptyState
              title="Tidak ada mata kuliah ditemukan"
              description="Tidak ada data yang sesuai dengan kata kunci pencarian atau filter yang dipilih."
            />
          </div>
        )}

        {!loading && !error && courses.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                <tr>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('code')}
                  >
                    <div className="flex items-center gap-1">
                      Kode
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Nama Mata Kuliah
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('sks')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      SKS
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('semester')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Semester
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Jenis</th>
                  <th className="py-3 px-4">KBK</th>
                  <th className="py-3 px-4">Kurikulum</th>
                  <th className="py-3 px-4">Status</th>
                  {isOwnerAdmin && <th className="py-3 px-4 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCourses.map((c) => {
                  const typeBadge =
                    c.course_type === 'WAJIB'
                      ? 'wajib'
                      : c.course_type === 'PILIHAN'
                      ? 'pilihan'
                      : 'default';

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenDetail(c.id)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {c.code || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 group-hover:text-blue-600">
                        {c.name}
                        {c.activity_type === 'KKN' && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-3xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Non-Kuliah LPPM
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {c.effective_sks || c.sks || 3}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600 font-medium">
                        {c.semester}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-2xs font-semibold ${
                            typeBadge === 'wajib'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : typeBadge === 'pilihan'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {c.course_type || 'WAJIB'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 truncate max-w-[150px]">
                        {c.kbk?.name || 'Umum'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-2xs">
                        {c.curriculum?.name || 'Kurikulum 2022'}
                      </td>
                      <td className="py-3 px-4">
                        {c.is_schedulable && c.activity_type !== 'KKN' ? (
                          <StatusBadge label="Dijadwalkan" variant="aktif" showDot />
                        ) : (
                          <StatusBadge
                            label={c.activity_type === 'KKN' ? 'KKN LPPM' : 'Tidak Dijadwalkan'}
                            variant="nonaktif"
                          />
                        )}
                      </td>
                      {isOwnerAdmin && (
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => handleOpenEditModal(c, e)}
                              title="Edit Mata Kuliah"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50 cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(c, e)}
                              title="Hapus Mata Kuliah"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={courses.length}
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
        isOpen={Boolean(selectedCourseId)}
        onClose={() => setSelectedCourseId(null)}
        title="Detail Mata Kuliah"
        subtitle={drawerData?.course.name}
      >
        {drawerLoading ? (
          <LoadingState type="spinner" message="Memuat detail mata kuliah..." />
        ) : !drawerData ? null : (
          <div className="space-y-6 text-xs">
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {drawerData.course.name}
                  </h4>
                  <StatusBadge
                    label={drawerData.course.is_schedulable ? 'Dijadwalkan' : 'Nonaktif'}
                    variant={drawerData.course.is_schedulable ? 'aktif' : 'nonaktif'}
                  />
                </div>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Kode: {drawerData.course.code || '—'} • {drawerData.course.effective_sks} SKS • Semester {drawerData.course.semester}
                </p>
              </div>
            </div>

            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveDrawerTab('info')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 ${
                  activeDrawerTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                }`}
              >
                Informasi
              </button>
              <button
                onClick={() => setActiveDrawerTab('classes')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 ${
                  activeDrawerTab === 'classes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                }`}
              >
                Kelas ({drawerData.offerings.length})
              </button>
            </div>

            {activeDrawerTab === 'info' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-2xs font-semibold text-slate-400 uppercase">Jenis Mata Kuliah</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{drawerData.course.course_type || 'WAJIB'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-2xs font-semibold text-slate-400 uppercase">Bidang Keahlian (KBK)</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{drawerData.course.kbk?.name || 'Umum Teknik Elektro'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-2xs font-semibold text-slate-400 uppercase">Kurikulum</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{drawerData.course.curriculum?.name || 'Kurikulum 2022'}</p>
                </div>
                {drawerData.course.description && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-2xs font-semibold text-slate-400 uppercase">Deskripsi</p>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">{drawerData.course.description}</p>
                  </div>
                )}
              </div>
            )}

            {activeDrawerTab === 'classes' && (
              <div className="space-y-2">
                {drawerData.offerings.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Belum ada penawaran kelas untuk mata kuliah ini.</p>
                ) : (
                  drawerData.offerings.map((o) => (
                    <div key={o.id} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">Kelas {o.class_code || o.class_name}</span>
                        <p className="text-2xs text-slate-400 mt-0.5">
                          {o.expected_students} mahasiswa • {o.required_room_type || 'Ruang Kuliah Teori'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-3xs font-bold ${o.assignment_confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {o.assignment_confirmed ? 'Confirmed' : 'Needs Review'}
                      </span>
                    </div>
                  ))
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
                {editingCourse ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah Baru'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Mata Kuliah *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pemrosesan Sinyal Digital"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode MK (Opsional)</label>
                  <input
                    type="text"
                    placeholder="TE207"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bobot SKS (1–12) *</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    value={formSks}
                    onChange={(e) => setFormSks(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Semester (1–14) *</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    required
                    value={formSemester}
                    onChange={(e) => setFormSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Mata Kuliah</label>
                  <select
                    value={formCourseType}
                    onChange={(e) => setFormCourseType(e.target.value as CourseType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="WAJIB">WAJIB</option>
                    <option value="PILIHAN">PILIHAN</option>
                    <option value="LAINNYA">LAINNYA</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipe Aktivitas</label>
                  <select
                    value={formActivityType}
                    onChange={(e) => setFormActivityType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="KULIAH">Kuliah Teori</option>
                    <option value="PRAKTIKUM">Praktikum Lab</option>
                    <option value="KKN">KKN (Non-Jadwal Mingguan)</option>
                  </select>
                </div>
              </div>

              {formActivityType === 'KKN' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-2xs">
                  <span className="font-bold">Ketentuan KKN:</span> Mata kuliah KKN secara otomatis dikelola LPPM dan tidak diikutsertakan dalam jadwal perkuliahan mingguan.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bidang Keahlian (KBK)</label>
                  <select
                    value={formKbkId}
                    onChange={(e) => setFormKbkId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Umum (Tanpa KBK Khusus)</option>
                    {kbks.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kurikulum</label>
                  <select
                    value={formCurriculumId}
                    onChange={(e) => setFormCurriculumId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {curriculums.map((curr) => (
                      <option key={curr.id} value={curr.id}>
                        {curr.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formActivityType !== 'KKN' && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsSchedulable}
                      onChange={(e) => setFormIsSchedulable(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-700">
                      Mata Kuliah Siap Dijadwalkan (is_schedulable = true)
                    </span>
                  </label>
                </div>
              )}

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
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Mata Kuliah'}
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
        title="Hapus Mata Kuliah"
        message={`Apakah Anda yakin ingin menghapus ${courseToDelete?.name}? Jika mata kuliah masih terhubung dengan penawaran kelas atau kurikulum, sistem akan memblokir penghapusan.`}
        loading={deleting}
      />
    </div>
  );
};

export const DataMataKuliahPage = CoursesPage;
