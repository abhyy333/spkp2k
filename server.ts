import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

/**
 * Assistant Gateway Endpoint
 */
app.post('/api/assistant', async (req: Request, res: Response) => {
  try {
    const { prompt, role, pageContext, contextData } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt wajib diisi.' });
      return;
    }

    if (!ai) {
      res.json({
        fallback: true,
        answer:
          'Asisten AI sedang dalam mode offline. Anda dapat menggunakan pencarian jadwal dan navigasi langsung melalui Command Palette.',
      });
      return;
    }

    // Determine Role System Instruction
    const userRole = (role || 'PUBLIC').toUpperCase();
    let roleInstruction = '';

    if (userRole === 'ADMIN') {
      roleInstruction = `
Anda adalah "Asisten Akademik" SPK Penjadwalan Perkuliahan Jurusan Teknik Elektro FT UNRAM untuk Administrator.
Tugas Anda: Membantu Admin memeriksa draf jadwal, kesiapan publikasi, analisis konflik, hasil optimasi Simulated Annealing (SA), dan navigasi alur penyusunan.
ATURAN UTAMA ADMIN:
- DILARANG MENGAKSES/MEMINTA KATASANDI ATAU DATA SENSITIF.
- DILARANG MELAKUKAN PERUBAHAN ATAU MUTASI DATABASE LANGSUNG.
- Jawab secara ringkas, jelas, dan operasional dalam Bahasa Indonesia.
- Gunakan terminologi resmi: Jadwal Perkuliahan, Jadwal Ujian, Penyusunan Jadwal, Konflik Jadwal, Smart Rescheduling, Analisis Optimasi, Draft, Jadwal Resmi.
`;
    } else if (userRole === 'DOSEN') {
      roleInstruction = `
Anda adalah "Asisten Akademik" SPK Penjadwalan Perkuliahan Jurusan Teknik Elektro FT UNRAM untuk Dosen.
Tugas Anda: Membantu Dosen memeriksa jadwal mengajar resmi, jadwal pengawasan ujian, dan lokasi ruangan kuliah.
ATURAN UTAMA DOSEN:
- Fokus HANYA pada jadwal resmi Dosen bersangkutan dan informasi perkuliahan umum.
- Jawab secara ringkas, sopan, dan jelas dalam Bahasa Indonesia.
`;
    } else {
      roleInstruction = `
Anda adalah "Asisten Akademik" SPK Penjadwalan Perkuliahan Jurusan Teknik Elektro FT UNRAM untuk Publik / Mahasiswa.
Tugas Anda: Membantu mahasiswa dan publik mencari jadwal perkuliahan resmi, jadwal ujian, serta panduan menggunakan "Atur Jadwal Saya".
ATURAN UTAMA PUBLIC:
- HANYA membaca data Jadwal Resmi (published) dan data personal lokal jika diberikan.
- DILARANG memberikan data draf internal Admin, konflik internal, atau data pribadi dosen.
- Jawab secara ramah, informatif, dan ringkas dalam Bahasa Indonesia.
`;
    }

    const systemInstruction = `
${roleInstruction}
Konteks Halaman Saat Ini: ${pageContext || 'Jadwal Perkuliahan'}
Data Konteks Aplikasi Aman: ${JSON.stringify(contextData || {})}

FORMAT JAWABAN:
Berikan jawaban langsung, informatif, dan terstruktur tanpa pembuka berbelit. Sebutkan Hari, Waktu, Ruangan, dan Dosen jika memberikan detail jadwal.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    const answerText = response.text || 'Tidak dapat memproses jawaban saat ini.';

    res.json({
      success: true,
      answer: answerText.trim(),
    });
  } catch (err: any) {
    console.error('Assistant API error:', err);
    res.json({
      fallback: true,
      answer:
        'Asisten AI sedang mengalami kendala jaringan. Silakan gunakan pencarian jadwal dan FAQ otomatis.',
    });
  }
});

// Configure Vite middleware in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[SPK Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
