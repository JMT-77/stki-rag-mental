/**
 * scripts/manifest.ts
 * ====================
 * Manifest lokal untuk dedup cepat saat ingest dokumen.
 *
 * STRATEGI HYBRID:
 *   - Manifest disimpan di scripts/.ingest-manifest.json (hash → metadata).
 *   - Kalau manifest belum ada (pertama kali / pindah komputer), di-REBUILD
 *     otomatis dari kenyataan yang ada di Pinecone (query semua vector,
 *     ambil field hash dari metadata).
 *   - Setelah ada, semua dedup check berikutnya cukup baca manifest lokal —
 *     TIDAK ADA network call ke Pinecone untuk cek "sudah ada belum".
 *   - Manifest diupdate setelah setiap upsert sukses.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { Pinecone } from '@pinecone-database/pinecone'

const MANIFEST_PATH = resolve(process.cwd(), 'scripts', '.ingest-manifest.json')

export interface ManifestEntry {
  source:   string
  filename?: string
  label:    'seed' | 'user'
  addedAt:  string
}

export interface Manifest {
  version: 1
  entries: Record<string, ManifestEntry> // key = hash
}

function emptyManifest(): Manifest {
  return { version: 1, entries: {} }
}

/** Load manifest dari disk. Return null kalau belum ada (perlu rebuild). */
export function loadManifestFromDisk(): Manifest | null {
  if (!existsSync(MANIFEST_PATH)) return null
  try {
    const raw = readFileSync(MANIFEST_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Manifest
    if (parsed.version !== 1 || typeof parsed.entries !== 'object') {
      console.warn('⚠️  Manifest format tidak dikenali, akan di-rebuild dari Pinecone.')
      return null
    }
    return parsed
  } catch {
    console.warn('⚠️  Manifest korup/tidak terbaca, akan di-rebuild dari Pinecone.')
    return null
  }
}

/** Simpan manifest ke disk. */
export function saveManifestToDisk(manifest: Manifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8')
}

/**
 * Rebuild manifest dari kenyataan yang ada di Pinecone.
 * Pakai workaround zero-vector query (Pinecone free tier tidak punya
 * "list all" langsung) — sama seperti src/app/api/kb/list/route.ts.
 */
export async function rebuildManifestFromPinecone(
  index: ReturnType<Pinecone['index']>,
  dimensions: number
): Promise<Manifest> {
  console.log('🔄 Manifest lokal tidak ditemukan — rebuilding dari data Pinecone yang sudah ada...')

  const zeroVector = new Array(dimensions).fill(0) as number[]
  const result = await index.query({
    vector: zeroVector,
    topK: 10000,
    includeMetadata: true,
  })

  const manifest = emptyManifest()
  let count = 0

  for (const match of result.matches ?? []) {
    const hash = match.metadata?.hash as string | undefined
    if (!hash) continue // skip kalau ada vector lama tanpa field hash

    manifest.entries[hash] = {
      source:  (match.metadata?.source as string) ?? '—',
      label:   (match.metadata?.label as 'seed' | 'user') ?? 'user',
      addedAt: (match.metadata?.addedAt as string) ?? '',
    }
    count++
  }

  console.log(`✅ Rebuild selesai: ${count} hash dimuat dari Pinecone ke manifest lokal.\n`)
  saveManifestToDisk(manifest)
  return manifest
}

/**
 * Entry point: load manifest, rebuild otomatis dari Pinecone kalau belum ada.
 */
export async function getOrBuildManifest(
  index: ReturnType<Pinecone['index']>,
  dimensions: number
): Promise<Manifest> {
  const existing = loadManifestFromDisk()
  if (existing) {
    console.log(`📋 Manifest lokal ditemukan: ${Object.keys(existing.entries).length} hash tercatat.\n`)
    return existing
  }
  return await rebuildManifestFromPinecone(index, dimensions)
}

/** Cek apakah hash sudah tercatat di manifest. */
export function hasHash(manifest: Manifest, hash: string): boolean {
  return hash in manifest.entries
}

/** Tambahkan entry baru ke manifest (in-memory — ingat panggil saveManifestToDisk setelahnya). */
export function addEntry(manifest: Manifest, hash: string, entry: ManifestEntry): void {
  manifest.entries[hash] = entry
}
