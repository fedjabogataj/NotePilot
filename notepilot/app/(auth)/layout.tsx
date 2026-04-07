import { BookMarked } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#1a1a1a' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: '#222222', border: '1px solid #2e2e2e' }}
      >
        <div className="flex items-center gap-2 mb-8">
          <BookMarked size={20} style={{ color: '#e9a84c' }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: '#e8e8e8' }}>NotePilot</span>
        </div>
        {children}
      </div>
    </div>
  )
}
