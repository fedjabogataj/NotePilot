'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Book, Presentation, ClipboardList, FileText, ChevronRight, Upload, Sparkles, FolderPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createCourse, createFolder } from './actions'
import { createBook, processBook, createLectureSlide, processLectureSlide, createExam } from './courses/[courseId]/actions'

type ItemType = 'course' | 'folder' | 'book' | 'slide' | 'exam' | 'note'
type Course = { id: string; name: string; code: string | null }

const inputStyle = { background: '#191919', border: '1px solid #2d2d2d', color: '#ebebeb' } as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.65 }}>{label}</label>
      {children}
    </div>
  )
}

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
      style={{ ...inputStyle, ...props.style }}
      onFocus={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'; props.onFocus?.(e) }}
      onBlur={e => { e.currentTarget.style.borderColor = '#2d2d2d'; e.currentTarget.style.boxShadow = 'none'; props.onBlur?.(e) }}
    />
  )
}

function DarkTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all resize-none"
      style={inputStyle}
      onFocus={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#2d2d2d'; e.currentTarget.style.boxShadow = 'none' }}
    />
  )
}

function ActionRow({ onCancel, submitLabel, disabled }: { onCancel: () => void; submitLabel: string; disabled: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3" style={{ borderTop: '1px solid #2d2d2d', paddingTop: 20 }}>
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        style={{ color: '#ebebeb', opacity: 0.6 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#323232'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.6' }}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        style={{ background: '#e9a84c', color: '#111111' }}
        onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = '#f0b85e' }}
        onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = '#e9a84c' }}
      >
        {submitLabel}
      </button>
    </div>
  )
}

// ── Type config ──────────────────────────────────────────────────────────────

const ORGANISE_TYPES: { type: ItemType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: 'folder', label: 'Folder',  icon: FolderPlus, desc: 'Organise items into a folder' },
  { type: 'course', label: 'Course',  icon: BookOpen,   desc: 'A study course with books, slides and exams' },
]

const FILE_TYPES: { type: ItemType; label: string; icon: React.ElementType; desc: string; available: boolean }[] = [
  { type: 'book',  label: 'Book',       icon: Book,          desc: 'Textbook or reference material',  available: true  },
  { type: 'slide', label: 'Slide Deck', icon: Presentation,  desc: 'Lecture slides or presentation',  available: true  },
  { type: 'exam',  label: 'Exam Paper', icon: ClipboardList, desc: 'Past exam or practice paper',     available: true  },
  { type: 'note',  label: 'Note',       icon: FileText,      desc: 'A standalone note or document',   available: false },
]

const MATERIAL_TYPES = new Set<ItemType>(['book', 'slide', 'exam'])

// ── Type button ──────────────────────────────────────────────────────────────

