import type {
  FinancialSummary,
  FinancialTransaction,
  FinancialTransactionInput,
  FinancialTransactionStatus,
} from '../../domain/finance'
import { apiRequest } from '../../services/apiClient'

export interface ApiHealth {
  status: string
  service: string
  storage: 'supabase' | 'demo' | 'test'
}

export const financialApi = {
  health: () => apiRequest<ApiHealth>('/health'),
  list: () => apiRequest<FinancialTransaction[]>('/admin/finance/transactions'),
  summary: () => apiRequest<FinancialSummary>('/admin/finance/summary'),
  create: (input: FinancialTransactionInput) =>
    apiRequest<FinancialTransaction>('/admin/finance/transactions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, input: Partial<FinancialTransactionInput>) =>
    apiRequest<FinancialTransaction>(`/admin/finance/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  updateStatus: (id: string, status: FinancialTransactionStatus) =>
    apiRequest<FinancialTransaction>(
      `/admin/finance/transactions/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    ),
  delete: (id: string) =>
    apiRequest<void>(`/admin/finance/transactions/${id}`, { method: 'DELETE' }),
}
