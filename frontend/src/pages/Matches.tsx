import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import useNicknames from '../hooks/useNicknames'
import { useSSE } from '../hooks/useSSE'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import TeamLogo from '../components/TeamLogo'

type Tab = 'today' | 'upcoming' | 'results'

const tabs: { key: Tab; label: string }[] = [
  { key: 'today',    label: '今日赛程' },
  { key: 'upcoming', label: '即将开始' },
  { key: 'results',  label: '近期赛果' },
]

export default function Matches() {
  const [tab, setTab] = useState<Tab>('today')
  const [events, setEvents] = useState<any[]>([])
  const [other, setOther] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const { teamNicknames: nicknames } = useNicknames()

  const fetchEvents = useCallback(() => {
    setLoading(true)
    setEvents([])
    setOther([])
    api.getEvents(tab, 150).then(d => {
      setEvents(d?.data?.events ?? [])
      setOther(d?.data?.other ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [tab])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  useSSE('matches', fetchEvents)

  const totalEvents = events.length + (other.length > 0 ? 1 : 0)

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`button${tab === t.key ? ' primary' : ''}`}
            style={{ borderBottom: tab === t.key ? '2px solid var(--accent-red)' : '2px solid transparent', borderRadius: 0, background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: tab === t.key ? 'var(--accent-red)' : 'transparent' }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {!loading && totalEvents > 0 && (
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{totalEvents} 个赛事</span>
        )}
      </div>

      {/* Event cards grid */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-3)' }}>
        {loading && <div className="spinner" style={{ gridColumn: '1 / -1' }} />}
        {!loading && totalEvents === 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <EmptyState message="暂无赛事数据" />
          </div>
        )}

        {events.map((ev, i) => {
          const matches = ev.matches ?? []
          const liveMatch = matches.find((m: any) => m.score || m.status === 'live' || m.live)
          const topMatch = liveMatch ?? matches[0]
          return (
            <div
              key={i}
              className="card hoverable"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedEvent(ev)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>
                  {ev.name}
                </span>
                {topMatch?.best_of && (
                  <span className="badge" style={{ background: 'rgba(255,70,85,0.15)', color: 'var(--accent-red)' }}>
                    {topMatch.best_of.toUpperCase()}
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 12, background: 'var(--bg-tertiary)' }}>
                  {ev.match_count ?? matches.length}
                </span>
              </div>
              <div style={{ marginTop: 'var(--space-2)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                {ev.date_start && ev.date_start.length === 10 ? ev.date_start.slice(5).replace('-', '/') : '?'}
                {ev.date_end && ev.date_start !== ev.date_end && ev.date_end.length === 10 ? ' ~ ' + ev.date_end.slice(5).replace('-', '/') : ''}
              </div>
              {topMatch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                  <TeamLogo src={topMatch.team1_logo} name={topMatch.team1} size={24} />
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{topMatch.team1 || '待定'}</span>
                  {topMatch.score ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent-red)' }}>{topMatch.score}</span>
                  ) : liveMatch ? (
                    <span className="badge live">● LIVE</span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent-red)' }}>{(topMatch.scheduled_at ?? '').slice(11, 16) || '—:—'}</span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'right' }}>{topMatch.team2 || '待定'}</span>
                  <TeamLogo src={topMatch.team2_logo} name={topMatch.team2} size={24} />
                </div>
              )}
            </div>
          )
        })}

        {/* Other bucket */}
        {other.length > 0 && (
          <div
            className="card hoverable"
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedEvent({ name: 'Other', date_start: '—', date_end: '—', match_count: other.length, matches: other })}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.03em', color: 'var(--text-secondary)' }}>Other</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 12, background: 'var(--bg-tertiary)' }}>{other.length}</span>
            </div>
            <div style={{ marginTop: 'var(--space-2)', fontSize: 12, color: 'var(--text-tertiary)' }}>未分配赛事</div>
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <Modal onClose={() => setSelectedEvent(null)} width={620}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
            {selectedEvent.name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-default)' }}>
            {selectedEvent.date_start || '?'} ~ {selectedEvent.date_end || '?'} · {selectedEvent.match_count} 场比赛
          </div>

          {(selectedEvent.matches || []).map((m: any, i: number) => {
            const c1 = nicknames[m.team1 ?? ''] ?? ''
            const c2 = nicknames[m.team2 ?? ''] ?? ''
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) 0', borderTop: i > 0 ? '1px solid var(--border-default)' : 'none', fontSize: 13 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>{m.team1 || '待定'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', height: 16 }}>{c1}</span>
                </div>
                {m.score ? (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, minWidth: 50, textAlign: 'center' }}>{m.score}</span>
                ) : (
                  (() => {
                    const t = m.scheduled_at
                    if (!t) return <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--accent-red)', minWidth: 50, textAlign: 'center' }}>—:—</span>
                    const parts = t.split(' ')
                    const datePart = parts.length > 1 ? parts[0] : ''
                    const timePart = parts.length > 1 ? parts[1] : t
                    return (
                      <div style={{ minWidth: 50, textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--accent-red)', lineHeight: 1 }}>
                          {timePart.length >= 5 ? timePart.slice(0, 5) : timePart}
                        </div>
                        {datePart && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {datePart.slice(5).replace('-', '/')}
                          </div>
                        )}
                      </div>
                    )
                  })()
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>{m.team2 || '待定'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', height: 16 }}>{c2}</span>
                </div>
                {m.best_of && <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{m.best_of.toUpperCase()}</span>}
              </div>
            )
          })}
        </Modal>
      )}
    </div>
  )
}
