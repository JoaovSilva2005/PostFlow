import {
  ProviderError,
  type SocialProvider,
  type ProviderAccount,
  type ProviderPublishInput,
  type ProviderResult,
  type TikTokCreatorInfo,
} from '../socialTypes.js'
import {
  authorizationUrl,
  bearer,
  formBody,
  requestJson,
  tokensFromResponse,
  type ProviderEnvironment,
} from './common.js'

const SCOPES = ['user.info.basic', 'video.publish']
const API = 'https://open.tiktokapis.com/v2'
function dataOf(response: Record<string, unknown>): Record<string, unknown> {
  return response.data && typeof response.data === 'object'
    ? (response.data as Record<string, unknown>)
    : {}
}

export function createTikTokDirectPostProvider(
  env: ProviderEnvironment,
  config: {
    clientKey?: string
    clientSecret?: string
    mediaDomainVerified: boolean
    directPostApproved: boolean
  },
): SocialProvider {
  const configured = Boolean(
    config.clientKey &&
    config.clientSecret &&
    config.mediaDomainVerified &&
    config.directPostApproved,
  )
  const requireConfigured = () => {
    if (!configured)
      throw new ProviderError(
        'TikTok Direct Post exige credenciais, domínio de mídia verificado e aprovação do app.',
        'auth',
      )
  }
  return {
    id: 'tiktok',
    configured,
    scopes: SCOPES,
    authorizationUrl(input) {
      requireConfigured()
      return authorizationUrl(
        'https://www.tiktok.com/v2/auth/authorize/',
        config.clientKey!,
        SCOPES,
        input,
        {},
        'client_key',
        ',',
      )
    },
    async exchangeCode({ code, redirectUri, codeVerifier }) {
      requireConfigured()
      const body = formBody({
        client_key: config.clientKey!,
        client_secret: config.clientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      })
      return tokensFromResponse(
        await requestJson(env, `${API}/oauth/token/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        }),
        SCOPES,
      )
    },
    async refresh(tokens) {
      requireConfigured()
      if (!tokens.refreshToken)
        throw new ProviderError(
          'A reconexão da conta TikTok é necessária.',
          'auth',
        )
      const body = formBody({
        client_key: config.clientKey!,
        client_secret: config.clientSecret!,
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
      })
      return tokensFromResponse(
        await requestJson(env, `${API}/oauth/token/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        }),
        tokens.scopes ?? SCOPES,
      )
    },
    async accounts(tokens): Promise<ProviderAccount[]> {
      requireConfigured()
      const response = await requestJson(
        env,
        `${API}/user/info/?fields=open_id,display_name,avatar_url`,
        {
          headers: {
            ...bearer(tokens.accessToken),
            'Content-Type': 'application/json; charset=UTF-8',
          },
        },
      )
      const user = dataOf(response).user as Record<string, unknown> | undefined
      if (!user || typeof user.open_id !== 'string')
        throw new ProviderError(
          'TikTok não retornou os dados da conta autorizada.',
          'temporary',
        )
      return [
        {
          externalAccountId: user.open_id,
          displayName:
            typeof user.display_name === 'string'
              ? user.display_name
              : 'TikTok creator',
          accountType: 'TikTok creator',
          tokens,
        },
      ]
    },
    async creatorInfo(tokens, externalAccountId): Promise<TikTokCreatorInfo> {
      requireConfigured()
      void externalAccountId
      const response = await requestJson(
        env,
        `${API}/post/publish/creator_info/query/`,
        {
          method: 'POST',
          headers: {
            ...bearer(tokens.accessToken),
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: '{}',
        },
      )
      const data = dataOf(response)
      const options = data.privacy_level_options
      if (
        !Array.isArray(options) ||
        !options.every((value) => typeof value === 'string')
      ) {
        throw new ProviderError(
          'TikTok não retornou as opções de privacidade da conta.',
          'temporary',
        )
      }
      return {
        creatorUsername:
          typeof data.creator_username === 'string'
            ? data.creator_username
            : '',
        creatorNickname:
          typeof data.creator_nickname === 'string'
            ? data.creator_nickname
            : '',
        ...(typeof data.creator_avatar_url === 'string'
          ? { creatorAvatarUrl: data.creator_avatar_url }
          : {}),
        privacyLevelOptions: options as string[],
        commentDisabled: data.comment_disabled === true,
        duetDisabled: data.duet_disabled === true,
        stitchDisabled: data.stitch_disabled === true,
        ...(typeof data.max_video_post_duration_sec === 'number'
          ? { maxVideoPostDurationSec: data.max_video_post_duration_sec }
          : {}),
      }
    },
    async prepare(input) {
      requireConfigured()
      if ((input as ProviderPublishInputWithFormat).format !== 'static') {
        throw new ProviderError(
          'TikTok Direct Post nesta entrega aceita somente posts estáticos de imagem única.',
          'validation',
        )
      }
      if (!input.imageUrl.startsWith('https://'))
        throw new ProviderError(
          'A imagem do TikTok precisa de uma URL HTTPS pública.',
          'validation',
        )
      if (input.caption.length > 4_000 || input.title.length > 90)
        throw new ProviderError(
          'O texto excede o limite do post de fotos do TikTok.',
          'validation',
        )
      if (!input.options)
        throw new ProviderError(
          'Selecione as opções de publicação exigidas pelo TikTok.',
          'validation',
        )
      // Refresh account capabilities before dispatch so a read timeout can be retried safely.
      const creator = await this.creatorInfo!(
        input.tokens,
        input.externalAccountId,
      )
      if (
        !creator.privacyLevelOptions.includes(input.options.privacyLevel) ||
        (creator.commentDisabled && !input.options.disableComment)
      )
        throw new ProviderError(
          'As opções aprovadas não estão mais disponíveis para esta conta TikTok. Revise e autorize novamente.',
          'validation',
        )
      // First delivery intentionally supports one still image only; no carousel or video is synthesized.
      return {
        ready: true,
        operation: { kind: 'tiktok_photo_direct_post', mediaType: 'PHOTO' },
      }
    },
    async publish(input, operation): Promise<ProviderResult> {
      requireConfigured()
      if ((input as ProviderPublishInputWithFormat).format !== 'static') {
        throw new ProviderError(
          'TikTok Direct Post nesta entrega aceita somente posts estáticos de imagem única.',
          'validation',
        )
      }
      const options = input.options
      if (!options)
        throw new ProviderError(
          'Selecione as opções de publicação exigidas pelo TikTok.',
          'validation',
        )
      const result = await requestJson(
        env,
        `${API}/post/publish/content/init/`,
        {
          method: 'POST',
          headers: {
            ...bearer(input.tokens.accessToken),
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            media_type: 'PHOTO',
            post_mode: 'DIRECT_POST',
            post_info: {
              ...(input.title ? { title: input.title } : {}),
              description: input.caption,
              privacy_level: options.privacyLevel,
              disable_comment: options.disableComment,
              brand_content_toggle: options.brandContentToggle,
              brand_organic_toggle: options.brandOrganicToggle,
            },
            source_info: {
              source: 'PULL_FROM_URL',
              photo_images: [input.imageUrl],
              photo_cover_index: 0,
            },
            is_aigc: options.isAiGenerated,
          }),
        },
      )
      const publishId = dataOf(result).publish_id
      if (typeof publishId !== 'string')
        return {
          status: 'unknown',
          operation: { ...operation, _dispatched: true },
        }
      return {
        status: 'processing',
        operation: { ...operation, publishId, _dispatched: true },
      }
    },
    async reconcile(input, operation): Promise<ProviderResult> {
      const publishId =
        typeof operation.publishId === 'string'
          ? operation.publishId
          : undefined
      if (!publishId)
        return {
          status: 'unknown',
          operation,
          message:
            'TikTok não confirmou o ID do envio; ele não será reenviado automaticamente.',
        }
      const response = await requestJson(
        env,
        `${API}/post/publish/status/fetch/`,
        {
          method: 'POST',
          headers: {
            ...bearer(input.tokens.accessToken),
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({ publish_id: publishId }),
        },
      )
      const data = dataOf(response)
      const status = String(data.status ?? '').toUpperCase()
      if (status === 'PUBLISH_COMPLETE') {
        const ids = Array.isArray(data.publicaly_available_post_id)
          ? data.publicaly_available_post_id
          : []
        const remotePostId = ids.length ? String(ids[0]) : undefined
        return {
          status: 'published',
          ...(remotePostId ? { remotePostId } : {}),
          operation: { ...operation, phase: 'published' },
        }
      }
      if (status === 'FAILED')
        return {
          status: 'failed',
          operation,
          message: 'TikTok não conseguiu concluir a publicação.',
        }
      return { status: 'processing', operation }
    },
  }
}

type ProviderPublishInputWithFormat = ProviderPublishInput & { format?: string }
