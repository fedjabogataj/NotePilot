import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import CourseClient from './CourseClient'
import AddMaterialPanel from './AddMaterialPanel'

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>
  searchParams: Promise<{ view?: string; add?: string }>
}) {
  const { courseId } = await params
  const { view, add } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, semester, description')
    .eq('id', courseId)
    .eq('user_id', user.id)
    .single()

  if (!course) notFound()

  // Add material panel — no need for full course data
  if (add === 'book' || add === 'slide' || add === 'exam') {
    return <AddMaterialPanel courseId={courseId} initialType={add} />
  }

  const [{ data: books }, { data: slides }, { data: exams }] = await Promise.all([
    supabase.from('books').select('id, title, author, processing_status, processing_error, created_at').eq('course_id', courseId).order('created_at', { ascending: false }),
    supabase.from('lecture_slides').select('id, title, lecture_number, processing_status, processing_error, uploaded_at').eq('course_id', courseId).order('uploaded_at', { ascending: false }),
    supabase.from('exams').select('id, title, exam_date, processing_status, processing_error, created_at').eq('course_id', courseId).order('created_at', { ascending: false }),
  ])

  return (
    <CourseClient
      courseId={courseId}
      courseName={course.name}
      courseCode={course.code}
      courseSemester={course.semester}
      courseDescription={course.description}
      initialBooks={books ?? []}
      initialSlides={slides ?? []}
      initialExams={exams ?? []}
      initialView={view ?? null}
    />
  )
}
