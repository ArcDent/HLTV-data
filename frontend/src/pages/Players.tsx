import SearchableList from '../components/SearchableList'
import { api } from '../api/client'

export default function Players() {
  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 24, flex: 1 }}>选手</h1>
      </div>

      <SearchableList
        type="player"
        placeholder="搜索选手 — 如 ZywOo、载物、s1mple"
        emptyHint="输入选手名开始搜索"
        apiSearch={q => api.search(q, 'player')}
      />
    </div>
  )
}
