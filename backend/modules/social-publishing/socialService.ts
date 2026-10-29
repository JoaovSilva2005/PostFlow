import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { HttpError } from '../../shared/HttpError.js'
import type { WorkspaceAccessRepository } from '../tenancy/workspaceTypes.js'
import {
  DEMO_ACCOUNT_TYPE,
  SOCIAL_PROVIDERS,
  type CreatePublicationInput,
  type SocialOverview,
  type SocialProviderId,
  type SocialConnectionDTO,
  type PublicationDTO,
} from '../../../shared/domain/socialPublishing.js'
import {
  SocialCrypto,
  hashState,
  pkceChallenge,
  randomState,
} from './socialCrypto.js'
import {
  ProviderError,
  type OAuthTokens,
  type ProviderAccount,
  type SocialProvider,
  type SocialRepository,
  type ConnectionRecord,
  type PublicationRecord,
  type ProviderPublishInput,
} from './socialTypes.js'

const metadata: Record<
  SocialProviderId,
  { label: string; keys: string[]; setupUrl: string }
> = {
  facebook: {
    label: 'Facebook',
    keys: ['META_APP_ID', 'META_APP_SECRET'],
    setupUrl: 'https://developers.facebook.com/apps/',
  },
  instagram: {
    label: 'Instagram',
    keys: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'],
    setupUrl: 'https://developers.facebook.com/apps/',
  },
  linkedin: {
    label: 'LinkedIn',
    keys: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    setupUrl: 'https://www.linkedin.com/developers/apps',
  },
  tiktok: {
    label: 'TikTok',
    keys: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
    setupUrl: 'https://developers.tiktok.com/apps/',
  },
}
export function publicConnection(c: ConnectionRecord): SocialConnectionDTO {
  return {
    id: c.id,
    provider: c.provider,
    externalAccountId: c.externalAccountId,
    displayName: c.displayName,
    accountType: c.accountType,
    status: c.status,
    expiresAt: c.expiresAt,
    createdAt: c.createdAt,
  }
}
export function publicPublication(p: PublicationRecord): PublicationDTO {
  return {
    id: p.id,
    draftId: p.draftId,
    connectionId: p.connectionId,
    provider: p.provider,
    title: p.title,
    status: p.status,
    scheduledAt: p.scheduledAt,
    remotePostId: p.remotePostId,
    remoteUrl: p.remoteUrl,
    error: p.error,
    attempts: p.attempts,
    createdAt: p.createdAt,
    simulated: p.operation?.demo === true,
    cancellable:
      !p.leaseToken &&
      !p.operation?._dispatched &&
      [
        'queued',
        'retry_wait',
        'processing',
        'preparing',
        'needs_reconnect',
      ].includes(p.status),
  }
}

