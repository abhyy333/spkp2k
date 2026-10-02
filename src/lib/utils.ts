/**
 * Utility functions for SPK Penjadwalan Perkuliahan Teknik Elektro Unram
 */

/**
 * Aturan sistem penjadwalan Teknik Elektro Universitas Mataram:
 * 1 SKS = 50 menit
 * 2 SKS = 100 menit
 * 3 SKS = 150 menit
 * 4 SKS = 200 menit
 */
export function sksToMinutes(sks: number): number {
  if (!sks || sks <= 0) return 0;
  return sks * 50;
}

/**
 * Konversi menit hari (minute-of-day) ke format "HH:MM"
 * Contoh: 470 -> "07:50", 520 -> "08:40"
 */
export function minuteToTime(minutes: number): string {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '00:00';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Konversi format "HH:MM" ke menit hari
 * Contoh: "07:50" -> 470, "08:40" -> 520
 */
export function timeToMinute(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Konversi integer day_of_week ke Nama Hari Bahasa Indonesia
 * 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu, 7 = Minggu
 */
export function dayOfWeekToName(day: number): string {
  const map: Record<number, string> = {
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
    6: 'Sabtu',
    7: 'Minggu',
  };
  return map[day] || `Hari ${day}`;
}

/**
 * Mendapatkan nama hari bahasa Indonesia dari objek Date
 */
export function getDayNameIndo(date: Date): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[date.getDay()];
}

/**
 * Konversi Nama Hari ke integer day_of_week
 */
export function nameToDayOfWeek(name: string): number {
  const map: Record<string, number> = {
    senin: 1,
    selasa: 2,
    rabu: 3,
    kamis: 4,
    jumat: 5,
    sabtu: 6,
    minggu: 7,
  };
  return map[name.toLowerCase()] || 1;
}

/**
 * Classnames merger helper
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Inisial nama untuk avatar
 */
export function getInitials(name: string): string {
  if (!name) return 'TE';
  const clean = name.replace(/^(Dr\.|Prof\.|Ir\.|H\.|Drs\.|M\.|ST\.|S\.T\.|M\.T\.|M\.Sc\.|Ph\.D\.|M\.Eng\.)\s*/gi, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TE';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Deteksi kemiripan nama untuk mencegah duplikasi dosen
 * Mengabaikan gelar, spasi, dan tanda baca.
 */
export function normalizeNameForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/(dr|prof|ir|drs|h|st|s\.t|m\.t|m\.sc|ph\.d|m\.eng)\.?/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

/**
 * Parse pesan error database Supabase ke pesan ramah pengguna
 */
export function parseSupabaseError(error: any, context?: string): string {
  if (!error) return 'Terjadi kesalahan sistem yang tidak diketahui.';
  if (typeof error === 'string') return error;

  // Log technical error details to console
  console.error('Technical database error:', error);

  const msg = String(error.message || error.details || '');
  const code = String(error.code || '');

  // 23505 = unique_violation
  if (code === '23505' || msg.includes('duplicate key') || msg.includes('already exists')) {
    if (msg.includes('code') || context === 'course_code') {
      return 'Kode mata kuliah tersebut sudah digunakan.';
    }
    if (msg.includes('nim') || context === 'student_nim') {
      return 'NIM tersebut sudah terdaftar.';
    }
    if (msg.includes('lecturer_code')) {
      return 'Kode dosen tersebut sudah digunakan.';
    }
    if (msg.includes('class_code') || context === 'class_code') {
      return 'Kelas dengan kode tersebut sudah ada untuk mata kuliah ini.';
    }
    return 'Data dengan pengenal unik tersebut sudah ada dalam sistem.';
  }

  // Specific draft lifecycle action mappings
  if (msg.includes('LECTURE_SCOPE_ONLY')) {
    return 'Draft yang terbuka bukan draft perkuliahan. Sistem sedang memuat draft perkuliahan yang sesuai.';
  }
  if (msg.includes('ONLY_DRAFT_CAN_BE_DELETED')) {
    return 'Hanya draft yang dapat dihapus.';
  }
  if (msg.includes('ONLY_DRAFT_CAN_BE_CLEARED')) {
    return 'Hanya draft yang dapat dikosongkan.';
  }
  if (msg.includes('ADMIN_REQUIRED') || msg.includes('require_admin')) {
    return 'Tindakan ini hanya dapat dilakukan Administrator.';
  }
  if (msg.includes('CANNOT_DELETE_PUBLISHED_SCHEDULE')) {
    return 'Jadwal yang sedang diterbitkan tidak dapat dihapus.';
  }
  if (msg.includes('DRAFT_NOT_FOUND')) {
    return 'Draft tidak ditemukan.';
  }

  // 23503 = foreign_key_violation
  if (code === '23503' || msg.includes('violates foreign key constraint')) {
    return 'Data tidak dapat dihapus karena masih digunakan oleh data akademik lain.';
  }

  // 42501 = insufficient_privilege / RLS policy violation
  if (code === '42501' || msg.includes('permission denied') || msg.includes('violates row-level security')) {
    return 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
  }

  // Schedule RPC server validation mappings
  if (msg.includes('ROOM_CAPACITY_EXCEEDED')) {
    return 'Kapasitas ruangan tidak mencukupi.';
  }
  if (msg.includes('ROOM_CONFLICT')) {
    return 'Ruangan digunakan oleh jadwal lain pada waktu yang sama.';
  }
  if (msg.includes('LECTURER_CONFLICT')) {
    return 'Dosen memiliki jadwal lain pada waktu yang sama.';
  }
  if (msg.includes('LECTURER_UNAVAILABLE')) {
    return 'Dosen tidak tersedia pada waktu tersebut.';
  }
  if (msg.includes('INCOMPATIBLE_ROOM_TYPE')) {
    return 'Tipe ruangan tidak sesuai dengan kebutuhan mata kuliah.';
  }
  if (msg.includes('NON_CONSECUTIVE_OR_INACTIVE_SESSIONS')) {
    return 'Slot waktu tidak tersedia secara berurutan sesuai jumlah SKS.';
  }
  if (msg.includes('INVALID_COURSE_OR_EFFECTIVE_SKS')) {
    return 'Data mata kuliah atau jumlah SKS belum valid.';
  }
  if (msg.includes('INCOMPLETE_SCHEDULE') || msg.includes('UNREVIEWED_ASSIGNMENT')) {
    return 'Masih ada kelas aktif yang belum dijadwalkan atau belum ditinjau.';
  }
  if (msg.includes('CANNOT_PUBLISH_EMPTY_SCHEDULE')) {
    return 'Jadwal belum memiliki entri kelas untuk diterbitkan.';
  }
  if (msg.includes('HARD_CONFLICTS_EXIST')) {
    return 'Masih terdapat bentrok jadwal yang belum diselesaikan.';
  }
  if (msg.includes('PUBLISHED_LECTURE_SCHEDULE_REQUIRED')) {
    return 'Jadwal perkuliahan resmi belum diterbitkan untuk periode semester ini. Tetapkan terlebih dahulu Jadwal Perkuliahan sebagai Final di menu Penyusunan Jadwal sebelum menyusun jadwal ujian.';
  }
  if (msg.includes('STALE_REVISION') || msg.includes('stale revision') || msg.includes('revision mismatch')) {
    return 'Versi draft telah berubah. Muat ulang data terbaru sebelum menerbitkan.';
  }

  // 42703 / undefined_column / actual schema cache missing column
  if (code === '42703' || (msg.includes('column') && msg.includes('does not exist'))) {
    return 'Gagal memproses data karena ketidaksesuaian kolom pada database.';
  }

  if (context === 'course_save') {
    return 'Gagal menyimpan perubahan mata kuliah.';
  }
  if (context === 'lecturer_delete') {
    return 'Dosen tidak dapat dihapus karena masih digunakan pada data akademik.';
  }

  // Technical error string sanitize
  if (msg.includes('PostgREST') || msg.includes('relation') || msg.includes('syntax') || msg.includes('table')) {
    return 'Terjadi kendala saat memproses data pada database.';
  }

  return msg || 'Gagal memproses data pada database.';
}

/**
 * Format tanggal Indonesia
 */
export function formatDateIndo(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return typeof dateStr === 'string' ? dateStr : '—';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return typeof dateStr === 'string' ? dateStr : '—';
  }
}

/**
 * Format tanggal & jam Indonesia
 */
export function formatDateTimeIndo(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return typeof dateStr === 'string' ? dateStr : '—';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return typeof dateStr === 'string' ? dateStr : '—';
  }
}

/**
 * Maps error messages specifically for schedule delete & clear actions
 */
export function parseDeleteScheduleError(err: any): string {
  if (!err) return 'Gagal menghapus jadwal. Silakan coba lagi.';
  const msg = typeof err === 'string' ? err : err.message || err.details || err.hint || '';
  const code = err?.code || err?.status || '';

  // 1. Missing RPC / 404 / Schema cache missing function
  if (
    code === 'PGRST202' ||
    code === 404 ||
    code === '404' ||
    msg.includes('Could not find the function') ||
    msg.includes('schema cache') ||
    msg.includes('Searched for the function')
  ) {
    return 'Fungsi server belum tersedia.';
  }

  // 2. Admin authorization (ADMIN_REQUIRED / SQLSTATE 42501)
  if (
    msg.includes('ADMIN_REQUIRED') ||
    msg.includes('require_admin') ||
    code === '42501' ||
    (code !== '23503' && msg.includes('permission denied'))
  ) {
    return 'Tindakan ini hanya dapat dilakukan Administrator.';
  }

  // 3. Not found
  if (msg.includes('VERSION_NOT_FOUND') || msg.includes('DRAFT_NOT_FOUND')) {
    return 'Versi jadwal sudah tidak ditemukan.';
  }

  // 4. Draft status validations
  if (msg.includes('ONLY_DRAFT_CAN_BE_DELETED')) {
    return 'Hanya draft yang dapat dihapus menggunakan fungsi draf.';
  }
  if (msg.includes('ONLY_DRAFT_CAN_BE_CLEARED')) {
    return 'Hanya draft yang dapat dikosongkan.';
  }
  if (
    msg.includes('ACTIVE_PUBLICATION_CANNOT_BE_DELETED') ||
    msg.includes('CANNOT_DELETE_PUBLISHED_SCHEDULE')
  ) {
    return 'Jadwal yang sedang diterbitkan tidak dapat dihapus.';
  }
  if (msg.includes('VERSION_HAS_DEPENDENCIES') || msg.includes('masih menjadi sumber')) {
    return 'Draft ini masih menjadi sumber versi lain dan belum dapat dihapus.';
  }

  // 5. Foreign key dependencies
  if (
    code === '23503' ||
    msg.includes('violates foreign key constraint') ||
    msg.includes('foreign key') ||
    msg.includes('dependency error')
  ) {
    return 'Data tidak dapat dihapus karena masih digunakan oleh data akademik lain.';
  }

  return 'Gagal menghapus jadwal. Silakan coba lagi.';
}

export const parseDraftError = parseDeleteScheduleError;

const DAY_ORDER_MAP: Record<string, number> = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
  minggu: 7,
};

