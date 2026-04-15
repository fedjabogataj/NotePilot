'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Folder, Book, Presentation, ClipboardList, FileText, ChevronRight } from 'lucide-react'
import { createCourse, createFolder } from './actions'

type ItemType = 'course' | 'folder' | 'book' | 'slide' | 'exam' | 'note'
type Course = { id: string; name: string; code: string | null }

// Material types still need a course to be attached to
const NEEDS_COURSE = new Set<ItemType>(['book', 'slide', 'exam'])
const TYPE_ADD_PARAM: Partial<Record<ItemType, string>> = {
  book:  'book',
  slide: 'slide',
  exam:  'exam',
}

const TYPE_CONFIG: Record<ItemType, { label: string; icon: React.ElementType; desc: string; available: boolean }> = {
  course: { label: 'Course',     icon: BookOpen,     desc: 'A study course with books, slides and exams', available: true  },
  folder: { label: 'Folder',     icon: Folder,        desc: 'Organise items into a folder',               available: true  },
  book:   { label: 'Book',       icon: Book,          desc: 'Textbook or reference material',              available: true  },
  slide:  { label: 'Slide Deck', icon: Presentation,  desc: 'Lecture slides or presentation',             available: true  },
  exam:   { label: 'Exam Paper', icon: ClipboardList, desc: 'Past exam or practice paper',                available: true  },
  note:   { label: 'Note',       icon: FileText,      desc: 'A standalone note or document',              available: false },
}

const inputStyle = { background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#e8e8e8' } as const

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.65 }}>{label}</label>
      {children}
    </div>
  )
}

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

function DarkTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg px-3 py-2 text-[14px] outline-none transition-all resize-none"
      style={inputStyle}
      onFocus={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.boxShadow = 'none' }}
    />
  )
}

function ActionRow({ onCancel, submitLabel, disabled }: { onCancel: () => void; submitLabel: string; disabled: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3" style={{ borderTop: '1px solid #2e2e2e', paddingTop: 20 }}>
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-[13px] font-medium rounded-lg transition-colors"
        style={{ color: '#e8e8e8', opacity: 0.6 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2a2a2a'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.6' }}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="px-5 py-2 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50"
        style={{ background: '#e9a84c', color: '#111111' }}
        onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = '#f0b85e' }}
        onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = '#e9a84c' }}
      >
        {submitLabel}
      </button>
    </div>
  )
}

