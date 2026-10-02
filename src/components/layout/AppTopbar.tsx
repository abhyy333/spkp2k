import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  Settings,
  LogOut,
  Menu,
  UserCheck,
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
    navigate('/login', { replace: true });
  };

  const displayName =
    profile?.full_name ||
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    (isAdmin ? 'Administrator' : 'Dosen');

  const getRoleLabel = () => {
    if (isAdmin) return 'Administrator';
    if (isDosen) return 'Dosen';
    return 'Pengguna';
  };

  return (
    <header className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      {/* Mobile menu trigger */}
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden cursor-pointer shrink-0"
        aria-label="Buka menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-xl min-w-0">
        <div
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:py-2 rounded-xl cursor-pointer text-slate-400 text-xs sm:text-sm bg-slate-50 border border-slate-200 hover:bg-slate-100/60 transition-colors"
        >
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate text-slate-500">
            Cari mata kuliah, dosen, ruangan...
          </span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-2 py-0.5 text-2xs font-medium text-slate-500 bg-white border border-slate-200 rounded-md shadow-2xs shrink-0 ml-auto">
            Ctrl + K
          </kbd>
        </div>
      </div>

      {/* Right side items */}
      <div className="flex items-center gap-2 shrink-0">
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              aria-expanded={dropdownOpen}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className={`w-8 h-8 rounded-full font-semibold text-xs flex items-center justify-center shrink-0 text-white ${
                    isAdmin ? 'bg-blue-600' : 'bg-emerald-600'
                  }`}
                >
                  {getInitials(displayName)}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                  {displayName}
                </p>
                <p className="text-2xs text-slate-400 font-medium">
                  {getRoleLabel()}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {displayName}
                  </p>
                  <p className="text-2xs text-slate-500 truncate">
                    {user.email}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/profil');
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4 text-slate-400" />
                    <span>Profil Saya</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate('/pengaturan');
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Pengaturan</span>
                    </button>
                  )}
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 cursor-pointer font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
