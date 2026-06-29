import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import TopBar from './components/TopBar'
import SubNav from './components/SubNav'
import Drawer from './components/Drawer'
import Homepage from './pages/Homepage'
import Matches from './pages/Matches'
import Teams from './pages/Teams'
import Players from './pages/Players'
import News from './pages/News'
import Settings from './pages/Settings'

const nav = [
  { to: '/',          label: '首页' },
  { to: '/matches',   label: '赛程' },
  { to: '/teams',     label: '队伍' },
  { to: '/players',   label: '选手' },
  { to: '/news',      label: '新闻' },
]

type SettingsTab = 'cache' | 'theme' | 'translation' | 'status'

export default function App() {
  const [search, setSearch] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('cache')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Allow other pages (e.g. News) to open the Settings drawer on a tab.
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<SettingsTab>).detail ?? 'cache'
      setSettingsTab(tab)
      setSettingsOpen(true)
    }
    window.addEventListener('open-settings', handler as EventListener)
    return () => window.removeEventListener('open-settings', handler as EventListener)
  }, [])

  return (
    <div className="h-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <TopBar
        search={search}
        onSearch={setSearch}
        liveCount={0}
        onOpenSettings={() => { setSettingsTab('cache'); setSettingsOpen(true) }}
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
          <Route path="/teams" element={<Teams />} />
          <Route path="/players" element={<Players />} />
          <Route path="/news" element={<News />} />
        </Routes>
      </main>

      <Drawer open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Settings initialTab={settingsTab} />
      </Drawer>
    </div>
  )
}
