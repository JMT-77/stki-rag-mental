/**
 * src/components/chat/types.ts
 * ============================
 * Shared types untuk semua chat components.
 */

export interface Source {
  ref: number
  source: string
  similarity: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  isCrisis?: boolean
  isStreaming?: boolean
}

export interface SessionState {
  depressionSignals: number
  anxietySignals: number
  triggeredScreening: string[]  // array (bukan Set) untuk JSON serialisasi
}

/**
 * Satu percakapan tersimpan di riwayat (localStorage).
 * `title` diambil otomatis dari pesan pertama user.
 */
export interface Conversation {
  id:        string
  title:     string
  messages:  Message[]
  session:   SessionState
  createdAt: number   // epoch ms
  updatedAt: number   // epoch ms
}
