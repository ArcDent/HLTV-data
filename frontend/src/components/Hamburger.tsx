interface HamburgerProps {
  onClick: () => void
  open: boolean
}

export default function Hamburger({ onClick, open }: HamburgerProps) {
  return (
    <button
      className={`hamburger${open ? ' open' : ''}`}
      onClick={onClick}
      aria-label="Toggle navigation"
      aria-expanded={open}
    >
      <span />
      <span />
      <span />
    </button>
  )
}
