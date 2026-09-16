import {
  buildFiscalReport,
  calculatePlanEconomics,
  calculateTax,
  DEFAULT_PRICING,
} from './fiscal'
import type { FinancialTransaction } from './finance'

describe('Cálculos fiscais e precificação', () => {
  it('arredonda por venda em centavos e não adiciona imposto ao preço', () => {
    expect(calculateTax(79.9)).toEqual({ gross: 79.9, tax: 4.79, net: 75.11 })
    expect(calculateTax(0.09)).toEqual({ gross: 0.09, tax: 0.01, net: 0.08 })
    expect(() => calculateTax(-1)).toThrow()
  })
  it('exclui despesas e outros meses e distingue pago de pendente', () => {
    const base: FinancialTransaction = {
      id: '1',
      brandId: 'b',
      description: 'Plano',
      category: 'Serviços',
      type: 'income',
      amount: 79.9,
      status: 'paid',
      paidAt: '2026-09-16',
      dueDate: '2026-09-16',
      createdAt: '',
      updatedAt: '',
    }
    const result = buildFiscalReport(
      [
        base,
        { ...base, id: '2', status: 'pending' },
        { ...base, id: '3', type: 'expense' },
        { ...base, id: '4', dueDate: '2026-10-01' },
      ],
      '2026-09',
    )
    expect(result.sales).toHaveLength(2)
    expect(result.totals).toEqual({
      gross: 159.8,
      tax: 9.58,
      net: 150.22,
      received: 79.9,
      pending: 79.9,
    })
  })
  it('calcula o uso integral e expõe cenário deficitário sem mascarar prejuízo', () => {
    expect(calculatePlanEconomics(DEFAULT_PRICING)).toMatchObject({
      api: 9.66,
      fee: 4.49,
      tax: 4.79,
      contribution: 38.96,
    })
    expect(
      calculatePlanEconomics({ ...DEFAULT_PRICING, images: 1000 })!
        .contribution,
    ).toBeLessThan(0)
    expect(calculatePlanEconomics({ ...DEFAULT_PRICING, price: 0 })).toBeNull()
    expect(
      calculatePlanEconomics({ ...DEFAULT_PRICING, exchangeRate: NaN }),
    ).toBeNull()
  })
})
