// @vitest-environment node
import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../shared/HttpError.js'
import { createInternalPublishingRouter } from './publishingRoutes.js'

const summary = { claimed: 2, published: 1, retried: 1, failed: 0 }

function buildApp(cronSecret: string) {
  const publishDue = vi.fn().mockResolvedValue(summary)
  const app = express()
  app.use('/api/internal', createInternalPublishingRouter({ publishDue }, cronSecret))
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = error instanceof HttpError ? error.statusCode : 500
      const message = error instanceof HttpError ? error.message : 'erro'
      response.status(status).json({ error: message })
    },
  )
  return { app, publishDue }
}

describe('POST /api/internal/publish-due', () => {
  it('rejects a missing Authorization header', async () => {
    const { app, publishDue } = buildApp('segredo-correto')
    const response = await request(app).post('/api/internal/publish-due')
    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: 'Não autorizado.' })
    expect(publishDue).not.toHaveBeenCalled()
  })

  it('rejects a wrong bearer secret', async () => {
    const { app, publishDue } = buildApp('segredo-correto')
    const response = await request(app)
      .post('/api/internal/publish-due')
      .set('Authorization', 'Bearer errado')
    expect(response.status).toBe(401)
    expect(publishDue).not.toHaveBeenCalled()
  })

  it('returns 503 when the secret is not configured', async () => {
    const { app, publishDue } = buildApp('')
    const response = await request(app)
      .post('/api/internal/publish-due')
      .set('Authorization', 'Bearer ')
    expect(response.status).toBe(503)
    expect(response.body).toEqual({ error: 'Agendador não configurado.' })
    expect(publishDue).not.toHaveBeenCalled()
  })

  it('runs the service with the correct secret', async () => {
    const { app, publishDue } = buildApp('segredo-correto')
    const response = await request(app)
      .post('/api/internal/publish-due')
      .set('Authorization', 'Bearer segredo-correto')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ data: summary })
    expect(publishDue).toHaveBeenCalledTimes(1)
  })
})
