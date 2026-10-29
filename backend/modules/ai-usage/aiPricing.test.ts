// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  calculateAiCost,
  estimateImageUsage,
} from './aiPricing.js'
import type { ProviderUsageDetails } from './aiUsageTypes.js'

function usage(
  overrides: Partial<ProviderUsageDetails> = {},
): ProviderUsageDetails {
  return {
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
    ...overrides,
  }
}

describe('cálculo do custo de IA', () => {
  it('aplica separadamente as tarifas de entrada, cache e saída', () => {
    const result = calculateAiCost(usage())

    expect(result.accuracy).toBe('calculated')
    expect(result.costUsd).toBeCloseTo(0.000691, 12)
    expect(result.rateSnapshot.version).toBeTruthy()
  })

  it('marca como estimado o custo de imagem quando a contagem foi estimada', () => {
    const estimated = estimateImageUsage({
      model: 'gpt-image-2.5-flare',
      requestId: 'img_test',
      prompt: 'Uma peça visual para uma cafeteria.',
      size: '1024x1024',
      quality: 'high',
    })
    const result = calculateAiCost(estimated)

    expect(estimated.usageAccuracy).toBe('estimated')
    expect(estimated.imageOutputTokens).toBe(5_500)
    expect(result.accuracy).toBe('estimated')
    expect(result.costUsd).toBeGreaterThan(0.16)
    expect(estimated.providerRequestId).toBe('img_test')
  })

  it('não inventa custo para uso ausente ou modelo sem tarifa cadastrada', () => {
    expect(
      calculateAiCost(usage({ usageAccuracy: 'missing' })),
    ).toMatchObject({ costUsd: null, accuracy: 'unpriced' })
    expect(
      calculateAiCost(usage({ model: 'unknown-model' })),
    ).toMatchObject({ costUsd: null, accuracy: 'unpriced' })
  })
})
