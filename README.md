# 🧠 CL-RAG v5 — Mental Health Assistant

Asisten kesehatan mental berbasis RAG (Retrieval-Augmented Generation).
Menjawab pertanyaan seputar kesehatan mental berdasarkan referensi ilmiah,
dilengkapi skrining klinis PHQ-9 dan GAD-7, riwayat percakapan, dan panel
admin untuk mengelola knowledge base.

> ⚠️ Alat bantu edukasi, bukan pengganti diagnosis profesional.
> Darurat: Into The Light Indonesia **119 ext 8**

---

## Arsitektur

```
Browser → Next.js (Vercel, production)
             ├── /api/chat   ──→ Gemini 2.5 Flash (LLM, streaming SSE)
             │               ──→ Pinecone (vector search)
             │               ──→ Gemini Embedding (query embed)
             ├── /api/screen ──→ Pure TypeScript (no LLM, deterministik)
             └── /api/kb/*   ──→ Pinecone + Gemini Embedding

Laptop (lokal saja) → npm run ingest / npm run setup
             ├── Ollama (multilingual-e5-base) — embedding utama, gratis tanpa limit
             ├── Gemini — fallback otomatis kalau Ollama gagal
             └── Admin panel (/admin) — upload dokumen, lihat metrics
```

**Pemisahan penting:**
- **Production (Vercel)** hanya pakai **Gemini** untuk chat dan embedding query — Ollama tidak tersedia di server serverless.
- **Ingest dokumen baru** (`npm run ingest`, `npm run setup`) dijalankan **manual dari laptop**, memakai **Ollama lokal lebih dulu** (gratis, tanpa limit harian), Gemini hanya jadi cadangan kalau Ollama gagal.
- **Admin panel** (`/admin`) didesain untuk diakses **lokal saja** — tidak ada tautan ke sana dari UI production, walau endpoint-nya tetap dilindungi password kalau ter-deploy.

---

## Tech Stack (100% Gratis)

| Layer       | Teknologi                                  | Biaya |
|-------------|---------------------------------------------|-------|
| Frontend    | Next.js 15 (App Router) + React 19          | Gratis |
| LLM         | Google Gemini 2.5 Flash                      | Gratis (free tier) |
| Embedding   | Google `gemini-embedding-001` (768d, scaled) | Gratis (free tier) |
| Embedding lokal | Ollama + `multilingual-e5-base` (768d)  | Gratis, tanpa limit (hanya untuk ingest) |
| Vector DB   | Pinecone Serverless                          | Gratis (100k vectors) |
| Hosting     | Vercel Hobby                                 | Gratis |
| **Total**   |                                               | **$0 / bulan** |

---

## Setup Lokal

```bash
# 1. Clone & install
git clone <repo-url>
cd cl-rag-v5
npm install

# 2. Konfigurasi environment
cp .env.example .env.local
# isi GEMINI_API_KEY, PINECONE_API_KEY, ADMIN_PASSWORD, dst (lihat bagian di bawah)

# 3. (Opsional tapi disarankan) Install Ollama untuk embedding lokal saat ingest
ollama pull yxchia/multilingual-e5-base

# 4. Inisialisasi Pinecone + seed 10 dokumen referensi dasar
npm run setup

# 5. Jalankan dev server
npm run dev
```

Buka:
- **http://localhost:3000** — Chat & Skrining
- **http://localhost:3000/admin** — Admin panel (upload dokumen, lihat metrics)

---

## Cara Dapat API Keys (Semua Gratis)

### Gemini API Key

