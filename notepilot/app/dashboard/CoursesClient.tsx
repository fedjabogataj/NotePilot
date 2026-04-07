'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createCourse, deleteCourse, updateCourse } from './actions'

type Course = {
  id: string
  name: string
  code: string | null
  semester: string | null
  description: string | null
}

const inputCls =
  'w-full rounded-lg px-3 py-2 text-[14px] outline-none transition-all'
const inputStyle = {
  background: '#1a1a1a',
  border: '1px solid #2e2e2e',
  color: '#e8e8e8',
} as const

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={inputCls}
      style={inputStyle}
      onFocus={e => {
        e.currentTarget.style.borderColor = '#444444'
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'
        props.onFocus?.(e)
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = '#2e2e2e'
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
      className="w-full rounded-lg px-3 py-2 text-[14px] outline-none transition-all resize-none"
      style={inputStyle}
      onFocus={e => {
        e.currentTarget.style.borderColor = '#444444'
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = '#2e2e2e'
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
          semester: (form.elements.namedItem('semester') as HTMLInputElement).value.trim(),
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
          semester: course.semester ?? '',
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[32px] font-bold" style={{ color: '#e8e8e8' }}>My Courses</h1>
        <button
          onClick={openDialog}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
          style={{ background: '#333333', color: '#e8e8e8' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#3d3d3d')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#333333')}
        >
          <span className="text-base leading-none">+</span>
          New Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32" style={{ color: '#e8e8e8', opacity: 0.3 }}>
          <p className="text-[15px] font-medium mb-1">No courses yet</p>
          <p className="text-[13px]">Create your first course to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => (
            <div
              key={course.id}
              className="group relative rounded-xl p-5 transition-all"
              style={{ background: '#222222', border: '1px solid #2e2e2e' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#3a3a3a')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = '#2e2e2e')}
            >
              {/* Invisible link — hidden during inline edit */}
              {editingId !== course.id && (
                <Link
                  href={`/dashboard/courses/${course.id}`}
                  className="absolute inset-0 z-0 rounded-xl"
                  aria-label={course.name}
                />
              )}

              {/* Actions */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => startEdit(course)}
                  title="Rename"
                  className="p-1.5 rounded transition-colors"
                  style={{ color: '#e8e8e8', opacity: 0.4 }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = '#2a2a2a'
                    ;(e.currentTarget as HTMLElement).style.opacity = '0.9'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.opacity = '0.4'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(course.id, course.name)}
                  title="Delete"
                  className="p-1.5 rounded transition-colors"
                  style={{ color: '#e8e8e8', opacity: 0.4 }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(240,68,56,0.15)'
                    ;(e.currentTarget as HTMLElement).style.color = '#f04438'
                    ;(e.currentTarget as HTMLElement).style.opacity = '1'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = '#e8e8e8'
                    ;(e.currentTarget as HTMLElement).style.opacity = '0.4'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>

              {/* Name — editable inline */}
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
                  className="w-full text-[15px] font-semibold bg-transparent outline-none mb-1 pr-14"
                  style={{ color: '#e8e8e8', borderBottom: '1px solid #e9a84c' }}
                />
              ) : (
                <h2 className="text-[15px] font-semibold mb-1 truncate pr-14" style={{ color: '#e8e8e8' }}>
                  {course.name}
                </h2>
              )}

              <div className="flex items-center gap-2 mb-2.5">
                {course.code && (
                  <span
                    className="font-mono text-[12px] px-1.5 py-0.5 rounded"
                    style={{ background: '#2a2a2a', color: '#e8e8e8', opacity: 0.7 }}
                  >
                    {course.code}
                  </span>
                )}
                {course.semester && (
                  <span className="text-[12px]" style={{ color: '#e8e8e8', opacity: 0.5 }}>
                    {course.semester}
                  </span>
                )}
              </div>

              {course.description && (
                <p className="text-[13px] line-clamp-2" style={{ color: '#e8e8e8', opacity: 0.5 }}>
                  {course.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create course dialog */}
      <dialog
        ref={dialogRef}
        className="rounded-xl p-0 w-full max-w-md backdrop:bg-black/60"
        style={{ background: '#222222', border: '1px solid #2e2e2e', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
        onClose={() => setFormError('')}
      >
        <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
          <h2 className="text-[18px] font-semibold" style={{ color: '#e8e8e8' }}>New Course</h2>

          {formError && (
            <p
              className="text-[13px] px-3 py-2 rounded-lg"
              style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}
            >
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.7 }}>Name *</label>
            <DarkInput name="name" required placeholder="e.g. Introduction to Algorithms" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.7 }}>Code</label>
              <DarkInput name="code" placeholder="e.g. CS301" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.7 }}>Semester</label>
              <DarkInput name="semester" placeholder="e.g. Spring 2026" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.7 }}>Description</label>
            <DarkTextarea name="description" rows={3} placeholder="Optional" />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={closeDialog}
              className="px-4 py-2 text-[13px] font-medium rounded-lg transition-colors"
              style={{ color: '#e8e8e8', opacity: 0.7 }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = '#2a2a2a'
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
              disabled={isPending}
              className="px-4 py-2 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-60"
              style={{ background: '#333333', color: '#e8e8e8' }}
              onMouseEnter={e => { if (!isPending) (e.currentTarget as HTMLElement).style.background = '#3d3d3d' }}
              onMouseLeave={e => { if (!isPending) (e.currentTarget as HTMLElement).style.background = '#333333' }}
            >
              {isPending ? 'Creating…' : 'Create Course'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
