// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseFinancialTransactionRepository } from './financialRepository.js'

function clientWithPages(
  pages: { data: unknown[] | null; error: { message: string } | null }[],
) {
  const eq = vi.fn()
  const range = vi.fn()
  const order = vi.fn()
  const responses = [...pages]
  const client = {
    from: vi.fn(() => {
      const response = Promise.resolve(responses.shift())
      const query = Object.assign(response, {
        select: vi.fn(() => query),
        order,
        range,
        eq,
      })
      order.mockReturnValue(query)
      range.mockReturnValue(query)
      eq.mockReturnValue(query)
      return query
    }),
  } as unknown as SupabaseClient
  return { client, range, eq }
}
const row = (id: number) => ({
  id: String(id),
  brand_id: 'brand',
  source_type: 'sale_service',
  type: 'income',
  category: 'Venda',
  description: 'Venda',
  amount: '0.10',
  due_date: '2026-10-05',
  status: 'pending',
  paid_at: null,
  created_at: '',
  updated_at: '',
})

describe('consulta completa aos lançamentos PostgreSQL', () => {
  it('lê mais de mil lançamentos com paginação e preserva filtro de workspace', async () => {
    const { client, range, eq } = clientWithPages([
      { data: Array.from({ length: 500 }, (_, i) => row(i)), error: null },
      {
        data: Array.from({ length: 500 }, (_, i) => row(i + 500)),
        error: null,
      },
      { data: [row(1000)], error: null },
    ])
    const transactions = await new SupabaseFinancialTransactionRepository(
      client,
    ).list('brand')
    expect(transactions).toHaveLength(1001)
    expect(transactions[1000].amount).toBe(0.1)
    expect(range.mock.calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ])
    expect(eq.mock.calls).toEqual(Array(3).fill(['brand_id', 'brand']))
  })
  it('não entrega totais parciais quando uma página falha', async () => {
    const { client } = clientWithPages([
      { data: Array.from({ length: 500 }, (_, i) => row(i)), error: null },
      { data: null, error: { message: 'offline' } },
    ])
    await expect(
      new SupabaseFinancialTransactionRepository(client).list(null),
    ).rejects.toThrow('offline')
  })
})
