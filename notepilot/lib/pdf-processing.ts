// PDF parsing and chunking utilities.
// Server-only — uses pdf2json (Node.js). Never import in browser code.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFParser = require('pdf2json')

const BOOK_CHUNK_SIZE = 2000    // chars ≈ 500 tokens at ~4 chars/token
const BOOK_CHUNK_OVERLAP = 200  // chars ≈ 50 tokens

export type PageText = {
  pageNumber: number
  text: string
}

export type BookChunk = {
  content: string
  page_number: number
  chunk_index: number
}

export type SlideChunk = {
  content: string
  slide_number: number
  chunk_index: number
}

/**
 * Extracts text from each page of a PDF buffer.
 * Uses pdf2json in raw-text mode (no URL encoding of text values).
 */
export async function parsePdfPages(buffer: Buffer): Promise<PageText[]> {
  return new Promise((resolve, reject) => {
    // Second arg `1` enables raw text mode — T values are plain strings.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = new PDFParser(null, 1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parser.on('pdfParser_dataError', (err: any) => {
      reject(new Error(err?.parserError ?? 'PDF parsing failed'))
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parser.on('pdfParser_dataReady', (data: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pages: PageText[] = (data.Pages ?? []).map((page: any, i: number) => {
        const text = (page.Texts ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((t: any) => (t.R ?? []).map((r: any) => r.T ?? '').join(' '))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        return { pageNumber: i + 1, text }
      })
      resolve(pages)
    })

    parser.parseBuffer(buffer)
  })
}

/**
 * Splits book pages into overlapping chunks of ~500 tokens each.
 * Prefers breaking at sentence boundaries.
 */
export function chunkBookPages(pages: PageText[]): BookChunk[] {
  const chunks: BookChunk[] = []
  let chunkIndex = 0

  for (const { text, pageNumber } of pages) {
    if (text.length < 50) continue  // Skip nearly-empty pages

    let start = 0
    while (start < text.length) {
      let end = Math.min(start + BOOK_CHUNK_SIZE, text.length)

      // Prefer breaking at a sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end)
        if (lastPeriod > start + BOOK_CHUNK_SIZE / 2) end = lastPeriod + 1
      }

      const content = text.slice(start, end).trim()
      if (content.length > 50) {
        chunks.push({ content, page_number: pageNumber, chunk_index: chunkIndex++ })
      }

      if (end >= text.length) break
      start = end - BOOK_CHUNK_OVERLAP
    }
  }

  return chunks
}

/**
 * Produces one chunk per slide (slides are short enough not to need sub-splitting).
 */
export function chunkSlidePages(pages: PageText[]): SlideChunk[] {
  return pages
    .filter(p => p.text.length > 10)
    .map((p, i) => ({
      content: p.text,
      slide_number: p.pageNumber,
      chunk_index: i,
    }))
}
