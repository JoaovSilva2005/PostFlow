import type { FinancialTransaction } from './financial.js'

// Academic fixed rate, not a statement about the customer's legal tax regime.
export const ACADEMIC_TAX_BPS = 600
export const ESSENTIAL_PLAN = {
  name: 'PostFlow Essencial',
  price: 79.9,
  texts: 100,
  images: 30,
} as const

export const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100

export function calculateTax(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Valor inválido.')
  const grossCents = Math.round(amount * 100)
  const taxCents = Math.round((grossCents * ACADEMIC_TAX_BPS) / 10000)
  return {
    gross: grossCents / 100,
    tax: taxCents / 100,
    net: (grossCents - taxCents) / 100,
  }
}

export interface FiscalSale extends FinancialTransaction {
  gross: number
  tax: number
  net: number
  taxRate: number
  receiptReference: string
}

export interface FiscalReport {
  period: string
  taxRate: number
  sales: FiscalSale[]
  totals: {
    gross: number
    tax: number
    net: number
    received: number
    pending: number
  }
}

export interface SaleInput {
  description: string
  amount: number
  dueDate: string
  status: 'pending' | 'paid'
}

export function toFiscalSale(transaction: FinancialTransaction): FiscalSale {
  return {
    ...transaction,
    ...calculateTax(transaction.amount),
    taxRate: ACADEMIC_TAX_BPS / 100,
    receiptReference: `PF-${transaction.id}`,
  }
}

export function buildFiscalReport(
  transactions: FinancialTransaction[],
  period: string,
): FiscalReport {
  const sales = transactions
    .filter(
      (item) => item.type === 'income' && item.dueDate.startsWith(`${period}-`),
    )
    .map(toFiscalSale)
  const sum = (get: (sale: FiscalSale) => number) =>
    money(sales.reduce((total, sale) => total + get(sale), 0))
  return {
    period,
    taxRate: ACADEMIC_TAX_BPS / 100,
    sales,
    totals: {
      gross: sum((sale) => sale.gross),
      tax: sum((sale) => sale.tax),
      net: sum((sale) => sale.net),
      received: sum((sale) => (sale.status === 'paid' ? sale.gross : 0)),
      pending: sum((sale) => (sale.status === 'pending' ? sale.gross : 0)),
    },
  }
}

export interface PricingAssumptions {
  price: number
  texts: number
  images: number
  exchangeRate: number
  infrastructure: number
  support: number
}

export const DEFAULT_PRICING: PricingAssumptions = {
  price: ESSENTIAL_PLAN.price,
  texts: ESSENTIAL_PLAN.texts,
  images: ESSENTIAL_PLAN.images,
  exchangeRate: 6,
  infrastructure: 10,
  support: 12,
}

export function calculatePlanEconomics(input: PricingAssumptions) {
  if (
    Object.values(input).some(
      (value) => !Number.isFinite(value) || value < 0,
    ) ||
    input.price === 0 ||
    input.exchangeRate === 0
  )
    return null
  const textUsd = (input.texts * (2000 * 0.25 + 1000 * 1.5)) / 1000000
  const imageUsd =
    input.images * (0.0336 + (1000 * 0.25 + 500 * 1.5) / 1000000)
  const api = money((textUsd + imageUsd) * input.exchangeRate * 1.3)
  const fee = money(input.price * 0.0499 + 0.5)
  const tax = calculateTax(input.price).tax
  const cost = money(api + fee + tax + input.infrastructure + input.support)
  const contribution = money(input.price - cost)
  return {
    textUsd,
    imageUsd,
    api,
    fee,
    tax,
    cost,
    contribution,
    margin: (contribution / input.price) * 100,
  }
}
