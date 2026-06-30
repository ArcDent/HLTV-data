import { useState, type ReactNode } from 'react'
import PlayerDetail from './PlayerDetail'
import TeamDetail from './TeamDetail'
import EmptyState from './EmptyState'
import useNicknames from '../hooks/useNicknames'

type Props = {
  type: 'team' | 'player'
  placeholder: string
  emptyHint: string
  apiSearch: (q: string) => Promise<any>
  /** Optional extra filter UI (e.g. region select) injected by the page. */
  extraFilters?: ReactNode
  /** Optional client-side filter applied to each result row. */
  rowFilter?: (item: any) => boolean
}

export default function SearchableList({ type, placeholder, emptyHint, apiSearch, extraFilters, rowFilter }: Props) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const { teamNicknames, playerNicknames } = useNicknames()

  const search = async () => {
    if (!q.trim()) return
    setLoading(true)
    try { const r = await apiSearch(q); setList(r?.items ?? []) } catch { setList([]) }
    setLoading(false)
  }

  const filtered = list ? (rowFilter ? list.filter(rowFilter) : list) : null

  return (
    <>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder={placeholder}
            value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            style={{ flex: 1, minWidth: 200, fontSize: 16, padding: 'var(--space-3) var(--space-4)' }}
          />
          <button onClick={search} disabled={loading} className={`button primary${loading ? '' : ''}`} style={{ opacity: loading ? 0.4 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '搜索中' : '搜索'}
          </button>
          {extraFilters}
        </div>

        {loading && <div className="spinner" />}
        {!loading && filtered === null && <EmptyState message={emptyHint} />}
        {!loading && filtered?.length === 0 && <EmptyState message="无匹配结果" />}
        {filtered && filtered.length > 0 && (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filtered.map((item, i) => (
              <div
                key={i}
                className="card hoverable"
                onClick={() => {
                  if (type === 'player' && item.id) setSelectedId(item.id)
                  if (type === 'team' && item.id) setSelectedTeamId(item.id)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', cursor: (type === 'player' || type === 'team') ? 'pointer' : 'default' }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--accent-red)', minWidth: 28 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ flex: 1, fontSize: 17, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>
                  {item.name}
                  {(playerNicknames[item.name] || teamNicknames[item.name]) && (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8, fontWeight: 400 }}>
                      {playerNicknames[item.name] || teamNicknames[item.name]}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', fontFamily: 'var(--font-mono)' }}>
                  ID {item.id ?? '—'}
                </span>
                {item.slug && <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{item.slug}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {type === 'player' && selectedId !== null && <PlayerDetail id={selectedId} onClose={() => setSelectedId(null)} />}
      {type === 'team' && selectedTeamId !== null && <TeamDetail id={selectedTeamId} onClose={() => setSelectedTeamId(null)} />}
    </>
  )
}
