import { useCallback, useEffect, useState } from 'react'
import Modal from './Modal'
import PlayerDetail from './PlayerDetail'
import TeamComparison from './TeamComparison'
import useNicknames from '../hooks/useNicknames'
import { useSSE } from '../hooks/useSSE'
import { api } from '../api/client'
import EmptyState from './EmptyState'
import TeamLogo from './TeamLogo'

type TeamData = {
  profile: { id: number; name: string; slug: string; country?: string; region?: string; logo?: string }
  ranking: { world_rank: number; points: number }
  stats: { wins: number; losses: number; draws: number; win_rate: string; recent_form: string }
  achievements?: { label: string; count: number; tier: string }[]
  roster?: { id: number; name: string; slug: string; rating: number; country?: string }[]
  recent_matches?: { team1?: string; team2?: string; opponent?: string; score?: string; result: string; event?: string; played_at?: string; scheduled_at?: string; map_text?: string; best_of?: string }[]
  highlights?: { win_rate: string; win_streak: number; recent_matches?: { opponent: string; result: string }[] }
}

export default function TeamDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const { teamNicknames, playerNicknames, saveTeamNickname, savePlayerNickname } = useNicknames()
  const [editingTeamNick, setEditingTeamNick] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null)

  const fetchTeam = useCallback(() => {
    setLoading(true)
    api.getTeam(id).then((d: any) => {
      setData(d.data ?? null); setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  useEffect(() => { fetchTeam() }, [fetchTeam])

  useSSE('team', (evt) => {
    if (evt.id === id) { fetchTeam() }
  })

  const p = data?.profile
  const rank = data?.ranking
  const stats = data?.stats
  const achievements = data?.achievements ?? []
  const roster = data?.roster ?? []
  const matches = data?.recent_matches ?? []
  const hl = data?.highlights

  const cnName = teamNicknames[p?.name ?? '']
  const recentForm = hl?.recent_matches ?? matches.slice(0, 5).map(m => ({ opponent: m.opponent || m.team2 || '', result: m.result }))
  const streak = hl?.win_streak ?? 0

  return (
    <Modal onClose={onClose} width={840} maxHeight="90vh">
      {loading && <div className="spinner" />}
      {!loading && !p && <EmptyState message="详情暂时不可用" />}

      {!loading && p && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <TeamLogo src={p.logo} name={p.name} size={60} radius="var(--radius-lg)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {p.country || '—'}{roster.length > 0 ? ` · 队员 ${roster.length} 人` : ''}{p.region ? ` · ${p.region}` : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
                {p.country && <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{p.country}</span>}
                {editingTeamNick ? (
                  <input
                    autoFocus
                    className="input"
                    defaultValue={cnName}
                    style={{ padding: '2px var(--space-2)', fontSize: 11, width: 80 }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { saveTeamNickname(p?.name ?? '', (e.target as HTMLInputElement).value); setEditingTeamNick(false) }
                      if (e.key === 'Escape') setEditingTeamNick(false)
                    }}
                    onBlur={e => { saveTeamNickname(p?.name ?? '', e.target.value); setEditingTeamNick(false) }}
                  />
                ) : (
                  <span onClick={() => setEditingTeamNick(true)} className="badge" style={{ background: 'rgba(255,70,85,0.15)', color: 'var(--accent-red)', cursor: 'pointer' }} title="点击编辑简称">
                    {cnName || '无简称'}
                  </span>
                )}
              </div>
            </div>
            {rank && rank.world_rank > 0 && (
              <span className="badge" style={{
                alignSelf: 'flex-start',
                background: 'linear-gradient(135deg, #f0c040, #c48a0a)',
                color: '#1a1d29', fontSize: 14, fontWeight: 700, padding: 'var(--space-2) var(--space-4)',
              }}>
                🏆 World #{rank.world_rank}
              </span>
            )}
          </div>

          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <div className="card stat-card">
              <div className="label">胜</div>
              <div className="value" style={{ fontSize: 28, color: 'var(--accent-green)' }}>{stats?.wins ?? 0}</div>
            </div>
            <div className="card stat-card">
              <div className="label">负</div>
              <div className="value" style={{ fontSize: 28, color: 'var(--accent-red)' }}>{stats?.losses ?? 0}</div>
            </div>
            <div className="card stat-card">
              <div className="label">胜率</div>
              <div className="value" style={{ fontSize: 28 }}>{hl?.win_rate || stats?.win_rate || '—'}</div>
            </div>
            <div className="card stat-card">
              <div className="label">连胜</div>
              <div className="value" style={{ fontSize: 28, color: 'var(--accent-red)' }}>
                {streak > 0 ? `${streak} 🔥` : '—'}
              </div>
            </div>
          </div>

          {/* Form strip (last 5) */}
          {recentForm.length > 0 && (
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 'var(--space-2)' }}>近期状态</div>
              <div className="form-strip">
                {recentForm.slice(0, 5).map((m: any, i: number) => {
                  const won = m.result === 'won' || m.result === 'win'
                  return (
                    <div key={i} className={`dot ${won ? 'w' : 'l'}`}>
                      {won ? 'W' : 'L'}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Achievements */}
          {achievements.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 'var(--space-5)' }}>
              {achievements.map((a, i) => (
                <span key={i} className="badge" style={{
                  fontWeight: a.tier === 'major' ? 600 : 500, display: 'flex', alignItems: 'center', gap: 3,
                  background: a.tier === 'major' ? 'linear-gradient(135deg, rgba(240,192,64,0.15), rgba(255,70,85,0.1))' : 'rgba(255,70,85,0.06)',
                  color: a.tier === 'major' ? '#f0c040' : 'var(--accent-red)',
                }}>
                  {a.tier === 'major' ? '🏆 ' : ''}{a.label} <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, opacity: 0.8 }}>{a.count}×</span>
                </span>
              ))}
            </div>
          )}

          {/* Two columns: recent matches + roster */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
            {/* Left: Recent matches */}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--accent-red)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between' }}>
                近期战绩
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 0 }}>{recentForm.length} 场</span>
              </div>
              {recentForm.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-5) 0' }}>暂无数据</div>}
              {(hl?.recent_matches || matches).map((m: any, i: number) => {
                const allMatches = hl?.recent_matches || matches
                const won = m.result === 'won' || m.result === 'win'
                const lost = m.result === 'lost' || m.result === 'loss'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: i < allMatches.length - 1 ? '1px solid var(--border-default)' : 'none', fontSize: 12 }}>
                    <span className={`badge ${won ? 'win' : lost ? 'loss' : ''}`} style={{ minWidth: 26 }}>
                      {won ? 'W' : lost ? 'L' : '—'}
                    </span>
                    <span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{p.name}</b><span style={{ margin: '0 var(--space-2)', color: 'var(--text-tertiary)' }}>vs</span><span style={{ fontWeight: 600 }}>{m.opponent || m.team2 || '待定'}</span></span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.event || ''}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 48, textAlign: 'right' }}>{(m.played_at || m.scheduled_at || '').slice(5, 10)}</span>
                  </div>
                )
              })}
            </div>

            {/* Right: Roster */}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--accent-red)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between' }}>
                队员阵容
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', textTransform: 'none', letterSpacing: 0 }}>{roster.length} 人</span>
              </div>
              {roster.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--space-5) 0' }}>暂无数据</div>}
              {roster.map((pl, i) => (
                <div
                  key={i}
                  onClick={() => pl.id > 0 && setSelectedPlayerId(pl.id)}
                  className="card hoverable"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-1)', marginBottom: 'var(--space-1)',
                    fontSize: 13, cursor: pl.id > 0 ? 'pointer' : 'default', border: '1px solid var(--border-default)',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', minWidth: 18 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontWeight: 600, flex: 1 }}>
                    {pl.name}
                    {editingPlayerId === pl.id ? (
                      <input
                        autoFocus
                        className="input"
                        defaultValue={playerNicknames[pl.name] ?? ''}
                        style={{ fontSize: 11, padding: '1px var(--space-1)', width: 60, marginLeft: 'var(--space-1)' }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { savePlayerNickname(pl.name, (e.target as HTMLInputElement).value); setEditingPlayerId(null) }
                          if (e.key === 'Escape') setEditingPlayerId(null)
                        }}
                        onBlur={e => { savePlayerNickname(pl.name, e.target.value); setEditingPlayerId(null) }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : playerNicknames[pl.name] ? (
                      <span onClick={e => { e.stopPropagation(); setEditingPlayerId(pl.id) }} style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'var(--space-1)', fontWeight: 400, cursor: 'pointer' }} title="点击编辑简称">
                        {playerNicknames[pl.name]}
                      </span>
                    ) : (
                      <span onClick={e => { e.stopPropagation(); setEditingPlayerId(pl.id) }} style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'var(--space-1)', fontWeight: 400 }} title="添加简称">+ 添加简称</span>
                    )}
                  </span>
                  {pl.rating > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)' }}>Rating {pl.rating.toFixed(2)}</span>}
                  {pl.id > 0 && <span style={{ fontSize: 10, color: 'var(--accent-red)', opacity: 0.5 }}>→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Compare button */}
          <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
            <button className="button primary" onClick={() => setShowCompare(true)}>
              对比其他队伍
            </button>
          </div>

          <div style={{ marginTop: 'var(--space-3)', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>点击队员可查看选手详情 · ESC 关闭</div>
        </>
      )}

      {selectedPlayerId !== null && <PlayerDetail id={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} />}
      {showCompare && p && (
        <TeamSelectionModal teamAId={p.id} onClose={() => setShowCompare(false)} />
      )}
    </Modal>
  )
}

