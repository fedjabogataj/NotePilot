import { BookMarked } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#191919' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: '#2a2a2a', border: '1px solid #2d2d2d' }}
      >
        <div className="flex items-center gap-2 mb-8">
          <BookMarked size={20} style={{ color: '#e9a84c' }} />
          <span className="text-xl font-bold" style={{ color: '#ebebeb' }}>NotePilot</span>
        </div>
        {children}
      </div>
    </div>
  )
}
