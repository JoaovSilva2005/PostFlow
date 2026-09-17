import type { FiscalReport, FiscalSale, SaleInput } from '../../domain/fiscal'
import { apiRequest } from '../../services/apiClient'

export const fiscalApi = {
  report: (period: string, signal?: AbortSignal) =>
    apiRequest<FiscalReport>(
      `/admin/fiscal/report?period=${encodeURIComponent(period)}`,
      { signal },
    ),
  receipt: (id: string) =>
    apiRequest<FiscalSale>(`/admin/fiscal/receipts/${encodeURIComponent(id)}`),
  create: (sale: SaleInput) =>
    apiRequest<FiscalSale>('/admin/fiscal/sales', {
      method: 'POST',
      body: JSON.stringify(sale),
    }),
}

export const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value,
  )
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(`${value.slice(0, 10)}T12:00:00Z`),
  )
