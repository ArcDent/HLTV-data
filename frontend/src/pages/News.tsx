import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useSSE } from '../hooks/useSSE'
import { useTranslateConfig } from '../components/TranslateProvider'
import NewsDetail from '../components/NewsDetail'
import EmptyState from '../components/EmptyState'

type Tab = 'realtime' | 'archive'

const CACHE_KEY = 'hltv_translations'
const CACHE_TTL = 7 * 24 * 3600 * 1000

function loadCache(): Record<string, { zh: string; ts: number }> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') } catch { return {} }
}
function saveCache(c: Record<string, { zh: string; ts: number }>) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(c))
}
function hashTitle(t: string) {
  let h = 0; for (let i = 0; i < t.length; i++) { h = (h * 31 + t.charCodeAt(i)) >>> 0 }
  return h.toString(16)
}

function readTime(text?: string): number {
  if (!text) return 1
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export default function News() {
  const [tab, setTab] = useState<Tab>('realtime')
  const [data, setData] = useState<any>(null)
  const { cfg, saveCount } = useTranslateConfig()
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [translating, setTranslating] = useState<Set<string>>(new Set())
  const [selectedNewsUrl, setSelectedNewsUrl] = useState<string | null>(null)

  const fetchNews = useCallback(() => {
    setData(null)
    if (tab === 'realtime') api.realtimeNews().then(setData)
    else api.newsDigest({ limit: '30' }).then(setData)
  }, [tab])

  useEffect(() => { fetchNews() }, [fetchNews])

  useSSE('news', fetchNews)

  useEffect(() => {
    const items: any[] = data?.items ?? []
    if (!cfg?.configured || items.length === 0) return

    const cache = loadCache()
    const toTranslate: string[] = []
    const known: Record<string, string> = {}

    for (const item of items) {
      if (!item.title) continue
      const h = hashTitle(item.title)
      const cached = cache[h]
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        known[item.title] = cached.zh
      } else if (!translations[item.title]) {
        toTranslate.push(item.title)
      }
    }

    setTranslations(prev => ({ ...prev, ...known }))

    let active = 0; let idx = 0
    const run = async () => {
      while (idx < toTranslate.length && active < 3) {
        const title = toTranslate[idx++]
        active++
        setTranslating(prev => new Set(prev).add(title))
        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: title, type: 'title' }),
          })
          const body = await res.text()
          if (!res.ok) { console.error('translate API error', res.status, body); throw new Error(body) }
          const j = JSON.parse(body)
          const zh = j?.translated ?? ''
          if (zh) {
            cache[hashTitle(title)] = { zh, ts: Date.now() }
            saveCache(cache)
            setTranslations(prev => ({ ...prev, [title]: zh }))
          }
        } catch (e) { console.error('translate failed:', title, e) }
        active--
        setTranslating(prev => { const s = new Set(prev); s.delete(title); return s })
      }
    }
    run(); run(); run()
  }, [data, cfg?.configured, saveCount])

  const items: any[] = data?.items ?? []

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-4)', borderBottom: '1px solid var(--border-default)', paddingBottom: 0, alignItems: 'center' }}>
        {[{ key: 'realtime', label: '实时新闻' }, { key: 'archive', label: '归档新闻' }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className="button"
            style={{
              fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-display)',
              letterSpacing: '0.04em', textTransform: 'uppercase' as const,
              color: tab === t.key ? 'var(--accent-red)' : 'var(--text-secondary)',
              borderBottom: tab === t.key ? '2px solid var(--accent-red)' : '2px solid transparent',
              background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: tab === t.key ? 'var(--accent-red)' : 'transparent',
              paddingBottom: 'var(--space-2)', borderRadius: 0,
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
      </div>

      <div key={tab} style={{ animation: 'slideUp 0.3s ease both' }}>
        {items.length === 0 && (
          <EmptyState message={data ? '暂无新闻' : '加载中...'} />
        )}
        {items.length > 0 && (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
            {items.map((n, i) => {
              const zh = translations[n.title]
              const loading = translating.has(n.title)
              const mins = readTime(n.body_text ?? n.summary ?? n.title)
              return (
                <div
                  key={i}
                  className="card hoverable"
                  onClick={() => n.link && setSelectedNewsUrl(n.link)}
                  style={{ cursor: 'pointer', minHeight: 120, display: 'flex', flexDirection: 'column' }}
                >
                  <span className="badge" style={{ background: 'rgba(255,123,0,0.15)', color: 'var(--accent-orange)', alignSelf: 'flex-start', marginBottom: 'var(--space-2)' }}>
                    {n.category || '新闻'}
                  </span>
                  <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4, flex: 1 }}>{n.title}</div>
                  {cfg?.configured && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 'var(--space-2)', lineHeight: 1.5 }}>
                      {loading ? '翻译中...' : (zh || '')}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                    <span>{n.published_at ?? n.relative_time ?? ''}</span>
                    <span>{mins} min</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedNewsUrl && <NewsDetail url={selectedNewsUrl} onClose={() => setSelectedNewsUrl(null)} />}
    </div>
  )
}
