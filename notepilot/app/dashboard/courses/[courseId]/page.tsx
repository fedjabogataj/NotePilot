import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import CourseClient from './CourseClient'
import AddItemPanel from '@/app/dashboard/AddItemPanel'

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>
  searchParams: Promise<{ view?: string; add?: string; parent?: string; type?: string }>
}) {
  const { courseId } = await params
  const { view, add, parent, type } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, description')
    .eq('id', courseId)
    .eq('user_id', user.id)
    .single()

  if (!course) notFound()

  // Unified add panel — handles all add types
  if (add !== undefined) {
    // Map legacy ?add=book to initialType
    const initialType = add === 'item'
      ? (type as 'folder' | 'book' | 'slide' | 'exam' | null) ?? null
      : add as 'folder' | 'book' | 'slide' | 'exam'

    return (
      <AddItemPanel
        courses={[]}
        courseId={courseId}
        courseName={course.name}
        parentFolderId={parent ?? null}
        initialType={initialType}
      />
    )
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
      courseDescription={course.description}
      initialBooks={books ?? []}
      initialSlides={slides ?? []}
      initialExams={exams ?? []}
      initialView={view ?? null}
    />
  )
}
