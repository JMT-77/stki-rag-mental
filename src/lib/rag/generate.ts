/**
 * src/lib/rag/generate.ts
 * =======================
 * Context builder, source formatter, dan streaming LLM jawaban chat.
 *
 * DUA PROVIDER, GEMINI-FIRST:
 *   Gemini chat free tier limitnya sangat ketat (5 request/menit untuk
 *   gemini-2.5-flash), jauh lebih sempit dibanding limit embedding.
 *   Begitu kena rate limit di tengah streaming, kita SWITCH PERMANEN ke
 *   Groq (llama-3.3-70b-versatile, OpenAI-compatible API) untuk SISA
 *   stream yang sedang berjalan DAN seluruh request berikutnya dalam
 *   proses Node yang sama — sama seperti pattern sticky fallback di
 *   src/lib/rag/embed.ts.
 *
 *   Groq free tier: ~30 request/menit, 14.400 request/hari — jauh lebih
 *   lega untuk traffic chat dibanding Gemini chat. Model Llama yang
 *   dipakai tetap mampu mengikuti instruksi sitasi [Ref X] dengan baik.
 *
 * MIGRASI (Juni 2026):
 *   - SDK lama '@google/generative-ai' end-of-life → diganti '@google/genai'.
 *   - Model 'gemini-2.0-flash' SHUTDOWN per 1 Juni 2026 → diganti
 *     'gemini-2.5-flash' (tetap di free tier, lihat src/lib/config.ts).
 *
 * LAZY CLIENT INIT: client dibuat di dalam getter function, bukan
 * top-level module scope — lihat penjelasan lengkap di embed.ts.
 */

import { GoogleGenAI } from '@google/genai'
import Groq from 'groq-sdk'
import { GEMINI_MODEL, GROQ_MODEL, MAX_HISTORY_PAIRS, SYSTEM_PROMPT } from '@/lib/config'
import type { Chunk } from './retrieve'

// ── Sticky fallback flag ────────────────────────────────────────────────────────
// Sekali Gemini chat kena rate limit, langsung pakai Groq untuk sisa proses
// (reset sendiri tiap kali server/script di-restart — lihat embed.ts untuk
// penjelasan trade-off yang sama).
let _geminiChatExhausted = false

// ── Gemini client ──────────────────────────────────────────────────────────────

let _genai: GoogleGenAI | null = null

function getGeminiClient(): GoogleGenAI {
  if (!_genai) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY tidak ditemukan di environment saat streamAnswer() dipanggil. ' +
        'Cek .env.local.'
      )
    }
    _genai = new GoogleGenAI({ apiKey, vertexai: false })
  }
  return _genai
}

// ── Groq client ────────────────────────────────────────────────────────────────

let _groq: Groq | null = null

function getGroqClient(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error(
        'GROQ_API_KEY tidak ditemukan di environment. Diperlukan sebagai fallback ' +
        'saat Gemini chat rate limit. Daftar gratis di console.groq.com, lalu ' +
        'tambahkan GROQ_API_KEY di .env.local (dan di Vercel untuk production).'
      )
    }
    _groq = new Groq({ apiKey })
  }
  return _groq
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  return (
    lower.includes('429') ||
    lower.includes('rate') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted')
  )
}

// ── Context Builder ────────────────────────────────────────────────────────────
// Port build_context() dari llm.py — format identik

export function buildContext(query: string, chunks: Chunk[]): string {
  const context = chunks
    .map((c, i) => `[Ref ${i + 1}] ${c.source}\n${c.text}`)
    .join('\n\n')
  return (
    `Pertanyaan: ${query}\n\n` +
    `Referensi ilmiah:\n${context}\n\n` +
    `Jawab dalam Bahasa Indonesia. Cantumkan [Ref X] dalam teks saat menggunakan referensi.`
  )
}

// ── Source Formatter ───────────────────────────────────────────────────────────
// Port format_sources_md() dari llm.py — format identik

export function formatSourcesMd(chunks: Chunk[]): string {
  if (!chunks.length) return ''
  const lines = ['\n\n---\n**📚 Referensi:**']
  chunks.forEach((c, i) => {
    lines.push(
      `- **[Ref ${i + 1}]** ${c.source} *(relevansi: ${c.similarity.toFixed(2)})*`
    )
  })
  return lines.join('\n')
}

// ── Streaming: Gemini ───────────────────────────────────────────────────────────

async function* streamAnswerGemini(
  query: string,
  chunks: Chunk[],
  history: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  const ai = getGeminiClient()

  const trimmed = history.slice(-(MAX_HISTORY_PAIRS * 2))

  // Gemini pakai role 'user' dan 'model' (bukan 'assistant')
  const geminiHistory = trimmed.map((m) => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const chat = ai.chats.create({
    model: GEMINI_MODEL,
    config: { systemInstruction: SYSTEM_PROMPT },
    history: geminiHistory,
  })

  const contextualMessage = buildContext(query, chunks)

  const stream = await chat.sendMessageStream({ message: contextualMessage })
  for await (const chunk of stream) {
    const text = chunk.text
    if (text) yield text
  }
}

// ── Streaming: Groq ─────────────────────────────────────────────────────────────

async function* streamAnswerGroq(
  query: string,
  chunks: Chunk[],
  history: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  const groq = getGroqClient()

  const trimmed = history.slice(-(MAX_HISTORY_PAIRS * 2))

  // Groq (OpenAI-compatible) pakai role 'user'/'assistant' langsung — tidak
  // perlu mapping seperti Gemini ('model' khusus untuk Gemini).
  const groqHistory = trimmed.map((m) => ({
    role:    (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: m.content,
  }))

  const contextualMessage = buildContext(query, chunks)

  const stream = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...groqHistory,
      { role: 'user', content: contextualMessage },
    ],
    stream: true,
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) yield text
  }
}

// ── Streaming Generator (entry point) ──────────────────────────────────────────
// Port stream_answer() dari llm.py, adapted untuk Gemini-first + Groq fallback.
// Yield: string token per iterasi.

export async function* streamAnswer(
  query: string,
  chunks: Chunk[],
  history: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  // Tidak ada chunk yang lolos threshold — kembalikan pesan fallback
  if (!chunks.length) {
    yield (
      'Maaf, saya tidak menemukan referensi ilmiah yang cukup relevan ' +
      'untuk menjawab pertanyaan ini.\n\n' +
      '**Coba:**\n- Reformulasi dengan kata kunci berbeda\n' +
      '- Upload jurnal relevan di panel Admin → Knowledge Base'
    )
    return
  }

  // Sticky: kalau Gemini chat sudah pernah limit, langsung pakai Groq
  if (_geminiChatExhausted) {
    yield* streamAnswerGroq(query, chunks, history)
    return
  }

  // Coba Gemini dulu. Karena ini AsyncGenerator, error rate-limit bisa
  // muncul DI TENGAH streaming (bukan cuma di awal) — kita tangkap di
  // sini, lalu lanjutkan SISA jawaban via Groq tanpa restart dari nol.
  try {
    yield* streamAnswerGemini(query, chunks, history)
  } catch (err: unknown) {
    if (!isRateLimitError(err)) {
      throw err // error lain (bukan rate limit) — jangan ditutupi
    }

    console.warn(
      `⚠️  Gemini chat rate limit terdeteksi. Switch PERMANEN ke Groq ` +
      `(${GROQ_MODEL}) untuk sisa proses ini.`
    )
    _geminiChatExhausted = true

    yield* streamAnswerGroq(query, chunks, history)
  }
}
