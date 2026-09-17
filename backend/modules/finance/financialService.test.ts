// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { InMemoryFinancialRepository } from '../../test/InMemoryFinancialRepository'
import { FinancialService } from './financialService'
import type { FinancialTransaction } from './financialTypes'

const paidIncome: FinancialTransaction = {
  id: 'income-paid',
  brandId: 'brand',
  type: 'income',
  category: 'Assinaturas',
  description: 'Receita mensal',
  amount: 3500,
  dueDate: '2026-09-05',
  status: 'paid',
  paidAt: '2026-09-05T12:00:00.000Z',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

function transaction(
  overrides: Partial<FinancialTransaction>,
): FinancialTransaction {
  return { ...paidIncome, ...overrides }
}

describe('FinancialService', () => {
  it('calcula saldo apenas com receitas e despesas pagas', async () => {
    const repository = new InMemoryFinancialRepository([
      paidIncome,
      transaction({ id: 'expense-paid', type: 'expense', amount: 800 }),
      transaction({
        id: 'income-pending',
        amount: 1200,
        status: 'pending',
        paidAt: null,
      }),
      transaction({
        id: 'expense-pending',
        type: 'expense',
        amount: 450,
        status: 'pending',
        paidAt: null,
      }),
    ])

    const summary = await new FinancialService(repository).summary('brand')

    expect(summary).toEqual({
      paidIncome: 3500,
      paidExpenses: 800,
      balance: 2700,
      pendingIncome: 1200,
      pendingExpenses: 450,
      pendingCount: 2,
    })
  })

  it('registra a data de pagamento quando o status muda para pago', async () => {
    const pending = transaction({ status: 'pending', paidAt: null })
    const service = new FinancialService(
      new InMemoryFinancialRepository([pending]),
    )

    const updated = await service.updateStatus(pending.id, 'paid', 'brand')

    expect(updated.status).toBe('paid')
    expect(updated.paidAt).not.toBeNull()
  })

  it('preserva a data de pagamento ao editar um lançamento já pago', async () => {
    const repository = new InMemoryFinancialRepository([paidIncome])
    const service = new FinancialService(repository)

    const updated = await service.update(
      paidIncome.id,
      {
        description: 'Receita mensal atualizada',
        status: 'paid',
      },
      'brand',
    )

    expect(updated.paidAt).toBe(paidIncome.paidAt)
  })

  it('calcula os totais em centavos sem artefatos de ponto flutuante', async () => {
    const repository = new InMemoryFinancialRepository([
      transaction({ id: 'cent-1', amount: 0.1 }),
      transaction({ id: 'cent-2', amount: 0.2 }),
    ])

    const summary = await new FinancialService(repository).summary('brand')

    expect(summary.paidIncome).toBe(0.3)
    expect(summary.balance).toBe(0.3)
  })
})
