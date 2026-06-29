import EmptyState from '../components/EmptyState'

export default function Homepage() {
  return (
    <div className="animate-in">
      <h1 style={{ fontSize: 28, marginBottom: 'var(--space-4)' }}>今日精选</h1>
      <EmptyState message="首页内容将在 Phase 3 填充" />
    </div>
  )
}
