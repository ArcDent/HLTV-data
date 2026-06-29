import EmptyState from '../components/EmptyState'

export default function Settings() {
  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 'var(--space-4)' }}>设置</h2>
      <EmptyState message="设置面板将在 Phase 3 填充（缓存 / 主题 / 翻译 / 状态）" />
    </div>
  )
}
