/**
 * src/app/api/kb/reset/route.ts
 * ==============================
 * Reset knowledge base: hapus semua vectors, re-seed dari SEED_DOCUMENTS.
 * Port dari modules/knowledge_base.reset_kb() (Python v4).
 *
 * Runtime: Node.js (BUKAN edge) — proses embed sequential butuh waktu.
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { SEED_DOCUMENTS } from '@/lib/config'
import { embedTexts } from '@/lib/rag/embed'
import { chunkText, textHash } from '@/lib/kb/chunk'

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

function nowStamp(): string {
  const d  = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${hh}:${mm} ${dd}/${mo}`
}

export async function DELETE(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.ADMIN_PASSWORD}`) return unauthorized()

  try {
    const pc    = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
    const index = pc.index(process.env.PINECONE_INDEX_NAME!)
    const stamp = nowStamp()

    // ── 1. Hapus semua vectors ─────────────────────────────────────────────
    await index.deleteAll()

    // ── 2. Re-seed dari SEED_DOCUMENTS ────────────────────────────────────
    let seeded = 0

    for (const doc of SEED_DOCUMENTS) {
      const chunks = chunkText(doc.text, doc.source, doc.tags)

      for (const chunk of chunks) {
        const hash = textHash(chunk.text)
        const id   = `seed_${hash}`

        const [vector] = await embedTexts([chunk.text], 'passage')

        await index.upsert({
          records: [
            {
              id,
              values: vector,
              metadata: {
                source:    chunk.source,
                tags:      chunk.tags,
                text:      chunk.text,
                hash,
                charCount: chunk.text.length,
                addedAt:   stamp,
                label:     'seed',
              },
            },
          ],
        })

        seeded++

        // Delay antar chunk agar tidak kena Gemini rate limit
        await new Promise((r) => setTimeout(r, 100))
      }
    }

    return Response.json({
      message: `✅ Reset selesai. ${seeded} seed chunk dimuat.`,
      seeded,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: `❌ Reset gagal: ${msg}` }, { status: 500 })
  }
}
