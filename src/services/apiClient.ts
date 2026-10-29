const DEFAULT_API_URL = '/api'
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

function resolveApiUrl() {
  if (!configuredApiUrl) return DEFAULT_API_URL

  const normalizedUrl = configuredApiUrl.replace(/\/$/, '')

  // VITE_API_URL is compiled into the frontend. If a local development URL
  // was present during a production build, use the same-origin Vercel API.
  if (typeof window !== 'undefined') {
    try {
      const configuredUrl = new URL(normalizedUrl, window.location.origin)
      const appIsLocal = loopbackHosts.has(window.location.hostname)
      const apiIsLocal = loopbackHosts.has(configuredUrl.hostname)

      if (apiIsLocal && !appIsLocal) return DEFAULT_API_URL
    } catch {
      return DEFAULT_API_URL
    }
  }

  return normalizedUrl
}

const API_URL = resolveApiUrl()
export const SESSION_EXPIRED_EVENT = 'postflow:session-expired'
export const SESSION_EXPIRED_MESSAGE =
  'Sua sessão expirou. Entre novamente para continuar.'
export const SESSION_REFRESH_UNAVAILABLE_CODE = 'SESSION_REFRESH_UNAVAILABLE'

type SessionRefreshResult = 'refreshed' | 'expired' | 'unavailable'

let sessionRefreshInFlight: Promise<SessionRefreshResult> | null = null
let expiredSessionLogoutInFlight: Promise<void> | null = null
let sessionExpiredNotified = false

interface ApiResponse<T> {
  data: T
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function isAuthRequest(path: string) {
  return path.split('?')[0]?.startsWith('/auth/') ?? false
}

function refreshSession(): Promise<SessionRefreshResult> {
  if (!sessionRefreshInFlight) {
    sessionRefreshInFlight = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((response): SessionRefreshResult => {
        if (response.ok) return 'refreshed'
        return response.status === 401 ? 'expired' : 'unavailable'
      })
      .catch((): SessionRefreshResult => 'unavailable')
      .finally(() => {
        sessionRefreshInFlight = null
      })
  }
  return sessionRefreshInFlight
}

async function logoutExpiredSession() {
  if (!expiredSessionLogoutInFlight) {
    expiredSessionLogoutInFlight = fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        expiredSessionLogoutInFlight = null
      })
  }
  await expiredSessionLogoutInFlight
}

async function notifySessionExpired() {
  if (sessionExpiredNotified || typeof window === 'undefined') return
  sessionExpiredNotified = true
  await logoutExpiredSession()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  fallbackMessage = 'Não foi possível acessar a API.',
): Promise<T> {
  const sendRequest = () =>
    fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  let response = await sendRequest()

  if (response.status === 401 && !isAuthRequest(path)) {
    const refreshResult = await refreshSession()
    if (refreshResult === 'refreshed') {
      response = await sendRequest()
      if (response.status === 401) await notifySessionExpired()
    } else if (refreshResult === 'expired') {
      await notifySessionExpired()
    } else {
      throw new ApiError(
        'Não foi possível validar sua sessão agora. Tente novamente em instantes.',
        503,
        SESSION_REFRESH_UNAVAILABLE_CODE,
      )
    }
  }

  if (response.ok && isAuthRequest(path)) sessionExpiredNotified = false

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new ApiError(body?.error ?? fallbackMessage, response.status)
  }

  if (response.status === 204) return undefined as T
  return ((await response.json()) as ApiResponse<T>).data
}
