import Sidebar from '@/components/layout/Sidebar'

interface AppShellProps {
  children: React.ReactNode
  onRefresh?: () => void
}

export default function AppShell({ children, onRefresh }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onRefresh={onRefresh} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
