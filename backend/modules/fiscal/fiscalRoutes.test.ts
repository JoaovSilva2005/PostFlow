// @vitest-environment node
import request from 'supertest'
import { describe, it, expect } from 'vitest'
import { createApp } from '../../app'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../test/InMemoryAuthProvider'
import { InMemoryFinancialRepository } from '../../test/InMemoryFinancialRepository'
import { AuthService } from '../auth/authService'
import { InMemoryWorkspaceAccessRepository } from '../tenancy/workspaceRepository.js'

const authorize = (test: request.Test) =>
  test.set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
const sale = {
  description: 'PostFlow Essencial — Cliente teste',
  amount: 79.9,
  dueDate: '2026-09-18',
  status: 'pending',
}
function setup(role: 'editor' | 'viewer' = 'editor') {
  const repository = new InMemoryFinancialRepository()
  const app = createApp({
    authService: new AuthService(new InMemoryAuthProvider(role)),
    financialRepository: repository,
    workspaceAccessRepository: new InMemoryWorkspaceAccessRepository(
      'test-workspace',
      role,
    ),
  })
  return { app, repository }
}

describe('Fiscal integrado ao financeiro', () => {
  it('cria uma única receita, calcula impostos e reflete pagamento e edição', async () => {
    const { app, repository } = setup()
    const created = await authorize(
      request(app).post('/api/fiscal/sales'),
    ).send(sale)
    expect(created.status).toBe(201)
    expect(created.body.data).toMatchObject({
      gross: 79.9,
      tax: 4.79,
      net: 75.11,
      status: 'pending',
    })
    expect(repository.transactions).toHaveLength(1)
    const id = created.body.data.id
    await authorize(request(app).patch(`/api/finance/transactions/${id}`)).send(
      { amount: 100, status: 'paid' },
    )
    const report = await authorize(
      request(app).get('/api/fiscal/report?period=2026-09'),
    )
    expect(report.body.data.totals).toEqual({
      gross: 100,
      tax: 6,
      net: 94,
      received: 100,
      pending: 0,
    })
    const receipt = await authorize(
      request(app).get(`/api/fiscal/receipts/${id}`),
    )
    expect(receipt.body.data.receiptReference).toBe(`PF-${id}`)
    expect(receipt.body.data.tax).toBe(6)
    const finance = await authorize(request(app).get('/api/finance/summary'))
    expect(finance.body.data.balance).toBe(100)
    await authorize(request(app).delete(`/api/finance/transactions/${id}`))
    expect(
      (await authorize(request(app).get(`/api/fiscal/receipts/${id}`))).status,
    ).toBe(404)
  })
  it('protege leitura e escrita e rejeita mês, valor e imposto adulterados', async () => {
    const { app, repository } = setup()
    expect(
      (await request(app).get('/api/fiscal/report?period=2026-09')).status,
    ).toBe(401)
    expect(
      (await authorize(request(app).get('/api/fiscal/report?period=2026-13')))
        .status,
    ).toBe(400)
    for (const input of [
      { ...sale, amount: -1 },
      { ...sale, amount: 1.234 },
      { ...sale, tax: 0 },
      { ...sale, dueDate: '2026-02-30' },
    ]) {
      expect(
        (await authorize(request(app).post('/api/fiscal/sales')).send(input))
          .status,
      ).toBe(400)
    }
    expect(repository.transactions).toHaveLength(0)
    expect(
      (
        await authorize(
          request(setup('viewer').app).post('/api/fiscal/sales'),
        ).send(sale)
      ).status,
    ).toBe(403)
  })
})
