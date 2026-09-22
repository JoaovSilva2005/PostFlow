import { z } from 'zod'
import { HttpError } from '../../shared/HttpError.js'
import type { ContentGenerationInput, ContentProvider } from './contentTypes.js'

const TEXT_TIMEOUT_MS = 25_000
const IMAGE_TIMEOUT_MS = 45_000
const DEFAULT_IMAGE_MODEL = 'gpt-image-1-mini'
const DEFAULT_IMAGE_QUALITY = 'medium'
const DEFAULT_IMAGE_SIZE = '1024x1024'
const IMAGE_OUTPUT_FORMAT = 'webp'

const providerOutputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  caption: z.string().trim().min(1).max(5000),
  hashtags: z.array(z.string().regex(/^#[^\s#]+$/)).max(30),
  visualText: z.string().trim().min(1).max(160),
})

const openAiResponseSchema = z.object({
  output_text: z.string().optional(),
  output: z
    .array(
      z.object({
        content: z
          .array(
            z.object({
              type: z.string().optional(),
              text: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

const openAiImageResponseSchema = z.object({
  data: z.array(
    z.object({
      b64_json: z.string().optional(),
      url: z.string().optional(),
    }),
  ),
})

type OpenAiResponse = z.infer<typeof openAiResponseSchema>

type RequestSignal = {
  signal: AbortSignal
  didTimeout: () => boolean
  cleanup: () => void
}

function createRequestSignal(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
): RequestSignal {
  const controller = new AbortController()
  let timedOut = false

  const abortFromParent = () => controller.abort()
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort()
    else parentSignal.addEventListener('abort', abortFromParent, { once: true })
  }

  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout)
      parentSignal?.removeEventListener('abort', abortFromParent)
    },
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function throwIfCancelled(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new HttpError(499, 'A solicitação foi cancelada.')
  }
}

function providerHttpError(target: 'texto' | 'imagem', status: number) {
  if (status === 429) {
    return new HttpError(
      429,
      `O provedor de ${target} limitou a solicitação. Tente novamente mais tarde.`,
    )
  }

  if (status >= 400 && status < 500) {
    return new HttpError(
      502,
      `O provedor de ${target} recusou a solicitação.`,
    )
  }

  return new HttpError(
    503,
    `O provedor de ${target} não está disponível agora.`,
  )
}

function extractText(response: OpenAiResponse) {
  if (response.output_text?.trim()) return response.output_text
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === 'output_text' && item.text?.trim())?.text
}

function isBase64(value: string) {
  return (
    value.length > 0 &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname)
    )
  } catch {
    return false
  }
}

export class OpenAiContentProvider implements ContentProvider {
  private readonly readApiKey: () => string
  private readonly textModel: string
  private readonly imageModel: string
  private readonly imageQuality: string
  private readonly imageSize: string

  constructor(
    readApiKey: () => string,
    textModel: string,
    imageModel = DEFAULT_IMAGE_MODEL,
    imageQuality = DEFAULT_IMAGE_QUALITY,
    imageSize = DEFAULT_IMAGE_SIZE,
  ) {
    this.readApiKey = readApiKey
    this.textModel = textModel
    this.imageModel = imageModel
    this.imageQuality = imageQuality
    this.imageSize = imageSize
  }

  async generate(input: ContentGenerationInput, signal?: AbortSignal) {
    const requestSignal = createRequestSignal(signal, TEXT_TIMEOUT_MS)

    try {
      throwIfCancelled(signal)
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: requestSignal.signal,
        headers: {
          Authorization: `Bearer ${this.readApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.textModel,
          store: false,
          max_output_tokens: 1_200,
          reasoning: { effort: 'low' },
          prompt_cache_key: 'postflow-content-v1',
          input: [
            {
              role: 'system',
              content:
                'Você é o redator do PostFlow. Gere conteúdo em português brasileiro, fiel à marca, sem inventar fatos, promoções ou resultados. Retorne somente o JSON solicitado.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                marca: input.brand,
                plataforma: input.platform,
                pedido: input.prompt,
                historicoRecente: input.history.slice(-6),
                rascunhoAnterior: input.previousDraft,
              }),
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'postflow_draft',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'caption', 'hashtags', 'visualText'],
                properties: {
                  title: { type: 'string', minLength: 3, maxLength: 160 },
                  caption: { type: 'string', minLength: 1, maxLength: 5000 },
                  hashtags: {
                    type: 'array',
                    maxItems: 30,
                    items: { type: 'string', pattern: '^#[^\\s#]+$' },
                  },
                  visualText: { type: 'string', minLength: 1, maxLength: 160 },
                },
              },
            },
          },
        }),
      })

      throwIfCancelled(signal)
      if (!response.ok) throw providerHttpError('texto', response.status)

      const responseBody = openAiResponseSchema.safeParse(await response.json())
      if (!responseBody.success) {
        throw new HttpError(502, 'O provedor retornou conteúdo fora do contrato.')
      }

      const text = extractText(responseBody.data)
      if (!text) {
        throw new HttpError(502, 'O provedor retornou uma resposta vazia.')
      }

      const draft = providerOutputSchema.parse(JSON.parse(text))
      const imageUrl = await this.generateImage(input, draft.visualText, signal)
      return { ...draft, imageUrl }
    } catch (error) {
      if (error instanceof HttpError) throw error
      if (signal?.aborted) {
        throw new HttpError(499, 'A solicitação foi cancelada.')
      }
      if (requestSignal.didTimeout() || isAbortError(error)) {
        throw new HttpError(504, 'O provedor de IA excedeu o tempo limite.')
      }
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        throw new HttpError(
          502,
          'O provedor retornou conteúdo fora do contrato.',
        )
      }
      throw new HttpError(503, 'Não foi possível acessar o provedor de IA.')
    } finally {
      requestSignal.cleanup()
    }
  }

  private async generateImage(
    input: ContentGenerationInput,
    visualText: string,
    parentSignal?: AbortSignal,
  ): Promise<string> {
    const requestSignal = createRequestSignal(parentSignal, IMAGE_TIMEOUT_MS)

    try {
      throwIfCancelled(parentSignal)
      const response = await fetch(
        'https://api.openai.com/v1/images/generations',
        {
          method: 'POST',
          signal: requestSignal.signal,
          headers: {
            Authorization: `Bearer ${this.readApiKey()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.imageModel,
            prompt: [
              'Crie uma imagem quadrada para um post de rede social.',
              'Não inclua texto, logotipos ou marcas d’água legíveis na imagem.',
              'Use uma direção visual editorial, limpa e coerente com a marca.',
              `Marca: ${input.brand?.name ?? 'marca independente'}.`,
              `Segmento: ${input.brand?.segment ?? 'não informado'}.`,
              `Tom: ${input.brand?.toneOfVoice ?? 'profissional e próximo'}.`,
              `Pedido do usuário: ${input.prompt}.`,
              `Ideia central da arte: ${visualText}.`,
            ].join('\n'),
            size: this.imageSize,
            quality: this.imageQuality,
            output_format: IMAGE_OUTPUT_FORMAT,
            n: 1,
          }),
        },
      )

      throwIfCancelled(parentSignal)
      if (!response.ok) throw providerHttpError('imagem', response.status)

      const responseBody = openAiImageResponseSchema.safeParse(
        await response.json(),
      )
      if (!responseBody.success || responseBody.data.data.length !== 1) {
        throw new HttpError(502, 'O provedor retornou uma imagem inválida.')
      }

      const image = responseBody.data.data[0]
      if (image.b64_json !== undefined) {
        if (!isBase64(image.b64_json)) {
          throw new HttpError(502, 'O provedor retornou uma imagem inválida.')
        }
        return `data:image/${IMAGE_OUTPUT_FORMAT};base64,${image.b64_json}`
      }

      if (image.url !== undefined) {
        if (!isHttpUrl(image.url)) {
          throw new HttpError(502, 'O provedor retornou uma imagem inválida.')
        }
        return image.url
      }

      throw new HttpError(502, 'O provedor não retornou uma imagem.')
    } catch (error) {
      if (error instanceof HttpError) throw error
      if (parentSignal?.aborted) {
        throw new HttpError(499, 'A solicitação foi cancelada.')
      }
      if (requestSignal.didTimeout() || isAbortError(error)) {
        throw new HttpError(
          504,
          'O provedor de imagens excedeu o tempo limite.',
        )
      }
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        throw new HttpError(502, 'O provedor retornou uma imagem inválida.')
      }
      throw new HttpError(
        503,
        'Não foi possível gerar a imagem do conteúdo.',
      )
    } finally {
      requestSignal.cleanup()
    }
  }
}
