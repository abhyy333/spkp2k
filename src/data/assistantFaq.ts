export interface FaqItem {
  id: string;
  category: 'PUBLIC' | 'DOSEN' | 'ADMIN';
  question: string;
  answer: string;
  keywords: string[];
  suggestedCta?: {
    label: string;
    action: string;
    path?: string;
  };
}

export const ASSISTANT_FAQ_DATA: FaqItem[] = [
  // ==========================================
  // PUBLIC / MAHASISWA FAQ (Minimal 10 Items)
  // ==========================================
  {
    id: 'faq-pub-1',
    category: 'PUBLIC',
    question: 'Bagaimana melihat Jadwal Perkuliahan?',
    answer:
      'Anda dapat melihat Jadwal Perkuliahan Resmi Jurusan Teknik Elektro langsung pada halaman utama "Jadwal Perkuliahan" tanpa perlu membuat akun atau masuk. Gunakan filter Hari, Semester, Kelas, atau Ruangan untuk mempersempit pencarian.',
    keywords: ['lihat', 'jadwal', 'perkuliahan', 'matakuliah', 'kuliah', 'public', 'mahasiswa'],
    suggestedCta: {
      label: 'Buka Jadwal Perkuliahan',
      action: 'NAVIGATE',
      path: '/jadwal-perkuliahan',
    },
  },
  {
    id: 'faq-pub-2',
    category: 'PUBLIC',
    question: 'Bagaimana melihat Jadwal Ujian?',
    answer:
      'Jadwal Ujian Tengah Semester (UTS) dan Ujian Akhir Semester (UAS) dapat diakses publik melalui menu "Jadwal Ujian" di bilah navigasi atas. Anda dapat memfilter berdasarkan jenis ujian (UTS/UAS) dan hari pelaksanaan.',
    keywords: ['uts', 'uas', 'ujian', 'jadwal ujian', 'tentamen'],
    suggestedCta: {
      label: 'Buka Jadwal Ujian',
      action: 'NAVIGATE',
      path: '/jadwal-ujian',
    },
  },
  {
    id: 'faq-pub-3',
    category: 'PUBLIC',
    question: 'Apa itu Atur Jadwal Saya?',
    answer:
      'Atur Jadwal Saya adalah fitur personalisasi bagi mahasiswa untuk memilih kelas mata kuliah yang diambil semester ini. Sistem akan menyusun jadwal pribadi Anda dalam tampilan tabel dan matriks mingguan serta mendeteksi jika ada jadwal yang bentrok.',
    keywords: ['atur', 'jadwal saya', 'krs', 'pilihan', 'personalisasi'],
    suggestedCta: {
      label: 'Atur Jadwal Saya',
      action: 'NAVIGATE',
      path: '/jadwal-saya',
    },
  },
  {
    id: 'faq-pub-4',
    category: 'PUBLIC',
    question: 'Apakah Jadwal Saya tersimpan di database?',
    answer:
      'Tidak. Pilihan Jadwal Saya disimpan secara lokal pada browser perangkat Anda (localStorage). Aplikasi tidak menyimpan identitas atau Pilihan Jadwal Saya mahasiswa ke database server demi menjaga privasi.',
    keywords: ['tersimpan', 'database', 'privasi', 'localstorage', 'hilang'],
  },
  {
    id: 'faq-pub-5',
    category: 'PUBLIC',
    question: 'Kenapa Jadwal Saya hilang di perangkat lain?',
    answer:
      'Karena pilihan Jadwal Saya disimpan secara lokal di browser perangkat tempat Anda memilihnya. Jika Anda berpindah dari HP ke laptop, Anda dapat menyusun ulang atau melakukan Export file .ICS/Cetak PDF.',
    keywords: ['hilang', 'perangkat', 'pindah', 'hp', 'laptop', 'browser'],
  },
  {
    id: 'faq-pub-6',
    category: 'PUBLIC',
    question: 'Bagaimana memilih kelas A/B/C?',
    answer:
      'Buka menu "Atur Jadwal Saya", gunakan bilah pencarian atau filter semester, lalu centang kotak di sebelah kiri mata kuliah dan kelas (A/B/C) yang Anda ikuti.',
    keywords: ['pilih', 'kelas', 'paralel', 'A', 'B', 'C'],
    suggestedCta: {
      label: 'Pilih Kelas di Jadwal Saya',
      action: 'NAVIGATE',
      path: '/jadwal-saya',
    },
  },
  {
    id: 'faq-pub-7',
    category: 'PUBLIC',
    question: 'Bagaimana mengetahui jadwal bentrok?',
    answer:
      'Saat Anda memilih beberapa mata kuliah di "Atur Jadwal Saya", sistem secara otomatis memeriksa tumpang tindih waktu. Jika terjadi bentrok, sistem akan memberikan indikator peringatan merah serta detail mata kuliah yang bentrok.',
    keywords: ['bentrok', 'tabrakan', 'tumpang tindih', 'konflik', 'jadwal saya'],
  },
  {
    id: 'faq-pub-8',
    category: 'PUBLIC',
    question: 'Bagaimana export ke kalender?',
    answer:
      'Di halaman "Atur Jadwal Saya", setelah memilih kelas, klik tombol "Export Kalender (.ICS)". File .ICS yang diunduh dapat diimpor langsung ke Google Calendar, Apple Calendar, atau Outlook.',
    keywords: ['export', 'ics', 'google calendar', 'apple calendar', 'kalender'],
  },
  {
    id: 'faq-pub-9',
    category: 'PUBLIC',
    question: 'Bagaimana cetak Jadwal Saya?',
    answer:
      'Pada halaman "Jadwal Perkuliahan" atau "Atur Jadwal Saya", Anda dapat mengklik tombol "Unduh PDF" untuk mengunduh dokumen resmi atau tombol "Cetak" untuk mencetak langsung melalui printer browser.',
    keywords: ['cetak', 'print', 'pdf', 'download', 'unduh'],
  },
  {
    id: 'faq-pub-10',
    category: 'PUBLIC',
    question: 'Apa perbedaan Jadwal Resmi dan Jadwal Saya?',
    answer:
      'Jadwal Resmi adalah seluruh jadwal perkuliahan terbitan Jurusan Teknik Elektro UNRAM untuk semua semester. Jadwal Saya adalah ringkasan khusus mata kuliah pilihan Anda sendiri.',
    keywords: ['beda', 'perbedaan', 'resmi', 'jadwal saya'],
  },

  // ==========================================
  // DOSEN FAQ (Minimal 9 Items)
  // ==========================================
  {
    id: 'faq-dos-1',
    category: 'DOSEN',
    question: 'Bagaimana melihat Jadwal Saya?',
    answer:
      'Setelah masuk sebagai Dosen, buka menu "Jadwal Saya" di navigasi samping. Sistem otomatis menampilkan seluruh jadwal mengajar Anda di semester aktif ini dalam tampilan Tabel dan Matriks.',
    keywords: ['jadwal dosen', 'mengajar', 'jadwal saya', 'dosen'],
    suggestedCta: {
      label: 'Buka Jadwal Dosen',
      action: 'NAVIGATE',
      path: '/jadwal-saya',
    },
  },
  {
    id: 'faq-dos-2',
    category: 'DOSEN',
    question: 'Dari mana Jadwal Saya Dosen berasal?',
    answer:
      'Jadwal Dosen bersumber dari Jadwal Perkuliahan Resmi yang diterbitkan oleh Administrator Jurusan Teknik Elektro berdasarkan SK Pengajaran semester berjalan.',
    keywords: ['sumber', 'asal', 'penetapan', 'sk pengajaran'],
  },
  {
    id: 'faq-dos-3',
    category: 'DOSEN',
    question: 'Bagaimana melihat jadwal ujian?',
    answer:
      'Buka menu "Jadwal Ujian" di navigasi. Tampilan akan memuat jadwal pengawasan UTS dan UAS sesuai mata kuliah yang Anda ampu.',
    keywords: ['jadwal ujian', 'uts', 'uas', 'pengawas', 'mengawas'],
    suggestedCta: {
      label: 'Buka Jadwal Ujian',
      action: 'NAVIGATE',
      path: '/jadwal-ujian',
    },
  },
  {
    id: 'faq-dos-4',
    category: 'DOSEN',
    question: 'Bagaimana mengetahui jadwal mengajar hari ini?',
    answer:
      'Di halaman "Dashboard Dosen" atau "Jadwal Saya", sistem akan memberikan ringkasan kelas yang Anda ampu pada hari berjalan.',
    keywords: ['hari ini', 'mengajar hari ini', 'kelas hari ini'],
  },
  {
    id: 'faq-dos-5',
    category: 'DOSEN',
    question: 'Mengapa mata kuliah tertentu tidak muncul?',
    answer:
      'Mata kuliah mungkin belum diterbitkan oleh Admin, belum ditugaskan ke NIP Anda pada tim pengampu, atau penawaran kelas dibatalkan. Kontak Administrator Jurusan untuk verifikasi.',
    keywords: ['tidak muncul', 'hilang', 'belum ada', 'tim pengampu'],
  },
  {
    id: 'faq-dos-6',
    category: 'DOSEN',
    question: 'Bagaimana melihat ruangan kuliah?',
    answer:
      'Detail kode dan nama ruangan (seperti Ruang I, Ruang D2, Lab) tercantum langsung pada setiap kartu jadwal mengajar Anda di tabel dan matriks.',
    keywords: ['ruangan', 'ruang kuliah', 'lokasi', 'lab'],
  },
  {
    id: 'faq-dos-7',
    category: 'DOSEN',
    question: 'Bagaimana melihat jadwal pengawasan ujian?',
    answer:
      'Akses menu "Jadwal Ujian". Pengawasan ujian disusun sesuai mata kuliah penugasan Anda.',
    keywords: ['pengawasan', 'pengawas', 'ujian'],
  },
  {
    id: 'faq-dos-8',
    category: 'DOSEN',
    question: 'Bagaimana mengganti kata sandi?',
    answer:
      'Akun Dosen dikelola oleh Administrator Jurusan. Silakan hubungi Admin Jurusan Teknik Elektro untuk melakukan reset atau pembaruan kata sandi.',
    keywords: ['ganti kata sandi', 'reset password', 'ubah password'],
  },
  {
    id: 'faq-dos-9',
    category: 'DOSEN',
    question: 'Apa yang dilakukan jika akun bermasalah?',
    answer:
      'Silakan hubungi Administrator Sistem Jurusan Teknik Elektro FT UNRAM untuk penanganan otorisasi dan pemulihan akun.',
    keywords: ['akun bermasalah', 'error login', 'lupa password'],
  },

  // ==========================================
  // ADMIN FAQ (Minimal 16 Items)
  // ==========================================
  {
    id: 'faq-adm-1',
    category: 'ADMIN',
    question: 'Bagaimana alur Penyusunan Jadwal?',
    answer:
      'Alur Penyusunan Jadwal: (1) Buat Draf Revisi dari semester aktif, (2) Tetapkan Penawaran Kelas & Dosen, (3) Jalankan Optimasi Otomatis (Simulated Annealing) atau Penyusunan Otomatis, (4) Periksa & Selesaikan Konflik, (5) Publikasikan sebagai Jadwal Resmi.',
    keywords: ['alur', 'penyusunan jadwal', 'tahapan', 'workflow'],
    suggestedCta: {
      label: 'Buka Penyusunan Jadwal',
      action: 'NAVIGATE',
      path: '/penyusunan-jadwal',
    },
  },
  {
    id: 'faq-adm-2',
    category: 'ADMIN',
    question: 'Apa itu Draft?',
    answer:
      'Draft adalah versi draf kerja jadwal yang sedang disusun atau diuji oleh Admin. Perubahan pada Draft tidak terlihat oleh Publik/Mahasiswa sampai Admin secara eksplisit mempublikasikannya.',
    keywords: ['draft', 'draf', 'draf kerja', 'versi'],
  },
  {
    id: 'faq-adm-3',
    category: 'ADMIN',
    question: 'Apa itu Jadwal Resmi?',
    answer:
      'Jadwal Resmi (Published Schedule) adalah versi jadwal aktif yang dipublikasikan dan dapat diakses oleh seluruh publik, mahasiswa, dan dosen.',
    keywords: ['jadwal resmi', 'published', 'publikasi'],
  },
  {
    id: 'faq-adm-4',
    category: 'ADMIN',
    question: 'Apa itu Simulated Annealing?',
    answer:
      'Simulated Annealing (SA) adalah algoritma metaheuristik probabilistik yang digunakan SPK untuk mengoptimalkan alokasi slot waktu dan ruangan secara otomatis, meminimalkan bentrok dosen, ruangan, dan preferensi waktu.',
    keywords: ['simulated annealing', 'sa', 'algoritma', 'optimasi'],
    suggestedCta: {
      label: 'Buka Evaluasi SA',
      action: 'NAVIGATE',
      path: '/evaluasi-sa',
    },
  },
  {
    id: 'faq-adm-5',
    category: 'ADMIN',
    question: 'Apa itu hard constraint?',
    answer:
      'Hard constraint adalah aturan wajib yang TIDAK BOLEH dilanggar sama sekali. Contoh: Dosen mengajar dua kelas bersamaan di jam yang sama, atau dua kelas memakai satu ruangan di jam yang sama.',
    keywords: ['hard constraint', 'aturan wajib', 'bentrok mutlak'],
  },
  {
    id: 'faq-adm-6',
    category: 'ADMIN',
    question: 'Apa itu soft constraint?',
    answer:
      'Soft constraint adalah aturan preferensi fleksibel yang diusahakan terpenuhi. Contoh: Menghindari jam mengajar di atas jam 16:00, atau meratakan distribusi jam mengajar dosen.',
    keywords: ['soft constraint', 'preferensi', 'fleksibel'],
  },
  {
    id: 'faq-adm-7',
    category: 'ADMIN',
    question: 'Apa itu Smart Rescheduling?',
    answer:
      'Smart Rescheduling adalah fitur rekomendasi berbasis AI/heuristic yang menganalisis slot waktu dan ruangan kosong yang feasible saat Admin ingin memindahkan jadwal suatu mata kuliah tanpa menimbulkan bentrok baru.',
    keywords: ['smart rescheduling', 'reschedule', 'pindah jadwal', 'rekomendasi'],
  },
  {
    id: 'faq-adm-8',
    category: 'ADMIN',
    question: 'Bagaimana menangani konflik?',
    answer:
      'Buka menu "Konflik Jadwal". Sistem akan mencantumkan jenis bentrok (Dosen/Ruangan/Slot) dan menawarkan opsi resolusi otomatis atau Smart Rescheduling.',
    keywords: ['konflik', 'menangani konflik', 'resolusi bentrok'],
    suggestedCta: {
      label: 'Buka Konflik Jadwal',
      action: 'NAVIGATE',
      path: '/konflik-jadwal',
    },
  },
  {
    id: 'faq-adm-9',
    category: 'ADMIN',
    question: 'Kenapa jadwal belum bisa diterbitkan?',
    answer:
      'Jadwal belum bisa diterbitkan jika: (1) Masih ada kelas yang belum terjadwal (unscheduled), (2) Masih terdapat hard conflict yang tersisa pada draf, atau (3) Status draf belum tervalidasi lengkap.',
    keywords: ['belum bisa diterbitkan', 'gagal publish', 'syarat publish'],
  },
  {
    id: 'faq-adm-10',
    category: 'ADMIN',
    question: 'Apa arti kelas belum terjadwal?',
    answer:
      'Kelas belum terjadwal (unscheduled class) adalah penawaran mata kuliah yang belum mendapatkan alokasi slot hari, jam, dan ruangan pada draf jadwal.',
    keywords: ['belum terjadwal', 'unscheduled', 'penawaran'],
  },
  {
    id: 'faq-adm-11',
    category: 'ADMIN',
    question: 'Bagaimana membuat revisi jadwal?',
    answer:
      'Di halaman "Penyusunan Jadwal" atau "Riwayat Versi", pilih jadwal resmi aktif lalu klik "Buat Revisi Draf". Lakukan penyesuaian lalu publikasikan kembali.',
    keywords: ['revisi', 'revisi jadwal', 'draf revisi'],
  },
  {
    id: 'faq-adm-12',
    category: 'ADMIN',
    question: 'Apa bedanya Tarik Jadwal dan Hapus Riwayat?',
    answer:
      'Tarik Jadwal (Withdraw) mengubah status jadwal resmi kembali menjadi tidak terbit sehingga publik tidak dapat melihatnya. Hapus Riwayat menghapus rekaman versi draf tertentu dari database.',
    keywords: ['tarik jadwal', 'withdraw', 'hapus riwayat', 'hapus versi'],
  },
  {
    id: 'faq-adm-13',
    category: 'ADMIN',
    question: 'Bagaimana jadwal UTS/UAS dibuat?',
    answer:
      'Jadwal Ujian disimulasikan dan dibuat pada modul "Jadwal Ujian" berdasarkan slot tanggal ujian, alokasi ruangan ujian, dan ketersediaan pengawas.',
    keywords: ['uts', 'uas', 'jadwal ujian', 'buat ujian'],
    suggestedCta: {
      label: 'Buka Kelola Ujian',
      action: 'NAVIGATE',
      path: '/jadwal-ujian',
    },
  },
  {
    id: 'faq-adm-14',
    category: 'ADMIN',
    question: 'Bagaimana MK Pilihan dibuka?',
    answer:
      'Mata Kuliah Pilihan dimasukkan ke dalam Penawaran Kelas di modul "Penyusunan Jadwal" jika kriteria peminat mahasiswa terpenuhi.',
    keywords: ['mk pilihan', 'mata kuliah pilihan', 'buka mk'],
  },
  {
    id: 'faq-adm-15',
    category: 'ADMIN',
    question: 'Mengapa MK Pilihan membutuhkan minimal 10 mahasiswa?',
    answer:
      'Aturan rasio efisiensi pengajaran Jurusan Teknik Elektro menetapkan batas minimal 10 mahasiswa peserta agar penawaran kelas MK Pilihan dapat dijalankan secara reguler.',
    keywords: ['kuota minimal', '10 mahasiswa', 'rasio'],
  },
  {
    id: 'faq-adm-16',
    category: 'ADMIN',
    question: 'Mengapa KKN/PKL/Praktikum tidak masuk jadwal reguler?',
    answer:
      'KKN, PKL, dan Praktikum Lapangan dilaksanakan secara mandiri/blok di luar jam kuliah tatap muka reguler sehingga tidak dijadwalkan pada slot kelas mingguan.',
    keywords: ['kkn', 'pkl', 'praktikum', 'di luar jadwal'],
  },
];
