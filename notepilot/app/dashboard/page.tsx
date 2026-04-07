import { createClient } from '@/lib/supabase/server'
import CoursesClient from './CoursesClient'
import SemesterPanel from './SemesterPanel'
import AddCoursePanel from './AddCoursePanel'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string; add?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // ── Add course panel ────────────────────────────────────────────────────
  if (params.add === 'course') {
    return <AddCoursePanel semester={params.semester} />
  }

  // ── Semester info panel ─────────────────────────────────────────────────
  if (params.semester !== undefined) {
    const semester = params.semester   // '' = courses with no semester

    const { data: courses } = await supabase
      .from('courses')
      .select('id, name, code')
      .eq('semester', semester || null)
      .order('created_at', { ascending: true })

    const courseIds = (courses ?? []).map(c => c.id)

    // Fetch material counts
    const [{ data: books }, { data: slides }, { data: exams }] = await Promise.all([
      courseIds.length ? supabase.from('books').select('id, course_id').in('course_id', courseIds) : Promise.resolve({ data: [] }),
      courseIds.length ? supabase.from('lecture_slides').select('id, course_id').in('course_id', courseIds) : Promise.resolve({ data: [] }),
      courseIds.length ? supabase.from('exams').select('id, course_id').in('course_id', courseIds) : Promise.resolve({ data: [] }),
    ])

    const summaries = (courses ?? []).map(c => ({
      id: c.id,
      name: c.name,
      code: c.code,
      bookCount:  (books  ?? []).filter(b => b.course_id === c.id).length,
      slideCount: (slides ?? []).filter(s => s.course_id === c.id).length,
      examCount:  (exams  ?? []).filter(e => e.course_id === c.id).length,
    }))

    return <SemesterPanel semester={semester} courses={summaries} />
  }

  // ── Default: all courses grid ────────────────────────────────────────────
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, code, semester, description')
    .order('created_at', { ascending: false })

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto px-8" style={{ maxWidth: 900, paddingTop: 64, paddingBottom: 64 }}>
        <CoursesClient courses={courses ?? []} />
      </div>
    </div>
  )
}
