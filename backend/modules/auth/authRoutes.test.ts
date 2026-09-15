// @vitest-environment node
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../test/InMemoryAuthProvider.js'
import { InMemoryFinancialRepository } from '../../test/InMemoryFinancialRepository.js'
import { AuthService } from './authService.js'

function testApp(provider = new InMemoryAuthProvider()) {
  return {
    app: createApp({
      authService: new AuthService(provider),
      financialRepository: new InMemoryFinancialRepository(),
    }),
    provider,
  }
}

describe('autenticação', () => {
  it('aceita o frontend local e rejeita origens desconhecidas', async () => {
    const { app } = testApp()
    const allowed = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
    const blocked = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://site-nao-autorizado.example')

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    )
    expect(blocked.status).toBe(403)
  })

  it('valida os dados antes de consultar o provedor', async () => {
    const { app } = testApp()
    const response = await request(app).post('/api/auth/login').send({
      email: 'email-invalido',
      password: '123',
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Digite um e-mail válido.')
  })

  it('não revela qual credencial está incorreta', async () => {
    const { app } = testApp()
    const response = await request(app).post('/api/auth/login').send({
      email: 'aluno@postflow.com',
      password: 'senha-incorreta',
    })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('E-mail ou senha inválidos.')
  })

  it('autentica e mantém os tokens somente em cookies HttpOnly', async () => {
    const { app } = testApp()
    const agent = request.agent(app)
    const login = await agent.post('/api/auth/login').send({
      email: 'aluno@postflow.com',
      password: '123456',
    })

    expect(login.status).toBe(200)
    expect(login.body.data.user).toMatchObject({
      email: 'aluno@postflow.com',
      role: 'editor',
    })
    expect(login.body.data).not.toHaveProperty('accessToken')
    const cookies = login.headers['set-cookie']
    const serializedCookies = Array.isArray(cookies)
      ? cookies.join(';')
      : cookies
    expect(serializedCookies).toContain('HttpOnly')

    const currentUser = await agent.get('/api/auth/me')
    expect(currentUser.status).toBe(200)
    expect(currentUser.body.data.user.displayName).toBe('Aluno PostFlow')
  })

  it('permite criar conta e solicitar recuperação de senha', async () => {
    const { app, provider } = testApp()
    const registered = await request(app).post('/api/auth/register').send({
      displayName: 'Maria Silva',
      email: 'maria@postflow.com',
      password: 'senha123',
    })
    const recovered = await request(app).post('/api/auth/recover').send({
      email: 'maria@postflow.com',
    })

    expect(registered.status).toBe(201)
    expect(registered.body.data.user.role).toBe('editor')
    expect(recovered.status).toBe(200)
    expect(provider.recoveredEmails).toContain('maria@postflow.com')
  })

  it('protege a API financeira e aceita Bearer token', async () => {
    const { app } = testApp()
    const anonymous = await request(app).get('/api/finance/summary')
    const authenticated = await request(app)
      .get('/api/finance/summary')
      .set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)

    expect(anonymous.status).toBe(401)
    expect(authenticated.status).toBe(200)
  })

  it('permite leitura e bloqueia escrita para o perfil viewer', async () => {
    const { app } = testApp(new InMemoryAuthProvider('viewer'))
    const read = await request(app)
      .get('/api/finance/summary')
      .set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
    const write = await request(app)
      .post('/api/finance/transactions')
      .set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
      .send({
        type: 'income',
        category: 'Assinaturas',
        description: 'Plano mensal',
        amount: 99.9,
        dueDate: '2026-09-15',
        status: 'pending',
      })

    expect(read.status).toBe(200)
    expect(write.status).toBe(403)
  })
})
