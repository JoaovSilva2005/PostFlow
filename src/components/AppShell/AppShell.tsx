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
  ReceiptText,
  ShieldCheck,
  BadgeDollarSign,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import type { PlatformRole, WorkspaceRole } from '../../domain/auth'
import styles from './AppShell.module.css'

const workspaceRoleLabels: Record<WorkspaceRole, string> = {
  owner: 'Responsável',
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Leitor',
}

const platformRoleLabels: Record<Exclude<PlatformRole, null>, string> = {
  platform_owner: 'Administrador',
  finance_admin: 'Financeiro',
  support: 'Suporte',
}

const workspaceNavigation = [
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
      { to: '/billing', label: 'Assinatura e cobrança', icon: BadgeDollarSign },
    ],
  },
]

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const {
    authUser,
    billingStatus,
    brand,
    currentWorkspace,
    databaseStatus,
    logout,
    platformRole,
  } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuButton = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (menuOpen) searchInput.current?.focus()
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
    setSearch('')
  }, [pathname])
  const hasActivePlan =
    billingStatus === 'active' || billingStatus === 'trialing'
  const canUseProduct = hasActivePlan || platformRole === 'platform_owner'
  const visibleWorkspaceNavigation = canUseProduct
    ? workspaceNavigation
    : workspaceNavigation
        .map((group) => ({
          ...group,
          links: group.links.filter((link) => link.to === '/billing'),
        }))
        .filter((group) => group.links.length > 0)
  const adminNavigation = platformRole
    ? [
        {
          label: 'Administração',
          links: [
            { to: '/admin/finance', label: 'Financeiro', icon: WalletCards },
            { to: '/admin/fiscal', label: 'Fiscal', icon: ReceiptText },
            {
              to: '/admin/plans',
              label: 'Planos e custos',
              icon: ShieldCheck,
            },
          ],
        },
      ]
    : []
  const navigationGroups = [
    ...(currentWorkspace ? visibleWorkspaceNavigation : []),
    ...adminNavigation,
  ]
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

  function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      handleEscape()
      return
    }
    if (!menuOpen || event.key !== 'Tab') return
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled)',
      ),
    )
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
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
      {menuOpen && (
        <button
          type="button"
          className={styles.menuBackdrop}
          aria-label="Fechar menu"
          tabIndex={-1}
          onClick={handleEscape}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`${styles.sidebar} ${menuOpen ? styles.open : ''}`}
        role={menuOpen ? 'dialog' : undefined}
        aria-modal={menuOpen ? true : undefined}
        aria-label={menuOpen ? 'Menu principal' : undefined}
        onKeyDown={handleMenuKeyDown}
      >
        <NavLink
          className={styles.logo}
          to={canUseProduct ? '/brand' : '/billing'}
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
            <small>
              {currentWorkspace
                ? workspaceRoleLabels[currentWorkspace.role]
                : 'Nenhuma área de trabalho ativa'}
            </small>
          </div>
        </div>
        <label className={styles.search}>
          <Search size={16} />
          <input
            ref={searchInput}
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
          {(platformRole || databaseStatus === 'error') && (
            <div className={`${styles.databaseStatus} ${styles[databaseStatus]}`}>
              <Database size={14} />
              <span>
                {databaseStatus === 'connected'
                  ? 'Serviços disponíveis'
                  : databaseStatus === 'connecting'
                    ? 'Conectando aos serviços'
                    : 'Serviços indisponíveis'}
              </span>
              <i />
            </div>
          )}
          <div className={styles.profile}>
            <span className={styles.profileAvatar}>
              {authUser?.displayName?.slice(0, 1).toUpperCase() || 'U'}
            </span>
            <div>
              <strong>{authUser?.displayName || 'Minha conta'}</strong>
              <small>
                {platformRole
                  ? platformRoleLabels[platformRole]
                  : 'Conta de cliente'}
              </small>
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
          <span>{currentWorkspace ? 'Área de trabalho' : 'PostFlow'}</span>
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
