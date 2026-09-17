import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { HttpError } from '../../shared/HttpError.js'
import type { ContentService } from './contentService.js'
import { CONTENT_PLATFORMS } from './contentTypes.js'

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
})

const requestSchema = z
  .object({
    prompt: z.string().trim().min(3).max(4000),
    platform: z.enum(CONTENT_PLATFORMS),
    date: z.iso.date(),
    brand: z
      .object({
        name: z.string().trim().min(2).max(120),
        segment: z.string().trim().max(160),
        toneOfVoice: z.string().trim().max(120),
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      })
      .nullable(),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().trim().min(1).max(5000),
        }),
      )
      .max(12),
    previousDraft: generatedDraftSchema.nullable(),
  })
  .strict()

const allowGeneration: RequestHandler = (_request, _response, next) => next()

export function createContentRouter(
  service: ContentService,
  authorizeGeneration: RequestHandler = allowGeneration,
) {
  const router = Router()

  router.post('/generate', authorizeGeneration, async (request, response) => {
    const parsed = requestSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? 'Pedido de conteúdo inválido.',
      )
    }

    response.json({ data: await service.generate(parsed.data) })
  })

  return router
}
