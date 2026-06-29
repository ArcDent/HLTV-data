import { useState, useEffect } from 'react'
import Modal from './Modal'

const PRESETS = [
  { label: 'OpenAI',         url: 'https://api.openai.com/v1',        model: 'gpt-4o-mini' },
  { label: 'DeepSeek',       url: 'https://api.deepseek.com/v1',      model: 'deepseek-chat' },
  { label: 'Groq',           url: 'https://api.groq.com/openai/v1',   model: 'llama-3.3-70b-versatile' },
  { label: 'Ollama 本地',    url: 'http://localhost:11434/v1',        model: 'qwen2.5:7b' },
]

type Config = { provider_url: string; api_key: string; model: string; configured: boolean }

export function useTranslateConfig() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [saveCount, setSaveCount] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchConfig = async () => {
    try {
      const r = await fetch('/api/translate/config')
      const c = await r.json()
      setCfg(c)
    } catch { setCfg({ provider_url: '', api_key: '', model: '', configured: false } as Config) }
  }

  useEffect(() => { fetchConfig() }, [])

  const save = async (url: string, key: string, model: string) => {
    await fetch('/api/translate/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_url: url, api_key: key, model }),
    })
    await fetchConfig()
    setSaveCount(c => c + 1)
    setOpen(false)
  }

  return { cfg, save, open, setOpen, saveCount }
}

const fieldS: React.CSSProperties = { display: 'flex', flexDirection: 'column', marginBottom: 16 }
const labelS: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }
const inputS: React.CSSProperties = { marginTop: 6, fontSize: 14, padding: '10px 14px' }

export function TranslateModal({ cfg, onSave, onClose }: {
  cfg: Config | null; onSave: (url: string, key: string, model: string) => void; onClose: () => void
}) {
  const [url, setUrl] = useState(cfg?.provider_url ?? '')
  const [key, setKey] = useState(cfg?.api_key ?? '')
  const [model, setModel] = useState(cfg?.model ?? '')

  const applyPreset = (p: typeof PRESETS[0]) => { setUrl(p.url); setModel(p.model) }

  return (
    <Modal onClose={onClose} width={460}>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
        color: 'var(--accent-red)', letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: 20,
      }}>翻译设置</h2>

      <div style={fieldS}>
        <label style={labelS}>API 地址</label>
        <input className="input" style={inputS} value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://api.openai.com/v1" />
      </div>

      <div style={fieldS}>
        <label style={labelS}>API Key</label>
        <input className="input" style={inputS} type="password" value={key} onChange={e => setKey(e.target.value)}
          placeholder="sk-..." />
      </div>

      <div style={{ ...fieldS, marginBottom: 12 }}>
        <label style={labelS}>模型</label>
        <input className="input" style={inputS} value={model} onChange={e => setModel(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {PRESETS.map(p => {
          const active = url === p.url && model === p.model
          return (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={`button${active ? ' primary' : ''}`}
              style={{ padding: '4px 10px', fontSize: 12 }}>
              {p.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => onSave(url, key, model)} className="button primary">保存</button>
        <span style={{ fontSize: 12, color: cfg?.configured ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>
          {cfg?.configured ? '● 已配置' : '○ 未配置'}
        </span>
      </div>
    </Modal>
  )
}
