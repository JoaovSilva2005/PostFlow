import { z } from 'zod'
import type { BrandProfile, PostDraft } from '../../domain/models'
import { ApiError, apiRequest } from '../../services/apiClient'
import { localDate } from '../../domain/dates'
import {
  CONTENT_FORMATS,
  contentFormatDataSchema,
  contentFormatSchema,
  type ContentFormat,
  type ContentFormatData,
} from '../../../shared/domain/contentFormats'
import { isValidTimeZone } from '../../../shared/domain/contentTime'
import { SOCIAL_PLATFORMS } from '../../../shared/domain/socialPlatforms'
export { localDate } from '../../domain/dates'

export const PLATFORMS = SOCIAL_PLATFORMS
export type Platform = (typeof PLATFORMS)[number]
export type ImageGenerationTier = 'standard' | 'quality'
export { CONTENT_FORMATS, type ContentFormat, type ContentFormatData }
export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}
export interface ContentRequest {
  workspaceId?: string
  prompt: string
  platform: Platform
  date: string
  brand: BrandProfile | null
  history: Pick<ConversationMessage, 'role' | 'content'>[]
  previousDraft: PostDraft | null
  imageTier?: ImageGenerationTier
  format?: ContentFormat
  formatData?: ContentFormatData
  persona?: string
  time?: string
  timezone?: string
}
export interface BatchContentRequest {
  workspaceId?: string
  prompt: string
  dates: string[]
  time: string
  timezone: string
  format: ContentFormat
  persona: string
  platforms: Platform[]
  brand: BrandProfile | null
}
export interface GenerationService {
  mode: 'demo' | 'api'
  generate(request: ContentRequest, signal: AbortSignal): Promise<PostDraft>
  generateImage?(request: ContentRequest, signal: AbortSignal): Promise<string>
  generateBatch?(
    request: BatchContentRequest,
    signal: AbortSignal,
  ): Promise<PostDraft[]>
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
  format: contentFormatSchema.optional(),
  formatData: contentFormatDataSchema.optional(),
  persona: z.string().trim().max(160).optional(),
  time: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  timezone: z.string().refine(isValidTimeZone).optional(),
  imageUrl: z
    .string()
    .max(6_000_000)
    .refine(
      (value) =>
        /^https?:\/\//.test(value) ||
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
      'A imagem gerada possui um formato inválido.',
    )
    .optional(),
})

export function generationError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Sua sessão expirou. Entre novamente para gerar conteúdo.'
    if (error.status === 402)
      return 'Um plano ativo é necessário para gerar conteúdo. Acesse Assinatura e cobrança.'
    if (error.status === 429)
      return 'Limite de geração atingido. Aguarde um pouco e tente novamente.'
    if (error.status === 404 || error.status === 503)
      return 'O serviço de geração não está disponível. Verifique a configuração da API.'
  }
  return typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'TimeoutError'
    ? 'A geração demorou demais. Seus ajustes continuam no painel; tente novamente.'
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

function demoFormatData(
  format: ContentFormat,
  subject: string,
): ContentFormatData {
  const visualDirection = `Composição editorial sobre ${subject.slice(0, 90)}; siga a identidade da marca sem texto ilegível.`
  if (format === 'carousel') {
    return {
      kind: 'carousel',
      slides: [
        {
          headline: 'A ideia principal',
          copy: subject.slice(0, 180),
          visualDirection,
        },
        {
          headline: 'Um próximo passo',
          copy: 'Apresente uma ação prática e simples para o público.',
          visualDirection,
        },
        {
          headline: 'Continue a conversa',
          copy: 'Feche com uma pergunta relacionada ao tema.',
          visualDirection,
        },
      ],
    }
  }
  if (format === 'reels') {
    return {
      kind: 'reels',
      hook: subject.slice(0, 120),
      durationSeconds: 20,
      scenes: [
        {
          shot: 'Apresente a ideia diretamente para a câmera.',
          narration: subject.slice(0, 180),
          onScreenText: subject.slice(0, 80),
        },
        {
          shot: 'Mostre um exemplo relacionado ao tema.',
          narration: 'Use uma situação que a marca possa confirmar.',
          onScreenText: 'Um exemplo prático',
        },
        {
          shot: 'Encerre com um enquadramento estável.',
          narration: 'Convide o público a continuar a conversa.',
          onScreenText: 'O que você acha?',
        },
      ],
      closingCta: 'Compartilhe sua experiência nos comentários.',
    }
  }
  return { kind: 'static', headline: subject.slice(0, 90), visualDirection }
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
      imageUrl: previousDraft?.imageUrl,
    })
  },
  async generateBatch(request, signal) {
    await abortableDelay(signal)
    const subject = request.prompt.trim()
    const name = request.brand?.name || 'Sua marca'
    const platformAngles: Record<Platform, string> = {
      Instagram: 'Use uma abertura visual e convide a comunidade a participar.',
      Facebook: 'Contextualize a ideia e convide as pessoas a conversar.',
      'X / Twitter':
        'Seja direto e concentre a ideia principal em poucas frases.',
      LinkedIn: 'Traga uma perspectiva prática e profissional sobre o tema.',
      TikTok:
        'Abra com uma frase falada que prenda a atenção nos primeiros segundos.',
      Blog: 'Organize a ideia como uma introdução útil para um artigo.',
    }

    return request.dates.flatMap((date) =>
      request.platforms.map((platform) =>
        draftSchema.parse({
          id: crypto.randomUUID(),
          title: subject.slice(0, 95).padEnd(3, '.'),
          caption: `${name}: ${subject}\n\n${platformAngles[platform]}${request.persona ? `\n\nPúblico: ${request.persona}` : ''}`,
          hashtags: [`#${name.replace(/[^\p{L}\p{N}]/gu, '') || 'SuaMarca'}`],
          platform,
          date,
          status: 'draft',
          visualText: subject.slice(0, 120),
          color: request.brand?.primaryColor || '#4F46E5',
          format: request.format,
          formatData: demoFormatData(request.format, subject),
          persona: request.persona,
          time: request.time,
          timezone: request.timezone,
        }),
      ),
    )
  },
}

