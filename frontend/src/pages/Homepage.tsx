import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import NewsDetail from '../components/NewsDetail'

type Ranking = { rank: number; teamId: number; name: string; country?: string; points?: string }

const LAST_KEY = 'hltv:rankings:last'

function loadLastRankings(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    if (!raw) return {}
    const arr = JSON.parse(raw) as { name: string; rank: number }[]
    const map: Record<string, number> = {}
    for (const r of arr) map[r.name] = r.rank
    return map
  } catch { return {} }
}

function saveLastRankings(list: Ranking[]) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(list.map(r => ({ name: r.name, rank: r.rank }))))
  } catch { /* ignore storage errors */ }
}

function fmtTime(s?: string): string {
  if (!s) return ''
  const parts = s.split(' ')
  if (parts.length < 2) return s
  const date = parts[0].slice(5).replace('-', '/')
  const time = parts[1].slice(0, 5)
  return `${date} ${time}`
}

export default function Homepage() {
  const [events, setEvents] = useState<any[] | null>(null)
  const [news, setNews] = useState<any[] | null>(null)
  const [rankings, setRankings] = useState<Ranking[] | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [selectedNews, setSelectedNews] = useState<{ url: string } | null>(null)

  const fetchAll = useCallback(() => {
    api.getEvents('today', 3).then(d => {
      const ev = d?.data?.events ?? []
      const other = d?.data?.other ?? []
      const matches = ev.flatMap((e: any) => e.matches ?? []).slice(0, 3)
      // If not enough from events, pad from other
      if (matches.length < 3 && other.length > 0) {
        const otherMatches = other.flatMap((o: any) => o.matches ?? [])
        for (const m of otherMatches) { if (matches.length >= 3) break; matches.push(m) }
      }
      setEvents(matches.slice(0, 3))
    }).catch(() => setEvents([]))
    api.realtimeNews(3).then(d => setNews(d?.items ?? [])).catch(() => setNews([]))
    api.getRankings().then(d => {
      const list: Ranking[] = d?.data ?? []
      setRankings(list.slice(0, 5))
      if (list.length > 0) saveLastRankings(list)
    }).catch(() => setRankings([]))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const liveCount = (events ?? []).filter((m: any) => m && (m.score || m.status === 'live' || m.live)).length
  const matchesToday = (events ?? []).length
  const newsCount = (news ?? []).length

  const movers = (rankings ?? []).map(r => {
    const last = loadLastRankings()[r.name]
    const change = last && last !== r.rank ? last - r.rank : 0 // positive = moved up
    return { ...r, change }
  })

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <h1 style={{ fontSize: 24 }}>今日精选</h1>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
        <div className="card stat-card">
          <div className="label">今日赛程</div>
          <div className="value">{matchesToday}</div>
        </div>
        <div className="card stat-card">
          <div className="label">进行中</div>
          <div className="value">{liveCount}</div>
        </div>
        <div className="card stat-card">
          <div className="label">热门新闻</div>
          <div className="value">{newsCount}</div>
        </div>
      </div>

      {/* Featured matches */}
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 'var(--space-3)' }}>今日焦点赛事</h2>
        {events === null ? (
          <div className="spinner" />
        ) : events.length === 0 ? (
          <EmptyState message="今日暂无赛事" />
        ) : (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
            {events.map((m: any, i: number) => {
              const isLive = m.score || m.status === 'live' || m.live
              return (
                <div
                  key={i}
                  className="card hoverable"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedEvent(m)}
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', letterSpacing: 0.5 }}>
                    {m.event || m.event_name || '—'}{m.best_of ? ` · ${m.best_of.toUpperCase()}` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{m.team1 || '待定'}</span>
                    {isLive ? (
                      <span className="badge live">● LIVE</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent-red)' }}>
                        {fmtTime(m.scheduled_at) || '—:—'}
                      </span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{m.team2 || '待定'}</span>
                  </div>
                  {m.score && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent-red)', textAlign: 'center' }}>
                      {m.score}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Two-column: hot news + ranking movers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 'var(--space-3)' }}>热门新闻</h2>
          {news === null ? (
            <div className="spinner" />
          ) : news.length === 0 ? (
            <EmptyState message="暂无新闻" />
          ) : (
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {news.map((n: any, i: number) => (
                <div
                  key={i}
                  className="card hoverable"
                  style={{ cursor: n.link ? 'pointer' : 'default', minHeight: 80, display: 'flex', flexDirection: 'column' }}
                  onClick={() => n.link && setSelectedNews({ url: n.link })}
                >
                  <span className="badge" style={{ background: 'rgba(255,123,0,0.15)', color: 'var(--accent-orange)', alignSelf: 'flex-start', marginBottom: 'var(--space-2)' }}>
                    {n.category || '新闻'}
                  </span>
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, flex: 1 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>{n.published_at ?? n.relative_time ?? ''}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 'var(--space-3)' }}>排名变动 Top 5</h2>
          {rankings === null ? (
            <div className="spinner" />
          ) : rankings.length === 0 ? (
            <EmptyState message="暂无排名数据" />
          ) : (
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {movers.map((r, i) => (
                <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, minWidth: 28 }}>#{r.rank}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 20 }}>{r.country || '—'}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{r.name}</span>
                  {r.change !== 0 ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: r.change > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {r.change > 0 ? `↑ ${r.change}` : `↓ ${Math.abs(r.change)}`}
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedEvent && (
        <Modal onClose={() => setSelectedEvent(null)} width={580}>
          <h3 style={{ fontSize: 18, marginBottom: 'var(--space-3)' }}>{selectedEvent.event || selectedEvent.event_name || selectedEvent.name || '比赛详情'}</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 16, marginBottom: 'var(--space-3)' }}>
            <span style={{ fontWeight: 600 }}>{selectedEvent.team1 || '待定'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent-red)' }}>{selectedEvent.score || fmtTime(selectedEvent.scheduled_at) || '—:—'}</span>
            <span style={{ fontWeight: 600 }}>{selectedEvent.team2 || '待定'}</span>
          </div>
          {selectedEvent.best_of && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedEvent.best_of.toUpperCase()}</div>}
        </Modal>
      )}

      {selectedNews && <NewsDetail url={selectedNews.url} onClose={() => setSelectedNews(null)} />}
    </div>
  )
}
