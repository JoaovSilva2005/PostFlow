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

interface ApiResponse<T> {
  data: T
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  fallbackMessage = 'Não foi possível acessar a API.',
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new ApiError(body?.error ?? fallbackMessage, response.status)
  }

  if (response.status === 204) return undefined as T
  return ((await response.json()) as ApiResponse<T>).data
}
