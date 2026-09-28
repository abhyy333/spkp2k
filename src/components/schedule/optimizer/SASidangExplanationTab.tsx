import React from 'react';
import { BookOpen, Award, CheckCircle2, ChevronRight, Hash } from 'lucide-react';

export const SASidangExplanationTab: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="space-y-6 text-xs text-slate-700 leading-relaxed">
      {/* Header Banner */}
      <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <Award className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-blue-950">
            Panduan Pembahasan &amp; Pertanggungjawaban Sidang Skripsi/SPK
          </h4>
          <p className="text-2xs text-blue-800">
            Dokumentasi ilmiah perancangan algoritma Simulated Annealing pada Sistem Pendukung Keputusan Penjadwalan Perkuliahan Jurusan Teknik Elektro Universitas Mataram.
          </p>
        </div>
      </div>

      {/* 1. Latar Belakang & Filosofi Algoritma */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          1. Filosofi &amp; Konsep Dasar Simulated Annealing
        </h5>
        <p>
          Simulated Annealing (SA) pertama kali diperkenalkan oleh Kirkpatrick et al. (1983). Algoritma ini terinspirasi dari proses metalurgi pendinginan logam cair (<em>annealing</em>) hingga membentuk struktur kristal berkondisi energi terendah (<em>ground state</em>).
        </p>
        <p>
          Dalam konteks penjadwalan perkuliahan yang berstatus <strong>NP-Hard Combinatorial Problem</strong>, pencarian eksak (exhaustive search) tidak efisien. SA mampu menghindari jebakan <em>Local Optima</em> dengan menerima solusi lebih buruk secara probabilistik saat suhu masih tinggi, lalu secara berangsur menjadi lebih selektif saat suhu mendingin.
        </p>
      </div>

      {/* 2. Formulasi Matematis Fungsi Objektif */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5 text-purple-600" />
          2. Formulasi Matematis Fungsi Biaya / Objektif (Cost Function)
        </h5>
        <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-2xs overflow-x-auto">
          {`Minimalkan: Cost(S) = Σ (W_hard × V_hard(S)) + Σ (W_soft × V_soft(S))`}
        </div>
        <div className="space-y-1.5 text-2xs">
          <p><strong>Batasan Keras (Hard Constraints — Penalti 1000 pts):</strong></p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Room Overlap:</strong> Satu ruangan tidak boleh dialokasikan ke lebih dari 1 kelas pada waktu yang bertabrakan.</li>
            <li><strong>Lecturer Overlap:</strong> Dosen pengampu tidak boleh mengajar 2 kelas berbeda pada jam yang sama.</li>
            <li><strong>Room Capacity:</strong> Jumlah peserta (<code className="bg-slate-100 px-1 py-0.5 rounded">expected_students</code>) tidak boleh melebihi kapasitas ruangan (<code className="bg-slate-100 px-1 py-0.5 rounded">rooms.capacity</code>).</li>
            <li><strong>Room Type:</strong> Tipe ruangan (<code className="bg-slate-100 px-1 py-0.5 rounded">required_room_type</code>) harus sesuai dengan tipe ruangan sebenarnya (contoh: Lab Komputer).</li>
            <li><strong>Consecutive Slots:</strong> SKS mata kuliah harus menempati slot waktu aktif yang berurutan secara kontinu.</li>
            <li><strong>Lecturer Unavailability:</strong> Dosen tidak boleh dijadwalkan pada waktu <code className="bg-slate-100 px-1 py-0.5 rounded">is_available === false</code>.</li>
          </ul>

          <p className="pt-2"><strong>Batasan Lunak (Soft Constraints — Penalti 10 – 60 pts):</strong></p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Preferensi Dosen:</strong> Menghindari waktu yang ditandai <code className="bg-slate-100 px-1 py-0.5 rounded">preference === 'avoid'</code>.</li>
            <li><strong>Waktu Shalat Jumat:</strong> Menghindari perkuliahan hari Jumat pukul 11:30 – 13:00.</li>
            <li><strong>Beban Mengajar Harian:</strong> Membatasi maksimal 3 sesi kelas per dosen per hari.</li>
            <li><strong>Tabrakan Semester Sama:</strong> Meminimalkan bentrok mata kuliah pada kurikulum/semester angkatan yang sama.</li>
          </ul>
        </div>
      </div>

      {/* 3. Kriteria Penerimaan Metropolis & Pendinginan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />
          3. Kriteria Penerimaan Metropolis &amp; Skema Pendinginan
        </h5>
        <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-2xs space-y-1">
          <div>{`ΔE = Cost(S_neighbor) - Cost(S_current)`}</div>
          <div>{`P(Accept) = 1.0                     jika ΔE ≤ 0 (Solusi lebih baik)`}</div>
          <div>{`P(Accept) = exp(-ΔE / T)            jika ΔE > 0 (Solusi lebih buruk)`}</div>
          <div className="pt-1 text-amber-300">{`Pendinginan Geometrik: T_{k+1} = α · T_k  (dengan 0.85 ≤ α < 1.0)`}</div>
        </div>
        <p className="text-2xs text-slate-600">
          Saat suhu awal (<span className="italic font-serif">T₀</span>) tinggi, probabilitas <span className="font-mono">P(Accept)</span> mendekati 1, memungkinkan algoritma mengeksplorasi ruang solusi secara luas. Seiring iterasi bertambah dan suhu mendekati nol, <span className="font-mono">P(Accept)</span> mendekati 0, mengunci algoritma pada solusi global optimal.
        </p>
      </div>

      {/* 4. Operator Ketetanggaan (Neighborhood Moves) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          4. Operator Ketetanggaan (Neighborhood Structure)
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-2xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800 block">MOVE_TIME (40%)</span>
            Memindahkan satu kelas ke hari dan slot waktu lain yang valid.
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800 block">MOVE_ROOM (25%)</span>
            Mengganti alokasi ruangan dengan ruangan lain yang memenuhi tipe &amp; kapasitas.
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800 block">MOVE_TIME_ROOM (25%)</span>
            Memindahkan waktu dan ruangan secara simultan.
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800 block">SWAP_TIME (10%)</span>
            Menukar slot waktu antara dua kelas yang kompatibel.
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
        >
          Kembali ke Tampilan Hasil
        </button>
      </div>
    </div>
  );
};
