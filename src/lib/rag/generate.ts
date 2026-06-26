/**
 * src/lib/rag/generate.ts
 * =======================
 * Context builder, source formatter, dan streaming via Gemini.
 * Port dari modules/llm.py (Python v4).
 *
 * MIGRASI (Juni 2026):
 *   - SDK lama '@google/generative-ai' end-of-life → diganti '@google/genai'.
 *   - Model 'gemini-2.0-flash' SHUTDOWN per 1 Juni 2026 → diganti
 *     'gemini-2.5-flash' (tetap di free tier, lihat src/lib/config.ts).
 *   - API multi-turn chat berubah: dulu `model.startChat({history})` lalu
 *     `chat.sendMessageStream(text)`. Sekarang `ai.chats.create({model,
 *     config: {systemInstruction}, history})` lalu
 *     `chat.sendMessageStream({message: text})` — message dibungkus objek.
 *
 * LAZY CLIENT INIT: lihat penjelasan lengkap di src/lib/rag/embed.ts.
 * Client GoogleGenAI dibuat di getClient(), bukan top-level module scope,
 * agar tidak bergantung pada urutan import vs dotenv.config().
 */

import { GoogleGenAI } from '@google/genai'
import { GEMINI_MODEL, MAX_HISTORY_PAIRS, SYSTEM_PROMPT } from '@/lib/config'
import type { Chunk } from './retrieve'

let _ai: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY tidak ditemukan di environment saat streamAnswer() dipanggil. ' +
        'Cek .env.local.'
      )
    }
    _ai = new GoogleGenAI({ apiKey, vertexai: false })
  }
  return _ai
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

// ── Streaming Generator ────────────────────────────────────────────────────────
// Port stream_answer() dari llm.py, adapted untuk Gemini + history multi-turn.
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

  const ai = getClient()

  // Trim history ke MAX_HISTORY_PAIRS terakhir (pasang user+assistant)
  const trimmed = history.slice(-(MAX_HISTORY_PAIRS * 2))

  // Gemini pakai role 'user' dan 'model' (bukan 'assistant')
  const geminiHistory = trimmed.map((m) => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const chat = ai.chats.create({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: SYSTEM_PROMPT,
    },
    history: geminiHistory,
  })

  const contextualMessage = buildContext(query, chunks)

  const stream = await chat.sendMessageStream({ message: contextualMessage })
  for await (const chunk of stream) {
    const text = chunk.text
    if (text) yield text
  }
}
