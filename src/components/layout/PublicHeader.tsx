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
      path: '/jadwal-perkuliahan',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      label: 'Jadwal Ujian',
      path: '/jadwal-ujian',
      icon: <CalendarCheck className="w-4 h-4" />,
    },
    {
      label: 'Atur Jadwal Saya',
      path: '/jadwal-saya',
      icon: <UserCheck className="w-4 h-4" />,
    },
  ];

  return (
    <header
      className="sticky top-0 z-40 w-full transition-all select-none"
      style={{
        background: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'blur(16px) saturate(130%)',
        WebkitBackdropFilter: 'blur(16px) saturate(130%)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <Link
          to="/jadwal-perkuliahan"
          className="flex items-center gap-3 select-none group"
        >
          <div className="shrink-0 drop-shadow-xs group-hover:scale-105 transition-transform">
            <UnramLogo size={38} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight">
              Teknik Elektro
            </h1>
            <p className="text-2xs sm:text-xs text-slate-500 font-medium tracking-tight">
              Universitas Mataram
            </p>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.label.replace('Jadwal ', '')}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action */}
        <div className="flex items-center gap-2 shrink-0">
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
