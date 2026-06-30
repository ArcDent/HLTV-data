import { createPortal } from 'react-dom'

interface ModalProps {
  children: React.ReactNode
  onClose: () => void
  width?: number
  maxHeight?: string
  fullscreen?: boolean
}

// Rendered through a portal to document.body so the fixed overlay escapes any
// ancestor with a transform (e.g. slideUp animation with `both` fill-mode leaves
// a non-none matrix that creates a containing block and breaks position:fixed).
export default function Modal({ children, onClose, width, maxHeight, fullscreen }: ModalProps) {
  const isFullscreen = fullscreen
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={isFullscreen ? 'modal-fullscreen' : ''}
        style={{
          position: 'relative',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: isFullscreen ? 0 : 'var(--radius)',
          width: isFullscreen ? '100vw' : (width ?? 700),
          maxWidth: isFullscreen ? '100vw' : '90vw',
          maxHeight: isFullscreen ? '100vh' : (maxHeight ?? '85vh'),
          height: isFullscreen ? '100vh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-modal)',
          animation: 'slideUp 0.25s ease',
        }}
      >
        <button
          onClick={onClose}
          className="icon-btn"
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14, width: 30, height: 30,
            fontSize: 16, zIndex: 2,
          }}
        >✕</button>
        <div
          style={{
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            padding: isFullscreen ? 'var(--space-5)' : 28,
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
