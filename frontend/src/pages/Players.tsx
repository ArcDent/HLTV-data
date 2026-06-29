import { useState } from 'react'
import SearchableList from '../components/SearchableList'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'

const REGIONS = [
  { value: '', label: '全部地区' },
  { value: 'Europe', label: '欧洲' },
  { value: 'CIS', label: '独联体' },
  { value: 'North America', label: '北美' },
  { value: 'South America', label: '南美' },
  { value: 'Asia', label: '亚洲' },
  { value: 'Oceania', label: '大洋洲' },
  { value: 'Africa', label: '非洲' },
]

export default function Players() {
  const [region, setRegion] = useState('')

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 24, flex: 1 }}>选手</h1>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 16, marginBottom: 'var(--space-3)' }}>HLTV Top 20 选手榜</h3>
        <EmptyState message="Top 20 暂未提供" />
      </div>

      <SearchableList
        type="player"
        placeholder="搜索选手 — 如 ZywOo、载物、s1mple"
        emptyHint="输入选手名开始搜索"
        apiSearch={q => api.search(q, 'player')}
        extraFilters={
          <select
            className="input"
            value={region}
            onChange={e => setRegion(e.target.value)}
            style={{ minWidth: 140 }}
          >
            {REGIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        }
        rowFilter={item => !region || item.country === region || item.region === region}
      />
    </div>
  )
}
