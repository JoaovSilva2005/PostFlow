import type { Request, Response } from 'express'
import { environment } from '../../config/environment.js'
import type { AuthSession } from './authTypes.js'

export const AUTH_COOKIES = {
  access: 'postflow_access_token',
  refresh: 'postflow_refresh_token',
} as const

function parseCookies(header: string | undefined) {
  if (!header) return new Map<string, string>()

  return new Map(
    header.split(';').flatMap((part) => {
      const separator = part.indexOf('=')
      if (separator < 1) return []

      const name = part.slice(0, separator).trim()
      const value = part.slice(separator + 1).trim()
      return [[name, decodeURIComponent(value)] as const]
    }),
  )
}

export function readAccessToken(request: Request) {
  const authorization = request.header('authorization')

  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim() || null
  }

  return parseCookies(request.header('cookie')).get(AUTH_COOKIES.access) ?? null
}

export function readRefreshToken(request: Request) {
  return (
    parseCookies(request.header('cookie')).get(AUTH_COOKIES.refresh) ?? null
  )
}

export function setSessionCookies(response: Response, session: AuthSession) {
  const commonOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: environment.isProduction,
  }

  response.cookie(AUTH_COOKIES.access, session.accessToken, {
    ...commonOptions,
    maxAge: session.expiresIn * 1000,
    path: '/api',
  })
  response.cookie(AUTH_COOKIES.refresh, session.refreshToken, {
    ...commonOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  })
}

export function clearSessionCookies(response: Response) {
  const commonOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: environment.isProduction,
  }

  response.clearCookie(AUTH_COOKIES.access, {
    ...commonOptions,
    path: '/api',
  })
  response.clearCookie(AUTH_COOKIES.refresh, {
    ...commonOptions,
    path: '/api/auth',
  })
}
