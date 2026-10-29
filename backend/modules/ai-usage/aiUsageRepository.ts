import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiUsageEventInput } from './aiUsageTypes.js'

export interface AiUsageReportRow {
  user_id: string
  user_email: string
  user_display_name: string
  calls: number | string
  text_calls: number | string
  image_calls: number | string
  generations: number | string
  posts_generated: number | string
  input_tokens: number | string
  cached_input_tokens: number | string
  output_tokens: number | string
  image_output_tokens: number | string
  total_cost_usd: number | string
  total_cost_brl: number | string
  estimated_calls: number | string
  unpriced_calls: number | string
  missing_exchange_rate_calls: number | string
}

export interface AiUsageRepository {
  insert(input: AiUsageEventInput & {
    costUsd: number | null
    costBrl: number | null
    usdBrlRate: number | null
    exchangeRateSource: string | null
    costAccuracy: 'calculated' | 'estimated' | 'unpriced'
    rateSnapshot: Record<string, number | string | boolean | null>
  }): Promise<void>
  monthlyReport(monthStart: string): Promise<AiUsageReportRow[]>
}

export class SupabaseAiUsageRepository implements AiUsageRepository {
  private readonly supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async insert(input: Parameters<AiUsageRepository['insert']>[0]) {
    const { error } = await this.supabase.from('ai_usage_events').insert({
      generation_id: input.generationId,
      provider_request_id: input.providerRequestId,
      user_id: input.userId,
      user_email: input.userEmail,
      user_display_name: input.userDisplayName,
      workspace_id: input.workspaceId,
      operation: input.operation,
      model: input.model,
      input_tokens: input.inputTokens,
      cached_input_tokens: input.cachedInputTokens,
      cache_write_input_tokens: input.cacheWriteInputTokens,
      text_input_tokens: input.textInputTokens,
      image_input_tokens: input.imageInputTokens,
      output_tokens: input.outputTokens,
      text_output_tokens: input.textOutputTokens,
      image_output_tokens: input.imageOutputTokens,
      reasoning_tokens: input.reasoningTokens,
      usage_accuracy: input.usageAccuracy,
      cost_accuracy: input.costAccuracy,
      image_quality: input.imageQuality ?? null,
      image_size: input.imageSize ?? null,
      draft_count: input.draftCount,
      cost_usd: input.costUsd,
      usd_brl_rate: input.usdBrlRate,
      cost_brl: input.costBrl,
      exchange_rate_source: input.exchangeRateSource,
      rate_snapshot: input.rateSnapshot,
      occurred_at: input.occurredAt,
    })
    if (error) throw new Error(`Falha ao salvar uso de IA: ${error.message}`)
  }

  async monthlyReport(monthStart: string) {
    const { data, error } = await this.supabase.rpc(
      'get_ai_usage_monthly_report',
      { p_month: monthStart },
    )
    if (error)
      throw new Error(`Falha ao consultar custos de IA: ${error.message}`)
    return (data ?? []) as AiUsageReportRow[]
  }
}
