import { createHash, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { HttpError } from '../../shared/HttpError.js'
import type { PublishingService } from './publishingService.js'

function secretsMatch(provided: string, expected: string) {
  // Comparar hashes SHA-256 garante buffers de mesmo tamanho.
  const providedDigest = createHash('sha256').update(provided).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}

export function createInternalPublishingRouter(
  service: Pick<PublishingService, 'publishDue'>,
  cronSecret: string,
) {
  const router = Router()

  router.post('/publish-due', async (request, response, next) => {
    try {
      if (!cronSecret) throw new HttpError(503, 'Agendador não configurado.')

      const header = request.header('authorization') ?? ''
      const match = /^Bearer (.+)$/.exec(header)
      if (!match || !secretsMatch(match[1], cronSecret)) {
        throw new HttpError(401, 'Não autorizado.')
      }

      response.json({ data: await service.publishDue() })
    } catch (error) {
      next(error)
    }
  })

  return router
}
