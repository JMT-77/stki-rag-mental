/**
 * src/app/api/kb/upload/route.ts
 * ==============================
 * Upload dokumen ke knowledge base.
 * Port dari modules/handlers.handle_upload() + knowledge_base.embed_and_store() (Python v4).
 *
 * Runtime: Node.js (BUKAN edge) — pdf-parse butuh Node.js Buffer.
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { embedTexts } from '@/lib/rag/embed'
import { chunkText, textHash } from '@/lib/kb/chunk'
import { extractTextFromFile } from '@/lib/kb/extract'

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

// ── Timestamp helper (identik format Python: "HH:MM DD/MM") ──────────────────
function nowStamp(): string {
  const d  = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${hh}:${mm} ${dd}/${mo}`
}

// ── Dedup: cek apakah ID sudah ada di Pinecone ────────────────────────────────
async function idExists(
  index: ReturnType<Pinecone['index']>,
  id: string
): Promise<boolean> {
  try {
    const res = await index.fetch({ ids: [id] })
    return Object.keys(res.records ?? {}).length > 0
  } catch {
    return false
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.ADMIN_PASSWORD}`) return unauthorized()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Request harus multipart/form-data' }, { status: 400 })
  }

  const source = (formData.get('source') as string | null)?.trim()
  const tags   = (formData.get('tags')   as string | null)?.trim() ?? '-'

  if (!source) {
    return Response.json({ error: 'Nama sumber wajib diisi' }, { status: 400 })
  }

  const files = formData.getAll('files') as File[]
  if (!files.length) {
    return Response.json({ error: 'Tidak ada file yang dipilih' }, { status: 400 })
  }

  const pc    = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const index = pc.index(process.env.PINECONE_INDEX_NAME!)
  const stamp = nowStamp()

  const results: Array<{
    filename: string
    stored: number
    skipped: number
    chunks: number
    error?: string
  }> = []

  for (const file of files) {
    const filename = file.name
    let stored  = 0
    let skipped = 0

    try {
      // a. Ekstrak teks
      const text = await extractTextFromFile(file)

      // b. Chunk teks
      const chunks = chunkText(text, source, tags)

      // c. Embed + upsert per chunk (dengan dedup hash)
      for (const chunk of chunks) {
        const hash = textHash(chunk.text)
        const id   = `user_${hash}`

        // Dedup: lewati jika sudah ada
        const exists = await idExists(index, id)
        if (exists) {
          skipped++
          continue
        }

        // Embed via Gemini text-embedding-004
        const [vector] = await embedTexts([chunk.text], 'passage')

        // Upsert ke Pinecone dengan metadata lengkap
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
                label:     'user',
              },
            },
          ],
        })

        stored++

        // Delay kecil antar chunk agar tidak kena Gemini rate limit
        await new Promise((r) => setTimeout(r, 100))
      }

      results.push({ filename, stored, skipped, chunks: chunks.length })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ filename, stored, skipped, chunks: 0, error: msg })
    }
  }

  const totalStored = results.reduce((sum, r) => sum + r.stored, 0)
  return Response.json({ results, totalStored })
}
