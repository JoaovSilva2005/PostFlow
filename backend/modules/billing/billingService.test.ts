// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { BillingService } from './billingService.js'
import type {
  BillingInvoice,
  BillingRepository,
  FiscalProvider,
  PaymentProvider,
} from './billingTypes.js'

function fixture() {
  let invoice: BillingInvoice = {
    id: '10000000-0000-0000-0000-000000000001',
    number: 'PF-1',
    amount: 79.9,
    status: 'pending',
    dueDate: '2026-09-18',
    paidAt: null,
  }
  const claims = new Set<string>()
  const repository: BillingRepository = {
    getOverview: vi.fn(),
    listInvoices: vi.fn(async () => [invoice]),
    findInvoiceByIdempotency: vi.fn(async () => null),
    claimOperation: vi.fn(async (_workspace, _operation, key) => {
      if (claims.has(key)) return 'processing'
      claims.add(key)
      return 'claimed'
    }),
    releaseOperation: vi.fn(async () => undefined),
    createSubscriptionWorkflow: vi.fn(),
    payInvoiceWorkflow: vi.fn(async () => {
      invoice = { ...invoice, status: 'paid', paidAt: new Date().toISOString() }
      return invoice
    }),
    listPlans: vi.fn(async () => []),
    createPlan: vi.fn(),
    adminFinance: vi.fn(),
    adminFiscal: vi.fn(),
  }
  const payment: PaymentProvider = {
    capture: vi.fn(async () => ({ reference: 'payment-1' })),
  }
  const fiscal: FiscalProvider = {
    issue: vi.fn(async () => ({ reference: 'fiscal-1' })),
  }
  return {
    service: new BillingService(repository, payment, fiscal),
    payment,
    fiscal,
  }
}

describe('BillingService', () => {
  it('usa uma chave estável por fatura e evita efeitos externos duplicados', async () => {
    const { service, payment, fiscal } = fixture()
    const results = await Promise.allSettled([
      service.payInvoice(
        'brand-1',
        '10000000-0000-0000-0000-000000000001',
        'request-a',
      ),
      service.payInvoice(
        'brand-1',
        '10000000-0000-0000-0000-000000000001',
        'request-b',
      ),
    ])

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(payment.capture).toHaveBeenCalledTimes(1)
    expect(fiscal.issue).toHaveBeenCalledTimes(1)
    expect(payment.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'invoice:10000000-0000-0000-0000-000000000001',
      }),
    )
  })
})
