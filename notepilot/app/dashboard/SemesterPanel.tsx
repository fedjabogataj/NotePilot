'use client'

import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'

type CourseSummary = {
  id: string
  name: string
  code: string | null
  bookCount: number
  slideCount: number
  examCount: number
}

export default function SemesterPanel({
  semester,
  courses,
}: {
  semester: string
  courses: CourseSummary[]
}) {
  const router = useRouter()
  const label = semester || 'Other'

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto px-8" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 56 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-bold" style={{ fontSize: 28, color: '#e8e8e8' }}>{label}</h1>
          <button
            onClick={() => router.push(semester ? `/dashboard?add=item&type=course&semester=${encodeURIComponent(semester)}` : '/dashboard?add=item&type=course')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
            style={{ background: '#333333', color: '#e8e8e8' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#3d3d3d')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#333333')}
          >
            + Add Course
          </button>
        </div>

        <p className="text-[13px] mb-4" style={{ color: '#e8e8e8', opacity: 0.35 }}>
          {courses.length} {courses.length === 1 ? 'course' : 'courses'}
        </p>

        {/* Course list */}
        {courses.length === 0 ? (
          <p className="text-[14px] text-center py-16" style={{ color: '#e8e8e8', opacity: 0.3 }}>
            No courses in this semester yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {courses.map(course => {
              const totalFiles = course.bookCount + course.slideCount + course.examCount
              return (
                <Link
                  key={course.id}
                  href={`/dashboard/courses/${course.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                  style={{ color: '#e8e8e8' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#1e1e1e')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <BookOpen size={16} style={{ opacity: 0.4, flexShrink: 0 }} />
                  <span className="flex-1 text-[14px] truncate" style={{ opacity: 0.85 }}>{course.name}</span>
                  {course.code && (
                    <span className="font-mono text-[11px] shrink-0" style={{ opacity: 0.35 }}>{course.code}</span>
                  )}
                  {totalFiles > 0 && (
                    <span className="text-[11px] shrink-0" style={{ opacity: 0.3 }}>
                      {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
