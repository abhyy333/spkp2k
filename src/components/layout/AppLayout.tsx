import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { SearchModal } from './SearchModal';
import { SupabaseConfigModal } from '../ui/SupabaseConfigModal';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  const configured = isSupabaseConfigured();
  const { isOwnerAdmin } = useAuth();

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      let preference = 'LIGHT';
      try {
        preference = localStorage.getItem('spk:theme') || 'LIGHT';
      } catch {
        // Use light mode when storage is unavailable.
      }

      const isDark = preference === 'SYSTEM' && media.matches;
      root.classList.toggle('dark', isDark);
      root.dataset.theme = isDark ? 'dark' : 'light';
    };

    applyTheme();
    window.addEventListener('spk-theme-change', applyTheme);
    media.addEventListener('change', applyTheme);

    return () => {
      window.removeEventListener('spk-theme-change', applyTheme);
      media.removeEventListener('change', applyTheme);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 relative">
      {/* Sidebar */}
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-200 ease-in-out',
          collapsed ? 'lg:pl-20' : 'lg:pl-60'
        )}
      >
        <AppTopbar
          onOpenMobileSidebar={() => setMobileOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        {/* Database Not Configured Warning */}
        {!configured && isOwnerAdmin && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-amber-900">
                    Koneksi database belum dikonfigurasi
                  </h4>
                  <p className="text-2xs sm:text-xs text-amber-700 mt-0.5">
                    Tambahkan Supabase URL dan Publishable Key agar sistem dapat berfungsi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfigModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Konfigurasi Sekarang
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto min-w-0">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      <SupabaseConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
      />
    </div>
  );
};
