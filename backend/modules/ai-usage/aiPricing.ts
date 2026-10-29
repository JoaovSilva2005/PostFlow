import type { ProviderUsageDetails } from './aiUsageTypes.js'

export const AI_PRICING_VERSION = 'openai-standard-2026-09-28-v1'
const TOKENS_PER_MILLION = 1_000_000

interface TextRates {
  input: number
  cachedInput: number
  cacheWrite: number
  output: number
}

interface ImageRates {
  textInput: number
  cachedTextInput: number
  imageInput: number
  cachedImageInput: number
  imageOutput: number
}

const TEXT_RATES: Record<string, { short: TextRates; long: TextRates }> = {
  'gpt-6-luna': {
    short: { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 },
    long: { input: 0.2, cachedInput: 0.02, cacheWrite: 0.25, output: 0.75 },
  },
  'gpt-6-sol': {
    short: { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 10 },
    long: { input: 4, cachedInput: 0.4, cacheWrite: 5, output: 15 },
  },
  'gpt-6-astra': {
    short: { input: 10, cachedInput: 1, cacheWrite: 12.5, output: 50 },
    long: { input: 20, cachedInput: 2, cacheWrite: 25, output: 75 },
  },
}

const GPT_IMAGE_25_RATES: ImageRates = {
  textInput: 5,
  cachedTextInput: 1.25,
  imageInput: 8,
  cachedImageInput: 2,
  imageOutput: 30,
}

export interface AiCostCalculation {
  costUsd: number | null
  accuracy: 'calculated' | 'estimated' | 'unpriced'
  rateSnapshot: Record<string, number | string | boolean | null>
}

function isImageModel(model: string) {
  return model.startsWith('gpt-image-2.5-')
}

export function calculateAiCost(
  usage: ProviderUsageDetails,
): AiCostCalculation {
  if (usage.usageAccuracy === 'missing') {
    return {
      costUsd: null,
      accuracy: 'unpriced',
      rateSnapshot: {
        version: AI_PRICING_VERSION,
        model: usage.model,
        missingUsage: true,
      },
    }
  }

  if (isImageModel(usage.model)) {
    const rates = GPT_IMAGE_25_RATES
    const uncachedTextInput = Math.max(
      0,
      usage.textInputTokens - usage.cachedInputTokens,
    )
    const costUsd =
      (uncachedTextInput * rates.textInput +
        usage.cachedInputTokens * rates.cachedTextInput +
        usage.imageInputTokens * rates.imageInput +
        usage.imageOutputTokens * rates.imageOutput) /
      TOKENS_PER_MILLION

    return {
      costUsd,
      accuracy:
        usage.usageAccuracy === 'reported' ? 'calculated' : 'estimated',
      rateSnapshot: {
        version: AI_PRICING_VERSION,
        textInputUsdPerMillion: rates.textInput,
        cachedTextInputUsdPerMillion: rates.cachedTextInput,
        imageInputUsdPerMillion: rates.imageInput,
        cachedImageInputUsdPerMillion: rates.cachedImageInput,
        imageOutputUsdPerMillion: rates.imageOutput,
      },
    }
  }

  const modelRates = TEXT_RATES[usage.model]
  if (!modelRates) {
    return {
      costUsd: null,
      accuracy: 'unpriced',
      rateSnapshot: {
        version: AI_PRICING_VERSION,
        model: usage.model,
        missingModelPrice: true,
      },
    }
  }

  const rates =
    usage.inputTokens > 272_000 ? modelRates.long : modelRates.short
  const uncachedInput = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteInputTokens,
  )
  const costUsd =
    (uncachedInput * rates.input +
      usage.cachedInputTokens * rates.cachedInput +
      usage.cacheWriteInputTokens * rates.cacheWrite +
      usage.outputTokens * rates.output) /
    TOKENS_PER_MILLION

  return {
    costUsd,
    accuracy:
      usage.usageAccuracy === 'reported' ? 'calculated' : 'estimated',
    rateSnapshot: {
      version: AI_PRICING_VERSION,
      inputUsdPerMillion: rates.input,
      cachedInputUsdPerMillion: rates.cachedInput,
      cacheWriteUsdPerMillion: rates.cacheWrite,
      outputUsdPerMillion: rates.output,
    },
  }
}

/**
 * GPT Image 2.5 does not include image-token detail in every Image API
 * response. Keep an explicitly estimated token count until the provider
 * reports it; estimates scale with output area and quality.
 */
export function estimateImageUsage(input: {
  model: string
  requestId: string | null
  prompt: string
  size: string
  quality: string
}): ProviderUsageDetails {
  const dimensions = /^(\d+)x(\d+)$/.exec(input.size)
  const areaScale = dimensions
    ? (Number(dimensions[1]) * Number(dimensions[2])) / 1_048_576
    : 1.5
  const quality = input.quality.toLowerCase()
  const baseTokens =
    quality === 'low'
      ? 196
      : quality === 'high'
        ? 5_500
        : quality === 'xhigh'
          ? 11_000
          : quality === 'max'
            ? 16_500
            : 1_400
  const estimatedImageOutputTokens = Math.max(
    1,
    Math.round(baseTokens * areaScale),
  )
  const estimatedTextInputTokens = Math.max(1, Math.ceil(input.prompt.length / 4))

  return {
    providerRequestId: input.requestId,
    operation: 'image_generation',
    model: input.model,
    inputTokens: estimatedTextInputTokens,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    textInputTokens: estimatedTextInputTokens,
    imageInputTokens: 0,
    outputTokens: estimatedImageOutputTokens,
    textOutputTokens: 0,
    imageOutputTokens: estimatedImageOutputTokens,
    reasoningTokens: 0,
    usageAccuracy: 'estimated',
    imageQuality: input.quality,
    imageSize: input.size,
  }
}
