'use client'

/**
 * src/components/screening/ProgressBar.tsx
 * ==========================================
 * Visual progres berapa pertanyaan sudah dijawab.
 */

interface ProgressBarProps {
  answered: number
  total: number
}

export default function ProgressBar({ answered, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
  const allDone = answered === total && total > 0

  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ background: 'var(--border)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'var(--accent)',
            borderRadius: '999px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <p style={{ marginTop: '6px', fontSize: '0.76rem', color: 'var(--text-3)' }}>
        {answered} dari {total} pertanyaan dijawab{allDone && ' · selesai'}
      </p>
    </div>
  )
}
