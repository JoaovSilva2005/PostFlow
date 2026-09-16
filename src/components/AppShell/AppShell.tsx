import {
  CalendarDays,
  ChevronRight,
  Command,
  Database,
  LogOut,
  Menu,
  MessageSquareText,
  Palette,
  Search,
  WalletCards,
  X,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import styles from './AppShell.module.css'

const navigationGroups = [
  {
    label: 'Criar e planejar',
    links: [
      { to: '/chat', label: 'Criar com IA', icon: MessageSquareText },
      { to: '/calendar', label: 'Agenda', icon: CalendarDays },
    ],
  },
  {
    label: 'Gerenciar',
    links: [
      { to: '/brand', label: 'Minha marca', icon: Palette },
      { to: '/finance', label: 'Financeiro', icon: WalletCards },
    ],
  },
]

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { authUser, brand, databaseStatus, logout } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuButton = useRef<HTMLButtonElement>(null)
  const currentPage = navigationGroups
    .flatMap((group) => group.links)
    .find((link) => link.to === pathname)?.label
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const groups = navigationGroups.map((group) => ({
    ...group,
    links: group.links.filter((link) =>
      link.label.toLocaleLowerCase('pt-BR').includes(normalizedSearch),
    ),
  }))

  function closeMenu() {
    setMenuOpen(false)
    setSearch('')
  }

  function handleEscape() {
    closeMenu()
    menuButton.current?.focus()
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.layout}>
      <a className={styles.skipLink} href="#main-content">
        Pular para o conteúdo
      </a>
      <header className={styles.mobileBar}>
        <span className={styles.wordmark}>
          <Command size={20} /> PostFlow
        </span>
        <button
          ref={menuButton}
          type="button"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          aria-controls="workspace-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>
      <aside
        id="workspace-navigation"
        className={`${styles.sidebar} ${menuOpen ? styles.open : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') handleEscape()
        }}
      >
        <NavLink
          className={styles.logo}
          to="/brand"
          aria-label="Início do PostFlow"
          onClick={closeMenu}
        >
          <Command size={22} /> PostFlow
        </NavLink>
        <div className={styles.workspaceIdentity}>
          <span className={styles.avatar}>
            {brand?.name?.slice(0, 1).toUpperCase() || 'P'}
          </span>
          <div>
            <strong>{brand?.name || 'Seu workspace'}</strong>
            <small>Projeto pessoal</small>
          </div>
        </div>
        <label className={styles.search}>
          <Search size={16} />
          <input
            aria-label="Buscar seção"
            placeholder="Buscar seção..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <nav className={styles.navigation} aria-label="Menu principal">
          {groups.map(
            (group) =>
              group.links.length > 0 && (
                <div className={styles.navGroup} key={group.label}>
                  <p>{group.label}</p>
                  {group.links.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={closeMenu}
                      className={({ isActive }) =>
                        `${styles.navItem} ${isActive ? styles.active : ''}`
                      }
                    >
                      <Icon size={18} strokeWidth={1.6} />
                      <span>{label}</span>
                      <ChevronRight size={14} className={styles.navArrow} />
                    </NavLink>
                  ))}
                </div>
              ),
          )}
          {!groups.some((group) => group.links.length) && (
            <p className={styles.noResults}>Nenhuma seção encontrada.</p>
          )}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={`${styles.databaseStatus} ${styles[databaseStatus]}`}>
            <Database size={14} />
            <span>
              {databaseStatus === 'connected'
                ? 'Banco conectado'
                : databaseStatus === 'connecting'
                  ? 'Conectando ao banco'
                  : 'Banco indisponível'}
            </span>
            <i />
          </div>
          <div className={styles.profile}>
            <span className={styles.profileAvatar}>
              {authUser?.displayName?.slice(0, 1).toUpperCase() || 'U'}
            </span>
            <div>
              <strong>{authUser?.displayName || 'Minha conta'}</strong>
              <small>Ambiente acadêmico</small>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Sair"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className={styles.body}>
        <div className={styles.topbar}>
          <span>Workspace</span>
          <ChevronRight size={14} />
          <strong>{currentPage}</strong>
        </div>
        <main id="main-content" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  )
}
