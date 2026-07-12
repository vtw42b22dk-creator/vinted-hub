import Sidebar from '@/components/layout/Sidebar'
import SyncBanner from '@/components/layout/SyncBanner'

interface AppShellProps {
  children: React.ReactNode
  onRefresh?: () => void
}

export default function AppShell({ children, onRefresh }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onRefresh={onRefresh} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <SyncBanner />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
