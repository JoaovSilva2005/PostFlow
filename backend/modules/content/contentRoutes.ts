import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { HttpError } from '../../shared/HttpError.js'
import type { ContentService } from './contentService.js'
import type { ContentUsageReporter } from '../ai-usage/aiUsageTypes.js'
import type { AiUsageService } from '../ai-usage/aiUsageService.js'
import {
  CONTENT_PLATFORMS,
  type BatchContentGenerationInput,
  type ContentGenerationInput,
} from './contentTypes.js'
import {
  CONTENT_FORMATS,
  contentFormatDataSchema,
} from '../../../shared/domain/contentFormats.js'
import type { ContentQuotaService, ContentQuotaUnits } from './contentQuota.js'
import {
  DEFAULT_POST_TIMEZONE,
  dateTimePartsInZone,
  isValidTimeZone,
} from '../../../shared/domain/contentTime.js'

const generatedDraftSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(3).max(160),
  caption: z.string().trim().min(1).max(5000),
  hashtags: z.array(z.string().regex(/^#[^\s#]+$/)).max(30),
  platform: z.enum(CONTENT_PLATFORMS),
  date: z.iso.date(),
  status: z.literal('draft'),
  visualText: z.string().trim().min(1).max(160),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  format: z.enum(CONTENT_FORMATS).optional(),
  formatData: contentFormatDataSchema.optional(),
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

const brandContextSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    segment: z.string().trim().max(160),
    toneOfVoice: z.string().trim().max(120),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    colorPalette: z
      .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
      .min(1)
      .max(5)
      .optional(),
    description: z.string().trim().max(600).optional(),
    targetAudience: z.string().trim().max(400).optional(),
    productsOrServices: z.string().trim().max(600).optional(),
    differentials: z.string().trim().max(400).optional(),
    contentGoals: z.string().trim().max(400).optional(),
    keywords: z.string().trim().max(300).optional(),
    avoidTopics: z.string().trim().max(300).optional(),
    defaultCta: z.string().trim().max(180).optional(),
  })
  .strict()

const requestSchema = z
  .object({
    prompt: z.string().trim().min(3).max(4000),
    platform: z.enum(CONTENT_PLATFORMS),
    date: z.iso.date(),
    brand: brandContextSchema.nullable(),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().trim().min(1).max(5000),
        }),
      )
      .max(12),
    previousDraft: generatedDraftSchema.nullable(),
    imageTier: z.enum(['standard', 'quality']).default('standard'),
    format: z.enum(CONTENT_FORMATS).optional(),
    formatData: contentFormatDataSchema.optional(),
  })
  .strict()

const batchRequestSchema = z
  .object({
    prompt: z.string().trim().min(3).max(2000),
    dates: z
      .array(z.iso.date())
      .min(1)
      .max(7)
      .refine((dates) => new Set(dates).size === dates.length),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    timezone: z.string().refine(isValidTimeZone).default(DEFAULT_POST_TIMEZONE),
    format: z.enum(CONTENT_FORMATS),
    persona: z.string().trim().max(160).default(''),
    platforms: z
      .array(z.enum(CONTENT_PLATFORMS))
      .min(1)
      .max(CONTENT_PLATFORMS.length)
      .refine((platforms) => new Set(platforms).size === platforms.length),
    brand: brandContextSchema.nullable(),
  })
  .strict()

const allowGeneration: RequestHandler = (_request, _response, next) => next()

function requestWorkspaceId(request: Parameters<RequestHandler>[0]) {
  const workspaceId = request.workspaceContext?.workspaceId
  if (!workspaceId) throw new HttpError(400, 'Contexto de workspace ausente.')
  return workspaceId
}

function requestBillingWorkspaceId(
  request: Parameters<RequestHandler>[0],
) {
  return request.billingWorkspaceId ?? requestWorkspaceId(request)
}

async function generateWithReservation<T>(
  quota: ContentQuotaService,
  workspaceId: string,
  units: ContentQuotaUnits,
  generate: () => Promise<T>,
) {
  const reservationId = await quota.reserve(workspaceId, units)
  let result: T
  try {
    result = await generate()
  } catch (generationError) {
    try {
      await quota.settle(reservationId, false)
    } catch {
      throw new HttpError(
        503,
        'A geração falhou e a reserva da franquia não pôde ser liberada. Tente novamente.',
      )
    }
    throw generationError
  }

  await quota.settle(reservationId, true)
  return result
}

