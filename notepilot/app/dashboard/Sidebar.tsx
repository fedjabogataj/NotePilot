'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import {
  Folder, FolderOpen, BookOpen, Book, Presentation,
  ClipboardList, PanelLeftClose, PanelLeftOpen, ChevronRight, MoreHorizontal, X, Plus, Home,
} from 'lucide-react'
import type { SidebarCourse, SidebarMaterial, SidebarFolder } from './layout'
import { deleteCourse, createFolder, renameFolder, deleteFolder, moveMaterialToFolder } from './actions'
import { deleteBook, deleteLectureSlide, deleteExam } from './courses/[courseId]/actions'

// ── Types ──────────────────────────────────────────────────────────────────

type MenuItem =
  | { kind: 'separator' }
  | { kind: 'item'; label: string; icon?: string; danger?: boolean; disabled?: boolean; action: () => void }

// ── Context menu (portal, fixed position) ─────────────────────────────────

function ContextMenu({
  items,
  anchor,
  onClose,
}: {
  items: MenuItem[]
  anchor: { x: number; y: number }
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchor.y + 4,
    left: anchor.x - 192,
    width: 200,
    background: '#222222',
    border: '1px solid #333333',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    zIndex: 9999,
    padding: '4px 0',
    userSelect: 'none',
  }

  return createPortal(
    <div ref={ref} style={style}>
      {items.map((item, i) => {
        if (item.kind === 'separator') {
          return <div key={i} style={{ height: 1, background: '#2e2e2e', margin: '3px 0' }} />
        }
        return (
          <button
            key={i}
            onClick={() => { if (!item.disabled) { item.action(); onClose() } }}
            className="flex items-center gap-2.5 w-full text-left px-3 py-[6px] text-[13px] transition-colors"
            style={{
              color: item.danger ? '#f04438' : '#e8e8e8',
              opacity: item.disabled ? 0.35 : 1,
              cursor: item.disabled ? 'default' : 'pointer',
              background: 'transparent',
            }}
            onMouseEnter={e => { if (!item.disabled) (e.currentTarget as HTMLElement).style.background = '#2a2a2a' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {item.icon && <span style={{ fontSize: 13, width: 16, textAlign: 'center' }}>{item.icon}</span>}
            {item.label}
            {item.disabled && <span className="ml-auto text-[10px]" style={{ opacity: 0.4 }}>soon</span>}
          </button>
        )
      })}
    </div>,
    document.body
  )
}

// ── Three-dot button ───────────────────────────────────────────────────────

function MoreBtn({ onOpen }: { onOpen: (anchor: { x: number; y: number }) => void }) {
  return (
    <button
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        onOpen({ x: rect.right, y: rect.bottom })
      }}
      className="flex items-center justify-center rounded opacity-0 group-hover:opacity-100 shrink-0 transition-all"
      style={{ width: 20, height: 20, color: '#e8e8e8' }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#333333')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
      title="Options"
    >
      <MoreHorizontal size={13} style={{ opacity: 0.6 }} />
    </button>
  )
}

// ── Plus button ────────────────────────────────────────────────────────────

function PlusBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className="flex items-center justify-center rounded opacity-0 group-hover:opacity-100 shrink-0 transition-all"
      style={{ width: 20, height: 20, color: '#e8e8e8' }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#333333')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
      title="Add item"
    >
      <Plus size={13} style={{ opacity: 0.6 }} />
    </button>
  )
}

// ── Status dot ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  if (status === 'ready') return null
  return <span className="inline-block rounded-full shrink-0" style={{ width: 5, height: 5, background: status === 'failed' ? '#f04438' : '#e9a84c' }} />
}

// ── Move-to-folder picker ──────────────────────────────────────────────────

