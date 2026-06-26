'use client'

/**
 * src/app/admin/page.tsx
 * =======================
 * Admin panel CL-RAG v5.
 * Dilindungi password client-side via SHA-256.
 *
 * KEAMANAN: TIDAK ADA persistence login antar refresh/tab. Setiap kali
 * halaman ini dimuat ulang, user WAJIB masukkan password lagi. Ini
 * sengaja — sebelumnya sessionStorage menyimpan status "sudah login"
 * tapi password plaintext (dibutuhkan untuk Bearer token ke API) tidak
 * disimpan, menyebabkan bug: setelah refresh, UI mengira sudah login
 * tapi semua fetch ke /api/kb/* dan /api/admin/metrics gagal 401
 * karena Bearer token jadi kosong. Menghapus persistence sepenuhnya
 * menghindari kondisi "setengah login" seperti itu.
 *
 * Setup:
 *   1. Generate hash sekali:
 *      node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('passwordmu').digest('hex'))"
 *   2. Tambahkan ke .env.local:
 *      NEXT_PUBLIC_ADMIN_HASH=<hash_di_sini>
 */

import { useState } from 'react'
import Link from 'next/link'
import KBManager from '@/components/admin/KBManager'
import MetricsPanel from '@/components/admin/MetricsPanel'

type AdminTab = 'kb' | 'metrics'

// ── Helper: SHA-256 via Web Crypto API ────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data    = encoder.encode(text)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordInput,   setPasswordInput]   = useState('')
  const [plainPassword,   setPlainPassword]   = useState('')   // hanya hidup selama tab ini terbuka
  const [authError,       setAuthError]       = useState('')
  const [isChecking,      setIsChecking]      = useState(false)
  const [activeAdminTab,  setActiveAdminTab]  = useState<AdminTab>('kb')

  // ── Auth submit ─────────────────────────────────────────────────────────────
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordInput.trim()) return

    setIsChecking(true)
    setAuthError('')

    const hexHash    = await sha256(passwordInput)
    const targetHash = process.env.NEXT_PUBLIC_ADMIN_HASH

    if (!targetHash) {
      setAuthError('⚠️ NEXT_PUBLIC_ADMIN_HASH belum dikonfigurasi di .env.local')
      setIsChecking(false)
      return
    }

    if (hexHash === targetHash) {
      setPlainPassword(passwordInput)   // simpan sebelum di-clear; hidup hanya di memory tab ini
      setIsAuthenticated(true)
    } else {
      setAuthError('❌ Password salah. Coba lagi.')
    }

    setPasswordInput('')
    setIsChecking(false)
  }

  // ── Logout ──────────────────────────────────────────────────────────────────
  function handleLogout() {
    setIsAuthenticated(false)
    setPasswordInput('')
    setPlainPassword('')
    setAuthError('')
  }

  // ── Login gate ──────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <main
        style={{
          background: 'var(--bg)',
          minHeight:  '100vh',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding:    '24px',
        }}
      >
        <div
          style={{
            width:        '100%',
            maxWidth:     '420px',
            background:   'var(--surface)',
            border:       '1px solid var(--border)',
            borderRadius: '16px',
            padding:      '32px',
            display:      'flex',
            flexDirection: 'column',
            gap:          '20px',
          }}
        >
          {/* Warning */}
          <div className="admin-banner">
            🔒 Akses terbatas — Internal saja
          </div>

          {/* Title */}
          <div>
            <h2
              style={{
                fontFamily:   'var(--font-body)',
                fontSize:     '1.2rem',
                fontWeight:   600,
                color:        'var(--text-1)',
                marginBottom: '4px',
              }}
            >
              Admin Panel
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
              Masukkan password admin untuk melanjutkan.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password admin..."
              autoFocus
              style={{
                width:        '100%',
                padding:      '10px 14px',
                background:   'var(--bg)',
                border:       '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color:        'var(--text-1)',
                fontFamily:   'var(--font-body)',
                fontSize:     '0.96rem',
              }}
            />

            {/* Error */}
            {authError && (
              <p style={{ fontSize: '0.85rem', color: '#fca5a5', fontFamily: 'var(--font-body)' }}>
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isChecking || !passwordInput.trim()}
              className="btn-primary"
              style={{ padding: '10px', fontSize: '0.95rem', width: '100%' }}
            >
              {isChecking ? 'Memeriksa...' : 'Masuk →'}
            </button>
          </form>

          <Link
            href="/"
            style={{
              display:    'block',
              textAlign:  'center',
              fontSize:   '0.82rem',
              color:      'var(--text-3)',
              fontFamily: 'var(--font-body)',
            }}
          >
            ← Kembali ke halaman utama
          </Link>
        </div>
      </main>
    )
  }

  // ── Admin panel ─────────────────────────────────────────────────────────────
  return (
    <main
      style={{
        background: 'var(--bg)',
        minHeight:  '100vh',
        color:      'var(--text-1)',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px 12px' }}>

        {/* Warning banner */}
        <div className="admin-banner">
          ⚠️ Panel Admin — Akses internal saja. Jangan bagikan URL ini.
        </div>

        {/* Header */}
        <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>
                CL-RAG Admin
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>Kelola knowledge base dan pantau penggunaan sistem.</p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background:   'none',
                border:       '1px solid var(--border)',
                borderRadius: '8px',
                color:        'var(--text-3)',
                fontFamily:   'var(--font-body)',
                fontSize:     '0.82rem',
                padding:      '6px 12px',
                cursor:       'pointer',
                flexShrink:   0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--danger)'
                e.currentTarget.style.color       = 'var(--danger)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color       = 'var(--text-3)'
              }}
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
          <button
            className="mode-tab"
            data-active={String(activeAdminTab === 'kb')}
            onClick={() => setActiveAdminTab('kb')}
          >
            📚 Knowledge Base
          </button>
          <button
            className="mode-tab"
            data-active={String(activeAdminTab === 'metrics')}
            onClick={() => setActiveAdminTab('metrics')}
          >
            📊 Metrik
          </button>
        </div>

        {/* Tab content */}
        {activeAdminTab === 'kb'      && <KBManager adminPassword={plainPassword} />}
        {activeAdminTab === 'metrics' && <MetricsPanel adminPassword={plainPassword} />}
      </div>
    </main>
  )
}
