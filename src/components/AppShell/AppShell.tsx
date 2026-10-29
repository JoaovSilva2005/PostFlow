import {
  BadgeDollarSign,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronsUpDown,
  Coins,
  LogOut,
  Menu,
  MessageSquareText,
  Palette,
  Plug,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { useCanCreateBrand } from '../../app/useBrandCreation'
import type { PlatformRole, WorkspaceRole } from '../../domain/auth'
import styles from './AppShell.module.css'
import { ThemeSwitcher } from '../ThemeSwitcher/ThemeSwitcher'
import { readableTextOn } from '../ui/color'

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
      { to: '/integrations', label: 'Integrações', icon: Plug },
      { to: '/billing', label: 'Assinatura e cobrança', icon: BadgeDollarSign },
    ],
  },
]

const extraPageLabels: Record<string, string> = {
  '/brand/new': 'Nova marca',
}

function initialOf(value: string | undefined, fallback: string) {
  return value?.trim().slice(0, 1).toUpperCase() || fallback
}

export function AppShell({
  children,
  contentLayout = 'default',
  actions,
  hasUnsavedChanges = false,
}: {
  children: ReactNode
  contentLayout?: 'default' | 'edge'
  /** Page-level actions shown on the right side of the top bar. */
  actions?: ReactNode
  /** Asks for confirmation before the switcher leaves a dirty form. */
  hasUnsavedChanges?: boolean
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const {
    authUser,
    hasActivePlan,
    brand,
    availableWorkspaces,
    currentWorkspace,
    databaseStatus,
    logout,
    platformRole,
    selectWorkspace,
  } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuButton = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const switcherRef = useRef<HTMLDivElement>(null)
  const switcherButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (menuOpen) searchInput.current?.focus()
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
    setSwitcherOpen(false)
    setSearch('')
  }, [pathname])

  useEffect(() => {
    if (!switcherOpen) return
    function handlePointer(event: PointerEvent) {
      if (!switcherRef.current?.contains(event.target as Node))
        setSwitcherOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    return () => document.removeEventListener('pointerdown', handlePointer)
  }, [switcherOpen])

  const canUseProduct = hasActivePlan || platformRole === 'platform_owner'
  const canCreateBrand = useCanCreateBrand()
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
            { to: '/admin/ai-usage', label: 'Custos de IA', icon: Coins },
            { to: '/admin/fiscal', label: 'Fiscal', icon: ReceiptText },
            {
              to: '/admin/accounting',
              label: 'Contábil',
              icon: ChartNoAxesCombined,
            },
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
  const currentPage =
    extraPageLabels[pathname] ??
    navigationGroups
      .flatMap((group) => group.links)
      .find((link) => link.to === pathname)?.label
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const groups = navigationGroups.map((group) => ({
    ...group,
    links: group.links.filter((link) =>
      link.label.toLocaleLowerCase('pt-BR').includes(normalizedSearch),
    ),
  }))
  const workspaceName = currentWorkspace
    ? brand?.name?.trim() || 'Marca sem nome'
    : 'PostFlow'
  const workspaceRole = currentWorkspace
    ? workspaceRoleLabels[currentWorkspace.role]
    : platformRole
      ? `Plataforma · ${platformRoleLabels[platformRole]}`
      : 'Nenhuma marca ativa'
  const canSwitch = Boolean(currentWorkspace) && canUseProduct

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
      if (switcherOpen) {
        setSwitcherOpen(false)
        switcherButton.current?.focus()
        return
      }
      handleEscape()
      return
    }
    if (!menuOpen || event.key !== 'Tab') return
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled)',
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

  function confirmLeavingChanges() {
    return (
      !hasUnsavedChanges ||
      window.confirm(
        'Há alterações não salvas na marca. Se continuar, elas serão perdidas.',
      )
    )
  }

  async function handleSelectWorkspace(workspaceId: string) {
    setSwitcherOpen(false)
    if (workspaceId === currentWorkspace?.id) return
    if (!confirmLeavingChanges()) return
    await selectWorkspace(workspaceId)
    closeMenu()
  }

  function handleNewBrand() {
    setSwitcherOpen(false)
    if (!confirmLeavingChanges()) return
    navigate('/brand/new')
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div
      className={`${styles.layout} ${contentLayout === 'edge' ? styles.edge : ''}`}
    >
      <a className={styles.skipLink} href="#main-content">
        Pular para o conteúdo
      </a>
      {menuOpen && (
        <button
          type="button"
          className={styles.menuBackdrop}
          aria-hidden="true"
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
        <div className={styles.sidebarHeader}>
          <div
            className={styles.switcher}
            ref={switcherRef}
            onBlur={(event) => {
              if (
                switcherOpen &&
                event.relatedTarget &&
                !event.currentTarget.contains(event.relatedTarget as Node)
              )
                setSwitcherOpen(false)
            }}
          >
            {canSwitch ? (
              <button
                ref={switcherButton}
                type="button"
                className={styles.switcherButton}
                aria-expanded={switcherOpen}
                aria-controls="workspace-switcher"
                aria-label={`Marca ativa: ${workspaceName}. Trocar de marca`}
                onClick={() => setSwitcherOpen(!switcherOpen)}
              >
                <span
                  className={styles.workspaceAvatar}
                  style={
                    brand?.primaryColor
                      ? {
                          backgroundColor: brand.primaryColor,
                          color: readableTextOn(brand.primaryColor),
                        }
                      : undefined
                  }
                  aria-hidden="true"
                >
                  {initialOf(brand?.name, 'P')}
                </span>
                <span className={styles.switcherText}>
                  <strong>{workspaceName}</strong>
                  <small>{workspaceRole}</small>
                </span>
                <ChevronsUpDown size={16} aria-hidden="true" />
              </button>
            ) : (
              <div className={styles.switcherButton}>
                <span className={styles.workspaceAvatar} aria-hidden="true">
                  {currentWorkspace ? initialOf(brand?.name, 'P') : 'P'}
                </span>
                <span className={styles.switcherText}>
                  <strong>{workspaceName}</strong>
                  <small>{workspaceRole}</small>
                </span>
              </div>
            )}
            {switcherOpen && (
              <div
                id="workspace-switcher"
                className={styles.switcherMenu}
                aria-label="Trocar de marca"
                role="group"
              >
                <p className={styles.switcherHeading}>Suas marcas</p>
                {availableWorkspaces.map((workspace) => {
                  const isCurrent = workspace.id === currentWorkspace?.id
                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      className={styles.switcherOption}
                      aria-current={isCurrent ? 'true' : undefined}
                      onClick={() => void handleSelectWorkspace(workspace.id)}
                    >
                      <span
                        className={styles.optionAvatar}
                        style={{
                          backgroundColor: workspace.brand.primaryColor,
                          color: readableTextOn(workspace.brand.primaryColor),
                        }}
                        aria-hidden="true"
                      >
                        {initialOf(workspace.brand.name, 'P')}
                      </span>
                      <span className={styles.switcherText}>
                        <strong>
                          {workspace.brand.name || 'Marca sem nome'}
                        </strong>
                        <small>{workspaceRoleLabels[workspace.role]}</small>
                      </span>
                      {isCurrent ? (
                        <Check size={16} aria-hidden="true" />
                      ) : null}
                    </button>
                  )
                })}
                {!availableWorkspaces.length && (
                  <p className={styles.switcherEmpty}>
                    Nenhuma outra marca disponível.
                  </p>
                )}
                <div className={styles.switcherDivider} />
                {canCreateBrand ? (
                  <button
                    type="button"
                    className={styles.switcherOption}
                    onClick={handleNewBrand}
                  >
                    <span className={styles.optionIcon} aria-hidden="true">
                      <Plus size={16} />
                    </span>
                    <span className={styles.switcherText}>
                      <strong>Nova marca</strong>
                    </span>
                  </button>
                ) : (
                  <p className={styles.switcherEmpty}>
                    Limite de duas marcas atingido.
                  </p>
                )}
              </div>
            )}
          </div>
          {menuOpen ? (
            <button
              type="button"
              className={`${styles.iconButton} ${styles.drawerClose}`}
              aria-label="Fechar menu"
              onClick={handleEscape}
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchInput}
            aria-label="Buscar seção"
            placeholder="Buscar seção"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <nav className={styles.navigation} aria-label="Menu principal">
          {groups.map(
            (group) =>
              group.links.length > 0 && (
                <div className={styles.navGroup} key={group.label}>
                  <p className={styles.navGroupLabel}>{group.label}</p>
                  {group.links.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={closeMenu}
                      className={({ isActive }) =>
                        `${styles.navItem} ${isActive ? styles.active : ''}`
                      }
                    >
                      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                      <span>{label}</span>
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
            <div
              className={`${styles.databaseStatus} ${styles[databaseStatus]}`}
            >
              <i aria-hidden="true" />
              <span>
                {databaseStatus === 'connected'
                  ? 'Serviços disponíveis'
                  : databaseStatus === 'connecting'
                    ? 'Conectando aos serviços'
                    : 'Serviços indisponíveis'}
              </span>
            </div>
          )}
          <ThemeSwitcher />
          <div className={styles.profile}>
            <span className={styles.profileAvatar} aria-hidden="true">
              {initialOf(authUser?.displayName, 'U')}
            </span>
            <div className={styles.profileText}>
              <strong>{authUser?.displayName || 'Minha conta'}</strong>
              <small>
                {platformRole
                  ? platformRoleLabels[platformRole]
                  : 'Conta de cliente'}
              </small>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => void handleLogout()}
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className={styles.body}>
        <header className={styles.topbar}>
          <button
            ref={menuButton}
            type="button"
            className={`${styles.iconButton} ${styles.menuButton}`}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <nav className={styles.breadcrumb} aria-label="Você está em">
            <span className={styles.crumbRoot}>{workspaceName}</span>
            {currentPage ? (
              <>
                <span className={styles.crumbSeparator} aria-hidden="true">
                  /
                </span>
                <span className={styles.crumbCurrent} aria-current="page">
                  {currentPage}
                </span>
              </>
            ) : null}
          </nav>
          {actions ? (
            <div className={styles.topbarActions}>{actions}</div>
          ) : null}
        </header>
        <main id="main-content" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  )
}
