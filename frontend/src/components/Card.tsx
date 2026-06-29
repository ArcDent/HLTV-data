import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

interface CardProps {
  children: ReactNode
  /** Enable hover lift + accent border. */
  hover?: boolean
  className?: string
  onClick?: () => void
}

export default function Card({ children, hover, className, onClick }: CardProps) {
  return (
    <div
      className={cn('card', hover && 'hoverable', className)}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {children}
    </div>
  )
}
