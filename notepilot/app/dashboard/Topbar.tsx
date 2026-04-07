'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookMarked, Search, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type TopbarProps = {
  userEmail: string
  displayName: string
}

export default function Topbar({ userEmail, displayName }: TopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    function onMousedown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', onMousedown)
    return () => document.removeEventListener('mousedown', onMousedown)
  }, [dropdownOpen])

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

  return (
    <header
      className="flex items-center shrink-0 px-4"
      style={{
        height: 52,
        background: '#161616',
        borderBottom: '1px solid #2e2e2e',
      }}
    >
      {/* Left — logo */}
      <div className="flex items-center gap-2 shrink-0" style={{ width: 236 }}>
        <BookMarked size={18} style={{ color: '#e9a84c' }} />
        <span style={{ fontSize: 16, fontWeight: 600, color: '#e8e8e8' }}>NotePilot</span>
      </div>

      {/* Centre — search */}
      <div className="flex-1 flex justify-center px-4">
        <div className="relative w-full" style={{ maxWidth: 480 }}>
          <div
            className="flex items-center gap-2 px-3 transition-all"
            style={{
              height: 32,
              background: '#222222',
              border: `1px solid ${searchFocused ? '#444444' : '#2e2e2e'}`,
              borderRadius: 8,
              boxShadow: searchFocused ? '0 0 0 2px rgba(233,168,76,0.15)' : 'none',
            }}
          >
            <Search size={14} style={{ color: '#e8e8e8', opacity: 0.4, flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="flex-1 bg-transparent outline-none text-[14px]"
              style={{ color: '#e8e8e8' }}
              placeholder=""
            />
            {!searchFocused && (
              <span
                className="font-mono text-[11px] shrink-0"
                style={{ color: '#e8e8e8', opacity: 0.25 }}
              >
                ⌘K
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right — settings + user */}
      <div className="flex items-center justify-end gap-1 shrink-0" style={{ width: 236 }}>
        <Link
          href="/dashboard/settings"
          className="flex items-center justify-center rounded-[6px] transition-colors"
          style={{ width: 32, height: 32, color: '#e8e8e8' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#2a2a2a')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <Settings size={18} style={{ opacity: 0.55 }} />
        </Link>

        {/* User chip */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2 rounded-[6px] px-2 transition-colors"
            style={{ height: 30, maxWidth: 180 }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#2a2a2a')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <div
              className="flex items-center justify-center shrink-0 rounded-full text-[11px] font-semibold"
              style={{ width: 26, height: 26, background: '#333333', color: '#e8e8e8' }}
            >
              {initials}
            </div>
            <span
              className="text-[13px] truncate"
              style={{ color: '#e8e8e8', opacity: 0.8, maxWidth: 110 }}
            >
              {displayName || userEmail}
            </span>
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 z-50 w-[220px] rounded-[8px] py-1"
              style={{
                top: 'calc(100% + 6px)',
                background: '#222222',
                border: '1px solid #2e2e2e',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <div className="px-3 py-2" style={{ borderBottom: '1px solid #2e2e2e' }}>
                <p className="text-[13px] truncate" style={{ color: '#e8e8e8', opacity: 0.5 }}>
                  {userEmail}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 text-[13px] transition-colors"
                style={{ color: '#e8e8e8' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#2a2a2a')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
