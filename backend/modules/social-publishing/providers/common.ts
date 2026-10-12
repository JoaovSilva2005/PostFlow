import { ProviderError, type OAuthTokens } from '../socialTypes.js'

export type ProviderFetch = typeof fetch

export interface ProviderEnvironment {
  fetch: ProviderFetch
  timeoutMs?: number
}

export function formBody(
  values: Record<string, string | undefined>,
): URLSearchParams {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) body.set(key, value)
  }
  return body
}

export function authorizationUrl(
  endpoint: string,
  clientId: string,
  scopes: string[],
  input: { state: string; redirectUri: string; codeChallenge: string },
  extras: Record<string, string> = {},
  clientIdParameter = 'client_id',
  scopeSeparator = ' ',
): string {
  const url = new URL(endpoint)
  url.searchParams.set(clientIdParameter, clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', input.state)
  url.searchParams.set('scope', scopes.join(scopeSeparator))
  if (input.codeChallenge) {
    url.searchParams.set('code_challenge', input.codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
  }
  for (const [key, value] of Object.entries(extras))
    url.searchParams.set(key, value)
  return url.toString()
}

function safeErrorKind(status: number, body: unknown): ProviderError['kind'] {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status >= 500 || status === 408) return 'temporary'
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    const nested =
      record.error && typeof record.error === 'object'
        ? (record.error as Record<string, unknown>)
        : record
    const code = String(nested.code ?? nested.error_code ?? '')
    const type = String(nested.type ?? '')
    if (
      /token|scope|permission|auth|access_denied/i.test(code) ||
      /oauthexception/i.test(type) ||
      code === '190'
    )
      return 'auth'
    if (
      /rate|limit|throttle/i.test(code) ||
      ['4', '17', '32', '613'].includes(code)
    )
      return 'rate_limit'
  }
  return status >= 400 ? 'validation' : 'unknown'
}

export function providerError(status: number, body?: unknown): ProviderError {
  const kind = safeErrorKind(status, body)
  const message =
    kind === 'auth'
      ? 'A autorização da conta social precisa ser revisada.'
      : kind === 'rate_limit'
        ? 'A rede social limitou temporariamente as solicitações.'
        : kind === 'temporary'
          ? 'A rede social está temporariamente indisponível.'
          : 'A rede social recusou a solicitação.'
  return new ProviderError(message, kind)
}

export async function requestJson(
  env: ProviderEnvironment,
  url: string | URL,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await env.fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(env.timeoutMs ?? 15_000),
    })
  } catch {
    throw new ProviderError('A rede social não respondeu a tempo.', 'temporary')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }
  if (!response.ok) throw providerError(response.status, body)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ProviderError(
      'A rede social retornou uma resposta inválida.',
      'temporary',
    )
  }
  const record = body as Record<string, unknown>
  if ('error' in record && record.error) {
    const nested =
      typeof record.error === 'object'
        ? (record.error as Record<string, unknown>)
        : { code: record.error }
    const code = String(nested.code ?? '')
    if (!code || code.toLowerCase() === 'ok') return record
    const type = String(nested.type ?? '')
    const kind =
      /token|scope|permission|auth/i.test(code) ||
      /oauthexception/i.test(type) ||
      code === '190'
        ? 'auth'
        : /rate|limit/i.test(code) || ['4', '17', '32', '613'].includes(code)
          ? 'rate_limit'
          : 'validation'
    throw new ProviderError(
      kind === 'auth'
        ? 'A autorização da conta social precisa ser revisada.'
        : kind === 'rate_limit'
          ? 'A rede social limitou temporariamente as solicitações.'
          : 'A rede social recusou a solicitação.',
      kind,
    )
  }
  return record
}

export function tokensFromResponse(
  body: Record<string, unknown>,
  fallbackScopes?: string[],
): OAuthTokens {
  const accessToken = body.access_token
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new ProviderError(
      'A rede social não retornou um token válido.',
      'auth',
    )
  }
  const expiresIn = Number(body.expires_in)
  const scopes =
    typeof body.scope === 'string'
      ? body.scope.split(/[ ,]+/).filter(Boolean)
      : fallbackScopes
  return {
    accessToken,
    ...(typeof body.refresh_token === 'string'
      ? { refreshToken: body.refresh_token }
      : {}),
    ...(Number.isFinite(expiresIn) && expiresIn > 0
      ? { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() }
      : {}),
    ...(scopes?.length ? { scopes } : {}),
  }
}

export function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value) {
    throw new ProviderError(message, 'temporary')
  }
  return value
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

export function queryUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value)
  return url.toString()
}
