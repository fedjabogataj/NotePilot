'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

type Course = { id: string; name: string; code: string | null }

export default function Breadcrumb({ courses }: { courses: Course[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const crumbs: { label: string; href: string }[] = []

  // Always start with Home
  crumbs.push({ label: 'Home', href: '/dashboard' })

  // Add item at dashboard level
  const addParam = searchParams.get('add')
  if (addParam && pathname === '/dashboard') {
    crumbs.push({ label: 'Add Item', href: '#' })
  }

  // Course pages: /dashboard/courses/[courseId]
  const courseMatch = pathname.match(/\/dashboard\/courses\/([^/?]+)/)
  if (courseMatch) {
    const courseId = courseMatch[1]
    const course = courses.find(c => c.id === courseId)
    if (course) {
      crumbs.push({ label: course.name, href: `/dashboard/courses/${courseId}` })

      if (addParam) {
        crumbs.push({ label: 'Add Item', href: '#' })
      }
      const view = searchParams.get('view')
      if (view) {
        crumbs.push({ label: 'Viewer', href: '#' })
      }
    }
  }

  // Don't render if only "Home"
  if (crumbs.length <= 1 && !courseMatch) return null

  return (
    <div
      className="flex items-center gap-1 px-4 shrink-0"
      style={{ height: 36, color: 'var(--color-np-text)', borderBottom: '1px solid var(--color-np-border)' }}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} style={{ opacity: 0.25 }} />}
            {isLast ? (
              <span className="text-sm" style={{ opacity: 0.65 }}>{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-sm transition-colors"
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
