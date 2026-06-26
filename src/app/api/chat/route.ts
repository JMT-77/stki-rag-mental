/**
 * src/app/api/chat/route.ts
 * =========================
 * RAG chat endpoint — SSE streaming.
 * Port dari modules/handlers.py :: handle_chat() (Python v4).
 *
 * SSE event sequence:
 *   1. meta   — crisis flag, sources array, screening trigger
 *   2. token  — satu atau lebih token jawaban
 *   3. done   — sinyal stream selesai
 *   4. error  — hanya jika terjadi exception (menggantikan done)
 */

/**
 * Runtime: Node.js (BUKAN Edge).
 *
 * @pinecone-database/pinecone v7 membawa modul Assistant API yang
 * meng-import 'fs', 'path', 'stream' — API Node.js native yang TIDAK
 * tersedia di Edge Runtime. Bundler (webpack/turbopack) tetap menarik
 * modul tersebut meski kita hanya memakai index.query(), sehingga build
 * gagal dengan "Module not found: Can't resolve 'fs'" jika runtime
 * di-set ke 'edge'.
 *
 * Trade-off: Node.js serverless function punya timeout (diatur lewat
 * `maxDuration` di vercel.json), berbeda dari Edge yang tanpa timeout.
 * Untuk RAG + Gemini streaming ini tidak masalah — beri maxDuration
 * 60s di vercel.json untuk endpoint ini.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

import { CRISIS_DISCLAIMER } from '@/lib/config'
import { streamAnswer, formatSourcesMd } from '@/lib/rag/generate'
import { embedTexts } from '@/lib/rag/embed'
import { retrieveChunks } from '@/lib/rag/retrieve'
import { detectCrisis, detectIntent, type SessionSignals } from '@/lib/screening'
import { incrementMetric } from '@/lib/metrics'

// ── Request / Response Types ───────────────────────────────────────────────────

interface ChatRequest {
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  session: {
    depressionSignals?: number
    anxietySignals?: number
    triggeredScreening?: string[]
  }
}

// ── Helper: encode SSE frame ───────────────────────────────────────────────────

function sseFrame(encoder: TextEncoder, data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

// ── POST Handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as ChatRequest
  const { message, history, session } = body

  if (!message?.trim()) {
    return Response.json({ error: 'Message kosong' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(sseFrame(encoder, data))
      }

      try {
        // ── 1. Deteksi krisis dan screening intent ─────────────────────────
        const isCrisis = detectCrisis(message)

        const sessionSignals: SessionSignals = {
          depressionSignals:  session.depressionSignals  ?? 0,
          anxietySignals:     session.anxietySignals     ?? 0,
          triggeredScreening: session.triggeredScreening ?? [],
        }
        const trigger = detectIntent(message, sessionSignals)

        // ── 2. Embed query ─────────────────────────────────────────────────
        const [queryVec] = await embedTexts([message], 'query')

        // ── 3. Retrieve dari Pinecone ──────────────────────────────────────
        const chunks = await retrieveChunks(queryVec)

        // ── 4. Susun sources untuk meta event ─────────────────────────────
        const sources = chunks.map((c, i) => ({
          ref:        i + 1,
          source:     c.source,
          similarity: c.similarity,
        }))

        // ── 5. Kirim meta PERTAMA ──────────────────────────────────────────
        send({ type: 'meta', crisis: isCrisis, sources, trigger })

        // ── Metrics: fire-and-forget, tidak menunggu/blokir response ───────
        void incrementMetric('chatQueries')
        if (isCrisis) void incrementMetric('crisisDetections')
        if (trigger) void incrementMetric('screeningTriggered')

        // ── 6. Prefix krisis jika diperlukan ──────────────────────────────
        if (isCrisis) {
          send({ type: 'token', content: CRISIS_DISCLAIMER + '\n\n---\n\n' })
        }

        // ── 7. Stream jawaban token per token ─────────────────────────────
        for await (const token of streamAnswer(message, chunks, history)) {
          send({ type: 'token', content: token })
        }

        // ── 8. Append sources markdown sebagai token terakhir ─────────────
        // Ini mereplikasi perilaku Python: sources_md ditempel di akhir pesan.
        const sourcesMd = formatSourcesMd(chunks)
        if (sourcesMd) {
          send({ type: 'token', content: sourcesMd })
        }

        // ── 9. Done ────────────────────────────────────────────────────────
        send({ type: 'done' })

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'

        // Rate limit Gemini → pesan yang lebih informatif
        const isRateLimit =
          msg.toLowerCase().includes('429') ||
          msg.toLowerCase().includes('rate') ||
          msg.toLowerCase().includes('quota')

        send({
          type: 'error',
          message: isRateLimit
            ? '⏳ Gemini sedang rate limit. Coba lagi dalam 1–2 menit.'
            : `❌ Error: ${msg}`,
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
