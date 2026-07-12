import type { StatusArtigo } from '@/lib/types'
import { statusBadgeClasses } from '@/lib/utils'

interface StatusBadgeProps {
  status: StatusArtigo
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={statusBadgeClasses(status)}>{status}</span>
}