export const apiGenerationService: GenerationService = {
  mode: 'api',
  async generate(request, signal) {
    const {
      workspaceId,
      previousDraft,
      imageTier = 'standard',
      ...requestWithoutWorkspace
    } = request
    const contentRequest = {
      ...requestWithoutWorkspace,
      previousDraft: previousDraft
        ? (({ imageUrl: _imageUrl, ...draft }) => draft)(previousDraft)
        : null,
      imageTier,
    }
    const result = await apiRequest<unknown>('/content/generate', {
      method: 'POST',
      body: JSON.stringify(contentRequest),
      headers: workspaceId ? { 'X-Workspace-Id': workspaceId } : undefined,
      signal,
    })
    return draftSchema.parse(result)
  },
  async generateImage(request, signal) {
    const {
      workspaceId,
      previousDraft,
      imageTier = 'standard',
      ...requestWithoutWorkspace
    } = request
    const result = await apiRequest<unknown>('/content/generate-image', {
      method: 'POST',
      body: JSON.stringify({
        ...requestWithoutWorkspace,
        previousDraft: previousDraft
          ? (({
              imageUrl: _imageUrl,
              imageAvailable: _imageAvailable,
              ...draft
            }) => ({ ...draft, status: 'draft' as const }))(previousDraft)
          : null,
        imageTier,
      }),
      headers: workspaceId ? { 'X-Workspace-Id': workspaceId } : undefined,
      signal,
    })
    return z
      .string()
      .max(6_000_000)
      .refine(
        (value) =>
          /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ||
          /^https:\/\//.test(value),
      )
      .parse(result)
  },
  async generateBatch(request, signal) {
    const { workspaceId, ...contentRequest } = request
    const result = await apiRequest<unknown>('/content/generate-batch', {
      method: 'POST',
      body: JSON.stringify(contentRequest),
      headers: workspaceId ? { 'X-Workspace-Id': workspaceId } : undefined,
      signal,
    })
    const batchSchema = z
      .array(
        draftSchema.extend({
          format: contentFormatSchema,
          formatData: contentFormatDataSchema,
          persona: z.string().max(160),
          time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
          timezone: z.string().refine(isValidTimeZone),
        }),
      )
      .min(1)
      .max(42)
    const drafts = batchSchema.parse(result)
    const expected = new Set(
      request.dates.flatMap((date) =>
        request.platforms.map((platform) => `${date}|${platform}`),
      ),
    )
    const returned = new Set(
      drafts.map((draft) => `${draft.date}|${draft.platform}`),
    )
    if (
      drafts.length !== expected.size ||
      returned.size !== expected.size ||
      [...expected].some((key) => !returned.has(key)) ||
      drafts.some(
        (draft) =>
          draft.format !== request.format ||
          draft.time !== request.time ||
          draft.timezone !== request.timezone ||
          draft.persona !== request.persona,
      )
    ) {
      throw new Error('A geração não retornou todas as variações pedidas.')
    }
    return drafts
  },
}

export const generationService =
  import.meta.env.VITE_AI_MODE === 'demo' || import.meta.env.MODE === 'test'
    ? demoGenerationService
    : apiGenerationService
