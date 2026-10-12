import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSocialProviders } from './index.js'
import { createFacebookPagesProvider } from './facebookPages.js'
import { createInstagramLoginProvider } from './instagramLogin.js'
import { createLinkedInMemberProvider } from './linkedinMember.js'
import { createTikTokDirectPostProvider } from './tiktokDirectPost.js'
import type { ProviderPublishInput } from '../socialTypes.js'

interface FetchCall {
  url: string
  init: RequestInit
}
function mockFetch(
  responses: Array<
    | { status?: number; body?: unknown; headers?: Record<string, string> }
    | Response
  >,
) {
  const calls: FetchCall[] = []
  const fetcher = (async (
    input: string | URL | Request,
    init: RequestInit = {},
  ) => {
    calls.push({ url: String(input), init })
    const next = responses.shift()
    if (!next) throw new Error('Unexpected provider request')
    if (next instanceof Response) return next
    return new Response(
      next.body === undefined ? null : JSON.stringify(next.body),
      {
        status: next.status ?? 200,
        headers: { 'Content-Type': 'application/json', ...next.headers },
      },
    )
  }) as typeof fetch
  return { fetcher, calls }
}

const commonInput: ProviderPublishInput = {
  externalAccountId: 'acct-123',
  tokens: {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    scopes: ['test'],
  },
  caption: 'Legenda de teste #PostFlow',
  title: 'Título de teste',
  imageUrl: 'https://media.example.test/image.jpg?signature=one-hour',
  imageBytes: new Uint8Array([1, 2, 3]),
  options: {
    privacyLevel: 'PUBLIC_TO_EVERYONE',
    disableComment: false,
    isAiGenerated: true,
    brandContentToggle: false,
    brandOrganicToggle: false,
  },
}
const staticTikTokInput = {
  ...commonInput,
  format: 'static',
} as ProviderPublishInput

