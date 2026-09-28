import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, Users, DoorClosed, ArrowRight, X, Loader2 } from 'lucide-react';
import { coursesService } from '../../services/courses.service';
import { lecturersService } from '../../services/lecturers.service';
import { roomsService } from '../../services/rooms.service';
import { Course, Lecturer, Room } from '../../types';
import { isSupabaseConfigured } from '../../lib/supabase';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const navigate = useNavigate();

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // handled by parent or opened
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !query.trim() || !isSupabaseConfigured()) {
      setCourses([]);
      setLecturers([]);
      setRooms([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [c, l, r] = await Promise.all([
          coursesService.getCourses({ search: query }).catch(() => []),
          lecturersService.getLecturers({ search: query }).catch(() => []),
          roomsService.getRooms({ search: query }).catch(() => []),
        ]);
        setCourses(c.slice(0, 5));
        setLecturers(l.slice(0, 5));
        setRooms(r.slice(0, 5));
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Cari mata kuliah, dosen, ruangan..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-800"
          />
          {loading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {!query.trim() && (
            <div className="p-6 text-center text-xs text-slate-400">
              Ketik nama mata kuliah, kode, nama dosen, atau nomor ruangan untuk mencari.
            </div>
          )}

          {query.trim() && !loading && courses.length === 0 && lecturers.length === 0 && rooms.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500">
              Tidak ada hasil yang cocok dengan &quot;{query}&quot;
            </div>
          )}

          {/* Courses */}
          {courses.length > 0 && (
            <div>
              <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">
                Mata Kuliah ({courses.length})
              </p>
              <div className="space-y-1">
                {courses.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onClose();
                      navigate('/data-mata-kuliah');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
                        <p className="text-2xs text-slate-400">
                          {c.code || '—'} • {c.sks} SKS • Semester {c.semester}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lecturers */}
          {lecturers.length > 0 && (
            <div>
              <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">
                Dosen ({lecturers.length})
              </p>
              <div className="space-y-1">
                {lecturers.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => {
                      onClose();
                      navigate('/data-dosen');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs">
                        {l.code || 'DS'}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-800 truncate">{l.name}</p>
                        <p className="text-2xs text-slate-400">
                          NIP: {l.nip || '—'} • {l.kbk?.name || 'Teknik Elektro'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rooms */}
          {rooms.length > 0 && (
            <div>
              <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">
                Ruangan ({rooms.length})
              </p>
              <div className="space-y-1">
                {rooms.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      onClose();
                      navigate('/ruangan');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <DoorClosed className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {r.name} ({r.code})
                        </p>
                        <p className="text-2xs text-slate-400">
                          {r.building} • Kapasitas {r.capacity} orang
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-400 px-4">
          <span>Gunakan panah untuk navigasi atau klik item</span>
          <span>Tekan ESC untuk menutup</span>
        </div>
      </div>
    </div>
  );
};
