'use client'

/**
 * src/components/admin/KBManager.tsx
 * =====================================
 * Admin komponen untuk mengelola knowledge base Pinecone.
 * - List semua chunks
 * - Upload file TXT/PDF baru
 * - Reset ke seed awal
 *
 * Props: { adminPassword: string }
 * Header autentikasi dikirim via Bearer token ke semua /api/kb/* endpoint.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface KBChunk {
  id:        string
  source:    string
  tags:      string
  charCount: number
  addedAt:   string
  label:     'seed' | 'user'
}

interface UploadResult {
  filename: string
  stored:   number
  skipped:  number
  chunks:   number
  error?:   string
}

interface KBManagerProps {
  adminPassword: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function KBManager({ adminPassword }: KBManagerProps) {
  const [chunks,       setChunks]       = useState<KBChunk[]>([])
  const [isLoading,    setIsLoading]    = useState(false)
  const [uploadFiles,  setUploadFiles]  = useState<File[]>([])
  const [sourceName,   setSourceName]   = useState('')
  const [tags,         setTags]         = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [isUploading,  setIsUploading]  = useState(false)
  const [isResetting,  setIsResetting]  = useState(false)

  const fileInputRef   = useRef<HTMLInputElement>(null)
  const statusRef      = useRef<HTMLPreElement>(null)

  // ── Helpers ────────────────────────────────────────────────────────────────
  const authHeaders = { Authorization: `Bearer ${adminPassword}` }

  // ── Load chunks ────────────────────────────────────────────────────────────
  const loadChunks = useCallback(async () => {
    setIsLoading(true)
    try {
      const res  = await fetch('/api/kb/list', { headers: authHeaders })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setChunks(data.chunks ?? [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setUploadStatus(`❌ Gagal memuat daftar chunks: ${msg}`)
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword])

  useEffect(() => { loadChunks() }, [loadChunks])

  // Scroll ke status setelah update
  useEffect(() => {
    if (uploadStatus) {
      statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [uploadStatus])

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!sourceName.trim() || !uploadFiles.length) return
    setIsUploading(true)
    setUploadStatus('📤 Mengupload dan mengindeks...')

    try {
      const formData = new FormData()
      uploadFiles.forEach((f) => formData.append('files', f))
      formData.append('source', sourceName.trim())
      formData.append('tags',   tags.trim() || '-')

      const res  = await fetch('/api/kb/upload', {
        method:  'POST',
        headers: authHeaders,
        body:    formData,
      })
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      const lines = (data.results as UploadResult[]).map((r) =>
        r.error
          ? `❌ ${r.filename}: ${r.error}`
          : `✅ ${r.filename} → ${r.stored} chunk baru (${r.skipped} dilewati, ${r.chunks} total chunk)`
      )
      lines.push(`\n📊 Total chunk baru: ${data.totalStored}`)
      setUploadStatus(lines.join('\n'))

      // Reset form
      setUploadFiles([])
      setSourceName('')
      setTags('')
      if (fileInputRef.current) fileInputRef.current.value = ''

      await loadChunks()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setUploadStatus(`❌ Upload gagal: ${msg}`)
    } finally {
      setIsUploading(false)
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  async function handleReset() {
    if (!confirm('Reset akan menghapus SEMUA dokumen dan memuat ulang seed.\nProses ini tidak bisa dibatalkan. Lanjutkan?')) return
    setIsResetting(true)
    setUploadStatus('🔄 Mereset knowledge base...')

    try {
      const res  = await fetch('/api/kb/reset', {
        method:  'DELETE',
        headers: authHeaders,
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUploadStatus(data.message ?? '✅ Reset selesai.')
      await loadChunks()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setUploadStatus(`❌ Reset gagal: ${msg}`)
    } finally {
      setIsResetting(false)
    }
  }

  // ── Counts ─────────────────────────────────────────────────────────────────
  const seedCount = chunks.filter((c) => c.label === 'seed').length
  const userCount = chunks.filter((c) => c.label === 'user').length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-body)' }}>

      {/* ── 1. Header + stats ──────────────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          flexWrap:       'wrap',
          gap:            '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2
            style={{
              fontFamily: 'var(--font-body)',
              fontSize:   '1.05rem',
              fontWeight: 700,
              color:      'var(--text-1)',
            }}
          >
            📚 Knowledge Base
          </h2>

          {/* Stats chips */}
          <span style={chipStyle('var(--accent)')}>
            {chunks.length} total
          </span>
          <span style={chipStyle('var(--text-2)')}>
            {seedCount} seed
          </span>
          <span style={chipStyle('var(--accent)')}>
            {userCount} user
          </span>
        </div>

        <button
          onClick={loadChunks}
          disabled={isLoading}
          style={secondaryBtnStyle(false)}
          onMouseEnter={btnHover}
          onMouseLeave={btnLeave}
        >
          {isLoading ? '⏳ Memuat...' : '🔄 Refresh'}
        </button>
      </div>

      {/* ── 2. Upload form ──────────────────────────────────────────────── */}
      <div
        style={{
          background:   'var(--surface)',
          border:       '1px solid var(--border)',
          borderRadius: '12px',
          padding:      '18px 20px',
          display:      'flex',
          flexDirection: 'column',
          gap:          '12px',
        }}
      >
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-2)' }}>
          📤 Upload Dokumen Baru
        </h3>

        {/* File input */}
        <div>
          <label style={labelStyle}>
            File <span style={{ color: 'var(--text-3)' }}>(PDF atau TXT, maks. 4.5 MB per file)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf"
            multiple
            onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
            style={{
              display:    'block',
              marginTop:  '6px',
              color:      'var(--text-2)',
              fontSize:   '0.88rem',
              fontFamily: 'var(--font-body)',
              cursor:     'pointer',
            }}
          />
          {uploadFiles.length > 0 && (
            <p style={{ marginTop: '4px', fontSize: '0.82rem', color: 'var(--accent)' }}>
              {uploadFiles.length} file dipilih: {uploadFiles.map((f) => f.name).join(', ')}
            </p>
          )}
        </div>

        {/* Source name */}
        <div>
          <label style={labelStyle}>
            Nama Sumber <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="misal: Kemenkes RI, 2023 — Pedoman Diagnosis"
            style={inputStyle}
          />
        </div>

        {/* Tags */}
        <div>
          <label style={labelStyle}>
            Tags <span style={{ color: 'var(--text-3)' }}>(opsional, pisahkan dengan koma)</span>
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="misal: depresi, CBT, Indonesia"
            style={inputStyle}
          />
        </div>

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={isUploading || !sourceName.trim() || !uploadFiles.length}
          style={{
            ...primaryBtnStyle,
            opacity: isUploading || !sourceName.trim() || !uploadFiles.length ? 0.5 : 1,
            cursor:  isUploading || !sourceName.trim() || !uploadFiles.length ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          {isUploading ? '⏳ Mengindeks...' : '📤 Upload & Indeks'}
        </button>

        {/* Status output */}
        {uploadStatus && (
          <pre
            ref={statusRef}
            style={{
              background:   'var(--bg)',
              border:       '1px solid var(--border)',
              borderRadius: '8px',
              padding:      '10px 14px',
              fontSize:     '0.83rem',
              color:        'var(--text-2)',
              fontFamily:   'var(--font-mono)',
              whiteSpace:   'pre-wrap',
              wordBreak:    'break-word',
              margin:       0,
            }}
          >
            {uploadStatus}
          </pre>
        )}
      </div>

      {/* ── 3. Tabel chunks ──────────────────────────────────────────────── */}
      <div
        style={{
          background:   'var(--surface)',
          border:       '1px solid var(--border)',
          borderRadius: '12px',
          padding:      '18px 20px',
        }}
      >
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '14px' }}>
          📋 Daftar Chunk Terindeks
        </h3>

        {isLoading ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.88rem' }}>⏳ Memuat...</p>
        ) : chunks.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.88rem' }}>Knowledge base kosong.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width:          '100%',
                borderCollapse: 'collapse',
                fontSize:       '0.83rem',
                fontFamily:     'var(--font-body)',
                color:          'var(--text-2)',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['#', 'Sumber', 'Tags', 'Chars', 'Ditambahkan', 'Label'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign:      'left',
                        padding:        '6px 10px',
                        fontWeight:     700,
                        color:          'var(--text-3)',
                        whiteSpace:     'nowrap',
                        fontFamily:     'var(--font-mono)',
                        fontSize:       '0.75rem',
                        textTransform:  'uppercase',
                        letterSpacing:  '0.04em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chunks.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background:   i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    }}
                  >
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={{ ...tdStyle, maxWidth: '260px' }} title={c.source}>
                      {c.source.length > 55 ? c.source.slice(0, 55) + '…' : c.source}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-3)', maxWidth: '120px' }} title={c.tags}>
                      {c.tags.length > 25 ? c.tags.slice(0, 25) + '…' : c.tags}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {c.charCount.toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: '0.79rem', whiteSpace: 'nowrap' }}>
                      {c.addedAt}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          background:   c.label === 'seed' ? 'rgba(0,212,170,0.1)' : 'rgba(59,158,255,0.1)',
                          color:        c.label === 'seed' ? 'var(--text-2)'          : 'var(--accent)',
                          border:       `1px solid ${c.label === 'seed' ? 'rgba(0,212,170,0.25)' : 'rgba(59,158,255,0.25)'}`,
                          borderRadius: '12px',
                          padding:      '1px 8px',
                          fontSize:     '0.75rem',
                          fontFamily:   'var(--font-mono)',
                          fontWeight:   700,
                        }}
                      >
                        {c.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 4. Danger zone: Reset ────────────────────────────────────────── */}
      <div
        style={{
          background:   'rgba(239,68,68,0.04)',
          border:       '1px solid rgba(239,68,68,0.2)',
          borderRadius: '12px',
          padding:      '16px 20px',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
          flexWrap:     'wrap',
          gap:          '12px',
        }}
      >
        <div>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fca5a5', marginBottom: '4px' }}>
            ⚠️ Danger Zone
          </p>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-3)' }}>
            Hapus semua chunk dan muat ulang 10 seed dokumen dari config.
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={isResetting}
          style={{
            background:   isResetting ? 'var(--bg-hover)' : 'rgba(239,68,68,0.15)',
            border:       '1px solid rgba(239,68,68,0.4)',
            color:        isResetting ? 'var(--text-3)' : '#fca5a5',
            borderRadius: '8px',
            padding:      '8px 18px',
            fontFamily:   'var(--font-body)',
            fontWeight:   700,
            fontSize:     '0.88rem',
            cursor:       isResetting ? 'not-allowed' : 'pointer',
            transition:   'all 0.2s',
            whiteSpace:   'nowrap',
          }}
        >
          {isResetting ? '⏳ Mereset...' : '🗑️ Reset Knowledge Base'}
        </button>
      </div>

    </div>
  )
}

