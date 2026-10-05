// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildAccountingReport } from './accounting.js'
import { buildFiscalReport } from './fiscal.js'
import type { FinancialTransaction } from './financial.js'

const transaction = (
  patch: Partial<FinancialTransaction> = {},
): FinancialTransaction => ({
  id: 'sale',
  brandId: null,
  sourceType: 'sale_service',
  type: 'income',
  category: 'Serviços',
  description: 'Venda',
  amount: 100,
  dueDate: '2026-10-05',
  status: 'pending',
  paidAt: null,
  createdAt: '2026-10-01',
  updatedAt: '2026-10-01',
  ...patch,
})

describe('DRE mensal por competência simplificada', () => {
  it('integra vendas e assinaturas, reutiliza o imposto fiscal e inclui despesas pendentes', () => {
    const items = [
      transaction(),
      transaction({
        id: 'plan',
        sourceType: 'subscription_revenue',
        amount: 79.9,
        status: 'paid',
      }),
      transaction({
        id: 'expense',
        type: 'expense',
        sourceType: 'manual',
        amount: 50,
      }),
      transaction({ id: 'capital', sourceType: 'manual', amount: 1000 }),
    ]
    const report = buildAccountingReport(items, '2026-10')
    expect(report.totals).toEqual({
      sales: 179.9,
      taxes: 10.79,
      netRevenue: 169.11,
      expenses: 50,
      result: 119.11,
      excludedIncome: 1000,
    })
    expect(report.outcome).toBe('profit')
    expect(report.totals.taxes).toBe(
      buildFiscalReport(items.slice(0, 2), '2026-10').totals.tax,
    )
  })
  it('respeita limites do mês e usa vencimento, mesmo quando o pagamento ocorreu em outro mês', () => {
    const report = buildAccountingReport(
      [
        transaction({ dueDate: '2026-09-30' }),
        transaction({
          id: 'start',
          dueDate: '2026-10-01',
          paidAt: '2026-11-01T12:00:00Z',
          status: 'paid',
        }),
        transaction({ id: 'end', dueDate: '2026-10-31' }),
        transaction({ dueDate: '2026-11-01' }),
      ],
      '2026-10',
    )
    expect(report.sales.map((item) => item.id)).toEqual(['start', 'end'])
    expect(report.totals.result).toBe(188)
  })
  it('arredonda o imposto por venda e soma em centavos', () => {
    const report = buildAccountingReport(
      [
        transaction({ amount: 0.1 }),
        transaction({ id: '2', amount: 0.1 }),
        transaction({ id: '3', type: 'expense', amount: 0.1 }),
      ],
      '2026-10',
    )
    expect(report.totals).toMatchObject({
      sales: 0.2,
      taxes: 0.02,
      expenses: 0.1,
      result: 0.08,
    })
  })
  it('mostra prejuízo quando despesas superam vendas líquidas', () => {
    const report = buildAccountingReport(
      [
        transaction(),
        transaction({ id: 'expense', type: 'expense', amount: 150 }),
      ],
      '2026-10',
    )
    expect(report.totals.result).toBe(-56)
    expect(report.outcome).toBe('loss')
  })
  it('retorna zero num período vazio ou equilibrado', () => {
    expect(buildAccountingReport([], '2026-10').totals.result).toBe(0)
    expect(
      buildAccountingReport(
        [transaction(), transaction({ type: 'expense', amount: 94 })],
        '2026-10',
      ).outcome,
    ).toBe('balanced')
  })
  it.each(['2026-13', '2026-00', '2026-1', '0000-01', '2026-10-05'])(
    'rejeita período inválido %s',
    (period) => {
      expect(() => buildAccountingReport([], period)).toThrow('período válido')
    },
  )
})
