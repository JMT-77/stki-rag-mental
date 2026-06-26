/**
 * src/lib/rag/embed-local.ts
 * ===========================
 * Embedding via Ollama lokal — multilingual-e5-base (768 dim).
 *
 * KNOWN BUG (Ollama/llama.cpp): beberapa kombinasi teks tertentu memicu
 * NaN di output vector, menyebabkan error 500 "unsupported value: NaN".
 * Ini bug numerik di level GGUF quantized model, terjadi acak tanpa pola
 * jelas (lihat github.com/ollama/ollama/issues/9639, #13572, #14657).
 *
 * PARTIAL FAILURE HANDLING: embedTextsLocal() TIDAK throw kalau satu chunk
 * gagal — return null di posisi itu, chunk lain tetap diproses. Ini penting
 * untuk batch besar (ratusan chunk): satu chunk bermasalah tidak boleh
 * menggagalkan seluruh batch.
 */

const OLLAMA_HOST  = process.env.OLLAMA_HOST  ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'yxchia/multilingual-e5-base'

interface OllamaEmbedResponse {
  embeddings: number[][]
}

function hasNaN(vec: number[]): boolean {
  return vec.some((v) => Number.isNaN(v))
}

async function callOllamaEmbed(input: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_HOST}/api/embed`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: OLLAMA_MODEL, input }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Ollama embed gagal (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as OllamaEmbedResponse
  const vec  = data.embeddings?.[0]

  if (!vec || vec.length === 0) {
    throw new Error('Ollama embed: response kosong')
  }
  if (hasNaN(vec)) {
    throw new Error('Ollama embed: vector mengandung NaN')
  }

  return vec
}

/**
 * Embed satu teks dengan retry mitigasi NaN.
 * Return null (bukan throw) kalau gagal setelah semua percobaan —
 * supaya pemanggil bisa skip chunk ini tanpa menggagalkan batch lain.
 */
async function embedOneWithRetry(text: string, label: string): Promise<number[] | null> {
  const attempts = [
    text,
    text.slice(0, Math.floor(text.length * 0.9)),
    text.slice(0, Math.floor(text.length * 0.8)),
  ]

  for (let i = 0; i < attempts.length; i++) {
    try {
      return await callOllamaEmbed(attempts[i])
    } catch {
      if (i < attempts.length - 1) {
        console.log(`  ⏳ Ollama NaN/error pada chunk ${label}, retry dipangkas (${i + 2}/3)...`)
      } else {
        console.warn(`  ⚠️  Chunk ${label} gagal di Ollama setelah 3x percobaan, di-skip.`)
      }
    }
  }

  return null
}

/**
 * Embed satu atau lebih teks via Ollama lokal.
 * Return array SEPANJANG `texts`, dengan null di posisi yang gagal.
 * Pemanggil WAJIB filter null sebelum dipakai (lihat ingest-folder.ts).
 */
export async function embedTextsLocal(
  texts: string[],
  prefix: 'query' | 'passage' = 'passage'
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = []

  for (let i = 0; i < texts.length; i++) {
    const input = `${prefix}: ${texts[i]}`
    const vec   = await embedOneWithRetry(input, `#${i + 1}/${texts.length}`)
    results.push(vec)
  }

  return results
}

export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
