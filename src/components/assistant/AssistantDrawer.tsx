import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  BookOpen,
  Loader2,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ASSISTANT_FAQ_DATA, FaqItem } from '../../data/assistantFaq';
import { assistantTools } from '../../services/assistantTools';
import { cn } from '../../lib/utils';
import { CurrentPublishedSchedule } from '../../types';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  source?: 'Jadwal Resmi' | 'Draft Aktif' | 'Jadwal Saya' | 'FAQ Sistem' | 'Optimasi SA';
  cards?: {
    type: 'SCHEDULE' | 'READINESS' | 'CONFLICT' | 'RESCHEDULE' | 'SA_SUMMARY';
    title?: string;
    items?: any[];
    ctaLabel?: string;
    ctaPath?: string;
    ctaAction?: string;
    data?: any;
  }[];
  timestamp: string;
}

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onOpenSmartReschedule?: (offeringId?: string) => void;
}

export const AssistantDrawer: React.FC<AssistantDrawerProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  onOpenSmartReschedule,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user, profile } = useAuth();

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const effectiveRole = role === 'ADMIN' ? 'ADMIN' : role === 'DOSEN' ? 'DOSEN' : 'PUBLIC';

  // Determine current page context title
  const getPageContextLabel = () => {
    const path = location.pathname;
    if (path.includes('jadwal-ujian')) return 'Jadwal Ujian';
    if (path.includes('jadwal-saya')) return 'Jadwal Saya';
    if (path.includes('penyusunan-jadwal')) return 'Penyusunan Jadwal';
    if (path.includes('konflik-jadwal')) return 'Konflik Jadwal';
    if (path.includes('riwayat-versi') || path.includes('riwayat-jadwal')) return 'Riwayat Versi';
    if (path.includes('evaluasi-sa')) return 'Evaluasi SA';
    if (path.includes('data-dosen')) return 'Data Dosen';
    if (path.includes('data-mata-kuliah')) return 'Data Mata Kuliah';
    if (path.includes('ruangan')) return 'Data Ruangan';
    return 'Jadwal Perkuliahan';
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Handle initial query if provided when opened
  useEffect(() => {
    if (isOpen && initialQuery.trim()) {
      handleProcessQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  // Welcome message when conversation is empty
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeText =
        effectiveRole === 'ADMIN'
          ? 'Halo Administrator! Saya Asisten Akademik. Saya siap membantu mengecek draf aktif, kesiapan publikasi, analisis konflik, serta hasil optimasi.'
          : effectiveRole === 'DOSEN'
          ? `Halo Bpk/Ibu ${profile?.full_name || 'Dosen'}! Saya Asisten Akademik. Saya dapat membantu memberikan informasi jadwal mengajar resmi dan pengawasan ujian Anda.`
          : 'Halo! Saya Asisten Akademik. Tanyakan jadwal perkuliahan, jadwal ujian, atau bantuan penggunaan Atur Jadwal Saya.';

      setMessages([
        {
          id: 'welcome-msg',
          sender: 'assistant',
          text: welcomeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [isOpen, effectiveRole, profile?.full_name]);

  // Handle processing prompt
  const handleProcessQuery = async (queryText: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: cleanQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    const lowerQ = cleanQuery.toLowerCase();

    try {
      // 1. DETERMINISTIC FAQ MATCHING LAYER
      const matchedFaq = ASSISTANT_FAQ_DATA.find((faq) => {
        if (faq.category !== effectiveRole && faq.category !== 'PUBLIC') return false;
        if (faq.question.toLowerCase().includes(lowerQ) || lowerQ.includes(faq.question.toLowerCase())) {
          return true;
        }
        return faq.keywords.some((kw) => lowerQ.includes(kw));
      });

      if (matchedFaq && (lowerQ.includes('bagaimana') || lowerQ.includes('apa') || lowerQ.includes('kenapa') || lowerQ.includes('apakah'))) {
        const assistantFaqMsg: ChatMessage = {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text: matchedFaq.answer,
          source: 'FAQ Sistem',
          cards: matchedFaq.suggestedCta
            ? [
                {
                  type: 'SCHEDULE',
                  ctaLabel: matchedFaq.suggestedCta.label,
                  ctaPath: matchedFaq.suggestedCta.path,
                },
              ]
            : undefined,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantFaqMsg]);
        setLoading(false);
        return;
      }

      // 2. ADMIN SPECIFIC CONTEXT QUERIES
      if (effectiveRole === 'ADMIN') {
        if (lowerQ.includes('siap') || lowerQ.includes('publish') || lowerQ.includes('terbit') || lowerQ.includes('readiness')) {
          const readiness = await assistantTools.getAdminDraftReadiness('active');
          let text = '';
          if (!readiness.hasActiveDraft) {
            text = 'Belum ada draf revisi aktif yang sedang dikerjakan.';
          } else if (readiness.isPublishReady) {
            text = `Draf versi "${readiness.versionCode}" SIAP DITERBITKAN. Terjadwal ${readiness.scheduledCount} kelas tanpa hard conflict.`;
          } else {
            text = `Draf versi "${readiness.versionCode}" BELUM SIAP diterbitkan.\n- Kelas terjadwal: ${readiness.scheduledCount}\n- Hard conflict: ${readiness.hardConflictsCount}\n- Soft conflict: ${readiness.softConflictsCount}`;
          }

          const assistantMsg: ChatMessage = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text,
            source: 'Draft Aktif',
            cards: [
              {
                type: 'READINESS',
                ctaLabel: 'Lihat Penyusunan Jadwal',
                ctaPath: '/penyusunan-jadwal',
              },
            ],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLoading(false);
          return;
        }

        if (lowerQ.includes('konflik') || lowerQ.includes('bentrok')) {
          const conflicts = await assistantTools.getAdminActiveConflicts('active');
          let text = '';
          if (conflicts.length === 0) {
            text = 'Draf aktif saat ini bersih dan TIDAK MEMILIKI KONFLIK hard atau soft.';
          } else {
            text = `Draf aktif memiliki ${conflicts.length} konflik:\n` +
              conflicts.slice(0, 3).map((c: any, i: number) => `${i + 1}. [${c.severity}] ${c.description}`).join('\n');
          }

          const assistantMsg: ChatMessage = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text,
            source: 'Draft Aktif',
            cards: [
              {
                type: 'CONFLICT',
                ctaLabel: 'Buka Konflik Jadwal',
                ctaPath: '/konflik-jadwal',
              },
            ],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLoading(false);
          return;
        }

        if (lowerQ.includes('optimasi') || lowerQ.includes('simulated annealing') || lowerQ.includes('sa')) {
          const saStats = await assistantTools.getAdminSASummary();
          const text = `Ringkasan Optimasi SA Terakhir:\n- Total evaluasi: ${saStats.totalEvaluations}\n- Rata-rata konflik awal: ${saStats.averageInitialConflicts}\n- Rata-rata konflik akhir: ${saStats.averageFinalConflicts}\n- Rata-rata iterasi: ${saStats.averageIterations}`;

          const assistantMsg: ChatMessage = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text,
            source: 'Optimasi SA',
            cards: [
              {
                type: 'SA_SUMMARY',
                ctaLabel: 'Buka Analisis Optimasi',
                ctaPath: '/evaluasi-sa',
              },
            ],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLoading(false);
          return;
        }

        if (lowerQ.includes('reschedule') || lowerQ.includes('alternatif') || lowerQ.includes('pindah')) {
          const text = 'Saya dapat membantu menemukan rekomendasi slot waktu dan ruangan kosong yang efisien untuk memindahkan jadwal mata kuliah.';
          const assistantMsg: ChatMessage = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text,
            source: 'Draft Aktif',
            cards: [
              {
                type: 'RESCHEDULE',
                ctaLabel: 'Buka Smart Rescheduling',
                ctaAction: 'OPEN_SMART_RESCHEDULE',
              },
            ],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLoading(false);
          return;
        }
      }

      // 3. DOSEN SPECIFIC QUERIES
      if (effectiveRole === 'DOSEN') {
        const lecturerName = profile?.full_name || profile?.name;
        const schedules = await assistantTools.getLecturerSchedule(undefined, lecturerName);

        if (schedules.length > 0) {
          const itemsToDisplay = schedules.slice(0, 3);
          const text = `Ditemukan ${schedules.length} jadwal mengajar resmi untuk Anda:`;

          const assistantMsg: ChatMessage = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text,
            source: 'Jadwal Resmi',
            cards: [
              {
                type: 'SCHEDULE',
                items: itemsToDisplay,
                ctaLabel: 'Buka Jadwal Saya',
                ctaPath: '/jadwal-saya',
              },
            ],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLoading(false);
          return;
        }
      }

      // 4. PUBLIC / SCHEDULE SEARCH QUERIES
      const searchMatches = await assistantTools.getPublicLectureSchedule(cleanQuery);
      if (searchMatches.length > 0) {
        const topMatches = searchMatches.slice(0, 3);
        const text = `Ditemukan ${searchMatches.length} kelas jadwal resmi yang sesuai:`;

        const assistantMsg: ChatMessage = {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text,
          source: 'Jadwal Resmi',
          cards: [
            {
              type: 'SCHEDULE',
              items: topMatches,
              ctaLabel: 'Lihat di Jadwal Perkuliahan',
              ctaPath: '/jadwal-perkuliahan',
            },
          ],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLoading(false);
        return;
      }

      // 5. SERVER-SIDE AI GATEWAY CALL (IF NO DIRECT MATCH)
      try {
        const response = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: cleanQuery,
            role: effectiveRole,
            pageContext: getPageContextLabel(),
            contextData: {
              role: effectiveRole,
              userName: profile?.full_name,
            },
          }),
        });

        const data = await response.json();
        if (data && data.answer) {
          const assistantAiMsg: ChatMessage = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: data.answer,
            source: 'Jadwal Resmi',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, assistantAiMsg]);
          setLoading(false);
          return;
        }
      } catch (aiErr) {
        console.warn('AI gateway call notice:', aiErr);
      }

      // 6. DEFAULT FALLBACK RESPONSE
      const fallbackMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: 'Saya tidak menemukan data tersebut pada jadwal resmi saat ini. Anda dapat menggunakan filter pada halaman Jadwal Perkuliahan atau memeriksa FAQ.',
        source: 'Jadwal Resmi',
        cards: [
          {
            type: 'SCHEDULE',
            ctaLabel: 'Buka Jadwal Perkuliahan',
            ctaPath: '/jadwal-perkuliahan',
          },
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } catch (err: any) {
      console.error('Assistant error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text: 'Asisten sedang tidak dapat memproses permintaan. Pencarian jadwal dan navigasi tetap dapat digunakan.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
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
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200 pointer-events-auto"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col pointer-events-auto transition-transform duration-200 ease-in-out z-10'
        )}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Asisten Akademik
                </h3>
                <span className="px-2 py-0.5 rounded-full text-4xs font-extrabold uppercase tracking-wide bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {effectiveRole}
                </span>
              </div>
              <p className="text-2xs text-slate-500 font-medium">
                Asisten Jadwal & Informasi Akademik • {getPageContextLabel()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearChat}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Hapus Percakapan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex flex-col space-y-1', msg.sender === 'user' ? 'items-end' : 'items-start')}
            >
              {/* Message Bubble */}
              <div
                className={cn(
                  'max-w-[90%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs',
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-xs font-medium'
                    : 'bg-slate-50 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs'
                )}
              >
                {/* Source Badge */}
                {msg.source && msg.sender === 'assistant' && (
                  <div className="flex items-center gap-1.5 text-4xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1.5">
                    <Info className="w-3 h-3" />
                    <span>Sumber: {msg.source}</span>
                  </div>
                )}

                <p className="whitespace-pre-line">{msg.text}</p>

                {/* Render Cards / CTAs if present */}
                {msg.cards && msg.cards.length > 0 && (
                  <div className="mt-3 space-y-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    {msg.cards.map((card, cIdx) => (
                      <div key={cIdx} className="space-y-2">
                        {/* Schedule Item List */}
                        {card.items && card.items.map((item: CurrentPublishedSchedule, iIdx: number) => (
                          <div
                            key={iIdx}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-2xs space-y-1 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-1 font-bold text-slate-900 dark:text-slate-100">
                              <span>{item.course_name}</span>
                              <span className="bg-blue-100 text-blue-800 text-3xs px-1.5 py-0.5 rounded font-bold">
                                Kelas {item.class_name || 'A'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-500 font-mono">
                              <span>{item.day}, {item.start_time}–{item.end_time}</span>
                              <span>{item.room_name || item.room_code || '-'}</span>
                            </div>
                            <div className="text-slate-400 truncate">
                              {Array.isArray(item.lecturer_names) ? item.lecturer_names.join(', ') : item.lecturer_names}
                            </div>
                          </div>
                        ))}

                        {/* CTA Buttons */}
                        {card.ctaLabel && (
                          <button
                            type="button"
                            onClick={() => {
                              if (card.ctaAction === 'OPEN_SMART_RESCHEDULE' && onOpenSmartReschedule) {
                                onOpenSmartReschedule();
                              } else if (card.ctaPath) {
                                navigate(card.ctaPath);
                              }
                              onClose();
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-2xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer shadow-2xs"
                          >
                            <span>{card.ctaLabel}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-4xs text-slate-400 px-1 font-mono">
                {msg.timestamp}
              </span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 text-slate-500 text-xs w-fit">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Menganalisis jadwal dan informasi...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Suggested Prompt Chips */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <p className="text-4xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Rekomendasi Pertanyaan
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedPrompts.map((promptText, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => handleProcessQuery(promptText)}
                className="text-3xs font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-700 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
              >
                {promptText}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Input Area */}
        <div className="p-4 border-t border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleProcessQuery(inputPrompt);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Tanyakan sesuatu tentang jadwal..."
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={loading || !inputPrompt.trim()}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold transition-all cursor-pointer shrink-0 shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* AI Disclosure */}
          <p className="text-center text-4xs text-slate-400">
            Asisten dapat melakukan kesalahan. Periksa jadwal resmi sebelum mengambil keputusan.
          </p>
        </div>
      </aside>
    </div>
  );
};
