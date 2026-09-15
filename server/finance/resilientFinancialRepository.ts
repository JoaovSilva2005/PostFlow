import type { FinancialTransactionRepository } from './financialRepository.js'
import type {
  CreateFinancialTransactionInput,
  UpdateFinancialTransactionInput,
} from './financialTypes.js'

export type FinancialStorageMode = 'supabase' | 'demo'

export class ResilientFinancialTransactionRepository implements FinancialTransactionRepository {
  private mode: FinancialStorageMode = 'supabase'
  private readonly primary: FinancialTransactionRepository
  private readonly fallback: FinancialTransactionRepository

  constructor(
    primary: FinancialTransactionRepository,
    fallback: FinancialTransactionRepository,
  ) {
    this.primary = primary
    this.fallback = fallback
  }

  getMode() {
    return this.mode
  }

  list() {
    return this.execute((repository) => repository.list())
  }

  findById(id: string) {
    return this.execute((repository) => repository.findById(id))
  }

  create(input: CreateFinancialTransactionInput & { paidAt: string | null }) {
    return this.execute((repository) => repository.create(input))
  }

  update(
    id: string,
    input: UpdateFinancialTransactionInput & { paidAt?: string | null },
  ) {
    return this.execute((repository) => repository.update(id, input))
  }

  delete(id: string) {
    return this.execute((repository) => repository.delete(id))
  }

  private async execute<T>(
    operation: (repository: FinancialTransactionRepository) => Promise<T>,
  ) {
    if (this.mode === 'demo') return operation(this.fallback)

    try {
      return await operation(this.primary)
    } catch (error) {
      this.mode = 'demo'
      const reason =
        error instanceof Error ? error.message : 'erro desconhecido'
      console.warn(
        `Supabase indisponível; modo demonstração ativado: ${reason}`,
      )
      return operation(this.fallback)
    }
  }
}
