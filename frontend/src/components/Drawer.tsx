import type { ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function Drawer({ open, onClose, children }: DrawerProps) {
  if (!open) return null
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 25,
        }}
      />
      <aside className={`drawer${open ? ' open' : ''}`}>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 16, right: 16 }}
        >
          ✕
        </button>
        {children}
      </aside>
    </>
  )
}
