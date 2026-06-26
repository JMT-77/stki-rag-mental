/**
 * src/app/layout.tsx
 * ====================
 * Root layout. Pakai system font stack (lihat --font-body di globals.css)
 * agar konsisten dengan gaya ChatGPT/Gemini — tidak perlu custom Google Font.
 */

import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
  title:       'CL-RAG',
  description: 'Asisten kesehatan mental berbasis referensi ilmiah',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
