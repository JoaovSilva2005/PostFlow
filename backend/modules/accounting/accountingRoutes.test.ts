// @vitest-environment node
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'
import { AuthService } from '../auth/authService.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../test/InMemoryAuthProvider.js'
import { MemoryFinancialTransactionRepository } from '../finance/memoryFinancialRepository.js'
import { InMemoryWorkspaceAccessRepository } from '../tenancy/workspaceRepository.js'

const auth = (test: request.Test) =>
  test.set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
function setup(
  role: 'platform_owner' | 'finance_admin' | 'support' | null = 'finance_admin',
) {
  const repository = new MemoryFinancialTransactionRepository()
  const app = createApp({
    authService: new AuthService(new InMemoryAuthProvider()),
    financialRepository: repository,
    workspaceAccessRepository: new InMemoryWorkspaceAccessRepository(
      'test-workspace',
      'viewer',
      role,
    ),
  })
  return { app, repository }
}
const sale = {
  description: 'Serviço de conteúdo',
  amount: 100,
  dueDate: '2026-10-05',
  status: 'pending',
}
const expense = {
  type: 'expense',
  category: 'Hospedagem',
  description: 'Hospedagem mensal',
  amount: 50,
  dueDate: '2026-10-10',
  status: 'pending',
}

describe('fluxo Financeiro → Fiscal → Contábil', () => {
  it('consulta as fontes, acompanha edição/status/exclusão e mantém competência independente do caixa', async () => {
    const { app } = setup()
    const createdSale = await auth(
      request(app).post('/api/admin/fiscal/sales'),
    ).send(sale)
    const createdExpense = await auth(
      request(app).post('/api/admin/finance/transactions'),
    ).send(expense)
    expect(createdSale.status).toBe(201)
    expect(createdExpense.status).toBe(201)
    const dre = () =>
      auth(request(app).get('/api/admin/accounting/report?period=2026-10'))
    const first = await dre()
    const fiscal = await auth(
      request(app).get('/api/admin/fiscal/report?period=2026-10'),
    )
    expect(first.body.data.totals).toMatchObject({
      sales: fiscal.body.data.totals.gross,
      taxes: fiscal.body.data.totals.tax,
      expenses: 50,
      result: 44,
    })
    expect(
      (await auth(request(app).get('/api/admin/finance/summary'))).body.data
        .balance,
    ).toBe(0)
    const paid = await auth(
      request(app).patch(
        `/api/admin/finance/transactions/${createdSale.body.data.id}/status`,
      ),
    ).send({ status: 'paid' })
    expect(paid.status).toBe(200)
    expect((await dre()).body.data.totals.result).toBe(44)
    const edited = await auth(
      request(app).patch(
        `/api/admin/finance/transactions/${createdExpense.body.data.id}`,
      ),
    ).send({ amount: 150 })
    expect(edited.status).toBe(200)
    expect((await dre()).body.data.outcome).toBe('loss')
    expect((await dre()).body.data.totals.result).toBe(-56)
    expect(
      (
        await auth(
          request(app).delete(
            `/api/admin/finance/transactions/${createdSale.body.data.id}`,
          ),
        )
      ).status,
    ).toBe(204)
    expect((await dre()).body.data.totals).toMatchObject({
      sales: 0,
      taxes: 0,
      result: -150,
    })
  })
  it('retorna 401 sem autenticação e 403 para clientes comuns', async () => {
    expect(
      (
        await request(setup().app).get(
          '/api/admin/accounting/report?period=2026-10',
        )
      ).status,
    ).toBe(401)
    expect(
      (
        await auth(
          request(setup(null).app).get(
            '/api/admin/accounting/report?period=2026-10',
          ),
        )
      ).status,
    ).toBe(403)
  })
  it.each(['platform_owner', 'finance_admin', 'support'] as const)(
    'permite leitura para %s, sem rota de escrita contábil',
    async (role) => {
      const { app } = setup(role)
      expect(
        (
          await auth(
            request(app).get('/api/admin/accounting/report?period=2026-10'),
          )
        ).status,
      ).toBe(200)
      expect(
        (
          await auth(request(app).post('/api/admin/accounting/report')).send({
            result: 999,
          })
        ).status,
      ).toBe(404)
    },
  )
  it.each([
    '',
    '?period=2026-13',
    '?period=0000-10',
    '?period=2026-10&period=2026-09',
    '?period=2026-10-05',
  ])('rejeita período ausente ou inválido %s', async (query) => {
    expect(
      (
        await auth(
          request(setup().app).get(`/api/admin/accounting/report${query}`),
        )
      ).status,
    ).toBe(400)
  })
  it('propaga falha de persistência sem inventar um resultado zero', async () => {
    const { app, repository } = setup()
    vi.spyOn(repository, 'list').mockRejectedValue(
      new Error('database offline'),
    )
    const response = await auth(
      request(app).get('/api/admin/accounting/report?period=2026-10'),
    )
    expect(response.status).toBe(500)
    expect(response.body.data).toBeUndefined()
  })
})
