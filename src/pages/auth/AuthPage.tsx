import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link, Navigate } from 'react-router-dom';
import {
  LogIn,
  UserPlus,
  Lock,
  Mail,
  User,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Database,
  Loader2,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UnramLogo } from '../../components/shared/UnramLogo';
import { isSupabaseConfigured } from '../../lib/supabase';
import { SupabaseConfigModal } from '../../components/ui/SupabaseConfigModal';
import { toast } from '../../components/ui/Toast';
import { AppLoader } from '../../components/ui/AppLoader';

interface AuthPageProps {
  defaultTab?: 'login' | 'register';
}

export const AuthPage: React.FC<AuthPageProps> = ({ defaultTab = 'login' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { signIn, signUp, authStatus, effectiveAccessMode } = useAuth();

  // Determine active tab from prop, query parameter, or pathname
  const initialTab =
    location.pathname === '/register' || searchParams.get('tab') === 'register'
      ? 'register'
      : defaultTab;

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  // Sign In Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up Form States
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  // Status & Feedback States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Sync tab with URL if pathname changes
  useEffect(() => {
    if (location.pathname === '/register') {
      setActiveTab('register');
    } else if (location.pathname === '/login') {
      setActiveTab('login');
    }
  }, [location.pathname]);

  // 1. MUST WAIT FOR AUTH STATUS INITIALIZATION
  if (authStatus === 'INITIALIZING') {
    return <AppLoader />;
  }

  // 2. If already authenticated and NOT previewing as Guest, redirect to Dashboard
  if (authStatus === 'AUTHENTICATED' && effectiveAccessMode !== 'GUEST') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleTabChange = (tab: 'login' | 'register') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setActiveTab(tab);
    setSearchParams(tab === 'register' ? { tab: 'register' } : {});
  };

  // Sign In Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

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
      const res = await signIn(loginEmail, loginPassword);
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

  // Sign Up Handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isSupabaseConfigured()) {
      setErrorMsg(
        'Koneksi database belum dikonfigurasi. Tambahkan Supabase URL dan Publishable Key.'
      );
      setShowConfigModal(true);
      return;
    }

    const cleanName = registerName.trim();
    const cleanEmail = registerEmail.trim().toLowerCase();

    if (!cleanName) {
      setErrorMsg('Nama lengkap wajib diisi.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Silakan masukkan alamat email yang valid.');
      return;
    }

    if (registerPassword.length < 8) {
      setErrorMsg('Kata sandi minimal harus 8 karakter.');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok. Harap periksa kembali.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await signUp(cleanEmail, registerPassword, cleanName);

      if (res.error) {
        setErrorMsg(res.error);
        setSubmitting(false);
        return;
      }

      if (res.isConfirmationRequired) {
        setSuccessMsg(
          'Pendaftaran berhasil. Silakan periksa email Anda untuk mengonfirmasi akun.'
        );
        setRegisterPassword('');
        setRegisterConfirmPassword('');
      } else {
        toast.success('Pendaftaran akun berhasil!');
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat proses pendaftaran.');
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
        {/* Brand Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl p-6 sm:p-8">
          {/* Logo and Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-3 drop-shadow-sm">
              <UnramLogo size={52} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              SPK Penjadwalan Perkuliahan
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Jurusan Teknik Elektro — Universitas Mataram
            </p>
          </div>

          {/* Tab Switcher: Masuk / Daftar */}
          <div className="flex items-center p-1 bg-slate-100/80 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Masuk
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Daftar
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed font-medium">{successMsg}</div>
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
                  className="text-blue-600 hover:underline font-medium"
                >
                  Konfigurasi
                </button>
              </div>
              <p className="text-2xs text-amber-700 leading-normal">
                Tambahkan Supabase URL dan Publishable Key agar autentikasi dapat berfungsi.
              </p>
            </div>
          )}

          {/* TAB 1: FORM MASUK (LOGIN) */}
          {activeTab === 'login' && (
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
                  <Link
                    to="/forgot-password"
                    className="text-2xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    Lupa kata sandi?
                  </Link>
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
          )}

          {/* TAB 2: FORM DAFTAR (SIGN UP) */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-blue-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-2xs">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Registrasi Terotorisasi (Dosen & Admin)</span>
                </div>
                <p className="text-3xs text-blue-800 leading-relaxed">
                  Pendaftaran akun hanya diperuntukkan bagi Dosen dan Administrator yang telah diotorisasi oleh Pengelola Jurusan. Publik dan mahasiswa dapat langsung melihat jadwal tanpa memerlukan akun.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nama Lengkap Beserta Gelar"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Email Resmi *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="email.resmi@unram.ac.id"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 transition-colors"
                  />
                </div>
                <p className="text-3xs text-slate-400 mt-1">
                  Email harus cocok dengan email yang telah didaftarkan di Manajemen Akun Jurusan.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Sandi *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Minimal 8 karakter"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showRegisterPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Konfirmasi Kata Sandi *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showRegisterConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Ulangi kata sandi"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-800 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showRegisterConfirmPassword ? (
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
                      Memverifikasi Otorisasi...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Daftar Akun Terotorisasi
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer link to public schedule */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/jadwal-perkuliahan')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Lihat Jadwal Kuliah (Tanpa Akun)
            </button>
          </div>
        </div>

        {/* Bottom copyright */}
        <p className="text-center text-2xs text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} Jurusan Teknik Elektro Fakultas Teknik Universitas Mataram
        </p>
      </div>

      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
};
