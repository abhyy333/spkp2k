import { schedulesService } from './schedules.service';

export interface AssistantAction {
  type: 'OPEN_ROUTE' | 'OPEN_CONFLICTS' | 'OPEN_SMART_RESCHEDULE' | 'OPEN_UNSCHEDULED' | 'OPEN_OPTIMIZATION' | 'FOCUS_SCHEDULE';
  title: string;
  payload: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actions?: AssistantAction[];
  source?: 'published_schedule' | 'draft' | 'faq' | 'fallback';
}

export interface AssistantRequestPayload {
  message: string;
  role: 'public' | 'dosen' | 'admin';
  userId?: string;
  userLecturerName?: string;
  localPersonalIds?: string[];
}

export const assistantService = {
  async sendMessage(
    payload: AssistantRequestPayload,
    signal?: AbortSignal
  ): Promise<{ answer: string; actions?: AssistantAction[]; source?: string }> {
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      return {
        answer: data.answer || 'Asisten Akademik siap membantu.',
        actions: Array.isArray(data.actions) ? data.actions : [],
        source: data.source || 'published_schedule',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      console.warn('Assistant service server error, running local fallback query:', err);

      // Client-side fallback resolution
      try {
        const text = payload.message.toLowerCase();
        const sched = await schedulesService.getPublishedSchedule();

        if (text.includes('senin') || text.includes('selasa') || text.includes('rabu') || text.includes('kamis') || text.includes('jumat') || text.includes('hari ini')) {
          let dayToSearch = 'Senin';
          if (text.includes('selasa')) dayToSearch = 'Selasa';
          else if (text.includes('rabu')) dayToSearch = 'Rabu';
          else if (text.includes('kamis')) dayToSearch = 'Kamis';
          else if (text.includes('jumat')) dayToSearch = 'Jumat';

          const items = sched.filter((s) => String(s.day || '').toLowerCase().includes(dayToSearch.toLowerCase()));

          if (items.length === 0) {
            return {
              answer: `Tidak ada perkuliahan resmi yang dijadwalkan pada hari ${dayToSearch}.`,
              source: 'published_schedule',
            };
          }

          let ans = `Untuk hari ${dayToSearch} terdapat ${items.length} kelas:\n\n`;
          items.forEach((item, idx) => {
            ans += `${idx + 1}. ${item.course_name} — Kelas ${item.class_name || 'A'}\n`;
            ans += `   ${item.start_time}–${item.end_time} (${item.sks} SKS)\n`;
            ans += `   Ruangan: ${item.room_name || 'Ruangan'}\n\n`;
          });

          return { answer: ans.trim(), source: 'published_schedule' };
        }
      } catch (_) {}

      return {
        answer: 'Asisten sedang tidak tersedia. Pencarian jadwal dan menu aplikasi tetap dapat digunakan secara lokal.',
        source: 'fallback',
      };
    }
  },
};
