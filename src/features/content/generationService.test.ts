import {
  apiGenerationService,
  demoGenerationService,
  generationError,
  type BatchContentRequest,
  type ContentRequest,
} from './generationService'
import { ApiError } from '../../services/apiClient'
import { vi } from 'vitest'

const input: ContentRequest = {
  prompt: 'Apresente nosso serviço',
  platform: 'LinkedIn',
  date: '2026-09-18',
  brand: {
    name: 'Aurora',
    segment: 'Design',
    toneOfVoice: 'Profissional',
    primaryColor: '#123456',
  },
  history: [],
  previousDraft: null,
}

const batchInput: BatchContentRequest = {
  workspaceId: 'workspace-test',
  prompt: 'Apresente nosso serviço',
  dates: ['2099-12-30', '2099-12-31'],
  time: '09:45',
  timezone: 'America/Sao_Paulo',
  format: 'carousel',
  persona: 'Pessoas que estão começando',
  platforms: ['Instagram', 'LinkedIn'],
  brand: input.brand,
}

describe('Contrato de geração', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('explica quando a geração exige um plano ativo', () => {
    expect(
      generationError(
        new ApiError('Um plano ativo é necessário para utilizar esta funcionalidade.', 402),
      ),
    ).toBe(
      'Um plano ativo é necessário para gerar conteúdo. Acesse Assinatura e cobrança.',
    )
  })

  it('usa marca, data e rede na demonstração', async () => {
    const draft = await demoGenerationService.generate(
      input,
      new AbortController().signal,
    )
    expect(draft).toMatchObject({
      date: input.date,
      platform: 'LinkedIn',
      color: '#123456',
    })
    expect(draft.caption).toContain('Aurora')
  })
  it('envia histórico e rascunho para API com sessão e sinal de cancelamento', async () => {
    const draft = await demoGenerationService.generate(
      input,
      new AbortController().signal,
    )
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: draft })))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect(await apiGenerationService.generate(input, signal)).toEqual(draft)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/content/generate'),
      expect.objectContaining({
        credentials: 'include',
        signal,
        body: JSON.stringify({ ...input, imageTier: 'standard' }),
      }),
    )
  })
  it('envia ao BFF a preferência de imagem sem escolher o identificador do modelo', async () => {
    const draft = await demoGenerationService.generate(
      input,
      new AbortController().signal,
    )
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: draft })))
    vi.stubGlobal('fetch', fetch)

    await apiGenerationService.generate(
      { ...input, imageTier: 'quality' },
      new AbortController().signal,
    )

    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))
    expect(body.imageTier).toBe('quality')
    expect(body.imageModel).toBeUndefined()
  })
  it('não aceita resposta malformada nem substitui falha por demo', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: { title: 'Quebrado' } })),
        ),
    )
    await expect(
      apiGenerationService.generate(input, new AbortController().signal),
    ).rejects.toThrow()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'Limite' }), { status: 429 }),
        ),
    )
    await expect(
      apiGenerationService.generate(input, new AbortController().signal),
    ).rejects.toMatchObject({ status: 429 })
  })

  it('gera uma variação por data e rede na demonstração, preservando os metadados', async () => {
    const drafts = await demoGenerationService.generateBatch!(
      batchInput,
      new AbortController().signal,
    )

    expect(drafts).toHaveLength(4)
    expect(
      new Set(drafts.map((draft) => `${draft.date}|${draft.platform}`)).size,
    ).toBe(4)
    expect(drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2099-12-30',
          platform: 'Instagram',
          time: '09:45',
          timezone: 'America/Sao_Paulo',
          format: 'carousel',
          persona: 'Pessoas que estão começando',
          formatData: expect.objectContaining({ kind: 'carousel' }),
        }),
        expect.objectContaining({ date: '2099-12-31', platform: 'LinkedIn' }),
      ]),
    )
  })

  it('envia um lote ao BFF e rejeita uma matriz incompleta', async () => {
    const drafts = await demoGenerationService.generateBatch!(
      batchInput,
      new AbortController().signal,
    )
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: drafts })))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal

    await expect(
      apiGenerationService.generateBatch!(batchInput, signal),
    ).resolves.toEqual(drafts)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/content/generate-batch'),
      expect.objectContaining({
        credentials: 'include',
        signal,
        headers: expect.objectContaining({
          'X-Workspace-Id': 'workspace-test',
        }),
        body: JSON.stringify({
          prompt: batchInput.prompt,
          dates: batchInput.dates,
          time: batchInput.time,
          timezone: batchInput.timezone,
          format: batchInput.format,
          persona: batchInput.persona,
          platforms: batchInput.platforms,
          brand: batchInput.brand,
        }),
      }),
    )

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: drafts.slice(1) })),
        ),
    )
    await expect(
      apiGenerationService.generateBatch!(batchInput, signal),
    ).rejects.toThrow('A geração não retornou todas as variações pedidas.')
  })
})
