const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

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
