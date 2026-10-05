import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../../backend/app.js'
import { createSupabaseAdminDataClient } from '../../backend/config/supabaseServer.js'
import { AuthService } from '../../backend/modules/auth/authService.js'
import { SupabaseFinancialTransactionRepository } from '../../backend/modules/finance/financialRepository.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../backend/test/InMemoryAuthProvider.js'
import { InMemoryWorkspaceAccessRepository } from '../../backend/modules/tenancy/workspaceRepository.js'

// Real PostgreSQL and application routes; deterministic auth isolates this
// check from human accounts. Only records created here are deleted in finally.
const repository = new SupabaseFinancialTransactionRepository(
  createSupabaseAdminDataClient(),
)
const app = createApp({
  financialRepository: repository,
  authService: new AuthService(new InMemoryAuthProvider()),
  workspaceAccessRepository: new InMemoryWorkspaceAccessRepository(
    'test-workspace',
    'viewer',
    'finance_admin',
  ),
})
const auth = (test: request.Test) =>
  test.set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
const period = '2099-12'
const runId = randomUUID()
const createdIds: string[] = []
const dre = () =>
  auth(request(app).get(`/api/admin/accounting/report?period=${period}`))

try {
  await repository.checkHealth()
  const baseline = await dre()
  assert.equal(baseline.status, 200)
  const fiscalBefore = await auth(
    request(app).get(`/api/admin/fiscal/report?period=${period}`),
  )
  const sale = await auth(request(app).post('/api/admin/fiscal/sales')).send({
    description: `QA DRE ${runId}`,
    amount: 100,
    dueDate: `${period}-05`,
    status: 'pending',
  })
  assert.equal(sale.status, 201)
  createdIds.push(sale.body.data.id)
  const expense = await auth(
    request(app).post('/api/admin/finance/transactions'),
  ).send({
    type: 'expense',
    category: 'QA contábil',
    description: `QA despesa ${runId}`,
    amount: 50,
    dueDate: `${period}-10`,
    status: 'pending',
  })
  assert.equal(expense.status, 201)
  createdIds.push(expense.body.data.id)
  const current = await dre()
  assert.equal(current.status, 200)
  const delta = (key: string) =>
    Math.round(
      (current.body.data.totals[key] - baseline.body.data.totals[key]) * 100,
    )
  assert.equal(delta('sales'), 10000)
  assert.equal(delta('taxes'), 600)
  assert.equal(delta('expenses'), 5000)
  assert.equal(delta('result'), 4400)
  const fiscalAfter = await auth(
    request(app).get(`/api/admin/fiscal/report?period=${period}`),
  )
  assert.equal(
    Math.round(
      (fiscalAfter.body.data.totals.tax - fiscalBefore.body.data.totals.tax) *
        100,
    ),
    600,
  )
  assert.equal(
    (
      await auth(
        request(app).patch(
          `/api/admin/finance/transactions/${sale.body.data.id}/status`,
        ),
      ).send({ status: 'paid' })
    ).status,
    200,
  )
  assert.equal(
    (await dre()).body.data.totals.result,
    current.body.data.totals.result,
  )
  assert.equal(
    (
      await auth(
        request(app).patch(
          `/api/admin/finance/transactions/${expense.body.data.id}`,
        ),
      ).send({ amount: 150 })
    ).status,
    200,
  )
  const updated = await dre()
  assert.equal(
    Math.round(
      (updated.body.data.totals.result - baseline.body.data.totals.result) *
        100,
    ),
    -5600,
  )
  console.log(
    'PostgreSQL real + rotas Financeiro/Fiscal/Contábil: venda 100, imposto 6, despesa 50, resultado 44; edição e status validados.',
  )
} finally {
  for (const id of createdIds) {
    assert.equal(
      await repository.delete(id, null),
      true,
      `Limpeza do registro ${id}`,
    )
  }
  if (createdIds.length) {
    const remaining = await repository.list(null)
    assert.equal(
      remaining.some((item) => createdIds.includes(item.id)),
      false,
    )
    console.log(
      'Registros temporários removidos; dados anteriores preservados.',
    )
  }
}