export default function AddItemPanel({
  courses,
  parentFolderId,
  semester,
}: {
  courses: Course[]
  parentFolderId: string | null
  semester: string | null
}) {
  const router = useRouter()
  const [type, setType] = useState<ItemType>('course')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleTypeChange(t: ItemType) {
    if (!TYPE_CONFIG[t].available) return
    setType(t)
    setSelectedCourseId(null)
    setError('')
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
        const { courseId } = await createCourse({ name, code: get('code'), semester: get('semester'), description: get('description') })
        router.push(`/dashboard/courses/${courseId}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  // ── Folder creation (independent of any course) ───────────────────────────
  function handleSubmitFolder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = ((e.currentTarget.elements.namedItem('name') as HTMLInputElement | null)?.value ?? '').trim()
    if (!name) { setError('Folder name is required'); return }
    setError('')
    startTransition(async () => {
      try {
        // courseId = null; semester scopes the folder to a semester group if provided
        await createFolder(null, parentFolderId, name, semester)
        router.push('/dashboard')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  // ── Material types: pick a course, then redirect to its add-material page ─
  function handleContinueToCourse() {
    if (!selectedCourseId) { setError('Please select a course'); return }
    const addParam = TYPE_ADD_PARAM[type]!
    const parentParam = parentFolderId ? `&parent=${parentFolderId}` : ''
    router.push(`/dashboard/courses/${selectedCourseId}?add=${addParam}${parentParam}`)
  }

  const needsCourse = NEEDS_COURSE.has(type)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto px-8" style={{ maxWidth: 680, paddingTop: 48, paddingBottom: 56 }}>
        <p className="text-[12px] uppercase tracking-widest mb-2" style={{ color: '#e8e8e8', opacity: 0.35, letterSpacing: '0.1em' }}>
          {parentFolderId ? 'Folder' : semester ? semester : 'Home'}
        </p>
        <h1 className="font-bold mb-8" style={{ fontSize: 28, color: '#e8e8e8' }}>Add New Item</h1>

        {/* Type selector */}
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.65 }}>Type</p>
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(TYPE_CONFIG) as [ItemType, typeof TYPE_CONFIG[ItemType]][]).map(([t, cfg]) => {
              const Icon = cfg.icon
              const active = type === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                  style={{
                    background: active ? '#2a2a2a' : '#1e1e1e',
                    border: `1px solid ${active ? '#e9a84c' : '#2e2e2e'}`,
                    color: '#e8e8e8',
                    opacity: cfg.available ? 1 : 0.4,
                    cursor: cfg.available ? 'pointer' : 'default',
                  }}
                >
                  <Icon size={18} style={{ opacity: active ? 0.9 : 0.45, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="text-[13px] font-medium" style={{ opacity: active ? 1 : 0.7 }}>{cfg.label}</p>
                    <p className="text-[11px] mt-0.5" style={{ opacity: 0.4 }}>{cfg.desc}</p>
                    {!cfg.available && (
                      <span className="text-[10px] mt-1 inline-block" style={{ color: '#4d94ff', opacity: 0.8 }}>Coming soon</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Course form ──────────────────────────────────────────────────── */}
        {type === 'course' && (
          <form onSubmit={handleSubmitCourse} className="flex flex-col gap-6">
            <Field label="Name *">
              <DarkInput name="name" required placeholder="e.g. Introduction to Algorithms" autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Course Code">
                <DarkInput name="code" placeholder="e.g. CS301" />
              </Field>
              <Field label="Semester">
                <DarkInput name="semester" placeholder="e.g. Spring 2026" />
              </Field>
            </div>
            <Field label="Description">
              <DarkTextarea name="description" rows={3} placeholder="Optional" />
            </Field>
            {error && <p className="text-[13px] px-3 py-2 rounded-lg" style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}>{error}</p>}
            <ActionRow onCancel={() => router.back()} submitLabel={isPending ? 'Creating…' : 'Create Course'} disabled={isPending} />
          </form>
        )}

        {/* ── Folder form (no course required) ────────────────────────────── */}
        {type === 'folder' && (
          <form onSubmit={handleSubmitFolder} className="flex flex-col gap-6">
            <Field label="Name *">
              <DarkInput name="name" required placeholder="e.g. Research, Week 1, Semester 1…" autoFocus />
            </Field>
            {error && <p className="text-[13px] px-3 py-2 rounded-lg" style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}>{error}</p>}
            <ActionRow onCancel={() => router.back()} submitLabel={isPending ? 'Creating…' : 'Create Folder'} disabled={isPending} />
          </form>
        )}

        {/* ── Material types: course picker ────────────────────────────────── */}
        {needsCourse && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.65 }}>
              Select a course to add this {TYPE_CONFIG[type].label.toLowerCase()} to
            </p>

            {courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 rounded-xl" style={{ background: '#1a1a1a', border: '1px solid #2e2e2e' }}>
                <p className="text-[13px] mb-1" style={{ color: '#e8e8e8', opacity: 0.4 }}>No courses yet</p>
                <button
                  type="button"
                  onClick={() => handleTypeChange('course')}
                  className="text-[12px] mt-2 transition-colors"
                  style={{ color: '#e9a84c', opacity: 0.8 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.8')}
                >
                  Create a course first →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {courses.map(course => {
                  const selected = selectedCourseId === course.id
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => { setSelectedCourseId(course.id); setError('') }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
                      style={{
                        background: selected ? '#2a2a2a' : '#1a1a1a',
                        border: `1px solid ${selected ? '#e9a84c' : '#2e2e2e'}`,
                        color: '#e8e8e8',
                      }}
                      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = '#3a3a3a' }}
                      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = '#2e2e2e' }}
                    >
                      <BookOpen size={14} style={{ opacity: selected ? 0.8 : 0.4, flexShrink: 0 }} />
                      <span className="text-[13px]" style={{ opacity: selected ? 1 : 0.72 }}>{course.name}</span>
                      {course.code && (
                        <span className="ml-auto font-mono text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#2a2a2a', opacity: 0.6 }}>
                          {course.code}
                        </span>
                      )}
                      {selected && <ChevronRight size={13} style={{ opacity: 0.5, marginLeft: course.code ? 0 : 'auto' }} />}
                    </button>
                  )
                })}
              </div>
            )}

            {error && <p className="text-[13px] px-3 py-2 rounded-lg" style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}>{error}</p>}

            {courses.length > 0 && (
              <div className="flex items-center justify-end gap-3" style={{ borderTop: '1px solid #2e2e2e', paddingTop: 20 }}>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-4 py-2 text-[13px] font-medium rounded-lg transition-colors"
                  style={{ color: '#e8e8e8', opacity: 0.6 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2a2a2a'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.6' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleContinueToCourse}
                  disabled={!selectedCourseId}
                  className="px-5 py-2 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-40"
                  style={{ background: '#e9a84c', color: '#111111' }}
                  onMouseEnter={e => { if (selectedCourseId) (e.currentTarget as HTMLElement).style.background = '#f0b85e' }}
                  onMouseLeave={e => { if (selectedCourseId) (e.currentTarget as HTMLElement).style.background = '#e9a84c' }}
                >
                  Continue →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
