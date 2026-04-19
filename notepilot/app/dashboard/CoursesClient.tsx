'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { createCourse, deleteCourse, updateCourse } from './actions'

type Course = {
  id: string
  name: string
  code: string | null
  description: string | null
}

const inputStyle = {
  background: 'var(--color-np-base)',
  border: '1px solid var(--color-np-border)',
  color: 'var(--color-np-text)',
} as const

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
      style={inputStyle}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'var(--color-np-focus)'
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'
        props.onFocus?.(e)
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'var(--color-np-border)'
        e.currentTarget.style.boxShadow = 'none'
        props.onBlur?.(e)
      }}
    />
  )
}

function DarkTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all resize-none"
      style={inputStyle}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'var(--color-np-focus)'
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'var(--color-np-border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    />
  )
}

export default function CoursesClient({ courses }: { courses: Course[] }) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function openDialog() {
    setFormError('')
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
    setFormError('')
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim()
    if (!name) { setFormError('Course name is required'); return }

    startTransition(async () => {
      try {
        await createCourse({
          name,
          code: (form.elements.namedItem('code') as HTMLInputElement).value.trim(),
          description: (form.elements.namedItem('description') as HTMLTextAreaElement).value.trim(),
        })
        form.reset()
        closeDialog()
        router.refresh()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function startEdit(course: Course) {
    setEditingId(course.id)
    setEditName(course.name)
  }

  function saveEdit(course: Course) {
    const name = editName.trim()
    setEditingId(null)
    if (!name || name === course.name) return

    startTransition(async () => {
      try {
        await updateCourse(course.id, {
          name,
          code: course.code ?? '',
          description: course.description ?? '',
        })
        router.refresh()
      } catch (err) {
        console.error(err)
      }
    })
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    startTransition(async () => {
      try {
        await deleteCourse(id)
        router.refresh()
      } catch (err) {
        console.error(err)
      }
    })
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-np-text)' }}>My Courses</h1>
        <button
          onClick={openDialog}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--color-np-active)', color: 'var(--color-np-text)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-np-focus)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-np-active)')}
        >
          <span className="text-base leading-none">+</span>
          New Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32" style={{ color: 'var(--color-np-text)', opacity: 0.3 }}>
          <p className="text-base font-medium mb-1">No courses yet</p>
          <p className="text-sm">Create your first course to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {courses.map(course => (
            <div
              key={course.id}
              className="group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
              style={{ color: 'var(--color-np-text)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-np-surface)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              {editingId !== course.id && (
                <Link
                  href={`/dashboard/courses/${course.id}`}
                  className="absolute inset-0 z-0 rounded-lg"
                  aria-label={course.name}
                />
              )}

              <BookOpen size={16} style={{ opacity: 0.4, flexShrink: 0 }} />

              <div className="flex-1 min-w-0">
                {editingId === course.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => saveEdit(course)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(course)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="w-full text-sm bg-transparent outline-none"
                    style={{ color: 'var(--color-np-text)', borderBottom: '1px solid var(--color-np-amber)' }}
                  />
                ) : (
                  <span className="text-sm truncate block" style={{ opacity: 0.85 }}>
                    {course.name}
                  </span>
                )}
              </div>

              {course.code && (
                <span className="font-mono text-[0.6875rem] shrink-0" style={{ opacity: 0.35 }}>
                  {course.code}
                </span>
              )}

              {/* Actions */}
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 shrink-0">
                <button
                  onClick={() => startEdit(course)}
                  title="Rename"
                  className="p-1 rounded transition-colors"
                  style={{ color: 'var(--color-np-text)', opacity: 0.4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-np-hover)'; (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.4' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(course.id, course.name)}
                  title="Delete"
                  className="p-1 rounded transition-colors"
                  style={{ color: 'var(--color-np-text)', opacity: 0.4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,68,56,0.15)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-np-red)'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-np-text)'; (e.currentTarget as HTMLElement).style.opacity = '0.4' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create course dialog */}
      <dialog
        ref={dialogRef}
        className="rounded-xl p-0 w-full max-w-md backdrop:bg-black/60"
        style={{ background: 'var(--color-np-hover)', border: '1px solid var(--color-np-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
        onClose={() => setFormError('')}
      >
        <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-np-text)' }}>New Course</h2>

          {formError && (
            <p
              className="text-sm px-3 py-2 rounded-lg"
              style={{ color: 'var(--color-np-red)', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}
            >
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--color-np-text)', opacity: 0.7 }}>Name *</label>
            <DarkInput name="name" required placeholder="e.g. Introduction to Algorithms" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--color-np-text)', opacity: 0.7 }}>Code</label>
            <DarkInput name="code" placeholder="e.g. CS301" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--color-np-text)', opacity: 0.7 }}>Description</label>
            <DarkTextarea name="description" rows={3} placeholder="Optional" />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={closeDialog}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ color: 'var(--color-np-text)', opacity: 0.7 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-np-hover)'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              style={{ background: 'var(--color-np-active)', color: 'var(--color-np-text)' }}
              onMouseEnter={e => { if (!isPending) (e.currentTarget as HTMLElement).style.background = 'var(--color-np-focus)' }}
              onMouseLeave={e => { if (!isPending) (e.currentTarget as HTMLElement).style.background = 'var(--color-np-active)' }}
            >
              {isPending ? 'Creating…' : 'Create Course'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
