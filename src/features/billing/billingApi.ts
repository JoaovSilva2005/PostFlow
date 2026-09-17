import type {
  BillingInvoice,
  BillingOverview,
  BillingPlan,
} from '../../domain/billing'
import { apiRequest } from '../../services/apiClient'

function workspacePath(workspaceId: string, suffix: string) {
  return `/workspaces/${encodeURIComponent(workspaceId)}/${suffix}`
}

export const billingApi = {
  plans: (workspaceId: string, signal?: AbortSignal) =>
    apiRequest<BillingPlan[]>(workspacePath(workspaceId, 'billing/plans'), {
      signal,
    }),
  overview: (workspaceId: string, signal?: AbortSignal) =>
    apiRequest<BillingOverview>(workspacePath(workspaceId, 'billing'), {
      signal,
    }),
  invoices: (workspaceId: string, signal?: AbortSignal) =>
    apiRequest<BillingInvoice[]>(workspacePath(workspaceId, 'invoices'), {
      signal,
    }),
  subscribe: (workspaceId: string, planCode: string, idempotencyKey: string) =>
    apiRequest<BillingInvoice>(workspacePath(workspaceId, 'billing'), {
      method: 'PUT',
      headers: { 'idempotency-key': idempotencyKey },
      body: JSON.stringify({ planCode }),
    }),
  payInvoice: (
    workspaceId: string,
    invoiceId: string,
    idempotencyKey: string,
  ) =>
    apiRequest<BillingInvoice>(
      workspacePath(
        workspaceId,
        `invoices/${encodeURIComponent(invoiceId)}/pay`,
      ),
      {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey },
      },
    ),
}