// ── Style helpers (mengurangi repetisi inline style) ──────────────────────────

const labelStyle: React.CSSProperties = {
  display:    'block',
  fontSize:   '0.84rem',
  fontWeight: 600,
  color:      'var(--text-2)',
  marginBottom: '4px',
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  padding:      '9px 12px',
  background:   'var(--bg)',
  border:       '1px solid var(--border)',
  borderRadius: '8px',
  color:        'var(--text-1)',
  fontFamily:   'var(--font-body)',
  fontSize:     '0.9rem',
}

const primaryBtnStyle: React.CSSProperties = {
  background:   'linear-gradient(135deg, var(--accent), #5b54ef)',
  border:       'none',
  color:        '#fff',
  borderRadius: '8px',
  padding:      '9px 18px',
  fontFamily:   'var(--font-body)',
  fontWeight:   700,
  fontSize:     '0.9rem',
}

const tdStyle: React.CSSProperties = {
  padding:    '8px 10px',
  color:      'var(--text-2)',
  verticalAlign: 'middle',
}

function chipStyle(color: string): React.CSSProperties {
  return {
    background:   `${color}18`,
    border:       `1px solid ${color}33`,
    color,
    borderRadius: '12px',
    padding:      '2px 10px',
    fontSize:     '0.75rem',
    fontFamily:   'var(--font-mono)',
    fontWeight:   700,
  }
}

function secondaryBtnStyle(active: boolean): React.CSSProperties {
  return {
    background:   'none',
    border:       '1px solid var(--border)',
    color:        active ? 'var(--accent)' : 'var(--text-2)',
    borderRadius: '8px',
    padding:      '7px 14px',
    fontFamily:   'var(--font-body)',
    fontWeight:   600,
    fontSize:     '0.85rem',
    cursor:       'pointer',
    transition:   'all 0.2s',
  }
}

function btnHover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.borderColor = 'var(--accent)'
  e.currentTarget.style.color       = 'var(--accent)'
}

function btnLeave(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.borderColor = 'var(--border)'
  e.currentTarget.style.color       = 'var(--text-2)'
}
