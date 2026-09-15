import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateFinancialTransactionInput,
  FinancialTransaction,
  UpdateFinancialTransactionInput,
} from './financialTypes'

export const DEMO_BRAND_ID = '10000000-0000-0000-0000-000000000001'

interface FinancialTransactionRow {
  id: string
  brand_id: string
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
  list(): Promise<FinancialTransaction[]>
  findById(id: string): Promise<FinancialTransaction | null>
  create(
    input: CreateFinancialTransactionInput & { paidAt: string | null },
  ): Promise<FinancialTransaction>
  update(
    id: string,
    input: UpdateFinancialTransactionInput & { paidAt?: string | null },
  ): Promise<FinancialTransaction | null>
  delete(id: string): Promise<boolean>
}

function toDomain(row: FinancialTransactionRow): FinancialTransaction {
  return {
    id: row.id,
    brandId: row.brand_id,
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
  }
}

export class SupabaseFinancialTransactionRepository
  implements FinancialTransactionRepository
{
  private readonly supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async list() {
    const { data, error } = await this.supabase
      .from('financial_transactions')
      .select('*')
      .eq('brand_id', DEMO_BRAND_ID)
      .order('due_date', { ascending: false })

    if (error) throw new Error(`Falha ao listar lançamentos: ${error.message}`)
    return (data as FinancialTransactionRow[]).map(toDomain)
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from('financial_transactions')
      .select('*')
      .eq('id', id)
      .eq('brand_id', DEMO_BRAND_ID)
      .maybeSingle()

    if (error) throw new Error(`Falha ao buscar lançamento: ${error.message}`)
    return data ? toDomain(data as FinancialTransactionRow) : null
  }

  async create(
    input: CreateFinancialTransactionInput & { paidAt: string | null },
  ) {
    const { data, error } = await this.supabase
      .from('financial_transactions')
      .insert({
        brand_id: DEMO_BRAND_ID,
        type: input.type,
        category: input.category,
        description: input.description,
        amount: input.amount,
        due_date: input.dueDate,
        status: input.status,
        paid_at: input.paidAt,
      })
      .select('*')
      .single()

    if (error) throw new Error(`Falha ao criar lançamento: ${error.message}`)
    return toDomain(data as FinancialTransactionRow)
  }

  async update(
    id: string,
    input: UpdateFinancialTransactionInput & { paidAt?: string | null },
  ) {
    const { data, error } = await this.supabase
      .from('financial_transactions')
      .update(toDatabasePatch(input))
      .eq('id', id)
      .eq('brand_id', DEMO_BRAND_ID)
      .select('*')
      .maybeSingle()

    if (error) throw new Error(`Falha ao atualizar lançamento: ${error.message}`)
    return data ? toDomain(data as FinancialTransactionRow) : null
  }

  async delete(id: string) {
    const { data, error } = await this.supabase
      .from('financial_transactions')
      .delete()
      .eq('id', id)
      .eq('brand_id', DEMO_BRAND_ID)
      .select('id')

    if (error) throw new Error(`Falha ao excluir lançamento: ${error.message}`)
    return data.length > 0
  }
}
