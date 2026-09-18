// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { SupabaseBillingRepository } from './billingRepository.js'

describe('SupabaseBillingRepository', () => {
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
