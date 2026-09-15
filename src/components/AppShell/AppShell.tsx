import {
  CalendarDays,
  Database,
  LogOut,
  MessageSquareText,
  Palette,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router'
import type { ReactNode } from 'react'
import { useApp } from '../../app/AppContext'
import styles from './AppShell.module.css'

const links = [
  { to: '/brand', label: 'Minha marca', icon: Palette },
  { to: '/chat', label: 'Criar com IA', icon: MessageSquareText },
  { to: '/calendar', label: 'Agenda', icon: CalendarDays },
  { to: '/finance', label: 'Financeiro', icon: WalletCards },
]

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { authUser, brand, databaseError, databaseStatus, logout } = useApp()

  const databaseLabel = {
    connecting: 'Conectando ao Supabase',
    connected: 'Supabase conectado',
    error: 'Banco não conectado',
  }[databaseStatus]

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
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
          <div
            className={`${styles.databaseStatus} ${styles[databaseStatus]}`}
            title={databaseError ?? databaseLabel}
          >
            <Database size={14} />
            <span>{databaseLabel}</span>
          </div>
        </div>

        <div className={styles.profile}>
          <div className={styles.avatar}>
            {brand?.name?.slice(0, 1).toUpperCase() || 'P'}
          </div>
          <div className={styles.profileCopy}>
            <strong>{brand?.name || 'Sua marca'}</strong>
            <span>{authUser?.displayName || 'Plano acadêmico'}</span>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            aria-label="Sair"
          >
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
