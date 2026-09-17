// @vitest-environment node
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { AuthService } from './auth/authService.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../test/InMemoryAuthProvider.js'
import { InMemoryFinancialRepository } from '../test/InMemoryFinancialRepository.js'
import { InMemoryWorkspaceAccessRepository } from './tenancy/workspaceRepository.js'

function appFor(
  platformRole: 'platform_owner' | 'finance_admin' | 'support' | null,
) {
  return createApp({
    authService: new AuthService(new InMemoryAuthProvider()),
    financialRepository: new InMemoryFinancialRepository(),
    workspaceAccessRepository: new InMemoryWorkspaceAccessRepository(
      'test-workspace',
      'viewer',
      platformRole,
    ),
  })
}

function auth(test: request.Test) {
  return test.set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
}

describe('backoffice separado por PlatformRole', () => {
  it('bloqueia cliente comum com 403 mesmo autenticado', async () => {
    const response = await auth(
      request(appFor(null)).get('/api/admin/finance/summary'),
    )
    expect(response.status).toBe(403)
  })

  it('permite leitura para support, mas bloqueia escrita', async () => {
    const app = appFor('support')
    const read = await auth(request(app).get('/api/admin/finance/summary'))
    const write = await auth(
      request(app).post('/api/admin/finance/transactions'),
    ).send({
      type: 'expense',
      category: 'Infraestrutura',
      description: 'Serviço de hospedagem',
      amount: 50,
      dueDate: '2026-09-18',
      status: 'pending',
    })
    expect(read.status).toBe(200)
    expect(write.status).toBe(403)
  })

  it('platform_owner cria lançamento interno sem associar uma marca', async () => {
    const app = appFor('platform_owner')
    const response = await auth(
      request(app).post('/api/admin/finance/transactions'),
    ).send({
      type: 'expense',
      category: 'Infraestrutura',
      description: 'Serviço de hospedagem',
      amount: 50,
      dueDate: '2026-09-18',
      status: 'pending',
    })
    expect(response.status).toBe(201)
    expect(response.body.data.brandId).toBeNull()
  })

  it('não tributa uma receita manual não classificada como venda', async () => {
    const app = appFor('finance_admin')
    const created = await auth(
      request(app).post('/api/admin/finance/transactions'),
    ).send({
      type: 'income',
      category: 'Aporte',
      description: 'Aporte dos sócios',
      amount: 1000,
      dueDate: '2026-09-18',
      status: 'paid',
    })
    expect(created.status).toBe(201)
    const report = await auth(
      request(app).get('/api/admin/fiscal/report?period=2026-09'),
    )
    expect(report.status).toBe(200)
    expect(report.body.data.sales).toHaveLength(0)
  })
})
