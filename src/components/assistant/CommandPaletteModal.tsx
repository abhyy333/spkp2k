import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  BookOpen,
  Calendar,
  Users,
  DoorClosed,
  HelpCircle,
  ArrowRight,
  X,
  Compass,
  Command,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ASSISTANT_FAQ_DATA, FaqItem } from '../../data/assistantFaq';
import { schedulesService } from '../../services/schedules.service';
import { CurrentPublishedSchedule } from '../../types';
import { cn } from '../../lib/utils';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAssistantWithQuery: (query: string) => void;
}

interface NavResult {
  id: string;
  label: string;
  category: 'NAVIGATION';
  path: string;
  icon: React.ReactNode;
}

interface ScheduleResult {
  id: string;
  category: 'SCHEDULE';
  title: string;
  subtitle: string;
  offeringId: string;
  raw: CurrentPublishedSchedule;
}

interface FaqResult {
  id: string;
  category: 'FAQ';
  faq: FaqItem;
}

interface AskResult {
  id: string;
  category: 'ASK_AI';
  query: string;
}

type PaletteItem = NavResult | ScheduleResult | FaqResult | AskResult;

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onOpenAssistantWithQuery,
}) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const effectiveRole = role === 'ADMIN' ? 'ADMIN' : role === 'DOSEN' ? 'DOSEN' : 'PUBLIC';

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [publishedSchedule, setPublishedSchedule] = useState<CurrentPublishedSchedule[]>([]);

  // Load published schedule for instant local search
  useEffect(() => {
    if (isOpen) {
      schedulesService
        .getPublishedSchedule()
        .then((data) => setPublishedSchedule(data || []))
        .catch(() => setPublishedSchedule([]));
    }
  }, [isOpen]);

  // Define navigation routes
  const navigationRoutes: NavResult[] = useMemo(() => {
    const common: NavResult[] = [
      {
        id: 'nav-1',
        label: 'Jadwal Perkuliahan',
        category: 'NAVIGATION',
        path: '/jadwal-perkuliahan',
        icon: <Calendar className="w-4 h-4 text-blue-600" />,
      },
      {
        id: 'nav-2',
        label: 'Jadwal Ujian',
        category: 'NAVIGATION',
        path: '/jadwal-ujian',
        icon: <Calendar className="w-4 h-4 text-emerald-600" />,
      },
      {
        id: 'nav-3',
        label: 'Atur Jadwal Saya',
        category: 'NAVIGATION',
        path: '/jadwal-saya',
        icon: <Compass className="w-4 h-4 text-purple-600" />,
      },
    ];

    if (effectiveRole === 'ADMIN') {
      return [
        {
          id: 'nav-dash',
          label: 'Dashboard Admin',
          category: 'NAVIGATION',
          path: '/dashboard',
          icon: <Compass className="w-4 h-4 text-amber-600" />,
        },
        {
          id: 'nav-penyusunan',
          label: 'Penyusunan Jadwal',
          category: 'NAVIGATION',
          path: '/penyusunan-jadwal',
          icon: <Calendar className="w-4 h-4 text-blue-600" />,
        },
        ...common,
        {
          id: 'nav-konflik',
          label: 'Konflik Jadwal',
          category: 'NAVIGATION',
          path: '/konflik-jadwal',
          icon: <HelpCircle className="w-4 h-4 text-rose-600" />,
        },
        {
          id: 'nav-dosen',
          label: 'Data Dosen',
          category: 'NAVIGATION',
          path: '/data-dosen',
          icon: <Users className="w-4 h-4 text-teal-600" />,
        },
        {
          id: 'nav-mk',
          label: 'Data Mata Kuliah',
          category: 'NAVIGATION',
          path: '/data-mata-kuliah',
          icon: <BookOpen className="w-4 h-4 text-indigo-600" />,
        },
        {
          id: 'nav-ruangan',
          label: 'Data Ruangan',
          category: 'NAVIGATION',
          path: '/ruangan',
          icon: <DoorClosed className="w-4 h-4 text-amber-600" />,
        },
      ];
    }

    if (effectiveRole === 'DOSEN') {
      return [
        {
          id: 'nav-dash-dos',
          label: 'Dashboard Dosen',
          category: 'NAVIGATION',
          path: '/dashboard',
          icon: <Compass className="w-4 h-4 text-purple-600" />,
        },
        ...common,
      ];
    }

    return common;
  }, [effectiveRole]);

  // Compute Instant Results (<100ms)
  const paletteResults = useMemo<PaletteItem[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const items: PaletteItem[] = [];

    // 1. Navigation Matches
    const matchingNavs = navigationRoutes.filter((r) =>
      r.label.toLowerCase().includes(q)
    );
    items.push(...matchingNavs.slice(0, 3));

    // 2. Schedule Matches
    const matchingSchedules = publishedSchedule
      .filter((s) => {
        const mName = s.course_name?.toLowerCase().includes(q);
        const mCode = s.course_code?.toLowerCase().includes(q);
        const mLecturer = Array.isArray(s.lecturer_names)
          ? s.lecturer_names.some((l) => l.toLowerCase().includes(q))
          : String(s.lecturer_names || '').toLowerCase().includes(q);
        return mName || mCode || mLecturer;
      })
      .slice(0, 4)
      .map<ScheduleResult>((s) => ({
        id: `sched-${s.id}`,
        category: 'SCHEDULE',
        title: `${s.course_name} (Kelas ${s.class_name || 'A'})`,
        subtitle: `${s.day}, ${s.start_time}–${s.end_time} • ${s.room_name || s.room_code || 'Ruangan'}`,
        offeringId: s.course_offering_id || s.id,
        raw: s,
      }));

    items.push(...matchingSchedules);

    // 3. FAQ Matches
    const matchingFaqs = ASSISTANT_FAQ_DATA.filter((faq) => {
      if (faq.category !== effectiveRole && faq.category !== 'PUBLIC') return false;
      return (
        faq.question.toLowerCase().includes(q) ||
        faq.keywords.some((kw) => q.includes(kw) || kw.includes(q))
      );
    })
      .slice(0, 3)
      .map<FaqResult>((f) => ({
        id: `faq-${f.id}`,
        category: 'FAQ',
        faq: f,
      }));

    items.push(...matchingFaqs);

    // 4. Always add "Tanya Asisten" AI trigger option
    items.push({
      id: `ask-ai-trigger`,
      category: 'ASK_AI',
      query: query,
    });

    return items;
  }, [query, navigationRoutes, publishedSchedule, effectiveRole]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation & Shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }

      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, paletteResults.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? Math.max(0, paletteResults.length - 1) : prev - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (paletteResults[selectedIndex]) {
          handleSelectItem(paletteResults[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, paletteResults, selectedIndex, onClose]);

  // Select Item Handler
  const handleSelectItem = (item: PaletteItem) => {
    onClose();
    if (item.category === 'NAVIGATION') {
      navigate(item.path);
    } else if (item.category === 'SCHEDULE') {
      navigate(`/jadwal-perkuliahan?focus=${item.offeringId}`);
    } else if (item.category === 'FAQ') {
      onOpenAssistantWithQuery(item.faq.question);
    } else if (item.category === 'ASK_AI') {
      onOpenAssistantWithQuery(item.query);
    }
  };

  if (!isOpen) return null;

  // Suggested Prompts per Role
  const suggestedPrompts =
    effectiveRole === 'ADMIN'
      ? [
          'Apakah draft siap diterbitkan?',
          'Ada konflik apa saja?',
          'Ringkas hasil optimasi terakhir',
          'Cari alternatif Kimia Dasar',
        ]
      : effectiveRole === 'DOSEN'
      ? [
          'Jadwal saya hari ini',
          'Saya mengawas ujian kapan?',
          'Ruangan kuliah saya',
          'Jadwal saya hari Kamis',
        ]
      : [
          'Cari jadwal mata kuliah',
          'Jadwal ujian hari ini',
          'Bagaimana Atur Jadwal Saya?',
          'Cek bentrok Jadwal Saya',
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Palette Card */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Input Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-600 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Cari halaman, jadwal, atau tanyakan sesuatu..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-xs sm:text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100 font-medium"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-3xs font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-[65vh] overflow-y-auto p-2 sm:p-3 space-y-3">
          {/* EMPTY QUERY STATE: Show Suggested Prompts & Quick Nav */}
          {!query.trim() && (
            <div className="space-y-4 p-2">
              <div>
                <p className="text-4xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Pertanyaan Populer Asisten ({effectiveRole})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestedPrompts.map((promptText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAssistantWithQuery(promptText);
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-700 transition-all text-left cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{promptText}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-4xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Navigasi Cepat
                </p>
                <div className="space-y-1">
                  {navigationRoutes.slice(0, 4).map((nav) => (
                    <div
                      key={nav.id}
                      onClick={() => {
                        onClose();
                        navigate(nav.path);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        {nav.icon}
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {nav.label}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* QUERY RESULTS */}
          {query.trim() && (
            <div className="space-y-1">
              {paletteResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;

                if (item.category === 'NAVIGATION') {
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 border border-blue-200/80 dark:border-blue-800'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <div>
                          <p className="text-xs font-bold">{item.label}</p>
                          <p className="text-4xs text-slate-400 font-mono">Halaman Aplikasi</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300" />
                    </div>
                  );
                }

                if (item.category === 'SCHEDULE') {
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 border border-blue-200/80 dark:border-blue-800'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-2xs">
                          {item.raw.class_name || 'A'}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold truncate">{item.title}</p>
                          <p className="text-2xs text-slate-500 font-mono truncate">{item.subtitle}</p>
                        </div>
                      </div>
                      <span className="text-2xs font-semibold text-blue-600 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-blue-200/80 shrink-0">
                        Lihat Jadwal
                      </span>
                    </div>
                  );
                }

                if (item.category === 'FAQ') {
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 border border-purple-200/80 dark:border-purple-800'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <HelpCircle className="w-4 h-4 text-purple-600 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-bold truncate">{item.faq.question}</p>
                          <p className="text-2xs text-slate-400 truncate">Bantuan & FAQ Sistem</p>
                        </div>
                      </div>
                      <span className="text-2xs font-semibold text-purple-600 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-purple-200/80 shrink-0">
                        Tanyakan
                      </span>
                    </div>
                  );
                }

                if (item.category === 'ASK_AI') {
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border',
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-blue-50/80 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Sparkles className="w-5 h-5 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-extrabold truncate">
                            Tanyakan &quot;{query}&quot; kepada Asisten Akademik
                          </p>
                          <p className="text-3xs opacity-80">
                            Mode Asisten Akademik Contextual AI
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-4xs font-semibold text-slate-400 px-4">
          <div className="flex items-center gap-2">
            <span>↑↓ Pilih</span>
            <span>↵ Buka</span>
            <span>ESC Tutup</span>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <Command className="w-3 h-3" />
            <span>Ctrl + K</span>
          </div>
        </div>
      </div>
    </div>
  );
};
