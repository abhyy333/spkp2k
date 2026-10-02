import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  X,
  Minus,
  Send,
  ArrowRight,
  RotateCcw,
  CheckCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { assistantService, AssistantMessage, AssistantAction } from '../../services/assistant.service';
import { cn } from '../../lib/utils';

interface FloatingAssistantChatbotProps {
  initialQuery?: string;
  isOpenExternal?: boolean;
  onCloseExternal?: () => void;
  onOpenSmartRescheduleModal?: () => void;
}

// Error Boundary for Assistant Panel
class AssistantErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onClose: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Assistant Panel Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed bottom-6 right-6 z-[10000] p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full space-y-3 text-center animate-in fade-in zoom-in-95">
          <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Asisten Akademik Gagal Dimuat</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">Terjadi kesalahan sistem saat memuat tampilan asisten.</p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Coba Lagi
            </button>
            <button
              type="button"
              onClick={this.props.onClose}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const FloatingAssistantChatbot: React.FC<FloatingAssistantChatbotProps> = ({
  initialQuery,
  isOpenExternal,
  onCloseExternal,
  onOpenSmartRescheduleModal,
}) => {
  const { user, profile, isAdmin, isDosen } = useAuth();
  const navigate = useNavigate();

  // Canonical state
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Role detection
  const role: 'admin' | 'dosen' | 'public' = isAdmin
    ? 'admin'
    : isDosen
    ? 'dosen'
    : 'public';

  // Subtitle per role
  const subtitleMap = {
    public: 'Siap membantu informasi jadwal Anda',
    dosen: 'Siap membantu jadwal mengajar Anda',
    admin: 'Siap membantu pengelolaan jadwal',
  };

  // Welcome message per role
  const welcomeMap = {
    public:
      'Halo! Saya Asisten Akademik JTE Universitas Mataram. Saya dapat membantu mencari jadwal kuliah, ujian, atau membantu menggunakan Jadwal Saya. 🎓',
    dosen:
      'Halo! Saya dapat membantu melihat jadwal mengajar, ruangan, dan jadwal pengawasan ujian Anda.',
    admin:
      'Halo! Saya dapat membantu mengecek kesiapan jadwal, konflik, kelas belum terjadwal, Smart Rescheduling, dan hasil optimasi.',
  };

  // Placeholder per role
  const placeholderMap = {
    public: 'Tanyakan sesuatu tentang jadwal...',
    dosen: 'Tanyakan jadwal mengajar Anda...',
    admin: 'Tanyakan status atau pengelolaan jadwal...',
  };

  // Quick action chips per role
  const chipsMap = {
    public: [
      { label: 'Cek jadwal', query: 'Cari jadwal perkuliahan semester 1' },
      { label: 'Cari ujian', query: 'Kapan jadwal ujian UTS/UAS?' },
      { label: 'Cek bentrok Jadwal Saya', query: 'Apakah ada bentrok pada Jadwal Saya?' },
      { label: 'Cara Atur Jadwal Saya', query: 'Bagaimana cara atur jadwal saya?' },
    ],
    dosen: [
      { label: 'Jadwal saya hari ini', query: 'Jadwal mengajar saya hari ini' },
      { label: 'Jadwal mengajar', query: 'Tampilkan seluruh jadwal mengajar saya' },
      { label: 'Jadwal pengawasan', query: 'Jadwal pengawasan ujian saya' },
      { label: 'Info ruangan', query: 'Informasi penggunaan ruangan' },
    ],
    admin: [
      { label: 'Cek kesiapan jadwal', query: 'Apakah draft jadwal sudah siap publish?' },
      { label: 'Lihat konflik', query: 'lihat konflik' },
      { label: 'Kelas belum terjadwal', query: 'Daftar kelas yang belum terjadwal' },
      { label: 'Smart Rescheduling', query: 'smart rescheduling' },
    ],
  };

  // Initialize Welcome Message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          sender: 'assistant',
          text: welcomeMap[role],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [role]);

  // Sync with external opening (e.g. from SearchModal / Ctrl+K)
  useEffect(() => {
    if (isOpenExternal !== undefined) {
      setAssistantOpen(isOpenExternal);
      if (isOpenExternal) setIsMinimized(false);
    }
  }, [isOpenExternal]);

  // Listen for open-assistant-query event from SearchModal / Ctrl+K
  useEffect(() => {
    const handleOpenQuery = (e: Event) => {
      const customEv = e as CustomEvent<{ query: string }>;
      if (customEv.detail && customEv.detail.query) {
        setAssistantOpen(true);
        setIsMinimized(false);
        handleSendMessage(customEv.detail.query);
      }
    };
    window.addEventListener('open-assistant-query', handleOpenQuery);
    return () => window.removeEventListener('open-assistant-query', handleOpenQuery);
  }, []);

  // Handle initialQuery if passed
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setAssistantOpen(true);
      setIsMinimized(false);
      handleSendMessage(initialQuery.trim());
    }
  }, [initialQuery]);

  // Handle Escape Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && assistantOpen) {
        setAssistantOpen(false);
        if (onCloseExternal) onCloseExternal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assistantOpen, onCloseExternal]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (assistantOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, assistantOpen, isMinimized, loading]);

  const getLocalPersonalIds = (): string[] => {
    const ids: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('spk-personal-schedule:') || key.startsWith('spk-dosen-pinned:'))) {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            const list = Array.isArray(parsed) ? parsed : parsed.selectedOfferingIds || [];
            ids.push(...list);
          }
        }
      }
    } catch {}
    return Array.from(new Set(ids));
  };

  const handleSendMessage = async (textToSend?: string) => {
    const queryText = (textToSend || inputValue).trim();
    if (!queryText || loading) return;

    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const localPersonalIds = getLocalPersonalIds();

      const res = await assistantService.sendMessage(
        {
          message: queryText,
          role,
          userId: user?.id,
          userLecturerName: profile?.full_name || user?.email || 'Dosen',
          localPersonalIds,
        },
        controller.signal
      );

      const botMsg: AssistantMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: res.actions,
        source: res.source as any,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'assistant',
            text: 'Asisten sedang tidak tersedia. Silakan gunakan menu pencarian atau filter jadwal.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            source: 'fallback',
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = (action: AssistantAction) => {
    if (action.type === 'OPEN_ROUTE' && action.payload) {
      navigate(action.payload);
    } else if (action.type === 'OPEN_CONFLICTS') {
      navigate('/konflik-jadwal');
    } else if (action.type === 'OPEN_SMART_RESCHEDULE') {
      if (onOpenSmartRescheduleModal) {
        onOpenSmartRescheduleModal();
      } else {
        navigate('/penyusunan-jadwal');
      }
    } else if (action.type === 'OPEN_UNSCHEDULED') {
      navigate('/penyusunan-jadwal');
    }
  };

  const handleClearConversation = () => {
    setMessages([
      {
        id: `welcome-reset-${Date.now()}`,
        sender: 'assistant',
        text: welcomeMap[role],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const portalContent = (
    <AssistantErrorBoundary onClose={() => setAssistantOpen(false)}>
      {/* Floating Assistant Chat Panel Overlay */}
      {assistantOpen && (
        <div
          ref={panelRef}
          className={cn(
            'fixed z-[9999] transition-all duration-200 ease-out flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden',
            // Desktop (> 640px)
            'right-6 bottom-[24px] sm:bottom-[32px] w-[92vw] sm:w-[400px] h-[560px] max-h-[82vh] rounded-[22px]',
            isMinimized && 'h-14 overflow-hidden'
          )}
        >
          {/* Panel Header */}
          <div className="p-3.5 px-4 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                  Asisten Akademik
                </h3>
                <p className="text-3xs text-slate-500 dark:text-slate-400">
                  {subtitleMap[role]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearConversation}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Hapus Percakapan"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={isMinimized ? 'Perbesar' : 'Kecilkan'}
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssistantOpen(false);
                  if (onCloseExternal) onCloseExternal();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                title="Tutup Panel (X)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Panel Body */}
          {!isMinimized && (
            <>
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30 dark:bg-slate-900/40">
                {messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex flex-col',
                        isUser ? 'items-end' : 'items-start'
                      )}
                    >
                      <div className="flex items-end gap-1.5 max-w-[85%]">
                        {!isUser && (
                          <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center shrink-0 mb-1">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'p-3 text-xs leading-relaxed space-y-1.5 shadow-2xs break-words',
                            isUser
                              ? 'bg-blue-600 text-white rounded-2xl rounded-tr-xs font-medium'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-xs border border-slate-100 dark:border-slate-700/80'
                          )}
                        >
                          <div className="whitespace-pre-line">{msg.text}</div>

                          {/* Action CTAs inside assistant message */}
                          {msg.actions && msg.actions.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-1.5">
                              {msg.actions.map((act, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleExecuteAction(act)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 rounded-lg border border-blue-200/80 dark:border-blue-800/80 transition-colors cursor-pointer"
                                >
                                  <span>{act.title}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <span className="text-[10px] text-slate-400 mt-1 px-1 flex items-center gap-0.5">
                        {msg.timestamp}
                        {isUser && <CheckCheck className="w-3 h-3 text-blue-500" />}
                      </span>
                    </div>
                  );
                })}

                {/* Loading Typing Indicator */}
                {loading && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 animate-bounce" />
                    </div>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-3 py-2 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse delay-150" />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse delay-300" />
                      <span className="text-3xs font-semibold text-slate-500 ml-1">Menganalisis...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Action Chips Bar */}
              <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {chipsMap[role].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(chip.query)}
                    className="px-2.5 py-1 text-3xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shrink-0 transition-colors shadow-2xs cursor-pointer select-none"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder={placeholderMap[role]}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={loading}
                  className="flex-1 py-2 px-3.5 bg-slate-100/90 dark:bg-slate-800 rounded-full text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || loading}
                  className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Kirim Pesan"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Floating Launcher Button — Present ONLY when Closed */}
      {!assistantOpen && (
        <button
          type="button"
          onClick={() => {
            setAssistantOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 z-[10000] w-[56px] h-[56px] rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-95 group ring-4 ring-blue-500/20"
          title="Buka Asisten Akademik"
        >
          <Bot className="w-7 h-7 text-white transition-transform group-hover:scale-110" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
        </button>
      )}
    </AssistantErrorBoundary>
  );

  return typeof document !== 'undefined' ? createPortal(portalContent, document.body) : null;
};
