import request from 'supertest'
import { describe, expect, it } from 'vitest'
import vercelApp from '../api/index.js'

describe('entrada serverless da Vercel', () => {
  it('reutiliza as rotas da API Express', async () => {
    const response = await request(vercelApp).get('/api/index?path=health')

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      status: 'ok',
      service: 'PostFlow API',
    })
  })
})
