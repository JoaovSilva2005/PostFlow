import { randomUUID } from 'node:crypto'
import type { FinancialTransactionRepository } from './financialRepository'
import type {
  CreateFinancialTransactionInput,
  FinancialTransaction,
  UpdateFinancialTransactionInput,
} from './financialTypes'

const DEMO_BRAND_ID = '10000000-0000-0000-0000-000000000001'

export function createDemoFinancialTransactions(): FinancialTransaction[] {
  const createdAt = '2026-09-01T12:00:00.000Z'

  return [
    {
      id: '40000000-0000-0000-0000-000000000001',
      brandId: DEMO_BRAND_ID,
      type: 'income',
      category: 'Assinaturas',
      description: 'Receita mensal dos planos PostFlow',
      amount: 3500,
      dueDate: '2026-09-05',
      status: 'paid',
      paidAt: '2026-09-05T12:00:00.000Z',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: '40000000-0000-0000-0000-000000000002',
      brandId: DEMO_BRAND_ID,
      type: 'expense',
      category: 'Infraestrutura',
      description: 'Serviços de hospedagem e banco de dados',
      amount: 800,
      dueDate: '2026-09-08',
      status: 'paid',
      paidAt: '2026-09-08T15:30:00.000Z',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: '40000000-0000-0000-0000-000000000003',
      brandId: DEMO_BRAND_ID,
      type: 'expense',
      category: 'Marketing',
      description: 'Campanha de divulgação do produto',
      amount: 450,
      dueDate: '2026-09-20',
      status: 'pending',
      paidAt: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: '40000000-0000-0000-0000-000000000004',
      brandId: DEMO_BRAND_ID,
      type: 'income',
      category: 'Serviços',
      description: 'Consultoria de conteúdo para cliente',
      amount: 1200,
      dueDate: '2026-09-25',
      status: 'pending',
      paidAt: null,
      createdAt,
      updatedAt: createdAt,
    },
  ]
}

export class MemoryFinancialTransactionRepository implements FinancialTransactionRepository {
  transactions: FinancialTransaction[]

  constructor(transactions: FinancialTransaction[] = []) {
    this.transactions = transactions
  }

  async list() {
    return [...this.transactions]
  }

  async findById(id: string) {
    return (
      this.transactions.find((transaction) => transaction.id === id) ?? null
    )
  }

  async create(
    input: CreateFinancialTransactionInput & { paidAt: string | null },
  ) {
    const now = new Date().toISOString()
    const transaction: FinancialTransaction = {
      id: randomUUID(),
      brandId: DEMO_BRAND_ID,
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
