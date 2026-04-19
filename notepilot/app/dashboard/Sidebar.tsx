'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import {
  Folder, FolderOpen, BookOpen, Book, Presentation,
  ClipboardList, PanelLeftClose, PanelLeftOpen, ChevronRight, MoreHorizontal, X, Plus, Home,
  BookMarked, LogOut,
} from 'lucide-react'
import type { SidebarCourse, SidebarMaterial, SidebarFolder } from './layout'
import { deleteCourse, createFolder, renameFolder, deleteFolder, moveMaterialToFolder } from './actions'
import { deleteBook, deleteLectureSlide, deleteExam } from './courses/[courseId]/actions'
import { createClient } from '@/lib/supabase/client'

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
    background: 'var(--color-np-hover)',
    border: '1px solid var(--color-np-active)',
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
          return <div key={i} style={{ height: 1, background: 'var(--color-np-border)', margin: '3px 0' }} />
        }
        return (
          <button
            key={i}
            onClick={() => { if (!item.disabled) { item.action(); onClose() } }}
            className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-sm transition-colors"
            style={{
              color: item.danger ? 'var(--color-np-red)' : 'var(--color-np-text)',
              opacity: item.disabled ? 0.35 : 1,
              cursor: item.disabled ? 'default' : 'pointer',
              background: 'transparent',
            }}
            onMouseEnter={e => { if (!item.disabled) (e.currentTarget as HTMLElement).style.background = 'var(--color-np-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {item.icon && <span className="text-sm leading-none" style={{ width: 16, textAlign: 'center' }}>{item.icon}</span>}
            {item.label}
            {item.disabled && <span className="ml-auto text-[0.625rem]" style={{ opacity: 0.4 }}>soon</span>}
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
      style={{ width: 20, height: 20, color: 'var(--color-np-text)' }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-np-active)')}
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
      style={{ width: 20, height: 20, color: 'var(--color-np-text)' }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-np-active)')}
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
  return <span className="inline-block rounded-full shrink-0" style={{ width: 5, height: 5, background: status === 'failed' ? 'var(--color-np-red)' : 'var(--color-np-amber)' }} />
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
        background: 'var(--color-np-surface)', border: '1px solid var(--color-np-active)',
        borderRadius: 10, width: 280, padding: '12px 0',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 10px' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-np-text)' }}>Move to folder</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', padding: 2 }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ height: 1, background: 'var(--color-np-border)', marginBottom: 4 }} />

        <button
          onClick={() => onMove(null)}
          className="flex items-center gap-2 w-full text-left"
          style={{
            padding: '5px 12px', color: 'var(--color-np-text)',
            background: material.folder_id === null ? 'var(--color-np-border)' : 'transparent',
          }}
          onMouseEnter={e => { if (material.folder_id !== null) (e.currentTarget as HTMLElement).style.background = 'var(--color-np-hover)' }}
          onMouseLeave={e => { if (material.folder_id !== null) (e.currentTarget as HTMLElement).style.background = material.folder_id === null ? 'var(--color-np-border)' : 'transparent' }}
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
              color: 'var(--color-np-text)',
              background: material.folder_id === folder.id ? 'var(--color-np-border)' : 'transparent',
            }}
            onMouseEnter={e => { if (material.folder_id !== folder.id) (e.currentTarget as HTMLElement).style.background = 'var(--color-np-hover)' }}
            onMouseLeave={e => { if (material.folder_id !== folder.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <Folder size={13} style={{ opacity: 0.45, flexShrink: 0 }} />
            <span>{folder.name}</span>
          </button>
        ))}

        {ordered.length === 0 && (
          <p className="text-[0.6875rem]" style={{ padding: '4px 12px', color: 'var(--color-np-text)', opacity: 0.3 }}>No folders in this course yet</p>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Main sidebar ───────────────────────────────────────────────────────────

const TypeIcon = {
  book:  <Book size={13} style={{ flexShrink: 0 }} />,
  slide: <Presentation size={13} style={{ flexShrink: 0 }} />,
  exam:  <ClipboardList size={13} style={{ flexShrink: 0 }} />,
}

const FOLDER_BASE = 28
const INDENT_STEP = 12

export default function Sidebar({
  courses,
  materials,
  folders,
  userEmail,
  displayName,
}: {
  courses: SidebarCourse[]
  materials: SidebarMaterial[]
  folders: SidebarFolder[]
  userEmail: string
  displayName: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeView = searchParams.get('view')
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const [menu, setMenu] = useState<{ items: MenuItem[]; anchor: { x: number; y: number } } | null>(null)
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set())
  const [movePicker, setMovePicker] = useState<{ mat: SidebarMaterial } | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    if (userMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  const [homeOpen, setHomeOpen] = useState(true)
  const [openCourses, setOpenCourses] = useState<Set<string>>(() => {
    const match = pathname.match(/\/courses\/([^/?]+)/)
    return match ? new Set([match[1]]) : new Set()
  })

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

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || (userEmail[0] ?? '?').toUpperCase()

  // ── Non-course folder renderer ─────────────────────────────────────────────

  function renderHomeLevel(parentFolderId: string | null, depth: number): React.ReactNode {
    const indent = 20 + depth * INDENT_STEP

    const myFolders = parentFolderId !== null
      ? folders.filter(f => f.course_id === null && f.parent_folder_id === parentFolderId)
      : folders.filter(f => f.course_id === null && f.parent_folder_id === null)

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
                className="group flex items-center mx-1 rounded-sm transition-all"
                style={{ height: 26, paddingLeft: indent }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-np-surface)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <button onClick={() => toggleFolder(folder.id)} className="shrink-0 p-0.5 mr-0.5" style={{ color: 'var(--color-np-text)' }}>
                  <ChevronRight size={10} style={{ opacity: 0.35, transform: isFolderOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease-out' }} />
                </button>
                <span className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: 'var(--color-np-text)' }}>
                  {isFolderOpen
                    ? <FolderOpen size={13} style={{ opacity: 0.55, flexShrink: 0, color: 'var(--color-np-folder)' }} />
                    : <Folder    size={13} style={{ opacity: 0.55, flexShrink: 0, color: 'var(--color-np-folder)' }} />
                  }
                  <span className="text-sm truncate" style={{ opacity: 0.65 }}>{folder.name}</span>
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

  function renderLevel(courseId: string, parentFolderId: string | null, depth: number): React.ReactNode {
    const folderIndent = FOLDER_BASE + depth * INDENT_STEP
    const fileIndent = folderIndent + 12

    const myFolders = folders.filter(f => f.course_id === courseId && f.parent_folder_id === parentFolderId)
    const myMaterials = materials.filter(m => m.course_id === courseId && m.folder_id === parentFolderId)

    if (depth === 0 && myFolders.length === 0 && myMaterials.length === 0) {
      return (
        <p className="text-[0.6875rem]" style={{ paddingLeft: fileIndent, color: 'var(--color-np-text)', opacity: 0.22, lineHeight: '24px' }}>
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
                className="group flex items-center mx-1 rounded-sm transition-all"
                style={{ height: 26, paddingLeft: folderIndent }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-np-surface)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <button onClick={() => toggleFolder(folder.id)} className="shrink-0 p-0.5 mr-0.5" style={{ color: 'var(--color-np-text)' }}>
                  <ChevronRight size={10} style={{ opacity: 0.35, transform: isFolderOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease-out' }} />
                </button>
                <span className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: 'var(--color-np-text)' }}>
                  {isFolderOpen
                    ? <FolderOpen size={13} style={{ opacity: 0.55, flexShrink: 0, color: 'var(--color-np-folder)' }} />
                    : <Folder    size={13} style={{ opacity: 0.55, flexShrink: 0, color: 'var(--color-np-folder)' }} />
                  }
                  <span className="text-sm truncate" style={{ opacity: 0.65 }}>{folder.name}</span>
                </span>
                <PlusBtn onClick={() => router.push(`/dashboard/courses/${courseId}?add=item&parent=${folder.id}`)} />
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
            { kind: 'item', icon: '✏️', label: 'Rename', disabled: false, action: () => {} },
            { kind: 'item', icon: '🗑', label: 'Delete', danger: false, action: () => doDeleteMaterial(mat) },
          ]

          return (
            <div
              key={mat.id}
              className="group flex items-center mx-1 rounded-sm transition-all"
              style={{ height: 26, paddingLeft: fileIndent, background: fileActive ? 'var(--color-np-border)' : 'transparent' }}
              onMouseEnter={e => { if (!fileActive) (e.currentTarget as HTMLElement).style.background = 'var(--color-np-surface)' }}
              onMouseLeave={e => { if (!fileActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <Link href={fileHref} className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: 'var(--color-np-text)' }}>
                <span style={{ opacity: fileActive ? 0.8 : 0.4 }}>{TypeIcon[mat.type]}</span>
                <span className="text-sm truncate" style={{ opacity: fileActive ? 1 : 0.6 }}>{mat.title}</span>
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
      <aside className="flex flex-col items-center pt-3 shrink-0" style={{ width: 44, background: 'var(--color-np-sidebar)', borderRight: '1px solid var(--color-np-border)' }}>
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center rounded-md transition-all"
          style={{ width: 30, height: 30, color: 'var(--color-np-text)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-np-surface)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <PanelLeftOpen size={15} style={{ opacity: 0.5 }} />
        </button>
      </aside>
    )
  }

  return (
    <>
      <aside className="flex flex-col shrink-0" style={{ width: 240, background: 'var(--color-np-sidebar)', borderRight: '1px solid var(--color-np-border)' }}>
        {/* ── Logo header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 shrink-0" style={{ height: 44 }}>
          <BookMarked size={16} style={{ color: 'var(--color-np-amber)', flexShrink: 0 }} />
          <span className="text-base font-semibold truncate" style={{ color: 'var(--color-np-text)' }}>NotePilot</span>
        </div>

        {/* ── Tree ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-1">
          {/* Home root row */}
          <div
            className="group flex items-center mx-1 px-2 rounded-sm transition-all mb-0.5"
            style={{ height: 26 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-np-sidebar-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <button onClick={() => setHomeOpen(prev => !prev)} className="shrink-0 p-0.5 mr-0.5" style={{ color: 'var(--color-np-text)' }}>
              <ChevronRight size={10} style={{ opacity: 0.4, transform: homeOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease-out' }} />
            </button>
            <Link href="/dashboard" className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: 'var(--color-np-text)' }}>
              <Home size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
              <span className="text-sm truncate" style={{ opacity: 0.65 }}>
                Home
              </span>
            </Link>
            <PlusBtn onClick={() => router.push('/dashboard?add=item')} />
          </div>

          {homeOpen && (
            <div style={{ paddingLeft: 12 }}>
              {/* Standalone folders at home level */}
              {renderHomeLevel(null, 0)}

              {courses.length === 0 && folders.filter(f => f.course_id === null && f.parent_folder_id === null).length === 0 && (
                <p className="px-4 pt-1 text-[0.6875rem]" style={{ color: 'var(--color-np-text)', opacity: 0.22 }}>No items yet</p>
              )}

              {/* Courses */}
              {courses.map(course => {
                const courseHref = `/dashboard/courses/${course.id}`
                const courseActive = pathname.startsWith(`/dashboard/courses/${course.id}`) && !activeView && !searchParams.get('add')
                const courseOpen = openCourses.has(course.id)

                const courseMenuItems: MenuItem[] = [
                  { kind: 'item', icon: '🗑', label: 'Delete Course', danger: true, action: () => doDeleteCourse(course.id, course.name) },
                ]

                return (
                  <div key={course.id}>
                    <div className="group flex items-center mx-1 px-2 rounded-sm transition-all" style={{ height: 26, background: courseActive ? 'var(--color-np-surface)' : 'transparent' }}
                      onMouseEnter={e => { if (!courseActive) (e.currentTarget as HTMLElement).style.background = 'var(--color-np-sidebar-hover)' }}
                      onMouseLeave={e => { if (!courseActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <button onClick={() => toggleCourse(course.id)} className="shrink-0 p-0.5 mr-0.5" style={{ color: 'var(--color-np-text)' }}>
                        <ChevronRight size={10} style={{ opacity: 0.35, transform: courseOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease-out' }} />
                      </button>
                      <Link href={courseHref} className="flex items-center gap-1.5 flex-1 min-w-0 mr-1" style={{ color: 'var(--color-np-text)' }}>
                        <BookOpen size={13} style={{ opacity: courseActive ? 0.7 : 0.45, flexShrink: 0 }} />
                        <span className="text-sm truncate" style={{ opacity: courseActive ? 1 : 0.65 }}>{course.name}</span>
                      </Link>
                      <PlusBtn onClick={() => router.push(`${courseHref}?add=item`)} />
                      <MoreBtn onOpen={anchor => setMenu({ items: courseMenuItems, anchor })} />
                    </div>
                    {courseOpen && renderLevel(course.id, null, 0)}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Footer: user + collapse ─────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-2 py-2" style={{ borderTop: '1px solid var(--color-np-border)' }}>
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 rounded-sm px-2 py-1 transition-colors"
              style={{ maxWidth: 180 }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-np-surface)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              <div
                className="flex items-center justify-center shrink-0 rounded-full text-[0.625rem] font-semibold"
                style={{ width: 22, height: 22, background: 'var(--color-np-active)', color: 'var(--color-np-text)' }}
              >
                {initials}
              </div>
              <span
                className="text-xs truncate"
                style={{ color: 'var(--color-np-text)', opacity: 0.6, maxWidth: 110 }}
              >
                {displayName || userEmail}
              </span>
            </button>

            {userMenuOpen && (
              <div
                className="absolute left-0 z-50 w-50 rounded-lg py-1"
                style={{
                  bottom: 'calc(100% + 6px)',
                  background: 'var(--color-np-hover)',
                  border: '1px solid var(--color-np-border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--color-np-border)' }}>
                  <p className="text-xs truncate" style={{ color: 'var(--color-np-text)', opacity: 0.4 }}>
                    {userEmail}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2"
                  style={{ color: 'var(--color-np-text)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-np-hover)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <LogOut size={12} style={{ opacity: 0.5 }} />
                  Sign out
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(true)}
            className="flex items-center justify-center rounded-sm transition-all"
            style={{ width: 24, height: 24, color: 'var(--color-np-text)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-np-surface)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <PanelLeftClose size={13} style={{ opacity: 0.4 }} />
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