describe('social publishing provider adapters', () => {
  beforeEach(() => vi.unstubAllEnvs())

  it('keeps all providers disabled until server credentials and TikTok approval gates exist', () => {
    vi.stubEnv('META_APP_ID', '')
    vi.stubEnv('META_APP_SECRET', '')
    vi.stubEnv('INSTAGRAM_APP_ID', '')
    vi.stubEnv('INSTAGRAM_APP_SECRET', '')
    vi.stubEnv('LINKEDIN_CLIENT_ID', '')
    vi.stubEnv('LINKEDIN_CLIENT_SECRET', '')
    vi.stubEnv('TIKTOK_CLIENT_KEY', 'configured')
    vi.stubEnv('TIKTOK_CLIENT_SECRET', 'configured')
    vi.stubEnv('TIKTOK_MEDIA_DOMAIN_VERIFIED', 'false')
    vi.stubEnv('TIKTOK_DIRECT_POST_APPROVED', 'false')
    const providers = createSocialProviders({ fetch: mockFetch([]).fetcher })
    expect(
      Object.values(providers).map(({ configured }) => configured),
    ).toEqual([false, false, false, false])
    expect(() =>
      providers.tiktok.authorizationUrl({
        state: 's',
        redirectUri: 'https://app.test/callback',
        codeChallenge: 'c',
      }),
    ).toThrow(/domínio de mídia verificado/)
  })

  it('requires the Instagram Login credentials instead of silently using the Facebook app ID', () => {
    vi.stubEnv('META_APP_ID', 'meta-id')
    vi.stubEnv('META_APP_SECRET', 'meta-secret')
    vi.stubEnv('INSTAGRAM_APP_ID', '')
    vi.stubEnv('INSTAGRAM_APP_SECRET', '')
    const providers = createSocialProviders({ fetch: mockFetch([]).fetcher })
    expect(providers.instagram.configured).toBe(false)
    vi.stubEnv('INSTAGRAM_APP_ID', 'instagram-id')
    vi.stubEnv('INSTAGRAM_APP_SECRET', 'instagram-secret')
    const explicit = createSocialProviders({ fetch: mockFetch([]).fetcher })
    expect(explicit.instagram.configured).toBe(true)
    const auth = new URL(
      explicit.instagram.authorizationUrl({
        state: 'state',
        redirectUri: 'https://app.test/callback',
        codeChallenge: 'challenge',
      }),
    )
    expect(auth.searchParams.get('client_id')).toBe('instagram-id')
  })

  it('uses the TikTok user OAuth scope syntax and PKCE with the client_key parameter', () => {
    const { fetcher } = mockFetch([])
    const provider = createTikTokDirectPostProvider(
      { fetch: fetcher },
      {
        clientKey: 'key-1',
        clientSecret: 'secret-1',
        mediaDomainVerified: true,
        directPostApproved: true,
      },
    )
    const url = new URL(
      provider.authorizationUrl({
        state: 'state-1',
        redirectUri: 'https://app.test/oauth/tiktok',
        codeChallenge: 'challenge',
      }),
    )
    expect(url.searchParams.get('client_key')).toBe('key-1')
    expect(url.searchParams.has('client_id')).toBe(false)
    expect(url.searchParams.get('scope')).toBe('user.info.basic,video.publish')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('prepares TikTok without side effects, publishes one photo and reconciles without reposting', async () => {
    const { fetcher, calls } = mockFetch([
      {
        body: {
          data: {
            privacy_level_options: ['PUBLIC_TO_EVERYONE'],
            creator_username: 'creator',
            creator_nickname: 'Creator',
            comment_disabled: false,
          },
        },
      },
      {
        body: {
          data: { publish_id: 'p_pub_url~v2.123' },
          error: { code: 'ok', message: '' },
        },
      },
      {
        body: {
          data: {
            status: 'PUBLISH_COMPLETE',
            publicaly_available_post_id: ['98765'],
          },
          error: { code: 'ok' },
        },
      },
    ])
    const provider = createTikTokDirectPostProvider(
      { fetch: fetcher },
      {
        clientKey: 'key',
        clientSecret: 'secret',
        mediaDomainVerified: true,
        directPostApproved: true,
      },
    )
    const prepared = await provider.prepare(staticTikTokInput)
    expect(prepared.ready).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/creator_info/query/')
    const result = await provider.publish(staticTikTokInput, prepared.operation)
    expect(result.status).toBe('processing')
    const postRequest = calls[1]
    expect(postRequest.url).toContain('/v2/post/publish/content/init/')
    const body = JSON.parse(String(postRequest.init.body))
    expect(body.media_type).toBe('PHOTO')
    expect(body.post_mode).toBe('DIRECT_POST')
    expect(body.source_info.photo_images).toEqual([commonInput.imageUrl])
    expect(body.is_aigc).toBe(true)
    const reconciled = await provider.reconcile(
      staticTikTokInput,
      result.operation!,
    )
    expect(reconciled).toMatchObject({
      status: 'published',
      remotePostId: '98765',
    })
    expect(
      calls.filter((call) => call.url.includes('/content/init/')),
    ).toHaveLength(1)
  })

  it('leaves a creator-info timeout before TikTok dispatch retryable without sending content', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error('timeout')
    })
    const provider = createTikTokDirectPostProvider(
      { fetch: fetcher as typeof fetch },
      {
        clientKey: 'key',
        clientSecret: 'secret',
        mediaDomainVerified: true,
        directPostApproved: true,
      },
    )
    await expect(provider.prepare(staticTikTokInput)).rejects.toMatchObject({
      kind: 'temporary',
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(String(fetcher.mock.calls[0][0])).toContain('/creator_info/query/')
  })
  it.each(['carousel', 'reels'])(
    'rejects TikTok %s before any network request',
    async (format) => {
      const { fetcher, calls } = mockFetch([])
      const provider = createTikTokDirectPostProvider(
        { fetch: fetcher },
        {
          clientKey: 'key',
          clientSecret: 'secret',
          mediaDomainVerified: true,
          directPostApproved: true,
        },
      )
      await expect(
        provider.prepare({ ...commonInput, format } as ProviderPublishInput),
      ).rejects.toThrow(/somente posts estáticos/)
      expect(calls).toHaveLength(0)
    },
  )

  it('does not repeat TikTok publish after an unknown dispatch without a publish ID', async () => {
    const { fetcher, calls } = mockFetch([])
    const provider = createTikTokDirectPostProvider(
      { fetch: fetcher },
      {
        clientKey: 'key',
        clientSecret: 'secret',
        mediaDomainVerified: true,
        directPostApproved: true,
      },
    )
    const result = await provider.reconcile(staticTikTokInput, {
      kind: 'tiktok_photo_direct_post',
      _dispatched: true,
    })
    expect(result.status).toBe('unknown')
    expect(calls).toHaveLength(0)
  })

  it('sanitizes authentication and timeout failures without echoing credentials or API bodies', async () => {
    const unauthorized = mockFetch([
      {
        status: 401,
        body: {
          error: {
            code: 'access_token_invalid',
            message: 'secret-token-value',
          },
        },
      },
    ])
    const provider = createTikTokDirectPostProvider(
      { fetch: unauthorized.fetcher },
      {
        clientKey: 'key',
        clientSecret: 'secret',
        mediaDomainVerified: true,
        directPostApproved: true,
      },
    )
    await expect(provider.accounts(commonInput.tokens)).rejects.toMatchObject({
      kind: 'auth',
    })

    const failingFetch = (async () => {
      throw new Error('secret-token-value')
    }) as typeof fetch
    const timedOut = createTikTokDirectPostProvider(
      { fetch: failingFetch },
      {
        clientKey: 'key',
        clientSecret: 'secret',
        mediaDomainVerified: true,
        directPostApproved: true,
      },
    )
    await expect(timedOut.accounts(commonInput.tokens)).rejects.toMatchObject({
      kind: 'temporary',
      message: 'A rede social não respondeu a tempo.',
    })
  })

  it('publishes a Facebook Page photo with the selected Page token and returns the post ID', async () => {
    const { fetcher, calls } = mockFetch([
      {
        body: {
          data: [
            {
              id: 'page-7',
              name: 'Cliente Page',
              category: 'Community',
              access_token: 'page-token',
            },
          ],
        },
      },
      { body: { id: 'photo-9', post_id: 'page_7_post_9' } },
    ])
    const provider = createFacebookPagesProvider(
      { fetch: fetcher },
      {
        appId: 'app-id',
        appSecret: 'app-secret',
        graphVersion: 'v26.0',
      },
    )
    const accounts = await provider.accounts({ accessToken: 'user-token' })
    expect(accounts[0]).toMatchObject({
      externalAccountId: 'page-7',
      displayName: 'Cliente Page',
      tokens: { accessToken: 'page-token' },
    })
    const input = {
      ...commonInput,
      externalAccountId: 'page-7',
      tokens: accounts[0].tokens,
    }
    const result = await provider.publish(input, {
      kind: 'facebook_page_photo',
    })
    expect(result).toMatchObject({
      status: 'published',
      remotePostId: 'page_7_post_9',
    })
    expect(calls[1].url).toContain('/v26.0/page-7/photos')
    expect(calls[1].init.headers).toMatchObject({
      Authorization: 'Bearer page-token',
    })
    expect(String(calls[1].init.body)).toContain(
      encodeURIComponent(input.imageUrl),
    )
  })

  it('creates and polls an Instagram Login image container, reuses it, then publishes once', async () => {
    const { fetcher, calls } = mockFetch([
      { body: { id: 'container-1' } },
      { body: { status_code: 'FINISHED' } },
      { body: { id: 'media-1' } },
      { body: { status_code: 'PUBLISHED' } },
    ])
    const provider = createInstagramLoginProvider(
      { fetch: fetcher },
      {
        appId: 'ig-id',
        appSecret: 'ig-secret',
        graphVersion: 'v26.0',
      },
    )
    const prepared = await provider.prepare(commonInput)
    expect(prepared).toMatchObject({
      ready: true,
      operation: { containerId: 'container-1', phase: 'ready' },
    })
    expect(
      (await provider.publish(commonInput, prepared.operation)).remotePostId,
    ).toBe('media-1')
    const reconciled = await provider.reconcile(commonInput, {
      containerId: 'container-1',
      phase: 'publish_unknown',
      _dispatched: true,
    })
    expect(reconciled.status).toBe('published')
    expect(
      calls.filter((call) => call.url.includes('/media_publish')),
    ).toHaveLength(1)
    expect(calls[0].url).toContain('image_url=https%3A%2F%2Fmedia.example.test')
  })

  it('reuses an existing Instagram container while processing instead of creating duplicates', async () => {
    const { fetcher, calls } = mockFetch([
      { body: { status_code: 'IN_PROGRESS' } },
    ])
    const provider = createInstagramLoginProvider(
      { fetch: fetcher },
      { appId: 'id', appSecret: 'secret' },
    )
    const prepared = await provider.prepare({
      ...commonInput,
      operation: { kind: 'instagram_image_container', containerId: 'existing' },
    })
    expect(prepared.ready).toBe(false)
    expect(prepared.operation.containerId).toBe('existing')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/existing?')
  })

  it('uploads a LinkedIn member image before publishing through the self-serve Share API', async () => {
    const { fetcher, calls } = mockFetch([
      { body: { sub: 'member-22', name: 'Membro' } },
      {
        body: {
          value: {
            asset: 'urn:li:digitalmediaAsset:abc',
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://www.linkedin.com/dms-uploads/signed',
              },
            },
          },
        },
      },
      new Response(null, { status: 201 }),
      new Response(null, {
        status: 201,
        headers: { 'x-restli-id': 'urn:li:share:123' },
      }),
    ])
    const provider = createLinkedInMemberProvider(
      { fetch: fetcher },
      {
        clientId: 'client',
        clientSecret: 'secret',
      },
    )
    const accounts = await provider.accounts({ accessToken: 'member-token' })
    expect(accounts[0].externalAccountId).toBe('member-22')
    const input = {
      ...commonInput,
      externalAccountId: 'member-22',
      tokens: accounts[0].tokens,
    }
    const prepared = await provider.prepare(input)
    expect(prepared.operation.imageUrn).toBe('urn:li:digitalmediaAsset:abc')
    const result = await provider.publish(input, prepared.operation)
    expect(result).toMatchObject({
      status: 'published',
      remotePostId: 'urn:li:share:123',
    })
    expect(calls[1].url).toContain('/v2/assets?action=registerUpload')
    expect(calls[2].init.method).toBe('PUT')
    expect(calls[3].url).toContain('/v2/ugcPosts')
    expect(calls[3].init.headers).toMatchObject({
      Authorization: 'Bearer member-token',
    })
    expect(JSON.parse(String(calls[3].init.body))).toMatchObject({
      author: 'urn:li:person:member-22',
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareMediaCategory: 'IMAGE',
          media: [{ media: 'urn:li:digitalmediaAsset:abc' }],
        },
      },
    })
  })

  it('keeps LinkedIn ambiguous member outcomes unknown instead of retrying or requiring restricted reads', async () => {
    const provider = createLinkedInMemberProvider(
      { fetch: mockFetch([]).fetcher },
      { clientId: 'id', clientSecret: 'secret' },
    )
    const result = await provider.reconcile(commonInput, { _dispatched: true })
    expect(result.status).toBe('unknown')
  })
})
