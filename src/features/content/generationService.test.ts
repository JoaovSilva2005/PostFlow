import {
  apiGenerationService,
  demoGenerationService,
  type ContentRequest,
} from './generationService'
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

describe('Contrato de geração', () => {
  afterEach(() => vi.unstubAllGlobals())
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
        body: JSON.stringify(input),
      }),
    )
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
})
