import type { FinancialTransaction } from './financial.js'
import { buildFiscalReport } from './fiscal.js'

export interface AccountingReport {
  storage?: 'supabase' | 'demo' | 'test'
  period: string
  basis: 'due_date'
  taxRate: number
  totals: {
    sales: number
    taxes: number
    netRevenue: number
    expenses: number
    result: number
    excludedIncome: number
  }
  outcome: 'profit' | 'loss' | 'balanced'
  sales: ReturnType<typeof buildFiscalReport>['sales']
  expenses: FinancialTransaction[]
  excludedIncome: FinancialTransaction[]
}

export function buildAccountingReport(
  transactions: FinancialTransaction[],
  period: string,
): AccountingReport {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period))
    throw new Error('Informe um período válido no formato AAAA-MM.')
  const monthly = transactions.filter((item) =>
    item.dueDate.startsWith(`${period}-`),
  )
  const isSale = (item: FinancialTransaction) =>
    item.type === 'income' &&
    (item.sourceType === 'sale_service' ||
      item.sourceType === 'subscription_revenue')
  const fiscal = buildFiscalReport(monthly.filter(isSale), period)
  const expenses = monthly.filter((item) => item.type === 'expense')
  const excludedIncome = monthly.filter(
    (item) => item.type === 'income' && !isSale(item),
  )
  const sumCents = (items: FinancialTransaction[]) =>
    items.reduce((total, item) => total + Math.round(item.amount * 100), 0)
  const salesCents = sumCents(fiscal.sales)
  const taxCents = fiscal.sales.reduce(
    (total, sale) => total + Math.round(sale.tax * 100),
    0,
  )
  const expenseCents = sumCents(expenses)
  const resultCents = salesCents - taxCents - expenseCents
  return {
    period,
    basis: 'due_date',
    taxRate: fiscal.taxRate,
    totals: {
      sales: salesCents / 100,
      taxes: taxCents / 100,
      netRevenue: (salesCents - taxCents) / 100,
      expenses: expenseCents / 100,
      result: resultCents / 100,
      excludedIncome: sumCents(excludedIncome) / 100,
    },
    outcome: resultCents > 0 ? 'profit' : resultCents < 0 ? 'loss' : 'balanced',
    sales: fiscal.sales,
    expenses,
    excludedIncome,
  }
}
