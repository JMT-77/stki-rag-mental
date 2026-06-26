/**
 * src/lib/metrics.ts
 * ===================
 * Counter sederhana untuk metrics admin, disimpan sebagai metadata
 * pada SATU vector dummy khusus di Pinecone (id: "__metrics__").
 *
 * KENAPA PINECONE (bukan database terpisah):
 *   Production (Vercel) sudah punya akses Pinecone (PINECONE_API_KEY ada
 *   di env). Tidak perlu setup storage baru. Admin panel — yang HANYA
 *   dijalankan lokal (lihat catatan di admin/page.tsx) — membaca counter
 *   ini dari Pinecone yang sama.
 *
 * Vector dummy ini TIDAK PERNAH dipakai untuk similarity search biasa
 * (retrieveChunks di rag/retrieve.ts memfilter berdasarkan MIN_SIMILARITY,
 * dan vector ini punya values acak/nol yang tidak relevan terhadap query
 * apapun, jadi praktis tidak akan pernah muncul di hasil retrieval RAG).
 *
 * CONCURRENCY: increment dilakukan via fetch -> +1 -> upsert. Ada race
 * condition kecil kalau 2 request datang bersamaan persis (counter bisa
 * sedikit kurang dari angka sebenarnya). Untuk skala traffic app ini
 * (demo/tugas kuliah), ini bisa diterima — bukan dipakai untuk billing
 * atau keputusan kritis, hanya gambaran kasar penggunaan.
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { EMBEDDING_DIMENSIONS } from './config'

const METRICS_ID = '__metrics__'

export interface MetricsCounters {
  chatQueries:        number
  crisisDetections:   number
  screeningTriggered: number
  phq9Completed:       number
  gad7Completed:       number
  updatedAt:           string
}

const EMPTY_COUNTERS: MetricsCounters = {
  chatQueries:        0,
  crisisDetections:   0,
  screeningTriggered: 0,
  phq9Completed:       0,
  gad7Completed:       0,
  updatedAt:           '',
}

let _pc: Pinecone | null = null

function getPineconeClient(): Pinecone {
  if (!_pc) {
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY tidak ditemukan saat mencatat metrics.')
    }
    _pc = new Pinecone({ apiKey })
  }
  return _pc
}

function getIndex() {
  const indexName = process.env.PINECONE_INDEX_NAME
  if (!indexName) {
    throw new Error('PINECONE_INDEX_NAME tidak ditemukan saat mencatat metrics.')
  }
  return getPineconeClient().index(indexName)
}

/** Baca counter saat ini. Return EMPTY_COUNTERS kalau vector metrics belum pernah dibuat. */
export async function readMetrics(): Promise<MetricsCounters> {
  try {
    const index = getIndex()
    const result = await index.fetch({ ids: [METRICS_ID] })
    const record = result.records?.[METRICS_ID]

    if (!record?.metadata) return { ...EMPTY_COUNTERS }

    const m = record.metadata
    return {
      chatQueries:        Number(m.chatQueries ?? 0),
      crisisDetections:   Number(m.crisisDetections ?? 0),
      screeningTriggered: Number(m.screeningTriggered ?? 0),
      phq9Completed:       Number(m.phq9Completed ?? 0),
      gad7Completed:       Number(m.gad7Completed ?? 0),
      updatedAt:           String(m.updatedAt ?? ''),
    }
  } catch {
    // Index belum siap / network error — jangan sampai mematikan fitur utama
    return { ...EMPTY_COUNTERS }
  }
}

/**
 * Tambah satu counter sebesar 1. Dipanggil "fire-and-forget" dari
 * /api/chat dan /api/screen — kegagalan increment TIDAK BOLEH membuat
 * request utama (jawab chat / scoring) gagal.
 */
export async function incrementMetric(key: keyof Omit<MetricsCounters, 'updatedAt'>): Promise<void> {
  try {
    const index = getIndex()
    const current = await readMetrics()

    const updated: MetricsCounters = {
      ...current,
      [key]: current[key] + 1,
      updatedAt: new Date().toLocaleString('id-ID', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
      }),
    }

    await index.upsert({
      records: [
        {
          id: METRICS_ID,
          // Vector dummy — nilai tidak relevan, hanya placeholder dimensi.
          // Karena ini bukan embedding teks asli, similarity-nya terhadap
          // query manapun akan sangat rendah dan otomatis terfilter oleh
          // MIN_SIMILARITY di retrieveChunks().
          values: new Array(EMBEDDING_DIMENSIONS).fill(0),
          metadata: { ...updated, isMetrics: true },
        },
      ],
    })
  } catch (err) {
    // Diam-diam gagal — metrics bersifat "nice to have", bukan kritis.
    console.warn('[metrics] Gagal increment:', err instanceof Error ? err.message : err)
  }
}
