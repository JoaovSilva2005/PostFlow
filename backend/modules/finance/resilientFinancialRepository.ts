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

  checkHealth() {
    return this.execute((repository) => repository.checkHealth())
  }

  list(workspaceId: string | null) {
    return this.execute((repository) => repository.list(workspaceId))
  }

  findById(id: string, workspaceId: string | null) {
    return this.execute((repository) => repository.findById(id, workspaceId))
  }

  create(
    input: CreateFinancialTransactionInput & { paidAt: string | null },
    workspaceId: string | null,
  ) {
    return this.execute((repository) => repository.create(input, workspaceId))
  }

  update(
    id: string,
    input: UpdateFinancialTransactionInput & { paidAt?: string | null },
    workspaceId: string | null,
  ) {
    return this.execute((repository) =>
      repository.update(id, input, workspaceId),
    )
  }

  delete(id: string, workspaceId: string | null) {
    return this.execute((repository) => repository.delete(id, workspaceId))
  }

  private async execute<T>(
    operation: (repository: FinancialTransactionRepository) => Promise<T>,
  ) {
    if (this.mode === 'demo') return operation(this.fallback)

    try {
      return await operation(this.primary)
    } catch {
      this.mode = 'demo'
      console.warn(
        'Supabase indisponível; modo demonstração ativado.',
      )
      return operation(this.fallback)
    }
  }
}
