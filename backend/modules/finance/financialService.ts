import { HttpError } from '../../shared/HttpError.js'
import type { FinancialTransactionRepository } from './financialRepository.js'
import type {
  CreateFinancialTransactionInput,
  FinancialSummary,
  FinancialTransaction,
  FinancialTransactionStatus,
  UpdateFinancialTransactionInput,
} from './financialTypes.js'

export function calculateFinancialSummary(
  transactions: FinancialTransaction[],
): FinancialSummary {
  return transactions.reduce<FinancialSummary>(
    (summary, transaction) => {
      if (transaction.status === 'paid') {
        if (transaction.type === 'income') {
          summary.paidIncome += transaction.amount
        } else {
          summary.paidExpenses += transaction.amount
        }

        summary.balance = summary.paidIncome - summary.paidExpenses
        return summary
      }

      if (transaction.type === 'income') {
        summary.pendingIncome += transaction.amount
      } else {
        summary.pendingExpenses += transaction.amount
      }
      summary.pendingCount += 1

      return summary
    },
    {
      paidIncome: 0,
      paidExpenses: 0,
      balance: 0,
      pendingIncome: 0,
      pendingExpenses: 0,
      pendingCount: 0,
    },
  )
}

export class FinancialService {
  private readonly repository: FinancialTransactionRepository

  constructor(repository: FinancialTransactionRepository) {
    this.repository = repository
  }

  list() {
    return this.repository.list()
  }

  async summary() {
    return calculateFinancialSummary(await this.repository.list())
  }

  create(input: CreateFinancialTransactionInput) {
    return this.repository.create({
      ...input,
      paidAt: input.status === 'paid' ? new Date().toISOString() : null,
    })
  }

  async update(id: string, input: UpdateFinancialTransactionInput) {
    await this.requireTransaction(id)
    const paidAt = this.paidAtFor(input.status)
    const updated = await this.repository.update(id, {
      ...input,
      ...(paidAt !== undefined && { paidAt }),
    })

    if (!updated) throw new HttpError(404, 'Lançamento não encontrado.')
    return updated
  }

  updateStatus(id: string, status: FinancialTransactionStatus) {
    return this.update(id, { status })
  }

  async delete(id: string) {
    if (!(await this.repository.delete(id))) {
      throw new HttpError(404, 'Lançamento não encontrado.')
    }
  }

  private async requireTransaction(id: string) {
    const transaction = await this.repository.findById(id)
    if (!transaction) throw new HttpError(404, 'Lançamento não encontrado.')
    return transaction
  }

  private paidAtFor(status?: FinancialTransactionStatus) {
    if (status === 'paid') return new Date().toISOString()
    if (status === 'pending') return null
    return undefined
  }
}
