import React, { useState } from 'react';
import { Database, CheckCircle2, AlertTriangle, KeyRound, ExternalLink, X, Copy, Check, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { getSupabaseConfig, saveRuntimeSupabaseConfig, isSupabaseConfigured, clearRuntimeSupabaseConfig } from '../../lib/supabase';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PUBLIC_PERMISSIONS_SQL = `-- Skrip Perbaikan Izin Publik (Fix Error 42501 permission denied for table schedule_entries)
-- Jalankan di SQL Editor dashboard Supabase Anda:

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.current_published_schedule TO anon, authenticated;
GRANT SELECT ON public.current_published_exams TO anon, authenticated;

GRANT SELECT ON public.schedule_entries TO anon, authenticated;
GRANT SELECT ON public.exam_entries TO anon, authenticated;
GRANT SELECT ON public.schedule_versions TO anon, authenticated;
GRANT SELECT ON public.course_offerings TO anon, authenticated;
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT SELECT ON public.lecturers TO anon, authenticated;
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT SELECT ON public.academic_terms TO anon, authenticated;
GRANT SELECT ON public.schedule_publications TO anon, authenticated;
GRANT SELECT ON public.exam_sessions TO anon, authenticated;
GRANT SELECT ON public.course_offering_lecturers TO anon, authenticated;
GRANT SELECT ON public.time_slots TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'schedule_entries') THEN
    ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select for schedule_entries" ON public.schedule_entries;
    CREATE POLICY "Public select for schedule_entries" ON public.schedule_entries FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;`;

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ isOpen, onClose }) => {
  const current = getSupabaseConfig();
  const [url, setUrl] = useState(current.url);
  const [key, setKey] = useState(current.key);
  const [isSaved, setIsSaved] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(PUBLIC_PERMISSIONS_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !key) return;
    saveRuntimeSupabaseConfig(url, key);
    setIsSaved(true);
  };

  const handleClear = () => {
    clearRuntimeSupabaseConfig();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Konfigurasi Koneksi Supabase</h3>
              <p className="text-xs text-slate-500">Database Penjadwalan Teknik Elektro Unram</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs text-slate-600 leading-relaxed">
            <div className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
              <KeyRound className="w-4 h-4 text-blue-600" />
              Environment Variables:
            </div>
            Aplikasi membaca dari <code className="px-1.5 py-0.5 bg-white border rounded text-slate-800 font-mono">VITE_SUPABASE_URL</code> dan{' '}
            <code className="px-1.5 py-0.5 bg-white border rounded text-slate-800 font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code>.
            Jika belum diset di file environment, Anda dapat memasukkannya di bawah ini:
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supabase URL (VITE_SUPABASE_URL)
              </label>
              <input
                type="url"
                required
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supabase Anon / Publishable Key (VITE_SUPABASE_PUBLISHABLE_KEY)
              </label>
              <input
                type="password"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
              <p className="text-2xs text-slate-400 mt-1">
                Gunakan publishable anon key saja. Jangan pernah gunakan service role key.
              </p>
            </div>

            {isSupabaseConfigured() && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Koneksi saat ini telah terhubung ke Supabase.</span>
              </div>
            )}

            {/* SQL Fix Helper for Error 42501 (Permission Denied for table schedule_entries) */}
            <div className="border border-amber-200/80 bg-amber-50/50 rounded-xl p-3 text-xs">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setShowSqlGuide(!showSqlGuide)}
              >
                <div className="flex items-center gap-2 text-amber-900 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Perbaikan Izin Akses Jadwal Publik (Error 42501)</span>
                </div>
                <div className="text-amber-700">
                  {showSqlGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {showSqlGuide && (
                <div className="mt-2.5 pt-2.5 border-t border-amber-200/60 space-y-2">
                  <p className="text-amber-800 text-2xs leading-relaxed">
                    Jika muncul pesan error <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-900">permission denied for table schedule_entries</code> saat melihat jadwal publik, jalankan skrip SQL di bawah ini pada menu <strong>SQL Editor</strong> di dashboard Supabase Anda.
                  </p>
                  <div className="relative">
                    <pre className="p-2.5 bg-slate-900 text-slate-100 rounded-lg text-2xs font-mono overflow-x-auto max-h-36 leading-normal">
                      {PUBLIC_PERMISSIONS_SQL}
                    </pre>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="absolute top-2 right-2 px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-2xs font-medium flex items-center gap-1 backdrop-blur-xs transition-colors"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin SQL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {isSupabaseConfigured() ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium"
                >
                  Reset Konfigurasi
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
                >
                  Simpan & Hubungkan
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
