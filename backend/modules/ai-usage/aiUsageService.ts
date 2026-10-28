import { calculateAiCost } from './aiPricing.js'
import type {
  AiUsageEventInput,
  AiUsageMonthlyReport,
  AiUsageUserSummary,
} from './aiUsageTypes.js'
import type {
  AiUsageReportRow,
  AiUsageRepository,
} from './aiUsageRepository.js'
import { getUsdBrlRate } from './usdBrlRate.js'

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function toSummary(row: AiUsageReportRow): AiUsageUserSummary {
  return {
    userId: row.user_id,
    userEmail: row.user_email,
    userDisplayName: row.user_display_name,
    calls: numeric(row.calls),
    textCalls: numeric(row.text_calls),
    imageCalls: numeric(row.image_calls),
    generations: numeric(row.generations),
    postsGenerated: numeric(row.posts_generated),
    inputTokens: numeric(row.input_tokens),
    cachedInputTokens: numeric(row.cached_input_tokens),
    outputTokens: numeric(row.output_tokens),
    imageOutputTokens: numeric(row.image_output_tokens),
    totalCostUsd: numeric(row.total_cost_usd),
    totalCostBrl: numeric(row.total_cost_brl),
    estimatedCalls: numeric(row.estimated_calls),
    unpricedCalls: numeric(row.unpriced_calls),
    missingExchangeRateCalls: numeric(row.missing_exchange_rate_calls),
  }
}

function totalsFrom(users: AiUsageUserSummary[]): AiUsageMonthlyReport['totals'] {
  return users.reduce(
    (totals, user) => ({
      calls: totals.calls + user.calls,
      textCalls: totals.textCalls + user.textCalls,
      imageCalls: totals.imageCalls + user.imageCalls,
      generations: totals.generations + user.generations,
      postsGenerated: totals.postsGenerated + user.postsGenerated,
      inputTokens: totals.inputTokens + user.inputTokens,
      cachedInputTokens: totals.cachedInputTokens + user.cachedInputTokens,
      outputTokens: totals.outputTokens + user.outputTokens,
      imageOutputTokens: totals.imageOutputTokens + user.imageOutputTokens,
      totalCostUsd: totals.totalCostUsd + user.totalCostUsd,
      totalCostBrl: totals.totalCostBrl + user.totalCostBrl,
      estimatedCalls: totals.estimatedCalls + user.estimatedCalls,
      unpricedCalls: totals.unpricedCalls + user.unpricedCalls,
      missingExchangeRateCalls:
        totals.missingExchangeRateCalls + user.missingExchangeRateCalls,
    }),
    {
      calls: 0,
      textCalls: 0,
      imageCalls: 0,
      generations: 0,
      postsGenerated: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      imageOutputTokens: 0,
      totalCostUsd: 0,
      totalCostBrl: 0,
      estimatedCalls: 0,
      unpricedCalls: 0,
      missingExchangeRateCalls: 0,
    },
  )
}

export class AiUsageService {
  private readonly repository: AiUsageRepository
  private readonly exchangeRateProvider: typeof getUsdBrlRate

  constructor(
    repository: AiUsageRepository,
    exchangeRateProvider: typeof getUsdBrlRate = getUsdBrlRate,
  ) {
    this.repository = repository
    this.exchangeRateProvider = exchangeRateProvider
  }

  async record(input: AiUsageEventInput) {
    const calculation = calculateAiCost(input)
    const exchange =
      calculation.costUsd === null
        ? { rate: null, source: null }
        : await this.exchangeRateProvider()
    const costBrl =
      calculation.costUsd !== null && exchange.rate !== null
        ? calculation.costUsd * exchange.rate
        : null

    await this.repository.insert({
      ...input,
      costUsd: calculation.costUsd,
      costBrl,
      usdBrlRate: exchange.rate,
      exchangeRateSource: exchange.source,
      costAccuracy: calculation.accuracy,
      rateSnapshot: calculation.rateSnapshot,
    })
  }

  async monthlyReport(month: string): Promise<AiUsageMonthlyReport> {
    const monthStart = `${month}-01`
    const rows = await this.repository.monthlyReport(monthStart)
    const users = rows.map(toSummary).sort((left, right) => {
      if (right.totalCostBrl !== left.totalCostBrl) {
        return right.totalCostBrl - left.totalCostBrl
      }
      return right.totalCostUsd - left.totalCostUsd
    })

    return { month, totals: totalsFrom(users), users }
  }
}
