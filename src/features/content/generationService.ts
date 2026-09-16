import { z } from 'zod'
import type { BrandProfile, PostDraft } from '../../domain/models'
import { ApiError, apiRequest } from '../../services/apiClient'
import { localDate } from '../../domain/dates'
export { localDate } from '../../domain/dates'

export const PLATFORMS = ['Instagram', 'LinkedIn', 'Facebook'] as const
export type Platform = (typeof PLATFORMS)[number]
export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}
export interface ContentRequest {
  prompt: string
  platform: Platform
  date: string
  brand: BrandProfile | null
  history: Pick<ConversationMessage, 'role' | 'content'>[]
  previousDraft: PostDraft | null
}
export interface GenerationService {
  mode: 'demo' | 'api'
  generate(request: ContentRequest, signal: AbortSignal): Promise<PostDraft>
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00`)
    return !Number.isNaN(parsed.getTime()) && localDate(parsed) === value
  })

// This is the persisted editorial content contract, not a provider-specific response.
export const draftSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(3).max(160),
  caption: z.string().trim().min(1).max(5000),
  hashtags: z.array(z.string().regex(/^#[^\s#]+$/)).max(30),
  platform: z.enum(PLATFORMS),
  date: dateSchema,
  status: z.literal('draft'),
  visualText: z.string().trim().min(1).max(160),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

export function generationError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Sua sessão expirou. Entre novamente para gerar conteúdo.'
    if (error.status === 429)
      return 'Limite de geração atingido. Aguarde um pouco e tente novamente.'
    if (error.status === 404 || error.status === 503)
      return 'O serviço de geração não está disponível. Verifique a configuração da API.'
  }
  return typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'TimeoutError'
    ? 'A geração demorou demais. Seu rascunho foi preservado; tente novamente.'
    : 'Não foi possível gerar o conteúdo. Seus ajustes foram preservados. Tente novamente.'
}

function abortableDelay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Geração cancelada', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, 650)
    signal.addEventListener('abort', abort, { once: true })
  })
}

export const demoGenerationService: GenerationService = {
  mode: 'demo',
  async generate(request, signal) {
    await abortableDelay(signal)
    const { brand, previousDraft, prompt, platform, date } = request
    const subject = prompt.trim()
    const name = brand?.name || 'Sua marca'
    const title = previousDraft?.title || subject.slice(0, 100).padEnd(3, '.')
    const introduction =
      platform === 'LinkedIn'
        ? `${name}: ideias e novidades para compartilhar com nossa comunidade.`
        : `Tem novidade na ${name}!`
    // Deliberately a template, never presented as real AI reasoning.
    const caption = previousDraft
      ? `${previousDraft.caption.slice(0, 3500)}\n\nNova direção: ${subject.slice(0, 1000)}`
      : `${introduction}\n\n${subject}\n\n${brand?.segment ? `Conheça nosso trabalho em ${brand.segment.toLowerCase()}. ` : ''}Conte para a gente o que você achou.`
    return draftSchema.parse({
      id: previousDraft?.id || crypto.randomUUID(),
      title,
      caption,
      hashtags: previousDraft?.hashtags || [
        '#Novidades',
        `#${name.replace(/[^\p{L}\p{N}]/gu, '') || 'SuaMarca'}`,
      ],
      platform,
      date,
      status: 'draft',
      visualText: previousDraft?.visualText || subject.slice(0, 65),
      color: brand?.primaryColor || '#4F46E5',
    })
  },
}

export const apiGenerationService: GenerationService = {
  mode: 'api',
  async generate(request, signal) {
    const result = await apiRequest<unknown>('/content/generate', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    })
    return draftSchema.parse(result)
  },
}

export const generationService =
  import.meta.env.VITE_AI_MODE === 'api'
    ? apiGenerationService
    : demoGenerationService
