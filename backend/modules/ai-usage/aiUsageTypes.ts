export type AiUsageOperation = 'text_generation' | 'image_generation'
export type AiUsageAccuracy = 'reported' | 'estimated' | 'missing'
export type AiCostAccuracy = 'calculated' | 'estimated' | 'unpriced'

/** Uso retornado ou estimado pelo provedor para uma chamada individual. */
export interface ProviderUsageDetails {
  providerRequestId: string | null
  operation: AiUsageOperation
  model: string
  inputTokens: number
  cachedInputTokens: number
  cacheWriteInputTokens: number
  textInputTokens: number
  imageInputTokens: number
  outputTokens: number
  textOutputTokens: number
  imageOutputTokens: number
  reasoningTokens: number
  usageAccuracy: AiUsageAccuracy
  imageQuality?: string
  imageSize?: string
}

export type ContentUsageReporter = (
  usage: ProviderUsageDetails,
) => Promise<void> | void

export interface AiUsageEventInput extends ProviderUsageDetails {
  generationId: string
  userId: string
  userEmail: string
  userDisplayName: string
  workspaceId: string
  draftCount: number
  occurredAt: string
}

export interface AiUsageUserSummary {
  userId: string
  userEmail: string
  userDisplayName: string
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

export interface AiUsageMonthlyReport {
  month: string
  totals: Omit<AiUsageUserSummary, 'userId' | 'userEmail' | 'userDisplayName'>
  users: AiUsageUserSummary[]
}
