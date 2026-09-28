/**
 * Official Curriculum Package Definitions for Teknik Elektro Universitas Mataram
 * Sourced from "konversi kurikulum 2022_2026_Final rapat edit.xlsx" and official curriculum database
 */

export interface PackageCourseItem {
  code: string;
  name: string;
  sks: number;
  semester: number;
  category: 'Wajib' | 'Pilihan' | 'Praktikum';
  kbk_code: 'DASAR' | 'STL' | 'KOMPUTER' | 'ELKOM' | 'ELKOM_TEL' | 'ELKOM_EL';
  kbk_name: string;
  order: number;
}

export interface PackageGroup {
  id: string;
  legacy_id: string;
  name: string;
  curriculum_year: 2026 | 2022;
  semester: number;
  kbk_code: 'DASAR' | 'STL' | 'KOMPUTER' | 'ELKOM' | 'ELKOM_TEL' | 'ELKOM_EL';
  kbk_name: string;
  badge_label: string;
  total_sks: number;
  course_count: number;
  courses: PackageCourseItem[];
}

// --------------------------------------------------------------------------------
// KURIKULUM 2026 PACKAGES
// --------------------------------------------------------------------------------

export const KURIKULUM_2026_ALL_PACKAGES: PackageGroup[] = [
  // SEMESTER 1 (9 MK, 20 SKS)
  {
    id: 'pkg-2026-s1-umum',
    legacy_id: 'PKG_2026_UMUM_S1',
    name: 'Paket Semester 1 — Kurikulum 2026',
    curriculum_year: 2026,
    semester: 1,
    kbk_code: 'DASAR',
    kbk_name: 'Paket Bersama / Umum',
    badge_label: 'Paket Bersama / Umum',
    total_sks: 20,
    course_count: 9,
    courses: [
      { code: 'MWK1071101', name: 'Agama', sks: 2, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 1 },
      { code: 'MPS1071101', name: 'Fisika Listrik & Magnet', sks: 3, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 2 },
      { code: 'MPS1071102', name: 'Fisika Mekanika', sks: 3, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 3 },
      { code: 'MPS1071103', name: 'Dasar Integral & Differensial', sks: 3, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 4 },
      { code: 'MPS1071104', name: 'Kimia Dasar', sks: 2, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 5 },
      { code: 'MWK1071102', name: 'Pancasila', sks: 2, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 6 },
      { code: 'MPS1071105', name: 'Dasar Teknologi Informasi', sks: 2, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 7 },
      { code: 'MPS1071106', name: 'Praktikum Rangkaian Logika', sks: 1, semester: 1, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 8 },
      { code: 'MPS1071107', name: 'Rangkaian Logika', sks: 2, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 9 },
    ],
  },

  // SEMESTER 2 (9 MK, 20 SKS)
  {
    id: 'pkg-2026-s2-umum',
    legacy_id: 'PKG_2026_UMUM_S2',
    name: 'Paket Semester 2 — Kurikulum 2026',
    curriculum_year: 2026,
    semester: 2,
    kbk_code: 'DASAR',
    kbk_name: 'Paket Bersama / Umum',
    badge_label: 'Paket Bersama / Umum',
    total_sks: 20,
    course_count: 9,
    courses: [
      { code: 'MPS1072108', name: 'Praktikum Dasar Pemrograman', sks: 1, semester: 2, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 1 },
      { code: 'MPS1072109', name: 'Persamaan Differensial & Integral', sks: 3, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 2 },
      { code: 'MPS1072110', name: 'Rangkaian Listrik I', sks: 3, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 3 },
      { code: 'MWK1072103', name: 'Kewarganegaraan', sks: 2, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 4 },
      { code: 'MPS1072111', name: 'Dasar Pemrograman', sks: 3, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 5 },
      { code: 'MPS1072112', name: 'Dasar Telekomunikasi', sks: 3, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 6 },
      { code: 'MPS1072113', name: 'Fisika Optik dan Gelombang', sks: 2, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 7 },
      { code: 'MPS1072114', name: 'Praktikum Dasar Telekomunikasi', sks: 1, semester: 2, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 8 },
      { code: 'MWK1072104', name: 'Bahasa Indonesia', sks: 2, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 9 },
    ],
  },

  // SEMESTER 3 (10 MK, 20 SKS)
  {
    id: 'pkg-2026-s3-umum',
    legacy_id: 'PKG_2026_UMUM_S3',
    name: 'Paket Semester 3 — Kurikulum 2026',
    curriculum_year: 2026,
    semester: 3,
    kbk_code: 'DASAR',
    kbk_name: 'Paket Bersama / Umum',
    badge_label: 'Paket Bersama / Umum',
    total_sks: 20,
    course_count: 10,
    courses: [
      { code: 'MPS1073115', name: 'Aljabar Linier', sks: 3, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 1 },
      { code: 'MWU1073101', name: 'Bahasa Inggris', sks: 2, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 2 },
      { code: 'MPS1073116', name: 'Rangkaian Listrik II', sks: 2, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 3 },
      { code: 'MPS1073117', name: 'Dasar Elektronika', sks: 3, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 4 },
      { code: 'MPS1073118', name: 'Dasar Tenaga Listrik', sks: 3, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 5 },
      { code: 'MPS1073119', name: 'Praktikum Pengukuran dan Instrumentasi', sks: 1, semester: 3, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 6 },
      { code: 'MPS1073120', name: 'Pengukuran & Instrumentasi', sks: 2, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 7 },
      { code: 'MPS1073121', name: 'Probabilitas dan Statistik', sks: 2, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 8 },
      { code: 'MPS1073122', name: 'Praktikum Fisika', sks: 1, semester: 3, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 9 },
      { code: 'MPS1073123', name: 'Praktikum Rangkaian Listrik', sks: 1, semester: 3, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 10 },
    ],
  },

  // SEMESTER 4 (10 MK, 20 SKS)
  {
    id: 'pkg-2026-s4-umum',
    legacy_id: 'PKG_2026_UMUM_S4',
    name: 'Paket Semester 4 — Kurikulum 2026',
    curriculum_year: 2026,
    semester: 4,
    kbk_code: 'DASAR',
    kbk_name: 'Paket Bersama / Umum',
    badge_label: 'Paket Bersama / Umum',
    total_sks: 20,
    course_count: 10,
    courses: [
      { code: 'MPS1074116', name: 'Matematika Stokastik', sks: 2, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 1 },
      { code: 'MPS1074117', name: 'Variabel Kompleks', sks: 3, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 2 },
      { code: 'MPS1074118', name: 'Bahan Listrik', sks: 2, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 3 },
      { code: 'MPS1074119', name: 'Sinyal & Sistem', sks: 2, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 4 },
      { code: 'MPS1074120', name: 'Elektromagnetik', sks: 2, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 5 },
      { code: 'MPS1074121', name: 'Sistem Mikroprosessor', sks: 2, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 6 },
      { code: 'MPS1074122', name: 'Pengolahan Sinyal Digital', sks: 3, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 7 },
      { code: 'MPS1074123', name: 'Fisika Panas & Fluida', sks: 2, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 8 },
      { code: 'MPS1074124', name: 'Praktikum Dasar Elektronika', sks: 1, semester: 4, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 9 },
      { code: 'MPS1074125', name: 'Praktikum Dasar Tenaga Listrik', sks: 1, semester: 4, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 10 },
    ],
  },

  // SEMESTER 5 — STL (11 MK, 19 SKS)
  {
    id: 'pkg-2026-s5-stl',
    legacy_id: 'PKG_2026_STL_S5',
    name: 'Paket Semester 5 — Sistem Tenaga Listrik',
    curriculum_year: 2026,
    semester: 5,
    kbk_code: 'STL',
    kbk_name: 'Sistem Tenaga Listrik',
    badge_label: 'Sistem Tenaga Listrik',
    total_sks: 19,
    course_count: 11,
    courses: [
      { code: 'MPS1075101', name: 'Analisis Sistem Tenaga I', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 1 },
      { code: 'MPS1075102', name: 'Mesin-Mesin Listrik I', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 2 },
      { code: 'MPS1075103', name: 'Transmisi dan Distribusi Tenaga Listrik', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 3 },
      { code: 'MPS1075104', name: 'Pembangkit Tenaga Listrik', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 4 },
      { code: 'MPS1075105', name: 'Elektronika Daya', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 5 },
      { code: 'MPS1075106', name: 'Teknik Tegangan Tinggi', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 6 },
      { code: 'MPS1075107', name: 'Sistem Proteksi Tenaga Listrik', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 7 },
      { code: 'MPS1075108', name: 'Praktikum Sistem Tenaga Listrik', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 8 },
      { code: 'MPS1075109', name: 'Praktikum Mesin Listrik', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 9 },
      { code: 'MPS1075110', name: 'Manajemen Energi Listrik', sks: 1, semester: 5, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 10 },
      { code: 'MPS1075111', name: 'Kualitas Daya Listrik', sks: 1, semester: 5, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 11 },
    ],
  },

  // SEMESTER 5 — KOMPUTER (9 MK, 18 SKS)
  {
    id: 'pkg-2026-s5-komputer',
    legacy_id: 'PKG_2026_KOMPUTER_S5',
    name: 'Paket Semester 5 — Komputer',
    curriculum_year: 2026,
    semester: 5,
    kbk_code: 'KOMPUTER',
    kbk_name: 'Komputer',
    badge_label: 'Komputer',
    total_sks: 18,
    course_count: 9,
    courses: [
      { code: 'MPS1075201', name: 'Struktur Data & Algoritma', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 1 },
      { code: 'MPS1075202', name: 'Jaringan Komputer', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 2 },
      { code: 'MPS1075203', name: 'Arsitektur Komputer & Organisasi', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 3 },
      { code: 'MPS1075204', name: 'Sistem Basis Data', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 4 },
      { code: 'MPS1075205', name: 'Pemrograman Berorientasi Objek', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 5 },
      { code: 'MPS1075206', name: 'Sistem Operasi', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 6 },
      { code: 'MPS1075207', name: 'Praktikum Jaringan Komputer', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 7 },
      { code: 'MPS1075208', name: 'Praktikum Basis Data', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 8 },
      { code: 'MPS1075209', name: 'Kecerdasan Buatan', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 9 },
    ],
  },

  // SEMESTER 5 — ELEKTRONIKA DIGITAL & TELEKOMUNIKASI (10 MK, 19 SKS)
  {
    id: 'pkg-2026-s5-elkom',
    legacy_id: 'PKG_2026_ELKOM_S5',
    name: 'Paket Semester 5 — Elektronika Digital dan Telekomunikasi',
    curriculum_year: 2026,
    semester: 5,
    kbk_code: 'ELKOM',
    kbk_name: 'Elektronika Digital dan Telekomunikasi',
    badge_label: 'Elektronika Digital dan Telekomunikasi',
    total_sks: 19,
    course_count: 10,
    courses: [
      { code: 'MPS1075301', name: 'Sistem Komunikasi Analog & Digital', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 1 },
      { code: 'MPS1075302', name: 'Elektronika Komunikasi', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 2 },
      { code: 'MPS1075303', name: 'Antena dan Propagasi Gelombang', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 3 },
      { code: 'MPS1075304', name: 'Saluran Transmisi Gelombang Mikro', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 4 },
      { code: 'MPS1075305', name: 'Sistem Kontrol & Kendali', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 5 },
      { code: 'MPS1075306', name: 'Sensor dan Akuisisi Data', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 6 },
      { code: 'MPS1075307', name: 'Perancangan Sistem VLSI', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 7 },
      { code: 'MPS1075308', name: 'Praktikum Sistem Telekomunikasi', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 8 },
      { code: 'MPS1075309', name: 'Praktikum Elektronika Lanjut', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 9 },
      { code: 'MPS1075310', name: 'Komunikasi Nirkabel', sks: 2, semester: 5, category: 'Pilihan', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 10 },
    ],
  },

  // SEMESTER 6 — STL (11 MK, 20 SKS)
  {
    id: 'pkg-2026-s6-stl',
    legacy_id: 'PKG_2026_STL_S6',
    name: 'Paket Semester 6 — Sistem Tenaga Listrik',
    curriculum_year: 2026,
    semester: 6,
    kbk_code: 'STL',
    kbk_name: 'Sistem Tenaga Listrik',
    badge_label: 'Sistem Tenaga Listrik',
    total_sks: 20,
    course_count: 11,
    courses: [
      { code: 'MPS1076101', name: 'Analisis Sistem Tenaga II', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 1 },
      { code: 'MPS1076102', name: 'Mesin-Mesin Listrik II', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 2 },
      { code: 'MPS1076103', name: 'Operasi & Pengendalian Sistem Tenaga', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 3 },
      { code: 'MPS1076104', name: 'Energi Baru Terbarukan', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 4 },
      { code: 'MPS1076105', name: 'Dinamika & Stabilitas Sistem Tenaga', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 5 },
      { code: 'MPS1076106', name: 'Instalasi Tenaga Listrik & Penerangan', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 6 },
      { code: 'MPS1076107', name: 'Perancangan Sistem Tenaga Listrik', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 7 },
      { code: 'MPS1076108', name: 'Praktikum Tegangan Tinggi', sks: 1, semester: 6, category: 'Praktikum', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 8 },
      { code: 'MPS1076109', name: 'Praktikum EBT & Otomasi', sks: 1, semester: 6, category: 'Praktikum', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 9 },
      { code: 'MPS1076110', name: 'Keandalan Sistem Tenaga Listrik', sks: 1, semester: 6, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 10 },
      { code: 'MPS1076111', name: 'Smart Grid & Mikrogrid', sks: 2, semester: 6, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 11 },
    ],
  },

  // SEMESTER 6 — KOMPUTER (11 MK, 20 SKS)
  {
    id: 'pkg-2026-s6-komputer',
    legacy_id: 'PKG_2026_KOMPUTER_S6',
    name: 'Paket Semester 6 — Komputer',
    curriculum_year: 2026,
    semester: 6,
    kbk_code: 'KOMPUTER',
    kbk_name: 'Komputer',
    badge_label: 'Komputer',
    total_sks: 20,
    course_count: 11,
    courses: [
      { code: 'MPS1076201', name: 'Sistem Tertanam (Embedded Systems)', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 1 },
      { code: 'MPS1076202', name: 'Internet of Things (IoT)', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 2 },
      { code: 'MPS1076203', name: 'Keamanan Jaringan & Siber', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 3 },
      { code: 'MPS1076204', name: 'Pengolahan Citra Digital', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 4 },
      { code: 'MPS1076205', name: 'Machine Learning', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 5 },
      { code: 'MPS1076206', name: 'Cloud Computing & Komputasi Terdistribusi', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 6 },
      { code: 'MPS1076207', name: 'Praktikum Sistem Tertanam', sks: 1, semester: 6, category: 'Praktikum', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 7 },
      { code: 'MPS1076208', name: 'Praktikum IoT & Jaringan', sks: 1, semester: 6, category: 'Praktikum', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 8 },
      { code: 'MPS1076209', name: 'Rekayasa Perangkat Lunak', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 9 },
      { code: 'MPS1076210', name: 'Visi Komputer', sks: 1, semester: 6, category: 'Pilihan', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 10 },
      { code: 'MPS1076211', name: 'Big Data Analytics', sks: 2, semester: 6, category: 'Pilihan', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 11 },
    ],
  },

  // SEMESTER 6 — ELKOM (10 MK, 19 SKS)
  {
    id: 'pkg-2026-s6-elkom',
    legacy_id: 'PKG_2026_ELKOM_S6',
    name: 'Paket Semester 6 — Elektronika Digital dan Telekomunikasi',
    curriculum_year: 2026,
    semester: 6,
    kbk_code: 'ELKOM',
    kbk_name: 'Elektronika Digital dan Telekomunikasi',
    badge_label: 'Elektronika Digital dan Telekomunikasi',
    total_sks: 19,
    course_count: 10,
    courses: [
      { code: 'MPS1076301', name: 'Sistem Komunikasi Bergerak & Seluler', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 1 },
      { code: 'MPS1076302', name: 'Komunikasi Serat Optik', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 2 },
      { code: 'MPS1076303', name: 'Radar dan Navigasi', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 3 },
      { code: 'MPS1076304', name: 'Elektronika Medis', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 4 },
      { code: 'MPS1076305', name: 'Robotika dan Otomasi Industri', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 5 },
      { code: 'MPS1076306', name: 'Sistem Komunikasi Satelit', sks: 2, semester: 6, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 6 },
      { code: 'MPS1076307', name: 'Praktikum Komunikasi Optik', sks: 1, semester: 6, category: 'Praktikum', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 7 },
      { code: 'MPS1076308', name: 'Praktikum Robotika', sks: 1, semester: 6, category: 'Praktikum', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 8 },
      { code: 'MPS1076309', name: 'Pemrosesan Sinyal Suara & Video', sks: 2, semester: 6, category: 'Pilihan', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 9 },
      { code: 'MPS1076310', name: 'Perancangan Antena Mikrostrip', sks: 2, semester: 6, category: 'Pilihan', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 10 },
    ],
  },

  // SEMESTER 7 — STL (8 MK, 17 SKS)
  {
    id: 'pkg-2026-s7-stl',
    legacy_id: 'PKG_2026_STL_S7',
    name: 'Paket Semester 7 — Sistem Tenaga Listrik',
    curriculum_year: 2026,
    semester: 7,
    kbk_code: 'STL',
    kbk_name: 'Sistem Tenaga Listrik',
    badge_label: 'Sistem Tenaga Listrik',
    total_sks: 17,
    course_count: 8,
    courses: [
      { code: 'MPS1077101', name: 'Metodologi Penelitian Teknik Elektro', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 1 },
      { code: 'MPS1077102', name: 'Kerja Praktik (KP)', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 2 },
      { code: 'MPS1077103', name: 'Studi Kelayakan Sistem Tenaga', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 3 },
      { code: 'MPS1077104', name: 'Sistem Kendali Cerdas Tenaga Listrik', sks: 2, semester: 7, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 4 },
      { code: 'MPS1077105', name: 'Kendaraan Listrik & Stasiun Pengisian', sks: 2, semester: 7, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 5 },
      { code: 'MPS1077106', name: 'Otomasi Gardu Induk & SCADA', sks: 2, semester: 7, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 6 },
      { code: 'MPS1077107', name: 'Kewirausahaan Berbasis Teknologi (Technopreneurship)', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 7 },
      { code: 'MPS1077108', name: 'Kapita Selekta Sistem Tenaga', sks: 3, semester: 7, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 8 },
    ],
  },

  // SEMESTER 7 — KOMPUTER (9 MK, 18 SKS)
  {
    id: 'pkg-2026-s7-komputer',
    legacy_id: 'PKG_2026_KOMPUTER_S7',
    name: 'Paket Semester 7 — Komputer',
    curriculum_year: 2026,
    semester: 7,
    kbk_code: 'KOMPUTER',
    kbk_name: 'Komputer',
    badge_label: 'Komputer',
    total_sks: 18,
    course_count: 9,
    courses: [
      { code: 'MPS1077201', name: 'Metodologi Penelitian Teknik Elektro', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 1 },
      { code: 'MPS1077202', name: 'Kerja Praktik (KP)', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 2 },
      { code: 'MPS1077203', name: 'Kriptografi dan Keamanan Siber', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 3 },
      { code: 'MPS1077204', name: 'Pengembangan Aplikasi Mobile & Web', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 4 },
      { code: 'MPS1077205', name: 'Deep Learning & Neural Networks', sks: 2, semester: 7, category: 'Pilihan', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 5 },
      { code: 'MPS1077206', name: 'Sistem Temu Kembali Informasi', sks: 2, semester: 7, category: 'Pilihan', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 6 },
      { code: 'MPS1077207', name: 'Technopreneurship & Inovasi Digital', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 7 },
      { code: 'MPS1077208', name: 'Komputasi Paralel dan GPU', sks: 2, semester: 7, category: 'Pilihan', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 8 },
      { code: 'MPS1077209', name: 'Kapita Selekta Rekayasa Komputer', sks: 2, semester: 7, category: 'Pilihan', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 9 },
    ],
  },

  // SEMESTER 7 — ELKOM (8 MK, 18 SKS)
  {
    id: 'pkg-2026-s7-elkom',
    legacy_id: 'PKG_2026_ELKOM_S7',
    name: 'Paket Semester 7 — Elektronika Digital dan Telekomunikasi',
    curriculum_year: 2026,
    semester: 7,
    kbk_code: 'ELKOM',
    kbk_name: 'Elektronika Digital dan Telekomunikasi',
    badge_label: 'Elektronika Digital dan Telekomunikasi',
    total_sks: 18,
    course_count: 8,
    courses: [
      { code: 'MPS1077301', name: 'Metodologi Penelitian Teknik Elektro', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 1 },
      { code: 'MPS1077302', name: 'Kerja Praktik (KP)', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 2 },
      { code: 'MPS1077303', name: 'Jaringan Nirkabel 5G/6G & Future Networks', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 3 },
      { code: 'MPS1077304', name: 'Teknologi Semikonduktor & Mikroelektronika', sks: 2, semester: 7, category: 'Pilihan', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 4 },
      { code: 'MPS1077305', name: 'Sistem Komunikasi Optik Koheren', sks: 2, semester: 7, category: 'Pilihan', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 5 },
      { code: 'MPS1077306', name: 'Technopreneurship Perangkat Keras & Komunikasi', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 6 },
      { code: 'MPS1077307', name: 'EMC & Kompatibilitas Elektromagnetik', sks: 2, semester: 7, category: 'Pilihan', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 7 },
      { code: 'MPS1077308', name: 'Kapita Selekta Elkom', sks: 3, semester: 7, category: 'Pilihan', kbk_code: 'ELKOM', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 8 },
    ],
  },

  // SEMESTER 8 — KELULUSAN (3 MK, 8 SKS)
  {
    id: 'pkg-2026-s8-umum',
    legacy_id: 'PKG_2026_UMUM_S8',
    name: 'Paket Semester 8 — Tugas Akhir & Kelulusan',
    curriculum_year: 2026,
    semester: 8,
    kbk_code: 'DASAR',
    kbk_name: 'Tugas Akhir',
    badge_label: 'Tugas Akhir & Kelulusan',
    total_sks: 8,
    course_count: 3,
    courses: [
      { code: 'MPS1078101', name: 'Proposal Tugas Akhir', sks: 2, semester: 8, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 1 },
      { code: 'MPS1078102', name: 'Skripsi / Tugas Akhir', sks: 4, semester: 8, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 2 },
      { code: 'MWK1078101', name: 'Kuliah Kerja Nyata (KKN) / MBKM', sks: 2, semester: 8, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 3 },
    ],
  },
];

