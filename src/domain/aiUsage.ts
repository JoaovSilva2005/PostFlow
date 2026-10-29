export interface AiUsageSummary {
  calls: number
  textCalls: number
  imageCalls: number
  generations: number
  postsGenerated: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  imageOutputTokens: number
  totalCostUsd: number
  totalCostBrl: number
  estimatedCalls: number
  unpricedCalls: number
  missingExchangeRateCalls: number
}

export interface AiUsageUserSummary extends AiUsageSummary {
  userId: string
  userEmail: string
  userDisplayName: string
}

export interface AiUsageMonthlyReport {
  month: string
  totals: AiUsageSummary
  users: AiUsageUserSummary[]
}
