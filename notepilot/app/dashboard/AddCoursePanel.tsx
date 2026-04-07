'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCourse } from './actions'

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

export default function AddCoursePanel({ semester }: { semester?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const get = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim()
    const name = get('name')
    if (!name) { setError('Course name is required'); return }

    startTransition(async () => {
      try {
        const { courseId } = await createCourse({
          name,
          code: get('code'),
          semester: get('semester'),
          description: get('description'),
        })
        router.push(`/dashboard/courses/${courseId}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto px-8" style={{ maxWidth: 600, paddingTop: 56, paddingBottom: 56 }}>
        <p className="text-[12px] uppercase tracking-widest mb-2" style={{ color: '#e8e8e8', opacity: 0.35, letterSpacing: '0.1em' }}>
          New Course
        </p>
        <h1 className="font-bold mb-8" style={{ fontSize: 28, color: '#e8e8e8' }}>Add Course</h1>

        {error && (
          <p className="text-[13px] px-3 py-2 rounded-lg mb-4" style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Name *">
            <DarkInput name="name" required placeholder="e.g. Introduction to Algorithms" autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Course Code">
              <DarkInput name="code" placeholder="e.g. CS301" />
            </Field>
            <Field label="Semester">
              <DarkInput name="semester" defaultValue={semester ?? ''} placeholder="e.g. 2026S" />
            </Field>
          </div>

          <Field label="Description">
            <DarkTextarea name="description" rows={3} placeholder="Optional — brief description of this course" />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2">
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
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-60"
              style={{ background: '#e9a84c', color: '#111111' }}
              onMouseEnter={e => { if (!isPending) (e.currentTarget as HTMLElement).style.background = '#f0b85e' }}
              onMouseLeave={e => { if (!isPending) (e.currentTarget as HTMLElement).style.background = '#e9a84c' }}
            >
              {isPending ? 'Creating…' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
