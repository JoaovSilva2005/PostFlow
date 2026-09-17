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
  const cents = transactions.reduce(
    (summary, transaction) => {
      const amount = Math.round(transaction.amount * 100)
      if (transaction.status === 'paid') {
        if (transaction.type === 'income') {
          summary.paidIncome += amount
        } else {
          summary.paidExpenses += amount
        }

        summary.balance = summary.paidIncome - summary.paidExpenses
        return summary
      }

      if (transaction.type === 'income') {
        summary.pendingIncome += amount
      } else {
        summary.pendingExpenses += amount
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
  return {
    paidIncome: cents.paidIncome / 100,
    paidExpenses: cents.paidExpenses / 100,
    balance: cents.balance / 100,
    pendingIncome: cents.pendingIncome / 100,
    pendingExpenses: cents.pendingExpenses / 100,
    pendingCount: cents.pendingCount,
  }
}

export class FinancialService {
  private readonly repository: FinancialTransactionRepository

  constructor(repository: FinancialTransactionRepository) {
    this.repository = repository
  }

  list(workspaceId: string | null) {
    return this.repository.list(workspaceId)
  }

  async summary(workspaceId: string | null) {
    return calculateFinancialSummary(await this.repository.list(workspaceId))
  }

  create(input: CreateFinancialTransactionInput, workspaceId: string | null) {
    return this.repository.create(
      {
        ...input,
        paidAt: input.status === 'paid' ? new Date().toISOString() : null,
      },
      workspaceId,
    )
  }

  async update(
    id: string,
    input: UpdateFinancialTransactionInput,
    workspaceId: string | null,
  ) {
    const current = await this.requireTransaction(id, workspaceId)
    const paidAt = this.paidAtFor(current, input.status)
    const updated = await this.repository.update(
      id,
      {
        ...input,
        ...(paidAt !== undefined && { paidAt }),
      },
      workspaceId,
    )

    if (!updated) throw new HttpError(404, 'Lançamento não encontrado.')
    return updated
  }

  updateStatus(
    id: string,
    status: FinancialTransactionStatus,
    workspaceId: string | null,
  ) {
    return this.update(id, { status }, workspaceId)
  }

  async delete(id: string, workspaceId: string | null) {
    if (!(await this.repository.delete(id, workspaceId))) {
      throw new HttpError(404, 'Lançamento não encontrado.')
    }
  }

  private async requireTransaction(id: string, workspaceId: string | null) {
    const transaction = await this.repository.findById(id, workspaceId)
    if (!transaction) throw new HttpError(404, 'Lançamento não encontrado.')
    return transaction
  }

  private paidAtFor(
    current: FinancialTransaction,
    status?: FinancialTransactionStatus,
  ) {
    if (status === undefined || status === current.status) return undefined
    if (status === 'paid') return new Date().toISOString()
    if (status === 'pending') return null
    return undefined
  }
}
