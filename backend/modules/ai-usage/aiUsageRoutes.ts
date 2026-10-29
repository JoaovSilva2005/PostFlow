import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { HttpError } from '../../shared/HttpError.js'
import type { AiUsageService } from './aiUsageService.js'

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

const allowRead: RequestHandler = (_request, _response, next) => next()

export function createAiUsageRouter(
  service: AiUsageService,
  authorizeRead: RequestHandler = allowRead,
) {
  const router = Router()

  router.get('/monthly', authorizeRead, async (request, response) => {
    const parsed = monthSchema.safeParse(request.query.month)
    if (!parsed.success) {
      throw new HttpError(400, 'Informe o mês no formato AAAA-MM.')
    }
    response.json({ data: await service.monthlyReport(parsed.data) })
  })

  return router
}
