// @vitest-environment node
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { AuthService } from '../auth/authService.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../test/InMemoryAuthProvider.js'
import { InMemoryFinancialRepository } from '../../test/InMemoryFinancialRepository.js'
import { InMemoryWorkspaceAccessRepository } from '../tenancy/workspaceRepository.js'
import type { BillingInvoice, BillingRepository } from './billingTypes.js'

function billingRepository(): BillingRepository {
  let invoice: BillingInvoice = {
    id: '10000000-0000-4000-8000-000000000001',
    number: 'PF-20260917-0001',
    amount: 79.9,
    status: 'pending',
    dueDate: '2026-09-24',
    paidAt: null,
    receipt: null,
  }
  const claims = new Set<string>()
  return {
    getOverview: async (workspaceId) => ({
      workspaceId,
      demoMode: true,
      plan: null,
      subscription: null,
      usage: {
        period: '2026-09-01',
        textUsed: 0,
        imageUsed: 0,
        textReserved: 0,
        imageReserved: 0,
      },
    }),
    listInvoices: async () => [invoice],
    findInvoiceByIdempotency: async () => null,
    claimOperation: async (_workspaceId, operation, key) => {
      const claim = `${operation}:${key}`
      if (claims.has(claim)) return 'processing'
      claims.add(claim)
      return 'claimed'
    },
    releaseOperation: async () => undefined,
    createSubscriptionWorkflow: async () => invoice,
    payInvoiceWorkflow: async () => {
      invoice = {
        ...invoice,
        status: 'paid',
        paidAt: '2026-09-17T18:00:00Z',
        receipt: {
          reference: 'PF-DEMO-0001',
          documentNumber: 'SIM-20260917-0001',
          verificationCode: 'ABC123SIMULADO',
          environment: 'simulation',
          issuer: {
            legalName: 'PostFlow Tecnologia Ltda. — emissor simulado',
            document: '00.000.000/0001-00',
            municipalRegistration: '00000000',
            city: 'Curitiba/PR',
          },
          recipient: {
            name: 'Cliente de teste',
            document: 'Não informado — simulação acadêmica',
            email: 'cliente@postflow.test',
          },
          service: {
            code: '01.03',
            description: 'Licenciamento mensal de plataforma SaaS.',
            municipality: 'Curitiba/PR',
          },
          taxRate: 6,
          taxAmount: 4.79,
          netAmount: 75.11,
          issuedAt: '2026-09-17T18:00:00Z',
          legalValidity: 'academic_only',
        },
      }
      return invoice
    },
    listPlans: async () => [
      {
        id: 'plan-1',
        code: 'professional',
        name: 'Profissional',
        price: 79.9,
        limits: { text: 100, image: 30 },
      },
    ],
    createPlan: async (input) => ({ id: 'plan-1', ...input }),
    adminFinance: async () => ({
      paidIncome: 0,
      pendingIncome: 79.9,
      invoices: 1,
    }),
    adminFiscal: async () => ({ issued: 0, taxAmount: 0 }),
  }
}

function appFor(role: 'owner' | 'admin' | 'editor' | 'viewer') {
  return createApp({
    authService: new AuthService(new InMemoryAuthProvider()),
    financialRepository: new InMemoryFinancialRepository(),
    workspaceAccessRepository: new InMemoryWorkspaceAccessRepository(
      'test-workspace',
      role,
    ),
    billingRepository: billingRepository(),
  })
}

function auth(test: request.Test) {
  return test.set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
}

describe('jornada de cobrança do workspace', () => {
  it('permite que qualquer membro consulte os planos disponíveis', async () => {
    const response = await auth(
      request(appFor('viewer')).get(
        '/api/workspaces/test-workspace/billing/plans',
      ),
    )

    expect(response.status).toBe(200)
    expect(response.body.data[0]).toMatchObject({
      code: 'professional',
      price: 79.9,
    })
  })

  it('impede viewer de contratar um plano', async () => {
    const response = await auth(
      request(appFor('viewer')).put('/api/workspaces/test-workspace/billing'),
    )
      .set('Idempotency-Key', 'subscription-attempt-1')
      .send({ planCode: 'professional' })

    expect(response.status).toBe(403)
  })

  it('cria fatura pendente e só a quita na confirmação do pagamento', async () => {
    const app = appFor('owner')
    const subscription = await auth(
      request(app).put('/api/workspaces/test-workspace/billing'),
    )
      .set('Idempotency-Key', 'subscription-attempt-1')
      .send({ planCode: 'professional' })

    expect(subscription.status).toBe(200)
    expect(subscription.body.data.status).toBe('pending')
    expect(subscription.body.data.receipt).toBeNull()

    const paid = await auth(
      request(app).post(
        `/api/workspaces/test-workspace/invoices/${subscription.body.data.id}/pay`,
      ),
    ).set('Idempotency-Key', 'payment-attempt-1')

    expect(paid.status).toBe(200)
    expect(paid.body.data.status).toBe('paid')
    expect(paid.body.data.receipt.legalValidity).toBe('academic_only')
    expect(paid.body.data.receipt.documentNumber).toBe('SIM-20260917-0001')
  })
})
