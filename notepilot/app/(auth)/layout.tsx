export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
        <div className="mb-8">
          <span className="text-xl font-bold text-gray-900 dark:text-white">NotePilot</span>
        </div>
        {children}
      </div>
    </div>
  )
}
