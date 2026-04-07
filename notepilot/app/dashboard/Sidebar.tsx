'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

type Course = {
  id: string
  name: string
  code: string | null
}

export default function Sidebar({ courses }: { courses: Course[] }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <aside
        className="flex flex-col items-center pt-3 shrink-0"
        style={{ width: 48, background: '#111111', borderRight: '1px solid #2e2e2e' }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center rounded-[6px] transition-all"
          style={{ width: 32, height: 32, color: '#e8e8e8' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#1e1e1e')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          title="Open sidebar"
        >
          <PanelLeftOpen size={16} style={{ opacity: 0.55 }} />
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{ width: 260, background: '#111111', borderRight: '1px solid #2e2e2e' }}
    >
      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto pt-2 pb-2">
        <div className="px-4 mb-1 mt-1">
          <span
            className="text-[11px] uppercase font-medium"
            style={{ color: '#e8e8e8', opacity: 0.3, letterSpacing: '0.08em' }}
          >
            Courses
          </span>
        </div>

        {courses.map(course => {
          const href = `/dashboard/courses/${course.id}`
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <SidebarRow
              key={course.id}
              href={href}
              active={active}
              icon={<BookOpen size={16} style={{ opacity: active ? 0.75 : 0.55, flexShrink: 0 }} />}
              label={course.name}
            />
          )
        })}

        {courses.length === 0 && (
          <p className="px-4 text-[13px]" style={{ color: '#e8e8e8', opacity: 0.3 }}>
            No courses yet
          </p>
        )}
      </div>

      {/* Footer */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderTop: '1px solid #2e2e2e' }}
      >
        <Link
          href="/dashboard"
          className="text-[13px] transition-all"
          style={{ color: '#e8e8e8', opacity: 0.4 }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.4')}
        >
          + New Course
        </Link>
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center justify-center rounded-[6px] transition-all"
          style={{ width: 28, height: 28, color: '#e8e8e8' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#1e1e1e')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          title="Collapse sidebar"
        >
          <PanelLeftClose size={16} style={{ opacity: 0.55 }} />
        </button>
      </div>
    </aside>
  )
}

function SidebarRow({
  href,
  active,
  icon,
  label,
}: {
  href: string
  active: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 mx-1 px-3 rounded-[4px] transition-all"
      style={{
        height: 28,
        background: active ? '#252525' : 'transparent',
        color: '#e8e8e8',
        paddingTop: 4,
        paddingBottom: 4,
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLElement).style.background = '#1e1e1e'
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {icon}
      <span className="text-[14px] truncate" style={{ opacity: active ? 1 : 0.7 }}>
        {label}
      </span>
    </Link>
  )
}
