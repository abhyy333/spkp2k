import React, { useState } from 'react';
import {
  X,
  BookOpen,
  HelpCircle,
  Sparkles,
  Layers,
  Calendar,
  ShieldCheck,
  Zap,
  Mail,
  Phone,
  Building,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface AdminGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'GUIDE' | 'FAQ' | 'CONTACT';
}

export const AdminGuideModal: React.FC<AdminGuideModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'GUIDE',
}) => {
  const [activeTab, setActiveTab] = useState<'GUIDE' | 'FAQ' | 'CONTACT'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Pusat Bantuan & Panduan Sistem</h3>
              <p className="text-2xs text-slate-500">
                Dokumentasi operasional SPK Penjadwalan Perkuliahan Jurusan Teknik Elektro
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-4 pb-1 border-b border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('GUIDE')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'GUIDE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Panduan Penggunaan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FAQ')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'FAQ'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            FAQ & Solusi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CONTACT')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'CONTACT'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            <Phone className="w-3.5 h-3.5" />
            Hubungi Admin Utama
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-4 text-xs flex-1">
          {activeTab === 'GUIDE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
                <h4 className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Alur Penyusunan Jadwal Kuliah (Workflow 6 Tahap)
                </h4>
                <ol className="mt-2.5 space-y-2 text-2xs text-slate-700 leading-relaxed list-decimal list-inside">
                  <li><strong>Tahap 1 (Mata Kuliah):</strong> Pilih paket kurikulum (2026/2022) dan atur proyeksi jumlah mahasiswa.</li>
                  <li><strong>Tahap 2 (Rombel):</strong> Sistem mendistribusikan kapasitas rombongan belajar (Kelas A, B, dst) sesuai daya tampung ruang.</li>
                  <li><strong>Tahap 3 (Dosen):</strong> Tetapkan 1 Dosen Pengampu Utama untuk setiap offering kelas.</li>
                  <li><strong>Tahap 4 (Jadwal Awal):</strong> Generate penempatan awal ruang & waktu berbasis slot standar 50 menit.</li>
                  <li><strong>Tahap 5 (Simulated Annealing):</strong> Optimasi metaheuristik untuk mengeliminasi bentrok hingga 0.</li>
                  <li><strong>Tahap 6 (Publikasi Resmi):</strong> Pratinjau draf dan terbitkan jadwal resmi ke publik.</li>
                </ol>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Penyusunan Jadwal Ujian (UTS / UAS)
                </h4>
                <p className="text-2xs text-slate-600 leading-relaxed">
                  Jadwal ujian secara otomatis mensinkronkan seluruh kelas dari jadwal kuliah yang telah diterbitkan (PUBLISHED). Administrator hanya perlu memilih rentang tanggal ujian, durasi menit, dan menugaskan Pengawas 1 & 2.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'FAQ' && (
            <div className="space-y-3">
              {[
                {
                  q: 'Apa yang harus dilakukan jika hasil optimasi SA masih menyisakan bentrok?',
                  a: 'Gunakan preset "Optimal / Deep Search" (6,000 iterasi) atau ubah random seed pada Lab Eksperimen untuk memulai pencarian dari titik acak yang berbeda.',
                },
                {
                  q: 'Mengapa praktikum tidak muncul di jadwal perkuliahan reguler?',
                  a: 'Praktikum di Jurusan Teknik Elektro dikelola mandiri oleh masing-masing Laboratorium dan dijadwalkan terpisah di luar jadwal kuliah teori reguler.',
                },
                {
                  q: 'Bagaimana cara menambahkan akun Dosen baru?',
                  a: 'Buka menu "Manajemen Akun" -> Daftarkan email institusi Dosen (@unram.ac.id) dan tautkan dengan data Master Dosen yang sesuai.',
                },
              ].map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <h5 className="font-bold text-slate-900 text-xs">{item.q}</h5>
                  <p className="text-2xs text-slate-600 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'CONTACT' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs">Kontak Dukungan Tata Usaha & IT</h4>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-400" />
                    <span>Jurusan Teknik Elektro Fakultas Teknik Universitas Mataram</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>elektro@unram.ac.id</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>(0370) 636126 / Ext. 104</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
