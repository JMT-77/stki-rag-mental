/**
 * src/lib/rag/embed.ts
 * ====================
 * Dua mode embedding untuk dua konteks berbeda:
 *
 *   embedTexts()            → GEMINI dulu, Ollama fallback.
 *                              Dipakai di /api/chat (production/Vercel).
 *
 *   embedTextsPreferLocal() → OLLAMA dulu, Gemini fallback (partial-aware:
 *                              kalau Ollama berhasil sebagian, sisanya yang
 *                              gagal baru dilempar ke Gemini — bukan ulang
 *                              semua dari nol).
 *                              Dipakai di scripts/ingest-folder.ts dan
 *                              scripts/setup-pinecone.ts.
 *
 * RATE LIMIT GEMINI FREE TIER: 100 request PER MENIT (bukan cuma per hari).
 * embedTextsGemini() memecah jadi sub-batch 100 teks/request, dengan delay
 * antar sub-batch dan retry-with-backoff kalau kena 429 di tengah proses.
 */

import { GoogleGenAI } from '@google/genai'
import { EMBEDDING_DIMENSIONS, GEMINI_EMBEDDING_MODEL } from '@/lib/config'
import { embedTextsLocal } from './embed-local'

let _ai: GoogleGenAI | null = null
let _geminiExhausted = false

function getClient(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY tidak ditemukan di environment saat embedTexts() dipanggil. ' +
        'Cek .env.local.'
      )
    }
    _ai = new GoogleGenAI({ apiKey, vertexai: false })
  }
  return _ai
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

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/**
 * GEMINI-FIRST. Dipakai di /api/chat (production/Vercel).
 */
export async function embedTexts(
  texts: string[],
  prefix: 'query' | 'passage' = 'passage'
): Promise<number[][]> {
  if (_geminiExhausted) {
    const results = await embedTextsLocal(texts, prefix)
    return assertAllSucceeded(results, texts)
  }

  try {
    return await embedTextsGemini(texts, prefix)
  } catch (err: unknown) {
    if (!isRateLimitError(err)) {
      throw err
    }

    console.warn(
      `⚠️  Gemini rate limit terdeteksi. Switch PERMANEN ke embedding lokal (Ollama) ` +
      `untuk sisa proses ini.`
    )
    _geminiExhausted = true
    const results = await embedTextsLocal(texts, prefix)
    return assertAllSucceeded(results, texts)
  }
}

/**
 * OLLAMA-FIRST, partial-aware. Dipakai khusus untuk script ingest manual.
 *
 * Kalau Ollama gagal untuk SEBAGIAN chunk (bukan semua), hanya chunk yang
 * gagal itu yang dilempar ke Gemini — bukan re-embed semua dari nol.
 * Return tetap number[][] penuh sepanjang `texts`, tapi BISA throw kalau
 * Gemini fallback juga gagal untuk chunk yang sama (misal kena rate limit).
 * Pemanggil (ingest-folder.ts) perlu nangkep error itu di level per-file.
 */
export async function embedTextsPreferLocal(
  texts: string[],
  prefix: 'query' | 'passage' = 'passage'
): Promise<number[][]> {
  const localResults = await embedTextsLocal(texts, prefix)

  const failedIndexes: number[] = []
  localResults.forEach((vec, i) => {
    if (vec === null) failedIndexes.push(i)
  })

  if (failedIndexes.length === 0) {
    return localResults as number[][]
  }

  console.warn(
    `⚠️  ${failedIndexes.length}/${texts.length} chunk gagal di Ollama. ` +
    `Mencoba fallback ke Gemini untuk chunk yang gagal saja...`
  )

  const textsToRetry = failedIndexes.map((i) => texts[i])
  const geminiResults = await embedTextsGemini(textsToRetry, prefix)

  const merged = [...localResults] as number[][]
  failedIndexes.forEach((originalIdx, j) => {
    merged[originalIdx] = geminiResults[j]
  })

  return merged
}

/** Helper: pastikan tidak ada null tersisa (dipakai oleh embedTexts production-path). */
function assertAllSucceeded(
  results: (number[] | null)[],
  texts: string[]
): number[][] {
  const failedIdx = results.findIndex((v) => v === null)
  if (failedIdx !== -1) {
    throw new Error(
      `Embedding gagal total untuk teks: "${texts[failedIdx].slice(0, 40)}..."`
    )
  }
  return results as number[][]
}

const GEMINI_BATCH_LIMIT = 100   // hard limit: jumlah teks per request
const GEMINI_BATCH_DELAY_MS = 1500 // delay antar sub-batch — hindari limit 100 req/menit
const GEMINI_MAX_RETRY = 3

async function embedTextsGemini(
  texts: string[],
  prefix: 'query' | 'passage'
): Promise<number[][]> {
  const ai = getClient()
  const taskType = prefix === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT'

  const allResults: number[][] = []

  for (let i = 0; i < texts.length; i += GEMINI_BATCH_LIMIT) {
    const batch = texts.slice(i, i + GEMINI_BATCH_LIMIT)

    let lastErr: unknown
    let succeeded = false

    for (let attempt = 1; attempt <= GEMINI_MAX_RETRY; attempt++) {
      try {
        const response = await ai.models.embedContent({
          model:    GEMINI_EMBEDDING_MODEL,
          contents: batch,
          config: {
            taskType,
            outputDimensionality: EMBEDDING_DIMENSIONS,
          },
        })

        const embeddings = response.embeddings
        if (!embeddings || embeddings.length !== batch.length) {
          throw new Error(
            `Jumlah hasil (${embeddings?.length ?? 0}) tidak sesuai input batch (${batch.length})`
          )
        }

        for (let j = 0; j < embeddings.length; j++) {
          const values = embeddings[j].values
          if (!values || values.length === 0) {
            throw new Error(`Embedding kosong untuk teks: "${batch[j].slice(0, 40)}..."`)
          }
          allResults.push(values)
        }

        succeeded = true
        break
      } catch (err: unknown) {
        lastErr = err
        if (isRateLimitError(err) && attempt < GEMINI_MAX_RETRY) {
          const waitMs = 8000 * attempt // 8s, 16s — cukup untuk reset limit per-menit
          console.log(`  ⏳ Gemini rate limit di sub-batch, tunggu ${waitMs / 1000}s (percobaan ${attempt}/${GEMINI_MAX_RETRY})...`)
          await sleep(waitMs)
        } else if (!isRateLimitError(err)) {
          throw err // error non-rate-limit, jangan retry, lempar langsung
        }
      }
    }

    if (!succeeded) {
      throw lastErr ?? new Error('Gemini batch embed gagal tanpa detail error')
    }

    // Delay antar sub-batch berikutnya, kecuali ini sub-batch terakhir
    if (i + GEMINI_BATCH_LIMIT < texts.length) {
      await sleep(GEMINI_BATCH_DELAY_MS)
    }
  }

  return allResults
}
