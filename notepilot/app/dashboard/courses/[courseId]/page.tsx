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
      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link
          href="/dashboard"
          className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Courses
        </Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300">{course.name}</span>
      </div>

      {/* Course header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{course.name}</h1>
        <div className="flex items-center gap-2 mt-1.5">
          {course.code && (
            <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
              {course.code}
            </span>
          )}
          {course.semester && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{course.semester}</span>
          )}
        </div>
        {course.description && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
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
