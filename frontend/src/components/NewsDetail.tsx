import { useEffect, useState } from 'react'
import Modal from './Modal'
import { api } from '../api/client'
import { useTranslateConfig } from './TranslateProvider'
import EmptyState from './EmptyState'

type ArticleData = {
  title: string; published_at: string; link: string; body_text: string; author?: string; category?: string
}

function readTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export default function NewsDetail({ url, onClose }: { url: string; onClose: () => void }) {
  const [data, setData] = useState<ArticleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [translating, setTranslating] = useState(false)
  const [translated, setTranslated] = useState('')
  const { cfg } = useTranslateConfig()

  useEffect(() => {
    setLoading(true)
    api.getNewsArticle(url).then(d => {
      setData(d.data ?? null); setLoading(false)
    }).catch(() => setLoading(false))
  }, [url])

  // Check localStorage for cached translation
  useEffect(() => {
    if (!data?.body_text) return
    try {
      let hash = 0; for (let i = 0; i < url.length; i++) { hash = (hash * 31 + url.charCodeAt(i)) >>> 0 }
      const key = `news_trans:${hash.toString(16)}`
      const cached = localStorage.getItem(key)
      if (cached) {
        const { zh } = JSON.parse(cached)
        setTranslated(zh)
      }
    } catch { /* ignore corrupt cache */ }
  }, [data, url])

  const doTranslate = async () => {
    if (!data?.body_text || !cfg?.configured) return
    setTranslating(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data.body_text.slice(0, 8000), type: 'article' }),
      })
      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(errBody)
      }
      const j = await res.json()
      const zh = j?.translated ?? ''
      if (zh) {
        setTranslated(zh)
        try {
          let hash = 0; for (let i = 0; i < url.length; i++) { hash = (hash * 31 + url.charCodeAt(i)) >>> 0 }
          localStorage.setItem(`news_trans:${hash.toString(16)}`, JSON.stringify({ zh, ts: Date.now() }))
        } catch { /* ignore storage errors */ }
      }
    } catch (e) { console.error('translate article failed:', e) }
    setTranslating(false)
  }

  const mins = data?.body_text ? readTime(data.body_text) : 1

  return (
    <Modal onClose={onClose} width={800} maxHeight="90vh">
      {loading && <div className="spinner" />}
      {!loading && !data && <EmptyState message="文章暂时不可用" />}

      {!loading && data && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <span className="badge" style={{ background: 'rgba(255,123,0,0.15)', color: 'var(--accent-orange)' }}>
              {data.category || '新闻'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{mins} min 阅读</span>
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, marginBottom: 'var(--space-2)' }}>{data.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-default)' }}>
            {data.published_at && <span>{data.published_at}</span>}
            {data.author && <span>· {data.author}</span>}
          </div>

          <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 'var(--space-5)' }}>
            {data.body_text}
          </div>

          {translated && (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--accent-red)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-default)' }}>
                中文翻译
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginBottom: 'var(--space-5)' }}>
                {translated}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-default)' }}>
            {cfg?.configured && !translated && (
              <button onClick={doTranslate} disabled={translating} className="button primary" style={{ opacity: translating ? 0.5 : 1, cursor: translating ? 'not-allowed' : 'pointer' }}>
                {translating ? '翻译中...' : '翻译正文'}
              </button>
            )}
            {data.link && (
              <a href={data.link.startsWith('/') ? `https://www.hltv.org${data.link}` : data.link} target="_blank" rel="noopener noreferrer" className="button">
                在 HLTV 阅读原文 →
              </a>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
