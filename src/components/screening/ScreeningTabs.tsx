'use client'

/**
 * src/components/screening/ScreeningTabs.tsx
 * ============================================
 * Wrapper untuk ScreeningForm dengan dua tab: PHQ-9 dan GAD-7.
 */

import { useState } from 'react'
import ScreeningForm from './ScreeningForm'

type QType = 'PHQ-9' | 'GAD-7'

const TABS: Array<{ label: string; qtype: QType }> = [
  { label: 'PHQ-9 — Depresi',   qtype: 'PHQ-9' },
  { label: 'GAD-7 — Kecemasan', qtype: 'GAD-7' },
]

export default function ScreeningTabs() {
  const [activeTab, setActiveTab] = useState<QType>('PHQ-9')

  return (
    <div className="screen-wrap">
      <div className="screen-info">
        <p style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: '8px' }}>
          Skrining Mandiri
        </p>
        <p>
          <strong style={{ color: 'var(--text-1)' }}>PHQ-9</strong> mengukur gejala depresi dalam 2 minggu terakhir (9 pertanyaan, skor 0–27).
          <br />
          <strong style={{ color: 'var(--text-1)' }}>GAD-7</strong> mengukur gejala kecemasan dalam 2 minggu terakhir (7 pertanyaan, skor 0–21).
          <br /><br />
          Kedua alat ini adalah skrining awal, bukan diagnosis klinis. Konsultasikan hasil dengan profesional berlisensi.
        </p>
      </div>

      <div className="screen-tabs">
        {TABS.map(({ label, qtype }) => (
          <button
            key={qtype}
            className="mode-tab"
            data-active={String(activeTab === qtype)}
            onClick={() => setActiveTab(qtype)}
          >
            {label}
          </button>
        ))}
      </div>

      <ScreeningForm key={activeTab} qtype={activeTab} />
    </div>
  )
}
