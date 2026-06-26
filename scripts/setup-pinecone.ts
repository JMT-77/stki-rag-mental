/**
 * scripts/setup-pinecone.ts
 * ==========================
 * One-time setup: buat index Pinecone dan seed SEED_DOCUMENTS.
 *
 * Pakai embedTextsPreferLocal (Ollama dulu, Gemini fallback) — sama
 * seperti scripts/ingest-folder.ts — karena ini juga dijalankan manual
 * dari laptop, bukan di production Vercel.
 *
 * Jalankan dengan:
 *   npm run setup
 *
 * Pastikan .env.local sudah berisi:
 *   GEMINI_API_KEY
 *   PINECONE_API_KEY
 *   PINECONE_INDEX_NAME=cl-rag-mental-health
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { Pinecone } from '@pinecone-database/pinecone'
import { EMBEDDING_DIMENSIONS, SEED_DOCUMENTS } from '../src/lib/config'
import { chunkText, textHash } from '../src/lib/kb/chunk'
import { embedTextsPreferLocal } from '../src/lib/rag/embed'

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function nowStamp(): string {
  return new Date().toLocaleString('id-ID', {
    hour:   '2-digit',
    minute: '2-digit',
    day:    '2-digit',
    month:  '2-digit',
  })
}

async function main() {
  console.log('=== CL-RAG v5 — Pinecone Setup ===\n')

  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY tidak ditemukan di .env.local')
  }
  if (!process.env.PINECONE_INDEX_NAME) {
    throw new Error('PINECONE_INDEX_NAME tidak ditemukan di .env.local')
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY tidak ditemukan di .env.local')
  }

  const pc        = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
  const indexName = process.env.PINECONE_INDEX_NAME

  // ── 1. Cek / buat index ─────────────────────────────────────────────────
  const { indexes } = await pc.listIndexes()
  const exists = indexes?.some((i) => i.name === indexName) ?? false

  if (!exists) {
    console.log(`Membuat index "${indexName}"...`)
    console.log(`  dimensi : ${EMBEDDING_DIMENSIONS} (768, kompatibel Gemini & Ollama e5-base)`)
    console.log(`  metric  : cosine`)
    console.log(`  cloud   : aws / us-east-1 (free tier)\n`)

    await pc.createIndex({
      name:      indexName,
      dimension: EMBEDDING_DIMENSIONS,
      metric:    'cosine',
      spec: {
        serverless: {
          cloud:  'aws',
          region: 'us-east-1',
        },
      },
    })

    console.log('Menunggu index siap (30 detik)...')
    await sleep(30_000)
    console.log('Index siap.\n')
  } else {
    console.log(`Index "${indexName}" sudah ada. Melanjutkan ke seeding...\n`)
  }

  const index = pc.index(indexName)
  const stamp = nowStamp()

  // ── 2. Susun semua chunk dari semua seed document ──────────────────────
  console.log(`Memproses ${SEED_DOCUMENTS.length} seed document...\n`)

  const allChunks = SEED_DOCUMENTS.flatMap((doc) =>
    chunkText(doc.text, doc.source, doc.tags)
  )

  // ── 3. Dedup: cek mana yang sudah ada di Pinecone ───────────────────────
  const newChunks: typeof allChunks = []
  let skipped = 0

  for (const chunk of allChunks) {
    const hash = textHash(chunk.text)
    const id   = `seed_${hash}`

    let exists = false
    try {
      const existing = await index.fetch({ ids: [id] })
      exists = !!existing.records?.[id]
    } catch {
      // anggap belum ada — lanjut upsert
    }

    if (exists) {
      skipped++
    } else {
      newChunks.push(chunk)
    }
  }

  if (newChunks.length === 0) {
    console.log(`⏭  Semua ${allChunks.length} chunk sudah ada di Pinecone.\n`)
  } else {
    console.log(`📝 ${newChunks.length} chunk baru, ${skipped} sudah ada — embedding (Ollama dulu, Gemini fallback)...\n`)

    // ── 4. Embed semua chunk baru dalam batch (Ollama-first) ──────────────
    let embeddings: number[][] = []
    try {
      embeddings = await embedTextsPreferLocal(newChunks.map((c) => c.text), 'passage')
    } catch (err: unknown) {
      console.error('❌ Embedding gagal total:', err instanceof Error ? err.message : err)
      process.exit(1)
    }

    // ── 5. Upsert semua sekaligus ───────────────────────────────────────
    const records = newChunks.map((chunk, i) => ({
      id:     `seed_${textHash(chunk.text)}`,
      values: embeddings[i],
      metadata: {
        source:    chunk.source,
        tags:      chunk.tags,
        text:      chunk.text,
        hash:      textHash(chunk.text),
        charCount: chunk.text.length,
        addedAt:   stamp,
        label:     'seed',
      },
    }))

    try {
      await index.upsert({ records })
      console.log(`✅ ${records.length} chunk seed berhasil disimpan.\n`)
    } catch (err: unknown) {
      console.error('❌ Upsert gagal:', err instanceof Error ? err.message : err)
      process.exit(1)
    }
  }

  // ── 6. Ringkasan ─────────────────────────────────────────────────────────
  let totalVectors = '?'
  try {
    const stats  = await index.describeIndexStats()
    totalVectors = String(stats.totalRecordCount ?? '?')
  } catch {
    // tidak kritis
  }

  console.log(`=== Selesai ===`)
  console.log(`Stored  : ${newChunks.length} chunk baru`)
  console.log(`Skipped : ${skipped} chunk (sudah ada)`)
  console.log(`Total di Pinecone: ${totalVectors} vectors`)
  console.log(`\n✅ Setup selesai. App siap digunakan.`)
}

main().catch((err) => {
  console.error('\n❌ Setup gagal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