export function getDayOrderValue(day?: string | number): number {
  if (typeof day === 'number') return day;
  if (!day) return 99;
  const lower = String(day).trim().toLowerCase();
  return DAY_ORDER_MAP[lower] || 99;
}

export function sortScheduleEntries<T extends { day?: string | number; day_of_week?: number; dayOfWeek?: number; start_minute?: number; startMinute?: number; start_time?: string; startTime?: string; course_name?: string; courseName?: string; course_code?: string; courseCode?: string; class_name?: string; className?: string; class_code?: string; classCode?: string }>(schedules: T[]): T[] {
  return [...schedules].sort((a, b) => {
    const dayA = a.day_of_week ?? a.dayOfWeek ?? getDayOrderValue(a.day);
    const dayB = b.day_of_week ?? b.dayOfWeek ?? getDayOrderValue(b.day);
    if (dayA !== dayB) return dayA - dayB;

    const startA = a.start_minute ?? a.startMinute ?? (a.start_time ? timeToMinute(a.start_time) : (a.startTime ? timeToMinute(a.startTime) : 0));
    const startB = b.start_minute ?? b.startMinute ?? (b.start_time ? timeToMinute(b.start_time) : (b.startTime ? timeToMinute(b.startTime) : 0));
    if (startA !== startB) return startA - startB;

    const nameA = (a.course_name || a.courseName || a.course_code || a.courseCode || '').toLowerCase();
    const nameB = (b.course_name || b.courseName || b.course_code || b.courseCode || '').toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    const classA = (a.class_name || a.className || a.class_code || a.classCode || '').toLowerCase();
    const classB = (b.class_name || b.className || b.class_code || b.classCode || '').toLowerCase();
    return classA.localeCompare(classB);
  });
}



