import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BillingInvoice,
  BillingOverview,
  BillingPlan,
  BillingRepository,
} from './billingTypes.js'

const invoiceSelection =
  'id,invoice_number,amount_cents,status,due_date,paid_at,fiscal_documents!fiscal_documents_billing_invoice_id_fkey(external_reference,tax_rate,tax_cents,net_cents,issued_at)'

const cents = (value: number | string) => Number(value) / 100

function plan(row: any): BillingPlan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    price: cents(row.price_cents),
    limits: { text: row.text_limit, image: row.image_limit },
  }
}

function invoice(row: any, fiscal?: any): BillingInvoice {
  return {
    id: row.id,
    number: row.invoice_number,
    amount: cents(row.amount_cents),
    status: row.status,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    receipt: fiscal
      ? {
          reference: fiscal.external_reference,
          taxRate: Number(fiscal.tax_rate) * 100,
          taxAmount: cents(fiscal.tax_cents),
          netAmount: cents(fiscal.net_cents),
          issuedAt: fiscal.issued_at,
          legalValidity: 'academic_only' as const,
        }
      : null,
  }
}

export class SupabaseBillingRepository implements BillingRepository {
  private readonly supabase: SupabaseClient
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async getOverview(workspaceId: string): Promise<BillingOverview> {
    const [
      { data: subscription, error: subscriptionError },
      { data: usage, error: usageError },
    ] = await Promise.all([
      this.supabase
        .from('subscriptions')
        .select(
          'id,status,current_period_start,current_period_end,plans(id,code,name,price_cents,text_limit,image_limit)',
        )
        .eq('brand_id', workspaceId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.supabase
        .from('usage_counters')
        .select('period_start,text_used,image_used')
        .eq('brand_id', workspaceId)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (subscriptionError || usageError)
      throw new Error(
        `Falha ao consultar billing: ${subscriptionError?.message ?? usageError?.message}`,
      )
    const subscriptionPlan = subscription?.plans as any
    return {
      workspaceId,
      demoMode: true,
      plan: subscriptionPlan ? plan(subscriptionPlan) : null,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
          }
        : null,
      usage: {
        period: usage?.period_start ?? new Date().toISOString().slice(0, 10),
        textUsed: usage?.text_used ?? 0,
        imageUsed: usage?.image_used ?? 0,
      },
    }
  }

  async listInvoices(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('billing_invoices')
      .select(invoiceSelection)
      .eq('brand_id', workspaceId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Falha ao listar faturas: ${error.message}`)
    return (data ?? []).map((row: any) =>
      invoice(
        row,
        Array.isArray(row.fiscal_documents)
          ? row.fiscal_documents[0]
          : row.fiscal_documents,
      ),
    )
  }

  async findInvoiceByIdempotency(workspaceId: string, idempotencyKey: string) {
    const { data, error } = await this.supabase
      .from('billing_invoices')
      .select(invoiceSelection)
      .eq('brand_id', workspaceId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (error)
      throw new Error(`Falha ao consultar fatura idempotente: ${error.message}`)
    return data
      ? invoice(
          data,
          Array.isArray((data as any).fiscal_documents)
            ? (data as any).fiscal_documents[0]
            : (data as any).fiscal_documents,
        )
      : null
  }

  async claimOperation(
    workspaceId: string,
    operation: 'subscription' | 'invoice_payment',
    idempotencyKey: string,
  ) {
    const { data, error } = await this.supabase.rpc('claim_billing_operation', {
      p_workspace_id: workspaceId,
      p_operation: operation,
      p_idempotency_key: idempotencyKey,
    })
    if (error || !data)
      throw new Error(
        `Falha ao reservar operação idempotente: ${error?.message ?? 'sem resultado'}`,
      )
    return data as 'claimed' | 'processing' | 'completed'
  }

  async releaseOperation(
    workspaceId: string,
    operation: 'subscription' | 'invoice_payment',
    idempotencyKey: string,
  ) {
    const { error } = await this.supabase
      .from('billing_operation_claims')
      .delete()
      .eq('brand_id', workspaceId)
      .eq('operation', operation)
      .eq('idempotency_key', idempotencyKey)
      .eq('status', 'processing')
    if (error) {
      throw new Error(`Falha ao liberar operação idempotente: ${error.message}`)
    }
  }

  private async workflow(name: string, input: Record<string, string>) {
    const { data, error } = await this.supabase.rpc(name, input)
    if (error) throw new Error(`Falha no fluxo de cobrança: ${error.message}`)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new Error('Fluxo de cobrança não retornou fatura.')
    return invoice(
      row,
      row.fiscal_reference
        ? {
            external_reference: row.fiscal_reference,
            tax_rate: 0.06,
            tax_cents: row.tax_cents,
            net_cents: row.net_cents,
            issued_at: row.issued_at,
          }
        : undefined,
    )
  }

  createSubscriptionWorkflow(input: {
    workspaceId: string
    planCode: string
    idempotencyKey: string
  }) {
    return this.workflow('create_subscription_invoice_workflow', {
      p_workspace_id: input.workspaceId,
      p_plan_code: input.planCode,
      p_idempotency_key: input.idempotencyKey,
    })
  }

  payInvoiceWorkflow(input: {
    workspaceId: string
    invoiceId: string
    idempotencyKey: string
    paymentReference: string
    fiscalReference: string
  }) {
    return this.workflow('pay_billing_invoice_workflow', {
      p_workspace_id: input.workspaceId,
      p_invoice_id: input.invoiceId,
      p_idempotency_key: input.idempotencyKey,
      p_payment_reference: input.paymentReference,
      p_fiscal_reference: input.fiscalReference,
    })
  }

  async listPlans() {
    const { data, error } = await this.supabase
      .from('plans')
      .select('*')
      .eq('active', true)
      .order('price_cents')
    if (error) throw new Error(`Falha ao listar planos: ${error.message}`)
    return (data ?? []).map(plan)
  }

  async createPlan(input: Omit<BillingPlan, 'id'>) {
    const { data, error } = await this.supabase
      .from('plans')
      .insert({
        code: input.code,
        name: input.name,
        price_cents: Math.round(input.price * 100),
        text_limit: input.limits.text,
        image_limit: input.limits.image,
      })
      .select('*')
      .single()
    if (error) throw new Error(`Falha ao criar plano: ${error.message}`)
    return plan(data)
  }

  async adminFinance() {
    const { data, error } = await this.supabase
      .from('billing_invoices')
      .select('amount_cents,status')
    if (error)
      throw new Error(`Falha ao consultar financeiro: ${error.message}`)
    return (data ?? []).reduce(
      (
        result: { paidIncome: number; pendingIncome: number; invoices: number },
        row: any,
      ) => ({
        paidIncome:
          result.paidIncome +
          (row.status === 'paid' ? cents(row.amount_cents) : 0),
        pendingIncome:
          result.pendingIncome +
          (row.status === 'pending' ? cents(row.amount_cents) : 0),
        invoices: result.invoices + 1,
      }),
      { paidIncome: 0, pendingIncome: 0, invoices: 0 },
    )
  }

  async adminFiscal() {
    const { data, error } = await this.supabase
      .from('fiscal_documents')
      .select('tax_cents')
    if (error) throw new Error(`Falha ao consultar fiscal: ${error.message}`)
    return {
      issued: data?.length ?? 0,
      taxAmount: (data ?? []).reduce(
        (total: number, row: any) => total + cents(row.tax_cents),
        0,
      ),
    }
  }
}
