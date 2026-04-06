import { createClient } from '@/lib/supabase/server'
import CoursesClient from './CoursesClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, code, semester, description')
    .order('created_at', { ascending: false })

  return <CoursesClient courses={courses ?? []} />
}
