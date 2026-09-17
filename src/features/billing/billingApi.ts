import type { BillingInvoice, BillingOverview } from '../../domain/billing'
import { apiRequest } from '../../services/apiClient'

function workspacePath(workspaceId: string, suffix: string) {
  return `/workspaces/${encodeURIComponent(workspaceId)}/${suffix}`
}

export const billingApi = {
  overview: (workspaceId: string, signal?: AbortSignal) =>
    apiRequest<BillingOverview>(workspacePath(workspaceId, 'billing'), {
      signal,
    }),
  invoices: (workspaceId: string, signal?: AbortSignal) =>
    apiRequest<BillingInvoice[]>(workspacePath(workspaceId, 'invoices'), {
      signal,
    }),
}
