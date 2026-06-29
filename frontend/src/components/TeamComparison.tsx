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

  const rows: { label: string; a: string | number; b: string | number; winner?: 'a' | 'b' | null }[] = [
    { label: '世界排名', a: rankA ? `#${rankA}` : '—', b: rankB ? `#${rankB}` : '—', winner: rankA && rankB ? (rankA < rankB ? 'a' : rankA > rankB ? 'b' : null) : null },
    { label: '胜场', a: sa?.wins ?? 0, b: sb?.wins ?? 0, winner: (sa?.wins ?? 0) !== (sb?.wins ?? 0) ? ((sa?.wins ?? 0) > (sb?.wins ?? 0) ? 'a' : 'b') : null },
    { label: '负场', a: sa?.losses ?? 0, b: sb?.losses ?? 0, winner: (sa?.losses ?? 0) !== (sb?.losses ?? 0) ? ((sa?.losses ?? 0) < (sb?.losses ?? 0) ? 'a' : 'b') : null },
    { label: '胜率', a: winRateA, b: winRateB, winner: winRateA !== winRateB ? (parseFloat(winRateA) > parseFloat(winRateB) ? 'a' : 'b') : null },
    { label: '连胜', a: streakA, b: streakB, winner: streakA !== streakB ? (streakA > streakB ? 'a' : 'b') : null },
    { label: '阵容人数', a: teamA.roster?.length ?? 0, b: teamB.roster?.length ?? 0, winner: null },
    { label: '奖杯数', a: (teamA.achievements ?? []).reduce((s, a) => s + a.count, 0), b: (teamB.achievements ?? []).reduce((s, b) => s + b.count, 0), winner: null },
  ]

  return (
    <>
      {/* Profile headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{pa.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{pa.country || '—'}</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>VS</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{pb.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{pb.country || '—'}</div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-5)' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)', background: i % 2 ? 'var(--bg-tertiary)' : 'transparent', borderRadius: 'var(--radius-sm)', alignItems: 'center' }}>
            <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: r.winner === 'a' ? 'var(--accent-green)' : 'var(--text-primary)' }}>{r.a}</span>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5 }}>{r.label}</span>
            <span style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: r.winner === 'b' ? 'var(--accent-green)' : 'var(--text-primary)' }}>{r.b}</span>
          </div>
        ))}
      </div>

      {/* Head-to-head */}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--accent-red)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-default)' }}>
        交手记录
      </div>
      {!headToHead || headToHead.totalMatches === 0 ? (
        <EmptyState message="No matches found between these teams" />
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
    </>
  )
}
