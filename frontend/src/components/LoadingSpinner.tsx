import { cn } from '../utils/cn'

interface LoadingSpinnerProps {
  className?: string
}

export default function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return <div className={cn('spinner', className)} />
}
