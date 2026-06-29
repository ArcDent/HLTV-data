import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useTranslateConfig } from '../components/TranslateProvider'

const PRESETS = [
  { label: 'OpenAI',      url: 'https://api.openai.com/v1',      model: 'gpt-4o-mini' },
  { label: 'DeepSeek',    url: 'https://api.deepseek.com/v1',    model: 'deepseek-chat' },
  { label: 'Groq',        url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { label: 'Ollama 本地', url: 'http://localhost:11434/v1',      model: 'qwen2.5:7b' },
]

const THEME_KEY = 'hltv:theme'

type Section = 'cache' | 'theme' | 'translation' | 'status'

export default function Settings({ initialTab }: { initialTab?: Section }) {
  const [active, setActive] = useState<Section>(initialTab ?? 'cache')

  useEffect(() => {
    if (initialTab) setActive(initialTab)
  }, [initialTab])

  const sections: { key: Section; label: string }[] = [
    { key: 'cache',       label: '缓存' },
    { key: 'theme',       label: '主题' },
    { key: 'translation', label: '翻译' },
    { key: 'status',      label: '状态' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <h2 style={{ fontSize: 18 }}>设置</h2>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {sections.map(s => (
          <button
            key={s.key}
            className={`button${active === s.key ? ' primary' : ''}`}
            onClick={() => setActive(s.key)}
            style={{ fontSize: 12, padding: 'var(--space-1) var(--space-3)' }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {active === 'cache' && <CacheSection />}
      {active === 'theme' && <ThemeSection />}
      {active === 'translation' && <TranslationSection />}
      {active === 'status' && <StatusSection />}
    </div>
  )
}

function CacheSection() {
  const [stats, setStats] = useState<any>(null)
  const [cleared, setCleared] = useState(false)

  const refresh = useCallback(() => { api.cacheStats().then(setStats).catch(() => {}) }, [])
  useEffect(() => { refresh() }, [refresh])

  const clear = async () => {
    await api.clearCache(); setCleared(true); refresh()
    setTimeout(() => setCleared(false), 2500)
  }

  const cards = [
    { label: '缓存条目', value: stats?.entries ?? '—' },
    { label: '命中次数', value: stats?.hits    ?? '—' },
    { label: '未命中',   value: stats?.misses  ?? '—' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
        {cards.map(c => (
          <div key={c.label} className="card stat-card">
            <div className="label">{c.label}</div>
            <div className="value" style={{ fontSize: 32 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="button" onClick={clear} style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>
          清除全部缓存
        </button>
        <button className="button" onClick={refresh}>刷新</button>
        {cleared && <span style={{ fontSize: 14, color: 'var(--accent-green)' }}>✓ 缓存已清除</span>}
      </div>
    </div>
  )
}

function ThemeSection() {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem(THEME_KEY) ?? 'dark')

  const choose = (t: string) => {
    setTheme(t)
    localStorage.setItem(THEME_KEY, t)
    document.documentElement.classList.toggle('light', t === 'light')
  }

  return (
    <div className="card">
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
        当前主题（v1 默认深色，浅色为预留）
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button
          className={`button${theme === 'dark' ? ' primary' : ''}`}
          onClick={() => choose('dark')}
        >
          深色
        </button>
        <button
          className={`button${theme === 'light' ? ' primary' : ''}`}
          onClick={() => choose('light')}
        >
          浅色（预留）
        </button>
      </div>
    </div>
  )
}

function TranslationSection() {
  const { cfg, save, saveCount } = useTranslateConfig()
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')

  useEffect(() => {
    if (cfg) {
      setUrl(cfg.provider_url ?? '')
      setKey(cfg.api_key ?? '')
      setModel(cfg.model ?? '')
    }
  }, [cfg, saveCount])

  const applyPreset = (p: typeof PRESETS[0]) => { setUrl(p.url); setModel(p.model) }

  const inputS: React.CSSProperties = {
    width: '100%', marginBottom: 'var(--space-3)',
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>API 地址</label>
      <input className="input" style={inputS} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.openai.com/v1" />

      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>API Key</label>
      <input className="input" style={inputS} type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-..." />

      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>模型</label>
      <input className="input" style={{ ...inputS, marginBottom: 'var(--space-3)' }} value={model} onChange={e => setModel(e.target.value)} />

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button
            key={p.label}
            className="button"
            onClick={() => applyPreset(p)}
            style={{
              fontSize: 12, padding: 'var(--space-1) var(--space-2)',
              color: (url === p.url && model === p.model) ? 'var(--accent-red)' : 'var(--text-secondary)',
              borderColor: (url === p.url && model === p.model) ? 'var(--accent-red)' : 'var(--border-default)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button className="button primary" onClick={() => save(url, key, model)}>保存</button>
        <span style={{ fontSize: 12, color: cfg?.configured ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>
          {cfg?.configured ? '● 已配置' : '○ 未配置'}
        </span>
      </div>
    </div>
  )
}

function StatusSection() {
  const [status, setStatus] = useState<any>(null)
  useEffect(() => { api.status().then(setStatus).catch(() => {}) }, [])

  if (!status) return <div className="card">加载中...</div>

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)' }}>运行时长</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{status.uptime_sec}s</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Go 版本</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{status.go_version}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)' }}>内存</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{status.memory_mb} MB</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)' }}>端点</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{status.endpoints_ok}/{status.endpoints_total}</span>
      </div>
      {Array.isArray(status.endpoints) && (
        <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {status.endpoints.map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{e.name}</span>
              <span style={{ color: e.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>{e.ok ? '✓' : '✕'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
