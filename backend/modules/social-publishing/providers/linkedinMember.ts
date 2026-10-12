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
  requestJson,
  tokensFromResponse,
  type ProviderEnvironment,
} from './common.js'

const SCOPES = ['openid', 'profile', 'w_member_social']
type Operation = Record<string, unknown> & {
  imageUrn?: string
  uploadUrl?: string
  remotePostId?: string
}

function personUrn(externalAccountId: string): string {
  return externalAccountId.startsWith('urn:li:person:')
    ? externalAccountId
    : `urn:li:person:${externalAccountId}`
}

export function createLinkedInMemberProvider(
  env: ProviderEnvironment,
  config: { clientId?: string; clientSecret?: string },
): SocialProvider {
  const configured = Boolean(config.clientId && config.clientSecret)
  const apiHeaders = (token: string): Record<string, string> => ({
    ...bearer(token),
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  })
  const requireConfigured = () => {
    if (!configured)
      throw new ProviderError(
        'A integração com LinkedIn não está configurada.',
        'auth',
      )
  }
  return {
    id: 'linkedin',
    configured,
    scopes: SCOPES,
    authorizationUrl(input) {
      requireConfigured()
      return authorizationUrl(
        'https://www.linkedin.com/oauth/v2/authorization',
        config.clientId!,
        SCOPES,
        input,
      )
    },
    async exchangeCode({ code, redirectUri, codeVerifier }) {
      requireConfigured()
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      })
      return tokensFromResponse(
        await requestJson(
          env,
          'https://www.linkedin.com/oauth/v2/accessToken',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
          },
        ),
        SCOPES,
      )
    },
    async accounts(tokens): Promise<ProviderAccount[]> {
      requireConfigured()
      const profile = await requestJson(
        env,
        'https://api.linkedin.com/v2/userinfo',
        { headers: bearer(tokens.accessToken) },
      )
      if (typeof profile.sub !== 'string')
        throw new ProviderError(
          'LinkedIn não retornou o identificador do perfil.',
          'temporary',
        )
      return [
        {
          externalAccountId: profile.sub,
          displayName:
            typeof profile.name === 'string'
              ? profile.name
              : 'Perfil do LinkedIn',
          accountType: 'LinkedIn member',
          tokens,
        },
      ]
    },
    async prepare(input) {
      requireConfigured()
      const previous =
        (input as ProviderPublishInput & { operation?: Operation }).operation ??
        {}
      if (previous.imageUrn) return { ready: true, operation: previous }
      const response = await requestJson(
        env,
        'https://api.linkedin.com/v2/assets?action=registerUpload',
        {
          method: 'POST',
          headers: apiHeaders(input.tokens.accessToken),
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
              owner: personUrn(input.externalAccountId),
              serviceRelationships: [
                {
                  relationshipType: 'OWNER',
                  identifier: 'urn:li:userGeneratedContent',
                },
              ],
            },
          }),
        },
      )
      const value = response.value as Record<string, unknown> | undefined
      const mechanism = value?.uploadMechanism as
        Record<string, unknown> | undefined
      const httpUpload = mechanism?.[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ] as Record<string, unknown> | undefined
      const uploadUrl = httpUpload?.uploadUrl
      if (
        !value ||
        typeof value.asset !== 'string' ||
        typeof uploadUrl !== 'string'
      ) {
        throw new ProviderError(
          'LinkedIn não inicializou o envio da imagem.',
          'temporary',
        )
      }
      let upload: Response
      const uploadTarget = new URL(uploadUrl)
      if (
        uploadTarget.protocol !== 'https:' ||
        !(
          uploadTarget.hostname === 'linkedin.com' ||
          uploadTarget.hostname.endsWith('.linkedin.com')
        )
      )
        throw new ProviderError(
          'O endereço de upload retornado pelo LinkedIn é inválido.',
          'validation',
        )
      try {
        upload = await env.fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            ...bearer(input.tokens.accessToken),
            'Content-Type': 'application/octet-stream',
          },
          body: input.imageBytes,
          signal: AbortSignal.timeout(env.timeoutMs ?? 15_000),
        })
      } catch {
        throw new ProviderError(
          'Não foi possível enviar a imagem para o LinkedIn.',
          'temporary',
        )
      }
      if (!upload.ok)
        throw new ProviderError(
          'LinkedIn recusou o envio da imagem.',
          upload.status === 401 || upload.status === 403
            ? 'auth'
            : upload.status >= 500
              ? 'temporary'
              : 'validation',
        )
      return {
        ready: true,
        operation: { kind: 'linkedin_member_image', imageUrn: value.asset },
      }
    },
    async publish(input, operation): Promise<ProviderResult> {
      requireConfigured()
      const imageUrn =
        typeof operation.imageUrn === 'string' ? operation.imageUrn : undefined
      if (!imageUrn)
        throw new ProviderError(
          'A imagem ainda não foi enviada ao LinkedIn.',
          'validation',
        )
      const body = {
        author: personUrn(input.externalAccountId),
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: input.caption },
            shareMediaCategory: 'IMAGE',
            media: [
              {
                status: 'READY',
                media: imageUrn,
                title: { text: input.title },
              },
            ],
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }
      let response: Response
      try {
        response = await env.fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: apiHeaders(input.tokens.accessToken),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(env.timeoutMs ?? 15_000),
        })
      } catch {
        return {
          status: 'unknown',
          operation: { ...operation, _dispatched: true },
        }
      }
      if (!response.ok) {
        // A timeout/5xx after dispatch can be ambiguous; don't expose response text or retry blindly.
        if (response.status >= 500 || response.status === 408)
          return {
            status: 'unknown',
            operation: { ...operation, _dispatched: true },
          }
        const sanitized =
          response.status === 401 || response.status === 403
            ? new ProviderError(
                'A autorização do LinkedIn precisa ser revisada.',
                'auth',
              )
            : new ProviderError('LinkedIn recusou a publicação.', 'validation')
        throw sanitized
      }
      const id = response.headers.get('x-restli-id')
      if (!id)
        return {
          status: 'unknown',
          operation: { ...operation, _dispatched: true },
        }
      return {
        status: 'published',
        remotePostId: id,
        ...(/^urn:li:(share|ugcPost):\d+$/.test(id)
          ? {
              remoteUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}/`,
            }
          : {}),
        operation: { ...operation, remotePostId: id, _dispatched: true },
      }
    },
    async reconcile(_input, operation): Promise<ProviderResult> {
      if (typeof operation.remotePostId !== 'string') {
        return {
          status: 'unknown',
          operation,
          message:
            'LinkedIn não confirmou o ID do post; a publicação não será repetida automaticamente.',
        }
      }
      // Reading a member's posts requires the restricted r_member_social scope, so no speculative lookup.
      return {
        status: 'unknown',
        remotePostId: operation.remotePostId,
        operation,
      }
    },
  }
}
