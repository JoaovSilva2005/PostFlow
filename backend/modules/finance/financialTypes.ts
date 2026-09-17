export type FinancialTransactionType = 'income' | 'expense'
export type FinancialTransactionStatus = 'pending' | 'paid'
export type FinancialTransactionSource =
  'manual' | 'sale_service' | 'subscription_revenue'

export interface FinancialTransaction {
  id: string
  brandId: string | null
  sourceType?: FinancialTransactionSource
  type: FinancialTransactionType
  category: string
  description: string
  amount: number
  dueDate: string
  status: FinancialTransactionStatus
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateFinancialTransactionInput {
  type: FinancialTransactionType
  category: string
  description: string
  amount: number
  dueDate: string
  status: FinancialTransactionStatus
  sourceType?: FinancialTransactionSource
}

export type UpdateFinancialTransactionInput =
  Partial<CreateFinancialTransactionInput>

export interface FinancialSummary {
  paidIncome: number
  paidExpenses: number
  balance: number
  pendingIncome: number
  pendingExpenses: number
  pendingCount: number
}
