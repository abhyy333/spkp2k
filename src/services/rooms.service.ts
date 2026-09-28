import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Room } from '../types';
import { parseSupabaseError } from '../lib/utils';
import { verifyOwnerAdmin, assertOwnerAdmin } from '../lib/authGuard';

export const roomsService = {
  async getRooms(filters?: { search?: string; type?: string; status?: string }): Promise<Room[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const isOwner = await verifyOwnerAdmin();
    const table = isOwner ? 'rooms' : 'guest_rooms';

    let query = supabase
      .from(table)
      .select('*')
      .order('code', { ascending: true });

    if (filters?.type && filters.type !== 'all') {
      query = query.eq('room_type', filters.type);
    }
    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'active') {
        query = query.eq('is_active', true);
      } else if (filters.status === 'inactive') {
        query = query.eq('is_active', false);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching rooms:', error);
      throw new Error(parseSupabaseError(error));
    }

    let rooms: Room[] = (data || []).map((r: any) => ({
      ...r,
      status: r.is_active ? 'Tersedia' : 'Nonaktif',
    }));

    if (filters?.search) {
      const s = filters.search.toLowerCase().trim();
      rooms = rooms.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(s)) ||
          (r.code && r.code.toLowerCase().includes(s)) ||
          (r.building && r.building.toLowerCase().includes(s))
      );
    }

    return rooms;
  },

  async getRoomById(id: string): Promise<Room> {
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const isOwner = await verifyOwnerAdmin();
    const table = isOwner ? 'rooms' : 'guest_rooms';

    const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
    if (error) throw new Error(parseSupabaseError(error));
    return data;
  },

  async createRoom(data: {
    code: string;
    name: string;
    capacity: number;
    room_type: string;
    facilities?: string | null;
    is_active?: boolean;
    building?: string;
  }): Promise<Room> {
    await assertOwnerAdmin('menambah ruangan');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (!data.code || !data.code.trim()) {
      throw new Error('Kode ruangan wajib diisi.');
    }
    if (!data.name || !data.name.trim()) {
      throw new Error('Nama ruangan wajib diisi.');
    }
    const cap = Number(data.capacity);
    if (!cap || cap <= 0) {
      throw new Error('Kapasitas ruangan harus lebih besar dari 0.');
    }

    const payload: Record<string, any> = {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      capacity: cap,
      room_type: data.room_type || 'Ruang Kuliah Teori',
      facilities: data.facilities?.trim() || null,
      is_active: data.is_active ?? true,
    };

    const { data: created, error } = await supabase
      .from('rooms')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error));
    }

    return created;
  },

  async updateRoom(
    id: string,
    data: {
      code: string;
      name: string;
      capacity: number;
      room_type: string;
      facilities?: string | null;
      is_active?: boolean;
      building?: string;
    }
  ): Promise<Room> {
    await assertOwnerAdmin('mengubah data ruangan');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    if (!data.code || !data.code.trim()) {
      throw new Error('Kode ruangan wajib diisi.');
    }
    if (!data.name || !data.name.trim()) {
      throw new Error('Nama ruangan wajib diisi.');
    }
    const cap = Number(data.capacity);
    if (!cap || cap <= 0) {
      throw new Error('Kapasitas ruangan harus lebih besar dari 0.');
    }

    const payload: Record<string, any> = {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      capacity: cap,
      room_type: data.room_type || 'Ruang Kuliah Teori',
      facilities: data.facilities?.trim() || null,
      is_active: data.is_active ?? true,
    };

    const { data: updated, error } = await supabase
      .from('rooms')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(parseSupabaseError(error));
    }

    return updated;
  },

  async deleteRoom(id: string): Promise<void> {
    await assertOwnerAdmin('menghapus ruangan');
    if (!isSupabaseConfigured()) {
      throw new Error('Koneksi database belum dikonfigurasi.');
    }

    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) {
      throw new Error(parseSupabaseError(error));
    }
  },

  async toggleRoomActive(id: string, isActive: boolean): Promise<void> {
    await assertOwnerAdmin('mengubah status aktif ruangan');
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('rooms')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw new Error(parseSupabaseError(error));
  },

  async getDistinctRoomTypes(): Promise<string[]> {
    if (!isSupabaseConfigured()) return ['Ruang Kuliah Teori', 'Laboratorium Komputer'];
    try {
      const isOwner = await verifyOwnerAdmin();
      const table = isOwner ? 'rooms' : 'guest_rooms';
      const { data, error } = await supabase.from(table).select('room_type');
      if (error) throw error;
      const types = Array.from(new Set((data || []).map((r: any) => r.room_type).filter(Boolean)));
      return types.length > 0 ? types : ['Ruang Kuliah Teori', 'Laboratorium Komputer', 'Laboratorium Elektronika'];
    } catch {
      return ['Ruang Kuliah Teori', 'Laboratorium Komputer', 'Laboratorium Elektronika'];
    }
  },

  async getStats() {
    if (!isSupabaseConfigured()) {
      return { total: 0, totalCapacity: 0, activeRooms: 0, highCapacity: 0 };
    }

    try {
      const isOwner = await verifyOwnerAdmin();
      const table = isOwner ? 'rooms' : 'guest_rooms';
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;

      const total = data?.length || 0;
      const totalCapacity = data?.reduce((acc: number, r: any) => acc + (r.capacity || 0), 0) || 0;
      const activeRooms = data?.filter((r: any) => r.is_active).length || 0;
      const highCapacity = data?.filter((r: any) => (r.capacity || 0) >= 40).length || 0;

      return {
        total,
        totalCapacity,
        activeRooms,
        highCapacity,
      };
    } catch (err) {
      console.error('Failed to get room stats:', err);
      return { total: 0, totalCapacity: 0, activeRooms: 0, highCapacity: 0 };
    }
  },
};
