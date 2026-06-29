interface EmptyStateProps {
  message?: string
}

export default function EmptyState({ message = '暂无数据' }: EmptyStateProps) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
      {message}
    </div>
  )
}
