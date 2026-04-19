'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  createBook, processBook, deleteBook,
  createLectureSlide, processLectureSlide, deleteLectureSlide,
  createExam, deleteExam,
  getSignedUrl,
} from './actions'

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed'

type Book = {
  id: string
  title: string
  author: string | null
  processing_status: ProcessingStatus
  processing_error: string | null
  created_at: string
}

type Slide = {
  id: string
  title: string
  lecture_number: number | null
  processing_status: ProcessingStatus
  processing_error: string | null
  uploaded_at: string
}

type Exam = {
  id: string
  title: string
  exam_date: string | null
  processing_status: ProcessingStatus
  processing_error: string | null
  created_at: string
}

type Tab = 'books' | 'slides' | 'exams'
type ModalType = 'book' | 'slide' | 'exam' | null

// ── Dark input ─────────────────────────────────────────────────────────────

const inputBaseStyle = {
  background: '#191919',
  border: '1px solid #2d2d2d',
  color: '#ebebeb',
} as const

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
      style={inputBaseStyle}
      onFocus={e => {
        e.currentTarget.style.borderColor = '#4a4a4a'
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'
        props.onFocus?.(e)
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = '#2d2d2d'
        e.currentTarget.style.boxShadow = 'none'
        props.onBlur?.(e)
      }}
    />
  )
}

// ── StatusDot ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ProcessingStatus }) {
  if (status === 'ready') return null
  const color = status === 'failed' ? '#f04438' : '#e9a84c'
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: 6, height: 6, background: color }}
      title={status}
    />
  )
}

// ── Material list ──────────────────────────────────────────────────────────

type ListItem = {
  id: string
  title: string
  subtitle?: string
  status: ProcessingStatus
  errorMessage?: string
  type: 'book' | 'slide' | 'exam'
}

