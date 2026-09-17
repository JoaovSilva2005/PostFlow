import type { RequestHandler } from 'express'
import { HttpError } from '../../shared/HttpError.js'
import { readAccessToken } from './authCookies.js'
import type { AuthService } from './authService.js'

export function requireAuthentication(service: AuthService): RequestHandler {
  return async (request, _response, next) => {
    try {
      const accessToken = readAccessToken(request)

      if (!accessToken) {
        throw new HttpError(401, 'Autenticação necessária.')
      }

      request.authUser = await service.authenticate(accessToken)
      request.accessToken = accessToken
      next()
    } catch (error) {
      next(error)
    }
  }
}
