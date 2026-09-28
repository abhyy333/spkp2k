import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { UnramLogo } from '../../components/shared/UnramLogo';

export const ForgotPasswordPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-3 drop-shadow-sm">
              <UnramLogo size={56} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              Reset Kata Sandi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              SPK Penjadwalan Perkuliahan — JTE UNRAM
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-3 mb-6">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <p className="font-semibold mb-1 text-xs">Akun Dikelola Administrator</p>
              <p className="text-2xs text-blue-800">
                Silakan hubungi Administrator Jurusan Teknik Elektro untuk melakukan reset kata sandi akun Anda.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col items-center gap-2.5">
            <Link
              to="/login"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </div>

        <p className="text-center text-2xs text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} Jurusan Teknik Elektro Fakultas Teknik Universitas Mataram
        </p>
      </div>
    </div>
  );
};

