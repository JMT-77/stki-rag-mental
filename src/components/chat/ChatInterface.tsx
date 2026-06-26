'use client'

/**
 * src/components/chat/ChatInterface.tsx
 * =======================================
 * Komponen utama chat. Sama seperti sebelumnya (SSE streaming dari
 * /api/chat), ditambah integrasi riwayat percakapan via props
 * messages + session + onChange (dikelola dari src/app/page.tsx).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import type { Message, SessionState, Source } from './types'
import ChatMessage from './ChatMessage'
import WelcomeChips from './WelcomeChips'
import TypingIndicator from './TypingIndicator'

interface ChatInterfaceProps {
  messages: Message[]
  session: SessionState
  onChange: (messages: Message[], session: SessionState) => void
}

export default function ChatInterface({ messages, session, onChange }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Ref agar selalu punya nilai terbaru tanpa perlu re-create sendMessage tiap render
  const messagesRef = useRef(messages)
  const sessionRef = useRef(session)
  messagesRef.current = messages
  sessionRef.current = session

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    setInputValue('')
    setIsStreaming(true)

    const history = messagesRef.current
      .filter((m) => !m.isStreaming)
      .map((m) => ({ role: m.role, content: m.content }))

    const userMsg: Message = { id: uuid(), role: 'user', content: trimmed }
    const assistantId = uuid()
    const placeholder: Message = { id: assistantId, role: 'assistant', content: '', isStreaming: true }

    let working = [...messagesRef.current, userMsg, placeholder]
    onChange(working, sessionRef.current)

    let metaSources: Source[] = []
    let metaCrisis = false
    let metaTrigger: string | null = null
    let workingSession = sessionRef.current

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history, session: sessionRef.current }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          let event: Record<string, unknown>
          try {
            event = JSON.parse(jsonStr)
          } catch {
            continue
          }

          const type = event.type as string

          if (type === 'meta') {
            metaSources = (event.sources as Source[]) ?? []
            metaCrisis = Boolean(event.crisis)
            metaTrigger = (event.trigger as string | null) ?? null

            if (metaTrigger) {
              workingSession = {
                ...workingSession,
                triggeredScreening: workingSession.triggeredScreening.includes(metaTrigger)
                  ? workingSession.triggeredScreening
                  : [...workingSession.triggeredScreening, metaTrigger],
              }
            }
            continue
          }

          if (type === 'token') {
            const chunk = (event.content as string) ?? ''
            working = working.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            )
            onChange(working, workingSession)
            continue
          }

          if (type === 'done') {
            working = working.map((m) =>
              m.id === assistantId
                ? { ...m, isStreaming: false, sources: metaSources, isCrisis: metaCrisis }
                : m
            )
            onChange(working, workingSession)
            continue
          }

          if (type === 'error') {
            const errMsg = (event.message as string) ?? 'Terjadi kesalahan.'
            working = working.map((m) =>
              m.id === assistantId ? { ...m, content: errMsg, isStreaming: false } : m
            )
            onChange(working, workingSession)
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      working = working.map((m) =>
        m.id === assistantId
          ? { ...m, content: `Gagal terhubung ke server: ${msg}`, isStreaming: false }
          : m
      )
      onChange(working, workingSession)
    } finally {
      setIsStreaming(false)
      textareaRef.current?.focus()
    }
  }, [isStreaming, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const showEmptyState = messages.length === 0

  return (
    <>
      <div className="chat-scroll-area">
        <div className="chat-content">
          {showEmptyState ? (
            <WelcomeChips onChipClick={(text) => sendMessage(text)} />
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isStreaming && messages[messages.length - 1]?.content === '' && (
                <div className="msg-row assistant">
                  <TypingIndicator />
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="input-dock">
        <div className="input-shell">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanya tentang kesehatan mental..."
            rows={1}
            disabled={isStreaming}
          />
          <button
            className="send-button"
            onClick={() => sendMessage(inputValue)}
            disabled={isStreaming || !inputValue.trim()}
            aria-label="Kirim"
          >
            <SendIcon />
          </button>
        </div>
        <p className="input-footer-note">
          Bukan pengganti diagnosis profesional · Darurat: 119 ext 8
        </p>
      </div>
    </>
  )
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
