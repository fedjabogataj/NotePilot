'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parsePdfPages, chunkBookPages, chunkSlidePages } from '@/lib/pdf-processing'

const BUCKET = 'materials'
const MAX_FILE_SIZE = 52_428_800 // 50 MiB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]

export async function getSignedUrl(
  type: 'book' | 'slide' | 'exam',
  id: string
): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const table = type === 'book' ? 'books' : type === 'slide' ? 'lecture_slides' : 'exams'
  const { data: record } = await supabase
    .from(table)
    .select('file_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!record?.file_url) throw new Error('File not found')

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(record.file_url, 3600)

  if (error || !data) throw new Error(error?.message ?? 'Failed to create signed URL')
  return data.signedUrl
}

function validateFile(fileType: string, fileSize: number) {
  if (!ALLOWED_TYPES.includes(fileType)) throw new Error('Only PDF and PowerPoint files are supported')
  if (fileSize > MAX_FILE_SIZE) throw new Error('File is too large (max 50 MB)')
}

// ── Books ─────────────────────────────────────────────────────────────

export async function createBook(courseId: string, data: {
  title: string
  author?: string
  fileName: string
  fileType: string
  fileSize: number
}) {
  validateFile(data.fileType, data.fileSize)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: book, error } = await supabase
    .from('books')
    .insert({
      user_id: user.id,
      course_id: courseId,
      title: data.title,
      author: data.author || null,
      processing_status: 'pending',
    })
    .select('id')
    .single()

  if (error || !book) throw new Error(error?.message ?? 'Failed to create book record')

  const storagePath = `${user.id}/books/${book.id}/${data.fileName}`
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (signError || !signed) throw new Error(signError?.message ?? 'Failed to create upload URL')

  await supabase.from('books').update({ file_url: storagePath }).eq('id', book.id)

  return { bookId: book.id, storagePath, token: signed.token }
}

export async function processBook(bookId: string, courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('books')
    .update({ processing_status: 'processing' })
    .eq('id', bookId)
    .eq('user_id', user.id)

  try {
    const { data: book } = await supabase
      .from('books')
      .select('file_url')
      .eq('id', bookId)
      .single()

    if (!book?.file_url) throw new Error('File path not found on record')

    const { data: blob, error: dlError } = await supabase.storage
      .from(BUCKET)
      .download(book.file_url)

    if (dlError || !blob) throw new Error(dlError?.message ?? 'Download failed')

    const buffer = Buffer.from(await blob.arrayBuffer())
    const pages = await parsePdfPages(buffer)
    const chunks = chunkBookPages(pages)

    if (chunks.length > 0) {
      const { error: insertError } = await supabase.from('book_chunks').insert(
        chunks.map(c => ({
          book_id: bookId,
          content: c.content,
          chunk_index: c.chunk_index,
          page_number: c.page_number,
        }))
      )
      if (insertError) throw new Error(insertError.message)
    }

    await supabase
      .from('books')
      .update({ processing_status: 'ready', processing_error: null })
      .eq('id', bookId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed'
    await supabase
      .from('books')
      .update({ processing_status: 'failed', processing_error: message })
      .eq('id', bookId)
    // Errors are reflected in DB status — don't rethrow so fire-and-forget callers stay clean.
  }

  revalidatePath(`/dashboard/courses/${courseId}`)
}

export async function deleteBook(id: string, courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: book } = await supabase
    .from('books')
    .select('file_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (book?.file_url) {
    await supabase.storage.from(BUCKET).remove([book.file_url])
  }

  const { error } = await supabase.from('books').delete().eq('id', id).eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/courses/${courseId}`)
}

// ── Lecture Slides ─────────────────────────────────────────────────────

export async function createLectureSlide(courseId: string, data: {
  title: string
  lectureNumber?: number
  fileName: string
  fileType: string
  fileSize: number
}) {
  validateFile(data.fileType, data.fileSize)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: slide, error } = await supabase
    .from('lecture_slides')
    .insert({
      user_id: user.id,
      course_id: courseId,
      title: data.title,
      lecture_number: data.lectureNumber ?? null,
      processing_status: 'pending',
    })
    .select('id')
    .single()

  if (error || !slide) throw new Error(error?.message ?? 'Failed to create slide record')

  const storagePath = `${user.id}/slides/${slide.id}/${data.fileName}`
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (signError || !signed) throw new Error(signError?.message ?? 'Failed to create upload URL')

  await supabase.from('lecture_slides').update({ file_url: storagePath }).eq('id', slide.id)

  return { slideId: slide.id, storagePath, token: signed.token }
}

export async function processLectureSlide(slideId: string, courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('lecture_slides')
    .update({ processing_status: 'processing' })
    .eq('id', slideId)
    .eq('user_id', user.id)

  try {
    const { data: slide } = await supabase
      .from('lecture_slides')
      .select('file_url')
      .eq('id', slideId)
      .single()

    if (!slide?.file_url) throw new Error('File path not found on record')

    const { data: blob, error: dlError } = await supabase.storage
      .from(BUCKET)
      .download(slide.file_url)

    if (dlError || !blob) throw new Error(dlError?.message ?? 'Download failed')

    const buffer = Buffer.from(await blob.arrayBuffer())
    const pages = await parsePdfPages(buffer)
    const chunks = chunkSlidePages(pages)

    if (chunks.length > 0) {
      const { error: insertError } = await supabase.from('lecture_slide_chunks').insert(
        chunks.map(c => ({
          slide_id: slideId,
          content: c.content,
          chunk_index: c.chunk_index,
          slide_number: c.slide_number,
        }))
      )
      if (insertError) throw new Error(insertError.message)
    }

    await supabase
      .from('lecture_slides')
      .update({ processing_status: 'ready', processing_error: null })
      .eq('id', slideId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed'
    await supabase
      .from('lecture_slides')
      .update({ processing_status: 'failed', processing_error: message })
      .eq('id', slideId)
  }

  revalidatePath(`/dashboard/courses/${courseId}`)
}

export async function deleteLectureSlide(id: string, courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: slide } = await supabase
    .from('lecture_slides')
    .select('file_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (slide?.file_url) {
    await supabase.storage.from(BUCKET).remove([slide.file_url])
  }

  const { error } = await supabase
    .from('lecture_slides')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/courses/${courseId}`)
}

// ── Exams ─────────────────────────────────────────────────────────────

export async function createExam(courseId: string, data: {
  title: string
  examDate?: string
  fileName: string
  fileType: string
  fileSize: number
}) {
  validateFile(data.fileType, data.fileSize)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: exam, error } = await supabase
    .from('exams')
    .insert({
      user_id: user.id,
      course_id: courseId,
      title: data.title,
      exam_date: data.examDate || null,
      processing_status: 'ready',  // Exams don't need text extraction
    })
    .select('id')
    .single()

  if (error || !exam) throw new Error(error?.message ?? 'Failed to create exam record')

  const storagePath = `${user.id}/exams/${exam.id}/${data.fileName}`
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (signError || !signed) throw new Error(signError?.message ?? 'Failed to create upload URL')

  await supabase.from('exams').update({ file_url: storagePath }).eq('id', exam.id)

  return { examId: exam.id, storagePath, token: signed.token }
}

export async function deleteExam(id: string, courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: exam } = await supabase
    .from('exams')
    .select('file_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (exam?.file_url) {
    await supabase.storage.from(BUCKET).remove([exam.file_url])
  }

  const { error } = await supabase.from('exams').delete().eq('id', id).eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/courses/${courseId}`)
}
