import type { AiUsageMonthlyReport } from '../../domain/aiUsage'
import { apiRequest } from '../../services/apiClient'

export const aiUsageApi = {
  monthly: (month: string) =>
    apiRequest<AiUsageMonthlyReport>(
      `/admin/ai-usage/monthly?month=${encodeURIComponent(month)}`,
    ),
}
