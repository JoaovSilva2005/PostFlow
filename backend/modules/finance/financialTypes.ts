import type {
  FinancialTransactionSource,
  FinancialTransactionStatus,
  FinancialTransactionType,
} from '../../../shared/domain/financial.js'

export type {
  FinancialTransaction,
  FinancialTransactionInput,
  FinancialTransactionSource,
  FinancialTransactionStatus,
  FinancialTransactionType,
} from '../../../shared/domain/financial.js'

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
