// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenAiContentProvider } from './openAiContentProvider.js'

const input = {
  prompt: 'Fale sobre café especial',
  platform: 'Instagram' as const,
  date: '2026-09-20',
  brand: {
    name: 'Aurora',
    segment: 'Cafeteria',
    toneOfVoice: 'Acolhedor',
    primaryColor: '#123456',
  },
  history: [],
  previousDraft: null,
}
const qualityInput = { ...input, imageTier: 'quality' as const }

const batchInput = {
  prompt: 'Fale sobre café especial',
  platforms: ['Instagram', 'LinkedIn'] as ('Instagram' | 'LinkedIn')[],
  dates: ['2099-12-30'],
  time: '09:45',
  timezone: 'America/Sao_Paulo',
  format: 'carousel' as const,
  persona: 'Pessoas que apreciam café',
  brand: input.brand,
  items: [
    { key: '0', platform: 'Instagram' as const, date: '2099-12-30' },
    { key: '1', platform: 'LinkedIn' as const, date: '2099-12-30' },
  ],
}

const carouselCopy = (key: string) => ({
  key,
  title: 'Café com intenção',
  caption: 'Descubra uma forma de apreciar café.',
  hashtags: ['#Cafe'],
  visualText: 'Uma pausa com presença',
  formatData: {
    kind: 'carousel',
    slides: [1, 2, 3].map((slide) => ({
      headline: `Slide ${slide}`,
      copy: 'Uma explicação curta.',
      visualDirection: 'Composição editorial simples.',
    })),
  },
})

const textResponse = () =>
  new Response(
    JSON.stringify({
      output_text: JSON.stringify({
        title: 'Café para começar bem',
        caption: 'Uma pausa com intenção.',
        hashtags: ['#Cafe'],
        visualText: 'Comece com presença',
      }),
    }),
  )

describe('OpenAiContentProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('gera texto e imagem no backend, converte b64_json para data URL e envia parâmetros configuráveis', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(textResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] })),
      )
    vi.stubGlobal('fetch', fetch)

    const provider = new OpenAiContentProvider(
      () => 'test-key',
      'text-model',
      'image-model',
      'high',
      '1536x1024',
    )
    const result = await provider.generate(input)

    expect(result.imageUrl).toBe('data:image/webp;base64,aW1hZ2U=')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1]?.[0]).toBe(
      'https://api.openai.com/v1/images/generations',
    )
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'text-model',
    })
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toMatchObject({
      model: 'image-model',
      size: '1536x1024',
      quality: 'high',
      output_format: 'webp',
      n: 1,
    })
  })

  it('usa GPT-6 Luna e Flare por padrão e permite escolher Sunburst no servidor', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(textResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] })),
      )
      .mockResolvedValueOnce(textResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] })),
      )
    vi.stubGlobal('fetch', fetch)
    const provider = new OpenAiContentProvider(() => 'test-key', 'gpt-6-luna')

    await provider.generate(input)
    await provider.generate(qualityInput)

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'gpt-6-luna',
    })
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toMatchObject({
      model: 'gpt-image-2.5-flare',
    })
    expect(JSON.parse(String(fetch.mock.calls[3]?.[1]?.body))).toMatchObject({
      model: 'gpt-image-2.5-sunburst',
    })
  })

  it('aceita URL HTTP(S) válida devolvida pelo provedor de imagens', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(textResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ url: 'https://cdn.example/image.webp' }] }),
        ),
      )
    vi.stubGlobal('fetch', fetch)

    const result = await new OpenAiContentProvider(
      () => 'test-key',
      'text-model',
    ).generate(input)

    expect(result.imageUrl).toBe('https://cdn.example/image.webp')
  })

  it('rejeita imageUrl inválida sem mascarar a falha como sucesso', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(textResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ url: 'javascript:alert(1)' }] }),
        ),
      )
    vi.stubGlobal('fetch', fetch)

    await expect(
      new OpenAiContentProvider(() => 'test-key', 'text-model').generate(input),
    ).rejects.toMatchObject({ statusCode: 502 })
  })

  it('rejeita resposta de texto fora do contrato e não chama imagens', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            title: 'Título válido',
            hashtags: [],
            visualText: 'Arte',
          }),
        }),
      ),
    )
    vi.stubGlobal('fetch', fetch)

    await expect(
      new OpenAiContentProvider(() => 'test-key', 'text-model').generate(input),
    ).rejects.toMatchObject({ statusCode: 502 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    { data: [] },
    { data: [{}] },
    { data: [{ b64_json: 'not-base64' }] },
  ])('rejeita resposta de imagem inválida: %j', async (imageResponse) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(textResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify(imageResponse)))
    vi.stubGlobal('fetch', fetch)

    await expect(
      new OpenAiContentProvider(() => 'test-key', 'text-model').generate(input),
    ).rejects.toMatchObject({ statusCode: 502 })
  })

  it('preserva erro HTTP de limite do provedor e não faz fallback', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('provider-error-body', { status: 429 }),
      )
    vi.stubGlobal('fetch', fetch)

    await expect(
      new OpenAiContentProvider(() => 'test-key', 'text-model').generate(input),
    ).rejects.toMatchObject({ statusCode: 429 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retorna erro explícito quando a etapa de imagem falha, sem fallback', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(textResponse())
      .mockResolvedValueOnce(
        new Response('provider-error-body', { status: 500 }),
      )
    vi.stubGlobal('fetch', fetch)

    await expect(
      new OpenAiContentProvider(() => 'test-key', 'text-model').generate(input),
    ).rejects.toMatchObject({ statusCode: 503 })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('propaga cancelamento ao fetch e retorna erro sanitizado', async () => {
    const fetch = vi.fn(
      (_url: string, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          )
        }),
    )
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const pending = new OpenAiContentProvider(
      () => 'test-key',
      'text-model',
    ).generate(input, controller.signal)

    controller.abort()

    await expect(pending).rejects.toMatchObject({ statusCode: 499 })
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })

  it('converte timeout do provedor em erro sanitizado', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(
      (_url: string, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          )
        }),
    )
    vi.stubGlobal('fetch', fetch)

    const pending = new OpenAiContentProvider(
      () => 'test-key',
      'text-model',
    ).generate(input)
    const result = expect(pending).rejects.toMatchObject({ statusCode: 504 })

    await vi.advanceTimersByTimeAsync(25_000)
    await result
  })

  it('gera todas as variações do lote em uma única chamada de texto e não chama imagens', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            items: [carouselCopy('0'), carouselCopy('1')],
          }),
        }),
      ),
    )
    vi.stubGlobal('fetch', fetch)

    const generated = await new OpenAiContentProvider(
      () => 'test-key',
      'text-model',
    ).generateBatch(batchInput)

    expect(generated).toHaveLength(2)
    expect(generated.map((item) => item.key)).toEqual(['0', '1'])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/responses')
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'text-model',
      store: false,
      max_output_tokens: 16_000,
      text: {
        format: {
          name: 'postflow_content_batch',
          strict: true,
        },
      },
    })
  })

  it('rejeita itens duplicados ou ausentes no retorno do lote', async () => {
    const duplicate = carouselCopy('0')
    const fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({ items: [duplicate, duplicate] }),
        }),
      ),
    )
    vi.stubGlobal('fetch', fetch)

    await expect(
      new OpenAiContentProvider(() => 'test-key', 'text-model').generateBatch(
        batchInput,
      ),
    ).rejects.toMatchObject({ statusCode: 502 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
