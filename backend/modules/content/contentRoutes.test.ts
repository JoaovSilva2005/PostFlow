// @vitest-environment node
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../app.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../test/InMemoryAuthProvider.js'
import { InMemoryFinancialRepository } from '../../test/InMemoryFinancialRepository.js'
import { AuthService } from '../auth/authService.js'
import { InMemoryWorkspaceAccessRepository } from '../tenancy/workspaceRepository.js'
import { ContentService } from './contentService.js'
import type {
  ContentFormat,
  ContentFormatData,
} from '../../../shared/domain/contentFormats.js'
import type { ContentProvider } from './contentTypes.js'

function formatData(format: ContentFormat): ContentFormatData {
  if (format === 'carousel') {
    return {
      kind: 'carousel',
      slides: [1, 2, 3].map((number) => ({
        headline: `Ideia ${number}`,
        copy: 'Uma explicação curta.',
        visualDirection: 'Composição editorial simples.',
      })),
    }
  }
  if (format === 'reels') {
    return {
      kind: 'reels',
      hook: 'Veja uma ideia prática.',
      durationSeconds: 20,
      scenes: [1, 2, 3].map(() => ({
        shot: 'Apresentação direta para a câmera.',
        narration: 'Compartilhe uma dica prática.',
        onScreenText: 'Uma dica prática',
      })),
      closingCta: 'Conte o que você pensa.',
    }
  }
  return {
    kind: 'static',
    headline: 'Uma ideia prática',
    visualDirection: 'Composição editorial simples.',
  }
}

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
  async generateBatch(input) {
    return input.items.map((item) => ({
      key: item.key,
      title: 'Uma ideia prática para sua marca',
      caption: `Uma ideia para ${item.platform}.`,
      hashtags: ['#PostFlow'],
      visualText: 'Uma ideia prática',
      formatData: formatData(input.format),
    }))
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

const validBatchRequest = {
  prompt: 'Crie uma sequência sobre organização de conteúdo',
  dates: ['2099-12-30'],
  time: '09:45',
  timezone: 'America/Sao_Paulo',
  format: 'carousel',
  persona: 'Pessoas que estão começando',
  platforms: ['Instagram', 'LinkedIn'],
  brand: validRequest.brand,
}

const authorize = (test: request.Test) =>
  test.set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)

describe('geração de conteúdo', () => {
  afterEach(() => vi.restoreAllMocks())

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

  it('autoriza o lote e devolve uma variação distinta por rede e data', async () => {
    const generateBatch = vi.spyOn(provider, 'generateBatch')
    const generated = await authorize(
      request(setup()).post('/api/content/generate-batch'),
    ).send(validBatchRequest)

    expect(generated.status).toBe(200)
    expect(generateBatch).toHaveBeenCalledTimes(1)
    expect(generateBatch.mock.calls[0]?.[0].items).toEqual([
      { key: '0', date: '2099-12-30', platform: 'Instagram' },
      { key: '1', date: '2099-12-30', platform: 'LinkedIn' },
    ])
    expect(generated.body.data).toHaveLength(2)
    expect(generated.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2099-12-30',
          platform: 'Instagram',
          status: 'draft',
          format: 'carousel',
          formatData: expect.objectContaining({ kind: 'carousel' }),
          persona: 'Pessoas que estão começando',
          time: '09:45',
          timezone: 'America/Sao_Paulo',
        }),
        expect.objectContaining({
          date: '2099-12-30',
          platform: 'LinkedIn',
        }),
      ]),
    )
  })

  it('protege a rota em lote e rejeita limites, datas e horários inválidos', async () => {
    const anonymous = await request(setup())
      .post('/api/content/generate-batch')
      .send(validBatchRequest)
    const viewer = await authorize(
      request(setup('viewer')).post('/api/content/generate-batch'),
    ).send(validBatchRequest)
    const duplicatePlatforms = await authorize(
      request(setup()).post('/api/content/generate-batch'),
    ).send({ ...validBatchRequest, platforms: ['Instagram', 'Instagram'] })
    const invalidTime = await authorize(
      request(setup()).post('/api/content/generate-batch'),
    ).send({ ...validBatchRequest, time: '24:00' })
    const pastDate = await authorize(
      request(setup()).post('/api/content/generate-batch'),
    ).send({ ...validBatchRequest, dates: ['2000-01-01'] })
    const tooManyDates = await authorize(
      request(setup()).post('/api/content/generate-batch'),
    ).send({
      ...validBatchRequest,
      dates: Array.from(
        { length: 8 },
        (_, index) => `2099-12-${String(index + 1).padStart(2, '0')}`,
      ),
    })

    expect(anonymous.status).toBe(401)
    expect(viewer.status).toBe(403)
    expect(duplicatePlatforms.status).toBe(400)
    expect(invalidTime.status).toBe(400)
    expect(pastDate.status).toBe(400)
    expect(tooManyDates.status).toBe(400)
  })
})
