/**
 * scripts/ingest-folder.ts
 * =========================
 * Scan folder docs/, ekstrak teks dari semua PDF/TXT, embed, upsert ke Pinecone.
 *
 * DEDUP STRATEGY (Opsi C — Hybrid):
 *   Manifest lokal (scripts/.ingest-manifest.json) jadi fast-path dedup —
 *   tidak ada network call ke Pinecone untuk cek "sudah ada belum". Kalau
 *   manifest belum ada (pertama kali jalan / pindah komputer), otomatis
 *   di-rebuild dari data yang sudah ada di Pinecone. Lihat scripts/manifest.ts.
 *
 * Jalankan dengan:
 *   npm run ingest
 */

import { config } from 'dotenv'
import { resolve, join, extname, basename } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { Pinecone } from '@pinecone-database/pinecone'
import { readdirSync, readFileSync } from 'fs'
import { EMBEDDING_DIMENSIONS } from '../src/lib/config'
import { chunkText, textHash } from '../src/lib/kb/chunk'
import { embedTextsPreferLocal } from '../src/lib/rag/embed'
import { getOrBuildManifest, hasHash, addEntry, saveManifestToDisk } from './manifest'

const DOCS_DIR = resolve(process.cwd(), 'docs')

function nowStamp(): string {
  return new Date().toLocaleString('id-ID', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
  })
}

async function extractTextFromDisk(filepath: string): Promise<string> {
  const ext = extname(filepath).toLowerCase()

  if (ext === '.txt') {
    return readFileSync(filepath, 'utf-8').trim()
  }

  if (ext === '.pdf') {
    const buffer = readFileSync(filepath)
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })

    let text: string
    try {
      const result = await parser.getText()
      text = result.text ?? ''
    } finally {
      await parser.destroy()
    }

    if (!text.trim()) {
      throw new Error('PDF tampaknya scan/gambar, tidak ada teks yang bisa diekstrak.')
    }
    return text.trim()
  }

  throw new Error(`Format tidak didukung: ${ext}`)
}

function sourceNameFromFilename(filepath: string): string {
  const name = basename(filepath, extname(filepath))
  return name.replace(/[_-]+/g, ' ').trim()
}

async function main() {
  console.log('=== CL-RAG v5 — Ingest Folder docs/ ===\n')

  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME || !process.env.GEMINI_API_KEY) {
    throw new Error('Env vars belum lengkap. Cek .env.local')
  }

  let files: string[]
  try {
    files = readdirSync(DOCS_DIR).filter((f) => ['.pdf', '.txt'].includes(extname(f).toLowerCase()))
  } catch {
    throw new Error(`Folder "docs/" tidak ditemukan. Buat dulu: mkdir docs`)
  }

  if (files.length === 0) {
    console.log('Tidak ada file .pdf atau .txt di folder docs/. Selesai.')
    return
  }

  console.log(`Ditemukan ${files.length} file: ${files.join(', ')}\n`)

  const pc    = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
  const index = pc.index(process.env.PINECONE_INDEX_NAME)
  const stamp = nowStamp()

  // ── Load atau rebuild manifest dari Pinecone ──────────────────────────────
  const manifest = await getOrBuildManifest(index, EMBEDDING_DIMENSIONS)

  let totalStored  = 0
  let totalSkipped = 0
  let totalErrors  = 0

  for (const filename of files) {
    const filepath = join(DOCS_DIR, filename)
    const source   = sourceNameFromFilename(filepath)

    console.log(`📄 ${filename} → sumber: "${source}"`)

    try {
      const text   = await extractTextFromDisk(filepath)
      const chunks = chunkText(text, source, '-')

      // ── Dedup via manifest LOKAL — tidak ada network call ──────────────
      const newChunks: typeof chunks = []
      let skipped = 0

      for (const chunk of chunks) {
        const hash = textHash(chunk.text)
        if (hasHash(manifest, hash)) {
          skipped++
        } else {
          newChunks.push(chunk)
        }
      }

      if (newChunks.length === 0) {
        console.log(`  ⏭  Semua ${chunks.length} chunk sudah tercatat di manifest.\n`)
        totalSkipped += skipped
        continue
      }

      console.log(`  📝 ${newChunks.length} chunk baru, ${skipped} sudah tercatat — embedding...`)

      // ── Embed semua chunk baru dalam 1 batch request ───────────────────
      let embeddings: number[][] = []
      try {
        embeddings = await embedTextsPreferLocal(newChunks.map((c) => c.text), 'passage')
      } catch (e) {
        console.error(`  ❌ Batch embed gagal: ${e instanceof Error ? e.message : e}`)
        totalErrors += newChunks.length
        continue
      }

      // ── Upsert semua sekaligus ──────────────────────────────────────────
      const records = newChunks.map((chunk, i) => ({
        id:     `user_${textHash(chunk.text)}`,
        values: embeddings[i],
        metadata: {
          source:    chunk.source,
          tags:      chunk.tags,
          text:      chunk.text,
          hash:      textHash(chunk.text),
          charCount: chunk.text.length,
          addedAt:   stamp,
          label:     'user',
        },
      }))

      let stored = 0
      try {
        await index.upsert({ records })
        stored = records.length

        // ── Update manifest HANYA setelah upsert sukses ──────────────────
        for (const chunk of newChunks) {
          const hash = textHash(chunk.text)
          addEntry(manifest, hash, {
            source:   chunk.source,
            filename,
            label:    'user',
            addedAt:  stamp,
          })
        }
        saveManifestToDisk(manifest)

      } catch (e) {
        console.error(`  ❌ Batch upsert gagal: ${e instanceof Error ? e.message : e}`)
        totalErrors += records.length
      }

      console.log(`  ✅ ${stored} chunk baru disimpan, ${skipped} dilewati\n`)
      totalStored  += stored
      totalSkipped += skipped

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ❌ Gagal proses "${filename}": ${msg}\n`)
      totalErrors++
    }
  }

  console.log(`=== Selesai ===`)
  console.log(`Total stored  : ${totalStored} chunk`)
  console.log(`Total skipped : ${totalSkipped} chunk (sudah tercatat di manifest)`)
  console.log(`Total errors  : ${totalErrors}`)
}

main().catch((err) => {
  console.error('\n❌ Ingest gagal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
