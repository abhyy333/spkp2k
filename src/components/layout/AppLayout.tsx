import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { PublicHeader } from './PublicHeader';
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
  const { isOwnerAdmin, effectiveAccessMode } = useAuth();

  const isGuestMode = effectiveAccessMode === 'GUEST';

  if (isGuestMode) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col text-slate-800 relative">
        {/* Subtle Ambient Background Highlight */}
        <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none">
          <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] bg-blue-100/20 rounded-full blur-3xl" />
          <div className="absolute bottom-[-10%] right-[10%] w-[450px] h-[450px] bg-sky-100/15 rounded-full blur-3xl" />
        </div>

        {/* Public Guest Header */}
        <PublicHeader />

        {/* Database Not Configured Banner (Only for admin setup) */}
        {!configured && isOwnerAdmin && (
          <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-3 sm:px-6 backdrop-blur-xs">
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
                    Tambahkan Supabase URL dan Publishable Key pada environment project.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfigModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-200/80 hover:bg-amber-200 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Konfigurasi Sekarang
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area for Guest */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1720px] w-full mx-auto min-w-0">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        <SupabaseConfigModal
          isOpen={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col text-slate-800 relative">
      {/* Subtle Ambient Background Highlight */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none">
        <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] bg-blue-100/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[10%] w-[450px] h-[450px] bg-sky-100/15 rounded-full blur-3xl" />
      </div>

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
          collapsed ? 'lg:pl-20' : 'lg:pl-[232px]'
        )}
      >
        {/* Topbar */}
        <AppTopbar
          onOpenMobileSidebar={() => setMobileOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        {/* Database Not Configured Banner */}
        {!configured && (
          <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-3 sm:px-6 backdrop-blur-xs">
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
                    Tambahkan Supabase URL dan Publishable Key pada environment project.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfigModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-200/80 hover:bg-amber-200 rounded-lg transition-colors shrink-0 self-start sm:self-center cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Konfigurasi Sekarang
              </button>
            </div>
          </div>
        )}

        {/* Page Content with ErrorBoundary protection */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1720px] w-full mx-auto min-w-0">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Search Palette Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Supabase Config Modal */}
      <SupabaseConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
      />
    </div>
  );
};