function TypeButton({
  icon: Icon,
  label,
  desc,
  active,
  disabled,
  disabledReason,
  comingSoon,
  onClick,
}: {
  icon: React.ElementType
  label: string
  desc: string
  active: boolean
  disabled?: boolean
  disabledReason?: string
  comingSoon?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
      style={{
        background: active ? '#323232' : '#262626',
        border: `1px solid ${active ? '#e9a84c' : '#2d2d2d'}`,
        color: '#ebebeb',
        opacity: disabled || comingSoon ? 0.4 : 1,
        cursor: disabled || comingSoon ? 'default' : 'pointer',
      }}
    >
      <Icon size={18} style={{ opacity: active ? 0.9 : 0.45, flexShrink: 0, marginTop: 1 }} />
      <div>
        <p className="text-sm font-medium" style={{ opacity: active ? 1 : 0.7 }}>{label}</p>
        <p className="text-[0.6875rem] mt-0.5" style={{ opacity: 0.4 }}>{desc}</p>
        {comingSoon && (
          <span className="text-[0.625rem] mt-1 inline-block" style={{ color: '#4d94ff', opacity: 0.8 }}>Coming soon</span>
        )}
        {disabled && disabledReason && (
          <span className="text-[0.625rem] mt-1 inline-block" style={{ color: '#ebebeb', opacity: 0.5 }}>{disabledReason}</span>
        )}
      </div>
    </button>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AddItemPanel({
  courses,
  courseId,
  courseName,
  parentFolderId,
  initialType,
}: {
  courses: Course[]
  courseId: string | null
  courseName: string | null
  parentFolderId: string | null
  initialType: ItemType | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Default to the initial type, falling back to folder
  const defaultType = initialType && initialType !== 'course'
    ? initialType
    : initialType === 'course' && !courseId
      ? 'course'
      : 'folder'
  const [type, setType] = useState<ItemType>(defaultType)

  // Course selection (for materials when not inside a course)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  // File upload state (for book/slide/exam)
  const [title, setTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // The effective course for materials: either the provided courseId or the user-selected one
  const effectiveCourseId = courseId ?? selectedCourseId
  const needsCourseSelection = MATERIAL_TYPES.has(type) && !courseId

  // Context label
  const contextLabel = courseName ?? (parentFolderId ? 'Folder' : 'Home')

  function handleTypeChange(t: ItemType) {
    if (t === 'course' && courseId) return
    setType(t)
    setSelectedCourseId(null)
    setTitle('')
    setSelectedFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setError('')
  }

  function pickFile(file: File) {
    setSelectedFile(file)
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) pickFile(f)
  }

  function goBack() {
    router.back()
  }

  // ── Course creation ────────────────────────────────────────────────────────
  function handleSubmitCourse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const get = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim()
    const name = get('name')
    if (!name) { setError('Course name is required'); return }
    setError('')
    startTransition(async () => {
      try {
        const { courseId: newId } = await createCourse({ name, code: get('code'), description: get('description') })
        router.push(`/dashboard/courses/${newId}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  // ── Folder creation ────────────────────────────────────────────────────────
  function handleSubmitFolder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = ((e.currentTarget.elements.namedItem('name') as HTMLInputElement | null)?.value ?? '').trim()
    if (!name) { setError('Folder name is required'); return }
    setError('')
    startTransition(async () => {
      try {
        await createFolder(courseId, parentFolderId, name)
        router.back()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  // ── Material creation (book / slide / exam) ────────────────────────────────
  async function handleSubmitMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!effectiveCourseId) { setError('Please select a course'); return }
    if (!selectedFile) { setError('Please select a file'); return }
    if (!title.trim()) { setError('Title is required'); return }

    const form = e.currentTarget
    const get = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim()

    setError('')
    setUploading(true)

    try {
      const supabase = createClient()
      const fileProps = { fileName: selectedFile.name, fileType: selectedFile.type, fileSize: selectedFile.size }

      if (type === 'book') {
        const r = await createBook(effectiveCourseId, { title: title.trim(), author: get('author') || undefined, ...fileProps })
        const { error: upErr } = await supabase.storage.from('materials').uploadToSignedUrl(r.storagePath, r.token, selectedFile)
        if (upErr) throw new Error(upErr.message)
        processBook(r.bookId, effectiveCourseId).catch(console.error)
        router.push(`/dashboard/courses/${effectiveCourseId}?view=book:${r.bookId}`)
      }

      if (type === 'slide') {
        const lNum = parseInt(get('lecture_number')); const ln = isNaN(lNum) ? undefined : lNum
        const r = await createLectureSlide(effectiveCourseId, { title: title.trim(), lectureNumber: ln, ...fileProps })
        const { error: upErr } = await supabase.storage.from('materials').uploadToSignedUrl(r.storagePath, r.token, selectedFile)
        if (upErr) throw new Error(upErr.message)
        processLectureSlide(r.slideId, effectiveCourseId).catch(console.error)
        router.push(`/dashboard/courses/${effectiveCourseId}?view=slide:${r.slideId}`)
      }

      if (type === 'exam') {
        const r = await createExam(effectiveCourseId, { title: title.trim(), examDate: get('exam_date') || undefined, ...fileProps })
        const { error: upErr } = await supabase.storage.from('materials').uploadToSignedUrl(r.storagePath, r.token, selectedFile)
        if (upErr) throw new Error(upErr.message)
        router.push(`/dashboard/courses/${effectiveCourseId}?view=exam:${r.examId}`)
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isMaterial = MATERIAL_TYPES.has(type)
  const showMaterialForm = isMaterial && effectiveCourseId
  const submitDisabled = uploading || isPending

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto px-8" style={{ maxWidth: 680, paddingTop: 48, paddingBottom: 56 }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#ebebeb', opacity: 0.35, letterSpacing: '0.1em' }}>
          {contextLabel}
        </p>
        <h1 className="text-3xl font-bold mb-8" style={{ color: '#ebebeb' }}>Add New Item</h1>

        {/* ── Organise: Folder & Course ──────────────────────────────── */}
        <div className="flex flex-col gap-2 mb-4">
          <p className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.65 }}>Organise</p>
          <div className="grid grid-cols-2 gap-3">
            {ORGANISE_TYPES.map(({ type: t, label, icon, desc }) => (
              <TypeButton
                key={t}
                icon={icon}
                label={label}
                desc={desc}
                active={type === t}
                disabled={t === 'course' && !!courseId}
                disabledReason={t === 'course' && courseId ? 'You are already inside a course' : undefined}
                onClick={() => handleTypeChange(t)}
              />
            ))}
          </div>
        </div>

        {/* ── Files: Book, Slide, Exam, Note ─────────────────────────── */}
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.65 }}>Files</p>
          <div className="grid grid-cols-2 gap-3">
            {FILE_TYPES.map(({ type: t, label, icon, desc, available }) => (
              <TypeButton
                key={t}
                icon={icon}
                label={label}
                desc={desc}
                active={type === t}
                comingSoon={!available}
                onClick={() => { if (available) handleTypeChange(t) }}
              />
            ))}
          </div>
        </div>

        {/* ── Course form ──────────────────────────────────────────────────── */}
        {type === 'course' && (
          <form onSubmit={handleSubmitCourse} className="flex flex-col gap-6">
            <Field label="Name *">
              <DarkInput name="name" required placeholder="e.g. Introduction to Algorithms" autoFocus />
            </Field>
            <Field label="Course Code">
              <DarkInput name="code" placeholder="e.g. CS301" />
            </Field>
            <Field label="Description">
              <DarkTextarea name="description" rows={3} placeholder="Optional" />
            </Field>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}>{error}</p>}
            <ActionRow onCancel={goBack} submitLabel={isPending ? 'Creating…' : 'Create Course'} disabled={isPending} />
          </form>
        )}

        {/* ── Folder form ──────────────────────────────────────────────────── */}
        {type === 'folder' && (
          <form onSubmit={handleSubmitFolder} className="flex flex-col gap-6">
            <Field label="Name *">
              <DarkInput name="name" required placeholder="e.g. Research, Week 1, Semester 1…" autoFocus />
            </Field>
            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}>{error}</p>}
            <ActionRow onCancel={goBack} submitLabel={isPending ? 'Creating…' : 'Create Folder'} disabled={isPending} />
          </form>
        )}

        {/* ── Material: course picker (only when not inside a course) ───── */}
        {needsCourseSelection && !selectedCourseId && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.65 }}>
              Select a course to add this {FILE_TYPES.find(f => f.type === type)?.label.toLowerCase()} to
            </p>

            {courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 rounded-xl" style={{ background: '#191919', border: '1px solid #2d2d2d' }}>
                <p className="text-sm mb-1" style={{ color: '#ebebeb', opacity: 0.4 }}>No courses yet</p>
                <button
                  type="button"
                  onClick={() => handleTypeChange('course')}
                  className="text-xs mt-2 transition-colors"
                  style={{ color: '#e9a84c', opacity: 0.8 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.8')}
                >
                  Create a course first →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {courses.map(course => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => { setSelectedCourseId(course.id); setError('') }}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
                    style={{
                      background: '#191919',
                      border: '1px solid #2d2d2d',
                      color: '#ebebeb',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#404040'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#2d2d2d'}
                  >
                    <BookOpen size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                    <span className="text-sm" style={{ opacity: 0.72 }}>{course.name}</span>
                    {course.code && (
                      <span className="ml-auto font-mono text-[0.6875rem] px-1.5 py-0.5 rounded" style={{ background: '#323232', opacity: 0.6 }}>
                        {course.code}
                      </span>
                    )}
                    <ChevronRight size={13} style={{ opacity: 0.3, marginLeft: course.code ? 0 : 'auto' }} />
                  </button>
                ))}
              </div>
            )}

            {error && <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}>{error}</p>}
          </div>
        )}

        {/* ── Material form (once course is determined) ────────────────── */}
        {showMaterialForm && (
          <form onSubmit={handleSubmitMaterial} className="flex flex-col gap-6">
            {/* Show which course when selected via picker */}
            {needsCourseSelection && selectedCourseId && (
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} style={{ color: '#e9a84c', opacity: 0.7 }} />
                <span className="text-sm" style={{ color: '#ebebeb', opacity: 0.7 }}>
                  {courses.find(c => c.id === selectedCourseId)?.name}
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedCourseId(null); setTitle(''); setSelectedFile(null); setError('') }}
                  className="text-[0.6875rem] ml-auto transition-colors"
                  style={{ color: '#e9a84c', opacity: 0.6 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.6')}
                >
                  Change
                </button>
              </div>
            )}

            {/* Title */}
            <Field label="Title">
              <DarkInput
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
                placeholder={
                  type === 'book'  ? 'e.g. Introduction to Algorithms' :
                  type === 'slide' ? 'e.g. Lecture 3 — Sorting Algorithms' :
                                     'e.g. Midterm 2025'
                }
              />
            </Field>

            {/* Type-specific fields */}
            {type === 'book' && (
              <Field label="Author">
                <DarkInput name="author" placeholder="e.g. Cormen, Leiserson, Rivest, Stein" />
              </Field>
            )}
            {type === 'slide' && (
              <Field label="Lecture Number">
                <DarkInput name="lecture_number" type="number" min={1} placeholder="e.g. 3" style={{ maxWidth: 160 }} />
              </Field>
            )}
            {type === 'exam' && (
              <Field label="Exam Date">
                <DarkInput name="exam_date" type="date" style={{ maxWidth: 200 }} />
              </Field>
            )}

            {/* File upload */}
            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.65 }}>Source</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: '#262626', border: '1px solid #e9a84c' }}>
                  <div className="flex items-center gap-2">
                    <Upload size={15} style={{ color: '#e9a84c', opacity: 0.8 }} />
                      <span className="text-sm font-medium" style={{ color: '#ebebeb' }}>Import File</span>
                  </div>
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer transition-all"
                    style={{
                      minHeight: 80,
                      border: `2px dashed ${dragOver ? '#e9a84c' : '#404040'}`,
                      background: dragOver ? 'rgba(233,168,76,0.05)' : 'transparent',
                    }}
                  >
                    {selectedFile ? (
                      <p className="text-xs text-center px-2" style={{ color: '#e9a84c' }}>{selectedFile.name}</p>
                    ) : (
                      <>
                        <p className="text-xs" style={{ color: '#ebebeb', opacity: 0.45 }}>Drop file here or click</p>
                        <p className="text-[0.6875rem]" style={{ color: '#ebebeb', opacity: 0.25 }}>PDF or PowerPoint · max 50 MB</p>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf,.pptx,.ppt" className="hidden" onChange={handleFileInput} />
                </div>

                <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: '#191919', border: '1px solid #323232', opacity: 0.5 }}>
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} style={{ color: '#4d94ff', opacity: 0.8 }} />
                    <span className="text-sm font-medium" style={{ color: '#ebebeb' }}>Generate with AI</span>
                  </div>
                  <p className="text-xs" style={{ color: '#ebebeb', opacity: 0.5 }}>
                    Automatically generate notes and summaries from your course materials.
                  </p>
                  <span className="text-[0.6875rem] px-2 py-0.5 rounded-full self-start" style={{ background: '#2a2a2a', color: '#4d94ff', opacity: 0.8 }}>
                    Coming soon
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}>
                {error}
              </p>
            )}

            {uploading && (
              <p className="text-sm text-center" style={{ color: '#e9a84c' }}>
                Uploading… please wait.
              </p>
            )}

            <ActionRow
              onCancel={goBack}
              submitLabel={uploading ? 'Uploading…' : 'Upload File'}
              disabled={submitDisabled || !selectedFile}
            />
          </form>
        )}
      </div>
    </div>
  )
}
