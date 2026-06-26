'use client'

/**
 * src/components/chat/ChatMessage.tsx
 * =====================================
 * Bubble pesan minimalis.
 * - User: kanan, bubble abu gelap
 * - Assistant: kiri, full-width, tanpa bubble border (seperti ChatGPT)
 * - Crisis notice tetap ada, satu-satunya elemen yang sengaja menonjol warna
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from './types'
import SourceCitations from './SourceCitations'

interface ChatMessageProps {
  message: Message
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="msg-row user">
        <div className="msg-bubble user">{message.content}</div>
      </div>
    )
  }

  return (
    <div className="msg-row assistant">
      <div className="msg-bubble assistant">
        {message.isCrisis && !message.isStreaming && (
          <div className="crisis-notice">
            Jika kamu sedang dalam krisis atau membutuhkan bantuan segera: hubungi{' '}
            <strong>Into The Light Indonesia di 119 ext 8</strong> atau kunjungi IGD rumah sakit terdekat.
          </div>
        )}

        <div className="md-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          {message.isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
        </div>

        {!message.isStreaming && message.sources && message.sources.length > 0 && (
          <SourceCitations sources={message.sources} />
        )}
      </div>
    </div>
  )
}
