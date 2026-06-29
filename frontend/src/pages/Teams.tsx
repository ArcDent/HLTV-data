import { useState } from 'react'
import SearchableList from '../components/SearchableList'
import TeamComparison from '../components/TeamComparison'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'

export default function Teams() {
  const [compareMode, setCompareMode] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const [compareA, setCompareA] = useState<number | null>(null)

  const togglePick = (id: number) => {
    setPicked(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 24, flex: 1 }}>队伍</h1>
        <button
          className={`button${compareMode ? ' primary' : ''}`}
          onClick={() => { setCompareMode(v => !v); setPicked([]) }}
        >
          {compareMode ? '退出对比' : '队伍对比'}
        </button>
        {compareMode && picked.length === 2 && (
          <button className="button primary" onClick={() => setCompareA(picked[0])}>
            对比 →
          </button>
        )}
      </div>

      {compareMode && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>对比模式：点击两支队伍选中（已选 {picked.length}/2）</span>
          {picked.length > 0 && (
            <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {picked.map(id => (
                <span key={id} className="badge" style={{ background: 'rgba(255,70,85,0.15)', color: 'var(--accent-red)', cursor: 'pointer' }} onClick={() => togglePick(id)}>
                  ID {id} ✕
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      <SearchableList
        type="team"
        placeholder="搜索队伍 — 支持英文 / 中文 / 别名（如 Spirit、绿龙、小蜜蜂）"
        emptyHint="输入队名开始搜索"
        apiSearch={q => api.search(q, 'team')}
      />

      {compareMode && (
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 'var(--space-3)' }}>已选队伍</h3>
          {picked.length < 2 ? (
            <EmptyState message={`请再选 ${2 - picked.length} 支队伍`} />
          ) : (
            <button className="button primary" onClick={() => setCompareA(picked[0])}>
              对比 #{picked[0]} vs #{picked[1]}
            </button>
          )}
        </div>
      )}

      {compareA !== null && picked.length === 2 && (
        <TeamComparison
          teamAId={picked[0]}
          teamBId={picked[1]}
          onClose={() => { setCompareA(null); setPicked([]); setCompareMode(false) }}
        />
      )}
    </div>
  )
}
