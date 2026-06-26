/**
 * src/app/api/kb/list/route.ts
 * ============================
 * List semua chunk yang tersimpan di Pinecone.
 *
 * Pinecone free tier tidak support list semua vectors secara langsung,
 * sehingga digunakan zero-vector query sebagai workaround standar.
 */

// Runtime: Node.js — Pinecone SDK v7 butuh 'fs' (lihat catatan di
// src/app/api/chat/route.ts). Cepat (satu query), tidak perlu maxDuration khusus.
export const runtime = 'nodejs'

import { Pinecone } from '@pinecone-database/pinecone'
import { EMBEDDING_DIMENSIONS } from '@/lib/config'

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.ADMIN_PASSWORD}`) return unauthorized()

  try {
    const pc    = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
    const index = pc.index(process.env.PINECONE_INDEX_NAME!)

    // Zero-vector workaround: query dengan vektor kosong untuk fetch semua metadata
    const zeroVector = new Array(EMBEDDING_DIMENSIONS).fill(0) as number[]
    const result     = await index.query({
      vector: zeroVector,
      topK: 10000,
      includeMetadata: true,
    })

    const chunks = (result.matches ?? [])
      .filter((m) => !m.metadata?.isMetrics) // jangan ikutkan vector dummy metrics di tabel KB
      .map((m) => ({
        id:        m.id,
        source:    (m.metadata?.source    as string) ?? '—',
        tags:      (m.metadata?.tags      as string) ?? '',
        charCount: (m.metadata?.charCount as number) ?? 0,
        addedAt:   (m.metadata?.addedAt   as string) ?? '',
        label:     (m.metadata?.label     as string) ?? 'user',
      }))

    return Response.json({ chunks, total: chunks.length })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: msg }, { status: 500 })
  }
}
