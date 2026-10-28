import { randomUUID } from 'node:crypto'
import type { SocialProviderId } from '../../../../shared/domain/socialPublishing.js'
import { DEMO_ACCOUNT_TYPE } from '../../../../shared/domain/socialPublishing.js'
import type {
  OAuthTokens,
  ProviderResult,
  SocialProvider,
} from '../socialTypes.js'

const labels: Record<SocialProviderId, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
}
const DEMO_TOKEN = 'demo-token'
const TOKEN_LIFETIME_MS = 60 * 86_400_000

function demoTokens(): OAuthTokens {
  return {
    accessToken: DEMO_TOKEN,
    expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString(),
  }
}

/**
 * Adaptador de demonstração: executa o fluxo real do módulo sem nenhuma
 * chamada de rede. Não recebe `fetch` de propósito.
 */
export function createDemoProvider(id: SocialProviderId): SocialProvider {
  const published = (operation: Record<string, unknown>): ProviderResult => ({
    status: 'published',
    remotePostId:
      typeof operation.remotePostId === 'string' && operation.remotePostId
        ? operation.remotePostId
        : `demo-${randomUUID()}`,
    remoteUrl: undefined,
    operation: { demo: true },
  })
  const provider: SocialProvider = {
    id,
    configured: true,
    scopes: [],
    authorizationUrl: ({ state, redirectUri }) =>
      `${redirectUri}?code=demo-code&state=${encodeURIComponent(state)}`,
    exchangeCode: async () => demoTokens(),
    accounts: async (tokens) => [
      {
        externalAccountId: `demo-${id}`,
        displayName: `${labels[id]} — conta de demonstração`,
        accountType: DEMO_ACCOUNT_TYPE,
        tokens,
      },
    ],
    refresh: async () => demoTokens(),
    prepare: async () => ({ operation: { demo: true }, ready: true }),
    publish: async () => published({}),
    reconcile: async (_input, operation) => published(operation),
  }
  if (id === 'tiktok')
    provider.creatorInfo = async () => ({
      creatorUsername: 'demo-tiktok',
      creatorNickname: 'TikTok — conta de demonstração',
      privacyLevelOptions: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'],
      commentDisabled: false,
      duetDisabled: false,
      stitchDisabled: false,
    })
  return provider
}
