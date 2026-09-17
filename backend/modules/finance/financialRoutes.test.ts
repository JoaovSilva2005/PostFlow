// @vitest-environment node
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../test/InMemoryAuthProvider'
import { InMemoryFinancialRepository } from '../../test/InMemoryFinancialRepository'
import { AuthService } from '../auth/authService'

function testApp(repository = new InMemoryFinancialRepository()) {
  return createApp({
    authService: new AuthService(new InMemoryAuthProvider()),
    financialRepository: repository,
  })
}

function authenticate<T extends request.Test>(test: T) {
  return test.set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
}

describe('API financeira', () => {
  it('informa o modo de armazenamento no health check', async () => {
    const response = await request(testApp()).get('/api/health')

    expect(response.body.data).toEqual({
      status: 'ok',
      service: 'PostFlow API',
      storage: 'test',
    })
  })

  it('cria, lista, atualiza e exclui um lançamento', async () => {
    const repository = new InMemoryFinancialRepository()
    const app = testApp(repository)

    const created = await authenticate(
      request(app).post('/api/finance/transactions'),
    ).send({
      type: 'income',
      category: 'Assinaturas',
      description: 'Plano mensal',
      amount: 99.9,
      dueDate: '2026-09-15',
      status: 'pending',
    })

    expect(created.status).toBe(201)
    expect(created.body.data.description).toBe('Plano mensal')
    const transactionId = created.body.data.id as string

    const listed = await authenticate(
      request(app).get('/api/finance/transactions'),
    )
    expect(listed.body.data).toHaveLength(1)

    const paid = await authenticate(
      request(app).patch(`/api/finance/transactions/${transactionId}/status`),
    ).send({ status: 'paid' })
    expect(paid.body.data.status).toBe('paid')
    expect(paid.body.data.paidAt).toBeTruthy()

    const removed = await authenticate(
      request(app).delete(`/api/finance/transactions/${transactionId}`),
    )
    expect(removed.status).toBe(204)
    expect(repository.transactions).toHaveLength(0)
  })

  it('rejeita valor negativo', async () => {
    const response = await authenticate(
      request(testApp()).post('/api/finance/transactions'),
    ).send({
      type: 'expense',
      category: 'Marketing',
      description: 'Anúncio',
      amount: -10,
      dueDate: '2026-09-15',
      status: 'pending',
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('maior que zero')
  })

  it('rejeita valores com mais de duas casas decimais', async () => {
    const response = await authenticate(
      request(testApp()).post('/api/finance/transactions'),
    ).send({
      type: 'income',
      category: 'Assinaturas',
      description: 'Plano mensal',
      amount: 10.123,
      dueDate: '2026-09-15',
      status: 'pending',
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('duas casas decimais')
  })
})
