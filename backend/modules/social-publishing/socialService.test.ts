// @vitest-environment node
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SocialService } from './socialService.js'
import { SocialCrypto } from './socialCrypto.js'
import { ProviderError, type SocialProvider } from './socialTypes.js'
import { InMemorySocialRepository } from '../../test/InMemorySocialRepository.js'
import { InMemoryWorkspaceAccessRepository } from '../tenancy/workspaceRepository.js'
import { createSocialProviders } from './providers/index.js'
import { createApp } from '../../app.js'
import { AuthService } from '../auth/authService.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../test/InMemoryAuthProvider.js'
import { InMemoryFinancialRepository } from '../../test/InMemoryFinancialRepository.js'

const workspace = randomUUID(),
  draftId = randomUUID(),
  connectionId = randomUUID(),
  userId = '00000000-0000-0000-0000-000000000001'
const imagePath = `${workspace}/draft/image.png`,
  imageUrl = `https://storage.test/storage/v1/object/sign/post-draft-images/${imagePath}?token=preview`
const encryption = new SocialCrypto(Buffer.alloc(32, 7).toString('base64'))
const config = {
  META_APP_ID: 'app',
  META_APP_SECRET: 'secret',
  SOCIAL_CRON_SECRET: 'c'.repeat(40),
  SOCIAL_SCHEDULER_ENABLED: 'true',
}
const input = {
  draftId,
  connectionId,
  consent: true as const,
  expectedDraft: {
    title: 'Post aprovado',
    caption: 'Legenda aprovada',
    hashtags: ['#post'],
    imageUrl,
  },
}
function fixture(role: 'owner' | 'editor' | 'viewer' = 'owner') {
  const repo = new InMemorySocialRepository(),
    access = new InMemoryWorkspaceAccessRepository(workspace, role)
  const provider: SocialProvider = {
    id: 'facebook',
    configured: true,
    scopes: ['pages_manage_posts'],
    authorizationUrl: ({ state }) =>
      `https://www.facebook.com/oauth?state=${state}`,
    exchangeCode: vi.fn(async () => ({ accessToken: 'secret-token' })),
    accounts: vi.fn(async () => [
      {
        externalAccountId: 'page',
        displayName: 'Página',
        accountType: 'Page',
        tokens: { accessToken: 'secret-token' },
      },
    ]),
    prepare: vi.fn(async () => ({
      ready: true,
      operation: { asset: 'uploaded' },
    })),
    publish: vi.fn(async () => ({
      status: 'published' as const,
      remotePostId: 'page_post',
      remoteUrl: 'https://www.facebook.com/page/posts/post',
    })),
    reconcile: vi.fn(async () => ({ status: 'unknown' as const })),
  }
  repo.connections.set(connectionId, {
    id: connectionId,
    workspaceId: workspace,
    userId,
    provider: 'facebook',
    externalAccountId: 'page',
    displayName: 'Página',
    accountType: 'Page',
    status: 'connected',
    expiresAt: null,
    createdAt: new Date().toISOString(),
    encryptedTokens: encryption.seal(
      { accessToken: 'secret-token' },
      `connection:${workspace}:facebook:page`,
    ),
  })
  repo.drafts.set(draftId, {
    id: draftId,
    workspaceId: workspace,
    provider: 'Facebook',
    title: input.expectedDraft.title,
    caption: input.expectedDraft.caption,
    hashtags: ['#post'],
    format: 'static',
    imagePath,
    timezone: 'America/Sao_Paulo',
  })
  const service = new SocialService({
    repository: repo,
    providers: [provider],
    access,
    crypto: encryption,
    appUrl: 'https://postflow.test',
    config,
  })
  const app = createApp({
    socialService: service,
    authService: new AuthService(new InMemoryAuthProvider()),
    financialRepository: new InMemoryFinancialRepository(),
    workspaceAccessRepository: access,
  })
  return { repo, provider, service, app }
}
beforeEach(() => vi.stubEnv('SOCIAL_CRON_SECRET', config.SOCIAL_CRON_SECRET))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
async function image(repo: InMemorySocialRepository) {
  repo.images.set(
    imagePath,
    await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer(),
  )
}
describe('social publishing safety and workflows', () => {
  it('fails closed without app/server configuration and never reports a connection', async () => {
    const f = fixture()
    const service = new SocialService({
      repository: f.repo,
      providers: [{ ...f.provider, configured: false }],
      access: new InMemoryWorkspaceAccessRepository(workspace, 'owner'),
      appUrl: 'https://postflow.test',
      crypto: encryption,
      config: {},
    })
    await expect(
      service.startOAuth(workspace, userId, 'facebook'),
    ).rejects.toMatchObject({ statusCode: 503 })
    expect(f.repo.sessions.size).toBe(0)
  })
  it('binds encryption to the workspace/account and media links to job/expiry', () => {
    const sealed = encryption.seal({ token: 'secret' }, 'tenant-a')
    expect(() => encryption.open(sealed, 'tenant-b')).toThrow()
    const token = encryption.mediaToken('job-a', Date.now() + 4 * 3600000)
    expect(encryption.validMediaToken('job-a', token)).toBe(true)
    expect(encryption.validMediaToken('job-b', token)).toBe(false)
    expect(new SocialCrypto('').validMediaToken('job-a', token)).toBe(false)
    expect(
      encryption.validMediaToken('job-a', token, Date.now() + 5 * 3600000),
    ).toBe(false)
  })
  it('consumes OAuth state once and hides account credentials from overview', async () => {
    const f = fixture()
    const started = await f.service.startOAuth(workspace, userId, 'facebook'),
      state = new URL(started.authorizationUrl).searchParams.get('state')!
    await expect(
      f.service.callback('another-user', 'facebook', state, 'code'),
    ).rejects.toMatchObject({ statusCode: 400 })
    await f.service.callback(userId, 'facebook', state, 'code')
    await expect(
      f.service.callback(userId, 'facebook', state, 'code'),
    ).rejects.toMatchObject({ statusCode: 400 })
    const overview = await f.service.overview(workspace, userId)
    expect(JSON.stringify(overview)).not.toContain('secret-token')
    const s = overview.pending[0]
    await expect(
      f.service.connect(randomUUID(), userId, s.id, 'page'),
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      f.service.connect(workspace, userId, s.id, 'other-page'),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(
      (await f.service.connect(workspace, userId, s.id, 'page')).status,
    ).toBe('connected')
  })
  it('limits pending OAuth sessions, not only ready sessions', async () => {
    const f = fixture()
    for (let n = 0; n < 10; n++)
      await f.service.startOAuth(workspace, userId, 'facebook')
    await expect(
      f.service.startOAuth(workspace, userId, 'facebook'),
    ).rejects.toMatchObject({ statusCode: 429 })
  })
  it('rejects wrong tenants, missing consent and unsaved/conflicting previews', async () => {
    const f = fixture()
    await image(f.repo)
    await expect(
      f.service.enqueue(randomUUID(), userId, input),
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      f.service.enqueue(workspace, userId, {
        ...input,
        expectedDraft: { ...input.expectedDraft, caption: 'stale' },
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    await expect(
      f.service.enqueue(workspace, userId, {
        ...input,
        consent: false as never,
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
    f.repo.drafts.get(draftId)!.format = 'reels'
    await expect(
      f.service.enqueue(workspace, userId, input),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(f.provider.publish).not.toHaveBeenCalled()
  })
  it('copies an approved immutable image/caption, deduplicates and runs with no browser', async () => {
    const f = fixture()
    await image(f.repo)
    const first = await f.service.enqueue(workspace, userId, input)
    expect((await f.service.enqueue(workspace, userId, input)).id).toBe(
      first.id,
    )
    f.repo.drafts.get(draftId)!.caption = 'edited later'
    f.repo.images.delete(imagePath)
    const result = await f.service.runWorker()
    expect(result[0].status).toBe('published')
    const sent = vi.mocked(f.provider.publish).mock.calls[0][0]
    expect(sent.caption).toBe('Legenda aprovada\n#post')
    expect(sent.imageBytes[0]).toBe(0xff)
    expect(f.provider.publish).toHaveBeenCalledTimes(1)
    expect(
      (await f.service.overview(workspace, userId)).publications[0].remoteUrl,
    ).toContain('facebook.com')
  })
  it('keeps a timed-out dispatch unknown and does not republish after reconciliation auth failure/reconnect', async () => {
    const f = fixture()
    await image(f.repo)
    vi.mocked(f.provider.publish).mockRejectedValue(
      new ProviderError('timeout', 'temporary'),
    )
    const job = await f.service.enqueue(workspace, userId, input)
    await f.service.runWorker()
    expect(f.repo.publications.get(job.id)!.status).toBe('unknown')
    vi.mocked(f.provider.reconcile).mockRejectedValue(
      new ProviderError('expired', 'auth'),
    )
    f.repo.publications.get(job.id)!.nextAttemptAt = new Date(0).toISOString()
    await f.service.runWorker()
    expect(f.repo.publications.get(job.id)!.operation?._dispatched).toBe(true)
    expect(f.repo.publications.get(job.id)!.status).toBe('unknown')
    f.repo.connections.get(connectionId)!.status = 'connected'
    f.repo.publications.get(job.id)!.nextAttemptAt = new Date(0).toISOString()
    vi.mocked(f.provider.reconcile).mockResolvedValue({
      status: 'published',
      remotePostId: 'confirmed',
    })
    await f.service.runWorker()
    expect(f.provider.publish).toHaveBeenCalledTimes(1)
    expect(f.repo.publications.get(job.id)!.status).toBe('published')
  })
  it('retries a temporary preparation read without recording a dispatch or duplicating an accepted post', async () => {
    const f = fixture()
    await image(f.repo)
    vi.mocked(f.provider.prepare).mockRejectedValueOnce(
      new ProviderError('Read timed out', 'temporary'),
    )
    const job = await f.service.enqueue(workspace, userId, input)
    await f.service.runWorker()
    expect(f.repo.publications.get(job.id)!.status).toBe('retry_wait')
    expect(f.repo.publications.get(job.id)!.operation?._dispatched).toBeFalsy()
    expect(f.provider.publish).not.toHaveBeenCalled()
    f.repo.publications.get(job.id)!.nextAttemptAt = new Date(0).toISOString()
    await f.service.runWorker()
    expect(f.provider.publish).toHaveBeenCalledTimes(1)
    expect(f.repo.publications.get(job.id)!.status).toBe('published')
  })
  it('rejects a composed LinkedIn caption over the network limit before storing an image or job', async () => {
    const f = fixture()
    f.repo.connections.get(connectionId)!.provider = 'linkedin'
    const d = f.repo.drafts.get(draftId)!
    d.provider = 'LinkedIn'
    d.caption = 'a'.repeat(2999)
    const service = new SocialService({
      repository: f.repo,
      providers: [{ ...f.provider, id: 'linkedin' }],
      access: new InMemoryWorkspaceAccessRepository(workspace, 'owner'),
      crypto: encryption,
      appUrl: 'https://postflow.test',
      config: {
        ...config,
        LINKEDIN_CLIENT_ID: 'id',
        LINKEDIN_CLIENT_SECRET: 'secret',
      },
    })
    await expect(
      service.enqueue(workspace, userId, {
        ...input,
        expectedDraft: { ...input.expectedDraft, caption: d.caption },
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(f.repo.publications.size).toBe(0)
    expect(f.repo.images.size).toBe(0)
  })
  it('resumes prepared media using its saved operation without duplicating publication', async () => {
    const f = fixture()
    await image(f.repo)
    vi.mocked(f.provider.prepare)
      .mockResolvedValueOnce({
        ready: false,
        operation: { containerId: 'saved' },
      })
      .mockResolvedValueOnce({
        ready: true,
        operation: { containerId: 'saved' },
      })
    const job = await f.service.enqueue(workspace, userId, input)
    await f.service.runWorker()
    expect(f.repo.publications.get(job.id)!.status).toBe('processing')
    f.repo.publications.get(job.id)!.nextAttemptAt = new Date(0).toISOString()
    await f.service.runWorker()
    expect(
      vi.mocked(f.provider.prepare).mock.calls[1][0].operation,
    ).toMatchObject({ containerId: 'saved' })
    expect(f.provider.publish).toHaveBeenCalledTimes(1)
  })
  it('refreshes an Instagram long-lived access token without a refresh_token before expiry', async () => {
    const f = fixture()
    await image(f.repo)
    const c = f.repo.connections.get(connectionId)!
    c.provider = 'instagram'
    c.expiresAt = new Date(Date.now() + 12 * 3600000).toISOString()
    c.encryptedTokens = encryption.seal(
      { accessToken: 'old-ig-token', expiresAt: c.expiresAt },
      `connection:${workspace}:instagram:page`,
    )
    f.repo.drafts.get(draftId)!.provider = 'Instagram'
    const refresh = vi.fn(async () => ({
      accessToken: 'fresh-ig-token',
      expiresAt: new Date(Date.now() + 60 * 86400000).toISOString(),
    }))
    const provider: SocialProvider = { ...f.provider, id: 'instagram', refresh }
    const service = new SocialService({
      repository: f.repo,
      providers: [provider],
      crypto: encryption,
      access: new InMemoryWorkspaceAccessRepository(workspace, 'owner'),
      appUrl: 'https://postflow.test',
      config: {
        ...config,
        INSTAGRAM_APP_ID: 'app',
        INSTAGRAM_APP_SECRET: 'secret',
      },
    })
    const job = await service.enqueue(workspace, userId, input)
    await service.runWorker()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(provider.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: expect.objectContaining({ accessToken: 'fresh-ig-token' }),
      }),
      expect.any(Object),
    )
    expect(f.repo.publications.get(job.id)!.status).toBe('published')
  })
  it('protects concurrent claims, cancels future jobs, and refuses cancellation after dispatch', async () => {
    const f = fixture()
    await image(f.repo)
    const future = await f.service.enqueue(workspace, userId, {
      ...input,
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    })
    expect(await f.repo.claimDue(1)).toEqual([])
    expect((await f.service.cancel(workspace, future.id)).status).toBe(
      'cancelled',
    )
    const job = await f.service.enqueue(workspace, userId, input)
    const [a, b] = await Promise.all([f.repo.claimDue(1), f.repo.claimDue(1)])
    expect(a.length + b.length).toBe(1)
    await f.repo.releaseClaim(job.id, a[0].leaseToken!)
    f.repo.publications.get(job.id)!.operation = { _dispatched: true }
    f.repo.publications.get(job.id)!.status = 'processing'
    await expect(f.service.cancel(workspace, job.id)).rejects.toMatchObject({
      statusCode: 409,
    })
    await f.service.disconnect(workspace, connectionId)
    expect(f.repo.publications.get(job.id)!.status).toBe('processing')
  })
  it('enforces authentication, workspace roles, strict payloads and the worker secret on actual Express routes', async () => {
    const f = fixture('viewer')
    const base = `/api/workspaces/${workspace}/social`
    expect((await request(f.app).get(`${base}/overview`)).status).toBe(401)
    expect(
      (
        await request(f.app)
          .get(`/api/workspaces/${randomUUID()}/social/overview`)
          .set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
      ).status,
    ).toBe(403)
    expect(
      (
        await request(f.app)
          .get(`${base}/overview`)
          .set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
      ).status,
    ).toBe(200)
    expect(
      (
        await request(f.app)
          .post(`${base}/publications`)
          .set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
          .send(input)
      ).status,
    ).toBe(403)
    expect((await request(f.app).post('/api/social/worker')).status).toBe(401)
    expect(
      (
        await request(f.app)
          .post('/api/social/worker')
          .set('Authorization', `Bearer ${config.SOCIAL_CRON_SECRET}`)
      ).status,
    ).toBe(200)
    const owner = fixture()
    expect(
      (
        await request(owner.app)
          .post(`${base}/publications`)
          .set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
          .send({ ...input, unexpected: 'field' })
      ).status,
    ).toBe(400)
  })
})

class NoPlanAccess extends InMemoryWorkspaceAccessRepository {
  private readonly accountBrand: string | null
  constructor(role: 'owner' | 'editor', accountBrand: string | null = null) {
    super(workspace, role, null, 'none')
    this.accountBrand = accountBrand
  }
  async getActiveBillingWorkspaceId() {
    return this.accountBrand
  }
}
class PlatformOwnerNoPlanAccess extends NoPlanAccess {
  async getPlatformRole() {
    return 'platform_owner' as const
  }
}
describe('social publishing demo mode', () => {
  const demoConfig: Record<string, string | undefined> = {
    ...config,
    SOCIAL_DEMO_MODE: 'true',
  }
  function demoFixture(
    options: {
      access?: InMemoryWorkspaceAccessRepository
      config?: Record<string, string | undefined>
    } = {},
  ) {
    const fetchSpy = vi.fn(async () => {
      throw new Error('network call in demo mode')
    })
    const repo = new InMemorySocialRepository()
    const service = new SocialService({
      repository: repo,
      providers: Object.values(
        createSocialProviders({
          demoMode: true,
          fetch: fetchSpy as unknown as typeof fetch,
        }),
      ),
      access:
        options.access ??
        new InMemoryWorkspaceAccessRepository(workspace, 'owner'),
      crypto: encryption,
      appUrl: 'https://postflow.test',
      config: options.config ?? demoConfig,
    })
    repo.drafts.set(draftId, {
      id: draftId,
      workspaceId: workspace,
      provider: 'Facebook',
      title: input.expectedDraft.title,
      caption: input.expectedDraft.caption,
      hashtags: ['#post'],
      format: 'static',
      imagePath,
      timezone: 'America/Sao_Paulo',
    })
    return { repo, service, fetchSpy }
  }
  async function connectDemo(f: ReturnType<typeof demoFixture>) {
    const started = await f.service.startOAuth(workspace, userId, 'facebook')
    const url = new URL(started.authorizationUrl)
    expect(url.searchParams.get('code')).toBe('demo-code')
    await f.service.callback(
      userId,
      'facebook',
      url.searchParams.get('state')!,
      url.searchParams.get('code')!,
    )
    const pending = (await f.service.overview(workspace, userId)).pending[0]
    return f.service.connect(workspace, userId, pending.id, 'demo-facebook')
  }
  function seedDemoConnection(f: ReturnType<typeof demoFixture>) {
    f.repo.connections.set(connectionId, {
      id: connectionId,
      workspaceId: workspace,
      userId,
      provider: 'facebook',
      externalAccountId: 'demo-facebook',
      displayName: 'Facebook — conta de demonstração',
      accountType: 'demo',
      status: 'connected',
      expiresAt: null,
      createdAt: new Date().toISOString(),
      encryptedTokens: encryption.seal(
        { accessToken: 'demo-token' },
        `connection:${workspace}:facebook:demo-facebook`,
      ),
    })
    return { id: connectionId }
  }
  it('runs the whole flow to a simulated published post without any network call', async () => {
    const f = demoFixture()
    await image(f.repo)
    const connection = await connectDemo(f)
    expect(connection).toMatchObject({
      accountType: 'demo',
      externalAccountId: 'demo-facebook',
      displayName: 'Facebook — conta de demonstração',
    })
    const job = await f.service.enqueue(workspace, userId, {
      ...input,
      connectionId: connection.id,
    })
    const [result] = await f.service.runWorker()
    expect(result.status).toBe('published')
    const overview = await f.service.overview(workspace, userId)
    expect(overview.demoMode).toBe(true)
    const publication = overview.publications.find((p) => p.id === job.id)!
    expect(publication).toMatchObject({
      status: 'published',
      simulated: true,
      remoteUrl: null,
    })
    expect(publication.remotePostId).toMatch(/^demo-/)
    expect(f.repo.publications.get(job.id)!.operation).toMatchObject({
      demo: true,
      _dispatched: true,
    })
    expect(f.fetchSpy).not.toHaveBeenCalled()
  })
  it('keeps simulated true when the worker reconciles an unknown dispatch', async () => {
    const f = demoFixture()
    await image(f.repo)
    const connection = await connectDemo(f)
    const job = await f.service.enqueue(workspace, userId, {
      ...input,
      connectionId: connection.id,
    })
    const record = f.repo.publications.get(job.id)!
    record.status = 'unknown'
    record.operation = { demo: true, _dispatched: true }
    await f.service.runWorker()
    expect(f.repo.publications.get(job.id)!.status).toBe('published')
    expect(
      (await f.service.overview(workspace, userId)).publications[0].simulated,
    ).toBe(true)
  })
  it('still requires the cron secret and the encryption key', async () => {
    const noCron = demoFixture({
      config: { ...demoConfig, SOCIAL_CRON_SECRET: undefined },
    })
    await expect(
      noCron.service.startOAuth(workspace, userId, 'facebook'),
    ).rejects.toMatchObject({ statusCode: 503 })
    const noKey = new SocialService({
      repository: new InMemorySocialRepository(),
      providers: Object.values(createSocialProviders({ demoMode: true })),
      access: new InMemoryWorkspaceAccessRepository(workspace, 'owner'),
      crypto: new SocialCrypto(''),
      appUrl: 'https://postflow.test',
      config: demoConfig,
    })
    await expect(
      noKey.startOAuth(workspace, userId, 'facebook'),
    ).rejects.toMatchObject({ statusCode: 503 })
    const overview = await noKey.overview(workspace, userId)
    expect(overview.providers.every((p) => !p.configured)).toBe(true)
    expect(overview.providers[0].missingConfiguration).toContain(
      'SOCIAL_TOKEN_ENCRYPTION_KEY',
    )
  })
  it('does not require app credentials or TikTok approvals in demo mode', async () => {
    const f = demoFixture({
      config: {
        SOCIAL_DEMO_MODE: 'true',
        SOCIAL_CRON_SECRET: config.SOCIAL_CRON_SECRET,
        SOCIAL_SCHEDULER_ENABLED: 'true',
      },
    })
    const overview = await f.service.overview(workspace, userId)
    expect(overview.providers.map((p) => p.configured)).toEqual([
      true,
      true,
      true,
      true,
    ])
    expect(
      overview.providers.every((p) => !p.missingConfiguration.length),
    ).toBe(true)
  })
  it('keeps the member role check on the callback', async () => {
    const f = demoFixture({
      access: new InMemoryWorkspaceAccessRepository(workspace, 'editor'),
    })
    const started = await f.service.startOAuth(workspace, userId, 'facebook')
    const state = new URL(started.authorizationUrl).searchParams.get('state')!
    await expect(
      f.service.callback(userId, 'facebook', state, 'demo-code'),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect((await f.service.overview(workspace, userId)).pending).toEqual([])
    expect(f.repo.connections.size).toBe(0)
  })
  it('cancels a demo job for a plan-less brand when the member has no account plan', async () => {
    const f = demoFixture({ access: new NoPlanAccess('editor') })
    await image(f.repo)
    const connection = seedDemoConnection(f)
    const job = await f.service.enqueue(workspace, userId, {
      ...input,
      connectionId: connection.id,
    })
    await f.service.runWorker()
    expect(f.repo.publications.get(job.id)!.status).toBe('cancelled')
    expect(f.fetchSpy).not.toHaveBeenCalled()
  })
  it('publishes for a brand owner who pays through an account-level brand', async () => {
    const f = demoFixture({ access: new NoPlanAccess('owner', 'paid-brand') })
    await image(f.repo)
    const connection = seedDemoConnection(f)
    const job = await f.service.enqueue(workspace, userId, {
      ...input,
      connectionId: connection.id,
    })
    await f.service.runWorker()
    expect(f.repo.publications.get(job.id)!.status).toBe('published')
  })
  it('lets a platform owner publish for a plan-less brand', async () => {
    const f = demoFixture({ access: new PlatformOwnerNoPlanAccess('editor') })
    await image(f.repo)
    const connection = seedDemoConnection(f)
    const job = await f.service.enqueue(workspace, userId, {
      ...input,
      connectionId: connection.id,
    })
    await f.service.runWorker()
    expect(f.repo.publications.get(job.id)!.status).toBe('published')
  })
  it('keeps the real adapters when the flag is absent or not exactly true', async () => {
    for (const value of [undefined, 'false', 'TRUE', '1']) {
      const service = new SocialService({
        repository: new InMemorySocialRepository(),
        providers: Object.values(createSocialProviders()),
        access: new InMemoryWorkspaceAccessRepository(workspace, 'owner'),
        crypto: encryption,
        appUrl: 'https://postflow.test',
        config: {
          SOCIAL_CRON_SECRET: config.SOCIAL_CRON_SECRET,
          SOCIAL_SCHEDULER_ENABLED: 'true',
          SOCIAL_DEMO_MODE: value,
        },
      })
      const overview = await service.overview(workspace, userId)
      expect(overview.demoMode).toBe(false)
      expect(overview.providers).toHaveLength(4)
      expect(overview.providers.every((p) => !p.configured)).toBe(true)
      expect(overview.providers[0].missingConfiguration).toEqual([
        'META_APP_ID',
        'META_APP_SECRET',
      ])
      expect(overview.providers[3].missingConfiguration).toEqual(
        expect.arrayContaining([
          'TIKTOK_CLIENT_KEY',
          'TIKTOK_MEDIA_DOMAIN_VERIFIED',
          'TIKTOK_DIRECT_POST_APPROVED',
        ]),
      )
    }
  })
})