function MaterialList({
  items,
  emptyText,
  onDelete,
  onView,
}: {
  items: ListItem[]
  emptyText: string
  onDelete: (id: string, title: string) => void
  onView: (type: 'book' | 'slide' | 'exam', id: string) => void
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: '#ebebeb', opacity: 0.3 }}>
        <p className="text-sm">{emptyText}</p>
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid #2d2d2d' }}>
      {items.map(item => (
        <div
          key={item.id}
          className="group flex items-center justify-between gap-4"
          style={{
            padding: '12px 0',
            borderBottom: '1px solid #2d2d2d',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <StatusDot status={item.status} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#ebebeb' }}>
                {item.title}
              </p>
              {item.subtitle && (
                <p className="text-xs mt-0.5 truncate" style={{ color: '#ebebeb', opacity: 0.45 }}>
                  {item.subtitle}
                </p>
              )}
              {item.errorMessage && (
                <p className="text-xs mt-0.5 truncate" style={{ color: '#f04438' }} title={item.errorMessage}>
                  {item.errorMessage}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Status label for non-ready */}
            {item.status !== 'ready' && (
              <span className="text-[0.6875rem] px-2 py-0.5 rounded-full" style={{
                color: item.status === 'failed' ? '#f04438' : '#e9a84c',
                background: item.status === 'failed' ? 'rgba(240,68,56,0.1)' : 'rgba(233,168,76,0.1)',
              }}>
                {item.status === 'pending' ? 'Pending' : item.status === 'processing' ? 'Processing…' : 'Failed'}
              </span>
            )}

            {/* View */}
            {item.status === 'ready' && (
              <button
                onClick={() => onView(item.type, item.id)}
                title="Open file"
                className="flex items-center justify-center rounded transition-all opacity-0 group-hover:opacity-100"
                style={{ width: 28, height: 28, color: '#ebebeb' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#323232')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
            )}

            {/* Delete */}
            <button
              onClick={() => onDelete(item.id, item.title)}
              title="Delete"
              className="flex items-center justify-center rounded transition-all opacity-0 group-hover:opacity-100"
              style={{ width: 28, height: 28, color: '#ebebeb' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(240,68,56,0.15)'
                ;(e.currentTarget as HTMLElement).style.color = '#f04438'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = '#ebebeb'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MaterialsClient({
  courseId,
  initialBooks,
  initialSlides,
  initialExams,
}: {
  courseId: string
  initialBooks: Book[]
  initialSlides: Slide[]
  initialExams: Exam[]
}) {
  const [tab, setTab] = useState<Tab>('books')
  const [books, setBooks] = useState<Book[]>(initialBooks)
  const [slides, setSlides] = useState<Slide[]>(initialSlides)
  const [exams, setExams] = useState<Exam[]>(initialExams)
  const [modal, setModal] = useState<ModalType>(null)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [polling, setPolling] = useState(() =>
    [...initialBooks, ...initialSlides].some(
      i => i.processing_status === 'pending' || i.processing_status === 'processing'
    )
  )
  const [autoTitle, setAutoTitle] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Poll every 3s while any book/slide is processing
  useEffect(() => {
    if (!polling) return

    const supabase = createClient()
    let active = true

    const interval = setInterval(async () => {
      if (!active) return

      const [booksRes, slidesRes] = await Promise.all([
        supabase.from('books').select('id, processing_status, processing_error').eq('course_id', courseId),
        supabase.from('lecture_slides').select('id, processing_status, processing_error').eq('course_id', courseId),
      ])

      if (!active) return

      if (booksRes.data) {
        setBooks(prev =>
          prev.map(b => {
            const u = booksRes.data!.find(x => x.id === b.id)
            return u ? { ...b, processing_status: u.processing_status as ProcessingStatus, processing_error: u.processing_error } : b
          })
        )
      }
      if (slidesRes.data) {
        setSlides(prev =>
          prev.map(s => {
            const u = slidesRes.data!.find(x => x.id === s.id)
            return u ? { ...s, processing_status: u.processing_status as ProcessingStatus, processing_error: u.processing_error } : s
          })
        )
      }

      const allData = [...(booksRes.data ?? []), ...(slidesRes.data ?? [])]
      const stillPending = allData.some(
        i => i.processing_status === 'pending' || i.processing_status === 'processing'
      )
      if (!stillPending) setPolling(false)
    }, 3000)

    return () => { active = false; clearInterval(interval) }
  }, [polling, courseId])

  function openModal(type: ModalType) {
    setModal(type)
    setFormError('')
    setAutoTitle('')
    dialogRef.current?.showModal()
  }

  function closeModal() {
    dialogRef.current?.close()
    setModal(null)
    setFormError('')
    setAutoTitle('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
      setAutoTitle(name)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { setFormError('Please select a file'); return }

    const form = e.currentTarget
    const get = (name: string) =>
      ((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '').trim()

    const title = autoTitle.trim() || file.name.replace(/\.[^.]+$/, '')
    const author = get('author')
    const lectureNumber = parseInt(get('lecture_number'))
    const examDate = get('exam_date')

    if (!title) { setFormError('Could not determine a title — please enter one'); return }

    setFormError('')
    setUploading(true)

    try {
      const supabase = createClient()

      if (modal === 'book') {
        const result = await createBook(courseId, {
          title, author: author || undefined,
          fileName: file.name, fileType: file.type, fileSize: file.size,
        })
        const { error: upErr } = await supabase.storage.from('materials').uploadToSignedUrl(result.storagePath, result.token, file)
        if (upErr) throw new Error(upErr.message)

        setBooks(prev => [{
          id: result.bookId, title, author: author || null,
          processing_status: 'pending', processing_error: null,
          created_at: new Date().toISOString(),
        }, ...prev])
        setPolling(true)
        closeModal()
        processBook(result.bookId, courseId).catch(console.error)
      }

      if (modal === 'slide') {
        const lNum = isNaN(lectureNumber) ? undefined : lectureNumber
        const result = await createLectureSlide(courseId, {
          title, lectureNumber: lNum,
          fileName: file.name, fileType: file.type, fileSize: file.size,
        })
        const { error: upErr } = await supabase.storage.from('materials').uploadToSignedUrl(result.storagePath, result.token, file)
        if (upErr) throw new Error(upErr.message)

        setSlides(prev => [{
          id: result.slideId, title, lecture_number: lNum ?? null,
          processing_status: 'pending', processing_error: null,
          uploaded_at: new Date().toISOString(),
        }, ...prev])
        setPolling(true)
        closeModal()
        processLectureSlide(result.slideId, courseId).catch(console.error)
      }

      if (modal === 'exam') {
        const result = await createExam(courseId, {
          title, examDate: examDate || undefined,
          fileName: file.name, fileType: file.type, fileSize: file.size,
        })
        const { error: upErr } = await supabase.storage.from('materials').uploadToSignedUrl(result.storagePath, result.token, file)
        if (upErr) throw new Error(upErr.message)

        setExams(prev => [{
          id: result.examId, title, exam_date: examDate || null,
          processing_status: 'ready', processing_error: null,
          created_at: new Date().toISOString(),
        }, ...prev])
        closeModal()
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleView(type: 'book' | 'slide' | 'exam', id: string) {
    try {
      const url = await getSignedUrl(type, id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open file')
    }
  }

  async function handleDelete(type: 'book' | 'slide' | 'exam', id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      if (type === 'book') {
        await deleteBook(id, courseId)
        setBooks(prev => prev.filter(b => b.id !== id))
      } else if (type === 'slide') {
        await deleteLectureSlide(id, courseId)
        setSlides(prev => prev.filter(s => s.id !== id))
      } else {
        await deleteExam(id, courseId)
        setExams(prev => prev.filter(ex => ex.id !== id))
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const addBtnLabel = tab === 'books' ? 'Add Book' : tab === 'slides' ? 'Add Slides' : 'Add Exam'
  const modalType: ModalType = tab === 'books' ? 'book' : tab === 'slides' ? 'slide' : 'exam'

  function TabBtn({ t, label }: { t: Tab; label: string }) {
    const active = tab === t
    return (
      <button
        onClick={() => setTab(t)}
        className="px-4 py-2.5 text-sm font-medium transition-colors"
        style={{
          color: active ? '#ebebeb' : '#ebebeb',
          opacity: active ? 1 : 0.45,
          borderBottom: active ? '2px solid #e9a84c' : '2px solid transparent',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex items-center justify-between"
        style={{ borderBottom: '1px solid #2d2d2d', marginBottom: 0 }}
      >
        <div className="flex">
          <TabBtn t="books" label={`Books${books.length ? ` (${books.length})` : ''}`} />
          <TabBtn t="slides" label={`Slides${slides.length ? ` (${slides.length})` : ''}`} />
          <TabBtn t="exams" label={`Exams${exams.length ? ` (${exams.length})` : ''}`} />
        </div>
        <button
          onClick={() => openModal(modalType)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: '#3a3a3a', color: '#ebebeb' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#4a4a4a')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#3a3a3a')}
        >
          <span className="text-base leading-none">+</span>
          {addBtnLabel}
        </button>
      </div>

      {/* Tab content */}
      <div className="pt-0">
        {tab === 'books' && (
          <MaterialList
            items={books.map(b => ({
              id: b.id, title: b.title, type: 'book' as const,
              subtitle: b.author ?? undefined,
              status: b.processing_status,
              errorMessage: b.processing_error ?? undefined,
            }))}
            emptyText="No books yet. Upload a textbook PDF to get started."
            onDelete={(id, title) => handleDelete('book', id, title)}
            onView={handleView}
          />
        )}
        {tab === 'slides' && (
          <MaterialList
            items={slides.map(s => ({
              id: s.id, title: s.title, type: 'slide' as const,
              subtitle: s.lecture_number != null ? `Lecture ${s.lecture_number}` : undefined,
              status: s.processing_status,
              errorMessage: s.processing_error ?? undefined,
            }))}
            emptyText="No slide decks yet. Upload a lecture PDF to get started."
            onDelete={(id, title) => handleDelete('slide', id, title)}
            onView={handleView}
          />
        )}
        {tab === 'exams' && (
          <MaterialList
            items={exams.map(ex => ({
              id: ex.id, title: ex.title, type: 'exam' as const,
              subtitle: ex.exam_date ?? undefined,
              status: ex.processing_status,
              errorMessage: ex.processing_error ?? undefined,
            }))}
            emptyText="No exam papers yet."
            onDelete={(id, title) => handleDelete('exam', id, title)}
            onView={handleView}
          />
        )}
      </div>

      {/* Upload dialog */}
      <dialog
        ref={dialogRef}
        className="rounded-xl p-0 w-full max-w-md backdrop:bg-black/60"
        style={{
          background: '#323232',
          border: '1px solid #2d2d2d',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
        onClose={() => { setModal(null); setFormError('') }}
      >
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold" style={{ color: '#ebebeb' }}>
            {modal === 'book' && 'Add Book'}
            {modal === 'slide' && 'Add Slide Deck'}
            {modal === 'exam' && 'Add Exam Paper'}
          </h2>

          {formError && (
            <p
              className="text-sm px-3 py-2 rounded-lg"
              style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}
            >
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>Title</label>
            <DarkInput
              name="title"
              value={autoTitle}
              onChange={e => setAutoTitle(e.target.value)}
              placeholder={
                modal === 'book' ? 'e.g. Introduction to Algorithms' :
                modal === 'slide' ? 'e.g. Lecture 3 — Sorting Algorithms' :
                'e.g. Midterm 2025'
              }
            />
          </div>

          {modal === 'book' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>Author</label>
              <DarkInput name="author" placeholder="e.g. Cormen, Leiserson, Rivest, Stein" />
            </div>
          )}

          {modal === 'slide' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>Lecture Number</label>
              <DarkInput name="lecture_number" type="number" min={1} placeholder="e.g. 3" />
            </div>
          )}

          {modal === 'exam' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>Exam Date</label>
              <DarkInput name="exam_date" type="date" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>
              File * (PDF or PowerPoint, max 50 MB)
            </label>
            <input
              ref={fileRef}
              type="file"
              required
              accept=".pdf,.pptx,.ppt"
              onChange={handleFileChange}
              className="text-sm"
              style={{ color: '#ebebeb', opacity: 0.7 }}
            />
          </div>

          {uploading && (
            <p className="text-sm text-center py-1" style={{ color: '#e9a84c' }}>
              Uploading… please wait.
            </p>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={closeModal}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ color: '#ebebeb', opacity: 0.7 }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = '#323232'
                ;(e.currentTarget as HTMLElement).style.opacity = '1'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.opacity = '0.7'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              style={{ background: '#3a3a3a', color: '#ebebeb' }}
              onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLElement).style.background = '#4a4a4a' }}
              onMouseLeave={e => { if (!uploading) (e.currentTarget as HTMLElement).style.background = '#3a3a3a' }}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
