import type { AuthenticatedUser } from '../modules/auth/authTypes.js'

declare module 'express-serve-static-core' {
  interface Request {
    accessToken?: string
    authUser?: AuthenticatedUser
  }
}
