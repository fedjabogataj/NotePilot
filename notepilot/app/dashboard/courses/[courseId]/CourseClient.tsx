'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Book, Presentation, ClipboardList, Plus, Loader2, FileX, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  createBook, processBook, deleteBook,
  createLectureSlide, processLectureSlide, deleteLectureSlide,
  createExam, deleteExam,
  getSignedUrl,
} from './actions'

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed'

type BookItem = {
  id: string; title: string; author: string | null
  processing_status: ProcessingStatus; processing_error: string | null; created_at: string
}
type SlideItem = {
  id: string; title: string; lecture_number: number | null
  processing_status: ProcessingStatus; processing_error: string | null; uploaded_at: string
}
type ExamItem = {
  id: string; title: string; exam_date: string | null
  processing_status: ProcessingStatus; processing_error: string | null; created_at: string
}
type ModalType = 'book' | 'slide' | 'exam' | null

const inputStyle = { background: '#111111', border: '1px solid #2e2e2e', color: '#e8e8e8' } as const

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg px-3 py-2 text-[14px] outline-none transition-all"
      style={inputStyle}
      onFocus={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'; props.onFocus?.(e) }}
      onBlur={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.boxShadow = 'none'; props.onBlur?.(e) }}
    />
  )
}

export default function CourseClient({
  courseId, courseName, courseCode, courseSemester, courseDescription,
  initialBooks, initialSlides, initialExams, initialView,
}: {
  courseId: string; courseName: string; courseCode: string | null
  courseSemester: string | null; courseDescription: string | null
  initialBooks: BookItem[]; initialSlides: SlideItem[]; initialExams: ExamItem[]
  initialView: string | null
}) {
  const router = useRouter()
  const [books,  setBooks]  = useState<BookItem[]>(initialBooks)
  const [slides, setSlides] = useState<SlideItem[]>(initialSlides)
  const [exams,  setExams]  = useState<ExamItem[]>(initialExams)
  const [modal, setModal] = useState<ModalType>(null)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [autoTitle, setAutoTitle] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [viewerLoading, setViewerLoading] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [viewerTitle, setViewerTitle] = useState<string>('')
  const [viewerKey, setViewerKey] = useState<string | null>(null) // "type:id"

  const [polling, setPolling] = useState(() =>
    [...initialBooks, ...initialSlides].some(i => i.processing_status === 'pending' || i.processing_status === 'processing')
  )

  // Load viewer when initialView changes (from URL / navigation)
  useEffect(() => {
    if (!initialView) { setViewerUrl(null); setViewerKey(null); return }
    if (initialView === viewerKey) return

    const [type, id] = initialView.split(':') as ['book' | 'slide' | 'exam', string]
    if (!type || !id) return

    // Find title from local state
    let title = ''
    if (type === 'book')  title = books.find(b => b.id === id)?.title ?? ''
    if (type === 'slide') title = slides.find(s => s.id === id)?.title ?? ''
    if (type === 'exam')  title = exams.find(e => e.id === id)?.title ?? ''

    setViewerTitle(title)
    setViewerKey(initialView)
    setViewerUrl(null)
    setViewerError(null)
    setViewerLoading(true)

    getSignedUrl(type, id)
      .then(url => { setViewerUrl(url); setViewerLoading(false) })
      .catch(err => { setViewerError(err instanceof Error ? err.message : 'Failed to load'); setViewerLoading(false) })
  }, [initialView]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling
  useEffect(() => {
    if (!polling) return
    const supabase = createClient()
    let active = true
    const iv = setInterval(async () => {
      if (!active) return
      const [br, sr] = await Promise.all([
        supabase.from('books').select('id, processing_status, processing_error').eq('course_id', courseId),
        supabase.from('lecture_slides').select('id, processing_status, processing_error').eq('course_id', courseId),
      ])
      if (!active) return
      if (br.data) setBooks(prev => prev.map(b => { const u = br.data!.find(x => x.id === b.id); return u ? { ...b, processing_status: u.processing_status as ProcessingStatus, processing_error: u.processing_error } : b }))
      if (sr.data) setSlides(prev => prev.map(s => { const u = sr.data!.find(x => x.id === s.id); return u ? { ...s, processing_status: u.processing_status as ProcessingStatus, processing_error: u.processing_error } : s }))
      const all = [...(br.data ?? []), ...(sr.data ?? [])]
      if (!all.some(i => i.processing_status === 'pending' || i.processing_status === 'processing')) setPolling(false)
    }, 3000)
    return () => { active = false; clearInterval(iv) }
  }, [polling, courseId])

  // Upload modal helpers
  function openModal(type: ModalType) {
    setModal(type); setFormError(''); setAutoTitle('')
    dialogRef.current?.showModal()
  }
  function closeModal() {
    dialogRef.current?.close(); setModal(null); setFormError(''); setAutoTitle('')
    if (fileRef.current) fileRef.current.value = ''
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setAutoTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { setFormError('Please select a file'); return }
    const form = e.currentTarget
    const get = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim()
    const title = autoTitle.trim() || file.name.replace(/\.[^.]+$/, '')
    if (!title) { setFormError('Could not determine a title'); return }
    setFormError(''); setUploading(true)
    try {
      const supabase = createClient()
      if (modal === 'book') {
        const r = await createBook(courseId, { title, author: get('author') || undefined, fileName: file.name, fileType: file.type, fileSize: file.size })
        const { error } = await supabase.storage.from('materials').uploadToSignedUrl(r.storagePath, r.token, file)
        if (error) throw new Error(error.message)
        setBooks(prev => [{ id: r.bookId, title, author: get('author') || null, processing_status: 'pending', processing_error: null, created_at: new Date().toISOString() }, ...prev])
        setPolling(true); closeModal()
        processBook(r.bookId, courseId).catch(console.error)
      }
      if (modal === 'slide') {
        const lNum = parseInt(get('lecture_number')); const ln = isNaN(lNum) ? undefined : lNum
        const r = await createLectureSlide(courseId, { title, lectureNumber: ln, fileName: file.name, fileType: file.type, fileSize: file.size })
        const { error } = await supabase.storage.from('materials').uploadToSignedUrl(r.storagePath, r.token, file)
        if (error) throw new Error(error.message)
        setSlides(prev => [{ id: r.slideId, title, lecture_number: ln ?? null, processing_status: 'pending', processing_error: null, uploaded_at: new Date().toISOString() }, ...prev])
        setPolling(true); closeModal()
        processLectureSlide(r.slideId, courseId).catch(console.error)
      }
      if (modal === 'exam') {
        const r = await createExam(courseId, { title, examDate: get('exam_date') || undefined, fileName: file.name, fileType: file.type, fileSize: file.size })
        const { error } = await supabase.storage.from('materials').uploadToSignedUrl(r.storagePath, r.token, file)
        if (error) throw new Error(error.message)
        setExams(prev => [{ id: r.examId, title, exam_date: get('exam_date') || null, processing_status: 'ready', processing_error: null, created_at: new Date().toISOString() }, ...prev])
        closeModal()
      }
      router.refresh() // update sidebar
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!viewerKey) return
    const [type, id] = viewerKey.split(':') as ['book' | 'slide' | 'exam', string]
    const title = viewerTitle
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      if (type === 'book')  { await deleteBook(id, courseId); setBooks(prev => prev.filter(b => b.id !== id)) }
      if (type === 'slide') { await deleteLectureSlide(id, courseId); setSlides(prev => prev.filter(s => s.id !== id)) }
      if (type === 'exam')  { await deleteExam(id, courseId); setExams(prev => prev.filter(e => e.id !== id)) }
      setViewerUrl(null); setViewerKey(null)
      router.replace(`/dashboard/courses/${courseId}`)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const showOverview = !initialView
  const showViewer  = !!initialView

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-6"
        style={{ height: 44, borderBottom: '1px solid #2e2e2e', background: '#161616' }}
      >
        {showViewer ? (
          <>
            <span className="text-[13px] truncate" style={{ color: '#e8e8e8', opacity: 0.7 }}>
              {viewerTitle}
            </span>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[12px] transition-colors"
              style={{ color: '#e8e8e8', opacity: 0.45 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f04438'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#e8e8e8'; (e.currentTarget as HTMLElement).style.opacity = '0.45' }}
            >
              <Trash2 size={13} />
              Delete
            </button>
          </>
        ) : (
          <>
            <span className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.7 }}>
              {courseName}
              {courseCode && <span className="font-mono ml-2 text-[12px]" style={{ opacity: 0.5 }}>{courseCode}</span>}
            </span>
            <div className="flex items-center gap-1">
              {([ ['book', 'Book', <Book size={12} key="b" />], ['slide', 'Slides', <Presentation size={12} key="s" />], ['exam', 'Exam', <ClipboardList size={12} key="e" />] ] as const).map(([type, label, icon]) => (
                <button
                  key={type}
                  onClick={() => openModal(type)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[12px] transition-colors"
                  style={{ color: '#e8e8e8', opacity: 0.55, background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2a2a2a'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.55' }}
                >
                  {icon}
                  <Plus size={10} />
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {showOverview && (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto px-8" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 48 }}>
            <h1 className="font-bold mb-2" style={{ fontSize: 28, color: '#e8e8e8' }}>{courseName}</h1>
            <div className="flex items-center gap-3 mb-6" style={{ fontSize: 13, color: '#e8e8e8', opacity: 0.45 }}>
              {courseSemester && <span>{courseSemester}</span>}
              {courseCode && <span className="font-mono">{courseCode}</span>}
            </div>
            {courseDescription && (
              <p className="mb-8" style={{ fontSize: 15, color: '#e8e8e8', opacity: 0.6, lineHeight: 1.7 }}>{courseDescription}</p>
            )}

            {/* Material summary tiles */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Books', count: books.length, icon: <Book size={18} />, type: 'book' as const },
                { label: 'Slides', count: slides.length, icon: <Presentation size={18} />, type: 'slide' as const },
                { label: 'Exams', count: exams.length, icon: <ClipboardList size={18} />, type: 'exam' as const },
              ].map(({ label, count, icon, type }) => (
                <button
                  key={label}
                  onClick={() => openModal(type)}
                  className="flex flex-col items-start p-4 rounded-lg transition-colors text-left"
                  style={{ background: '#222222', border: '1px solid #2e2e2e', color: '#e8e8e8' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#3a3a3a'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#2e2e2e'}
                >
                  <span style={{ opacity: 0.45, marginBottom: 8 }}>{icon}</span>
                  <span className="text-[22px] font-bold">{count}</span>
                  <span className="text-[13px]" style={{ opacity: 0.5 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showViewer && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {viewerLoading && (
            <div className="flex-1 flex items-center justify-center" style={{ color: '#e8e8e8', opacity: 0.35 }}>
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}
          {viewerError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <FileX size={28} style={{ color: '#e8e8e8', opacity: 0.25 }} />
              <p className="text-[13px]" style={{ color: '#e8e8e8', opacity: 0.45 }}>{viewerError}</p>
            </div>
          )}
          {viewerUrl && !viewerLoading && !viewerError && (
            <iframe src={viewerUrl} className="flex-1 w-full border-0" title={viewerTitle} />
          )}
        </div>
      )}

      {/* ── Upload dialog ───────────────────────────────────────────── */}
      <dialog
        ref={dialogRef}
        className="rounded-xl p-0 w-full max-w-md backdrop:bg-black/60"
        style={{ background: '#222222', border: '1px solid #2e2e2e', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
        onClose={() => { setModal(null); setFormError('') }}
      >
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <h2 className="text-[18px] font-semibold" style={{ color: '#e8e8e8' }}>
            {modal === 'book' ? 'Add Book' : modal === 'slide' ? 'Add Slide Deck' : 'Add Exam Paper'}
          </h2>
          {formError && (
            <p className="text-[13px] px-3 py-2 rounded-lg" style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}>
              {formError}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.7 }}>Title</label>
            <DarkInput name="title" value={autoTitle} onChange={e => setAutoTitle(e.target.value)}
              placeholder={modal === 'book' ? 'e.g. Introduction to Algorithms' : modal === 'slide' ? 'e.g. Lecture 3 — Sorting' : 'e.g. Midterm 2025'} />
          </div>
          {modal === 'book' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.7 }}>Author</label>
              <DarkInput name="author" placeholder="e.g. Cormen, Leiserson, Rivest, Stein" />
            </div>
          )}
          {modal === 'slide' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.7 }}>Lecture Number</label>
              <DarkInput name="lecture_number" type="number" min={1} placeholder="e.g. 3" />
            </div>
          )}
          {modal === 'exam' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.7 }}>Exam Date</label>
              <DarkInput name="exam_date" type="date" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.7 }}>File * (PDF or PowerPoint, max 50 MB)</label>
            <input ref={fileRef} type="file" required accept=".pdf,.pptx,.ppt" onChange={handleFileChange} className="text-[13px]" style={{ color: '#e8e8e8', opacity: 0.7 }} />
          </div>
          {uploading && <p className="text-[13px] text-center" style={{ color: '#e9a84c' }}>Uploading… please wait.</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={closeModal} disabled={uploading}
              className="px-4 py-2 text-[13px] font-medium rounded-lg disabled:opacity-50"
              style={{ color: '#e8e8e8', opacity: 0.7 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2a2a2a'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.7' }}>
              Cancel
            </button>
            <button type="submit" disabled={uploading}
              className="px-4 py-2 text-[13px] font-medium rounded-lg disabled:opacity-60"
              style={{ background: '#333333', color: '#e8e8e8' }}
              onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLElement).style.background = '#3d3d3d' }}
              onMouseLeave={e => { if (!uploading) (e.currentTarget as HTMLElement).style.background = '#333333' }}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
