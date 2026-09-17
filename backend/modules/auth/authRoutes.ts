import { Router } from 'express'
import { z } from 'zod'
import { environment } from '../../config/environment.js'
import { HttpError } from '../../shared/HttpError.js'
import {
  clearSessionCookies,
  readAccessToken,
  readRefreshToken,
  setSessionCookies,
} from './authCookies.js'
import { requireAuthentication } from './authMiddleware.js'
import type { AuthService } from './authService.js'
import type { WorkspaceAccessRepository } from '../tenancy/workspaceTypes.js'

const emailSchema = z.email('Digite um e-mail válido.').trim().toLowerCase()

const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(6, 'Use pelo menos 6 caracteres.')
    .max(128, 'A senha deve ter no máximo 128 caracteres.'),
})

const registerSchema = loginSchema.extend({
  displayName: z
    .string()
    .trim()
    .min(2, 'Informe seu nome.')
    .max(80, 'O nome deve ter no máximo 80 caracteres.'),
})

const recoverSchema = z.object({ email: emailSchema })

function validate<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value)

  if (!result.success) {
    throw new HttpError(
      400,
      result.error.issues[0]?.message ?? 'Dados inválidos.',
    )
  }

  return result.data
}

export function createAuthRouter(
  service: AuthService,
  workspaceAccess?: WorkspaceAccessRepository,
) {
  const router = Router()

  router.post('/login', async (request, response) => {
    const input = validate(loginSchema, request.body)
    const session = await service.login(input.email, input.password)

    setSessionCookies(response, session)
    response.json({ data: { user: session.user } })
  })

  router.post('/register', async (request, response) => {
    const input = validate(registerSchema, request.body)
    const result = await service.register(
      input.displayName,
      input.email,
      input.password,
    )

    if (result.session) setSessionCookies(response, result.session)
    response.status(201).json({
      data: {
        user: result.user,
        requiresEmailConfirmation: !result.session,
      },
    })
  })

  router.post('/recover', async (request, response) => {
    const { email } = validate(recoverSchema, request.body)
    await service.recoverPassword(email, environment.passwordResetUrl)
    response.json({
      data: {
        message:
          'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.',
      },
    })
  })

  router.post('/refresh', async (request, response) => {
    const refreshToken = readRefreshToken(request)

    if (!refreshToken) {
      throw new HttpError(401, 'Sessão não pode ser renovada.')
    }

    const session = await service.refresh(refreshToken)
    setSessionCookies(response, session)
    response.json({ data: { user: session.user } })
  })

  router.post('/logout', async (request, response) => {
    await service.logout(readAccessToken(request))
    clearSessionCookies(response)
    response.status(204).send()
  })

  router.get(
    '/me',
    requireAuthentication(service),
    async (request, response) => {
      const user = request.authUser!
      const workspace = workspaceAccess
        ? await workspaceAccess.getDefaultWorkspace(user.id)
        : null
      const platformRole = workspaceAccess
        ? await workspaceAccess.getPlatformRole(user.id)
        : null
      response.json({
        data: {
          user,
          workspace: workspace
            ? { id: workspace.workspaceId, role: workspace.role }
            : null,
          platformRole,
        },
      })
    },
  )

  return router
}
