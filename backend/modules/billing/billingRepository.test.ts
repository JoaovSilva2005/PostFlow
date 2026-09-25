// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { SupabaseBillingRepository } from './billingRepository.js'

describe('SupabaseBillingRepository', () => {
  it('lê o consumo do período da assinatura incluindo reservas concorrentes', async () => {
    const queries: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {}
    const subscription = {
      id: 'subscription-1',
      status: 'active',
      current_period_start: '2026-09-01',
      current_period_end: '2026-10-01',
      plans: {
        id: 'plan-1',
        code: 'professional',
        name: 'Profissional',
        price_cents: 7990,
        text_limit: 100,
        image_limit: 30,
      },
    }
    const supabase = {
      rpc: vi.fn(async () => ({ data: null, error: null })),
      from: vi.fn((table: string) => {
        const query: Record<string, ReturnType<typeof vi.fn>> = {}
        query.select = vi.fn(() => query)
        query.eq = vi.fn(() => query)
        query.in = vi.fn(() => query)
        query.order = vi.fn(() => query)
        query.limit = vi.fn(() => query)
        query.maybeSingle = vi.fn(async () =>
          table === 'subscriptions'
            ? { data: subscription, error: null }
            : {
                data: {
                  period_start: '2026-09-01',
                  text_used: 18,
                  image_used: 4,
                  text_reserved: 2,
                  image_reserved: 1,
                },
                error: null,
              },
        )
        queries[table] = query
        return query
      }),
    }
    const repository = new SupabaseBillingRepository(supabase as never)

    const overview = await repository.getOverview('workspace-1')

    expect(overview.usage).toEqual({
      period: '2026-09-01',
      textUsed: 18,
      imageUsed: 4,
      textReserved: 2,
      imageReserved: 1,
    })
    expect(supabase.rpc).toHaveBeenCalledWith(
      'release_expired_content_generation_reservations',
      { p_brand_id: 'workspace-1', p_period_start: '2026-09-01' },
    )
    expect(queries.usage_counters?.select).toHaveBeenCalledWith(
      'period_start,text_used,image_used,text_reserved,image_reserved',
    )
    expect(queries.usage_counters?.eq).toHaveBeenNthCalledWith(
      2,
      'period_start',
      '2026-09-01',
    )
  })

  it('desambigua a relação fiscal usada ao listar faturas', async () => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {}
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.order = vi.fn(async () => ({ data: [], error: null }))
    const supabase = {
      from: vi.fn(() => query),
    }
    const repository = new SupabaseBillingRepository(supabase as never)

    await repository.listInvoices('workspace-1')

    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining(
        'fiscal_documents!fiscal_documents_billing_invoice_id_fkey',
      ),
    )
  })

  it('desambigua a relação fiscal ao procurar uma operação idempotente', async () => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {}
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    const supabase = {
      from: vi.fn(() => query),
    }
    const repository = new SupabaseBillingRepository(supabase as never)

    await repository.findInvoiceByIdempotency('workspace-1', 'operation-1')

    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining(
        'fiscal_documents!fiscal_documents_billing_invoice_id_fkey',
      ),
    )
  })
})
