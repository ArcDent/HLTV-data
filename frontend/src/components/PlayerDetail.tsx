import { useCallback, useEffect, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import useNicknames from '../hooks/useNicknames'
import { useSSE } from '../hooks/useSSE'
import Modal from './Modal'
import { api } from '../api/client'
import EmptyState from './EmptyState'

type PlayerData = {
  profile: { id: number; name: string; real_name?: string; slug: string; country?: string; age?: number; team?: string }
  rating: { value: number; maps: number }
  abilities: { key: string; label_en: string; label_zh: string; value: number; max: number; format?: string }[]
  career: { matches?: number; win_rate?: string; kd?: number; headshot_pct?: string; win_streak?: number }
  summary?: { teams: number; days_in_team: number; days_in_teams: number; major_won: number; majors_played: number; lans_won: number; lans_played: number; major_trophies: number; notable_trophies: number; major_mvps: number; total_mvps: number; major_evps: number; total_evps: number }
  top20_ranks?: Record<string, number>
  honors?: { label: string; value: number }[]
  recent_matches?: { date: string; team: string; opponent: string; score: string; result: string; rating: number; kills: number; deaths: number; event: string }[]
}

type Ability = PlayerData['abilities'][number]

export default function PlayerDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData] = useState<PlayerData | null>(null)
  const [loading, setLoading] = useState(true)
  const { playerNicknames, savePlayerNickname } = useNicknames()
  const [editingNick, setEditingNick] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [compareAbilities, setCompareAbilities] = useState<Ability[] | null>(null)
  const [compareName, setCompareName] = useState<string>('')

  const fetchPlayer = useCallback(() => {
    setLoading(true)
    api.getPlayer(id).then((d: any) => {
      setData(d.data ?? null); setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchPlayer() }, [fetchPlayer])

  useSSE('player', (evt) => {
    if (evt.id === id) { fetchPlayer() }
  })

  const p = data?.profile
  const abilities = data?.abilities ?? []
  const top20 = data?.top20_ranks ? Object.entries(data.top20_ranks).sort((a, b) => Number(b[0]) - Number(a[0])) : []

  // Radar chart via Chart.js — supports an optional second dataset (player B, cyan)
  useEffect(() => {
    if (!canvasRef.current || abilities.length === 0) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    const aSliced = abilities.slice(0, 8)
    const labels = aSliced.map(ab => ab.label_en)

    const norm = (ab: Ability): number => {
      if (ab.format === 'decimal') return ab.value / 2 * 100
      return ab.max > 0 ? (ab.value / ab.max) * 100 : 0
    }
    const valuesA = aSliced.map(norm)

    const datasets: Chart['data']['datasets'] = [{
      label: p?.name ?? 'A',
      data: valuesA,
      backgroundColor: 'rgba(255,70,85,0.15)',
      borderColor: 'rgba(255,70,85,1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(255,70,85,1)',
      pointRadius: 3,
    }]

    if (compareAbilities) {
      // Align B's abilities to A's label_en; missing -> 0
      const bMap = new Map<string, Ability>()
      for (const ab of compareAbilities) bMap.set(ab.label_en, ab)
      const valuesB = aSliced.map(ab => {
        const matched = bMap.get(ab.label_en)
        return matched ? norm(matched) : 0
      })
      datasets.push({
        label: compareName || '选手 B',
        data: valuesB,
        backgroundColor: 'rgba(0,200,220,0.15)',
        borderColor: 'rgba(0,200,220,1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(0,200,220,1)',
        pointRadius: 3,
      })
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { display: false, stepSize: 20 },
            grid: { color: 'rgba(48,54,61,0.6)' },
            angleLines: { color: 'rgba(48,54,61,0.6)' },
            pointLabels: { color: '#8b949e', font: { size: 11 } },
          },
        },
        plugins: { legend: { display: compareAbilities != null } },
      },
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [abilities, compareAbilities, compareName, p?.name])

  return (
    <Modal onClose={onClose} width={580} maxHeight="90vh">
      {loading && <div className="spinner" />}
      {!loading && !p && <EmptyState message="详情暂时不可用" />}

      {!loading && p && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-red), var(--accent-orange))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, color: '#fff', fontWeight: 700, fontFamily: 'var(--font-display)', flexShrink: 0,
            }}>
              {p.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{p.real_name || '暂无'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)', alignItems: 'center' }}>
                {editingNick ? (
                  <input
                    autoFocus
                    className="input"
                    defaultValue={playerNicknames[p.name] ?? ''}
                    style={{ fontSize: 12, width: 100, padding: '2px var(--space-2)' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { savePlayerNickname(p.name, (e.target as HTMLInputElement).value); setEditingNick(false) }
                      if (e.key === 'Escape') setEditingNick(false)
                    }}
                    onBlur={e => { savePlayerNickname(p.name, e.target.value); setEditingNick(false) }}
                  />
                ) : (
                  playerNicknames[p.name] ? (
                    <span onClick={() => setEditingNick(true)} className="badge" style={{ background: 'rgba(255,70,85,0.15)', color: 'var(--accent-red)', cursor: 'pointer' }} title="点击编辑简称">
                      {playerNicknames[p.name]}
                    </span>
                  ) : (
                    <span onClick={() => setEditingNick(true)} style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.5 }} title="添加简称">+ 添加简称</span>
                  )
                )}
                {p.country && <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{p.country}</span>}
                {p.age && <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Age {p.age}</span>}
                <span className="badge" style={{ background: p.team ? 'rgba(255,70,85,0.15)' : 'var(--bg-tertiary)', color: p.team ? 'var(--accent-red)' : 'var(--text-tertiary)', fontWeight: p.team ? 600 : 400 }}>
                  {p.team || '暂无队伍'}
                </span>
              </div>
            </div>
          </div>

          {top20.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              {top20.map(([year, rank]) => (
                <span key={year} className="badge" style={{
                  background: rank === 1 ? 'transparent' : rank === 2 ? 'var(--bg-tertiary)' : 'rgba(255,70,85,0.12)',
                  color: rank === 1 ? '#f0c040' : rank === 2 ? '#8b949e' : 'var(--accent-red)',
                  border: rank === 1 ? '1px solid rgba(240, 192, 64, 0.4)' : 'none',
                }}>{year} #{rank}</span>
              ))}
            </div>
          )}

          {/* Rating 3.0 stat card */}
          {data.rating && (
            <div className="card stat-card" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="label">Rating 3.0</div>
              <div className="value">{data.rating.value.toFixed(2)}</div>
              <div className="sub">{data.rating.maps} maps</div>
            </div>
          )}

          {/* Compare button */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
            <button className="button primary" onClick={() => setShowCompare(true)}>
              对比其他选手
            </button>
            {compareAbilities && (
              <button
                className="button"
                style={{ marginLeft: 'var(--space-2)' }}
                onClick={() => { setCompareAbilities(null); setCompareName('') }}
              >
                清除对比 ({compareName})
              </button>
            )}
          </div>

          {/* Abilities + radar */}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--accent-red)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-default)' }}>
            能力评分 <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>近 3 月 · {data.rating.maps} maps</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-5)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div style={{ width: 220, height: 220 }}>
              <canvas ref={canvasRef} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 11, color: 'var(--text-secondary)' }}>
              {abilities.map(ab => (
                <div key={ab.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', opacity: ab.value === 0 && ab.format !== 'decimal' ? 0.4 : 1 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: ab.value > 0 || ab.format === 'decimal' ? 'var(--accent-red)' : 'var(--border-default)', flexShrink: 0 }} />
                  <span style={{ minWidth: 120 }}>{ab.label_en} ({ab.label_zh})</span>
                  <b style={{ color: ab.value > 0 || ab.format === 'decimal' ? 'var(--text-primary)' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {ab.format === 'decimal' ? ab.value.toFixed(2) : ab.value > 0 ? `${ab.value}/${ab.max}` : '—'}
                  </b>
                </div>
              ))}
            </div>
          </div>

          {/* Career summary */}
          {data.summary && (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--accent-red)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-default)' }}>
                生涯概览
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {data.summary.teams > 0 && <StatBadge label="效力战队" value={data.summary.teams} />}
                {data.summary.days_in_team > 0 && <StatBadge label="当前队天数" value={data.summary.days_in_team} />}
                {data.summary.days_in_teams > 0 && <StatBadge label="生涯总天数" value={data.summary.days_in_teams} />}
                {data.summary.major_won > 0 && <StatBadge label="Major 冠军" value={data.summary.major_won} gold />}
                {data.summary.majors_played > 0 && <StatBadge label="Major 参赛" value={data.summary.majors_played} />}
                {data.summary.lans_won > 0 && <StatBadge label="LAN 冠军" value={data.summary.lans_won} gold />}
                {data.summary.lans_played > 0 && <StatBadge label="LAN 参赛" value={data.summary.lans_played} />}
                {data.summary.major_trophies > 0 && <StatBadge label="Major 奖杯" value={data.summary.major_trophies} gold />}
                {data.summary.notable_trophies > 0 && <StatBadge label="知名奖杯" value={data.summary.notable_trophies} />}
                {data.summary.major_mvps > 0 && <StatBadge label="Major MVP" value={data.summary.major_mvps} gold />}
                {data.summary.total_mvps > 0 && <StatBadge label="总 MVP" value={data.summary.total_mvps} />}
                {data.summary.major_evps > 0 && <StatBadge label="Major EVP" value={data.summary.major_evps} />}
                {data.summary.total_evps > 0 && <StatBadge label="总 EVP" value={data.summary.total_evps} />}
              </div>
            </>
          )}

          {(data.career.matches ?? 0) > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <div className="card stat-card"><div className="label">比赛</div><div className="value" style={{ fontSize: 24 }}>{data.career.matches}</div></div>
              {data.career.win_rate && <div className="card stat-card"><div className="label">胜率</div><div className="value" style={{ fontSize: 24 }}>{data.career.win_rate}</div></div>}
              {(data.career.kd ?? 0) > 0 && <div className="card stat-card"><div className="label">K/D</div><div className="value" style={{ fontSize: 24 }}>{data.career.kd}</div></div>}
            </div>
          )}

          {/* Highlights chips */}
          {(data.career.headshot_pct || data.career.win_streak || (data.honors && data.honors.length > 0)) && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
              {data.honors && data.honors.map(h => (
                <span key={h.label} className="badge" style={{ background: 'rgba(255,70,85,0.08)', color: 'var(--accent-red)' }}>{h.label} {h.value}×</span>
              ))}
              {data.career.headshot_pct && <span className="badge" style={{ background: 'rgba(255,70,85,0.08)', color: 'var(--accent-red)' }}>爆头率 {data.career.headshot_pct}</span>}
              {(data.career.win_streak ?? 0) > 0 && <span className="badge win">{data.career.win_streak} 连胜</span>}
            </div>
          )}

          {/* Recent matches */}
          {data.recent_matches && data.recent_matches.length > 0 && (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--accent-red)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-default)' }}>近期比赛</div>
              {data.recent_matches!.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: i < data.recent_matches!.length - 1 ? '1px solid var(--border-default)' : 'none', fontSize: 12 }}>
                  <span className={`badge ${m.result === 'win' ? 'win' : m.result === 'loss' ? 'loss' : ''}`} style={{ minWidth: 24 }}>
                    {m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : '—'}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{m.team || '待定'}</span> <span style={{ color: 'var(--text-tertiary)' }}>vs</span> {m.opponent || '待定'}
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.event}</div>
                  </span>
                  {m.result !== 'scheduled' && m.score && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{m.score}</span>}
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 52, textAlign: 'right' }}>{m.date}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
      {showCompare && (
        <PlayerSelectionModal
          onPick={async (pid) => {
            try {
              const d = await api.getPlayer(pid)
              const ab: Ability[] = d?.data?.abilities ?? []
              setCompareAbilities(ab.slice(0, 8))
              setCompareName(d?.data?.profile?.name ?? '')
            } catch { /* ignore */ }
            setShowCompare(false)
          }}
          onClose={() => setShowCompare(false)}
        />
      )}
    </Modal>
  )
}

