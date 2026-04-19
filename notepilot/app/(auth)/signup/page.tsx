'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function getStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
const strengthColor = ['', '#f04438', '#fb923c', '#eab308', '#22c55e']
const strengthBarBg  = ['', '#f04438', '#fb923c', '#eab308', '#22c55e']

const inputStyle = {
  background: '#191919',
  border: '1px solid #2d2d2d',
  color: '#ebebeb',
} as const

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
      style={inputStyle}
      onFocus={e => {
        e.currentTarget.style.borderColor = '#4a4a4a'
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(233,168,76,0.15)'
        props.onFocus?.(e)
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = '#2d2d2d'
        e.currentTarget.style.boxShadow = 'none'
        props.onBlur?.(e)
      }}
    />
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const strength = getStrength(password)
  const passwordsMatch = confirm === '' || password === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (strength < 2) { setError('Please choose a stronger password (at least 8 characters with uppercase and a number)'); return }

    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setDone(true)
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold" style={{ color: '#ebebeb' }}>Check your email</h1>
        <p className="text-sm" style={{ color: '#ebebeb', opacity: 0.6 }}>
          We sent a confirmation link to{' '}
          <strong style={{ color: '#ebebeb', opacity: 1 }}>{email}</strong>.
          Click it to activate your account.
        </p>
        <Link href="/login" className="text-sm font-medium" style={{ color: '#e9a84c' }}>
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: '#ebebeb' }}>Create account</h1>
        <p className="text-sm mt-1" style={{ color: '#ebebeb', opacity: 0.5 }}>Start using NotePilot for free</p>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>First name</label>
            <DarkInput
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
              placeholder="Jane"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>Last name</label>
            <DarkInput
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              required
              autoComplete="family-name"
              placeholder="Smith"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>Email</label>
          <DarkInput
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="jane@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>Password</label>
          <DarkInput
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Min. 8 characters"
          />
          {password && (
            <div className="flex flex-col gap-1 mt-0.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-colors"
                    style={{ background: i <= strength ? strengthBarBg[strength] : '#3a3a3a' }}
                  />
                ))}
              </div>
              <p className="text-xs" style={{ color: strengthColor[strength] }}>
                {strengthLabel[strength]}
                {strength === 1 && ' — add uppercase, numbers or symbols'}
                {strength === 2 && ' — add more variety to strengthen'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: '#ebebeb', opacity: 0.7 }}>Confirm password</label>
          <DarkInput
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
          />
          {!passwordsMatch && (
            <p className="text-xs" style={{ color: '#f04438' }}>Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !passwordsMatch}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          style={{ background: '#e9a84c', color: '#111111' }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#f0b85e' }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#e9a84c' }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-center" style={{ color: '#ebebeb', opacity: 0.5 }}>
        Already have an account?{' '}
        <Link href="/login" className="font-medium" style={{ color: '#e9a84c', opacity: 1 }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
