'use client'

/**
 * src/app/page.tsx
 * =================
 * Halaman utama. Layout shell: Sidebar (riwayat) + Main area (Chat/Skrining).
 * Riwayat percakapan dikelola via useConversations() (localStorage).
 */

import { useEffect, useState } from 'react'
import ChatInterface from '@/components/chat/ChatInterface'
import Sidebar from '@/components/chat/Sidebar'
import ScreeningTabs from '@/components/screening/ScreeningTabs'
import { useConversations } from '@/lib/useConversations'
import type { Message, SessionState } from '@/components/chat/types'

type Mode = 'chat' | 'screening'

export default function HomePage() {
  const [mode, setMode] = useState<Mode>('chat')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const {
    conversations,
    activeId,
    activeConversation,
    loaded,
    setActiveId,
    createConversation,
    updateConversation,
    deleteConversation,
  } = useConversations()

  useEffect(() => {
    if (loaded && conversations.length === 0) {
      createConversation()
    } else if (loaded && !activeId && conversations.length > 0) {
      setActiveId(conversations[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  function handleNewChat() {
    createConversation()
    setMode('chat')
    setMobileSidebarOpen(false)
  }

  function handleSelectConversation(id: string) {
    setActiveId(id)
    setMode('chat')
    setMobileSidebarOpen(false)
  }

  function handleDeleteConversation(id: string) {
    deleteConversation(id)
    if (id === activeId) {
      const remaining = conversations.filter((c) => c.id !== id)
      if (remaining.length > 0) {
        setActiveId(remaining[0].id)
      } else {
        createConversation()
      }
    }
  }

  function handleMessagesChange(messages: Message[], session: SessionState) {
    if (activeId) updateConversation(activeId, messages, session)
  }

  if (!loaded) return null

  const currentMessages = activeConversation?.messages ?? []
  const currentSession = activeConversation?.session ?? {
    depressionSignals: 0,
    anxietySignals: 0,
    triggeredScreening: [],
  }

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onDelete={handleDeleteConversation}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="main-area">
        <div className="main-topbar">
          <button
            className="topbar-mobile-toggle"
            onClick={() => {
              if (window.innerWidth <= 768) {
                setMobileSidebarOpen(true)
              } else {
                setSidebarCollapsed(false)
              }
            }}
            style={{ display: sidebarCollapsed ? 'flex' : undefined }}
            aria-label="Buka sidebar"
          >
            <MenuIcon />
          </button>

          <span className="main-topbar-title">CL-RAG</span>

          <div style={{ flex: 1 }} />

          <div className="mode-tabs">
            <button
              className="mode-tab"
              data-active={String(mode === 'chat')}
              onClick={() => setMode('chat')}
            >
              Chat
            </button>
            <button
              className="mode-tab"
              data-active={String(mode === 'screening')}
              onClick={() => setMode('screening')}
            >
              Skrining
            </button>
          </div>
        </div>

        {mode === 'chat' ? (
          <ChatInterface
            key={activeId}
            messages={currentMessages}
            session={currentSession}
            onChange={handleMessagesChange}
          />
        ) : (
          <div className="chat-scroll-area">
            <ScreeningTabs />
          </div>
        )}
      </div>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
    </svg>
  )
}
