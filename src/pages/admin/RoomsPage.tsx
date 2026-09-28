import React, { useState, useEffect } from 'react';
import {
  DoorClosed,
  CheckCircle2,
  Users,
  Calendar,
  Search,
  Plus,
  RotateCcw,
  Edit,
  Trash2,
  X,
  Power,
  ArrowUpDown,
  Building2,
  Tv,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { roomsService } from '../../services/rooms.service';
import { Room } from '../../types';

export const RoomsPage: React.FC = () => {
  const toast = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    totalCapacity: 0,
    activeRooms: 0,
    highCapacity: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Sorting
  const [sortField, setSortField] = useState<'code' | 'name' | 'capacity'>('code');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCapacity, setFormCapacity] = useState<number>(40);
  const [formRoomType, setFormRoomType] = useState('Ruang Kuliah Teori');
  const [formFacilities, setFormFacilities] = useState('LCD Proyektor, AC, Whiteboard');
  const [formBuilding, setFormBuilding] = useState('Gedung E');
  const [formIsActive, setFormIsActive] = useState(true);

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([
        roomsService.getRooms({
          search,
          type: typeFilter,
          status: statusFilter,
        }),
        roomsService.getStats(),
      ]);

      setRooms(list);
      setStats(s);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data ruangan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingRoom(null);
    setFormCode('');
    setFormName('');
    setFormCapacity(40);
    setFormRoomType('Ruang Kuliah Teori');
    setFormFacilities('LCD Proyektor, AC, Whiteboard');
    setFormBuilding('Gedung E');
    setFormIsActive(true);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (r: Room) => {
    setEditingRoom(r);
    setFormCode(r.code);
    setFormName(r.name);
    setFormCapacity(r.capacity);
    setFormRoomType(r.room_type || 'Ruang Kuliah Teori');
    setFormFacilities(Array.isArray(r.facilities) ? r.facilities.join(', ') : r.facilities || '');
    setFormBuilding(r.building || 'Gedung E');
    setFormIsActive(r.is_active);
    setModalOpen(true);
  };

  // Save Room
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      if (editingRoom) {
        await roomsService.updateRoom(editingRoom.id, {
          code: formCode,
          name: formName,
          capacity: formCapacity,
          room_type: formRoomType,
          facilities: formFacilities,
          building: formBuilding,
          is_active: formIsActive,
        });
        toast.success('Data ruangan berhasil diperbarui.');
      } else {
        await roomsService.createRoom({
          code: formCode,
          name: formName,
          capacity: formCapacity,
          room_type: formRoomType,
          facilities: formFacilities,
          building: formBuilding,
          is_active: formIsActive,
        });
        toast.success('Ruangan baru berhasil ditambahkan.');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan ruangan.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Active
  const handleToggleActive = async (r: Room) => {
    try {
      await roomsService.toggleRoomActive(r.id, !r.is_active);
      toast.success(
        !r.is_active
          ? `Ruangan ${r.code} berhasil diaktifkan.`
          : `Ruangan ${r.code} berhasil dinonaktifkan.`
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status ruangan.');
    }
  };

  // Delete Action
  const handleDeleteClick = (r: Room) => {
    setRoomToDelete(r);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;
    setDeleting(true);
    try {
      await roomsService.deleteRoom(roomToDelete.id);
      toast.success('Ruangan berhasil dihapus.');
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus ruangan.');
    } finally {
      setDeleting(false);
    }
  };

  // Sorting
  const sortedRooms = [...rooms].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'code') cmp = a.code.localeCompare(b.code);
    else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortField === 'capacity') cmp = a.capacity - b.capacity;
    return sortAsc ? cmp : -cmp;
  });

  const handleSort = (field: 'code' | 'name' | 'capacity') => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const paginatedRooms = sortedRooms.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Data Ruangan"
        subtitle="Kelola kapasitas fisik, tipe ruangan, fasilitas, dan status ketersediaan ruang kuliah"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Ruangan
            </button>
          </div>
        }
      />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Ruangan"
          value={stats.total}
          icon={<DoorClosed className="w-6 h-6" />}
          iconBgColor="bg-blue-50 text-blue-600"
          subtitle="ruangan fisik terdaftar"
        />

        <StatCard
          title="Ruangan Aktif"
          value={stats.activeRooms}
          icon={<CheckCircle2 className="w-6 h-6" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          subtitle={`${stats.total ? Math.round((stats.activeRooms / stats.total) * 100) : 0}% dapat dialokasikan`}
        />

        <StatCard
          title="Kapasitas Tinggi"
          value={stats.highCapacity}
          icon={<Users className="w-6 h-6" />}
          iconBgColor="bg-purple-50 text-purple-600"
          subtitle="ruangan ≥ 40 kursi"
        />

        <StatCard
          title="Total Kapasitas Kursi"
          value={stats.totalCapacity}
          icon={<Calendar className="w-6 h-6" />}
          iconBgColor="bg-amber-50 text-amber-600"
          subtitle="kursi serentak seluruh ruang"
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
              placeholder="Cari kode, nama, atau gedung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>

            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
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

        {loading && <LoadingState type="table-skeleton" rows={8} message="Memuat data ruangan..." />}

        {!loading && !error && rooms.length === 0 && (
          <div className="p-8">
            <EmptyState
              title="Tidak ada data ruangan ditemukan"
              description="Periksa kata kunci pencarian atau filter yang dipilih."
            />
          </div>
        )}

        {!loading && !error && rooms.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
                <tr>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('code')}
                  >
                    <div className="flex items-center gap-1">
                      Kode Ruang
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Nama Ruang
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Tipe Ruangan</th>
                  <th
                    className="py-3 px-3 text-center cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSort('capacity')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Kapasitas
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Fasilitas</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRooms.map((r) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {r.code}
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {r.name}
                      <span className="block text-3xs text-slate-400 font-normal">
                        {r.building || 'Gedung E'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {r.room_type || 'Ruang Kuliah Teori'}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-800">
                        {r.capacity} kursi
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 text-2xs truncate max-w-[200px]">
                      {Array.isArray(r.facilities) ? r.facilities.join(', ') : r.facilities || 'LCD, AC'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <StatusBadge
                        label={r.is_active ? 'Aktif' : 'Nonaktif'}
                        variant={r.is_active ? 'aktif' : 'nonaktif'}
                        showDot
                      />
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleToggleActive(r)}
                          title={r.is_active ? 'Nonaktifkan Ruangan' : 'Aktifkan Ruangan'}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            r.is_active
                              ? 'bg-slate-50 text-slate-600 border-slate-200 hover:text-amber-600 hover:bg-amber-50'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(r)}
                          title="Edit Ruangan"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(r)}
                          title="Hapus Ruangan"
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
          totalItems={rooms.length}
          itemsPerPage={pageSize}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingRoom ? 'Edit Data Ruangan' : 'Tambah Ruangan Baru'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode Ruang *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: E101"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kapasitas (Kursi) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Ruangan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ruang Kuliah E101"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tipe Ruangan
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ruang Kuliah Teori"
                    value={formRoomType}
                    onChange={(e) => setFormRoomType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gedung</label>
                  <input
                    type="text"
                    placeholder="Gedung E"
                    value={formBuilding}
                    onChange={(e) => setFormBuilding(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fasilitas</label>
                <input
                  type="text"
                  placeholder="LCD Proyektor, AC, Whiteboard"
                  value={formFacilities}
                  onChange={(e) => setFormFacilities(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-700">Ruangan Aktif Digunakan</span>
                </label>
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
                  {formSubmitting ? 'Menyimpan...' : 'Simpan Ruangan'}
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
        title="Hapus Ruangan"
        message={`Apakah Anda yakin ingin menghapus ruangan ${roomToDelete?.code} (${roomToDelete?.name})?`}
        loading={deleting}
      />
    </div>
  );
};

export const RuanganPage = RoomsPage;
