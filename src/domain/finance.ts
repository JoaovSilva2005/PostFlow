export type FinancialTransactionType = 'income' | 'expense'
export type FinancialTransactionStatus = 'pending' | 'paid'

export interface FinancialTransaction {
  id: string
  brandId: string
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

export interface FinancialTransactionInput {
  type: FinancialTransactionType
  category: string
  description: string
  amount: number
  dueDate: string
  status: FinancialTransactionStatus
}

export interface FinancialSummary {
  paidIncome: number
  paidExpenses: number
  balance: number
  pendingIncome: number
  pendingExpenses: number
  pendingCount: number
}
