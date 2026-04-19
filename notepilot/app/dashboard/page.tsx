import { createClient } from '@/lib/supabase/server'
import CoursesClient from './CoursesClient'
import AddItemPanel from './AddItemPanel'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; parent?: string; type?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // ── Unified add-item panel ────────────────────────────────────────────────
  if (params.add === 'item' || params.add === 'course') {
    const { data: courses } = await supabase
      .from('courses')
      .select('id, name, code')
      .order('created_at', { ascending: true })

    const initialType = params.add === 'course'
      ? 'course' as const
      : (params.type as 'course' | 'folder' | 'book' | 'slide' | 'exam' | null) ?? null

    return (
      <AddItemPanel
        courses={courses ?? []}
        courseId={null}
        courseName={null}
        parentFolderId={params.parent ?? null}
        initialType={initialType}
      />
    )
  }

  // ── Default: all courses list ──────────────────────────────────────────────
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, code, description')
    .order('created_at', { ascending: false })

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto px-8" style={{ maxWidth: 900, paddingTop: 64, paddingBottom: 64 }}>
        <CoursesClient courses={courses ?? []} />
      </div>
    </div>
  )
}
