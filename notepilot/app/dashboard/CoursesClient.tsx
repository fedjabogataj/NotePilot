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

  const inputClass = 'border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">My Courses</h1>
        <button
          onClick={openDialog}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          New Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400 dark:text-gray-600">
          <p className="text-base font-medium mb-1">No courses yet</p>
          <p className="text-sm">Create your first course to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => (
            <div
              key={course.id}
              className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:shadow-md dark:hover:shadow-none dark:hover:border-gray-700 transition-all"
            >
              {/* Invisible link covering the card — hidden during inline edit */}
              {editingId !== course.id && (
                <Link
                  href={`/dashboard/courses/${course.id}`}
                  className="absolute inset-0 z-0 rounded-xl"
                  aria-label={course.name}
                />
              )}

              {/* Actions — visible on hover, z-index above the link */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => startEdit(course)}
                  title="Rename"
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(course.id, course.name)}
                  title="Delete"
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
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
                  className="w-full text-base font-semibold text-gray-900 dark:text-white border-b border-blue-500 outline-none bg-transparent mb-1 pr-14"
                />
              ) : (
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1 truncate pr-14">
                  {course.name}
                </h2>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2.5">
                {course.code && (
                  <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
                    {course.code}
                  </span>
                )}
                {course.semester && <span>{course.semester}</span>}
              </div>

              {course.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{course.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create course dialog */}
      <dialog
        ref={dialogRef}
        className="rounded-xl shadow-xl p-0 w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 backdrop:bg-black/50"
        onClose={() => setFormError('')}
      >
        <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Course</h2>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">{formError}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
            <input name="name" required placeholder="e.g. Introduction to Algorithms" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Code</label>
              <input name="code" placeholder="e.g. CS301" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Semester</label>
              <input name="semester" placeholder="e.g. Spring 2026" className={inputClass} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Optional"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={closeDialog}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {isPending ? 'Creating…' : 'Create Course'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
