import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import TopBar from './components/TopBar'
import SubNav from './components/SubNav'
import Drawer from './components/Drawer'
import Homepage from './pages/Homepage'
import Matches from './pages/Matches'
import SearchPage from './pages/SearchPage'
import News from './pages/News'
import Settings from './pages/Settings'

const nav = [
  { to: '/',          label: '首页' },
  { to: '/matches',   label: '赛程' },
  { to: '/teams',     label: '队伍' },
  { to: '/players',   label: '选手' },
  { to: '/news',      label: '新闻' },
]

export default function App() {
  const [search, setSearch] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="h-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <TopBar
        search={search}
        onSearch={setSearch}
        liveCount={0}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleMobileNav={() => setMobileNavOpen((v) => !v)}
        mobileNavOpen={mobileNavOpen}
      />

      {/* Desktop sub-nav */}
      <SubNav items={nav} />

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div className="mobile-nav-overlay">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileNavOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}

      <main className="content">
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/teams" element={<SearchPage key="teams" type="team" placeholder="搜索队伍 — 支持英文 / 中文 / 别名（如 Spirit、绿龙、小蜜蜂）" emptyHint="输入队名开始搜索" />} />
          <Route path="/players" element={<SearchPage key="players" type="player" placeholder="搜索选手 — 如 ZywOo、载物、s1mple" emptyHint="输入选手名开始搜索" />} />
          <Route path="/news" element={<News />} />
        </Routes>
      </main>

      <Drawer open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Settings />
      </Drawer>
    </div>
  )
}
