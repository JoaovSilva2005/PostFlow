import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateFinancialTransactionInput,
  FinancialTransaction,
  UpdateFinancialTransactionInput,
} from './financialTypes.js'

interface FinancialTransactionRow {
  id: string
  brand_id: string | null
  source_type: FinancialTransaction['sourceType']
  type: 'income' | 'expense'
  category: string
  description: string
  amount: number | string
  due_date: string
  status: 'pending' | 'paid'
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface FinancialTransactionRepository {
  checkHealth(): Promise<void>
  list(workspaceId: string | null): Promise<FinancialTransaction[]>
  findById(
    id: string,
    workspaceId: string | null,
  ): Promise<FinancialTransaction | null>
  create(
    input: CreateFinancialTransactionInput & { paidAt: string | null },
    workspaceId: string | null,
  ): Promise<FinancialTransaction>
  update(
    id: string,
    input: UpdateFinancialTransactionInput & { paidAt?: string | null },
    workspaceId: string | null,
  ): Promise<FinancialTransaction | null>
  delete(id: string, workspaceId: string | null): Promise<boolean>
}

function toDomain(row: FinancialTransactionRow): FinancialTransaction {
  return {
    id: row.id,
    brandId: row.brand_id,
    sourceType: row.source_type,
    type: row.type,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    dueDate: row.due_date,
    status: row.status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toDatabasePatch(
  input: UpdateFinancialTransactionInput & { paidAt?: string | null },
) {
  return {
    ...(input.type !== undefined && { type: input.type }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.amount !== undefined && { amount: input.amount }),
    ...(input.dueDate !== undefined && { due_date: input.dueDate }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.paidAt !== undefined && { paid_at: input.paidAt }),
    ...(input.sourceType !== undefined && { source_type: input.sourceType }),
  }
}

export class SupabaseFinancialTransactionRepository implements FinancialTransactionRepository {
  private readonly supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async checkHealth() {
    const { error } = await this.supabase
      .from('financial_transactions')
      .select('id')
      .limit(1)
    if (error) throw new Error(`Falha ao verificar banco: ${error.message}`)
  }

  async list(workspaceId: string | null) {
    let query = this.supabase
      .from('financial_transactions')
      .select('*')
      .order('due_date', { ascending: false })
    if (workspaceId) query = query.eq('brand_id', workspaceId)
    const { data, error } = await query

    if (error) throw new Error(`Falha ao listar lançamentos: ${error.message}`)
    return (data as FinancialTransactionRow[]).map(toDomain)
  }

  async findById(id: string, workspaceId: string | null) {
    let query = this.supabase
      .from('financial_transactions')
      .select('*')
      .eq('id', id)
    if (workspaceId) query = query.eq('brand_id', workspaceId)
    const { data, error } = await query.maybeSingle()

    if (error) throw new Error(`Falha ao buscar lançamento: ${error.message}`)
    return data ? toDomain(data as FinancialTransactionRow) : null
  }

  async create(
    input: CreateFinancialTransactionInput & { paidAt: string | null },
    workspaceId: string | null,
  ) {
    const { data, error } = await this.supabase
      .from('financial_transactions')
      .insert({
        brand_id: workspaceId,
        type: input.type,
        category: input.category,
        description: input.description,
        amount: input.amount,
        due_date: input.dueDate,
        status: input.status,
        paid_at: input.paidAt,
        source_type: input.sourceType ?? 'manual',
      })
      .select('*')
      .single()

    if (error) throw new Error(`Falha ao criar lançamento: ${error.message}`)
    return toDomain(data as FinancialTransactionRow)
  }

  async update(
    id: string,
    input: UpdateFinancialTransactionInput & { paidAt?: string | null },
    workspaceId: string | null,
  ) {
    let query = this.supabase
      .from('financial_transactions')
      .update(toDatabasePatch(input))
      .eq('id', id)
    if (workspaceId) query = query.eq('brand_id', workspaceId)
    const { data, error } = await query.select('*').maybeSingle()

    if (error)
      throw new Error(`Falha ao atualizar lançamento: ${error.message}`)
    return data ? toDomain(data as FinancialTransactionRow) : null
  }

  async delete(id: string, workspaceId: string | null) {
    let query = this.supabase
      .from('financial_transactions')
      .delete()
      .eq('id', id)
    if (workspaceId) query = query.eq('brand_id', workspaceId)
    const { data, error } = await query.select('id')

    if (error) throw new Error(`Falha ao excluir lançamento: ${error.message}`)
    return data.length > 0
  }
}