/** Modal with a team-B picker that then opens TeamComparison. */
function TeamSelectionModal({ teamAId, onClose }: { teamAId: number; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)

  const search = async () => {
    if (!q.trim()) return
    setLoading(true)
    try {
      const r = await api.search(q, 'team')
      setList(r?.items ?? [])
    } catch { setList([]) }
    setLoading(false)
  }

  return (
    <Modal onClose={onClose} width={480}>
      <h3 style={{ fontSize: 18, marginBottom: 'var(--space-3)' }}>选择对比队伍</h3>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <input
          className="input"
          placeholder="输入队名搜索"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          style={{ flex: 1 }}
        />
        <button className="button primary" onClick={search} disabled={loading}>
          {loading ? '...' : '搜索'}
        </button>
      </div>
      {list.length === 0 && <EmptyState message="输入队名搜索后选择对手" />}
      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {list.map((item, i) => (
            <div
              key={i}
              className={`card hoverable${pickedId === item.id ? ' ' : ''}`}
              onClick={() => setPickedId(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer',
                borderColor: pickedId === item.id ? 'var(--accent-red)' : 'var(--border-default)',
              }}
            >
              <span style={{ flex: 1, fontWeight: 600 }}>{item.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>ID {item.id}</span>
            </div>
          ))}
        </div>
      )}
      {pickedId !== null && (
        <TeamComparison
          teamAId={teamAId}
          teamBId={pickedId}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}
