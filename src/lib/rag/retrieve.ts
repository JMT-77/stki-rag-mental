/**
 * src/lib/rag/retrieve.ts
 * =======================
 * Retrieval dari Pinecone — port dari knowledge_base.retrieve_chunks().
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { MIN_SIMILARITY, TOP_K } from '@/lib/config'

export interface Chunk {
  text: string
  source: string
  tags: string
  similarity: number
}

export async function retrieveChunks(queryEmbedding: number[]): Promise<Chunk[]> {
  const pc    = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const index = pc.index(process.env.PINECONE_INDEX_NAME!)

  const result = await index.query({
    vector: queryEmbedding,
    topK: TOP_K,
    includeMetadata: true,
  })

  return (result.matches ?? [])
    .filter((m) => (m.score ?? 0) >= MIN_SIMILARITY)
    .filter((m) => !m.metadata?.isMetrics) // jangan pernah ikutkan vector dummy metrics ke jawaban RAG
    .map((m) => ({
      text:       (m.metadata?.text       as string) ?? '',
      source:     (m.metadata?.source     as string) ?? '—',
      tags:       (m.metadata?.tags       as string) ?? '',
      similarity: m.score ?? 0,
    }))
    .sort((a, b) => b.similarity - a.similarity)
}