function StatBadge({ label, value, gold }: { label: string; value: number; gold?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', fontSize: 12,
      background: gold ? 'rgba(255,70,85,0.08)' : 'var(--bg-tertiary)',
      border: gold ? '1px solid rgba(255,70,85,0.2)' : '1px solid var(--border-default)',
    }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: gold ? 'var(--accent-red)' : 'var(--text-primary)' }}>{value.toLocaleString()}</span>
    </div>
  )
}

/** Modal with a player-B picker; calls onPick(id, name) once a player is selected. */
function PlayerSelectionModal({ onPick, onClose }: { onPick: (id: number) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const search = async () => {
    if (!q.trim()) return
    setLoading(true)
    try {
      const r = await api.search(q, 'player')
      setList(r?.items ?? [])
    } catch { setList([]) }
    setLoading(false)
  }

  return (
    <Modal onClose={onClose} width={480}>
      <h3 style={{ fontSize: 18, marginBottom: 'var(--space-3)' }}>选择对比选手</h3>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <input
          className="input"
          placeholder="输入选手名搜索"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          style={{ flex: 1 }}
        />
        <button className="button primary" onClick={search} disabled={loading}>
          {loading ? '...' : '搜索'}
        </button>
      </div>
      {list.length === 0 && <EmptyState message="输入选手名搜索后选择对手" />}
      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {list.map((item, i) => {
            // item.name format: "Nikola 'NiKo' Kovač" — nickname is the quoted
            // segment; real name is everything else. Fall back to the whole name
            // or the numeric id when the nickname can't be parsed.
            const m = item.name?.match(/'([^']+)'/)
            const nick = m ? m[1] : (item.name || `#${item.id}`)
            const real = (item.name || '').replace(/'[^']+'/g, '').replace(/\s+/g, ' ').trim()
            return (
              <div
                key={i}
                className="card hoverable"
                onClick={() => onPick(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}
              >
                <span style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{nick}</span>
                  {real && real !== nick && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>{real}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
