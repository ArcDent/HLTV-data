import { useCallback, useEffect, useState } from 'react'
import Modal from './Modal'
import { api } from '../api/client'
import EmptyState from './EmptyState'

type TeamDetail = {
  profile: { id: number; name: string; slug: string; country: string }
  ranking: { world_rank: number; points: number }
  stats: { wins: number; losses: number; draws: number; win_rate: string; recent_form: string }
  achievements?: { label: string; count: number; tier: string }[]
  roster?: { id: number; name: string; slug: string; rating: number; country?: string }[]
  recent_matches?: { team1?: string; team2?: string; opponent?: string; score?: string; result: string; event?: string; played_at?: string; scheduled_at?: string; map_text?: string; best_of?: string }[]
  highlights?: { win_rate: string; win_streak: number; recent_matches?: { opponent: string; result: string }[] }
}

type HeadToHead = {
  totalMatches: number
  winsA: number
  winsB: number
  recentResults: boolean[]
}

type TeamComparisonData = {
  teamA: TeamDetail
  teamB: TeamDetail
  headToHead?: HeadToHead
}

interface Props {
  teamAId: number
  teamBId: number
  onClose: () => void
}

export default function TeamComparison({ teamAId, teamBId, onClose }: Props) {
  const [data, setData] = useState<TeamComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchComparison = useCallback(() => {
    setLoading(true)
    api.compareTeams(teamAId, teamBId).then((d: any) => {
      setData(d?.data ?? d ?? null)
      setLoading(false)
    }).catch((e) => { setError(String(e)); setLoading(false) })
  }, [teamAId, teamBId])

  useEffect(() => { fetchComparison() }, [fetchComparison])

  return (
    <Modal onClose={onClose} width={920} maxHeight="90vh" fullscreen>
      <h2 style={{ fontSize: 20, marginBottom: 'var(--space-4)', textAlign: 'center' }}>队伍对比</h2>

      {loading && <div className="spinner" />}
      {!loading && error && <EmptyState message={`对比数据不可用：${error}`} />}

      {!loading && data && (
        <ComparisonBody data={data} />
      )}
    </Modal>
  )
}

