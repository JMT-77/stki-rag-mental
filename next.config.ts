import type { NextConfig } from 'next'

/**
 * next.config.ts
 * ===============
 * Konfigurasi Next.js untuk CL-RAG v5.
 *
 * - serverExternalPackages: pdf-parse butuh akses Node.js native module
 *   (fs, Buffer) dan tidak boleh di-bundle oleh webpack/turbopack.
 * - headers: tambahan keamanan dasar untuk semua API routes.
 */

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
}

export default nextConfig
