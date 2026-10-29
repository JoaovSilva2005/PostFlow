import { useEffect, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Plug,
  RefreshCw,
  Unlink,
} from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import {
  socialApi,
  type SocialOverview,
  type SocialProviderId,
} from './socialApi'
import styles from './social.module.css'
import {
  integrationCatalog,
  type IntegrationDefinition,
} from './integrationCatalog'
import {
  hasPendingPublication,
  publicationStatusLabel,
  usePublicationPolling,
} from './publicationStatus'
import {
  DEMO_ACCOUNT_TYPE,
  type SocialConnectionDTO,
} from '../../../shared/domain/socialPublishing'

const providerNames: Record<SocialProviderId, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}

export function SocialConnectionsPage() {
  const { currentWorkspace, platformRole } = useApp()
  const canManage =
    currentWorkspace?.role === 'owner' || currentWorkspace?.role === 'admin'
  const canPublish = ['owner', 'admin', 'editor'].includes(
    currentWorkspace?.role ?? '',
  )
  const canViewConfigurationDetails = platformRole === 'platform_owner'
  const [overview, setOverview] = useState<SocialOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeTab, setActiveTab] = useState<'accounts' | 'publications'>(
    'accounts',
  )
  const [busy, setBusy] = useState<string | null>(null)

  async function load(signal?: AbortSignal, silent = false) {
    if (!currentWorkspace) return
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const result = await socialApi.overview(currentWorkspace.id, signal)
      if (!signal?.aborted) setOverview(result)
    } catch (cause) {
      if (!signal?.aborted && !silent)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível carregar as conexões.',
        )
    } finally {
      if (!signal?.aborted && !silent) setLoading(false)
    }
  }

  usePublicationPolling(
    hasPendingPublication(overview?.publications ?? []),
    () => void load(undefined, true),
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [currentWorkspace?.id])

  async function connect(provider: SocialProviderId) {
    if (!currentWorkspace || !canManage) return
    setBusy(provider)
    setError('')
    setNotice('')
    try {
      const { authorizationUrl } = await socialApi.beginOAuth(
        currentWorkspace.id,
        provider,
      )
      const target = new URL(authorizationUrl)
      const allowedHosts: Record<SocialProviderId, string[]> = {
        facebook: ['facebook.com', 'www.facebook.com'],
        instagram: [
          'facebook.com',
          'www.facebook.com',
          'instagram.com',
          'www.instagram.com',
        ],
        linkedin: ['linkedin.com', 'www.linkedin.com'],
        tiktok: ['tiktok.com', 'www.tiktok.com'],
      }
      const isDemoCallback =
        overview?.demoMode === true &&
        target.origin === window.location.origin &&
        target.pathname === `/api/social/oauth/${provider}/callback`
      if (
        !isDemoCallback &&
        (target.protocol !== 'https:' ||
          !allowedHosts[provider].includes(target.hostname))
      )
        throw new Error(
          'O servidor retornou um destino de autorização inválido.',
        )
      window.location.assign(target.toString())
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível iniciar a autorização.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function finishConnection(
    sessionId: string,
    externalAccountId: string,
    provider: SocialProviderId,
  ) {
    if (!currentWorkspace || !canManage) return
    setBusy(sessionId)
    setError('')
    try {
      await socialApi.completeConnection(currentWorkspace.id, {
        sessionId,
        externalAccountId,
      })
      setNotice(`${providerNames[provider]} conectado.`)
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível concluir a conexão.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function disconnect(id: string) {
    if (!currentWorkspace || !canManage) return
    setBusy(id)
    setError('')
    setNotice('')
    try {
      await socialApi.disconnect(currentWorkspace.id, id)
      setNotice('Conta desconectada.')
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível desconectar a conta.',
      )
    } finally {
      setBusy(null)
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 'accounts'
        : event.key === 'End'
          ? 'publications'
          : activeTab === 'accounts'
            ? 'publications'
            : 'accounts'
    setActiveTab(next)
    event.currentTarget
      .querySelector<HTMLButtonElement>('#' + next + '-tab')
      ?.focus()
  }

  function renderIntegration(item: IntegrationDefinition) {
    const provider = overview?.providers.find(
      (entry) => entry.id === item.provider,
    )
    const connections = (overview?.connections ?? []).filter(
      (entry) =>
        entry.provider === item.provider && entry.status !== 'disconnected',
    )
    const sessions = (overview?.pending ?? []).filter(
      (entry) => entry.provider === item.provider,
    )
    const ready = provider?.configured && provider.formats.includes('static')
    const connected = connections.some((entry) => entry.status === 'connected')
    const reconnect = connections.some(
      (entry) => entry.status === 'needs_reconnect',
    )
    const status = !provider
      ? 'unavailable'
      : !ready
        ? 'missing'
        : reconnect
          ? 'needs_reconnect'
          : connected
            ? 'connected'
            : 'ready'
    const label = {
      unavailable: loading ? 'Verificando…' : 'Indisponível',
      missing: 'Em configuração',
      needs_reconnect: 'Reconexão necessária',
      connected: 'Conectado',
      ready: 'Pronto para conectar',
    }[status]
    return (
      <article
        className={styles.integrationCard}
        key={item.id}
        aria-labelledby={'integration-' + item.id}
        data-integration={item.id}
      >
        <header className={styles.cardHeader}>
          <div className={styles.platformIdentity}>
            <IntegrationIcon item={item} />
            <div>
              <h2 id={'integration-' + item.id}>{item.name}</h2>
              <span className={styles.connectionState} data-state={status}>
                {status === 'connected' ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <i aria-hidden="true" />
                )}
                {label}
              </span>
            </div>
          </div>
          {connected || reconnect ? (
            <Button
              variant="ghost"
              className={styles.compactButton}
              onClick={() => void load()}
              disabled={loading || busy !== null}
            >
              <RefreshCw size={13} /> Atualizar
            </Button>
          ) : canManage ? (
            <Button
              variant="ghost"
              className={styles.compactButton}
              disabled={!ready || busy !== null || loading}
              onClick={() => void connect(item.provider)}
            >
              <Link2 size={13} />
              {ready
                ? busy === item.provider
                  ? 'Conectando…'
                  : 'Conectar conta'
                : 'Configuração pendente'}
            </Button>
          ) : null}
        </header>
        <a
          className={styles.helpLink}
          href={item.documentation}
          target="_blank"
          rel="noreferrer"
        >
          Precisa de ajuda? <ExternalLink size={11} />
        </a>
        <p className={styles.integrationDescription}>{item.description}</p>
        {provider && !ready && (
          <div className={styles.setupNote}>
            <p>
              A integração está pendente de configuração administrativa da
              PostFlow.
            </p>
            {canViewConfigurationDetails &&
              provider.missingConfiguration.length > 0 && (
                <details className={styles.configurationDetails}>
                  <summary>Ver configuração pendente</summary>
                  <ul>
                    {provider.missingConfiguration.map((value) => (
                      <li key={value}>{value}</li>
                    ))}
                  </ul>
                </details>
              )}
          </div>
        )}
        {ready && !connections.length && !sessions.length && (
          <p className={styles.accountEmpty}>
            Conecte uma conta para começar a publicar.
          </p>
        )}
        {connections.length > 0 && (
          <div className={styles.accountsInCard}>
            <h3>{item.accountLabel}</h3>
            {connections.map((connection) => (
              <div className={styles.accountGroup} key={connection.id}>
                <div className={styles.accountRow}>
                  <span className={styles.accountAvatar} aria-hidden="true">
                    {connection.displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <div className={styles.accountIdentity}>
                    <strong>{connection.displayName}</strong>
                    <small>
                      {connection.accountType} · {expiryLabel(connection)}
                    </small>
                    {connection.accountType === DEMO_ACCOUNT_TYPE && (
                      <span className={styles.demoBadge}>Demonstração</span>
                    )}
                  </div>
                  <span
                    className={styles.accountBadge}
                    data-state={connection.status}
                  >
                    {connection.status === 'connected' ? 'Ativa' : 'Renovar'}
                  </span>
                </div>
                {canManage && (
                  <div className={styles.accountActions}>
                    <Button
                      variant="ghost"
                      className={styles.compactButton}
                      disabled={!ready || busy !== null}
                      onClick={() => void connect(connection.provider)}
                    >
                      {connection.status === 'needs_reconnect'
                        ? 'Reconectar'
                        : 'Editar acesso'}
                    </Button>
                    <Button
                      variant="ghost"
                      className={styles.compactButton}
                      disabled={busy !== null}
                      onClick={() => void disconnect(connection.id)}
                    >
                      <Unlink size={12} /> Desconectar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {sessions.length > 0 && (
          <section
            className={styles.pendingInCard}
            aria-label="Autorizações pendentes"
          >
            <h3>Escolha uma conta autorizada</h3>
            {sessions.map((session) =>
              session.accounts.map((account) => (
                <div
                  key={session.id + '-' + account.externalAccountId}
                  className={styles.pendingAccount}
                >
                  <span>
                    <strong>{account.displayName}</strong>
                    <small>{account.accountType}</small>
                  </span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      className={styles.compactButton}
                      disabled={busy !== null}
                      onClick={() =>
                        void finishConnection(
                          session.id,
                          account.externalAccountId,
                          session.provider,
                        )
                      }
                    >
                      Conectar conta
                    </Button>
                  )}
                </div>
              )),
            )}
          </section>
        )}
      </article>
    )
  }

  return (
    <AppShell contentLayout="edge">
      <div className={styles.integrationsPage}>
        <header className={styles.integrationsHeader}>
          <div className={styles.headerCopy}>
            <h1>Conecte suas redes sociais</h1>
            <p>
              Reúna as integrações da sua marca e publique seus conteúdos
              diretamente pelo PostFlow.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button
              variant="ghost"
              onClick={() => void load()}
              disabled={loading || busy !== null}
            >
              <RefreshCw size={14} /> Sincronizar
            </Button>
            <Link to="/calendar">Voltar à agenda</Link>
          </div>
          <div
            className={styles.integrationTabs}
            role="tablist"
            aria-label="Integrações"
            onKeyDown={handleTabKeyDown}
          >
            <button
              role="tab"
              id="accounts-tab"
              aria-controls="accounts-panel"
              aria-selected={activeTab === 'accounts'}
              tabIndex={activeTab === 'accounts' ? 0 : -1}
              onClick={() => setActiveTab('accounts')}
            >
              <Plug size={16} /> Contas
            </button>
            <button
              role="tab"
              id="publications-tab"
              aria-controls="publications-panel"
              aria-selected={activeTab === 'publications'}
              tabIndex={activeTab === 'publications' ? 0 : -1}
              onClick={() => setActiveTab('publications')}
            >
              Publicações{' '}
              {overview?.publications.length ? (
                <span>{overview.publications.length}</span>
              ) : null}
            </button>
          </div>
        </header>
        <div className={styles.integrationsContent}>
          {overview?.demoMode && (
            <p className={styles.demoNotice} role="status">
              Modo demonstração: as conexões e publicações são simuladas e nada
              é enviado às redes sociais.
            </p>
          )}
          {notice && (
            <p className={styles.positiveNotice} role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className={styles.errorNotice} role="alert">
              {error}{' '}
              <button onClick={() => void load()}>Tentar novamente</button>
            </p>
          )}
          {!canManage && (
            <p className={styles.roleNote}>
              Somente responsáveis e administradores podem conectar ou remover
              contas. Você pode consultar este painel.
            </p>
          )}
          <div
            id="accounts-panel"
            role="tabpanel"
            aria-labelledby="accounts-tab"
            hidden={activeTab !== 'accounts'}
          >
            <section
              aria-label="Disponibilidade das redes"
              aria-busy={loading}
              className={styles.integrationsGrid}
            >
              {integrationCatalog.map(renderIntegration)}
            </section>
            <p className={styles.catalogNote}>
              As contas são vinculadas à marca atual. Conecte uma rede para
              publicar ou agendar os posts da sua agenda.
            </p>
          </div>
          <div
            id="publications-panel"
            role="tabpanel"
            aria-labelledby="publications-tab"
            hidden={activeTab !== 'publications'}
          >
            <section
              className={styles.activityPanel}
              aria-labelledby="activity-title"
            >
              <div className={styles.sectionTitle}>
                <div>
                  <h2 id="activity-title">Publicações recentes</h2>
                  <p>
                    Acompanhe a confirmação de cada rede e cada destino
                    separadamente.
                  </p>
                </div>
              </div>
              {loading && !overview ? (
                <p role="status">Carregando status…</p>
              ) : !overview?.publications.length ? (
                <p className={styles.empty}>
                  Nenhuma publicação solicitada ainda.
                </p>
              ) : (
                <div className={styles.publications}>
                  {overview.publications.map((publication) => (
                    <article key={publication.id}>
                      <span data-status={publication.status}>
                        {publicationStatusLabel(publication)}
                      </span>
                      <span>{providerNames[publication.provider]}</span>
                      <span>
                        {new Date(publication.scheduledAt).toLocaleString(
                          'pt-BR',
                        )}
                      </span>
                      {publication.remoteUrl && (
                        <a
                          href={publication.remoteUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir publicação <ExternalLink size={13} />
                        </a>
                      )}
                      {publication.error && <p>{publication.error}</p>}
                      {publication.cancellable && canPublish && (
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            if (!currentWorkspace) return
                            try {
                              await socialApi.cancel(
                                currentWorkspace.id,
                                publication.id,
                              )
                              setNotice('Solicitação de cancelamento recebida.')
                              await load()
                            } catch (cause) {
                              setError(
                                cause instanceof Error
                                  ? cause.message
                                  : 'Não foi possível cancelar a publicação.',
                              )
                            }
                          }}
                          disabled={busy !== null}
                        >
                          Cancelar
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function IntegrationIcon({ item }: { item: IntegrationDefinition }) {
  return (
    <span className={styles.integrationIcon} data-platform={item.id}>
      <SocialPlatformIcon platform={item.name} size={28} />
    </span>
  )
}

function expiryLabel(connection: SocialConnectionDTO) {
  if (connection.status === 'needs_reconnect')
    return 'Autorização precisa ser renovada'
  if (!connection.expiresAt) return 'Conta autorizada'
  const days = Math.ceil(
    (new Date(connection.expiresAt).getTime() - Date.now()) / 86400000,
  )
  if (!Number.isFinite(days)) return 'Validade não informada'
  if (days <= 0) return 'Autorização expirada'
  return days === 1 ? 'Expira em 1 dia' : 'Expira em ' + days + ' dias'
}
