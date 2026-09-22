// @vitest-environment node
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../test/InMemoryAuthProvider.js'
import { InMemoryFinancialRepository } from '../../test/InMemoryFinancialRepository.js'
import { AuthService } from '../auth/authService.js'
import { InMemoryWorkspaceAccessRepository } from '../tenancy/workspaceRepository.js'
import { ContentService } from './contentService.js'
import type { ContentProvider } from './contentTypes.js'

const provider: ContentProvider = {
  async generate() {
    return {
      title: 'Lançamento PostFlow',
      caption: 'Uma legenda gerada com segurança.',
      hashtags: ['#PostFlow'],
      visualText: 'Planeje melhor',
      imageUrl: 'data:image/webp;base64,aW1hZ2U=',
    }
  },
}

function setup(
  role: 'editor' | 'viewer' = 'editor',
  billingStatus: 'active' | 'none' = 'active',
) {
  return createApp({
    authService: new AuthService(new InMemoryAuthProvider(role)),
    financialRepository: new InMemoryFinancialRepository(),
    contentService: new ContentService(provider),
    workspaceAccessRepository: new InMemoryWorkspaceAccessRepository(
      'test-workspace',
      role,
      null,
      billingStatus,
    ),
  })
}

const validRequest = {
  prompt: 'Crie um post sobre organização de conteúdo',
  platform: 'Instagram',
  date: '2026-09-18',
  brand: {
    name: 'PostFlow',
    segment: 'Marketing',
    toneOfVoice: 'Profissional',
    primaryColor: '#4F46E5',
  },
  history: [],
  previousDraft: null,
}

const authorize = (test: request.Test) =>
  test.set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)

describe('geração de conteúdo', () => {
  it('exige autenticação e permissão de edição', async () => {
    const anonymous = await request(setup())
      .post('/api/content/generate')
      .send(validRequest)
    const viewer = await authorize(
      request(setup('viewer')).post('/api/content/generate'),
    ).send(validRequest)

    expect(anonymous.status).toBe(401)
    expect(viewer.status).toBe(403)
  })

  it('valida a entrada e retorna o contrato persistível', async () => {
    const invalid = await authorize(
      request(setup()).post('/api/content/generate'),
    ).send({ ...validRequest, prompt: 'x' })
    const generated = await authorize(
      request(setup()).post('/api/content/generate'),
    ).send(validRequest)

    expect(invalid.status).toBe(400)
    expect(generated.status).toBe(200)
    expect(generated.body.data).toMatchObject({
      title: 'Lançamento PostFlow',
      platform: 'Instagram',
      date: '2026-09-18',
      status: 'draft',
      color: '#4F46E5',
      imageUrl: 'data:image/webp;base64,aW1hZ2U=',
    })
  })

  it('bloqueia o uso do produto quando o workspace não possui plano', async () => {
    const response = await authorize(
      request(setup('editor', 'none')).post('/api/content/generate'),
    ).send(validRequest)

    expect(response.status).toBe(402)
    expect(response.body.error).toMatch(/plano ativo/i)
  })
})
