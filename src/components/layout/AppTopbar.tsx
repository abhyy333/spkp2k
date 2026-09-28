import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  Settings,
  LogOut,
  Menu,
  LogIn,
  UserPlus,
  ShieldCheck,
  Crown,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials } from '../../lib/utils';

interface AppTopbarProps {
  onOpenMobileSidebar: () => void;
  onOpenSearch: () => void;
}

export const AppTopbar: React.FC<AppTopbarProps> = ({
  onOpenMobileSidebar,
  onOpenSearch,
}) => {
  const {
    user,
    profile,
    role,
    isOwnerAdmin,
    isSystemOwner,
    isAdmin,
    isDosen,
    signOut,
  } = useAuth();

  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
    navigate('/jadwal-perkuliahan');
  };

  const displayName =
    profile?.full_name ||
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    (isAdmin ? 'Admin Jurusan' : 'Pengguna');

  const getRoleLabel = () => {
    if (role === 'ADMIN' || isOwnerAdmin) return 'Administrator';
    if (role === 'DOSEN') return 'Dosen';
    return 'Pengguna';
  };

  return (
    <>
      <header
        className="h-16 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 min-w-0"
        style={{
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(14px) saturate(130%)',
          WebkitBackdropFilter: 'blur(14px) saturate(130%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.75)',
          boxShadow: '0 2px 16px rgba(15, 23, 42, 0.03)',
        }}
      >
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/60 lg:hidden cursor-pointer shrink-0"
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-xl min-w-0">
          <div
            onClick={onOpenSearch}
            className="w-full flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:py-2 rounded-xl cursor-pointer text-slate-400 text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
            }}
          >
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate text-slate-500 text-xs sm:text-sm">
              Cari mata kuliah, dosen, ruangan...
            </span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-2 py-0.5 text-2xs font-medium text-slate-500 bg-white/80 border border-slate-200/80 rounded-md shadow-2xs shrink-0 ml-auto">
              Ctrl + K
            </kbd>
          </div>
        </div>

        {/* Right side items */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* GUEST buttons */}
          {!user && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk</span>
              </button>
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar</span>
              </button>
            </div>
          )}

          {/* Divider */}
          {user && <div className="h-6 w-px bg-slate-200 hidden sm:block" />}

          {/* Profile Pill Dropdown for Authenticated User */}
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                aria-expanded={dropdownOpen}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shrink-0 ring-2 ring-blue-100 shadow-2xs border border-slate-200"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full font-semibold text-xs flex items-center justify-center shrink-0 ring-2 shadow-2xs ${
                    isSystemOwner
                      ? 'bg-amber-600 text-white ring-amber-100'
                      : isAdmin
                      ? 'bg-blue-700 text-white ring-blue-100'
                      : isDosen
                      ? 'bg-purple-700 text-white ring-purple-100'
                      : 'bg-slate-700 text-white ring-slate-100'
                  }`}>
                    {getInitials(displayName)}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                    {displayName}
                  </p>
                  <p className="text-2xs text-slate-400 font-medium tracking-tight">
                    {getRoleLabel()}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  {/* User info header */}
                  <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center gap-2.5">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-blue-100 shadow-2xs border border-slate-200"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className={`w-9 h-9 rounded-full font-semibold text-xs flex items-center justify-center shrink-0 ring-2 shadow-2xs ${
                        isSystemOwner
                          ? 'bg-amber-600 text-white ring-amber-100'
                          : isAdmin
                          ? 'bg-blue-700 text-white ring-blue-100'
                          : isDosen
                          ? 'bg-purple-700 text-white ring-purple-100'
                          : 'bg-slate-700 text-white ring-slate-100'
                      }`}>
                        {getInitials(displayName)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                      <p className="text-2xs font-medium text-slate-500 truncate">{user.email}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {isSystemOwner ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 text-3xs font-bold rounded border border-amber-200">
                            <Crown className="w-3 h-3 text-amber-600" />
                            System Owner
                          </span>
                        ) : isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-3xs font-bold rounded">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            Administrator
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-3xs font-bold rounded">
                            Dosen
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Standard Links */}
                  <div className="py-1">
                    {(isAdmin || isOwnerAdmin) && (
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate('/manajemen-akun');
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Users className="w-4 h-4 text-slate-400" />
                        Manajemen Akun & Akses
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate('/pengaturan');
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      Pengaturan Sistem
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  );
};
