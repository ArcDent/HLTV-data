import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

type BadgeVariant = 'live' | 'win' | 'loss' | undefined

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

export default function Badge({ children, variant, className }: BadgeProps) {
  return <span className={cn('badge', variant, className)}>{children}</span>
}
