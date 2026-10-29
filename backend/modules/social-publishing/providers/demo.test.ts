// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createDemoProvider } from './demo.js'
import { SOCIAL_PROVIDERS } from '../../../../shared/domain/socialPublishing.js'

const publishInput = {
  externalAccountId: 'demo-instagram',
  tokens: { accessToken: 'demo-token' },
  caption: 'Legenda',
  title: 'Título',
  imageUrl: 'https://postflow.test/image.jpg',
  imageBytes: new Uint8Array([0xff]),
}

describe('demo social provider', () => {
  it('builds an authorization url that returns immediately with the state', () => {
    const url = createDemoProvider('instagram').authorizationUrl({
      state: 'a b&c',
      redirectUri: 'https://postflow.test/api/social/callback/instagram',
      codeChallenge: 'x',
    })
    expect(url).toBe(
      'https://postflow.test/api/social/callback/instagram?code=demo-code&state=a%20b%26c',
    )
  })
  it('exchanges the code for a demo token and returns the fixed demo account', async () => {
    const provider = createDemoProvider('linkedin')
    expect(provider.configured).toBe(true)
    expect(provider.scopes).toEqual([])
    const tokens = await provider.exchangeCode({
      code: 'demo-code',
      redirectUri: 'x',
      codeVerifier: 'y',
    })
    expect(tokens.accessToken).toBe('demo-token')
    expect(Date.parse(tokens.expiresAt!)).toBeGreaterThan(
      Date.now() + 59 * 86400000,
    )
    const accounts = await provider.accounts(tokens)
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toMatchObject({
      externalAccountId: 'demo-linkedin',
      accountType: 'demo',
      displayName: 'LinkedIn — conta de demonstração',
      tokens: { accessToken: 'demo-token' },
    })
    const refreshed = await provider.refresh!(tokens)
    expect(refreshed.accessToken).toBe('demo-token')
  })
  it('publishes with a demo- remote id, no url and the demo operation flag', async () => {
    const provider = createDemoProvider('facebook')
    const prepared = await provider.prepare(publishInput)
    expect(prepared).toEqual({ operation: { demo: true }, ready: true })
    const result = await provider.publish(publishInput, prepared.operation)
    expect(result.status).toBe('published')
    expect(result.remotePostId).toMatch(/^demo-/)
    expect(result.remoteUrl).toBeUndefined()
    expect(result.operation?.demo).toBe(true)
    const again = await provider.reconcile(publishInput, {
      demo: true,
      remotePostId: 'demo-fixed',
    })
    expect(again.remotePostId).toBe('demo-fixed')
  })
  it('exposes creator info only for tiktok', async () => {
    for (const id of SOCIAL_PROVIDERS)
      expect(typeof createDemoProvider(id).creatorInfo).toBe(
        id === 'tiktok' ? 'function' : 'undefined',
      )
    const info = await createDemoProvider('tiktok').creatorInfo!(
      { accessToken: 'demo-token' },
      'demo-tiktok',
    )
    expect(info.privacyLevelOptions).toEqual([
      'SELF_ONLY',
      'PUBLIC_TO_EVERYONE',
    ])
    expect(info.commentDisabled).toBe(false)
    expect(info.duetDisabled).toBe(false)
    expect(info.stitchDisabled).toBe(false)
  })
})
