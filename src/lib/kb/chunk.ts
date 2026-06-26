/**
 * src/lib/kb/chunk.ts
 * ===================
 * Text chunking dan hashing untuk knowledge base.
 * Port dari modules/knowledge_base.py (fungsi chunkText & textHash saja).
 */

import { createHash } from 'crypto'
import { CHUNK_MAX_CHARS, CHUNK_OVERLAP } from '@/lib/config'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChunkDoc {
  source: string
  text: string
  tags: string
  hash?: string
}

// ── Hash ───────────────────────────────────────────────────────────────────────

/**
 * MD5 hex digest truncated to 16 characters — matches Python's text_hash().
 */
export function textHash(text: string): string {
  return createHash('md5').update(text).digest('hex').slice(0, 16)
}

// ── Chunking ───────────────────────────────────────────────────────────────────

export function chunkText(text: string, source: string, tags: string): ChunkDoc[] {
  if (text.length <= CHUNK_MAX_CHARS) {
    return [{ source, text: text.trim(), tags }]
  }

  // Split on paragraph markers first, then on ". "
  const rawSentences: string[] = []

  for (const part of text.replace(/\n\n/g, ' <P> ').split('. ')) {
    for (const sub of part.split('.\n')) {
      const s = sub.replace(/ <P> /g, ' ').trim()
      if (s.length > 20) {
        rawSentences.push(s)
      }
    }
  }

  if (rawSentences.length === 0) {
    return [{ source, text: text.slice(0, CHUNK_MAX_CHARS).trim(), tags }]
  }

  const step   = Math.max(1, 3 - CHUNK_OVERLAP)
  const chunks: ChunkDoc[] = []

  for (let i = 0; i < rawSentences.length; i += step) {
    const content = rawSentences.slice(i, i + 3).join('. ').trim()
    if (content.length > 30) {
      chunks.push({ source, text: content, tags })
    }
  }

  return chunks.length > 0
    ? chunks
    : [{ source, text: text.trim(), tags }]
}
