import { createClient } from '@/lib/supabase/server'
import CoursesClient from './CoursesClient'

export default async function DashboardPage() {
  const supabase = await createClient()

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
