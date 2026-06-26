'use client'

/**
 * src/components/chat/WelcomeChips.tsx
 * ======================================
 * Empty state saat belum ada pesan — judul singkat + grid saran pertanyaan.
 * Tidak ada lagi badge/gradient dekoratif, murni fungsional.
 */

interface WelcomeChipsProps {
  onChipClick: (text: string) => void
}

const SUGGESTIONS: Array<{ label: string; text: string }> = [
  { label: 'Apa itu depresi?', text: 'Apa itu depresi?' },
  { label: 'Cara mengelola kecemasan', text: 'Cara mengelola kecemasan' },
  { label: 'Tips tidur lebih baik', text: 'Tips tidur lebih baik' },
  { label: 'Apa itu mindfulness?', text: 'Apa itu mindfulness?' },
]

export default function WelcomeChips({ onChipClick }: WelcomeChipsProps) {
  return (
    <div className="empty-state">
      <div>
        <p className="empty-state-title">CL-RAG Assistant</p>
        <p className="empty-state-subtitle">
          Tanyakan apa saja tentang kesehatan mental. Jawaban berdasarkan referensi ilmiah.
        </p>
      </div>

      <div className="suggestion-grid">
        {SUGGESTIONS.map(({ label, text }) => (
          <button key={text} className="suggestion-chip" onClick={() => onChipClick(text)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
