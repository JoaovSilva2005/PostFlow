// @vitest-environment node
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../test/InMemoryAuthProvider.js'
import { InMemoryFinancialRepository } from '../../test/InMemoryFinancialRepository.js'
import { AuthService } from './authService.js'
import { InMemoryWorkspaceAccessRepository } from '../tenancy/workspaceRepository.js'
import type { WorkspaceAccessRepository } from '../tenancy/workspaceTypes.js'
import { createOriginPolicy } from '../../config/environment.js'

function testApp(
  provider = new InMemoryAuthProvider(),
  workspaceRole: 'owner' | 'admin' | 'editor' | 'viewer' = 'editor',
  workspaceAccessRepository: WorkspaceAccessRepository = new InMemoryWorkspaceAccessRepository(
    'test-workspace',
    workspaceRole,
  ),
) {
  return {
    app: createApp({
      authService: new AuthService(provider),
      financialRepository: new InMemoryFinancialRepository(),
      workspaceAccessRepository,
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
    const allowedPreview = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://post-flow-git-main-dranoxs-projects.vercel.app')
    const blocked = await request(app)
      .options('/api/auth/login')
      .set(
        'Origin',
        'https://post-flow-git-feature-dranoxs-projects.vercel.app',
      )

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    )
    expect(allowedPreview.status).toBe(403)
    expect(blocked.status).toBe(403)
  })

  it('permite em produção apenas origens explicitamente confiáveis', () => {
    const productionPolicy = createOriginPolicy({
      isProduction: true,
      appUrl: 'https://post-flow.example.com',
      allowedOrigins: [
        'https://admin.example.com',
        'http://legacy.example.com',
      ],
    })

    expect(productionPolicy('https://post-flow.example.com')).toBe(true)
    expect(productionPolicy('https://admin.example.com')).toBe(true)
    expect(productionPolicy('http://legacy.example.com')).toBe(false)
    expect(
      productionPolicy(
        'https://post-flow-git-feature-dranoxs-projects.vercel.app',
      ),
    ).toBe(false)
    expect(productionPolicy('http://localhost:5173')).toBe(false)
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
    })
    expect(login.body.data.user).not.toHaveProperty('role')
    expect(login.body.data).not.toHaveProperty('accessToken')
    const cookies = login.headers['set-cookie']
    const serializedCookies = Array.isArray(cookies)
      ? cookies.join(';')
      : cookies
    expect(serializedCookies).toContain('HttpOnly')

    const currentUser = await agent.get('/api/auth/me')
    expect(currentUser.status).toBe(200)
    expect(currentUser.body.data.user.displayName).toBe('Aluno PostFlow')
    expect(currentUser.body.data.billingStatus).toBe('active')
  })

  it('revoga a sessão no provedor e limpa os cookies no logout', async () => {
    const { app, provider } = testApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({
      email: 'aluno@postflow.com',
      password: '123456',
    })

    const response = await agent.post('/api/auth/logout')
    const cookies = response.headers['set-cookie']
    const serializedCookies = Array.isArray(cookies)
      ? cookies.join(';')
      : cookies

    expect(response.status).toBe(204)
    expect(provider.loggedOutSessions).toEqual([
      { accessToken: 'test-access-token', refreshToken: 'test-refresh-token' },
    ])
    expect(serializedCookies).toContain('postflow_access_token=;')
    expect(serializedCookies).toContain('postflow_refresh_token=;')
    expect(serializedCookies).toContain('Expires=Thu, 01 Jan 1970')
  })

  it('limpa os cookies mesmo quando a revogação remota falha', async () => {
    const provider = new InMemoryAuthProvider()
    vi.spyOn(provider, 'logout').mockRejectedValue(
      new Error('detalhe interno do provedor'),
    )
    const { app } = testApp(provider)
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({
      email: 'aluno@postflow.com',
      password: '123456',
    })

    const response = await agent.post('/api/auth/logout')
    const cookies = response.headers['set-cookie']
    const serializedCookies = Array.isArray(cookies)
      ? cookies.join(';')
      : cookies

    expect(response.status).toBe(503)
    expect(response.body.error).not.toContain('detalhe interno')
    expect(serializedCookies).toContain('postflow_access_token=;')
    expect(serializedCookies).toContain('postflow_refresh_token=;')
  })

  it('permite criar conta e solicitar recuperação de senha', async () => {
    const { app, provider } = testApp()
    const registered = await request(app).post('/api/auth/register').send({
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Serviços profissionais',
      email: 'maria@postflow.com',
      password: 'senha123',
      confirmPassword: 'senha123',
    })
    const recovered = await request(app).post('/api/auth/recover').send({
      email: 'maria@postflow.com',
    })

    expect(registered.status).toBe(201)
    expect(registered.body.data.user).toMatchObject({
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Serviços profissionais',
    })
    expect(registered.body.data.user).not.toHaveProperty('role')
    expect(recovered.status).toBe(200)
    expect(provider.recoveredEmails).toContain('maria@postflow.com')
  })

  it('rejeita cadastro com confirmação diferente ou senha fraca', async () => {
    const { app } = testApp()
    const mismatch = await request(app).post('/api/auth/register').send({
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Tecnologia',
      email: 'maria@postflow.com',
      password: 'senha123',
      confirmPassword: 'outra123',
    })
    const weak = await request(app).post('/api/auth/register').send({
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Tecnologia',
      email: 'maria@postflow.com',
      password: 'abcdefgh',
      confirmPassword: 'abcdefgh',
    })

    expect(mismatch.status).toBe(400)
    expect(mismatch.body.error).toBe('As senhas não coincidem.')
    expect(weak.status).toBe(400)
    expect(weak.body.error).toBe('Inclua pelo menos um número na senha.')
  })

  it('explica quando o limite de e-mails do provedor bloqueia o cadastro', async () => {
    const provider = new InMemoryAuthProvider()
    vi.spyOn(provider, 'register').mockRejectedValue({
      code: 'over_email_send_rate_limit',
      message: 'email rate limit exceeded',
      status: 429,
    })
    const { app } = testApp(provider)

    const response = await request(app).post('/api/auth/register').send({
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Tecnologia',
      email: 'maria@postflow.com',
      password: 'senha123',
      confirmPassword: 'senha123',
    })

    expect(response.status).toBe(429)
    expect(response.body.error).toBe(
      'O limite temporário de e-mails de confirmação foi atingido. Aguarde e tente novamente mais tarde.',
    )
  })

  it('provisiona um workspace para uma conta autenticada sem membership', async () => {
    const repository = new InMemoryWorkspaceAccessRepository(
      null,
      'owner',
      null,
      'none',
    )
    const { app } = testApp(new InMemoryAuthProvider(), 'owner', repository)
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({
      email: 'aluno@postflow.com',
      password: '123456',
    })

    const before = await agent.get('/api/auth/me')
    const provisioned = await agent.post('/api/auth/workspace')
    const after = await agent.get('/api/auth/me')

    expect(before.body.data.workspace).toBeNull()
    expect(provisioned.status).toBe(200)
    expect(provisioned.body.data.workspace).toEqual({
      id: 'workspace-00000000-0000-0000-0000-000000000001',
      role: 'owner',
    })
    expect(provisioned.body.data.billingStatus).toBe('none')
    expect(after.body.data.workspace).toEqual(provisioned.body.data.workspace)
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
    const { app } = testApp(new InMemoryAuthProvider('viewer'), 'viewer')
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
