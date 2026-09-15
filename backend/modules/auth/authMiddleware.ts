import type { RequestHandler } from 'express'
import { HttpError } from '../../shared/HttpError.js'
import { readAccessToken } from './authCookies.js'
import type { AuthService } from './authService.js'
import type { AppRole } from './authTypes.js'

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

export function requireRoles(
  service: AuthService,
  ...allowedRoles: AppRole[]
): RequestHandler {
  return (request, _response, next) => {
    if (!request.authUser) {
      next(new HttpError(401, 'Autenticação necessária.'))
      return
    }

    if (!service.canAccess(request.authUser.role, allowedRoles)) {
      next(new HttpError(403, 'Você não possui permissão para esta ação.'))
      return
    }

    next()
  }
}
