import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { SOCIAL_PROVIDERS } from '../../../shared/domain/socialPublishing.js'
import { HttpError } from '../../shared/HttpError.js'
import { matchesSecret } from './socialCrypto.js'
import { SocialService } from './socialService.js'

const providerSchema = z.enum(SOCIAL_PROVIDERS)
const createSchema = z
  .object({
    draftId: z.uuid(),
    connectionId: z.uuid(),
    scheduledAt: z.iso.datetime({ offset: true }).optional(),
    consent: z.literal(true),
    expectedDraft: z
      .object({
        title: z.string().max(240),
        caption: z.string().max(5000),
        hashtags: z.array(z.string().max(120)).max(30),
        imageUrl: z.string().max(4096),
      })
      .strict(),
    tiktok: z
      .object({
        privacyLevel: z.string().min(1).max(80),
        disableComment: z.boolean(),
        isAiGenerated: z.boolean(),
        brandContentToggle: z.boolean(),
        brandOrganicToggle: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict()
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new HttpError(400, 'Revise os campos e confirme a publicação.')
  return result.data
}
function context(request: Parameters<RequestHandler>[0]) {
  if (!request.authUser || !request.workspaceContext)
    throw new HttpError(401, 'Autenticação e marca necessárias.')
  return {
    workspaceId: request.workspaceContext.workspaceId,
    userId: request.authUser.id,
  }
}
export function createSocialWorkspaceRouter(
  service: SocialService,
  manage: RequestHandler,
  publish: RequestHandler,
) {
  const router = Router({ mergeParams: true })
  router.get('/overview', async (request, response) => {
    const c = context(request)
    response.json({ data: await service.overview(c.workspaceId, c.userId) })
  })
  router.post('/oauth/:provider', manage, async (request, response) => {
    const c = context(request)
    response.json({
      data: await service.startOAuth(
        c.workspaceId,
        c.userId,
        parse(providerSchema, request.params.provider),
      ),
    })
  })
  router.post('/connections', manage, async (request, response) => {
    const c = context(request),
      body = parse(
        z
          .object({
            sessionId: z.uuid(),
            externalAccountId: z.string().min(1).max(240),
          })
          .strict(),
        request.body,
      )
    response
      .status(201)
      .json({
        data: await service.connect(
          c.workspaceId,
          c.userId,
          body.sessionId,
          body.externalAccountId,
        ),
      })
  })
  router.delete('/connections/:id', manage, async (request, response) => {
    const c = context(request)
    await service.disconnect(c.workspaceId, parse(z.uuid(), request.params.id))
    response.sendStatus(204)
  })
  router.get(
    '/connections/:id/creator-info',
    publish,
    async (request, response) => {
      const c = context(request)
      response.json({
        data: await service.creatorInfo(
          c.workspaceId,
          parse(z.uuid(), request.params.id),
        ),
      })
    },
  )
  router.post('/publications', publish, async (request, response) => {
    const c = context(request)
    response
      .status(202)
      .json({
        data: await service.enqueue(
          c.workspaceId,
          c.userId,
          parse(createSchema, request.body),
        ),
      })
  })
  router.post(
    '/publications/:id/cancel',
    publish,
    async (request, response) => {
      const c = context(request)
      response.json({
        data: await service.cancel(
          c.workspaceId,
          parse(z.uuid(), request.params.id),
        ),
      })
    },
  )
  return router
}
export function createSocialPublicRouter(
  service: SocialService,
  authentication: RequestHandler,
) {
  const router = Router()
  router.get(
    '/oauth/:provider/callback',
    authentication,
    async (request, response) => {
      const provider = parse(providerSchema, request.params.provider)
      const state = parse(z.string().min(20).max(256), request.query.state)
      const code =
        typeof request.query.code === 'string' ? request.query.code : undefined
      try {
        const workspaceId = await service.callback(
          request.authUser!.id,
          provider,
          state,
          code,
        )
        response.setHeader('Cache-Control', 'no-store')
        response.redirect(
          `${service.appUrl}/social?oauth=connected&workspace=${encodeURIComponent(workspaceId)}`,
        )
      } catch (error) {
        if (error instanceof HttpError && [400, 403].includes(error.statusCode))
          throw error
        response.redirect(`${service.appUrl}/social?oauth=error`)
      }
    },
  )
  router.get('/media/:id/:token/image.jpg', async (request, response) => {
    const bytes = await service.media(
      parse(z.uuid(), request.params.id),
      parse(z.string().max(150), request.params.token),
    )
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.type('image/jpeg').send(Buffer.from(bytes))
  })
  router.post('/worker', async (request, response) => {
    const supplied = (request.header('authorization') ?? '').replace(
      /^Bearer /,
      '',
    )
    if (!matchesSecret(supplied, process.env.SOCIAL_CRON_SECRET))
      throw new HttpError(401, 'Executor não autorizado.')
    response.setHeader('Cache-Control', 'no-store')
    response.json({ data: await service.runWorker() })
  })
  return router
}
