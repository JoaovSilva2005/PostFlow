// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseContentQuotaService } from './contentQuota.js'

describe('SupabaseContentQuotaService', () => {
  it('envia unidades de texto e imagem ao RPC atômico do banco', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: true, reservation_id: 'reservation-1' }],
      error: null,
    })
    const service = new SupabaseContentQuotaService(
      { rpc } as unknown as SupabaseClient,
    )

    await expect(
      service.reserve('workspace-1', { text: 1, image: 1 }),
    ).resolves.toBe('reservation-1')
    expect(rpc).toHaveBeenCalledWith('reserve_content_generation_usage', {
      p_brand_id: 'workspace-1',
      p_text_units: 1,
      p_image_units: 1,
    })
  })

  it('mapeia franquia de imagem esgotada para HTTP 429', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: false, failure_code: 'image_limit' }],
      error: null,
    })
    const service = new SupabaseContentQuotaService(
      { rpc } as unknown as SupabaseClient,
    )

    await expect(
      service.reserve('workspace-1', { text: 1, image: 1 }),
    ).rejects.toMatchObject({ statusCode: 429 })
  })

  it('mapeia indisponibilidade do banco para erro sanitizado', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('detalhe interno'),
    })
    const service = new SupabaseContentQuotaService(
      { rpc } as unknown as SupabaseClient,
    )

    await expect(
      service.reserve('workspace-1', { text: 1, image: 1 }),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.not.stringContaining('detalhe interno'),
    })
  })

  it('finaliza uma reserva consumida ou liberada pela mesma RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    const service = new SupabaseContentQuotaService(
      { rpc } as unknown as SupabaseClient,
    )

    await service.settle('reservation-1', true)
    await service.settle('reservation-2', false)

    expect(rpc).toHaveBeenNthCalledWith(1, 'settle_content_generation_usage', {
      p_reservation_id: 'reservation-1',
      p_succeeded: true,
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'settle_content_generation_usage', {
      p_reservation_id: 'reservation-2',
      p_succeeded: false,
    })
  })

  it('não considera uma reserva finalizada se o RPC não confirmar a transação', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null })
    const service = new SupabaseContentQuotaService(
      { rpc } as unknown as SupabaseClient,
    )

    await expect(service.settle('reservation-1', true)).rejects.toMatchObject({
      statusCode: 503,
    })
  })
})
