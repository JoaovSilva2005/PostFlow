import type { AccountingReport } from '../../../shared/domain/accounting'
import { apiRequest } from '../../services/apiClient'

export const accountingApi = {
  report: (period: string, signal?: AbortSignal) =>
    apiRequest<AccountingReport>(
      `/admin/accounting/report?period=${encodeURIComponent(period)}`,
      { signal },
    ),
}
