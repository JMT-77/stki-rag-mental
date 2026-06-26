/**
 * src/lib/kb/extract.ts
 * =====================
 * Ekstraksi teks dari file upload (TXT dan PDF).
 * Port dari modules/knowledge_base.extract_text_from_file() (Python v4).
 *
 * WAJIB berjalan di Node.js runtime (bukan Edge) —
 * pdf-parse membutuhkan Node.js Buffer.
 */

const MAX_FILE_SIZE = 4.5 * 1024 * 1024 // 4.5 MB — Vercel Hobby limit

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimum 4.5 MB.`
    )
  }

  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'txt') {
    const text = await file.text()
    return text.trim()
  }

  if (ext === 'pdf') {
    const arrayBuffer = await file.arrayBuffer()
    const buffer       = Buffer.from(arrayBuffer)

    // pdf-parse v2: API berubah dari function langsung menjadi class PDFParse.
    // Constructor terima { data: buffer }, lalu getText() untuk ekstrak teks.
    const { PDFParse } = await import('pdf-parse')
    const parser       = new PDFParse({ data: buffer })

    let text: string
    try {
      const result = await parser.getText()
      text = result.text ?? ''
    } finally {
      await parser.destroy()
    }

    if (!text.trim()) {
      throw new Error(
        'PDF ini tampaknya scan/gambar. Gunakan PDF text-based dari PubMed Central atau DOAJ.'
      )
    }
    return text.trim()
  }

  throw new Error(`Format tidak didukung: .${ext ?? '?'}. Gunakan .txt atau .pdf`)
}
