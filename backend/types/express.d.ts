import type { AuthenticatedUser } from '../modules/auth/authTypes.js'
import type {
  PlatformRole,
  WorkspaceContext,
} from '../modules/tenancy/workspaceTypes.js'

declare module 'express-serve-static-core' {
  interface Request {
    accessToken?: string
    authUser?: AuthenticatedUser
    workspaceContext?: WorkspaceContext
    platformRole?: PlatformRole | null
  }
}
