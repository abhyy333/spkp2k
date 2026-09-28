import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  LogIn,
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  Database,
  Loader2,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UnramLogo } from '../../components/shared/UnramLogo';
import { isSupabaseConfigured } from '../../lib/supabase';
import { SupabaseConfigModal } from '../../components/ui/SupabaseConfigModal';
import { toast } from '../../components/ui/Toast';
import { AppLoader } from '../../components/ui/AppLoader';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, authStatus, effectiveAccessMode } = useAuth();

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Modal & Info states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // 1. MUST WAIT FOR AUTH STATUS INITIALIZATION
  if (authStatus === 'INITIALIZING') {
    return <AppLoader />;
  }

  // 2. If already authenticated and NOT previewing as Guest, redirect to Dashboard
  if (authStatus === 'AUTHENTICATED' && effectiveAccessMode !== 'GUEST') {
    return <Navigate to="/dashboard" replace />;
  }

  // Sign In Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isSupabaseConfigured()) {
      setErrorMsg(
        'Koneksi database belum dikonfigurasi. Tambahkan Supabase URL dan Publishable Key.'
      );
      setShowConfigModal(true);
      return;
    }

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Silakan masukkan email dan kata sandi.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await signIn(loginEmail.trim().toLowerCase(), loginPassword);
      if (res.error) {
        setErrorMsg(res.error);
        setSubmitting(false);
        return;
      }

      if (res.role === 'ADMIN' || res.isOwner) {
        toast.success('Berhasil masuk sebagai Administrator.');
        navigate('/dashboard', { replace: true });
      } else {
        toast.success('Berhasil masuk sebagai Dosen.');
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat proses masuk.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Background subtle decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Main Auth Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl p-6 sm:p-8">
          {/* Logo and Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-3 drop-shadow-sm">
              <UnramLogo size={56} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              SPK Penjadwalan Perkuliahan
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Jurusan Teknik Elektro — Universitas Mataram
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Database connection missing alert */}
          {!isSupabaseConfigured() && (
            <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <div className="flex items-center justify-between mb-1 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-600" />
                  Koneksi Belum Terhubung
                </span>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(true)}
                  className="text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  Konfigurasi
                </button>
              </div>
              <p className="text-2xs text-amber-700 leading-normal">
                Tambahkan Supabase URL dan Publishable Key agar autentikasi dapat berfungsi.
              </p>
            </div>
          )}

          {/* FORM MASUK (LOGIN) */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="nama@unram.ac.id"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  className="text-2xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors cursor-pointer"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showLoginPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-xs transition-all disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Masuk
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Admin Managed Account Notice */}
          <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-2xs">
              Seluruh akun Administrator dan Dosen dikelola secara terpusat oleh Pengelola Jurusan.
            </p>
          </div>

          {/* Footer CTA link to public schedule */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col items-center">
            <button
              type="button"
              onClick={() => navigate('/jadwal-perkuliahan')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Lihat Jadwal Tanpa Akun
            </button>
          </div>
        </div>

        {/* Bottom copyright */}
        <p className="text-center text-2xs text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} Jurusan Teknik Elektro Fakultas Teknik Universitas Mataram
        </p>
      </div>

      {/* Forgot Password Information Dialog */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Info className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Lupa Kata Sandi
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Silakan hubungi Administrator Jurusan Teknik Elektro untuk melakukan reset kata sandi akun Anda.
              </p>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
};

