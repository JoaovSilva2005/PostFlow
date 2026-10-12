import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ExternalLink, RefreshCw, Unlink } from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { AppShell } from '../../components/AppShell/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { SocialPlatformIcon } from '../../components/ui/SocialPlatformIcon'
import {
  socialApi,
  type SocialOverview,
  type SocialProviderId,
} from './socialApi'
import styles from './social.module.css'

const providerNames: Record<SocialProviderId, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
}
const requirements: Partial<Record<SocialProviderId, string>> = {
  instagram:
    'Conta profissional do Instagram (Empresa ou Criador), autorizada pelo Instagram Login.',
  facebook: 'Página do Facebook administrada pela conta conectada.',
  linkedin:
    'Perfil pessoal autorizado no LinkedIn. Páginas de empresas ainda não estão disponíveis.',
  tiktok:
    'Conta de criador autorizada; publicação pública depende da auditoria do app TikTok.',
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
  const [busy, setBusy] = useState<string | null>(null)

  async function load(signal?: AbortSignal) {
    if (!currentWorkspace) return
    setLoading(true)
    setError('')
    try {
      const result = await socialApi.overview(currentWorkspace.id, signal)
      if (!signal?.aborted) setOverview(result)
    } catch (cause) {
      if (!signal?.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível carregar as conexões.',
        )
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

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
      if (
        target.protocol !== 'https:' ||
        !allowedHosts[provider].includes(target.hostname)
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

  const connected = overview?.connections ?? []
  return (
    <AppShell>
      <PageHeader
        title="Redes conectadas"
        description="Conecte as contas do workspace para publicar e acompanhar o status dos posts."
      />
      <div className={styles.pageActions}>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} /> Sincronizar
        </Button>
        <Link to="/calendar">Voltar à agenda</Link>
      </div>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!canManage && (
        <p className={styles.note}>
          Somente responsáveis e administradores podem conectar ou remover
          contas. Você pode consultar este painel.
        </p>
      )}
      <section
        className={styles.section}
        aria-labelledby="connections-title"
        aria-busy={loading}
      >
        <div className={styles.sectionTitle}>
          <div>
            <h2 id="connections-title">Contas conectadas</h2>
            <p>
              As permissões são concedidas pelo titular da conta na própria
              rede.
            </p>
          </div>
          <span>
            {connected.length} {connected.length === 1 ? 'conta' : 'contas'}
          </span>
        </div>
        {loading ? (
          <p role="status">Carregando conexões…</p>
        ) : connected.length === 0 ? (
          <p className={styles.empty}>
            Nenhuma conta conectada a este workspace.
          </p>
        ) : (
          <div className={styles.connectionGrid}>
            {connected.map((connection) => {
              const providerReady =
                overview?.providers.some(
                  (provider) =>
                    provider.id === connection.provider && provider.configured,
                ) ?? false
              return (
                <article className={styles.connection} key={connection.id}>
                  <div className={styles.connectionHeading}>
                    <SocialPlatformIcon
                      platform={providerNames[connection.provider]}
                      size={24}
                    />
                    <div>
                      <h3>{connection.displayName}</h3>
                      <small>{providerNames[connection.provider]}</small>
                    </div>
                    <span data-status={connection.status}>
                      {connection.status === 'connected'
                        ? 'Conectada'
                        : connection.status === 'needs_reconnect'
                          ? 'Reconexão necessária'
                          : 'Desconectada'}
                    </span>
                  </div>
                  {connection.status === 'needs_reconnect' && (
                    <p className={styles.warning}>
                      {providerReady
                        ? 'A autorização precisa ser renovada para voltar a publicar.'
                        : 'A reconexão ficará disponível após a equipe PostFlow configurar esta integração.'}
                    </p>
                  )}
                  <div className={styles.cardActions}>
                    {connection.status === 'needs_reconnect' &&
                      providerReady &&
                      canManage && (
                        <Button
                          variant="ghost"
                          onClick={() => void connect(connection.provider)}
                          disabled={busy !== null}
                        >
                          Reconectar
                        </Button>
                      )}
                    {canManage && (
                      <Button
                        variant="ghost"
                        onClick={() => void disconnect(connection.id)}
                        disabled={busy !== null}
                      >
                        <Unlink size={15} /> Desconectar
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
      <section className={styles.section} aria-labelledby="providers-title">
        <div className={styles.sectionTitle}>
          <div>
            <h2 id="providers-title">Disponibilidade das redes</h2>
            <p>Configuração de API e formatos informados pelo servidor.</p>
          </div>
        </div>
        {loading && !overview ? (
          <p role="status">Verificando configuração…</p>
        ) : (
          <div className={styles.providerGrid}>
            {(overview?.providers ?? []).map((provider) => (
              <article className={styles.provider} key={provider.id}>
                <div className={styles.connectionHeading}>
                  <SocialPlatformIcon
                    platform={providerNames[provider.id]}
                    size={22}
                  />
                  <h3>{provider.label}</h3>
                  <span data-status={provider.configured ? 'ready' : 'missing'}>
                    {provider.configured ? 'Disponível' : 'Em configuração'}
                  </span>
                </div>
                <p>
                  {requirements[provider.id] ??
                    'A publicação ainda não está disponível para esta rede.'}
                </p>
                {provider.formats.includes('static') ? (
                  <small>Formato disponível: imagem estática.</small>
                ) : (
                  <small>
                    Publicação não habilitada nesta primeira entrega.
                  </small>
                )}
                {provider.missingConfiguration.length > 0 &&
                  canViewConfigurationDetails && (
                    <ul className={styles.missing}>
                      {provider.missingConfiguration.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                {provider.missingConfiguration.length > 0 &&
                  !canViewConfigurationDetails && (
                    <p className={styles.note}>
                      A integração está pendente de configuração administrativa
                      da PostFlow. Não envie senhas, chaves ou tokens por aqui.
                    </p>
                  )}
                {provider.setupUrl && (
                  <a href={provider.setupUrl} target="_blank" rel="noreferrer">
                    Documentação oficial <ExternalLink size={13} />
                  </a>
                )}
                {canManage && (
                  <Button
                    onClick={() => void connect(provider.id)}
                    disabled={
                      !provider.configured ||
                      busy !== null ||
                      !provider.formats.includes('static')
                    }
                  >
                    {provider.configured && provider.formats.includes('static')
                      ? busy === provider.id
                        ? 'Abrindo autorização…'
                        : 'Conectar conta'
                      : 'Configuração pendente'}
                  </Button>
                )}
              </article>
            ))}
            {(['x', 'Blog'] as const).map((provider) => (
              <article className={styles.provider} key={provider}>
                <div className={styles.connectionHeading}>
                  <SocialPlatformIcon platform={provider} size={22} />
                  <h3>{provider === 'x' ? 'X' : 'Blog'}</h3>
                  <span data-status="missing">Não suportado</span>
                </div>
                <p>
                  A publicação direta para este destino ainda não está
                  disponível.
                </p>
                <small>Nenhuma ação será enviada para esta rede.</small>
              </article>
            ))}
          </div>
        )}
      </section>
      {overview?.pending.length ? (
        <section className={styles.section} aria-labelledby="pending-title">
          <div className={styles.sectionTitle}>
            <div>
              <h2 id="pending-title">Autorizações pendentes</h2>
              <p>
                Selecione a conta autorizada para associá-la a este workspace.
              </p>
            </div>
          </div>
          {overview.pending.map((pending) => (
            <div className={styles.pending} key={pending.id}>
              <strong>{providerNames[pending.provider]}</strong>
              <div>
                {pending.accounts.map((account) => (
                  <div
                    className={styles.pendingAccount}
                    key={account.externalAccountId}
                  >
                    <span>
                      {account.displayName} · {account.accountType}
                    </span>
                    {canManage && (
                      <Button
                        onClick={() =>
                          void finishConnection(
                            pending.id,
                            account.externalAccountId,
                            pending.provider,
                          )
                        }
                        disabled={busy !== null}
                      >
                        Conectar conta
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {!canManage && <span>Aguardando responsável/admin.</span>}
            </div>
          ))}
        </section>
      ) : null}
      <section className={styles.section} aria-labelledby="activity-title">
        <div className={styles.sectionTitle}>
          <div>
            <h2 id="activity-title">Publicações recentes</h2>
            <p>
              O status reflete o processamento do worker e cada destino
              separadamente.
            </p>
          </div>
        </div>
        {loading && !overview ? (
          <p role="status">Carregando status…</p>
        ) : !overview?.publications.length ? (
          <p className={styles.empty}>Nenhuma publicação solicitada ainda.</p>
        ) : (
          <div className={styles.publications}>
            {overview.publications.map((publication) => (
              <article key={publication.id}>
                <span data-status={publication.status}>
                  {statusLabel(publication.status)}
                </span>
                <span>{providerNames[publication.provider]}</span>
                <span>
                  {new Date(publication.scheduledAt).toLocaleString('pt-BR')}
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
    </AppShell>
  )
}

function statusLabel(status: string) {
  return (
    (
      {
        queued: 'Na fila',
        preparing: 'Preparando',
        processing: 'Processando',
        publishing: 'Publicando',
        published: 'Publicado',
        retry_wait: 'Nova tentativa agendada',
        failed: 'Falhou',
        needs_reconnect: 'Reconexão necessária',
        cancelled: 'Cancelado',
        unknown: 'Status desconhecido',
      } as Record<string, string>
    )[status] ?? status
  )
}
