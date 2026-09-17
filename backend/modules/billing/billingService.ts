import { HttpError } from '../../shared/HttpError.js'
import type {
  BillingRepository,
  FiscalProvider,
  PaymentProvider,
} from './billingTypes.js'

export class BillingService {
  private readonly repository: BillingRepository
  private readonly payments: PaymentProvider
  private readonly fiscal: FiscalProvider
  constructor(
    repository: BillingRepository,
    payments: PaymentProvider,
    fiscal: FiscalProvider,
  ) {
    this.repository = repository
    this.payments = payments
    this.fiscal = fiscal
  }

  getOverview(workspaceId: string) {
    return this.repository.getOverview(workspaceId)
  }
  listInvoices(workspaceId: string) {
    return this.repository.listInvoices(workspaceId)
  }
  listPlans() {
    return this.repository.listPlans()
  }
  adminFinance() {
    return this.repository.adminFinance()
  }
  adminFiscal() {
    return this.repository.adminFiscal()
  }
  createPlan(input: Parameters<BillingRepository['createPlan']>[0]) {
    return this.repository.createPlan(input)
  }

  async subscribe(
    workspaceId: string,
    planCode: string,
    idempotencyKey: string,
  ) {
    const claim = await this.repository.claimOperation(
      workspaceId,
      'subscription',
      idempotencyKey,
    )
    if (claim === 'completed') {
      const existing = await this.repository.findInvoiceByIdempotency(
        workspaceId,
        idempotencyKey,
      )
      if (existing) return existing
    }
    if (claim === 'processing')
      throw new HttpError(409, 'A operação já está em processamento.')
    try {
      const plans = await this.repository.listPlans()
      const selected = plans.find((candidate) => candidate.code === planCode)
      if (!selected) throw new HttpError(404, 'Plano não encontrado.')
      const provisionalId = `${workspaceId}:${planCode}`
      const payment = await this.payments.capture({
        invoiceId: provisionalId,
        amount: selected.price,
        idempotencyKey,
      })
      const fiscal = await this.fiscal.issue({
        invoiceId: provisionalId,
        amount: selected.price,
        idempotencyKey,
      })
      return await this.repository.createSubscriptionWorkflow({
        workspaceId,
        planCode,
        idempotencyKey,
        paymentReference: payment.reference,
        fiscalReference: fiscal.reference,
      })
    } catch (error) {
      await this.repository.releaseOperation(
        workspaceId,
        'subscription',
        idempotencyKey,
      )
      throw error
    }
  }

  async payInvoice(
    workspaceId: string,
    invoiceId: string,
    _idempotencyKey: string,
  ) {
    const current = (await this.repository.listInvoices(workspaceId)).find(
      (invoice) => invoice.id === invoiceId,
    )
    if (!current) throw new HttpError(404, 'Fatura não encontrada.')
    if (current.status === 'paid') return current
    const operationKey = `invoice:${invoiceId}`
    const claim = await this.repository.claimOperation(
      workspaceId,
      'invoice_payment',
      operationKey,
    )
    if (claim === 'completed') {
      const completed = (await this.repository.listInvoices(workspaceId)).find(
        (invoice) => invoice.id === invoiceId,
      )
      if (completed) return completed
    }
    if (claim === 'processing')
      throw new HttpError(409, 'A operação já está em processamento.')
    try {
      const payment = await this.payments.capture({
        invoiceId,
        amount: current.amount,
        idempotencyKey: operationKey,
      })
      const fiscal = await this.fiscal.issue({
        invoiceId,
        amount: current.amount,
        idempotencyKey: operationKey,
      })
      return await this.repository.payInvoiceWorkflow({
        workspaceId,
        invoiceId,
        idempotencyKey: operationKey,
        paymentReference: payment.reference,
        fiscalReference: fiscal.reference,
      })
    } catch (error) {
      await this.repository.releaseOperation(
        workspaceId,
        'invoice_payment',
        operationKey,
      )
      throw error
    }
  }
}
