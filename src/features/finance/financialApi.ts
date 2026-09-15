import type {
  FinancialSummary,
  FinancialTransaction,
  FinancialTransactionInput,
  FinancialTransactionStatus,
} from '../../domain/finance'

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

interface ApiResponse<T> {
  data: T
}

export interface ApiHealth {
  status: string
  service: string
  storage: 'supabase' | 'demo' | 'test'
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(body?.error ?? 'Não foi possível acessar a API financeira.')
  }

  if (response.status === 204) return undefined as T
  return ((await response.json()) as ApiResponse<T>).data
}

export const financialApi = {
  health: () => request<ApiHealth>('/health'),
  list: () => request<FinancialTransaction[]>('/finance/transactions'),
  summary: () => request<FinancialSummary>('/finance/summary'),
  create: (input: FinancialTransactionInput) =>
    request<FinancialTransaction>('/finance/transactions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, input: Partial<FinancialTransactionInput>) =>
    request<FinancialTransaction>(`/finance/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  updateStatus: (id: string, status: FinancialTransactionStatus) =>
    request<FinancialTransaction>(`/finance/transactions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  delete: (id: string) =>
    request<void>(`/finance/transactions/${id}`, { method: 'DELETE' }),
}
