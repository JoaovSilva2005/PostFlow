import {
  CalendarDays,
  LogOut,
  MessageSquareText,
  Palette,
  Sparkles,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router'
import type { ReactNode } from 'react'
import { useApp } from '../../app/AppContext'
import styles from './AppShell.module.css'

const links = [
  { to: '/brand', label: 'Minha marca', icon: Palette },
  { to: '/chat', label: 'Criar com IA', icon: MessageSquareText },
  { to: '/calendar', label: 'Agenda', icon: CalendarDays },
]

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { brand, logout } = useApp()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div>
          <NavLink
            className={styles.logo}
            to="/brand"
            aria-label="Início do PostFlow"
          >
            PostFlow<span>.</span>
          </NavLink>
          <p className={styles.sectionLabel}>ESPAÇO DE TRABALHO</p>
          <nav className={styles.navigation} aria-label="Menu principal">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
              >
                <Icon size={18} strokeWidth={1.8} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className={styles.profile}>
          <div className={styles.avatar}>
            {brand?.name?.slice(0, 1).toUpperCase() || 'P'}
          </div>
          <div className={styles.profileCopy}>
            <strong>{brand?.name || 'Sua marca'}</strong>
            <span>Plano acadêmico</span>
          </div>
          <button type="button" onClick={handleLogout} aria-label="Sair">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.mobileBrand}>
          <Sparkles size={18} /> PostFlow
        </div>
        {children}
      </main>
    </div>
  )
}
