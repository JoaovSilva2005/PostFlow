// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { AiUsageRepository } from './aiUsageRepository.js'
import { AiUsageService } from './aiUsageService.js'
import type { AiUsageEventInput } from './aiUsageTypes.js'

const event: AiUsageEventInput = {
  providerRequestId: 'resp_test',
  operation: 'text_generation',
  model: 'gpt-6-luna',
  inputTokens: 2_000,
  cachedInputTokens: 100,
  cacheWriteInputTokens: 0,
  textInputTokens: 2_000,
  imageInputTokens: 0,
  outputTokens: 1_000,
  textOutputTokens: 1_000,
  imageOutputTokens: 0,
  reasoningTokens: 0,
  usageAccuracy: 'reported',
  generationId: 'generation_test',
  userId: 'user_test',
  userEmail: 'qa@example.com',
  userDisplayName: 'QA User',
  workspaceId: 'workspace_test',
  draftCount: 2,
  occurredAt: '2026-09-28T12:00:00.000Z',
}

function reportRow(overrides: Record<string, string | number> = {}) {
  return {
    user_id: 'user_test',
    user_email: 'qa@example.com',
    user_display_name: 'QA User',
    calls: 2,
    text_calls: 1,
    image_calls: 1,
    generations: 1,
    posts_generated: 2,
    input_tokens: 2_000,
    cached_input_tokens: 100,
    output_tokens: 1_000,
    image_output_tokens: 5_500,
    total_cost_usd: '0.20',
    total_cost_brl: '1.00',
    estimated_calls: 1,
    unpriced_calls: 0,
    missing_exchange_rate_calls: 0,
    ...overrides,
  }
}

describe('AiUsageService', () => {
  it('persiste tokens, preço aplicado e cotação usada no custo em reais', async () => {
    const saved: Parameters<AiUsageRepository['insert']>[0][] = []
    const repository: AiUsageRepository = {
      insert: async (input) => {
        saved.push(input)
      },
      monthlyReport: async () => [],
    }
    const service = new AiUsageService(repository, async () => ({
      rate: 5,
      source: 'test_rate',
    }))

    await service.record(event)

    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      userId: 'user_test',
      workspaceId: 'workspace_test',
      inputTokens: 2_000,
      outputTokens: 1_000,
      costAccuracy: 'calculated',
      usdBrlRate: 5,
      exchangeRateSource: 'test_rate',
    })
    expect(saved[0]?.costUsd).toBeCloseTo(0.000691, 12)
    expect(saved[0]?.costBrl).toBeCloseTo(0.003455, 12)
    expect(saved[0]?.rateSnapshot).toHaveProperty('version')
  })

  it('agrega o relatório mensal por usuário e ordena pelo custo convertido', async () => {
    const repository: AiUsageRepository = {
      insert: async () => undefined,
      monthlyReport: async (monthStart) => {
        expect(monthStart).toBe('2026-09-01')
        return [
          reportRow({
            user_id: 'user_low',
            user_email: 'low@example.com',
            user_display_name: 'Low',
            total_cost_brl: '0.50',
            total_cost_usd: '0.10',
          }),
          reportRow({
            user_id: 'user_high',
            user_email: 'high@example.com',
            user_display_name: 'High',
            total_cost_brl: '2.50',
            total_cost_usd: '0.50',
          }),
        ]
      },
    }
    const service = new AiUsageService(repository)

    const report = await service.monthlyReport('2026-09')

    expect(report.users.map(({ userId }) => userId)).toEqual([
      'user_high',
      'user_low',
    ])
    expect(report.totals).toMatchObject({
      calls: 4,
      postsGenerated: 4,
      totalCostUsd: 0.6,
      totalCostBrl: 3,
      estimatedCalls: 2,
    })
  })
})
