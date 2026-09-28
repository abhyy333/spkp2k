import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();

  const handleBackHome = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-4">
        <FileQuestion className="w-8 h-8" />
      </div>
      <span className="text-xs font-bold tracking-wider text-slate-500 uppercase bg-slate-100 border border-slate-200 px-3 py-1 rounded-full mb-3">
        Error 404
      </span>
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Halaman Tidak Ditemukan</h1>
      <p className="text-slate-500 text-sm max-w-md mt-2 leading-relaxed">
        Halaman yang Anda tuju tidak ditemukan atau telah dipindahkan.
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
          Kembali ke Dashboard
        </button>
      </div>
    </div>
  );
};
