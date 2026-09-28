import React from 'react';
import { Download, FileText, Printer, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';

export const StudentDownloadSchedule: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Unduh Jadwal Kuliah"
        subtitle="Unduh dan cetak jadwal perkuliahan semester aktif"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white rounded-xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-800">Jadwal Kuliah Saya (PDF)</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Jadwal perkuliahan pribadi berdasarkan penempatan kelas tetap Anda di semester aktif.
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Cetak / Simpan PDF
          </button>
        </div>

        <div className="p-6 bg-white rounded-xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-800">Jadwal Umum Jurusan (PDF)</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Seluruh jadwal perkuliahan resmi Jurusan Teknik Elektro Fakultas Teknik Universitas Mataram.
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-400" />
            Unduh Jadwal Jurusan
          </button>
        </div>
      </div>
    </div>
  );
};
