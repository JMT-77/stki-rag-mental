'use client'

/**
 * src/components/admin/MetricsPanel.tsx
 * ========================================
 * Tampilkan metrics penggunaan: counter chat/skrining/krisis (dari
 * Pinecone via /api/admin/metrics) + ringkasan knowledge base.
 *
 * Didesain untuk dijalankan LOKAL (npm run dev) — lihat catatan di
 * src/app/admin/page.tsx. Counter-nya sendiri DITULIS dari production
 * Vercel setiap kali ada chat/skrining (lihat src/lib/metrics.ts),
 * panel ini hanya membaca dan menampilkan.
 */

import { useCallback, useEffect, useState } from 'react'

interface MetricsCounters {
  chatQueries:        number
  crisisDetections:   number
  screeningTriggered: number
  phq9Completed:      number
  gad7Completed:      number
  updatedAt:          string
}

interface KBStats {
  total: number
  seed:  number
  user:  number
}

interface MetricsPanelProps {
  adminPassword: string
}

export default function MetricsPanel({ adminPassword }: MetricsPanelProps) {
  const [counters, setCounters] = useState<MetricsCounters | null>(null)
  const [kb, setKb] = useState<KBStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const loadMetrics = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${adminPassword}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCounters(data.counters)
      setKb(data.kb)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Gagal memuat metrics: ${msg}`)
    } finally {
      setIsLoading(false)
    }
  }, [adminPassword])

  useEffect(() => { loadMetrics() }, [loadMetrics])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-1)' }}>
          Metrik Penggunaan
        </h2>
        <button onClick={loadMetrics} disabled={isLoading} className="btn-secondary">
          {isLoading ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="crisis-notice">{error}</div>
      )}

      {!error && !counters && isLoading && (
        <p style={{ color: 'var(--text-3)', fontSize: '0.88rem' }}>Memuat metrics...</p>
      )}

      {counters && kb && (
        <>
          {/* Counter cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            <MetricCard label="Total chat" value={counters.chatQueries} />
            <MetricCard label="Deteksi krisis" value={counters.crisisDetections} />
            <MetricCard label="Skrining ditawarkan" value={counters.screeningTriggered} />
            <MetricCard label="PHQ-9 selesai" value={counters.phq9Completed} />
            <MetricCard label="GAD-7 selesai" value={counters.gad7Completed} />
          </div>

          {/* KB stats */}
          <div
            style={{
              background:   'var(--surface)',
              border:       '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding:      '16px 18px',
            }}
          >
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '10px' }}>
              Knowledge Base
            </p>
            <div style={{ display: 'flex', gap: '20px', fontSize: '0.88rem', color: 'var(--text-2)' }}>
              <span><strong style={{ color: 'var(--text-1)' }}>{kb.total}</strong> total chunk</span>
              <span><strong style={{ color: 'var(--text-1)' }}>{kb.seed}</strong> seed</span>
              <span><strong style={{ color: 'var(--text-1)' }}>{kb.user}</strong> user</span>
            </div>
          </div>

          {counters.updatedAt && (
            <p style={{ fontSize: '0.76rem', color: 'var(--text-3)' }}>
              Terakhir diperbarui: {counters.updatedAt}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding:      '14px 16px',
      }}
    >
      <p style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>
        {value.toLocaleString()}
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{label}</p>
    </div>
  )
}
