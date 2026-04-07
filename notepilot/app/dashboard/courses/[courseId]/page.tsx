import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import MaterialsClient from './MaterialsClient'

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .eq('user_id', user.id)
    .single()

  if (!course) notFound()

  const [{ data: books }, { data: slides }, { data: exams }] = await Promise.all([
    supabase
      .from('books')
      .select('id, title, author, processing_status, processing_error, created_at')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false }),
    supabase
      .from('lecture_slides')
      .select('id, title, lecture_number, processing_status, processing_error, uploaded_at')
      .eq('course_id', courseId)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('exams')
      .select('id, title, exam_date, processing_status, processing_error, created_at')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-6" style={{ fontSize: 13, color: '#e8e8e8', opacity: 0.45 }}>
        <Link
          href="/dashboard"
          className="transition-opacity hover:opacity-80"
          style={{ color: '#e8e8e8' }}
        >
          Courses
        </Link>
        <span>/</span>
        <span style={{ opacity: 1 / 0.45 * 0.7, color: '#e8e8e8' }}>{course.name}</span>
      </div>

      {/* Course header */}
      <div className="mb-8">
        <h1 className="font-bold" style={{ fontSize: 32, color: '#e8e8e8' }}>{course.name}</h1>
        <div className="flex items-center gap-2 mt-1.5" style={{ fontSize: 13, color: '#e8e8e8', opacity: 0.45 }}>
          {course.code && (
            <span
              className="font-mono px-2 py-0.5 rounded"
              style={{ background: '#2a2a2a', opacity: 1, color: '#e8e8e8' }}
            >
              {course.code}
            </span>
          )}
          {course.semester && <span>{course.semester}</span>}
        </div>
        {course.description && (
          <p className="mt-2 max-w-2xl" style={{ fontSize: 14, color: '#e8e8e8', opacity: 0.5 }}>
            {course.description}
          </p>
        )}
      </div>

      <MaterialsClient
        courseId={courseId}
        initialBooks={books ?? []}
        initialSlides={slides ?? []}
        initialExams={exams ?? []}
      />
    </div>
  )
}
