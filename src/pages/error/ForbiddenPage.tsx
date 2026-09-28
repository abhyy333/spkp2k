import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();

  const handleBackHome = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-xs">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <span className="text-xs font-bold tracking-wider text-rose-600 uppercase bg-rose-50 border border-rose-200 px-3 py-1 rounded-full mb-3">
        Error 403
      </span>
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Akses Ditolak</h1>
      <p className="text-slate-500 text-sm max-w-md mt-2 leading-relaxed">
        Anda tidak memiliki hak akses untuk membuka halaman ini. Hak akses dibatasi berdasarkan role akun Anda ({role || 'Pengguna'}).
      </p>

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>
        <button
          onClick={handleBackHome}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-xs"
        >
          <Home className="w-4 h-4" />
          Ke Dashboard Saya
        </button>
      </div>
    </div>
  );
};
