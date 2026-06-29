import { NavLink } from 'react-router-dom'

interface SubNavItem {
  to: string
  label: string
}

interface SubNavProps {
  items: SubNavItem[]
}

export default function SubNav({ items }: SubNavProps) {
  return (
    <nav className="subnav">
      {items.map(({ to, label }) => (
        <NavLink key={to} to={to} end={to === '/'}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
