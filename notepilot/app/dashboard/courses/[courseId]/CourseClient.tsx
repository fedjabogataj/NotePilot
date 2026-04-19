'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Book, Presentation, ClipboardList, Loader2, FileX } from 'lucide-react'
import { getSignedUrl } from './actions'

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed'

type BookItem   = { id: string; title: string; author: string | null; processing_status: ProcessingStatus; processing_error: string | null; created_at: string }
type SlideItem  = { id: string; title: string; lecture_number: number | null; processing_status: ProcessingStatus; processing_error: string | null; uploaded_at: string }
type ExamItem   = { id: string; title: string; exam_date: string | null; processing_status: ProcessingStatus; processing_error: string | null; created_at: string }

export default function CourseClient({
  courseId, courseName, courseCode, courseDescription,
  initialBooks, initialSlides, initialExams, initialView,
}: {
  courseId: string; courseName: string; courseCode: string | null
  courseDescription: string | null
  initialBooks: BookItem[]; initialSlides: SlideItem[]; initialExams: ExamItem[]
  initialView: string | null
}) {
  const router = useRouter()

  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [viewerLoading, setViewerLoading] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const loadedKeyRef = useRef<string | null>(null)

  // Resolve title for the current view
  function titleForView(key: string | null) {
    if (!key) return ''
    const [type, id] = key.split(':')
    if (type === 'book')  return initialBooks.find(b => b.id === id)?.title ?? ''
    if (type === 'slide') return initialSlides.find(s => s.id === id)?.title ?? ''
    if (type === 'exam')  return initialExams.find(e => e.id === id)?.title ?? ''
    return ''
  }

  // Load presigned URL whenever view key changes
  useEffect(() => {
    if (!initialView) return
    if (initialView === loadedKeyRef.current) return

    let cancelled = false

    void Promise.resolve().then(() => {
      if (cancelled) return

      setViewerUrl(null)
      setViewerError(null)
      setViewerLoading(true)

      const [type, id] = initialView.split(':') as ['book' | 'slide' | 'exam', string]
      getSignedUrl(type, id)
        .then(url => {
          if (cancelled) return
          setViewerUrl(url)
          loadedKeyRef.current = initialView
          setViewerLoading(false)
        })
        .catch(err => {
          if (cancelled) return
          setViewerError(err instanceof Error ? err.message : 'Failed to load')
          setViewerLoading(false)
        })
    })

    return () => {
      cancelled = true
    }
  }, [initialView])

  const viewerTitle = titleForView(initialView)
  const showOverview = !initialView
  const showViewer  = !!initialView

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Overview ────────────────────────────────────────────── */}
      {showOverview && (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto px-8" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 56 }}>
            <h1 className="mb-2 text-3xl font-bold" style={{ color: 'var(--color-np-text)' }}>{courseName}</h1>
            {courseCode && (
              <div className="flex items-center gap-3 mb-6 text-sm" style={{ color: 'var(--color-np-text)', opacity: 0.4 }}>
                <span className="font-mono">{courseCode}</span>
              </div>
            )}
            {courseDescription && (
              <p className="mb-6 text-base leading-7" style={{ color: 'var(--color-np-text)', opacity: 0.55 }}>{courseDescription}</p>
            )}

            {/* Files */}
            {(initialBooks.length + initialSlides.length + initialExams.length) > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--color-np-text)', opacity: 0.3, letterSpacing: '0.08em' }}>
                  Files
                </p>
                <div className="flex flex-col" style={{ border: '1px solid var(--color-np-border)', borderRadius: 10, overflow: 'hidden' }}>
                  {[
                    ...initialBooks.map(b => ({ id: b.id, title: b.title, sub: b.author, type: 'book' as const, status: b.processing_status })),
                    ...initialSlides.map(s => ({ id: s.id, title: s.title, sub: s.lecture_number != null ? `Lecture ${s.lecture_number}` : undefined, type: 'slide' as const, status: s.processing_status })),
                    ...initialExams.map(e => ({ id: e.id, title: e.title, sub: e.exam_date ?? undefined, type: 'exam' as const, status: e.processing_status })),
                  ].map((item, i, arr) => (
                    <button
                      key={item.id}
                      onClick={() => item.status === 'ready' && router.push(`/dashboard/courses/${courseId}?view=${item.type}:${item.id}`)}
                      className="flex items-center gap-3 px-4 text-left transition-all"
                      style={{
                        height: 44,
                        background: 'transparent',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--color-np-border)' : 'none',
                        cursor: item.status === 'ready' ? 'pointer' : 'default',
                        color: 'var(--color-np-text)',
                      }}
                      onMouseEnter={e => { if (item.status === 'ready') (e.currentTarget as HTMLElement).style.background = 'var(--color-np-surface)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <span style={{ opacity: 0.4, flexShrink: 0 }}>
                        {item.type === 'book' && <Book size={14} />}
                        {item.type === 'slide' && <Presentation size={14} />}
                        {item.type === 'exam' && <ClipboardList size={14} />}
                      </span>
                      <span className="flex-1 text-sm truncate" style={{ opacity: 0.8 }}>{item.title}</span>
                      {item.sub && <span className="text-xs shrink-0" style={{ opacity: 0.35 }}>{item.sub}</span>}
                      {item.status !== 'ready' && (
                        <span className="text-[0.6875rem] px-2 py-0.5 rounded-full shrink-0" style={{
                          color: item.status === 'failed' ? 'var(--color-np-red)' : 'var(--color-np-amber)',
                          background: item.status === 'failed' ? 'rgba(240,68,56,0.1)' : 'rgba(233,168,76,0.1)',
                        }}>
                          {item.status}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Viewer ──────────────────────────────────────────────── */}
      {showViewer && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {viewerLoading && (
            <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--color-np-text)', opacity: 0.3 }}>
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}
          {viewerError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <FileX size={26} style={{ color: 'var(--color-np-text)', opacity: 0.2 }} />
              <p className="text-sm" style={{ color: 'var(--color-np-text)', opacity: 0.4 }}>{viewerError}</p>
            </div>
          )}
          {viewerUrl && !viewerLoading && !viewerError && (
            <iframe src={viewerUrl} className="flex-1 w-full border-0" title={viewerTitle} />
          )}
        </div>
      )}
    </div>
  )
}
