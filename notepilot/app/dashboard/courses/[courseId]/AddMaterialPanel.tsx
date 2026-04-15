'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Book, Presentation, ClipboardList, Upload, Sparkles, FolderPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createBook, processBook, createLectureSlide, processLectureSlide, createExam } from './actions'
import { createFolder } from '@/app/dashboard/actions'

type MaterialType = 'folder' | 'book' | 'slide' | 'exam'

const inputStyle = { background: '#1a1a1a', border: '1px solid #2e2e2e', color: '#e8e8e8' } as const

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg px-3 py-2 text-[14px] outline-none transition-all"
      style={{ ...inputStyle, ...props.style }}
      onFocus={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'; props.onFocus?.(e) }}
      onBlur={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.boxShadow = 'none'; props.onBlur?.(e) }}
    />
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.65 }}>{label}</label>
      {children}
    </div>
  )
}

const TYPE_CONFIG = {
  folder: { label: 'Folder',     icon: FolderPlus,   desc: 'Organise files into a folder' },
  book:   { label: 'Book',       icon: Book,         desc: 'Textbook or reference material' },
  slide:  { label: 'Slide Deck', icon: Presentation, desc: 'Lecture slides or presentation' },
  exam:   { label: 'Exam Paper', icon: ClipboardList, desc: 'Past exam or practice paper' },
} as const

