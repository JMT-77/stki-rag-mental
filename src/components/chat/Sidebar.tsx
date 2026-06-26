'use client'

/**
 * src/components/chat/Sidebar.tsx
 * ==================================
 * Sidebar riwayat percakapan — collapsible di desktop, drawer di mobile.
 * Data dari useConversations() (localStorage, lihat src/lib/useConversations.ts).
 */

import type { Conversation } from './types'

interface SidebarProps {
  conversations: Conversation[]
  activeId: string | null
  collapsed: boolean
  mobileOpen: boolean
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onToggleCollapse: () => void
  onCloseMobile: () => void
}

export default function Sidebar({
  conversations,
  activeId,
  collapsed,
  mobileOpen,
  onSelect,
  onNewChat,
  onDelete,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const sidebarClass = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      {/* Backdrop mobile — klik di luar sidebar untuk tutup */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40,
          }}
        />
      )}

      <aside className={sidebarClass}>
        {/* Header: tombol percakapan baru + collapse */}
        <div className="sidebar-header">
          <button className="sidebar-new-chat" onClick={onNewChat}>
            <PlusIcon />
            Percakapan baru
          </button>
          <button className="sidebar-toggle" onClick={onToggleCollapse} title="Sembunyikan sidebar">
            <CollapseIcon />
          </button>
        </div>

        {/* Daftar riwayat */}
        <div className="sidebar-list">
          {conversations.length === 0 ? (
            <p className="sidebar-empty">Belum ada riwayat percakapan.</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`sidebar-item ${conv.id === activeId ? 'active' : ''}`}
                onClick={() => onSelect(conv.id)}
              >
                <span className="sidebar-item-title">{conv.title}</span>
                <button
                  className="sidebar-item-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(conv.id)
                  }}
                  title="Hapus percakapan"
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer: link admin (tetap ada, minimalis) */}
        <div className="sidebar-footer">
          <a href="/admin" className="sidebar-footer-link">
            <GearIcon />
            Admin
          </a>
        </div>
      </aside>
    </>
  )
}

// ── Inline icons (tidak pakai library tambahan, supaya tetap minimal) ─────────

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6h14Z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}
