'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

type Course = { id: string; name: string; code: string | null; semester: string | null }

export default function Breadcrumb({ courses }: { courses: Course[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const crumbs: { label: string; href: string }[] = []

  // Always start with Home
  crumbs.push({ label: 'Home', href: '/dashboard' })

  // Semester view: /dashboard?semester=X
  const semester = searchParams.get('semester')
  if (semester && pathname === '/dashboard') {
    crumbs.push({ label: semester, href: `/dashboard?semester=${encodeURIComponent(semester)}` })
  }

  // Add item at dashboard level
  const addParam = searchParams.get('add')
  if (addParam && pathname === '/dashboard') {
    if (semester) {
      crumbs.push({ label: semester, href: `/dashboard?semester=${encodeURIComponent(semester)}` })
    }
    crumbs.push({ label: 'Add Item', href: '#' })
  }

  // Course pages: /dashboard/courses/[courseId]
  const courseMatch = pathname.match(/\/dashboard\/courses\/([^/?]+)/)
  if (courseMatch) {
    const courseId = courseMatch[1]
    const course = courses.find(c => c.id === courseId)
    if (course) {
      if (course.semester) {
        crumbs.push({ label: course.semester, href: `/dashboard?semester=${encodeURIComponent(course.semester)}` })
      }
      crumbs.push({ label: course.name, href: `/dashboard/courses/${courseId}` })

      // Sub-pages within a course
      if (addParam) {
        crumbs.push({ label: 'Add Item', href: '#' })
      }
      const view = searchParams.get('view')
      if (view) {
        const [, id] = view.split(':')
        const title = courses.length ? undefined : undefined // we don't have material titles here
        crumbs.push({ label: id ? 'Viewer' : 'View', href: '#' })
      }
    }
  }

  // Don't render if only "Home"
  if (crumbs.length <= 1 && !courseMatch) return null

  return (
    <div
      className="flex items-center gap-1 px-4 shrink-0"
      style={{ height: 36, color: '#e8e8e8', borderBottom: '1px solid #2e2e2e' }}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} style={{ opacity: 0.25 }} />}
            {isLast ? (
              <span className="text-[13px]" style={{ opacity: 0.65 }}>{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-[13px] transition-colors"
                style={{ opacity: 0.4 }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.4')}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </div>
  )
}
