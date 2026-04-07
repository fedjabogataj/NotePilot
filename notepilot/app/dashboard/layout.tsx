import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Topbar from './Topbar'
import Sidebar from './Sidebar'

export type SidebarCourse = {
  id: string
  name: string
  code: string | null
  semester: string | null
}

export type SidebarMaterial = {
  id: string
  title: string
  type: 'book' | 'slide' | 'exam'
  status: string
  course_id: string
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: courses }, { data: books }, { data: slides }, { data: exams }] = await Promise.all([
    supabase.from('courses').select('id, name, code, semester').eq('user_id', user.id).order('created_at', { ascending: true }),
    supabase.from('books').select('id, title, processing_status, course_id').eq('user_id', user.id),
    supabase.from('lecture_slides').select('id, title, processing_status, course_id').eq('user_id', user.id),
    supabase.from('exams').select('id, title, processing_status, course_id').eq('user_id', user.id),
  ])

  const materials: SidebarMaterial[] = [
    ...(books ?? []).map(b => ({ id: b.id, title: b.title, type: 'book' as const, status: b.processing_status, course_id: b.course_id })),
    ...(slides ?? []).map(s => ({ id: s.id, title: s.title, type: 'slide' as const, status: s.processing_status, course_id: s.course_id })),
    ...(exams ?? []).map(e => ({ id: e.id, title: e.title, type: 'exam' as const, status: e.processing_status, course_id: e.course_id })),
  ]

  const firstName = (user.user_metadata?.first_name as string | undefined) ?? ''
  const lastName = (user.user_metadata?.last_name as string | undefined) ?? ''
  const displayName = [firstName, lastName].filter(Boolean).join(' ')

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', background: '#1a1a1a', overflow: 'hidden' }}
    >
      <Topbar userEmail={user.email ?? ''} displayName={displayName} />
      <div className="flex flex-1 min-h-0">
        <Suspense fallback={<div style={{ width: 260, background: '#111111', borderRight: '1px solid #2e2e2e' }} />}>
          <Sidebar courses={(courses ?? []) as SidebarCourse[]} materials={materials} />
        </Suspense>
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
