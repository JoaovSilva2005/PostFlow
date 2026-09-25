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
import { InMemoryContentQuotaService } from '../../test/InMemoryContentQuotaService.js'
import { HttpError } from '../../shared/HttpError.js'
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
  async generateImage(_input, visualText) {
    return `data:image/webp;base64,${Buffer.from(visualText).toString('base64')}`
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
  contentQuotaService = new InMemoryContentQuotaService(),
  contentProvider: ContentProvider = provider,
) {
  return createApp({
    authService: new AuthService(new InMemoryAuthProvider(role)),
    financialRepository: new InMemoryFinancialRepository(),
    contentService: new ContentService(contentProvider),
    contentQuotaService,
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

  it('aceita apenas o nível de imagem e usa padrão seguro no BFF', async () => {
    const generate = vi.spyOn(provider, 'generate')
    const app = setup()
    const standard = await authorize(
      request(app).post('/api/content/generate'),
    ).send(validRequest)
    const quality = await authorize(
      request(app).post('/api/content/generate'),
    ).send({ ...validRequest, imageTier: 'quality' })
    const arbitraryModel = await authorize(
      request(app).post('/api/content/generate'),
    ).send({ ...validRequest, imageModel: 'untrusted-model-id' })

    expect(standard.status).toBe(200)
    expect(quality.status).toBe(200)
    expect(arbitraryModel.status).toBe(400)
    expect(generate.mock.calls[0]?.[0].imageTier).toBe('standard')
    expect(generate.mock.calls[1]?.[0].imageTier).toBe('quality')
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('reserva texto e imagem antes de chamadas simultâneas ao provedor', async () => {
    const quota = new InMemoryContentQuotaService({ text: 10, image: 1 })
    const generate = vi.spyOn(provider, 'generate')
    const app = setup('editor', 'active', quota)

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        authorize(request(app).post('/api/content/generate')).send(
          validRequest,
        ),
      ),
    )

    expect(
      responses.filter((response) => response.status === 200),
    ).toHaveLength(1)
    expect(
      responses.filter((response) => response.status === 429),
    ).toHaveLength(4)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(quota.getUsage()).toMatchObject({
      text: 1,
      image: 1,
      textReserved: 0,
      imageReserved: 0,
    })
  })

  it('recusa franquia esgotada sem chamar o provedor', async () => {
    const quota = new InMemoryContentQuotaService({ text: 0, image: 10 })
    const generate = vi.spyOn(provider, 'generate')
    const response = await authorize(
      request(setup('editor', 'active', quota)).post('/api/content/generate'),
    ).send(validRequest)

    expect(response.status).toBe(429)
    expect(generate).not.toHaveBeenCalled()
    expect(quota.getUsage()).toMatchObject({ text: 0, image: 0 })
  })

  it('gera somente a imagem e consome apenas uma cota de imagem', async () => {
    const quota = new InMemoryContentQuotaService({ text: 0, image: 1 })
    const generateImage = vi.spyOn(provider, 'generateImage')
    const previousDraft = {
      id: 'draft-image-only',
      title: 'Uma ideia para a marca',
      caption: 'Uma legenda curta para a prévia.',
      hashtags: ['#PostFlow'],
      platform: 'Instagram',
      date: '2026-09-18',
      status: 'draft',
      visualText: 'Uma dica prática',
      color: '#4F46E5',
    }
    const response = await authorize(
      request(setup('editor', 'active', quota)).post(
        '/api/content/generate-image',
      ),
    ).send({ ...validRequest, previousDraft })

    expect(response.status).toBe(200)
    expect(response.body.data).toContain('data:image/webp;base64,')
    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ previousDraft }),
      'Uma dica prática',
      expect.any(AbortSignal),
    )
    expect(quota.getUsage()).toMatchObject({
      text: 0,
      image: 1,
      textReserved: 0,
      imageReserved: 0,
    })
  })

  it('libera a reserva após falha do provedor e permite uma nova tentativa', async () => {
    const quota = new InMemoryContentQuotaService({ text: 1, image: 1 })
    const generate = vi
      .spyOn(provider, 'generate')
      .mockRejectedValueOnce(new HttpError(502, 'Provedor indisponível.'))
    const app = setup('editor', 'active', quota)

    const failed = await authorize(
      request(app).post('/api/content/generate'),
    ).send(validRequest)
    expect(failed.status).toBe(502)
    expect(quota.getUsage()).toMatchObject({
      text: 0,
      image: 0,
      textReserved: 0,
      imageReserved: 0,
    })

    const retried = await authorize(
      request(app).post('/api/content/generate'),
    ).send(validRequest)
    expect(retried.status).toBe(200)
    expect(generate).toHaveBeenCalledTimes(2)
    expect(quota.getUsage()).toMatchObject({ text: 1, image: 1 })
  })

  it('bloqueia o uso do produto quando o workspace não possui plano', async () => {
    const response = await authorize(
      request(setup('editor', 'none')).post('/api/content/generate'),
    ).send(validRequest)

    expect(response.status).toBe(402)
    expect(response.body.error).toMatch(/plano ativo/i)
  })

  it('autoriza o lote e devolve uma variação distinta por rede e data', async () => {
    const quota = new InMemoryContentQuotaService({ text: 10, image: 0 })
    const generateBatch = vi.spyOn(provider, 'generateBatch')
    const generated = await authorize(
      request(setup('editor', 'active', quota)).post(
        '/api/content/generate-batch',
      ),
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
    expect(quota.getUsage()).toMatchObject({
      text: 2,
      image: 0,
      textReserved: 0,
      imageReserved: 0,
    })
  })

  it('aceita o maior lote previsto: 7 datas por 6 plataformas', async () => {
    const dates = Array.from(
      { length: 7 },
      (_, index) => `2099-12-${String(index + 1).padStart(2, '0')}`,
    )
    const response = await authorize(
      request(setup()).post('/api/content/generate-batch'),
    ).send({
      ...validBatchRequest,
      dates,
      platforms: [
        'Instagram',
        'Facebook',
        'X / Twitter',
        'LinkedIn',
        'TikTok',
        'Blog',
      ],
    })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(42)
  })

  it('responde 413 para JSON maior que o teto do BFF', async () => {
    const oversizedPrompt = 'x'.repeat(8 * 1024 * 1024 + 1)
    const response = await authorize(
      request(setup()).post('/api/content/generate'),
    ).send({ ...validRequest, prompt: oversizedPrompt })

    expect(response.status).toBe(413)
    expect(response.body.error).toContain('8 MiB')
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
