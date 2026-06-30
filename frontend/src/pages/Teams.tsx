import SearchableList from '../components/SearchableList'
import { api } from '../api/client'

export default function Teams() {
  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 24, flex: 1 }}>队伍</h1>
      </div>

      <SearchableList
        type="team"
        placeholder="搜索队伍 — 支持英文 / 中文 / 别名（如 Spirit、绿龙、小蜜蜂）"
        emptyHint="输入队名开始搜索"
        apiSearch={q => api.search(q, 'team')}
      />
    </div>
  )
}
