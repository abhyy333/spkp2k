import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, CalendarCheck, UserCheck, LogIn, ArrowRight } from 'lucide-react';
import { UnramLogo } from '../shared/UnramLogo';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

export const PublicHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const navItems = [
    {
      label: 'Jadwal Perkuliahan',
      mobileLabel: 'Perkuliahan',
      path: '/jadwal-perkuliahan',
      icon: <Calendar className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Jadwal Ujian',
      mobileLabel: 'Ujian',
      path: '/jadwal-ujian',
      icon: <CalendarCheck className="w-4 h-4 shrink-0" />,
    },
    {
      label: 'Atur Jadwal Saya',
      mobileLabel: 'Jadwal Saya',
      path: '/jadwal-saya',
      icon: <UserCheck className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <header
      className="sticky top-0 z-40 w-full transition-all select-none overflow-x-hidden"
      style={{
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(16px) saturate(130%)',
        WebkitBackdropFilter: 'blur(16px) saturate(130%)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
        {/* ROW 1 (Mobile) / Left Brand + Right Action */}
        <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
          <Link
            to="/jadwal-perkuliahan"
            className="flex items-center gap-2.5 select-none group min-w-0"
          >
            <div className="shrink-0 drop-shadow-xs group-hover:scale-105 transition-transform">
              <UnramLogo size={32} className="sm:w-[38px] sm:h-[38px]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight leading-tight whitespace-nowrap">
                Teknik Elektro
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-tight whitespace-nowrap">
                Universitas Mataram
              </p>
            </div>
          </Link>

          {/* Right Action (Mobile) */}
          <div className="sm:hidden shrink-0">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs cursor-pointer"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span>Masuk</span>
              </button>
            )}
          </div>
        </div>

        {/* ROW 2 (Mobile) / Center Nav Tabs (Desktop) */}
        <div className="w-full sm:w-auto overflow-x-auto no-scrollbar">
          <nav className="flex items-center p-1 bg-slate-100/90 rounded-xl sm:rounded-2xl border border-slate-200/60 min-w-max sm:min-w-0 mx-auto">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-lg sm:rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{item.mobileLabel}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Action (Desktop) */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-all cursor-pointer"
            >
              <span>Buka Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-500" />
              <span>Masuk</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
