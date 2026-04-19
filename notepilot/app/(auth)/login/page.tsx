'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const inputCls =
  'w-full rounded-lg px-3 py-2 text-sm outline-none transition-all'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: '#ebebeb' }}>Welcome back</h1>
        <p className="text-sm mt-1" style={{ color: '#ebebeb', opacity: 0.5 }}>Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div
            className="text-sm px-3 py-2 rounded-lg"
            style={{ color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.2)' }}
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={inputCls}
            style={{
              background: '#191919',
              border: '1px solid #2d2d2d',
              color: '#ebebeb',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#4a4a4a'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = '#2d2d2d'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={inputCls}
            style={{
              background: '#191919',
              border: '1px solid #2d2d2d',
              color: '#ebebeb',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#4a4a4a'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = '#2d2d2d'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          style={{ background: '#e9a84c', color: '#111111' }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#f0b85e' }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#e9a84c' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-sm text-center" style={{ color: '#ebebeb', opacity: 0.5 }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium" style={{ color: '#e9a84c', opacity: 1 }}>
          Sign up
        </Link>
      </p>
    </div>
  )
}
