import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// Server-side Supabase client for reading schedule data safely
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Initialize Gemini Client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper: Get Current Day Name in Asia/Makassar (WITA)
function getTodayDayName(): string {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Makassar',
      weekday: 'long',
    };
    const formatter = new Intl.DateTimeFormat('id-ID', options);
    const weekdayStr = formatter.format(new Date()).toLowerCase();

    if (weekdayStr.includes('senin')) return 'Senin';
    if (weekdayStr.includes('selasa')) return 'Selasa';
    if (weekdayStr.includes('rabu')) return 'Rabu';
    if (weekdayStr.includes('kamis')) return 'Kamis';
    if (weekdayStr.includes('jumat') || weekdayStr.includes("jum'at")) return 'Jumat';
    if (weekdayStr.includes('sabtu')) return 'Sabtu';
    if (weekdayStr.includes('minggu')) return 'Minggu';
  } catch (_) {}
  return 'Senin';
}

// Helper: Extract Day Name from Text
function extractDayFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(senin)\b/.test(lower)) return 'Senin';
  if (/\b(selasa)\b/.test(lower)) return 'Selasa';
  if (/\b(rabu)\b/.test(lower)) return 'Rabu';
  if (/\b(kamis)\b/.test(lower)) return 'Kamis';
  if (/\b(jumat|jum'at)\b/.test(lower)) return 'Jumat';
  if (/\b(sabtu)\b/.test(lower)) return 'Sabtu';
  if (/\b(minggu)\b/.test(lower)) return 'Minggu';
  return null;
}

// Helper: Format Clean Plain-Text Schedule List
function formatScheduleListText(dayTitle: string, items: any[]): string {
  if (!items || items.length === 0) {
    return `Tidak ada perkuliahan resmi yang dijadwalkan pada hari ${dayTitle}.`;
  }

  let text = `Untuk hari ${dayTitle} terdapat ${items.length} kelas:\n\n`;
  items.forEach((item, idx) => {
    const courseName = item.course_name || item.name || 'Mata Kuliah';
    const className = item.class_name || item.class_code || 'A';
    const startTime = item.start_time || '08:00';
    const endTime = item.end_time || '09:40';
    const roomName = item.room_name || item.room_code || 'Ruangan';
    const sks = item.sks || item.effective_sks || 2;
    const lecturer = Array.isArray(item.lecturer_names)
      ? item.lecturer_names.join(', ')
      : item.lecturer_names || '-';

    text += `${idx + 1}. ${courseName} — Kelas ${className}\n`;
    text += `   ${startTime}–${endTime} (${sks} SKS)\n`;
    text += `   Ruangan: ${roomName}\n`;
    text += `   Dosen: ${lecturer}\n\n`;
  });

  return text.trim();
}

// Helper: Clean Raw Markdown Symbols (Asterisks, Hash, etc.)
function cleanMarkdownSymbols(str: string): string {
  if (!str) return '';
  return str
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/###\s*/g, '')
    .replace(/##\s*/g, '')
    .replace(/#\s*/g, '')
    .trim();
}

// POST /api/assistant
app.post('/api/assistant', async (req, res) => {
  try {
    const { message, role = 'public', userLecturerName, localPersonalIds } = req.body || {};
    const text = String(message || '').trim();

    if (!text) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }

    const lowerText = text.toLowerCase();

    // ----------------------------------------------------
    // LAYER 1: DETERMINISTIC INTENT ROUTER & DATA GROUNDING
    // ----------------------------------------------------

    // 1. FAQ & Navigation Shortcuts
    if (lowerText.includes('buka jadwal ujian') || lowerText === 'cari ujian') {
      return res.json({
        answer: 'Membuka halaman Jadwal Ujian Resmi.',
        actions: [{ type: 'OPEN_ROUTE', title: 'Buka Jadwal Ujian', payload: '/jadwal-ujian' }],
        source: 'faq',
      });
    }

    if (lowerText.includes('cara atur jadwal') || lowerText.includes('bagaimana atur jadwal')) {
      return res.json({
        answer: 'Untuk mengatur Jadwal Saya:\n1. Buka halaman "Atur Jadwal Saya"\n2. Pilih/centang mata kuliah dan kelas pilihan Anda\n3. Klik "Simpan Jadwal Saya"\n4. Anda dapat melihat matriks personal, mengecek bentrok, serta mengunduh PDF atau file .ics untuk Kalender HP.',
        actions: [{ type: 'OPEN_ROUTE', title: 'Buka Atur Jadwal Saya', payload: '/atur-jadwal-saya' }],
        source: 'faq',
      });
    }

    if (lowerText.includes('cetak pdf') || lowerText.includes('unduh pdf')) {
      return res.json({
        answer: 'Anda dapat mengunduh PDF jadwal resmi dengan mengklik tombol "Unduh PDF" atau "Cetak" di bagian kanan atas tabel jadwal.',
        source: 'faq',
      });
    }

    // 2. Fetch All Current Published Schedule Rows once for deterministic routing
    let allPublishedRows: any[] = [];
    if (supabase) {
      try {
        const { data: pubData } = await supabase.from('current_published_schedule').select('*');
        if (pubData) allPublishedRows = pubData;
      } catch (err) {
        console.warn('Error fetching current_published_schedule:', err);
      }
    }

    // Check if user is asking for Today's Schedule
    const isTodayQuery =
      lowerText.includes('hari ini') ||
      lowerText.includes('sekarang') ||
      lowerText === 'jadwal hari ini' ||
      lowerText === 'apa jadwal hari ini' ||
      lowerText === 'kelas hari ini';

    // Check if user specified a day name (Senin, Selasa, etc.)
    const specifiedDay = extractDayFromText(text);

    if (isTodayQuery || specifiedDay) {
      const dayToSearch = specifiedDay || getTodayDayName();

      if (!allPublishedRows || allPublishedRows.length === 0) {
        return res.json({
          answer: 'Jadwal Perkuliahan resmi saat ini belum tersedia.',
          source: 'published_schedule',
        });
      }

      // Filter rows for that day
      let dayRows = allPublishedRows.filter((r) => {
        const rDay = (r.day || r.day_name || '').toString().toLowerCase();
        return rDay.includes(dayToSearch.toLowerCase());
      });

      // Role-specific filtering:
      if (role === 'dosen' && userLecturerName) {
        dayRows = dayRows.filter((r) => {
          const lNames = (r.lecturer_names || '').toString().toLowerCase();
          return lNames.includes(userLecturerName.toLowerCase());
        });
      } else if (role === 'public' && lowerText.includes('saya')) {
        if (Array.isArray(localPersonalIds) && localPersonalIds.length > 0) {
          dayRows = dayRows.filter((r) =>
            localPersonalIds.includes(String(r.id)) ||
            localPersonalIds.includes(String(r.course_offering_id))
          );
        } else {
          return res.json({
            answer: 'Belum ada mata kuliah yang Anda tambahkan ke "Jadwal Saya". Anda dapat memilih mata kuliah di menu "Atur Jadwal Saya".',
            actions: [{ type: 'OPEN_ROUTE', title: 'Atur Jadwal Saya', payload: '/atur-jadwal-saya' }],
            source: 'published_schedule',
          });
        }
      }

      // Sort by start_time / start_minute
      dayRows.sort((a, b) => (a.start_minute || 0) - (b.start_minute || 0));

      const responseText = formatScheduleListText(dayToSearch, dayRows);
      return res.json({
        answer: responseText,
        cards: dayRows.slice(0, 5),
        source: 'published_schedule',
      });
    }

    // 3. Course Search Query (e.g. "kapan Kimia Dasar?", "jadwal Fisika Mekanika")
    const isSearchQuery =
      lowerText.includes('kapan') ||
      lowerText.includes('dimana') ||
      lowerText.startsWith('jadwal ') ||
      lowerText.includes('kelas ');

    if (isSearchQuery && allPublishedRows.length > 0) {
      // Remove filler query terms to isolate course keyword
      const cleanedKey = lowerText
        ? lowerText
            .replace(/\bkapan\b/g, '')
            .replace(/\bdimana\b/g, '')
            .replace(/\bjadwal\b/g, '')
            .replace(/\bmata\s*kuliah\b/g, '')
            .replace(/\bkelas\b/g, '')
            .replace(/\bapa\b/g, '')
            .replace(/\bsiapa\b/g, '')
            .replace(/\bdosen\b/g, '')
            .replace(/\bhari\b/g, '')
            .replace(/\bjam\b/g, '')
            .replace(/\btolong\b/g, '')
            .replace(/\bcek\b/g, '')
            .replace(/[?"]/g, '')
            .trim()
        : '';

      if (cleanedKey && cleanedKey.length >= 2) {
        const matchingRows = allPublishedRows.filter((r) => {
          const cName = (r.course_name || '').toString().toLowerCase();
          const cCode = (r.course_code || '').toString().toLowerCase();
          return cName.includes(cleanedKey) || cCode.includes(cleanedKey);
        });

        if (matchingRows.length > 0) {
          let text = `Hasil pencarian mata kuliah '${cleanedKey}' (${matchingRows.length} ditemukan):\n\n`;
          matchingRows.forEach((item, idx) => {
            const courseName = item.course_name || 'Mata Kuliah';
            const className = item.class_name || item.class_code || 'A';
            const day = item.day || 'Senin';
            const startTime = item.start_time || '08:00';
            const endTime = item.end_time || '09:40';
            const roomName = item.room_name || item.room_code || 'Ruangan';
            const sks = item.sks || item.effective_sks || 2;
            const lecturer = Array.isArray(item.lecturer_names)
              ? item.lecturer_names.join(', ')
              : item.lecturer_names || '-';

            text += `${idx + 1}. ${courseName} — Kelas ${className}\n`;
            text += `   Hari: ${day}\n`;
            text += `   Waktu: ${startTime}–${endTime} (${sks} SKS)\n`;
            text += `   Ruangan: ${roomName}\n`;
            text += `   Dosen: ${lecturer}\n\n`;
          });

          return res.json({
            answer: text.trim(),
            cards: matchingRows.slice(0, 5),
            source: 'published_schedule',
          });
        }
      }
    }

    // 4. Exam Schedule Query
    if (lowerText.includes('ujian') || lowerText.includes('uts') || lowerText.includes('uas')) {
      let examRows: any[] = [];
      if (supabase) {
        try {
          const { data: exData } = await supabase.from('current_published_exams').select('*');
          if (exData) examRows = exData;
        } catch (_) {}
      }

      if (examRows.length > 0) {
        let text = `Jadwal Ujian Resmi (${examRows.length} ujian terjadwal):\n\n`;
        examRows.slice(0, 5).forEach((ex, idx) => {
          text += `${idx + 1}. ${ex.course_name || 'Mata Kuliah'} (${ex.class_name || 'A'})\n`;
          text += `   ${ex.exam_type || 'Ujian'}: ${ex.day || 'Senin'}, ${ex.exam_date || ''} · ${ex.start_time || '08:00'}–${ex.end_time || '09:40'}\n`;
          text += `   Ruangan: ${ex.room_name || 'Ruangan'}\n\n`;
        });
        return res.json({
          answer: text.trim(),
          actions: [{ type: 'OPEN_ROUTE', title: 'Buka Halaman Ujian', payload: '/jadwal-ujian' }],
          source: 'published_schedule',
        });
      } else {
        return res.json({
          answer: 'Jadwal Ujian Resmi saat ini belum dipublikasikan.',
          actions: [{ type: 'OPEN_ROUTE', title: 'Lihat Halaman Ujian', payload: '/jadwal-ujian' }],
          source: 'published_schedule',
        });
      }
    }

    // 5. Admin Safe Tools (Readiness, Conflicts, Unscheduled, Smart Reschedule)
    if (role === 'admin') {
      if (lowerText.includes('kesiapan') || lowerText.includes('siap publish') || lowerText.includes('status draft')) {
        let scheduledCount = 0;
        let unscheduledCount = 0;
        let hardConflicts = 0;

        if (supabase) {
          try {
            const { data: offerings } = await supabase.from('course_offerings').select('id, is_scheduled');
            if (offerings) {
              scheduledCount = offerings.filter((o: any) => o.is_scheduled).length;
              unscheduledCount = offerings.filter((o: any) => !o.is_scheduled).length;
            }
            const { data: conflicts } = await supabase.from('schedule_conflicts').select('id, severity').eq('is_resolved', false);
            if (conflicts) {
              hardConflicts = conflicts.filter((c: any) => c.severity === 'HARD').length;
            }
          } catch (_) {}
        }

        const isReady = unscheduledCount === 0 && hardConflicts === 0;
        let text = `Status Kesiapan Draf Jadwal:\n\n`;
        text += `• Kelas Terjadwal: ${scheduledCount}\n`;
        text += `• Kelas Belum Terjadwal: ${unscheduledCount}\n`;
        text += `• Konflik Utama (Hard): ${hardConflicts}\n\n`;
        text += isReady
          ? 'Draf jadwal SUDAH SIAP diterbitkan.'
          : `Draf jadwal BELUM SIAP diterbitkan karena masih terdapat ${unscheduledCount} kelas yang belum memiliki slot waktu.`;

        const actions: any[] = [];
        if (unscheduledCount > 0) {
          actions.push({ type: 'OPEN_UNSCHEDULED', title: 'Lihat Kelas Belum Terjadwal', payload: '/penyusunan-jadwal' });
        }
        if (hardConflicts > 0) {
          actions.push({ type: 'OPEN_CONFLICTS', title: 'Buka Konflik Jadwal', payload: '/konflik-jadwal' });
        }

        return res.json({
          answer: text,
          actions,
          source: 'draft',
        });
      }

      if (lowerText.includes('konflik') || lowerText.includes('bentrok')) {
        return res.json({
          answer: 'Membuka panel Ringkasan Konflik Jadwal untuk meninjau bentrok dosen dan ruangan.',
          actions: [{ type: 'OPEN_CONFLICTS', title: 'Buka Konflik Jadwal', payload: '/konflik-jadwal' }],
          source: 'draft',
        });
      }

      if (lowerText.includes('belum terjadwal')) {
        return res.json({
          answer: 'Membuka halaman penyusunan jadwal untuk melihat daftar kelas yang belum memiliki slot waktu.',
          actions: [{ type: 'OPEN_UNSCHEDULED', title: 'Lihat Kelas Belum Terjadwal', payload: '/penyusunan-jadwal' }],
          source: 'draft',
        });
      }

      if (lowerText.includes('smart reschedule') || lowerText.includes('rekomendasi')) {
        return res.json({
          answer: 'Fitur Smart Rescheduling menganalisis ketersediaan dosen dan ruangan menggunakan constraint engine untuk merekomendasikan slot waktu optimal.',
          actions: [{ type: 'OPEN_SMART_RESCHEDULE', title: 'Buka Rekomendasi Smart Reschedule', payload: 'OPEN_SMART_RESCHEDULE' }],
          source: 'draft',
        });
      }
    }

    // ----------------------------------------------------
    // LAYER 2: GEMINI API FOR COMPLEX NATURAL LANGUAGE
    // ----------------------------------------------------
    const ai = getGeminiClient();

    // If Gemini is not available, return clean fallback based on deterministic schedule
    if (!ai) {
      let fallbackText = 'Asisten Akademik JTE siap membantu.';
      if (allPublishedRows.length > 0) {
        fallbackText = `Informasi Jadwal Resmi JTE Universitas Mataram:\n\nTotal terdapat ${allPublishedRows.length} kelas terdaftar. Gunakan kata kunci nama hari (seperti 'jadwal Rabu') atau nama mata kuliah (seperti 'Kimia Dasar') untuk pencarian cepat.`;
      }
      return res.json({
        answer: fallbackText,
        source: 'published_schedule',
      });
    }

    // Construct Clean System Instruction
    let systemInstruction = 'Anda adalah Asisten Akademik JTE Universitas Mataram.';
    if (role === 'public') {
      systemInstruction = `Anda adalah Asisten Akademik Jurusan Teknik Elektro Universitas Mataram.
Tugas Anda: Membantu mahasiswa dan publik menjawab pertanyaan seputar perkuliahan dan fitur aplikasi.
Aturan Penting:
- Jangan gunakan simbol markdown mentah seperti ** atau ###.
- Berikan jawaban langsung, ringkas, dan sopan.`;
    } else if (role === 'dosen') {
      systemInstruction = `Anda adalah Asisten Akademik Jurusan Teknik Elektro Universitas Mataram untuk Dosen.
Tugas Anda: Membantu dosen mendapatkan informasi perkuliahan dan bantuan aplikasi.
- Jangan gunakan simbol markdown mentah seperti ** atau ###.`;
    } else if (role === 'admin') {
      systemInstruction = `Anda adalah Asisten Akademik Jurusan Teknik Elektro Universitas Mataram untuk Admin.
Tugas Anda: Memberikan penjelasan terkait sistem penyusunan jadwal, optimasi Simulated Annealing, dan alur kerja.
- Jangan gunakan simbol markdown mentah seperti ** atau ###.`;
    }

    const promptText = `
PERTANYAAN PENGGUNA: "${text}"

DATA KONTEKS JADWAL TERSEDIA:
${JSON.stringify(allPublishedRows.slice(0, 10), null, 2)}

Berikan jawaban ringkas tanpa simbol markdown mentah (** atau ###).
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const rawAnswerText = response.text || 'Tidak dapat memproses tanggapan saat ini.';
    const cleanAnswerText = cleanMarkdownSymbols(rawAnswerText);

    return res.json({
      answer: cleanAnswerText,
      source: role === 'admin' ? 'draft' : 'published_schedule',
    });

  } catch (err: any) {
    console.error('Assistant API Error:', err);
    return res.status(500).json({
      answer: 'Asisten sedang tidak tersedia. Pencarian jadwal dan menu aplikasi tetap dapat digunakan secara lokal.',
      source: 'fallback',
    });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const templatePath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
