import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Topbar from './Topbar'
import Sidebar from './Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, code')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

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
        <Sidebar courses={courses ?? []} />
        <main className="flex-1 overflow-y-auto">
          <div
            className="mx-auto px-8"
            style={{ maxWidth: 900, paddingTop: 64, paddingBottom: 64 }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
