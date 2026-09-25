import type { SupabaseClient } from '@supabase/supabase-js'
import { HttpError } from '../../shared/HttpError.js'

export interface ContentQuotaUnits {
  text: number
  image: number
}

export interface ContentQuotaService {
  reserve(workspaceId: string, units: ContentQuotaUnits): Promise<string>
  settle(reservationId: string, succeeded: boolean): Promise<void>
}

interface ReservationResult {
  allowed?: boolean
  reservation_id?: string | null
  failure_code?: string | null
}

function firstRow(data: unknown): ReservationResult | null {
  const value = Array.isArray(data) ? data[0] : data
  return value && typeof value === 'object'
    ? (value as ReservationResult)
    : null
}

export class SupabaseContentQuotaService implements ContentQuotaService {
  private readonly supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async reserve(workspaceId: string, units: ContentQuotaUnits) {
    const { data, error } = await this.supabase.rpc(
      'reserve_content_generation_usage',
      {
        p_brand_id: workspaceId,
        p_text_units: units.text,
        p_image_units: units.image,
      },
    )

    if (error) {
      throw new HttpError(
        503,
        'Não foi possível reservar a franquia de geração. Tente novamente.',
      )
    }

    const result = firstRow(data)
    if (!result) {
      throw new HttpError(
        503,
        'Não foi possível confirmar a franquia de geração.',
      )
    }

    if (!result.allowed) {
      if (result.failure_code === 'plan_inactive') {
        throw new HttpError(
          402,
          'Um plano ativo é necessário para utilizar esta funcionalidade.',
        )
      }
      if (result.failure_code === 'image_limit') {
        throw new HttpError(
          429,
          'A franquia de imagens do plano foi atingida. Consulte a cobrança para ver o consumo.',
        )
      }
      throw new HttpError(
        429,
        'A franquia de textos do plano foi atingida. Consulte a cobrança para ver o consumo.',
      )
    }

    if (!result.reservation_id) {
      throw new HttpError(
        503,
        'Não foi possível confirmar a reserva de geração.',
      )
    }

    return result.reservation_id
  }

  async settle(reservationId: string, succeeded: boolean) {
    const { data, error } = await this.supabase.rpc(
      'settle_content_generation_usage',
      {
        p_reservation_id: reservationId,
        p_succeeded: succeeded,
      },
    )

    if (error || data !== true) {
      throw new HttpError(
        503,
        'Não foi possível confirmar o consumo da franquia. Tente novamente.',
      )
    }
  }
}
