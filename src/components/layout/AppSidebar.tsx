import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarPlus,
  Calendar,
  CalendarCheck,
  Database,
  History,
  Users,
  Settings,
  UserCheck,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { UnramLogo } from '../shared/UnramLogo';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { role } = useAuth();
  const navigate = useNavigate();

  const isDosen = role === 'DOSEN';

  // DOSEN Navigation items
  const dosenNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Jadwal Perkuliahan', path: '/jadwal-perkuliahan', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Jadwal Ujian', path: '/jadwal-ujian', icon: <CalendarCheck className="w-5 h-5" /> },
    { label: 'Profil Saya', path: '/profil', icon: <UserCheck className="w-5 h-5" /> },
  ];

  // ADMIN Navigation items
  const adminNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Penyusunan Jadwal', path: '/penyusunan-jadwal', icon: <CalendarPlus className="w-5 h-5" /> },
    { label: 'Jadwal Perkuliahan', path: '/jadwal-perkuliahan', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Jadwal Ujian', path: '/jadwal-ujian', icon: <CalendarCheck className="w-5 h-5" /> },
    { label: 'Master Data', path: '/master-data', icon: <Database className="w-5 h-5" /> },
    { label: 'Riwayat', path: '/riwayat', icon: <History className="w-5 h-5" /> },
    { label: 'Manajemen Akun', path: '/manajemen-akun', icon: <Users className="w-5 h-5" /> },
    { label: 'Pengaturan', path: '/pengaturan', icon: <Settings className="w-5 h-5" /> },
  ];

  const currentNavItems = isDosen ? dosenNavItems : adminNavItems;

  const renderNavLinks = (items: NavItem[]) => {
    return items.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onCloseMobile}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-medium transition-colors group relative',
            isActive
              ? 'bg-[#29344b] text-white font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-white/10'
          )
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={cn(
                'shrink-0 transition-colors',
                isActive ? 'text-[#a9c4ff]' : 'text-slate-400 group-hover:text-white'
              )}
            >
              {item.icon}
            </span>
            {!collapsed && <span className="truncate tracking-tight">{item.label}</span>}
            {collapsed && (
              <div className="fixed left-20 ml-2 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-md shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                {item.label}
              </div>
            )}
          </>
        )}
      </NavLink>
    ));
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-[#1c2333] border-r border-white/10 transition-all duration-200 ease-in-out select-none',
          collapsed ? 'w-20' : 'w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center gap-3 border-b border-white/10 shrink-0">
          <div
            className="shrink-0 cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            <UnramLogo size={36} />
          </div>
          {!collapsed && (
            <div
              className="min-w-0 flex-1 overflow-hidden cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              <h1 className="text-sm font-bold text-white tracking-tight leading-tight truncate">
                Teknik Elektro
              </h1>
              <p className="text-2xs text-slate-400 font-medium tracking-tight truncate">
                Universitas Mataram
              </p>
            </div>
          )}
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div className="px-4 pt-3 pb-1">
            <span
              className={cn(
            'inline-block px-2 py-1 rounded text-3xs font-semibold',
                isDosen
                  ? 'bg-emerald-900/40 text-emerald-200'
                  : 'bg-[#29344b] text-blue-100'
              )}
            >
              {isDosen ? 'Role: Dosen' : 'Role: Admin Jurusan'}
            </span>
          </div>
        )}

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {renderNavLinks(currentNavItems)}
        </div>

        {/* Bottom Toggle */}
        <div className="p-3 border-t border-white/10 shrink-0 hidden lg:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-full min-h-11 flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={collapsed ? 'Perluas Menu' : 'Sembunyikan Menu'}
          >
            {collapsed ? (
              <ChevronsRight className="w-5 h-5 shrink-0 text-slate-400" />
            ) : (
              <>
                <ChevronsLeft className="w-5 h-5 shrink-0 text-slate-400" />
                <span className="truncate">Sembunyikan Menu</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