export default function AddMaterialPanel({
  courseId,
  initialType,
  parentFolderId,
}: {
  courseId: string
  initialType: MaterialType | null
  parentFolderId?: string | null
}) {
  const router = useRouter()
  const [type, setType] = useState<MaterialType>(initialType ?? 'book')
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  function handleTypeChange(t: MaterialType) {
    setType(t)
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (type === 'folder') {
      if (!title.trim()) { setError('Name is required'); return }
      setError('')
      setUploading(true)
      try {
        await createFolder(courseId, parentFolderId ?? null, title.trim())
        router.back()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create folder')
        setUploading(false)
      }
      return
    }

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
        const r = await createBook(courseId, { title: title.trim(), author: get('author') || undefined, ...fileProps })
        const { error: upErr } = await supabase.storage.from('materials').uploadToSignedUrl(r.storagePath, r.token, selectedFile)
        if (upErr) throw new Error(upErr.message)
        processBook(r.bookId, courseId).catch(console.error)
        router.push(`/dashboard/courses/${courseId}?view=book:${r.bookId}`)
      }

      if (type === 'slide') {
        const lNum = parseInt(get('lecture_number')); const ln = isNaN(lNum) ? undefined : lNum
        const r = await createLectureSlide(courseId, { title: title.trim(), lectureNumber: ln, ...fileProps })
        const { error: upErr } = await supabase.storage.from('materials').uploadToSignedUrl(r.storagePath, r.token, selectedFile)
        if (upErr) throw new Error(upErr.message)
        processLectureSlide(r.slideId, courseId).catch(console.error)
        router.push(`/dashboard/courses/${courseId}?view=slide:${r.slideId}`)
      }

      if (type === 'exam') {
        const r = await createExam(courseId, { title: title.trim(), examDate: get('exam_date') || undefined, ...fileProps })
        const { error: upErr } = await supabase.storage.from('materials').uploadToSignedUrl(r.storagePath, r.token, selectedFile)
        if (upErr) throw new Error(upErr.message)
        router.push(`/dashboard/courses/${courseId}?view=exam:${r.examId}`)
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
    }
  }

  const isFolder = type === 'folder'
  const submitDisabled = uploading || (isFolder ? !title.trim() : !selectedFile)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto px-8" style={{ maxWidth: 680, paddingTop: 48, paddingBottom: 56 }}>
        <p className="text-[12px] uppercase tracking-widest mb-2" style={{ color: '#e8e8e8', opacity: 0.35, letterSpacing: '0.1em' }}>
          {isFolder ? 'New Folder' : 'New Material'}
        </p>
        <h1 className="font-bold mb-8" style={{ fontSize: 28, color: '#e8e8e8' }}>
          {isFolder ? (parentFolderId ? 'Add Subfolder' : 'Add Folder') : 'Add File'}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Type selector — 2×2 grid */}
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.65 }}>Type</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(TYPE_CONFIG) as [MaterialType, typeof TYPE_CONFIG[MaterialType]][]).map(([t, cfg]) => {
                const Icon = cfg.icon
                const active = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all"
                    style={{
                      background: active ? '#2a2a2a' : '#1e1e1e',
                      border: `1px solid ${active ? '#e9a84c' : '#2e2e2e'}`,
                      color: '#e8e8e8',
                    }}
                  >
                    <Icon size={18} style={{ opacity: active ? 0.9 : 0.45 }} />
                    <div>
                      <p className="text-[13px] font-medium" style={{ opacity: active ? 1 : 0.7 }}>{cfg.label}</p>
                      <p className="text-[11px] mt-0.5" style={{ opacity: 0.4 }}>{cfg.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Name / Title */}
          <Field label={isFolder ? 'Name' : 'Title'}>
            <DarkInput
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={
                type === 'folder' ? 'e.g. Week 1' :
                type === 'book'   ? 'e.g. Introduction to Algorithms' :
                type === 'slide'  ? 'e.g. Lecture 3 — Sorting Algorithms' :
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

          {/* Source — only for file-based types */}
          {!isFolder && (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-medium" style={{ color: '#e8e8e8', opacity: 0.65 }}>Source</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: '#1e1e1e', border: '1px solid #e9a84c' }}>
                  <div className="flex items-center gap-2">
                    <Upload size={15} style={{ color: '#e9a84c', opacity: 0.8 }} />
                    <span className="text-[13px] font-medium" style={{ color: '#e8e8e8' }}>Import File</span>
                  </div>
                  <div
                    ref={dropRef}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer transition-all"
                    style={{
                      minHeight: 80,
                      border: `2px dashed ${dragOver ? '#e9a84c' : '#333333'}`,
                      background: dragOver ? 'rgba(233,168,76,0.05)' : 'transparent',
                    }}
                  >
                    {selectedFile ? (
                      <p className="text-[12px] text-center px-2" style={{ color: '#e9a84c' }}>{selectedFile.name}</p>
                    ) : (
                      <>
                        <p className="text-[12px]" style={{ color: '#e8e8e8', opacity: 0.45 }}>Drop file here or click</p>
                        <p className="text-[11px]" style={{ color: '#e8e8e8', opacity: 0.25 }}>PDF or PowerPoint · max 50 MB</p>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf,.pptx,.ppt" className="hidden" onChange={handleFileInput} />
                </div>

                <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', opacity: 0.5 }}>
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} style={{ color: '#4d94ff', opacity: 0.8 }} />
                    <span className="text-[13px] font-medium" style={{ color: '#e8e8e8' }}>Generate with AI</span>
                  </div>
                  <p className="text-[12px]" style={{ color: '#e8e8e8', opacity: 0.5 }}>
                    Automatically generate notes and summaries from your course materials.
                  </p>
                  <span className="text-[11px] px-2 py-0.5 rounded-full self-start" style={{ background: '#222222', color: '#4d94ff', opacity: 0.8 }}>
                    Coming soon
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-[13px] px-3 py-2 rounded-lg" style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}>
              {error}
            </p>
          )}

          {uploading && (
            <p className="text-[13px] text-center" style={{ color: '#e9a84c' }}>
              {isFolder ? 'Creating…' : 'Uploading… please wait.'}
            </p>
          )}

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
              type="submit"
              disabled={submitDisabled}
              className="px-5 py-2 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#e9a84c', color: '#111111' }}
              onMouseEnter={e => { if (!submitDisabled) (e.currentTarget as HTMLElement).style.background = '#f0b85e' }}
              onMouseLeave={e => { if (!submitDisabled) (e.currentTarget as HTMLElement).style.background = '#e9a84c' }}
            >
              {uploading
                ? (isFolder ? 'Creating…' : 'Uploading…')
                : (isFolder ? 'Create Folder' : 'Upload File')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
