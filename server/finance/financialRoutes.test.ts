// @vitest-environment node
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app'
import { InMemoryFinancialRepository } from '../test/InMemoryFinancialRepository'

describe('API financeira', () => {
  it('cria, lista, atualiza e exclui um lançamento', async () => {
    const repository = new InMemoryFinancialRepository()
    const app = createApp(repository)

    const created = await request(app).post('/api/finance/transactions').send({
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

    const listed = await request(app).get('/api/finance/transactions')
    expect(listed.body.data).toHaveLength(1)

    const paid = await request(app)
      .patch(`/api/finance/transactions/${transactionId}/status`)
      .send({ status: 'paid' })
    expect(paid.body.data.status).toBe('paid')
    expect(paid.body.data.paidAt).toBeTruthy()

    const removed = await request(app).delete(
      `/api/finance/transactions/${transactionId}`,
    )
    expect(removed.status).toBe(204)
    expect(repository.transactions).toHaveLength(0)
  })

  it('rejeita valor negativo', async () => {
    const response = await request(
      createApp(new InMemoryFinancialRepository()),
    )
      .post('/api/finance/transactions')
      .send({
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
})
