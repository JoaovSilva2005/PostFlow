// @vitest-environment node
import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { HttpError } from '../../shared/HttpError.js'
import type { AiUsageRepository } from './aiUsageRepository.js'
import { AiUsageService } from './aiUsageService.js'
import { createAiUsageRouter } from './aiUsageRoutes.js'

function createTestApp(months: string[]) {
  const repository: AiUsageRepository = {
    insert: async () => undefined,
    monthlyReport: async (monthStart) => {
      months.push(monthStart)
      return []
    },
  }
  const service = new AiUsageService(repository)
  const authorizeRead: RequestHandler = (request, _response, next) => {
    if (request.header('x-test-admin') !== 'true') {
      next(new HttpError(403, 'Acesso administrativo necessário.'))
      return
    }
    next()
  }
  const app = express()
  app.use('/api/admin/ai-usage', createAiUsageRouter(service, authorizeRead))
  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    response.status(error instanceof HttpError ? error.statusCode : 500).json({
      error: error instanceof Error ? error.message : 'Erro interno.',
    })
  }
  app.use(errorHandler)
  return app
}

describe('API de custos de IA', () => {
  it('exige autorização administrativa para consultar o relatório', async () => {
    const response = await request(createTestApp([])).get(
      '/api/admin/ai-usage/monthly?month=2026-09',
    )

    expect(response.status).toBe(403)
  })

  it('valida o mês informado e encaminha o primeiro dia ao repositório', async () => {
    const months: string[] = []
    const app = createTestApp(months)
    const invalid = await request(app)
      .get('/api/admin/ai-usage/monthly?month=2026-13')
      .set('x-test-admin', 'true')

    expect(invalid.status).toBe(400)

    const response = await request(app)
      .get('/api/admin/ai-usage/monthly?month=2026-09')
      .set('x-test-admin', 'true')

    expect(response.status).toBe(200)
    expect(months).toEqual(['2026-09-01'])
    expect(response.body.data).toMatchObject({
      month: '2026-09',
      users: [],
    })
  })
})
