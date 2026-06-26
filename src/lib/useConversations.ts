'use client'

/**
 * src/lib/useConversations.ts
 * =============================
 * Hook untuk mengelola riwayat percakapan di localStorage.
 *
 * Setiap percakapan disimpan sebagai satu entry di key `cl-rag-conversations`.
 * Tidak ada backend/database — semua persistence murni di browser.
 */

import { useCallback, useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import type { Conversation, Message, SessionState } from '@/components/chat/types'

const STORAGE_KEY = 'cl-rag-conversations'
const MAX_CONVERSATIONS = 50 // batas wajar agar localStorage tidak membengkak

const INITIAL_SESSION: SessionState = {
  depressionSignals: 0,
  anxietySignals: 0,
  triggeredScreening: [],
}

function loadFromStorage(): Conversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Conversation[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveToStorage(conversations: Conversation[]) {
  if (typeof window === 'undefined') return
  try {
    // Batasi jumlah tersimpan — buang yang paling lama diupdate
    const trimmed = [...conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage penuh atau diblokir — diam saja, tidak kritis untuk app
  }
}

/** Ambil judul singkat dari pesan pertama user (dipotong, dibersihkan whitespace). */
function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'Percakapan baru'
  const clean = firstUser.content.trim().replace(/\s+/g, ' ')
  return clean.length > 48 ? clean.slice(0, 48) + '…' : clean || 'Percakapan baru'
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Load sekali saat mount
  useEffect(() => {
    const loadedConvs = loadFromStorage()
    setConversations(loadedConvs)
    setLoaded(true)
  }, [])

  /** Buat percakapan baru, jadikan aktif, return id-nya. */
  const createConversation = useCallback((): string => {
    const id = uuid()
    const now = Date.now()
    const fresh: Conversation = {
      id,
      title: 'Percakapan baru',
      messages: [],
      session: { ...INITIAL_SESSION },
      createdAt: now,
      updatedAt: now,
    }
    setConversations((prev) => {
      const next = [fresh, ...prev]
      saveToStorage(next)
      return next
    })
    setActiveId(id)
    return id
  }, [])

  /** Update isi percakapan (messages/session) — dipanggil tiap kali chat berubah. */
  const updateConversation = useCallback(
    (id: string, messages: Message[], session: SessionState) => {
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === id
            ? {
                ...c,
                messages,
                session,
                title: messages.length > 0 ? deriveTitle(messages) : c.title,
                updatedAt: Date.now(),
              }
            : c
        )
        saveToStorage(next)
        return next
      })
    },
    []
  )

  /** Hapus satu percakapan dari riwayat. */
  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveToStorage(next)
      return next
    })
  }, [])

  /** Hapus semua riwayat. */
  const clearAllConversations = useCallback(() => {
    setConversations([])
    saveToStorage([])
  }, [])

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null

  return {
    conversations,
    activeId,
    activeConversation,
    loaded,
    setActiveId,
    createConversation,
    updateConversation,
    deleteConversation,
    clearAllConversations,
  }
}
