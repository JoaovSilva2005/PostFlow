export type InvoiceStatus = 'pending' | 'paid' | 'void'

export interface BillingPlan {
  id: string
  code: string
  name: string
  price: number
  limits: { text: number; image: number }
}

export interface BillingInvoice {
  id: string
  number: string
  amount: number
  status: InvoiceStatus
  dueDate: string
  paidAt: string | null
  receipt: {
    reference: string
    documentNumber: string
    verificationCode: string
    environment: 'simulation'
    issuer: {
      legalName: string
      document: string
      municipalRegistration: string
      city: string
    }
    recipient: {
      name: string
      document: string
      email: string
    }
    service: {
      code: string
      description: string
      municipality: string
    }
    taxRate: number
    taxAmount: number
    netAmount: number
    issuedAt: string
    legalValidity: 'academic_only'
  } | null
}

export interface BillingOverview {
  workspaceId: string
  demoMode: boolean
  plan: BillingPlan | null
  subscription: {
    id: string
    status: string
    currentPeriodStart: string
    currentPeriodEnd: string
  } | null
  usage: {
    period: string
    textUsed: number
    imageUsed: number
    textReserved: number
    imageReserved: number
  }
}

export interface PaymentProvider {
  capture(input: {
    invoiceId: string
    amount: number
    idempotencyKey: string
  }): Promise<{ reference: string }>
}

export interface FiscalProvider {
  issue(input: {
    invoiceId: string
    amount: number
    idempotencyKey: string
  }): Promise<{ reference: string }>
}

export class DemoPaymentProvider implements PaymentProvider {
  async capture(input: { invoiceId: string; idempotencyKey: string }) {
    return {
      reference: `demo-payment-${input.invoiceId}-${input.idempotencyKey}`,
    }
  }
}

export class DemoFiscalProvider implements FiscalProvider {
  async issue(input: { invoiceId: string; idempotencyKey: string }) {
    return { reference: `PF-DEMO-${input.invoiceId}-${input.idempotencyKey}` }
  }
}

export interface BillingRepository {
  getOverview(workspaceId: string): Promise<BillingOverview>
  listInvoices(workspaceId: string): Promise<BillingInvoice[]>
  findInvoiceByIdempotency(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<BillingInvoice | null>
  claimOperation(
    workspaceId: string,
    operation: 'subscription' | 'invoice_payment',
    idempotencyKey: string,
  ): Promise<'claimed' | 'processing' | 'completed'>
  releaseOperation(
    workspaceId: string,
    operation: 'subscription' | 'invoice_payment',
    idempotencyKey: string,
  ): Promise<void>
  createSubscriptionWorkflow(input: {
    workspaceId: string
    planCode: string
    idempotencyKey: string
  }): Promise<BillingInvoice>
  payInvoiceWorkflow(input: {
    workspaceId: string
    invoiceId: string
    idempotencyKey: string
    paymentReference: string
    fiscalReference: string
  }): Promise<BillingInvoice>
  listPlans(): Promise<BillingPlan[]>
  createPlan(input: Omit<BillingPlan, 'id'>): Promise<BillingPlan>
  adminFinance(): Promise<{
    paidIncome: number
    pendingIncome: number
    invoices: number
  }>
  adminFiscal(): Promise<{ issued: number; taxAmount: number }>
}
