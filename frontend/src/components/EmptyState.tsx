import Card from './Card'

interface EmptyStateProps {
  message?: string
}

export default function EmptyState({ message = '暂无数据' }: EmptyStateProps) {
  return (
    <Card className="empty-state">
      <div className="empty-state-icon">📭</div>
      {message}
    </Card>
  )
}
