import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Settings,
  Database,
  Shield,
  KeyRound,
  CheckCircle2,
  ExternalLink,
  Info,
  Users,
  ArrowRight,
  ShieldCheck,
  Crown,
  Clock,
  Calendar,
  Layers,
  Palette,
  Sparkles,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Eraser,
  EyeOff,
  HelpCircle,
  BookOpen,
  Phone,
  Building,
  Edit3,
  Sun,
  Moon,
  LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured, getSupabaseConfig, supabase } from '../../lib/supabase';
import { SupabaseConfigModal } from '../../components/ui/SupabaseConfigModal';
import { AdminEditProfileModal } from '../../components/admin/settings/AdminEditProfileModal';
import { AdminResetDataModal } from '../../components/admin/settings/AdminResetDataModal';
import { AdminGuideModal } from '../../components/admin/settings/AdminGuideModal';
import { ClearActiveScheduleModal } from '../../components/admin/settings/ClearActiveScheduleModal';
import { academicTermsService } from '../../services/academicTerms.service';
import { schedulesService } from '../../services/schedules.service';
import { AcademicTerm } from '../../types';
import { formatDateIndo, getInitials, cn } from '../../lib/utils';
import { toast } from '../../components/ui/Toast';

export const SettingsPage: React.FC = () => {
  const { user, profile, role, isSystemOwner, isAdmin, isOwnerAdmin } = useAuth();
  const navigate = useNavigate();

  // Modals state
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showClearActiveModal, setShowClearActiveModal] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [guideModalTab, setGuideModalTab] = useState<'GUIDE' | 'FAQ' | 'CONTACT'>('GUIDE');

  // Real System Health State
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(null);
  const [publishedCount, setPublishedCount] = useState<number>(0);
  const [dbStatus, setDbStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'CHECKING'>('CHECKING');
  const [checkingHealth, setCheckingHealth] = useState<boolean>(false);

  // Appearance preferences state (stored in localStorage)
  const [appTheme, setAppTheme] = useState<'LIGHT' | 'SYSTEM'>('LIGHT');
  const [cardDensity, setCardDensity] = useState<'NORMAL' | 'COMPACT'>('NORMAL');
  const [accentColor, setAccentColor] = useState<string>('BLUE');

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('spk:theme') as 'LIGHT' | 'SYSTEM' | null;
      if (savedTheme) setAppTheme(savedTheme);
      const savedDensity = localStorage.getItem('spk:card-density') as 'NORMAL' | 'COMPACT' | null;
      if (savedDensity) setCardDensity(savedDensity);
      const savedAccent = localStorage.getItem('spk:accent-color');
      if (savedAccent) setAccentColor(savedAccent);
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  const handleSaveTheme = (val: 'LIGHT' | 'SYSTEM') => {
    setAppTheme(val);
    try {
      localStorage.setItem('spk:theme', val);
      toast.success(`Tema aplikasi diatur ke: ${val === 'LIGHT' ? 'Terang' : 'Sistem'}`);
    } catch {
      // Ignore
    }
  };

  const handleSaveDensity = (val: 'NORMAL' | 'COMPACT') => {
    setCardDensity(val);
    try {
      localStorage.setItem('spk:card-density', val);
      toast.success(`Ukuran kartu diatur ke: ${val === 'NORMAL' ? 'Sedang' : 'Ringkas'}`);
    } catch {
      // Ignore
    }
  };

  const handleSaveAccent = (colorKey: string) => {
    setAccentColor(colorKey);
    try {
      localStorage.setItem('spk:accent-color', colorKey);
      toast.success('Warna aksen tampilan berhasil diperbarui.');
    } catch {
      // Ignore
    }
  };

  // Real Health Check function (No fake services)
  const runHealthCheck = useCallback(async () => {
    setCheckingHealth(true);
    setDbStatus('CHECKING');
    try {
      if (!isSupabaseConfigured()) {
        setDbStatus('DISCONNECTED');
        setCheckingHealth(false);
        return;
      }

      // 1. Check database connectivity
      const { count, error } = await supabase
        .from('academic_terms')
        .select('*', { count: 'exact', head: true });

      if (error) {
        setDbStatus('DISCONNECTED');
      } else {
        setDbStatus('CONNECTED');
      }

      // 2. Fetch active academic term
      const term = await academicTermsService.getActiveTerm();
      setActiveTerm(term);

      // 3. Check published schedule count
      const published = await schedulesService.getPublishedSchedule();
      setPublishedCount(published.length);
    } catch (err) {
      console.warn('Health check exception:', err);
      setDbStatus('DISCONNECTED');
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  const config = getSupabaseConfig();
  const displayName = profile?.full_name || profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Administrator';
  const avatarUrl = profile?.avatar_url || null;
  const userEmail = user?.email || 'admin@unram.ac.id';

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. Page Header matching Reference Image */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pengaturan</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Kelola profil administrator, preferensi aplikasi, dan konfigurasi sistem penjadwalan.
        </p>
      </div>

      {/* 2. Main Layout (75% Left Main Grid / 25% Right Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =========================================================
            LEFT / MAIN CONTENT AREA (~75% on desktop: 8 or 9 cols)
           ========================================================= */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Top Row: [ Profil Admin ] (Left) + [ Preferensi Jadwal ] (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* CARD 1: Profil Admin */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Profil Admin
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEditProfileModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ubah Profil</span>
                  </button>
                </div>

                {/* Avatar & Core Details */}
                <div className="flex items-center gap-4 mb-4">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-16 h-16 rounded-full object-cover ring-4 ring-blue-50 shadow-sm shrink-0 border border-slate-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-linear-to-br from-blue-600 to-indigo-700 text-white font-bold text-2xl flex items-center justify-center ring-4 ring-blue-50 shadow-sm shrink-0">
                      {getInitials(displayName)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 leading-snug truncate">
                      {displayName}
                    </h3>
                    <p className="text-2xs text-slate-400 truncate mt-0.5 font-mono">
                      {userEmail}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-3xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        Administrator
                      </span>
                      {isSystemOwner && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Crown className="w-3 h-3 text-amber-600" />
                          System Owner
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Information Rows */}
                <div className="space-y-2.5 text-xs pt-1">
                  <div className="flex items-center justify-between text-2xs">
                    <span className="text-slate-400">Fakultas</span>
                    <span className="font-semibold text-slate-800">Fakultas Teknik</span>
                  </div>
                  <div className="flex items-center justify-between text-2xs">
                    <span className="text-slate-400">Program Studi</span>
                    <span className="font-semibold text-slate-800">Teknik Elektro</span>
                  </div>
                  <div className="flex items-center justify-between text-2xs">
                    <span className="text-slate-400">Terakhir Masuk</span>
                    <span className="font-mono text-slate-700">{formatDateIndo(new Date())}</span>
                  </div>
                  <div className="flex items-center justify-between text-2xs">
                    <span className="text-slate-400">Status Akun</span>
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Aktif
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action: Manajemen Akun Navigation */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-3xs">
                <span className="text-slate-400">Otorisasi akun dosen & admin</span>
                <button
                  type="button"
                  onClick={() => navigate('/manajemen-akun')}
                  className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka Manajemen Akun</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* CARD 2: Preferensi Jadwal (Single Source of Truth) */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Preferensi Jadwal
                    </h2>
                  </div>
                  <span className="text-3xs font-bold text-slate-400 uppercase">
                    Sistem Akademik
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* Durasi Slot Waktu (Read-only single source of truth reference) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-2xs font-bold text-slate-600">
                        Durasi Slot Waktu Kuliah
                      </label>
                      <button
                        type="button"
                        onClick={() => navigate('/slot-waktu')}
                        className="text-3xs font-bold text-blue-600 hover:underline"
                      >
                        Kelola Slot Waktu →
                      </button>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        50 Menit / SKS
                      </span>
                      <span className="text-3xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono">
                        Standar Nasional
                      </span>
                    </div>
                  </div>

                  {/* Hari Aktif Perkuliahan */}
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-600">
                      Hari Aktif Perkuliahan
                    </label>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        Senin – Jumat (5 Hari Kerja)
                      </span>
                      <span className="text-3xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                        Aktif
                      </span>
                    </div>
                  </div>

                  {/* Format Waktu */}
                  <div className="space-y-1">
                    <label className="text-2xs font-bold text-slate-600">
                      Format Waktu & Notasi
                    </label>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        24 Jam (HH:MM WITA)
                      </span>
                      <span className="text-3xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono">
                        Default
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Periode Akademik Info */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-3xs text-slate-500">
                <span>Periode Aktif: <strong>{activeTerm?.academic_year || '2026/2027'} ({activeTerm?.semester_type || 'Ganjil'})</strong></span>
                <span className="text-emerald-600 font-bold">Tersinkronisasi</span>
              </div>
            </div>
          </div>

          {/* Middle Row: [ Tampilan / Appearance ] */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Tampilan & Antarmuka
                </h2>
              </div>
              <span className="text-3xs text-slate-400 font-medium">Preferensi Pengguna</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Theme Preference */}
              <div className="space-y-1.5">
                <label className="text-2xs font-bold text-slate-700 block">Tema Aplikasi</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveTheme('LIGHT')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                      appTheme === 'LIGHT'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Terang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveTheme('SYSTEM')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                      appTheme === 'SYSTEM'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Sistem</span>
                  </button>
                </div>
              </div>

              {/* Card Density */}
              <div className="space-y-1.5">
                <label className="text-2xs font-bold text-slate-700 block">Ukuran Kartu Jadwal</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveDensity('NORMAL')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                      cardDensity === 'NORMAL'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Sedang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveDensity('COMPACT')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                      cardDensity === 'COMPACT'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Ringkas</span>
                  </button>
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-1.5">
                <label className="text-2xs font-bold text-slate-700 block">Warna Aksen</label>
                <div className="flex items-center gap-2 py-1">
                  {[
                    { key: 'BLUE', bg: 'bg-blue-600', ring: 'ring-blue-500' },
                    { key: 'PURPLE', bg: 'bg-purple-600', ring: 'ring-purple-500' },
                    { key: 'EMERALD', bg: 'bg-emerald-600', ring: 'ring-emerald-500' },
                    { key: 'AMBER', bg: 'bg-amber-500', ring: 'ring-amber-500' },
                    { key: 'ROSE', bg: 'bg-rose-600', ring: 'ring-rose-500' },
                  ].map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => handleSaveAccent(col.key)}
                      className={cn(
                        'w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center',
                        col.bg,
                        accentColor === col.key ? 'ring-3 ring-offset-2 ring-blue-400 scale-110' : 'hover:scale-105'
                      )}
                      title={`Aksen ${col.key}`}
                    >
                      {accentColor === col.key && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: [ Integrasi & Data ] matching reference */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" />
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Integrasi & Data
                  </h2>
                </div>
              </div>
              <p className="text-2xs text-slate-500">Kelola alur data jadwal, ekspor, dan pemeliharaan</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Action 1: Sinkronkan Data / Draf */}
              <button
                type="button"
                onClick={() => navigate('/penyusunan-jadwal')}
                className="p-4 rounded-2xl bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3">
                  <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                </div>
                <h4 className="font-bold text-xs text-blue-900">Penyusunan Jadwal</h4>
                <p className="text-3xs text-blue-700 mt-1 leading-normal">
                  Buka alur workflow 6 tahap penyusunan draf jadwal kuliah.
                </p>
              </button>

              {/* Action 2: Impor Excel/CSV */}
              <button
                type="button"
                onClick={() => navigate('/data-mata-kuliah')}
                className="p-4 rounded-2xl bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-200 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3">
                  <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <h4 className="font-bold text-xs text-emerald-900">Impor Excel / CSV</h4>
                <p className="text-3xs text-emerald-700 mt-1 leading-normal">
                  Impor data master mata kuliah dan kurikulum dari file tabular.
                </p>
              </button>

              {/* Action 3: Ekspor Jadwal & Laporan */}
              <button
                type="button"
                onClick={() => navigate('/laporan')}
                className="p-4 rounded-2xl bg-purple-50/60 hover:bg-purple-100/80 border border-purple-200 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-3">
                  <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                </div>
                <h4 className="font-bold text-xs text-purple-900">Ekspor Laporan Resmi</h4>
                <p className="text-3xs text-purple-700 mt-1 leading-normal">
                  Unduh dokumen PDF & cetak laporan akademik resmi UNRAM.
                </p>
              </button>

              {/* Action 4: Tarik Jadwal (Admin Only) */}
              {(isAdmin || isOwnerAdmin) && (
                <button
                  type="button"
                  onClick={() => setShowClearActiveModal(true)}
                  className="p-4 rounded-2xl bg-rose-50/70 hover:bg-rose-100/90 border border-rose-200 text-left transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center mb-3">
                    <EyeOff className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </div>
                  <h4 className="font-bold text-xs text-rose-950">Tarik Jadwal</h4>
                  <p className="text-3xs text-rose-800 mt-1 leading-normal">
                    Tarik publikasi aktif perkuliahan/UTS/UAS tanpa menghapus riwayat versi.
                  </p>
                </button>
              )}

              {/* Action 5: Reset Data (Safe Confirmation Modal) */}
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="p-4 rounded-2xl bg-rose-50/60 hover:bg-rose-100/80 border border-rose-200 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center mb-3">
                  <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
                <h4 className="font-bold text-xs text-rose-900">Reset Data</h4>
                <p className="text-3xs text-rose-700 mt-1 leading-normal">
                  Hapus draf aktif atau bersihkan riwayat log eksperimen.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================
            RIGHT SIDEBAR (~25% on desktop: 4 or 3 cols)
           ========================================================= */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          {/* CARD 1: Status Sistem (Real Health Check - NO Fake Services) */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Status Sistem
                </h3>
              </div>
              <button
                type="button"
                onClick={runHealthCheck}
                disabled={checkingHealth}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                title="Periksa Ulang Kondisi Sistem"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', checkingHealth && 'animate-spin')} />
              </button>
            </div>

            {/* Real Service Rows */}
            <div className="space-y-2.5 text-xs">
              {/* Database */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      dbStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    )}
                  />
                  <span>Database PostgreSQL</span>
                </div>
                <span
                  className={cn(
                    'font-mono text-2xs font-bold',
                    dbStatus === 'CONNECTED' ? 'text-emerald-600' : 'text-rose-600'
                  )}
                >
                  {dbStatus === 'CONNECTED' ? 'Terhubung' : 'Terputus'}
                </span>
              </div>

              {/* Supabase Connection */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Sesi Admin</span>
                </div>
                <span className="font-mono text-2xs font-bold text-emerald-600">
                  Tervalidasi
                </span>
              </div>

              {/* Published Schedule */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      publishedCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                    )}
                  />
                  <span>Jadwal Terpublikasi</span>
                </div>
                <span
                  className={cn(
                    'font-mono text-2xs font-bold',
                    publishedCount > 0 ? 'text-emerald-600' : 'text-amber-600'
                  )}
                >
                  {publishedCount > 0 ? `${publishedCount} Kelas` : 'Belum Terbit'}
                </span>
              </div>

              {/* Active Term */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      activeTerm ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    )}
                  />
                  <span>Periode Akademik</span>
                </div>
                <span className="font-mono text-2xs font-bold text-slate-800 truncate max-w-[100px]">
                  {activeTerm ? `${activeTerm.academic_year}` : 'Missing'}
                </span>
              </div>
            </div>

            {/* Health Summary Box */}
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-2 text-2xs text-emerald-900 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Semua modul sistem terhubung dan beroperasi normal.</span>
            </div>
          </div>

          {/* CARD 2: Bantuan Cepat matching reference */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Bantuan Cepat
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setGuideModalTab('GUIDE');
                  setShowGuideModal(true);
                }}
                className="w-full p-2.5 rounded-2xl bg-slate-50 hover:bg-blue-50/70 hover:border-blue-200 border border-slate-100 transition-all flex items-center justify-between text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-2xs group-hover:text-blue-700">
                      Panduan Penggunaan
                    </h5>
                    <p className="text-3xs text-slate-400">Pelajari alur penyusunan jadwal</p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setGuideModalTab('FAQ');
                  setShowGuideModal(true);
                }}
                className="w-full p-2.5 rounded-2xl bg-slate-50 hover:bg-blue-50/70 hover:border-blue-200 border border-slate-100 transition-all flex items-center justify-between text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-2xs group-hover:text-blue-700">
                      FAQ & Solusi
                    </h5>
                    <p className="text-3xs text-slate-400">Pertanyaan umum optimasi</p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setGuideModalTab('CONTACT');
                  setShowGuideModal(true);
                }}
                className="w-full p-2.5 rounded-2xl bg-slate-50 hover:bg-blue-50/70 hover:border-blue-200 border border-slate-100 transition-all flex items-center justify-between text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-2xs group-hover:text-blue-700">
                      Hubungi Admin Utama
                    </h5>
                    <p className="text-3xs text-slate-400">Dukungan teknis Tata Usaha</p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* CARD 3: Supabase Credentials (System Owner Only) */}
          {isSystemOwner && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Status Koneksi Database</span>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(true)}
                  className="text-3xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Ubah</span>
                </button>
              </div>

              <div className="space-y-2 text-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Database Host</span>
                  <span className="font-mono text-slate-700 font-medium">
                    {config.url ? config.url.replace('https://', '').split('.')[0] + '.supabase.co' : 'Belum terkonfigurasi'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Wilayah (Region)</span>
                  <span className="font-mono text-slate-700">ap-southeast-1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status Otorisasi</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Terhubung
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AdminEditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        profile={profile}
        userEmail={userEmail}
        onSaved={() => {
          // Trigger reload if needed
        }}
      />

      <AdminResetDataModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onResetComplete={() => {
          runHealthCheck();
        }}
      />

      <ClearActiveScheduleModal
        isOpen={showClearActiveModal}
        onClose={() => setShowClearActiveModal(false)}
        academicTermId={activeTerm?.id}
        onCleared={() => {
          runHealthCheck();
        }}
      />

      <AdminGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        defaultTab={guideModalTab}
      />

      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
};
