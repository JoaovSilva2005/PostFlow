import { randomUUID } from 'node:crypto'
import type { FinancialTransactionRepository } from '../finance/financialRepository'
import type {
  CreateFinancialTransactionInput,
  FinancialTransaction,
  UpdateFinancialTransactionInput,
} from '../finance/financialTypes'

export class InMemoryFinancialRepository
  implements FinancialTransactionRepository
{
  transactions: FinancialTransaction[]

  constructor(transactions: FinancialTransaction[] = []) {
    this.transactions = transactions
  }

  async list() {
    return [...this.transactions]
  }

  async findById(id: string) {
    return this.transactions.find((transaction) => transaction.id === id) ?? null
  }

  async create(
    input: CreateFinancialTransactionInput & { paidAt: string | null },
  ) {
    const now = new Date().toISOString()
    const transaction: FinancialTransaction = {
      id: randomUUID(),
      brandId: '10000000-0000-0000-0000-000000000001',
      ...input,
      createdAt: now,
      updatedAt: now,
    }
    this.transactions.push(transaction)
    return transaction
  }

  async update(
    id: string,
    input: UpdateFinancialTransactionInput & { paidAt?: string | null },
  ) {
    const index = this.transactions.findIndex(
      (transaction) => transaction.id === id,
    )
    if (index < 0) return null

    const updated = {
      ...this.transactions[index],
      ...input,
      updatedAt: new Date().toISOString(),
    }
    this.transactions[index] = updated
    return updated
  }

  async delete(id: string) {
    const originalLength = this.transactions.length
    this.transactions = this.transactions.filter(
      (transaction) => transaction.id !== id,
    )
    return this.transactions.length < originalLength
  }
}