export class SocialService {
  readonly repository: SocialRepository
  readonly crypto: SocialCrypto
  readonly appUrl: string
  private providers: Map<SocialProviderId, SocialProvider>
  private access: WorkspaceAccessRepository
  private config: Record<string, string | undefined>
  private readonly demoModeOption?: boolean
  constructor(options: {
    repository: SocialRepository
    providers: SocialProvider[]
    access: WorkspaceAccessRepository
    crypto?: SocialCrypto
    appUrl: string
    config?: Record<string, string | undefined>
    /** Fonte única do modo demonstração; sem ele, usa SOCIAL_DEMO_MODE do config. */
    demoMode?: boolean
  }) {
    this.repository = options.repository
    this.providers = new Map(options.providers.map((p) => [p.id, p]))
    this.access = options.access
    this.crypto = options.crypto ?? new SocialCrypto()
    this.appUrl = options.appUrl.replace(/\/$/, '')
    this.config = options.config ?? process.env
    this.demoModeOption = options.demoMode
  }
  private provider(id: SocialProviderId) {
    const p = this.providers.get(id)
    if (!p) throw new HttpError(400, 'Rede não suportada.')
    return p
  }
  private get demoMode() {
    return this.demoModeOption ?? this.config.SOCIAL_DEMO_MODE === 'true'
  }
  private modeMismatch(accountType: string) {
    return (accountType === DEMO_ACCOUNT_TYPE) !== this.demoMode
  }
  private missing(id: SocialProviderId) {
    const result = this.demoMode
      ? []
      : metadata[id].keys.filter((k) => !this.config[k]?.trim())
    if (!this.crypto.configured) result.push('SOCIAL_TOKEN_ENCRYPTION_KEY')
    if (
      !this.config.SOCIAL_CRON_SECRET ||
      this.config.SOCIAL_CRON_SECRET.length < 32
    )
      result.push('SOCIAL_CRON_SECRET')
    if (this.config.SOCIAL_SCHEDULER_ENABLED !== 'true')
      result.push('SOCIAL_SCHEDULER_ENABLED')
    if (
      !this.appUrl.startsWith('https://') &&
      this.config.NODE_ENV === 'production'
    )
      result.push('APP_URL')
    if (id === 'tiktok' && !this.demoMode) {
      if (this.config.TIKTOK_MEDIA_DOMAIN_VERIFIED !== 'true')
        result.push('TIKTOK_MEDIA_DOMAIN_VERIFIED')
      if (this.config.TIKTOK_DIRECT_POST_APPROVED !== 'true')
        result.push('TIKTOK_DIRECT_POST_APPROVED')
    }
    return result
  }
  private ensureConfigured(id: SocialProviderId) {
    if (!this.provider(id).configured || this.missing(id).length)
      throw new HttpError(
        503,
        'A conexão desta rede está aguardando configuração administrativa.',
      )
  }
  private context(
    c: Pick<ConnectionRecord, 'workspaceId' | 'provider' | 'externalAccountId'>,
  ) {
    return `connection:${c.workspaceId}:${c.provider}:${c.externalAccountId}`
  }
  async overview(workspaceId: string, userId: string): Promise<SocialOverview> {
    const [connections, sessions, jobs] = await Promise.all([
      this.repository.listConnections(workspaceId),
      this.repository.listReadySessions(workspaceId, userId),
      this.repository.listPublications(workspaceId),
    ])
    return {
      demoMode: this.demoMode,
      providers: SOCIAL_PROVIDERS.map((id) => ({
        id,
        label: metadata[id].label,
        configured:
          Boolean(this.providers.get(id)?.configured) &&
          this.missing(id).length === 0,
        missingConfiguration: this.missing(id),
        formats: ['static'],
        setupUrl: metadata[id].setupUrl,
      })),
      connections: connections.map(publicConnection),
      pending: sessions.map((s) => ({
        id: s.id,
        provider: s.provider,
        accounts: this.crypto
          .open<ProviderAccount[]>(
            s.encryptedAccounts!,
            `accounts:${workspaceId}:${s.id}`,
          )
          .map((a) => ({
            externalAccountId: a.externalAccountId,
            displayName: a.displayName,
            accountType: a.accountType,
          })),
      })),
      publications: jobs.map(publicPublication),
    }
  }
  async startOAuth(
    workspaceId: string,
    userId: string,
    provider: SocialProviderId,
  ) {
    this.ensureConfigured(provider)
    const pending = await this.repository.countOAuthSessions(
      workspaceId,
      userId,
    )
    if (pending >= 10)
      throw new HttpError(
        429,
        'Conclua as conexões pendentes antes de iniciar outra.',
      )
    const id = randomUUID(),
      state = randomState(),
      verifier = randomState(),
      redirectUri = `${this.appUrl}/api/social/oauth/${provider}/callback`
    await this.repository.createOAuthSession({
      id,
      workspaceId,
      userId,
      provider,
      stateHash: hashState(state),
      encryptedVerifier: this.crypto.seal(verifier, `verifier:${id}`),
      encryptedAccounts: null,
      redirectUri,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      status: 'pending',
    })
    return {
      authorizationUrl: this.provider(provider).authorizationUrl({
        state,
        redirectUri,
        codeChallenge: pkceChallenge(verifier),
      }),
    }
  }
  async callback(
    userId: string,
    provider: SocialProviderId,
    state: string,
    code: string | undefined,
  ) {
    const session = await this.repository.consumeOAuthSession(
      hashState(state),
      userId,
      provider,
    )
    if (!session)
      throw new HttpError(
        400,
        'Autorização expirada, inválida ou já utilizada. Inicie a conexão novamente.',
      )
    try {
      const membership = await this.access.getMembership(
        userId,
        session.workspaceId,
      )
      if (!membership || !['owner', 'admin'].includes(membership.role))
        throw new HttpError(
          403,
          'Você não pode administrar conexões desta marca.',
        )
      this.ensureConfigured(provider)
      if (!code)
        throw new HttpError(400, 'A autorização da rede foi cancelada.')
      const tokens = await this.provider(provider).exchangeCode({
        code,
        redirectUri: session.redirectUri,
        codeVerifier: this.crypto.open<string>(
          session.encryptedVerifier,
          `verifier:${session.id}`,
        ),
      })
      const accounts = await this.provider(provider).accounts(tokens)
      if (!accounts.length)
        throw new HttpError(
          400,
          'Nenhuma conta com permissão de publicação foi encontrada.',
        )
      await this.repository.completeOAuthSession(
        session.id,
        this.crypto.seal(
          accounts,
          `accounts:${session.workspaceId}:${session.id}`,
        ),
      )
      return session.workspaceId
    } catch (error) {
      await this.repository.completeOAuthSession(session.id, null)
      throw error
    }
  }
  async connect(
    workspaceId: string,
    userId: string,
    sessionId: string,
    externalAccountId: string,
  ) {
    const s = await this.repository.getReadySession(
      workspaceId,
      userId,
      sessionId,
    )
    if (!s?.encryptedAccounts)
      throw new HttpError(
        400,
        'Seleção de conta expirada. Conecte a rede novamente.',
      )
    this.ensureConfigured(s.provider)
    const accounts = this.crypto.open<ProviderAccount[]>(
      s.encryptedAccounts,
      `accounts:${workspaceId}:${s.id}`,
    )
    const account = accounts.find(
      (a) => a.externalAccountId === externalAccountId,
    )
    if (!account)
      throw new HttpError(400, 'Conta não autorizada nesta conexão.')
    const record: ConnectionRecord = {
      id: randomUUID(),
      workspaceId,
      userId,
      provider: s.provider,
      externalAccountId,
      displayName: account.displayName,
      accountType: account.accountType,
      status: 'connected',
      createdAt: new Date().toISOString(),
      expiresAt: account.tokens.expiresAt ?? null,
      encryptedTokens: this.crypto.seal(
        account.tokens,
        this.context({ workspaceId, provider: s.provider, externalAccountId }),
      ),
    }
    const saved = await this.repository.saveConnection(record)
    return publicConnection(saved)
  }
  async disconnect(workspaceId: string, id: string) {
    if (!(await this.repository.getConnection(workspaceId, id)))
      throw new HttpError(404, 'Conta não encontrada nesta marca.')
    await this.repository.disconnect(workspaceId, id)
  }
  private async tokens(connection: ConnectionRecord) {
    if (connection.status !== 'connected')
      throw new ProviderError('Reconecte a conta para continuar.', 'auth')
    let tokens = this.crypto.open<OAuthTokens>(
      connection.encryptedTokens,
      this.context(connection),
    )
    const refreshWindow =
      connection.provider === 'instagram' ? 24 * 60 * 60_000 : 60_000
    if (
      !tokens.expiresAt ||
      new Date(tokens.expiresAt).getTime() > Date.now() + refreshWindow
    )
      return tokens
    const provider = this.provider(connection.provider)
    if (
      (!tokens.refreshToken && connection.provider !== 'instagram') ||
      !provider.refresh
    )
      throw new ProviderError(
        'A autorização expirou. Reconecte a conta.',
        'auth',
      )
    const lease = await this.repository.claimRefresh(
      connection.workspaceId,
      connection.id,
    )
    if (!lease)
      throw new ProviderError(
        'A conta está renovando a autorização. Tente novamente.',
        'temporary',
      )
    try {
      const latest = await this.repository.getConnection(
        connection.workspaceId,
        connection.id,
      )
      if (!latest || latest.status !== 'connected')
        throw new ProviderError('Conta desconectada.', 'auth')
      tokens = this.crypto.open<OAuthTokens>(
        latest.encryptedTokens,
        this.context(latest),
      )
      if (
        !tokens.expiresAt ||
        new Date(tokens.expiresAt).getTime() > Date.now() + refreshWindow
      ) {
        await this.repository.finishRefresh(
          connection.workspaceId,
          connection.id,
          lease,
          null,
        )
        return tokens
      }
      const fresh = await provider.refresh(tokens)
      const saved = await this.repository.finishRefresh(
        connection.workspaceId,
        connection.id,
        lease,
        {
          encryptedTokens: this.crypto.seal(fresh, this.context(connection)),
          expiresAt: fresh.expiresAt ?? null,
        },
      )
      if (!saved)
        throw new ProviderError(
          'A autorização mudou durante a renovação.',
          'temporary',
        )
      return fresh
    } catch (error) {
      await this.repository.finishRefresh(
        connection.workspaceId,
        connection.id,
        lease,
        null,
      )
      throw error
    }
  }
  async creatorInfo(workspaceId: string, id: string) {
    const c = await this.repository.getConnection(workspaceId, id)
    if (!c || c.provider !== 'tiktok')
      throw new HttpError(404, 'Conta TikTok não encontrada.')
    const provider = this.provider(c.provider)
    this.ensureConfigured(c.provider)
    if (!provider.creatorInfo)
      throw new HttpError(503, 'Informações do criador indisponíveis.')
    return provider.creatorInfo(await this.tokens(c), c.externalAccountId)
  }
  async enqueue(
    workspaceId: string,
    userId: string,
    input: CreatePublicationInput,
  ) {
    const c = await this.repository.getConnection(
      workspaceId,
      input.connectionId,
    )
    if (!c || c.status !== 'connected')
      throw new HttpError(400, 'Selecione uma conta conectada desta marca.')
    if (this.modeMismatch(c.accountType))
      throw new HttpError(
        409,
        'Esta conta foi conectada em outro modo (demonstração/real). Reconecte a conta.',
      )
    this.ensureConfigured(c.provider)
    const existing = (await this.repository.listPublications(workspaceId)).find(
      (p) =>
        p.draftId === input.draftId &&
        p.connectionId === input.connectionId &&
        !['failed', 'cancelled'].includes(p.status),
    )
    const draft = await this.repository.getDraft(workspaceId, input.draftId)
    if (!draft) throw new HttpError(404, 'Rascunho não encontrado nesta marca.')
    if (draft.provider.toLowerCase() !== c.provider)
      throw new HttpError(
        400,
        'A rede do rascunho deve corresponder à conta selecionada.',
      )
    if (draft.format !== 'static')
      throw new HttpError(
        400,
        'Esta versão publica imagens estáticas. Carrossel precisa dos slides e Reels precisa do arquivo de vídeo.',
      )
    if (!draft.imagePath || !draft.imagePath.startsWith(`${workspaceId}/`))
      throw new HttpError(400, 'Salve uma imagem da marca antes de publicar.')
    let expectedImagePath = ''
    try {
      expectedImagePath = decodeURIComponent(
        new URL(input.expectedDraft.imageUrl).pathname,
      )
    } catch {
      /* invalid preview */
    }
    if (
      !input.expectedDraft ||
      input.expectedDraft.title !== draft.title ||
      input.expectedDraft.caption !== draft.caption ||
      JSON.stringify([...input.expectedDraft.hashtags].sort()) !==
        JSON.stringify([...draft.hashtags].sort()) ||
      !expectedImagePath.endsWith(`/post-draft-images/${draft.imagePath}`)
    ) {
      throw new HttpError(
        409,
        'O rascunho mudou desde a prévia. Recarregue, revise e autorize novamente.',
      )
    }
    if (!input.consent)
      throw new HttpError(400, 'Confirme o conteúdo e autorize a publicação.')
    if (c.provider === 'tiktok') {
      if (!input.tiktok)
        throw new HttpError(
          400,
          'Escolha as opções de privacidade e consentimento do TikTok.',
        )
      const info = await this.creatorInfo(workspaceId, c.id)
      if (!info.privacyLevelOptions.includes(input.tiktok.privacyLevel))
        throw new HttpError(
          400,
          'A privacidade selecionada não está disponível para esta conta.',
        )
      if (info.commentDisabled && !input.tiktok.disableComment)
        throw new HttpError(
          400,
          'Esta conta não permite comentários neste conteúdo.',
        )
      if (
        input.tiktok.brandContentToggle &&
        input.tiktok.privacyLevel === 'SELF_ONLY'
      )
        throw new HttpError(
          400,
          'Conteúdo de marca não pode ser privado no TikTok.',
        )
    }
    const scheduledAt = input.scheduledAt ?? new Date().toISOString()
    const time = new Date(scheduledAt).getTime()
    if (
      !Number.isFinite(time) ||
      time < Date.now() - 60_000 ||
      time > Date.now() + 366 * 86400_000
    )
      throw new HttpError(400, 'Escolha uma data futura de até um ano.')
    const caption = [draft.caption, input.expectedDraft.hashtags.join(' ')]
      .filter(Boolean)
      .join('\n')
    const captionLimit = {
      facebook: 5000,
      instagram: 2200,
      linkedin: 3000,
      tiktok: 4000,
    }[c.provider]
    if (caption.length > captionLimit)
      throw new HttpError(
        400,
        `Legenda e hashtags ultrapassam o limite de ${captionLimit} caracteres deste destino.`,
      )
    if (c.provider === 'tiktok' && draft.title.length > 90)
      throw new HttpError(
        400,
        'O título do post de fotos do TikTok pode ter até 90 caracteres.',
      )
    const approvalHash = hashState(
      JSON.stringify({
        title: draft.title,
        caption,
        imagePath: draft.imagePath,
        scheduledAt: input.scheduledAt ? new Date(time).toISOString() : 'now',
        options: input.tiktok ?? null,
      }),
    )
    if (existing) {
      if (existing.snapshot.approvalHash === approvalHash)
        return publicPublication(existing)
      throw new HttpError(
        409,
        'Já existe uma versão diferente deste post para esta conta. Confira ou cancele o agendamento anterior.',
      )
    }
    const bytes = await this.repository.loadImage(draft.imagePath)
    const jpeg = await sharp(bytes, { limitInputPixels: 16_000_000 })
      .rotate()
      .resize({
        width: 1080,
        height: 1080,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer()
    const id = randomUUID(),
      imagePath = await this.repository.saveImage(workspaceId, id, jpeg)
    try {
      const record: PublicationRecord = {
        id,
        workspaceId,
        userId,
        draftId: draft.id,
        connectionId: c.id,
        provider: c.provider,
        title: draft.title,
        snapshot: {
          approvalHash,
          title: draft.title,
          caption,
          imagePath,
          timezone: draft.timezone,
          options: input.tiktok,
        },
        scheduledAt,
        nextAttemptAt: scheduledAt,
        status: 'queued',
        operation: null,
        remotePostId: null,
        remoteUrl: null,
        error: null,
        attempts: 0,
        leaseToken: null,
        leaseExpiresAt: null,
        createdAt: new Date().toISOString(),
      }
      const saved = await this.repository.enqueue(record)
      if (saved.id !== id)
        await this.repository.removeImage(imagePath).catch(() => undefined)
      return publicPublication(saved)
    } catch (error) {
      await this.repository.removeImage(imagePath).catch(() => undefined)
      throw error
    }
  }
  async cancel(workspaceId: string, id: string) {
    const current = await this.repository.getPublication(id)
    if (
      !current ||
      current.workspaceId !== workspaceId ||
      current.operation?._dispatched
    )
      throw new HttpError(
        409,
        'O envio já começou e precisa ser verificado na rede.',
      )
    const result = await this.repository.cancel(workspaceId, id)
    if (!result)
      throw new HttpError(
        409,
        'Não é possível cancelar: o envio já começou ou a publicação não pertence a esta marca.',
      )
    return publicPublication(result)
  }
  async media(jobId: string, token: string) {
    if (!this.crypto.validMediaToken(jobId, token))
      throw new HttpError(404, 'Mídia não encontrada.')
    const job = await this.repository.getPublication(jobId)
    if (
      !job ||
      ![
        'preparing',
        'processing',
        'publishing',
        'published',
        'unknown',
      ].includes(job.status)
    )
      throw new HttpError(404, 'Mídia indisponível.')
    return this.repository.loadImage(job.snapshot.imagePath)
  }
  async runWorker(limit = 3) {
    const results: Array<{ id: string; status: string }> = [],
      start = Date.now()
    // Reserve up to 40s for the last job's API calls; don't start another late.
    while (results.length < limit && Date.now() - start < 10_000) {
      const [job] = await this.repository.claimDue(1)
      if (!job) break
      try {
        await this.process(job)
      } finally {
        await this.repository.releaseClaim(job.id, job.leaseToken!)
      }
      results.push({
        id: job.id,
        status:
          (await this.repository.getPublication(job.id))?.status ?? 'unknown',
      })
    }
    return results
  }
  private async process(job: PublicationRecord) {
    const lease = job.leaseToken!
    let dispatched = Boolean(job.operation?._dispatched)
    let publishingNow = false
    const update = async (
      patch: Parameters<SocialRepository['updateClaim']>[2],
    ) => {
      if (!(await this.repository.updateClaim(job.id, lease, patch)))
        throw new HttpError(409, 'Reserva do envio expirada.')
      Object.assign(job, patch)
    }
    try {
      const c = await this.repository.getConnection(
        job.workspaceId,
        job.connectionId,
      )
      const member = await this.access.getMembership(
        job.userId,
        job.workspaceId,
      )
      const billing = await this.access.getBillingStatus(job.workspaceId)
      const active =
        ['active', 'trialing'].includes(billing) ||
        (member?.role === 'owner' &&
          Boolean(await this.access.getActiveBillingWorkspaceId(job.userId))) ||
        (await this.access.getPlatformRole(job.userId)) === 'platform_owner'
      const modeMismatch = Boolean(c) && this.modeMismatch(c!.accountType)
      if (
        !c ||
        c.status === 'disconnected' ||
        modeMismatch ||
        !member ||
        !['owner', 'admin', 'editor'].includes(member.role) ||
        !active
      ) {
        await update({
          status: dispatched ? 'unknown' : 'cancelled',
          error: dispatched
            ? 'Verifique o resultado na rede; a autorização mudou durante o envio.'
            : modeMismatch
              ? 'Envio cancelado: a conta pertence a outro modo de publicação.'
              : 'Envio cancelado: conta, permissão ou plano indisponível.',
          nextAttemptAt: new Date(Date.now() + 600_000).toISOString(),
        })
        return
      }
      this.ensureConfigured(job.provider)
      const provider = this.provider(job.provider),
        tokens = await this.tokens(c)
      const bytes = await this.repository.loadImage(job.snapshot.imagePath)
      const imageUrl = `${this.appUrl}/api/social/media/${job.id}/${this.crypto.mediaToken(job.id, Date.now() + 4 * 60 * 60_000)}/image.jpg`
      const input: ProviderPublishInput = {
        format: 'static',
        externalAccountId: c.externalAccountId,
        tokens,
        caption: job.snapshot.caption,
        title: job.snapshot.title,
        imageUrl,
        imageBytes: bytes,
        options: job.snapshot.options,
        operation: job.operation ?? undefined,
      }
      if (
        dispatched ||
        job.status === 'unknown' ||
        job.status === 'publishing'
      ) {
        const result = await provider.reconcile(input, job.operation ?? {})
        await update({
          status: result.status,
          remotePostId: result.remotePostId ?? job.remotePostId,
          remoteUrl: result.remoteUrl ?? job.remoteUrl,
          operation: {
            ...(result.operation ?? job.operation),
            _dispatched: true,
          },
          error:
            result.message ??
            (result.status === 'unknown'
              ? 'Resultado ainda não confirmado. Verifique a rede antes de reenviar.'
              : null),
          nextAttemptAt: new Date(Date.now() + 600_000).toISOString(),
        })
        return
      }
      if (job.attempts > 60) {
        await update({
          status: 'failed',
          error: 'A mídia não concluiu o processamento no prazo.',
        })
        return
      }
      await update({ status: 'preparing' })
      const prepared = await provider.prepare(input)
      await update({
        operation: prepared.operation,
        status: prepared.ready ? 'preparing' : 'processing',
        nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
      })
      if (!prepared.ready) return
      const current = await this.repository.getConnection(
        job.workspaceId,
        job.connectionId,
      )
      if (current?.status !== 'connected') {
        await update({
          status: 'cancelled',
          error: 'Conta desconectada antes do envio.',
        })
        return
      }
      await update({
        status: 'publishing',
        operation: { ...prepared.operation, _dispatched: true },
      })
      dispatched = true
      publishingNow = true
      const result = await provider.publish(input, prepared.operation)
      await update({
        status: result.status,
        remotePostId: result.remotePostId ?? null,
        remoteUrl: result.remoteUrl ?? null,
        operation: {
          ...(result.operation ?? prepared.operation),
          _dispatched: true,
        },
        error: result.message ?? null,
        nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
      })
      if (
        result.status === 'published' &&
        result.remotePostId &&
        !result.remoteUrl
      ) {
        try {
          const link = await provider.reconcile(input, job.operation ?? {})
          if (link.status === 'published' && link.remoteUrl)
            await update({ remoteUrl: link.remoteUrl })
        } catch {
          /* confirmed post remains published when permalink lookup fails */
        }
      }
    } catch (error) {
      const kind = error instanceof ProviderError ? error.kind : null
      const knownRejection =
        publishingNow &&
        ['auth', 'rate_limit', 'validation'].includes(kind ?? '')
      if (kind === 'auth')
        await this.repository.updateConnection(
          job.workspaceId,
          job.connectionId,
          { status: 'needs_reconnect' },
        )
      const status =
        dispatched && !knownRejection
          ? 'unknown'
          : kind === 'auth'
            ? 'needs_reconnect'
            : kind === 'validation'
              ? 'failed'
              : job.attempts >= 8
                ? 'failed'
                : 'retry_wait'
      const message =
        error instanceof ProviderError
          ? error.message
          : error instanceof HttpError
            ? error.message
            : 'Falha no envio. Tente novamente após verificar a conexão.'
      const safeMessage = message
        .replace(
          /(access_token|refresh_token|client_secret)=[^\s&]+/gi,
          '$1=[protegido]',
        )
        .slice(0, 300)
      await this.repository.updateClaim(job.id, lease, {
        status,
        error: safeMessage,
        operation: knownRejection
          ? { ...job.operation, _dispatched: false }
          : job.operation,
        nextAttemptAt: new Date(
          Date.now() +
            (status === 'unknown'
              ? 600_000
              : Math.min(3600, 60 * 2 ** Math.min(job.attempts, 5)) * 1000),
        ).toISOString(),
      })
    }
  }
}
