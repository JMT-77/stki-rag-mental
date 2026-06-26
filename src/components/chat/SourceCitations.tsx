'use client'

/**
 * src/components/chat/SourceCitations.tsx
 * =========================================
 * Collapsible panel referensi ilmiah di bawah pesan assistant.
 */

import { useState } from 'react'
import type { Source } from './types'

interface SourceCitationsProps {
  sources: Source[]
}

export default function SourceCitations({ sources }: SourceCitationsProps) {
  const [open, setOpen] = useState(false)

  if (!sources.length) return null

  return (
    <div>
      <button className="sources-toggle" onClick={() => setOpen((o) => !o)}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.15s' }}>
          ›
        </span>
        {sources.length} referensi
      </button>

      {open && (
        <ul style={{ marginTop: '6px', paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sources.map((s) => (
            <li key={s.ref} style={{ fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
              [{s.ref}] {s.source} · {s.similarity.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
