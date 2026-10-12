import {
  ProviderError,
  type SocialProvider,
  type ProviderAccount,
  type ProviderPublishInput,
  type ProviderResult,
} from '../socialTypes.js'
import {
  authorizationUrl,
  bearer,
  queryUrl,
  requestJson,
  tokensFromResponse,
  type ProviderEnvironment,
} from './common.js'

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
]
const graphVersionFallback = 'v26.0'

type Operation = Record<string, unknown> & {
  kind?: string
  containerId?: string
  mediaId?: string
  phase?: string
}

function operationOf(input: ProviderPublishInput): Operation {
  return ((input as ProviderPublishInput & { operation?: Operation })
    .operation ?? {}) as Operation
}

export function createInstagramLoginProvider(
  env: ProviderEnvironment,
  config: { appId?: string; appSecret?: string; graphVersion?: string },
): SocialProvider {
  const configured = Boolean(config.appId && config.appSecret)
  const version = config.graphVersion ?? graphVersionFallback
  const graph = `https://graph.instagram.com/${version}`
  const requireConfigured = () => {
    if (!configured)
      throw new ProviderError(
        'A integração com Instagram não está configurada.',
        'auth',
      )
  }
  return {
    id: 'instagram',
    configured,
    scopes: SCOPES,
    authorizationUrl(input) {
      requireConfigured()
      const url = new URL(
        authorizationUrl(
          'https://www.instagram.com/oauth/authorize',
          config.appId!,
          SCOPES,
          input,
          {
            force_authentication: '1',
            enable_fb_login: '0',
          },
        ),
      )
      url.searchParams.set('scope', SCOPES.join(','))
      return url.toString()
    },
    async exchangeCode({ code, redirectUri }) {
      requireConfigured()
      const form = new FormData()
      form.set('client_id', config.appId!)
      form.set('client_secret', config.appSecret!)
      form.set('grant_type', 'authorization_code')
      form.set('redirect_uri', redirectUri)
      form.set('code', code)
      const short = tokensFromResponse(
        await requestJson(env, 'https://api.instagram.com/oauth/access_token', {
          method: 'POST',
          body: form,
        }),
        SCOPES,
      )
      const long = await requestJson(
        env,
        queryUrl(`${graph}/access_token`, {
          grant_type: 'ig_exchange_token',
          client_secret: config.appSecret!,
          access_token: short.accessToken,
        }),
      )
      return tokensFromResponse(long, SCOPES)
    },
    async accounts(tokens): Promise<ProviderAccount[]> {
      requireConfigured()
      const user = await requestJson(
        env,
        queryUrl(`${graph}/me`, {
          fields: 'user_id,id,username',
        }),
        { headers: bearer(tokens.accessToken) },
      )
      const id =
        typeof user.user_id === 'string'
          ? user.user_id
          : typeof user.id === 'string'
            ? user.id
            : undefined
      if (!id)
        throw new ProviderError(
          'Instagram não retornou o identificador da conta profissional.',
          'temporary',
        )
      return [
        {
          externalAccountId: id,
          displayName:
            typeof user.username === 'string' ? `@${user.username}` : id,
          accountType: 'Instagram Professional',
          tokens,
        },
      ]
    },
    async refresh(tokens) {
      requireConfigured()
      return tokensFromResponse(
        await requestJson(
          env,
          queryUrl(`${graph}/refresh_access_token`, {
            grant_type: 'ig_refresh_token',
            access_token: tokens.accessToken,
          }),
        ),
        tokens.scopes ?? SCOPES,
      )
    },
    async prepare(input) {
      requireConfigured()
      const previous = operationOf(input)
      let containerId = previous.containerId
      if (!containerId) {
        if (!input.imageUrl.startsWith('https://'))
          throw new ProviderError(
            'A imagem precisa de uma URL HTTPS acessível pelo Instagram.',
            'validation',
          )
        const created = await requestJson(
          env,
          queryUrl(
            `${graph}/${encodeURIComponent(input.externalAccountId)}/media`,
            {
              image_url: input.imageUrl,
              caption: input.caption,
            },
          ),
          { method: 'POST', headers: bearer(input.tokens.accessToken) },
        )
        if (typeof created.id !== 'string')
          throw new ProviderError(
            'Instagram não retornou o identificador do processamento da imagem.',
            'temporary',
          )
        containerId = created.id
      }
      const state: Operation = {
        ...previous,
        kind: 'instagram_image_container',
        containerId,
        phase: 'processing',
      }
      const status = await requestJson(
        env,
        queryUrl(`${graph}/${encodeURIComponent(containerId)}`, {
          fields: 'status_code,status',
        }),
        { headers: bearer(input.tokens.accessToken) },
      )
      const code = String(status.status_code ?? '').toUpperCase()
      if (code === 'ERROR' || code === 'EXPIRED') {
        throw new ProviderError(
          'Instagram não conseguiu processar a imagem desta publicação.',
          'temporary',
        )
      }
      return {
        ready: code === 'FINISHED' || code === 'PUBLISHED',
        operation: {
          ...state,
          phase:
            code === 'FINISHED'
              ? 'ready'
              : code === 'PUBLISHED'
                ? 'published'
                : 'processing',
        },
      }
    },
    async publish(input, operation): Promise<ProviderResult> {
      requireConfigured()
      const containerId =
        typeof operation.containerId === 'string'
          ? operation.containerId
          : undefined
      if (!containerId)
        throw new ProviderError(
          'O processamento da imagem do Instagram ainda não está pronto.',
          'validation',
        )
      if (operation.phase === 'published')
        return this.reconcile(input, operation)
      const response = await requestJson(
        env,
        queryUrl(
          `${graph}/${encodeURIComponent(input.externalAccountId)}/media_publish`,
          {
            creation_id: containerId,
          },
        ),
        { method: 'POST', headers: bearer(input.tokens.accessToken) },
      )
      const id = typeof response.id === 'string' ? response.id : undefined
      if (!id)
        return {
          status: 'unknown',
          operation: {
            ...operation,
            phase: 'publish_unknown',
            _dispatched: true,
          },
        }
      return {
        status: 'published',
        remotePostId: id,
        operation: {
          ...operation,
          mediaId: id,
          phase: 'published',
          _dispatched: true,
        },
      }
    },
    async reconcile(input, operation): Promise<ProviderResult> {
      const id =
        typeof operation.mediaId === 'string' ? operation.mediaId : undefined
      if (id) {
        const media = await requestJson(
          env,
          queryUrl(`${graph}/${encodeURIComponent(id)}`, {
            fields: 'id,permalink',
          }),
          { headers: bearer(input.tokens.accessToken) },
        )
        return {
          status: 'published',
          remotePostId: id,
          ...(typeof media.permalink === 'string'
            ? { remoteUrl: media.permalink }
            : {}),
          operation,
        }
      }
      const containerId =
        typeof operation.containerId === 'string'
          ? operation.containerId
          : undefined
      if (!containerId) return { status: 'unknown', operation }
      const status = await requestJson(
        env,
        queryUrl(`${graph}/${encodeURIComponent(containerId)}`, {
          fields: 'status_code,status',
        }),
        { headers: bearer(input.tokens.accessToken) },
      )
      if (String(status.status_code ?? '').toUpperCase() === 'PUBLISHED') {
        return {
          status: 'published',
          operation: { ...operation, phase: 'published' },
        }
      }
      // A published container without a saved media ID cannot safely be retried.
      if (operation._dispatched === true)
        return { status: 'unknown', operation }
      return { status: 'processing', operation }
    },
  }
}