// --------------------------------------------------------------------------------
// KURIKULUM 2022 PACKAGES
// --------------------------------------------------------------------------------

export const KURIKULUM_2022_ALL_PACKAGES: PackageGroup[] = [
  // SEMESTER 1 (8 MK, 18 SKS)
  {
    id: 'pkg-2022-s1-umum',
    legacy_id: 'PKG_2022_UMUM_S1',
    name: 'Paket Semester 1 — Kurikulum 2022',
    curriculum_year: 2022,
    semester: 1,
    kbk_code: 'DASAR',
    kbk_name: 'Paket Bersama / Umum',
    badge_label: 'Paket Bersama / Umum',
    total_sks: 18,
    course_count: 8,
    courses: [
      { code: 'FBS1101', name: 'Agama', sks: 2, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 1 },
      { code: 'FBS1211', name: 'Fisika II', sks: 3, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 2 },
      { code: 'FBS1103', name: 'Fisika I', sks: 3, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 3 },
      { code: 'FBS1104', name: 'Kalkulus I', sks: 3, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 4 },
      { code: 'FBS1108', name: 'Pancasila', sks: 2, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 5 },
      { code: 'FBS1109', name: 'Dasar Teknologi Informasi', sks: 2, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 6 },
      { code: 'FBS1218', name: 'Praktikum Rangkaian Logika', sks: 1, semester: 1, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 7 },
      { code: 'FBS1107', name: 'Rangkaian Logika', sks: 2, semester: 1, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 8 },
    ],
  },

  // SEMESTER 2 (8 MK, 18 SKS)
  {
    id: 'pkg-2022-s2-umum',
    legacy_id: 'PKG_2022_UMUM_S2',
    name: 'Paket Semester 2 — Kurikulum 2022',
    curriculum_year: 2022,
    semester: 2,
    kbk_code: 'DASAR',
    kbk_name: 'Paket Bersama / Umum',
    badge_label: 'Paket Bersama / Umum',
    total_sks: 18,
    course_count: 8,
    courses: [
      { code: 'FBS1216', name: 'Praktikum Dasar Pemrograman', sks: 1, semester: 2, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 1 },
      { code: 'FBS1212', name: 'Kalkulus II', sks: 3, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 2 },
      { code: 'FBS1213', name: 'Rangkaian Listrik I', sks: 3, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 3 },
      { code: 'FBS3137', name: 'Kewarganegaraan', sks: 2, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 4 },
      { code: 'FBS1215', name: 'Dasar Pemrograman', sks: 3, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 5 },
      { code: 'FBS1217', name: 'Dasar Telekomunikasi', sks: 3, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 6 },
      { code: 'FBS2127', name: 'Praktikum Dasar Sistem Telekomunikasi', sks: 1, semester: 2, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 7 },
      { code: 'FBS1102', name: 'Bahasa Indonesia Akademik', sks: 2, semester: 2, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 8 },
    ],
  },

  // SEMESTER 3 (9 MK, 20 SKS)
  {
    id: 'pkg-2022-s3-umum',
    legacy_id: 'PKG_2022_UMUM_S3',
    name: 'Paket Semester 3 — Kurikulum 2022',
    curriculum_year: 2022,
    semester: 3,
    kbk_code: 'DASAR',
    kbk_name: 'Paket Bersama / Umum',
    badge_label: 'Paket Bersama / Umum',
    total_sks: 20,
    course_count: 9,
    courses: [
      { code: 'FBS2120', name: 'Matematika Teknik I', sks: 3, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 1 },
      { code: 'FBS2119', name: 'Bahasa Inggris Akademik', sks: 2, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 2 },
      { code: 'FBS2122', name: 'Rangkaian Listrik II', sks: 3, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 3 },
      { code: 'FBS2125', name: 'Dasar Elektronika', sks: 3, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 4 },
      { code: 'FBS2126', name: 'Dasar Tenaga Listrik', sks: 3, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 5 },
      { code: 'FBS2124', name: 'Praktikum Pengukuran Besaran Listrik', sks: 1, semester: 3, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 6 },
      { code: 'FBS2123', name: 'Pengukuran Besaran Listrik', sks: 2, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 7 },
      { code: 'FBS1214', name: 'Probabilitas dan Statistik', sks: 2, semester: 3, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 8 },
      { code: 'FBS2231', name: 'Praktikum Rangkaian Listrik', sks: 1, semester: 3, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 9 },
    ],
  },

  // SEMESTER 4 (9 MK, 20 SKS)
  {
    id: 'pkg-2022-s4-umum',
    legacy_id: 'PKG_2022_UMUM_S4',
    name: 'Paket Semester 4 — Kurikulum 2022',
    curriculum_year: 2022,
    semester: 4,
    kbk_code: 'DASAR',
    kbk_name: 'Paket Bersama / Umum',
    badge_label: 'Paket Bersama / Umum',
    total_sks: 20,
    course_count: 9,
    courses: [
      { code: 'FBS2228', name: 'Matematika Teknik II', sks: 3, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 1 },
      { code: 'FBS2229', name: 'Medan Elektromagnetik', sks: 3, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 2 },
      { code: 'FBS2230', name: 'Sistem Linier', sks: 2, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 3 },
      { code: 'FBS2232', name: 'Elektronika Lanjut', sks: 3, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 4 },
      { code: 'FBS2233', name: 'Mesin-Mesin Listrik', sks: 3, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 5 },
      { code: 'FBS2234', name: 'Praktikum Elektronika', sks: 1, semester: 4, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 6 },
      { code: 'FBS2235', name: 'Praktikum Mesin Listrik', sks: 1, semester: 4, category: 'Praktikum', kbk_code: 'DASAR', kbk_name: 'Umum', order: 7 },
      { code: 'FBS2236', name: 'Metode Numerik', sks: 2, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 8 },
      { code: 'FBS2237', name: 'Bahan-Bahan Listrik', sks: 2, semester: 4, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 9 },
    ],
  },

  // SEMESTER 5 — STL 2022 (20 SKS)
  {
    id: 'pkg-2022-s5-stl',
    legacy_id: 'PKG_2022_STL_S5',
    name: 'Paket Semester 5 — Sistem Tenaga Listrik',
    curriculum_year: 2022,
    semester: 5,
    kbk_code: 'STL',
    kbk_name: 'Sistem Tenaga Listrik',
    badge_label: 'Sistem Tenaga Listrik',
    total_sks: 20,
    course_count: 8,
    courses: [
      { code: 'FBS3138', name: 'Analisis Sistem Tenaga I', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 1 },
      { code: 'FBS3139', name: 'Pembangkitan Tenaga Listrik', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 2 },
      { code: 'FBS3140', name: 'Transmisi dan Distribusi Listrik', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 3 },
      { code: 'FBS3141', name: 'Elektronika Daya', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 4 },
      { code: 'FBS3142', name: 'Sistem Proteksi Tenaga Listrik', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 5 },
      { code: 'FBS3143', name: 'Teknik Tegangan Tinggi', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 6 },
      { code: 'FBS3144', name: 'Praktikum Sistem Tenaga Listrik', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 7 },
      { code: 'FBS3145', name: 'Peralatan Tegangan Tinggi', sks: 2, semester: 5, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 8 },
    ],
  },

  // SEMESTER 5 — KOMPUTER 2022 (19 SKS)
  {
    id: 'pkg-2022-s5-komputer',
    legacy_id: 'PKG_2022_KOMPUTER_S5',
    name: 'Paket Semester 5 — Komputer',
    curriculum_year: 2022,
    semester: 5,
    kbk_code: 'KOMPUTER',
    kbk_name: 'Komputer',
    badge_label: 'Komputer',
    total_sks: 19,
    course_count: 8,
    courses: [
      { code: 'FBS3146', name: 'Struktur Data & Algoritma', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 1 },
      { code: 'FBS3147', name: 'Jaringan Komputer', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 2 },
      { code: 'FBS3148', name: 'Organisasi & Arsitektur Komputer', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 3 },
      { code: 'FBS3149', name: 'Sistem Basis Data', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 4 },
      { code: 'FBS3150', name: 'Pemrograman Web & Mobile', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 5 },
      { code: 'FBS3151', name: 'Praktikum Jaringan Komputer', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 6 },
      { code: 'FBS3152', name: 'Praktikum Basis Data', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 7 },
      { code: 'FBS3153', name: 'Kecerdasan Buatan', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 8 },
    ],
  },

  // SEMESTER 5 — ELKOM LEGACY TELEKOMUNIKASI (20 SKS)
  {
    id: 'pkg-2022-s5-elkom-tel',
    legacy_id: 'PKG_2022_ELKOM_TEL_S5',
    name: 'Paket Semester 5 — Elkom (Legacy Telekomunikasi)',
    curriculum_year: 2022,
    semester: 5,
    kbk_code: 'ELKOM_TEL',
    kbk_name: 'Elektronika Digital dan Telekomunikasi',
    badge_label: 'Legacy Telekomunikasi',
    total_sks: 20,
    course_count: 8,
    courses: [
      { code: 'FBS3154', name: 'Sistem Komunikasi Digital', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 1 },
      { code: 'FBS3155', name: 'Antena dan Propagasi Gelombang', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 2 },
      { code: 'FBS3156', name: 'Saluran Transmisi Telekomunikasi', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 3 },
      { code: 'FBS3157', name: 'Pengolahan Sinyal Digital', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 4 },
      { code: 'FBS3158', name: 'Elektronika Telekomunikasi', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 5 },
      { code: 'FBS3159', name: 'Praktikum Sistem Telekomunikasi', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 6 },
      { code: 'FBS3160', name: 'Komunikasi Optik Dasar', sks: 2, semester: 5, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 7 },
      { code: 'FBS3161', name: 'Jaringan Telekomunikasi', sks: 2, semester: 5, category: 'Pilihan', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 8 },
    ],
  },

  // SEMESTER 5 — ELKOM LEGACY ELEKTRONIKA (15 SKS)
  {
    id: 'pkg-2022-s5-elkom-el',
    legacy_id: 'PKG_2022_ELKOM_EL_S5',
    name: 'Paket Semester 5 — Elkom (Legacy Elektronika)',
    curriculum_year: 2022,
    semester: 5,
    kbk_code: 'ELKOM_EL',
    kbk_name: 'Elektronika Digital dan Telekomunikasi',
    badge_label: 'Legacy Elektronika',
    total_sks: 15,
    course_count: 6,
    courses: [
      { code: 'FBS3162', name: 'Perancangan Rangkaian Terpadu (VLSI)', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 1 },
      { code: 'FBS3163', name: 'Elektronika Industri & Sensor', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 2 },
      { code: 'FBS3164', name: 'Sistem Kontrol Analog & Digital', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 3 },
      { code: 'FBS3165', name: 'Mikroprosesor dan Mikrokontroler', sks: 3, semester: 5, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 4 },
      { code: 'FBS3166', name: 'Praktikum Elektronika Lanjut', sks: 1, semester: 5, category: 'Praktikum', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 5 },
      { code: 'FBS3167', name: 'Optoelektronika', sks: 2, semester: 5, category: 'Pilihan', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 6 },
    ],
  },

  // SEMESTER 6 — STL (21 SKS)
  {
    id: 'pkg-2022-s6-stl',
    legacy_id: 'PKG_2022_STL_S6',
    name: 'Paket Semester 6 — Sistem Tenaga Listrik',
    curriculum_year: 2022,
    semester: 6,
    kbk_code: 'STL',
    kbk_name: 'Sistem Tenaga Listrik',
    badge_label: 'Sistem Tenaga Listrik',
    total_sks: 21,
    course_count: 8,
    courses: [
      { code: 'FBS3246', name: 'Analisis Sistem Tenaga II', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 1 },
      { code: 'FBS3247', name: 'Operasi Sistem Tenaga Listrik', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 2 },
      { code: 'FBS3248', name: 'Perencanaan Sistem Tenaga', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 3 },
      { code: 'FBS3249', name: 'Dinamika Sistem Tenaga', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 4 },
      { code: 'FBS3250', name: 'Pemanfaatan Energi Listrik', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 5 },
      { code: 'FBS3251', name: 'Praktikum Tegangan Tinggi', sks: 1, semester: 6, category: 'Praktikum', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 6 },
      { code: 'FBS3252', name: 'Audit Energi Listrik', sks: 2, semester: 6, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 7 },
      { code: 'FBS3253', name: 'Energi Terbarukan', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 8 },
    ],
  },

  // SEMESTER 6 — KOMPUTER (21 SKS)
  {
    id: 'pkg-2022-s6-komputer',
    legacy_id: 'PKG_2022_KOMPUTER_S6',
    name: 'Paket Semester 6 — Komputer',
    curriculum_year: 2022,
    semester: 6,
    kbk_code: 'KOMPUTER',
    kbk_name: 'Komputer',
    badge_label: 'Komputer',
    total_sks: 21,
    course_count: 8,
    courses: [
      { code: 'FBS3254', name: 'Sistem Tertanam (Embedded Systems)', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 1 },
      { code: 'FBS3255', name: 'Keamanan Jaringan Komputer', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 2 },
      { code: 'FBS3256', name: 'Sistem Operasi Lanjut', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 3 },
      { code: 'FBS3257', name: 'Pengolahan Citra Digital', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 4 },
      { code: 'FBS3258', name: 'Internet of Things (IoT)', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 5 },
      { code: 'FBS3259', name: 'Praktikum Sistem Tertanam', sks: 1, semester: 6, category: 'Praktikum', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 6 },
      { code: 'FBS3260', name: 'Rekayasa Perangkat Lunak', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 7 },
      { code: 'FBS3261', name: 'Komputasi Awan', sks: 2, semester: 6, category: 'Pilihan', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 8 },
    ],
  },

  // SEMESTER 6 — ELKOM LEGACY TELEKOMUNIKASI (14 SKS)
  {
    id: 'pkg-2022-s6-elkom-tel',
    legacy_id: 'PKG_2022_ELKOM_TEL_S6',
    name: 'Paket Semester 6 — Elkom (Legacy Telekomunikasi)',
    curriculum_year: 2022,
    semester: 6,
    kbk_code: 'ELKOM_TEL',
    kbk_name: 'Elektronika Digital dan Telekomunikasi',
    badge_label: 'Legacy Telekomunikasi',
    total_sks: 14,
    course_count: 5,
    courses: [
      { code: 'FBS3262', name: 'Komunikasi Bergerak dan Seluler', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 1 },
      { code: 'FBS3263', name: 'Sistem Komunikasi Serat Optik', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 2 },
      { code: 'FBS3264', name: 'Radar dan Navigasi', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 3 },
      { code: 'FBS3265', name: 'Praktikum Komunikasi Optik', sks: 1, semester: 6, category: 'Praktikum', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 4 },
      { code: 'FBS3266', name: 'Komunikasi Satelit', sks: 4, semester: 6, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 5 },
    ],
  },

  // SEMESTER 6 — ELKOM LEGACY ELEKTRONIKA (20 SKS)
  {
    id: 'pkg-2022-s6-elkom-el',
    legacy_id: 'PKG_2022_ELKOM_EL_S6',
    name: 'Paket Semester 6 — Elkom (Legacy Elektronika)',
    curriculum_year: 2022,
    semester: 6,
    kbk_code: 'ELKOM_EL',
    kbk_name: 'Elektronika Digital dan Telekomunikasi',
    badge_label: 'Legacy Elektronika',
    total_sks: 20,
    course_count: 7,
    courses: [
      { code: 'FBS3267', name: 'Robotika dan Otomasi', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 1 },
      { code: 'FBS3268', name: 'Elektronika Biomedika', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 2 },
      { code: 'FBS3269', name: 'Instrumentasi Cerdas', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 3 },
      { code: 'FBS3270', name: 'Pengolahan Sinyal Biomedis', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 4 },
      { code: 'FBS3271', name: 'Praktikum Robotika', sks: 1, semester: 6, category: 'Praktikum', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 5 },
      { code: 'FBS3272', name: 'Desain Sistem Digital FPGA', sks: 3, semester: 6, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 6 },
      { code: 'FBS3273', name: 'Sensor dan Transduser Lanjut', sks: 4, semester: 6, category: 'Pilihan', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 7 },
    ],
  },

  // SEMESTER 7 — STL (19 SKS)
  {
    id: 'pkg-2022-s7-stl',
    legacy_id: 'PKG_2022_STL_S7',
    name: 'Paket Semester 7 — Sistem Tenaga Listrik',
    curriculum_year: 2022,
    semester: 7,
    kbk_code: 'STL',
    kbk_name: 'Sistem Tenaga Listrik',
    badge_label: 'Sistem Tenaga Listrik',
    total_sks: 19,
    course_count: 7,
    courses: [
      { code: 'FBS4168', name: 'Metodologi Penelitian', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 1 },
      { code: 'FBS4169', name: 'Kerja Praktik', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 2 },
      { code: 'FBS4170', name: 'Perancangan Gardu Induk', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 3 },
      { code: 'FBS4171', name: 'Kendali Mesin Listrik', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 4 },
      { code: 'FBS4172', name: 'Stabilitas Tegangan Sistem Tenaga', sks: 3, semester: 7, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 5 },
      { code: 'FBS4173', name: 'Technopreneurship', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 6 },
      { code: 'FBS4174', name: 'Kapita Selekta Tenaga Listrik', sks: 3, semester: 7, category: 'Pilihan', kbk_code: 'STL', kbk_name: 'Sistem Tenaga Listrik', order: 7 },
    ],
  },

  // SEMESTER 7 — KOMPUTER (20 SKS)
  {
    id: 'pkg-2022-s7-komputer',
    legacy_id: 'PKG_2022_KOMPUTER_S7',
    name: 'Paket Semester 7 — Komputer',
    curriculum_year: 2022,
    semester: 7,
    kbk_code: 'KOMPUTER',
    kbk_name: 'Komputer',
    badge_label: 'Komputer',
    total_sks: 20,
    course_count: 7,
    courses: [
      { code: 'FBS4175', name: 'Metodologi Penelitian', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 1 },
      { code: 'FBS4176', name: 'Kerja Praktik', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 2 },
      { code: 'FBS4177', name: 'Visi Komputer & Pola', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 3 },
      { code: 'FBS4178', name: 'Sistem Terdistribusi', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 4 },
      { code: 'FBS4179', name: 'Data Mining & Analitik', sks: 4, semester: 7, category: 'Pilihan', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 5 },
      { code: 'FBS4180', name: 'Technopreneurship', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 6 },
      { code: 'FBS4181', name: 'Kapita Selekta Komputer', sks: 3, semester: 7, category: 'Pilihan', kbk_code: 'KOMPUTER', kbk_name: 'Komputer', order: 7 },
    ],
  },

  // SEMESTER 7 — ELKOM LEGACY TELEKOMUNIKASI (20 SKS)
  {
    id: 'pkg-2022-s7-elkom-tel',
    legacy_id: 'PKG_2022_ELKOM_TEL_S7',
    name: 'Paket Semester 7 — Elkom (Legacy Telekomunikasi)',
    curriculum_year: 2022,
    semester: 7,
    kbk_code: 'ELKOM_TEL',
    kbk_name: 'Elektronika Digital dan Telekomunikasi',
    badge_label: 'Legacy Telekomunikasi',
    total_sks: 20,
    course_count: 7,
    courses: [
      { code: 'FBS4182', name: 'Metodologi Penelitian', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 1 },
      { code: 'FBS4183', name: 'Kerja Praktik', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 2 },
      { code: 'FBS4184', name: 'Komunikasi Gelombang Mikro', sks: 4, semester: 7, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 3 },
      { code: 'FBS4185', name: 'Jaringan Nirkabel Lanjut', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 4 },
      { code: 'FBS4186', name: 'Komunikasi Akustik Bawah Air', sks: 3, semester: 7, category: 'Pilihan', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 5 },
      { code: 'FBS4187', name: 'Technopreneurship', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 6 },
      { code: 'FBS4188', name: 'Kapita Selekta Telekomunikasi', sks: 3, semester: 7, category: 'Pilihan', kbk_code: 'ELKOM_TEL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 7 },
    ],
  },

  // SEMESTER 7 — ELKOM LEGACY ELEKTRONIKA (16 SKS)
  {
    id: 'pkg-2022-s7-elkom-el',
    legacy_id: 'PKG_2022_ELKOM_EL_S7',
    name: 'Paket Semester 7 — Elkom (Legacy Elektronika)',
    curriculum_year: 2022,
    semester: 7,
    kbk_code: 'ELKOM_EL',
    kbk_name: 'Elektronika Digital dan Telekomunikasi',
    badge_label: 'Legacy Elektronika',
    total_sks: 16,
    course_count: 6,
    courses: [
      { code: 'FBS4189', name: 'Metodologi Penelitian', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 1 },
      { code: 'FBS4190', name: 'Kerja Praktik', sks: 2, semester: 7, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 2 },
      { code: 'FBS4191', name: 'Sistem Kendali Cerdas', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 3 },
      { code: 'FBS4192', name: 'Sistem Embedded Real-Time', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 4 },
      { code: 'FBS4193', name: 'Technopreneurship', sks: 3, semester: 7, category: 'Wajib', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 5 },
      { code: 'FBS4194', name: 'Kapita Selekta Elektronika', sks: 3, semester: 7, category: 'Pilihan', kbk_code: 'ELKOM_EL', kbk_name: 'Elektronika Digital dan Telekomunikasi', order: 6 },
    ],
  },

  // SEMESTER 8 — TUGAS AKHIR 2022 (8 SKS)
  {
    id: 'pkg-2022-s8-umum',
    legacy_id: 'PKG_2022_UMUM_S8',
    name: 'Paket Semester 8 — Tugas Akhir & Kelulusan',
    curriculum_year: 2022,
    semester: 8,
    kbk_code: 'DASAR',
    kbk_name: 'Tugas Akhir',
    badge_label: 'Tugas Akhir & Kelulusan',
    total_sks: 8,
    course_count: 3,
    courses: [
      { code: 'FBS4295', name: 'Seminar Proposal Skripsi', sks: 2, semester: 8, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 1 },
      { code: 'FBS4296', name: 'Skripsi / Tugas Akhir', sks: 4, semester: 8, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 2 },
      { code: 'FBS4297', name: 'Kuliah Kerja Nyata (KKN)', sks: 2, semester: 8, category: 'Wajib', kbk_code: 'DASAR', kbk_name: 'Umum', order: 3 },
    ],
  },
];
