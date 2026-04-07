'use client'

import Link from 'next/link'
import { BookOpen, Book, Presentation, ClipboardList } from 'lucide-react'
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
  const totalFiles = courses.reduce((acc, c) => acc + c.bookCount + c.slideCount + c.examCount, 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto px-8" style={{ maxWidth: 720, paddingTop: 56, paddingBottom: 56 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[12px] uppercase tracking-widest mb-1" style={{ color: '#e8e8e8', opacity: 0.35, letterSpacing: '0.1em' }}>
              Semester
            </p>
            <h1 className="font-bold" style={{ fontSize: 28, color: '#e8e8e8' }}>{label}</h1>
          </div>
          <button
            onClick={() => router.push(semester ? `/dashboard?add=course&semester=${encodeURIComponent(semester)}` : '/dashboard?add=course')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style={{ background: '#333333', color: '#e8e8e8' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#3d3d3d')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#333333')}
          >
            + Add Course
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6 mb-8 pb-6" style={{ borderBottom: '1px solid #2e2e2e' }}>
          <Stat label="Courses" value={courses.length} />
          <Stat label="Total files" value={totalFiles} />
        </div>

        {/* Course cards */}
        {courses.length === 0 ? (
          <p className="text-[14px] text-center py-16" style={{ color: '#e8e8e8', opacity: 0.3 }}>
            No courses in this semester yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {courses.map(course => (
              <Link
                key={course.id}
                href={`/dashboard/courses/${course.id}`}
                className="flex items-center justify-between rounded-xl px-5 py-4 transition-all"
                style={{ background: '#222222', border: '1px solid #2e2e2e', color: '#e8e8e8' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#3a3a3a')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = '#2e2e2e')}
              >
                <div className="flex items-center gap-3">
                  <BookOpen size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
                  <div>
                    <p className="text-[14px] font-medium">{course.name}</p>
                    {course.code && (
                      <p className="text-[12px] font-mono mt-0.5" style={{ opacity: 0.4 }}>{course.code}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <FileStat icon={<Book size={12} />} count={course.bookCount} />
                  <FileStat icon={<Presentation size={12} />} count={course.slideCount} />
                  <FileStat icon={<ClipboardList size={12} />} count={course.examCount} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[22px] font-bold" style={{ color: '#e8e8e8' }}>{value}</p>
      <p className="text-[12px]" style={{ color: '#e8e8e8', opacity: 0.4 }}>{label}</p>
    </div>
  )
}

function FileStat({ icon, count }: { icon: React.ReactNode; count: number }) {
  return (
    <div className="flex items-center gap-1" style={{ color: '#e8e8e8', opacity: 0.4 }}>
      {icon}
      <span className="text-[12px]">{count}</span>
    </div>
  )
}
