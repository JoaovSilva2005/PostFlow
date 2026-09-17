import type { RequestHandler } from 'express'
import { HttpError } from '../../shared/HttpError.js'
import type { WorkspaceAccessRepository } from './workspaceTypes.js'
import type { PlatformRole, WorkspaceRole } from './workspaceTypes.js'

function workspaceIdFromRequest(request: Parameters<RequestHandler>[0]) {
  const param = request.params.workspaceId
  const header = request.header('x-workspace-id')
  return typeof param === 'string' ? param : header
}

export function requireWorkspaceContext(
  repository: WorkspaceAccessRepository,
  testFallbackWorkspaceId?: string,
): RequestHandler {
  return async (request, _response, next) => {
    try {
      if (!request.authUser)
        throw new HttpError(401, 'Autenticação necessária.')
      const workspaceId =
        workspaceIdFromRequest(request) ?? testFallbackWorkspaceId
      if (!workspaceId) {
        throw new HttpError(400, 'Informe o workspace em X-Workspace-Id.')
      }
      const membership = await repository.getMembership(
        request.authUser.id,
        workspaceId,
      )
      if (!membership)
        throw new HttpError(403, 'Você não possui acesso a este workspace.')
      request.workspaceContext = {
        workspaceId: membership.workspaceId,
        role: membership.role,
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function requireWorkspaceRole(
  ...roles: WorkspaceRole[]
): RequestHandler {
  return (request, _response, next) => {
    if (!request.workspaceContext)
      return next(new HttpError(400, 'Contexto de workspace ausente.'))
    if (!roles.includes(request.workspaceContext.role)) {
      return next(
        new HttpError(403, 'Você não possui permissão para esta ação.'),
      )
    }
    next()
  }
}

export function requirePlatformRole(
  repository: WorkspaceAccessRepository,
  ...roles: PlatformRole[]
): RequestHandler {
  return async (request, _response, next) => {
    try {
      if (!request.authUser)
        throw new HttpError(401, 'Autenticação necessária.')
      const role = await repository.getPlatformRole(request.authUser.id)
      request.platformRole = role
      if (!role || !roles.includes(role)) {
        throw new HttpError(
          403,
          'Você não possui permissão de plataforma para esta ação.',
        )
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
