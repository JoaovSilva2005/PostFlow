import type {
  SocialProvider,
  ProviderAccount,
  ProviderResult,
} from '../socialTypes.js'
import {
  authorizationUrl,
  formBody,
  queryUrl,
  requestJson,
  tokensFromResponse,
  type ProviderEnvironment,
} from './common.js'
import { ProviderError } from '../socialTypes.js'

const SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
]

export function createFacebookPagesProvider(
  env: ProviderEnvironment,
  config: { appId?: string; appSecret?: string; graphVersion: string },
): SocialProvider {
  const configured = Boolean(config.appId && config.appSecret)
  const graph = `https://graph.facebook.com/${config.graphVersion}`
  const requireConfigured = () => {
    if (!configured)
      throw new ProviderError(
        'A integração com Facebook Pages não está configurada.',
        'auth',
      )
  }
  return {
    id: 'facebook',
    configured,
    scopes: SCOPES,
    authorizationUrl(input) {
      requireConfigured()
      return authorizationUrl(
        `https://www.facebook.com/${config.graphVersion}/dialog/oauth`,
        config.appId!,
        SCOPES,
        input,
      )
    },
    async exchangeCode({ code, redirectUri }) {
      requireConfigured()
      const shortLived = tokensFromResponse(
        await requestJson(
          env,
          queryUrl(`${graph}/oauth/access_token`, {
            client_id: config.appId!,
            client_secret: config.appSecret!,
            redirect_uri: redirectUri,
            code,
          }),
        ),
        SCOPES,
      )
      return tokensFromResponse(
        await requestJson(
          env,
          queryUrl(`${graph}/oauth/access_token`, {
            grant_type: 'fb_exchange_token',
            client_id: config.appId!,
            client_secret: config.appSecret!,
            fb_exchange_token: shortLived.accessToken,
          }),
        ),
        SCOPES,
      )
    },
    async accounts(tokens): Promise<ProviderAccount[]> {
      requireConfigured()
      const response = await requestJson(
        env,
        queryUrl(`${graph}/me/accounts`, {
          fields: 'id,name,category,access_token,tasks',
        }),
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      )
      if (!Array.isArray(response.data))
        throw new ProviderError(
          'Facebook não retornou as Páginas disponíveis.',
          'temporary',
        )
      return response.data.flatMap((raw) => {
        if (!raw || typeof raw !== 'object') return []
        const page = raw as Record<string, unknown>
        if (
          typeof page.id !== 'string' ||
          typeof page.name !== 'string' ||
          typeof page.access_token !== 'string'
        )
          return []
        return [
          {
            externalAccountId: page.id,
            displayName: page.name,
            accountType:
              typeof page.category === 'string'
                ? page.category
                : 'Facebook Page',
            tokens: {
              accessToken: page.access_token,
              ...(tokens.scopes ? { scopes: tokens.scopes } : {}),
            },
          },
        ]
      })
    },
    async prepare(input) {
      requireConfigured()
      if (!input.imageUrl.startsWith('https://'))
        throw new ProviderError(
          'A imagem precisa de uma URL HTTPS acessível pela Meta.',
          'validation',
        )
      return {
        ready: true,
        operation: {
          kind: 'facebook_page_photo',
          pageId: input.externalAccountId,
        },
      }
    },
    async publish(input, operation): Promise<ProviderResult> {
      requireConfigured()
      const url = queryUrl(
        `${graph}/${encodeURIComponent(input.externalAccountId)}/photos`,
        {},
      )
      const body = formBody({ url: input.imageUrl, caption: input.caption })
      const response = await requestJson(env, url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.tokens.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      const id =
        typeof response.post_id === 'string'
          ? response.post_id
          : typeof response.id === 'string'
            ? response.id
            : undefined
      if (!id)
        throw new ProviderError(
          'Facebook não confirmou o identificador da publicação.',
          'temporary',
        )
      return {
        status: 'published',
        remotePostId: id,
        operation: { ...operation, remotePostId: id },
      }
    },
    async reconcile(input, operation): Promise<ProviderResult> {
      const id =
        typeof operation.remotePostId === 'string'
          ? operation.remotePostId
          : undefined
      if (!id)
        return {
          status: 'unknown',
          operation,
          message:
            'Facebook não forneceu um ID para confirmar esta publicação.',
        }
      const response = await requestJson(
        env,
        queryUrl(`${graph}/${encodeURIComponent(id)}`, {
          fields: 'id,permalink_url',
        }),
        { headers: { Authorization: `Bearer ${input.tokens.accessToken}` } },
      )
      return {
        status: 'published',
        remotePostId: id,
        ...(typeof response.permalink_url === 'string'
          ? { remoteUrl: response.permalink_url }
          : {}),
        operation,
      }
    },
  }
}
