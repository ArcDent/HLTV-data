import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

interface StatCardProps {
  label: string
  value: ReactNode
  sub?: string
  className?: string
}

export default function StatCard({ label, value, sub, className }: StatCardProps) {
  return (
    <div className={cn('stat-card', className)}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}