1. Buka [aistudio.google.com](https://aistudio.google.com)
2. Sign in dengan akun Google
3. Klik **"Get API key"** di sidebar
4. Klik **"Create API key"**
5. Salin ke `GEMINI_API_KEY` di `.env.local`

Tidak perlu kartu kredit.

### Pinecone API Key

1. Buka [app.pinecone.io](https://app.pinecone.io)
2. Daftar akun (gratis, tidak butuh kartu kredit)
3. Buka **API Keys** di sidebar
4. Salin ke `PINECONE_API_KEY` di `.env.local`
5. `PINECONE_INDEX_NAME` bisa dibiarkan `cl-rag-mental-health` — index dibuat otomatis saat `npm run setup` (768 dimensi, cosine, region `us-east-1`).

### Admin Password

```bash
node -e "const c=require('crypto');console.log(c.createHash('sha256').update('PASSWORD_KAMU').digest('hex'))"
```

Isi `ADMIN_PASSWORD` dengan password plaintext, dan `NEXT_PUBLIC_ADMIN_HASH` dengan hasil hash di atas — keduanya harus dari password yang sama.

> Catatan keamanan: admin panel **wajib login ulang setiap refresh halaman** (tidak ada sesi yang tersimpan). Ini sengaja, demi keamanan.

---

## Menambah Jurnal / Referensi Baru

### Cara 1 — Upload manual via Admin Panel

1. Buka `/admin` → login
2. Tab **Knowledge Base** → isi form upload (file `.pdf`/`.txt`, nama sumber, tags)
3. Klik **Upload & Indeks**

### Cara 2 — Batch dari folder (lebih cepat untuk banyak file)

```bash
mkdir -p docs
cp ~/Downloads/jurnal-baru.pdf docs/
npm run ingest
```

Script ini otomatis: ekstrak teks → chunk → embed (Ollama dulu, Gemini cadangan) → upsert ke Pinecone, dengan dedup via manifest lokal (`scripts/.ingest-manifest.json`) sehingga file yang sudah diproses tidak diulang.

---

## Deploy ke Vercel

1. Push repo ke GitHub
2. Buka [vercel.com/new](https://vercel.com/new) → Import repo
3. Framework: **Next.js** (auto-detected)
4. Tambahkan environment variables (lihat tabel di bawah)
5. Klik **Deploy**
6. Setelah deploy berhasil, kalau index Pinecone production belum diisi seed data:

   ```bash
   npm run setup
   ```

   (Index Pinecone bersifat global, tidak terikat ke environment Vercel tertentu — kalau kamu sudah jalankan `npm run setup` lokal dengan `PINECONE_INDEX_NAME` yang sama, production otomatis ikut terisi tanpa langkah tambahan.)

---

## Fitur

- 💬 **Chat RAG** — jawaban berbasis referensi ilmiah dengan sitasi, riwayat percakapan tersimpan di browser (localStorage)
- 🩺 **Skrining PHQ-9 & GAD-7** — alat skrining depresi dan kecemasan terstandar, scoring instan tanpa LLM
- 🆘 **Deteksi krisis otomatis** — keyword matching dengan hotline langsung
- 📚 **Admin panel (lokal)** — upload dokumen baru, lihat & reset knowledge base
- 📊 **Metrics (lokal)** — pantau jumlah chat, skrining selesai, dan deteksi krisis
- 🎨 **UI minimalis** — desain gelap terinspirasi ChatGPT/Gemini, sidebar riwayat collapsible

---

## Deployment Checklist

**Sebelum deploy:**
- [ ] `.env.local` terisi semua nilai (kecuali `OLLAMA_*`, opsional untuk lokal saja)
- [ ] `npm run setup` berhasil tanpa error
- [ ] `npm run build` tanpa error
- [ ] `npm run dev` → test chat, test PHQ-9/GAD-7, test `/admin` (KB + Metrics)

**Di Vercel dashboard** (Settings → Environment Variables):

| Variable | Environment | Wajib? |
|---|---|---|
| `GEMINI_API_KEY` | Production + Preview | Ya |
| `PINECONE_API_KEY` | Production + Preview | Ya |
| `PINECONE_INDEX_NAME` | Production + Preview | Ya |
| `ADMIN_PASSWORD` | Production + Preview | Opsional* |
| `NEXT_PUBLIC_ADMIN_HASH` | Production + Preview | Opsional* |

\* Admin panel didesain lokal-only, tapi endpoint API tetap aman kalau env ini ikut di-set di Vercel — hanya tidak ada UI yang mengarahkan ke sana di production.

**Setelah deploy:**
- [ ] Buka URL Vercel → test chat
- [ ] Pastikan **tidak** mengarahkan trafik publik ke `/admin` di URL production

---

## Struktur Project

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts         (Node.js runtime, SSE streaming)
│   │   ├── screen/route.ts       (Node.js runtime, scoring sinkron)
│   │   ├── admin/metrics/route.ts
│   │   └── kb/{list,upload,reset}/route.ts
│   ├── admin/page.tsx             (lokal-only, login wajib tiap refresh)
│   ├── layout.tsx
│   └── page.tsx                   (sidebar riwayat + chat/skrining)
├── components/
│   ├── chat/        (ChatInterface, ChatMessage, Sidebar, dll)
│   ├── screening/   (ScreeningForm, ScreeningTabs, ProgressBar)
│   └── admin/       (KBManager, MetricsPanel)
├── lib/
│   ├── config.ts        (konstanta, prompt, seed dokumen)
│   ├── screening.ts      (scoring PHQ-9/GAD-7)
│   ├── metrics.ts         (counter via Pinecone)
│   ├── useConversations.ts (riwayat chat — localStorage)
│   ├── kb/                (chunking, ekstraksi file)
│   └── rag/                (embedding, retrieval, generation)
└── styles/globals.css

scripts/
├── setup-pinecone.ts   (one-time: buat index + seed data)
├── ingest-folder.ts    (batch ingest folder docs/)
└── manifest.ts          (dedup lokal untuk ingest)
```

---

## Catatan Teknis Penting

- **Model embedding** (`gemini-embedding-001`) dan **LLM** (`gemini-2.5-flash`) menggantikan model generasi sebelumnya yang sudah di-deprecate Google — lihat komentar di `src/lib/config.ts` untuk detail.
- **Runtime API**: semua route memakai Node.js runtime (bukan Edge), karena Pinecone SDK v7 membawa modul yang membutuhkan `fs` — tidak kompatibel dengan Edge Runtime.
- **Vector dummy metrics**: counter (`chatQueries`, `crisisDetections`, dst) disimpan sebagai metadata pada satu vector khusus di Pinecone (id `__metrics__`), difilter otomatis agar tidak pernah muncul di hasil RAG atau tabel knowledge base.

---

## Disclaimer

Sistem ini adalah alat bantu edukasi berbasis referensi ilmiah.
**Bukan pengganti diagnosis** atau konsultasi dengan psikolog/psikiater
berlisensi. Jika kamu atau seseorang yang kamu kenal dalam krisis,
segera hubungi **Into The Light Indonesia di 119 ext 8** atau kunjungi
IGD rumah sakit terdekat.