function ComparisonBody({ data }: { data: TeamComparisonData }) {
  const { teamA, teamB, headToHead } = data
  const pa = teamA.profile
  const pb = teamB.profile
  const sa = teamA.stats
  const sb = teamB.stats
  const ha = teamA.highlights
  const hb = teamB.highlights

  const winRateA = ha?.win_rate || sa?.win_rate || '—'
  const winRateB = hb?.win_rate || sb?.win_rate || '—'
  const streakA = ha?.win_streak ?? 0
  const streakB = hb?.win_streak ?? 0
  const rankA = teamA.ranking?.world_rank ?? 0
  const rankB = teamB.ranking?.world_rank ?? 0
  const trophiesA = (teamA.achievements ?? []).reduce((s, a) => s + a.count, 0)
  const trophiesB = (teamB.achievements ?? []).reduce((s, b) => s + b.count, 0)
  const rosterA = teamA.roster?.length ?? 0
  const rosterB = teamB.roster?.length ?? 0

  const [showB, setShowB] = useState(false)

  // Per-metric comparison rows (A vs B); winner highlighted green
  const rows: { label: string; a: string | number; b: string | number; winner?: 'a' | 'b' | null }[] = [
    { label: '世界排名', a: rankA ? `#${rankA}` : '—', b: rankB ? `#${rankB}` : '—', winner: rankA && rankB ? (rankA < rankB ? 'a' : rankA > rankB ? 'b' : null) : null },
    { label: '胜场', a: sa?.wins ?? 0, b: sb?.wins ?? 0, winner: (sa?.wins ?? 0) !== (sb?.wins ?? 0) ? ((sa?.wins ?? 0) > (sb?.wins ?? 0) ? 'a' : 'b') : null },
    { label: '负场', a: sa?.losses ?? 0, b: sb?.losses ?? 0, winner: (sa?.losses ?? 0) !== (sb?.losses ?? 0) ? ((sa?.losses ?? 0) < (sb?.losses ?? 0) ? 'a' : 'b') : null },
    { label: '胜率', a: winRateA, b: winRateB, winner: winRateA !== winRateB ? (parseFloat(winRateA) > parseFloat(winRateB) ? 'a' : 'b') : null },
    { label: '连胜', a: streakA, b: streakB, winner: streakA !== streakB ? (streakA > streakB ? 'a' : 'b') : null },
    { label: '阵容人数', a: rosterA, b: rosterB, winner: rosterA !== rosterB ? (rosterA > rosterB ? 'a' : 'b') : null },
    { label: '奖杯数', a: trophiesA, b: trophiesB, winner: trophiesA !== trophiesB ? (trophiesA > trophiesB ? 'a' : 'b') : null },
  ]

  return (
    <>
      {/* A focus card (top, prominent, red-accented) */}
      <div className="card" style={{
        marginBottom: 'var(--space-5)',
        padding: 'var(--space-5)',
        background: 'linear-gradient(135deg, rgba(255,70,85,0.12), rgba(255,123,0,0.04))',
        border: '1px solid rgba(255,70,85,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--accent-red), var(--accent-orange))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: '#fff', fontWeight: 700, fontFamily: 'var(--font-display)', flexShrink: 0,
          }}>
            {pa.name.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{pa.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{pa.country || '—'}</div>
          </div>
          {rankA > 0 && (
            <span className="badge" style={{
              background: 'linear-gradient(135deg, #f0c040, #c48a0a)',
              color: '#1a1d29', fontSize: 16, fontWeight: 700, padding: 'var(--space-2) var(--space-4)',
            }}>
              🏆 World #{rankA}
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)' }}>
          <div className="card stat-card"><div className="label">胜场</div><div className="value" style={{ fontSize: 24, color: 'var(--accent-green)' }}>{sa?.wins ?? 0}</div></div>
          <div className="card stat-card"><div className="label">负场</div><div className="value" style={{ fontSize: 24, color: 'var(--accent-red)' }}>{sa?.losses ?? 0}</div></div>
          <div className="card stat-card"><div className="label">胜率</div><div className="value" style={{ fontSize: 24 }}>{winRateA}</div></div>
          <div className="card stat-card"><div className="label">连胜</div><div className="value" style={{ fontSize: 24, color: 'var(--accent-red)' }}>{streakA > 0 ? `${streakA} 🔥` : '—'}</div></div>
          <div className="card stat-card"><div className="label">阵容</div><div className="value" style={{ fontSize: 24 }}>{rosterA}</div></div>
          <div className="card stat-card"><div className="label">奖杯</div><div className="value" style={{ fontSize: 24, color: '#f0c040' }}>{trophiesA}</div></div>
        </div>
      </div>

      {/* Independent comparison result card (per-metric A vs B + H2H at bottom) */}
      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--accent-red)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-default)' }}>
          对比结果
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)', background: i % 2 ? 'var(--bg-tertiary)' : 'transparent', borderRadius: 'var(--radius-sm)', alignItems: 'center' }}>
              <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: r.winner === 'a' ? 'var(--accent-green)' : 'var(--text-primary)' }}>{r.a}</span>
              <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5 }}>{r.label}</span>
              <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: r.winner === 'b' ? 'var(--accent-green)' : 'var(--text-primary)' }}>{r.b}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span>{pa.name}</span>
          <span>vs</span>
          <span>{pb.name}</span>
        </div>

        {/* H2H section inside the comparison card */}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--accent-red)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 'var(--space-4)', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-default)' }}>
          交手记录
        </div>
        {!headToHead || headToHead.totalMatches === 0 ? (
          <EmptyState message="暂无交手记录" />
        ) : (
          <>
            <div style={{ display: 'flex', height: 32, borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
              <div style={{ flex: headToHead.winsA, background: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {headToHead.winsA > 0 && headToHead.winsA}
              </div>
              <div style={{ flex: headToHead.winsB, background: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {headToHead.winsB > 0 && headToHead.winsB}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
              <span>{pa.name} {headToHead.winsA} 胜</span>
              <span>共 {headToHead.totalMatches} 场</span>
              <span>{pb.name} {headToHead.winsB} 胜</span>
            </div>

            {/* Recent encounters timeline */}
            <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
              {headToHead.recentResults.slice(-10).map((aWon, i) => (
                <span key={i} className={`badge ${aWon ? 'win' : 'loss'}`}>
                  {aWon ? pa.name.charAt(0) : pb.name.charAt(0)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Expandable B team section (collapsed by default) */}
      <div style={{ textAlign: 'center' }}>
        <button className="button" onClick={() => setShowB(s => !s)}>
          {showB ? '收起 B 队伍详情' : '展开 B 队伍详情'}
        </button>
      </div>
      {showB && (
        <div className="card" style={{
          marginTop: 'var(--space-4)',
          padding: 'var(--space-5)',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-default)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, rgba(0,200,220,0.5), rgba(0,150,180,0.3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, color: '#fff', fontWeight: 700, fontFamily: 'var(--font-display)', flexShrink: 0,
            }}>
              {pb.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{pb.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{pb.country || '—'}</div>
            </div>
            {rankB > 0 && (
              <span className="badge" style={{
                background: 'linear-gradient(135deg, #f0c040, #c48a0a)',
                color: '#1a1d29', fontSize: 14, fontWeight: 700, padding: 'var(--space-2) var(--space-4)',
              }}>
                🏆 World #{rankB}
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)' }}>
            <div className="card stat-card"><div className="label">胜场</div><div className="value" style={{ fontSize: 22, color: 'var(--accent-green)' }}>{sb?.wins ?? 0}</div></div>
            <div className="card stat-card"><div className="label">负场</div><div className="value" style={{ fontSize: 22, color: 'var(--accent-red)' }}>{sb?.losses ?? 0}</div></div>
            <div className="card stat-card"><div className="label">胜率</div><div className="value" style={{ fontSize: 22 }}>{winRateB}</div></div>
            <div className="card stat-card"><div className="label">连胜</div><div className="value" style={{ fontSize: 22, color: 'var(--accent-red)' }}>{streakB > 0 ? `${streakB} 🔥` : '—'}</div></div>
            <div className="card stat-card"><div className="label">阵容</div><div className="value" style={{ fontSize: 22 }}>{rosterB}</div></div>
            <div className="card stat-card"><div className="label">奖杯</div><div className="value" style={{ fontSize: 22, color: '#f0c040' }}>{trophiesB}</div></div>
          </div>
        </div>
      )}
    </>
  )
}