function MovePicker({
  material,
  folders,
  onMove,
  onClose,
}: {
  material: SidebarMaterial
  folders: SidebarFolder[]
  onMove: (folderId: string | null) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  // Build BFS-ordered list of folders for this course
  const courseFolders = folders.filter(f => f.course_id === material.course_id)
  const ordered: Array<{ folder: SidebarFolder; depth: number }> = []
  const build = (parentId: string | null, depth: number) => {
    for (const f of courseFolders.filter(f => f.parent_folder_id === parentId)) {
      ordered.push({ folder: f, depth })
      build(f.id, depth + 1)
    }
  }
  build(null, 0)

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)',
    }}>
      <div ref={ref} style={{
        background: '#1e1e1e', border: '1px solid #333333',
        borderRadius: 10, width: 280, padding: '12px 0',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 10px' }}>
          <span style={{ color: '#e8e8e8', fontSize: 13, fontWeight: 600 }}>Move to folder</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', padding: 2 }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ height: 1, background: '#2e2e2e', marginBottom: 4 }} />

        <button
          onClick={() => onMove(null)}
          className="flex items-center gap-2 w-full text-left"
          style={{
            padding: '5px 12px', color: '#e8e8e8', fontSize: 12,
            background: material.folder_id === null ? '#252525' : 'transparent',
          }}
          onMouseEnter={e => { if (material.folder_id !== null) (e.currentTarget as HTMLElement).style.background = '#2a2a2a' }}
          onMouseLeave={e => { if (material.folder_id !== null) (e.currentTarget as HTMLElement).style.background = material.folder_id === null ? '#252525' : 'transparent' }}
        >
          <Folder size={13} style={{ opacity: 0.45, flexShrink: 0 }} />
          <span style={{ opacity: 0.65 }}>Course root</span>
        </button>

        {ordered.map(({ folder, depth }) => (
          <button
            key={folder.id}
            onClick={() => onMove(folder.id)}
            className="flex items-center gap-2 w-full text-left"
            style={{
              paddingLeft: 12 + depth * 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5,
              color: '#e8e8e8', fontSize: 12,
              background: material.folder_id === folder.id ? '#252525' : 'transparent',
            }}
            onMouseEnter={e => { if (material.folder_id !== folder.id) (e.currentTarget as HTMLElement).style.background = '#2a2a2a' }}
            onMouseLeave={e => { if (material.folder_id !== folder.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <Folder size={13} style={{ opacity: 0.45, flexShrink: 0 }} />
            <span>{folder.name}</span>
          </button>
        ))}

        {ordered.length === 0 && (
          <p style={{ padding: '4px 12px', color: '#e8e8e8', opacity: 0.3, fontSize: 11 }}>No folders in this course yet</p>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Main sidebar ───────────────────────────────────────────────────────────

const TypeIcon = {
  book:  <Book size={14} style={{ flexShrink: 0 }} />,
  slide: <Presentation size={14} style={{ flexShrink: 0 }} />,
  exam:  <ClipboardList size={14} style={{ flexShrink: 0 }} />,
}

// Indent constants
const FOLDER_BASE = 28   // folders at course root depth
const INDENT_STEP = 12   // per nesting level

export default function Sidebar({
  courses,
  materials,
  folders,
}: {
  courses: SidebarCourse[]
  materials: SidebarMaterial[]
  folders: SidebarFolder[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeView = searchParams.get('view')
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const [menu, setMenu] = useState<{ items: MenuItem[]; anchor: { x: number; y: number } } | null>(null)
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set())
  const [movePicker, setMovePicker] = useState<{ mat: SidebarMaterial } | null>(null)

  // Group courses by semester
  const semesterMap = new Map<string, SidebarCourse[]>()
  for (const c of courses) {
    const k = c.semester ?? ''
    if (!semesterMap.has(k)) semesterMap.set(k, [])
    semesterMap.get(k)!.push(c)
  }
  const semesters = [...semesterMap.keys()].sort((a, b) => {
    if (a === '') return 1
    if (b === '') return -1
    return b.localeCompare(a)
  })

  const [homeOpen, setHomeOpen] = useState(true)
  const [openSemesters, setOpenSemesters] = useState<Set<string>>(() => new Set(semesters))
  const [openCourses, setOpenCourses] = useState<Set<string>>(() => {
    const match = pathname.match(/\/courses\/([^/?]+)/)
    return match ? new Set([match[1]]) : new Set()
  })

  function toggleSem(s: string) {
    setOpenSemesters(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })
  }
  function toggleCourse(id: string) {
    setOpenCourses(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleFolder(id: string) {
    setOpenFolders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ── Delete helpers ────────────────────────────────────────────────────────

  async function doDeleteCourse(id: string, name: string) {
    if (!confirm(`Delete course "${name}" and all its materials? This cannot be undone.`)) return
    try {
      await deleteCourse(id)
      router.push('/dashboard')
      router.refresh()
    } catch (err) { alert(err instanceof Error ? err.message : 'Delete failed') }
  }

  async function doDeleteMaterial(mat: SidebarMaterial) {
    if (!confirm(`Delete "${mat.title}"? This cannot be undone.`)) return
    try {
      if (mat.type === 'book')  await deleteBook(mat.id, mat.course_id)
      if (mat.type === 'slide') await deleteLectureSlide(mat.id, mat.course_id)
      if (mat.type === 'exam')  await deleteExam(mat.id, mat.course_id)
      router.refresh()
    } catch (err) { alert(err instanceof Error ? err.message : 'Delete failed') }
  }

  // ── Folder helpers ────────────────────────────────────────────────────────

  async function doCreateFolder(courseId: string, parentFolderId: string | null) {
    const label = parentFolderId ? 'Subfolder name:' : 'Folder name:'
    const name = window.prompt(label)
    if (!name?.trim()) return
    try { await createFolder(courseId, parentFolderId, name); router.refresh() }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to create folder') }
  }

  async function doRenameFolder(id: string, currentName: string) {
    const name = window.prompt('Rename folder:', currentName)
    if (!name?.trim() || name.trim() === currentName) return
    try { await renameFolder(id, name); router.refresh() }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to rename folder') }
  }

  async function doDeleteFolder(id: string, name: string) {
    if (!confirm(`Delete folder "${name}" and all its subfolders? Materials inside will be moved to course root.`)) return
    try { await deleteFolder(id); router.refresh() }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to delete folder') }
  }

  async function doMoveMaterial(mat: SidebarMaterial, folderId: string | null) {
    setMovePicker(null)
    try { await moveMaterialToFolder(mat.type, mat.id, folderId); router.refresh() }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed to move file') }
  }

  // ── Non-course folder renderer ─────────────────────────────────────────────
  // Renders folders that are not tied to a course (course_id = null).
  //
  // At the root level (parentFolderId = null):
  //   - semesterFilter = undefined  → home-level folders (semester = null)
  //   - semesterFilter = string     → semester-level folders (semester = that string)
  // For nested levels (parentFolderId set) the semester filter is ignored;
  // sub-folders are matched purely by parent_folder_id.

  function renderHomeLevel(parentFolderId: string | null, depth: number, semesterFilter?: string | null): React.ReactNode {
    const indent = 20 + depth * INDENT_STEP

    const myFolders = parentFolderId !== null
      // sub-folders: match by parent only
      ? folders.filter(f => f.course_id === null && f.parent_folder_id === parentFolderId)
      // root level: additionally filter by semester
      : semesterFilter !== undefined
        ? folders.filter(f => f.course_id === null && f.parent_folder_id === null && f.semester === semesterFilter)
        : folders.filter(f => f.course_id === null && f.parent_folder_id === null && f.semester === null)

    if (myFolders.length === 0) return null

    return (
      <>
        {myFolders.map(folder => {
          const isFolderOpen = openFolders.has(folder.id)
          const folderMenuItems: MenuItem[] = [
            { kind: 'item', icon: '🗑', label: 'Delete Folder', danger: true, action: () => doDeleteFolder(folder.id, folder.name) },
          ]
          return (
            <div key={folder.id}>
              <div
                className="group flex items-center mx-1 rounded-[4px] transition-all"
                style={{ height: 28, paddingLeft: indent }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1e1e1e' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <button onClick={() => toggleFolder(folder.id)} className="shrink-0 p-0.5 mr-0.5" style={{ color: '#e8e8e8' }}>
                  <ChevronRight size={11} style={{ opacity: 0.35, transform: isFolderOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease-out' }} />
                </button>
                <span className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: '#e8e8e8' }}>
                  {isFolderOpen
                    ? <FolderOpen size={14} style={{ opacity: 0.65, flexShrink: 0, color: '#6b9fd4' }} />
                    : <Folder    size={14} style={{ opacity: 0.65, flexShrink: 0, color: '#6b9fd4' }} />
                  }
                  <span className="text-[13px] truncate" style={{ opacity: 0.72 }}>{folder.name}</span>
                </span>
                <PlusBtn onClick={() => router.push(`/dashboard?add=item&parent=${folder.id}`)} />
                <MoreBtn onOpen={anchor => setMenu({ items: folderMenuItems, anchor })} />
              </div>
              {isFolderOpen && renderHomeLevel(folder.id, depth + 1)}
            </div>
          )
        })}
      </>
    )
  }

  // ── Recursive folder/file renderer ────────────────────────────────────────
  // depth=0 is course root; each nested folder increments depth

  function renderLevel(courseId: string, parentFolderId: string | null, depth: number): React.ReactNode {
    const folderIndent = FOLDER_BASE + depth * INDENT_STEP
    const fileIndent = folderIndent + 12  // files indent past the folder chevron area

    const myFolders = folders.filter(f => f.course_id === courseId && f.parent_folder_id === parentFolderId)
    const myMaterials = materials.filter(m => m.course_id === courseId && m.folder_id === parentFolderId)

    if (depth === 0 && myFolders.length === 0 && myMaterials.length === 0) {
      return (
        <p className="text-[11px]" style={{ paddingLeft: fileIndent, color: '#e8e8e8', opacity: 0.22, lineHeight: '24px' }}>
          No files yet
        </p>
      )
    }

    return (
      <>
        {myFolders.map(folder => {
          const isFolderOpen = openFolders.has(folder.id)
          const folderMenuItems: MenuItem[] = [
            { kind: 'item', icon: '🗑', label: 'Delete Folder', danger: true, action: () => doDeleteFolder(folder.id, folder.name) },
          ]

          return (
            <div key={folder.id}>
              <div
                className="group flex items-center mx-1 rounded-[4px] transition-all"
                style={{ height: 28, paddingLeft: folderIndent }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1e1e1e' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <button onClick={() => toggleFolder(folder.id)} className="shrink-0 p-0.5 mr-0.5" style={{ color: '#e8e8e8' }}>
                  <ChevronRight size={11} style={{ opacity: 0.35, transform: isFolderOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease-out' }} />
                </button>
                <span className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: '#e8e8e8' }}>
                  {isFolderOpen
                    ? <FolderOpen size={14} style={{ opacity: 0.65, flexShrink: 0, color: '#6b9fd4' }} />
                    : <Folder    size={14} style={{ opacity: 0.65, flexShrink: 0, color: '#6b9fd4' }} />
                  }
                  <span className="text-[13px] truncate" style={{ opacity: 0.72 }}>{folder.name}</span>
                </span>
                <PlusBtn onClick={() => router.push(`/dashboard?add=item&parent=${folder.id}`)} />
                <MoreBtn onOpen={anchor => setMenu({ items: folderMenuItems, anchor })} />
              </div>
              {isFolderOpen && renderLevel(courseId, folder.id, depth + 1)}
            </div>
          )
        })}

        {myMaterials.map(mat => {
          const fileKey = `${mat.type}:${mat.id}`
          const fileHref = `/dashboard/courses/${courseId}?view=${fileKey}`
          const fileActive = activeView === fileKey && pathname.startsWith(`/dashboard/courses/${courseId}`)

          const fileMenuItems: MenuItem[] = [
            { kind: 'item', icon: '↗', label: 'Open File', action: () => router.push(fileHref) },
            { kind: 'separator' },
            { kind: 'item', icon: '📁', label: 'Move to folder…', action: () => setMovePicker({ mat }) },
            { kind: 'separator' },
            { kind: 'item', icon: '✏️', label: 'Rename', disabled: true, action: () => {} },
            { kind: 'item', icon: '🗑', label: 'Delete', danger: true, action: () => doDeleteMaterial(mat) },
          ]

          return (
            <div
              key={mat.id}
              className="group flex items-center mx-1 rounded-[4px] transition-all"
              style={{ height: 28, paddingLeft: fileIndent, background: fileActive ? '#252525' : 'transparent' }}
              onMouseEnter={e => { if (!fileActive) (e.currentTarget as HTMLElement).style.background = '#1e1e1e' }}
              onMouseLeave={e => { if (!fileActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <Link href={fileHref} className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: '#e8e8e8' }}>
                <span style={{ opacity: fileActive ? 0.8 : 0.45 }}>{TypeIcon[mat.type]}</span>
                <span className="text-[13px] truncate" style={{ opacity: fileActive ? 1 : 0.65 }}>{mat.title}</span>
                <StatusDot status={mat.status} />
              </Link>
              <MoreBtn onOpen={anchor => setMenu({ items: fileMenuItems, anchor })} />
            </div>
          )
        })}
      </>
    )
  }

  // ── Collapsed sidebar ──────────────────────────────────────────────────────

  if (collapsed) {
    return (
      <aside className="flex flex-col items-center pt-3 shrink-0" style={{ width: 44, background: '#111111', borderRight: '1px solid #2e2e2e' }}>
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
    <>
      <aside className="flex flex-col shrink-0" style={{ width: 260, background: '#111111', borderRight: '1px solid #2e2e2e' }}>
        <div className="flex-1 overflow-y-auto py-2">
          {/* Home root row */}
          <div
            className="group flex items-center mx-1 px-2 rounded-[4px] transition-all mb-0.5"
            style={{ height: 28 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <button onClick={() => setHomeOpen(prev => !prev)} className="shrink-0 p-0.5 mr-0.5" style={{ color: '#e8e8e8' }}>
              <ChevronRight size={11} style={{ opacity: 0.4, transform: homeOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease-out' }} />
            </button>
            <Link href="/dashboard" className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: '#e8e8e8' }}>
              <Home size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
              <span className="text-[12px] font-semibold truncate uppercase tracking-wider" style={{ opacity: 0.65, letterSpacing: '0.06em' }}>
                Home
              </span>
            </Link>
            <PlusBtn onClick={() => router.push('/dashboard?add=item')} />
          </div>

          {homeOpen && (
            <div style={{ paddingLeft: 12 }}>
              {/* Standalone folders at home level */}
              {renderHomeLevel(null, 0)}

              {courses.length === 0 && folders.filter(f => f.course_id === null && f.parent_folder_id === null && f.semester === null).length === 0 && (
                <p className="px-4 pt-1 text-[12px]" style={{ color: '#e8e8e8', opacity: 0.28 }}>No items yet</p>
              )}

          {semesters.map(semester => {
            const semCourses = semesterMap.get(semester)!
            const semOpen = openSemesters.has(semester)
            const semLabel = semester || 'Other'
            const semHref = semester ? `/dashboard?semester=${encodeURIComponent(semester)}` : '/dashboard'
            const semActive = searchParams.get('semester') === semester && !searchParams.get('add')

            const semMenuItems: MenuItem[] = [
              { kind: 'item', icon: '➕', label: 'Add Course', action: () => router.push(semester ? `/dashboard?add=course&semester=${encodeURIComponent(semester)}` : '/dashboard?add=course') },
              { kind: 'separator' },
              { kind: 'item', icon: '✏️', label: 'Rename', disabled: true, action: () => {} },
              { kind: 'item', icon: '🗑', label: 'Delete', disabled: true, danger: true, action: () => {} },
            ]

            return (
              <div key={semester} className="mb-0.5">
                {/* Semester row */}
                <div className="group flex items-center mx-1 px-2 rounded-[4px] transition-all" style={{ height: 28 }}
                  onMouseEnter={e => { if (!semActive) (e.currentTarget as HTMLElement).style.background = '#1a1a1a' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <button onClick={() => toggleSem(semester)} className="shrink-0 p-0.5 mr-0.5" style={{ color: '#e8e8e8' }}>
                    <ChevronRight size={11} style={{ opacity: 0.4, transform: semOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease-out' }} />
                  </button>
                  <Link href={semHref} className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: '#e8e8e8' }}>
                    {semOpen
                      ? <FolderOpen size={14} style={{ opacity: 0.6, flexShrink: 0, color: '#e9a84c' }} />
                      : <Folder    size={14} style={{ opacity: 0.6, flexShrink: 0, color: '#e9a84c' }} />
                    }
                    <span className="text-[12px] font-semibold truncate uppercase tracking-wider" style={{ opacity: semActive ? 1 : 0.65, letterSpacing: '0.06em' }}>
                      {semLabel}
                    </span>
                  </Link>
                  <PlusBtn onClick={() => router.push(`/dashboard?add=item&semester=${encodeURIComponent(semester)}`)} />
                  <MoreBtn onOpen={anchor => setMenu({ items: semMenuItems, anchor })} />
                </div>

                {/* Semester-level folders (before courses) */}
                {semOpen && renderHomeLevel(null, 0, semester)}

                {semOpen && semCourses.map(course => {
                  const courseHref = `/dashboard/courses/${course.id}`
                  const courseActive = pathname.startsWith(`/dashboard/courses/${course.id}`) && !activeView && !searchParams.get('add')
                  const courseOpen = openCourses.has(course.id)

                  const courseMenuItems: MenuItem[] = [
                    { kind: 'item', icon: '🗑', label: 'Delete Course', danger: true, action: () => doDeleteCourse(course.id, course.name) },
                  ]

                  return (
                    <div key={course.id}>
                      {/* Course row */}
                      <div className="group flex items-center mx-1 px-2 rounded-[4px] transition-all" style={{ height: 28, paddingLeft: 20, background: courseActive ? '#252525' : 'transparent' }}
                        onMouseEnter={e => { if (!courseActive) (e.currentTarget as HTMLElement).style.background = '#1e1e1e' }}
                        onMouseLeave={e => { if (!courseActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <button onClick={() => toggleCourse(course.id)} className="shrink-0 p-0.5 mr-0.5" style={{ color: '#e8e8e8' }}>
                          <ChevronRight size={11} style={{ opacity: 0.35, transform: courseOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease-out' }} />
                        </button>
                        <Link href={courseHref} className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: '#e8e8e8' }}>
                          <BookOpen size={14} style={{ opacity: courseActive ? 0.8 : 0.5, flexShrink: 0 }} />
                          <span className="text-[13px] truncate" style={{ opacity: courseActive ? 1 : 0.72 }}>{course.name}</span>
                        </Link>
                        <PlusBtn onClick={() => router.push(`${courseHref}?add=book`)} />
                        <MoreBtn onOpen={anchor => setMenu({ items: courseMenuItems, anchor })} />
                      </div>

                      {/* Course contents (folders + files, recursive) */}
                      {courseOpen && renderLevel(course.id, null, 0)}
                    </div>
                  )
                })}
              </div>
            )
          })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-3 py-3" style={{ borderTop: '1px solid #2e2e2e' }}>
          <Link
            href="/dashboard?add=course"
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

      {/* Context menu portal */}
      {menu && <ContextMenu items={menu.items} anchor={menu.anchor} onClose={() => setMenu(null)} />}

      {/* Move-to-folder picker */}
      {movePicker && (
        <MovePicker
          material={movePicker.mat}
          folders={folders}
          onMove={folderId => doMoveMaterial(movePicker.mat, folderId)}
          onClose={() => setMovePicker(null)}
        />
      )}
    </>
  )
}
