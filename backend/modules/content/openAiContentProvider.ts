import { z } from 'zod'
import { HttpError } from '../../shared/HttpError.js'
import type { ContentGenerationInput, ContentProvider } from './contentTypes.js'

const providerOutputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  caption: z.string().trim().min(1).max(5000),
  hashtags: z.array(z.string().regex(/^#[^\s#]+$/)).max(30),
  visualText: z.string().trim().min(1).max(160),
})

type OpenAiResponse = {
  output_text?: string
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>
}

function extractText(response: OpenAiResponse) {
  if (response.output_text) return response.output_text
  return response.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === 'output_text')?.text
}

export class OpenAiContentProvider implements ContentProvider {
  private readonly readApiKey: () => string
  private readonly model: string

  constructor(readApiKey: () => string, model: string) {
    this.readApiKey = readApiKey
    this.model = model
  }

  async generate(input: ContentGenerationInput) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25_000)

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.readApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
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

      if (!response.ok) {
        const status = response.status === 429 ? 429 : 503
        throw new HttpError(
          status,
          'O provedor de IA não está disponível agora.',
        )
      }

      const text = extractText((await response.json()) as OpenAiResponse)
      if (!text)
        throw new HttpError(502, 'O provedor retornou uma resposta vazia.')
      return providerOutputSchema.parse(JSON.parse(text))
    } catch (error) {
      if (error instanceof HttpError) throw error
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        throw new HttpError(
          502,
          'O provedor retornou conteúdo fora do contrato.',
        )
      }
      throw new HttpError(503, 'Não foi possível acessar o provedor de IA.')
    } finally {
      clearTimeout(timeout)
    }
  }
}
