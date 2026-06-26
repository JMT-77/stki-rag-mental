/**
 * src/app/api/admin/metrics/route.ts
 * ====================================
 * Endpoint metrics untuk admin panel.
 *
 * DIDESAIN UNTUK DIPANGGIL DARI LOKAL SAJA (npm run dev) — admin panel
 * tidak pernah dibuka di production Vercel (lihat catatan di
 * src/app/admin/page.tsx). Endpoint ini tetap aman kalau ter-deploy,
 * karena dilindungi Bearer token yang sama dengan endpoint KB lain,
 * tapi tidak ada UI publik yang mengarah ke sini.
 *
 * Mengembalikan:
 *   - Counter event (chat, skrining, krisis) dari src/lib/metrics.ts
 *   - Statistik knowledge base (total chunk, breakdown seed vs user)
 */

export const runtime = 'nodejs'

import { Pinecone } from '@pinecone-database/pinecone'
import { EMBEDDING_DIMENSIONS } from '@/lib/config'
import { readMetrics } from '@/lib/metrics'

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.ADMIN_PASSWORD}`) return unauthorized()

  try {
    const counters = await readMetrics()

    // KB stats — query yang sama seperti /api/kb/list, tapi cukup ringkasan jumlah
    const pc    = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
    const index = pc.index(process.env.PINECONE_INDEX_NAME!)

    const zeroVector = new Array(EMBEDDING_DIMENSIONS).fill(0) as number[]
    const result = await index.query({
      vector: zeroVector,
      topK: 10000,
      includeMetadata: true,
    })

    const realChunks = (result.matches ?? []).filter((m) => !m.metadata?.isMetrics)
    const seedCount  = realChunks.filter((m) => m.metadata?.label === 'seed').length
    const userCount  = realChunks.filter((m) => m.metadata?.label === 'user').length

    return Response.json({
      counters,
      kb: {
        total: realChunks.length,
        seed:  seedCount,
        user:  userCount,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: msg }, { status: 500 })
  }
}
