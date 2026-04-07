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

const inputCls =
  'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: ProcessingStatus }) {
  const styles: Record<ProcessingStatus, string> = {
    pending:    'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400',
    processing: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
    ready:      'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400',
    failed:     'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400',
  }
  const labels: Record<ProcessingStatus, string> = {
    pending: 'Pending', processing: 'Processing', ready: 'Ready', failed: 'Failed',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

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
      <div className="text-center py-16 text-gray-400 dark:text-gray-600">
        <p className="text-sm">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {items.map(item => (
        <div key={item.id} className="group flex items-center justify-between py-3.5 gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
            {item.subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.subtitle}</p>
            )}
            {item.errorMessage && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 truncate" title={item.errorMessage}>
                {item.errorMessage}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={item.status} />
            {/* View button — only shown when file is ready */}
            {item.status === 'ready' && (
              <button
                onClick={() => onView(item.type, item.id)}
                title="Open file"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
            )}
            <button
              onClick={() => onDelete(item.id, item.title)}
              title="Delete"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
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

  // Poll every 3 s while any book or slide is still processing.
  useEffect(() => {
    if (!polling) return

    const supabase = createClient()
    let active = true

    const interval = setInterval(async () => {
      if (!active) return

      const [booksRes, slidesRes] = await Promise.all([
        supabase
          .from('books')
          .select('id, processing_status, processing_error')
          .eq('course_id', courseId),
        supabase
          .from('lecture_slides')
          .select('id, processing_status, processing_error')
          .eq('course_id', courseId),
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

      // Stop polling once all items have settled
      const allData = [...(booksRes.data ?? []), ...(slidesRes.data ?? [])]
      const stillPending = allData.some(
        i => i.processing_status === 'pending' || i.processing_status === 'processing'
      )
      if (!stillPending) setPolling(false)
    }, 3000)

    return () => {
      active = false
      clearInterval(interval)
    }
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
      // Strip extension and replace underscores/hyphens with spaces
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

    // Capture values before any async operations
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
        const { error: upErr } = await supabase.storage
          .from('materials')
          .uploadToSignedUrl(result.storagePath, result.token, file)
        if (upErr) throw new Error(upErr.message)

        // Add to list as pending, then process in the background
        setBooks(prev => [{
          id: result.bookId, title, author: author || null,
          processing_status: 'pending', processing_error: null,
          created_at: new Date().toISOString(),
        }, ...prev])
        setPolling(true)
        closeModal()

        // Fire-and-forget — polling picks up status changes
        processBook(result.bookId, courseId).catch(console.error)
      }

      if (modal === 'slide') {
        const lNum = isNaN(lectureNumber) ? undefined : lectureNumber
        const result = await createLectureSlide(courseId, {
          title, lectureNumber: lNum,
          fileName: file.name, fileType: file.type, fileSize: file.size,
        })
        const { error: upErr } = await supabase.storage
          .from('materials')
          .uploadToSignedUrl(result.storagePath, result.token, file)
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
        const { error: upErr } = await supabase.storage
          .from('materials')
          .uploadToSignedUrl(result.storagePath, result.token, file)
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

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`px-4 py-2.5 text-sm font-medium transition-colors ${
        tab === t
          ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent'
      }`}
    >
      {label}
    </button>
  )

  const addBtnLabel = tab === 'books' ? 'Add Book' : tab === 'slides' ? 'Add Slides' : 'Add Exam'
  const modalType: ModalType = tab === 'books' ? 'book' : tab === 'slides' ? 'slide' : 'exam'

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 mb-0">
        <div className="flex">
          {tabBtn('books', `Books${books.length ? ` (${books.length})` : ''}`)}
          {tabBtn('slides', `Slides${slides.length ? ` (${slides.length})` : ''}`)}
          {tabBtn('exams', `Exams${exams.length ? ` (${exams.length})` : ''}`)}
        </div>
        <button
          onClick={() => openModal(modalType)}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          {addBtnLabel}
        </button>
      </div>

      {/* Tab content */}
      <div className="pt-2">
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
        className="rounded-xl shadow-xl p-0 w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 backdrop:bg-black/50"
        onClose={() => { setModal(null); setFormError('') }}
      >
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {modal === 'book' && 'Add Book'}
            {modal === 'slide' && 'Add Slide Deck'}
            {modal === 'exam' && 'Add Exam Paper'}
          </h2>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">
              {formError}
            </p>
          )}

          <Field label="Title">
            <input
              name="title"
              value={autoTitle}
              onChange={e => setAutoTitle(e.target.value)}
              placeholder={
                modal === 'book' ? 'e.g. Introduction to Algorithms' :
                modal === 'slide' ? 'e.g. Lecture 3 — Sorting Algorithms' :
                'e.g. Midterm 2025'
              }
              className={inputCls}
            />
          </Field>

          {modal === 'book' && (
            <Field label="Author">
              <input name="author" placeholder="e.g. Cormen, Leiserson, Rivest, Stein" className={inputCls} />
            </Field>
          )}

          {modal === 'slide' && (
            <Field label="Lecture Number">
              <input name="lecture_number" type="number" min={1} placeholder="e.g. 3" className={inputCls} />
            </Field>
          )}

          {modal === 'exam' && (
            <Field label="Exam Date">
              <input name="exam_date" type="date" className={inputCls} />
            </Field>
          )}

          <Field label="File * (PDF or PowerPoint, max 50 MB)">
            <input
              ref={fileRef}
              type="file"
              required
              accept=".pdf,.pptx,.ppt"
              onChange={handleFileChange}
              className="text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900 file:cursor-pointer transition-colors"
            />
          </Field>

          {uploading && (
            <p className="text-sm text-blue-600 dark:text-blue-400 text-center py-1">
              Uploading… please wait.
            </p>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={closeModal}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
