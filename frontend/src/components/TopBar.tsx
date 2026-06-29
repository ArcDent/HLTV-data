import Hamburger from './Hamburger'

interface TopBarProps {
  search: string
  onSearch: (q: string) => void
  liveCount: number
  onOpenSettings: () => void
  onToggleMobileNav: () => void
  mobileNavOpen: boolean
}

export default function TopBar({
  search, onSearch, liveCount, onOpenSettings, onToggleMobileNav, mobileNavOpen,
}: TopBarProps) {
  return (
    <header className="topbar">
      <Hamburger onClick={onToggleMobileNav} open={mobileNavOpen} />
      <div className="brand">
        HLTV<span className="accent">DATA</span>
      </div>
      <input
        className="input search-expand"
        type="text"
        placeholder="搜索队伍 / 选手…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="spacer" />
      {liveCount > 0 && (
        <span className="badge live">● LIVE {liveCount}</span>
      )}
      <button
        className="icon-btn"
        onClick={onOpenSettings}
        aria-label="Settings"
        title="设置"
      >
        ⚙
      </button>
    </header>
  )
}
