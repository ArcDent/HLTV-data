import { useEffect, useRef } from 'react'

type SSEEvent = { entity: string; id?: number; name?: string }
type Callback = (evt: SSEEvent) => void

let eventSource: EventSource | null = null
const listeners = new Map<string, Set<Callback>>()

function connect(): EventSource {
  if (eventSource) return eventSource
  const es = new EventSource('/api/sse')
  es.addEventListener('refreshed', (e: MessageEvent) => {
    try {
      const evt: SSEEvent = JSON.parse(e.data)
      listeners.get(evt.entity)?.forEach(cb => cb(evt))
    } catch {
      // ignore malformed events
    }
  })
  es.onerror = () => {
    // EventSource auto-reconnects
  }
  eventSource = es
  return es
}

// Subscribe to SSE refresh events. The callback is held in a ref so the
// listener is registered once per entity, not re-registered every render.
export function useSSE(entity: string, callback: Callback) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    const es = connect()
    void es

    const handler: Callback = (evt) => cbRef.current(evt)
    if (!listeners.has(entity)) {
      listeners.set(entity, new Set())
    }
    listeners.get(entity)!.add(handler)

    return () => {
      const set = listeners.get(entity)
      if (!set) return
      set.delete(handler)
      if (set.size === 0) listeners.delete(entity)
    }
  }, [entity])
}