export function createContentRouter(
  service: ContentService,
  quota: ContentQuotaService,
  authorizeGeneration: RequestHandler = allowGeneration,
  aiUsage?: AiUsageService,
) {
  const router = Router()

  function usageReporter(
    request: Parameters<RequestHandler>[0],
    generationId: string,
    draftCount: number,
  ): ContentUsageReporter | undefined {
    if (!aiUsage || !request.authUser) return undefined
    const user = request.authUser
    const workspaceId = requestBillingWorkspaceId(request)

    return async (usage) => {
      try {
        await aiUsage.record({
          ...usage,
          generationId,
          userId: user.id,
          userEmail: user.email,
          userDisplayName: user.displayName,
          workspaceId,
          draftCount:
            usage.operation === 'text_generation' ? draftCount : 0,
          occurredAt: new Date().toISOString(),
        })
      } catch (error) {
        console.error('Não foi possível registrar o custo de IA.', {
          generationId,
          operation: usage.operation,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        })
      }
    }
  }

  router.post('/generate', authorizeGeneration, async (request, response) => {
    const parsed = requestSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? 'Pedido de conteúdo inválido.',
      )
    }

    const abortController = new AbortController()
    const abortIfDisconnected = () => {
      if (!response.writableEnded) abortController.abort()
    }
    const onRequestClose = () => {
      if (!request.complete) abortIfDisconnected()
    }

    request.once('aborted', abortIfDisconnected)
    request.once('close', onRequestClose)
    response.once('close', abortIfDisconnected)

    try {
      const generationId = crypto.randomUUID()
      response.json({
        data: await generateWithReservation(
          quota,
          requestBillingWorkspaceId(request),
          { text: 1, image: 1 },
          () =>
            service.generate(
              parsed.data as ContentGenerationInput,
              abortController.signal,
              usageReporter(request, generationId, 1),
            ),
        ),
      })
    } finally {
      request.off('aborted', abortIfDisconnected)
      request.off('close', onRequestClose)
      response.off('close', abortIfDisconnected)
    }
  })

  router.post(
    '/generate-image',
    authorizeGeneration,
    async (request, response) => {
      const parsed = requestSchema.safeParse(request.body)
      if (!parsed.success) {
        throw new HttpError(
          400,
          parsed.error.issues[0]?.message ?? 'Pedido de imagem inválido.',
        )
      }
      if (!parsed.data.previousDraft) {
        throw new HttpError(400, 'Selecione um rascunho para gerar a imagem.')
      }

      const abortController = new AbortController()
      const abortIfDisconnected = () => {
        if (!response.writableEnded) abortController.abort()
      }
      const onRequestClose = () => {
        if (!request.complete) abortIfDisconnected()
      }

      request.once('aborted', abortIfDisconnected)
      request.once('close', onRequestClose)
      response.once('close', abortIfDisconnected)

      try {
        const generationId = crypto.randomUUID()
        response.json({
          data: await generateWithReservation(
            quota,
            requestBillingWorkspaceId(request),
            { text: 0, image: 1 },
            () =>
              service.generateImage(
                parsed.data as ContentGenerationInput,
                abortController.signal,
                usageReporter(request, generationId, 0),
              ),
          ),
        })
      } finally {
        request.off('aborted', abortIfDisconnected)
        request.off('close', onRequestClose)
        response.off('close', abortIfDisconnected)
      }
    },
  )

  router.post(
    '/generate-batch',
    authorizeGeneration,
    async (request, response) => {
      const parsed = batchRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        throw new HttpError(
          400,
          parsed.error.issues[0]?.message ?? 'Pedido de conteúdo inválido.',
        )
      }
      const today =
        dateTimePartsInZone(new Date(), parsed.data.timezone)?.date ??
        new Date().toISOString().slice(0, 10)
      if (parsed.data.dates.some((date) => date < today)) {
        throw new HttpError(
          400,
          'Escolha hoje ou uma data futura para os rascunhos.',
        )
      }

      const items = parsed.data.dates.flatMap((date, dateIndex) =>
        parsed.data.platforms.map((platform, platformIndex) => ({
          key: String(dateIndex * parsed.data.platforms.length + platformIndex),
          date,
          platform,
        })),
      )
      const abortController = new AbortController()
      const abortIfDisconnected = () => {
        if (!response.writableEnded) abortController.abort()
      }
      const onRequestClose = () => {
        if (!request.complete) abortIfDisconnected()
      }

      request.once('aborted', abortIfDisconnected)
      request.once('close', onRequestClose)
      response.once('close', abortIfDisconnected)
      try {
        const generationId = crypto.randomUUID()
        response.json({
          data: await generateWithReservation(
            quota,
            requestBillingWorkspaceId(request),
            { text: items.length, image: 0 },
            () =>
              service.generateBatch(
                { ...parsed.data, items } as BatchContentGenerationInput,
                abortController.signal,
                usageReporter(request, generationId, items.length),
              ),
          ),
        })
      } finally {
        request.off('aborted', abortIfDisconnected)
        request.off('close', onRequestClose)
        response.off('close', abortIfDisconnected)
      }
    },
  )

  return router
}
