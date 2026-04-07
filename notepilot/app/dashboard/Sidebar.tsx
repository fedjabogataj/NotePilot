'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Folder, FolderOpen, BookOpen, Book, Presentation,
  ClipboardList, PanelLeftClose, PanelLeftOpen, ChevronRight,
} from 'lucide-react'
import type { SidebarCourse, SidebarMaterial } from './layout'

// ── Icons per material type ────────────────────────────────────────────────

const TypeIcon = {
  book:  <Book  size={14} style={{ flexShrink: 0 }} />,
  slide: <Presentation size={14} style={{ flexShrink: 0 }} />,
  exam:  <ClipboardList size={14} style={{ flexShrink: 0 }} />,
}

// ── Status dot ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  if (status === 'ready') return null
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: 5, height: 5, background: status === 'failed' ? '#f04438' : '#e9a84c' }}
    />
  )
}

// ── Sidebar row ────────────────────────────────────────────────────────────

function Row({
  indent = 0,
  active = false,
  children,
  onClick,
  href,
}: {
  indent?: number
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
  href?: string
}) {
  const style = {
    paddingLeft: 12 + indent * 12,
    background: active ? '#252525' : 'transparent',
    color: '#e8e8e8',
  } as const

  const cls = 'flex items-center gap-1.5 mx-1 rounded-[4px] transition-all h-7 pr-2 text-[13px]'

  if (href) {
    return (
      <Link
        href={href}
        className={cls}
        style={style}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#1e1e1e' }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`${cls} w-full text-left`}
      style={style}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#1e1e1e' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

// ── Main sidebar ───────────────────────────────────────────────────────────

export default function Sidebar({
  courses,
  materials,
}: {
  courses: SidebarCourse[]
  materials: SidebarMaterial[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeView = searchParams.get('view') // "book:uuid" | "slide:uuid" | "exam:uuid"
  const [collapsed, setCollapsed] = useState(false)

  // Group courses by semester (null → 'Other')
  const semesterMap = new Map<string, SidebarCourse[]>()
  for (const course of courses) {
    const key = course.semester ?? 'Other'
    if (!semesterMap.has(key)) semesterMap.set(key, [])
    semesterMap.get(key)!.push(course)
  }
  // Sort semesters descending (most recent first), 'Other' last
  const semesters = [...semesterMap.keys()].sort((a, b) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return b.localeCompare(a)
  })

  // Collapse state per semester and per course
  const [openSemesters, setOpenSemesters] = useState<Set<string>>(() => new Set(semesters))
  const [openCourses, setOpenCourses] = useState<Set<string>>(() => {
    // Auto-open the currently active course
    const match = pathname.match(/\/courses\/([^/]+)/)
    return match ? new Set([match[1]]) : new Set()
  })

  function toggleSemester(s: string) {
    setOpenSemesters(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  function toggleCourse(id: string) {
    setOpenCourses(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (collapsed) {
    return (
      <aside
        className="flex flex-col items-center pt-3 shrink-0"
        style={{ width: 44, background: '#111111', borderRight: '1px solid #2e2e2e' }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center rounded-[6px] transition-all"
          style={{ width: 30, height: 30, color: '#e8e8e8' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#1e1e1e')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <PanelLeftOpen size={15} style={{ opacity: 0.5 }} />
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{ width: 260, background: '#111111', borderRight: '1px solid #2e2e2e' }}
    >
      {/* Scrollable tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {courses.length === 0 && (
          <p className="px-4 pt-2 text-[12px]" style={{ color: '#e8e8e8', opacity: 0.28 }}>
            No courses yet
          </p>
        )}

        {semesters.map(semester => {
          const semCourses = semesterMap.get(semester)!
          const semOpen = openSemesters.has(semester)

          return (
            <div key={semester} className="mb-0.5">
              {/* Semester folder row */}
              <Row indent={0} onClick={() => toggleSemester(semester)}>
                <ChevronRight
                  size={12}
                  style={{
                    opacity: 0.4,
                    flexShrink: 0,
                    transform: semOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 150ms ease-out',
                  }}
                />
                {semOpen
                  ? <FolderOpen size={14} style={{ opacity: 0.55, flexShrink: 0, color: '#e9a84c' }} />
                  : <Folder    size={14} style={{ opacity: 0.55, flexShrink: 0, color: '#e9a84c' }} />
                }
                <span className="truncate font-medium text-[13px]" style={{ opacity: 0.8 }}>
                  {semester}
                </span>
              </Row>

              {semOpen && semCourses.map(course => {
                const courseHref = `/dashboard/courses/${course.id}`
                const courseActive = pathname === courseHref || (pathname.startsWith(courseHref + '/') && !activeView)
                const courseOpen = openCourses.has(course.id)
                const courseMaterials = materials.filter(m => m.course_id === course.id)

                return (
                  <div key={course.id}>
                    {/* Course row */}
                    <Row indent={1} active={courseActive && !activeView} onClick={() => toggleCourse(course.id)}>
                      <ChevronRight
                        size={11}
                        style={{
                          opacity: 0.35,
                          flexShrink: 0,
                          transform: courseOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 150ms ease-out',
                        }}
                      />
                      <BookOpen size={14} style={{ opacity: courseActive ? 0.8 : 0.5, flexShrink: 0 }} />
                      <span
                        className="truncate text-[13px]"
                        style={{ opacity: courseActive ? 1 : 0.72 }}
                      >
                        {course.name}
                      </span>
                    </Row>

                    {/* Materials */}
                    {courseOpen && courseMaterials.map(mat => {
                      const fileKey = `${mat.type}:${mat.id}`
                      const fileActive = activeView === fileKey && pathname.startsWith(`/dashboard/courses/${course.id}`)
                      const href = `/dashboard/courses/${course.id}?view=${fileKey}`

                      return (
                        <Row key={mat.id} indent={2} active={fileActive} href={href}>
                          <span style={{ opacity: fileActive ? 0.8 : 0.45 }}>
                            {TypeIcon[mat.type]}
                          </span>
                          <span
                            className="truncate text-[13px]"
                            style={{ opacity: fileActive ? 1 : 0.65 }}
                          >
                            {mat.title}
                          </span>
                          <StatusDot status={mat.status} />
                        </Row>
                      )
                    })}

                    {courseOpen && courseMaterials.length === 0 && (
                      <p
                        className="text-[11px]"
                        style={{ paddingLeft: 12 + 3 * 12, color: '#e8e8e8', opacity: 0.22, lineHeight: '24px' }}
                      >
                        No files yet
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div
        className="shrink-0 flex items-center justify-between px-3 py-3"
        style={{ borderTop: '1px solid #2e2e2e' }}
      >
        <Link
          href="/dashboard"
          className="text-[12px] transition-all"
          style={{ color: '#e8e8e8', opacity: 0.38 }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.38')}
        >
          + New Course
        </Link>
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center justify-center rounded-[6px] transition-all"
          style={{ width: 26, height: 26, color: '#e8e8e8' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#1e1e1e')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <PanelLeftClose size={14} style={{ opacity: 0.45 }} />
        </button>
      </div>
    </aside>
  )
}
