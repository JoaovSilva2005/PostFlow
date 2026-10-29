import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { PlatformRole, WorkspaceRole } from '../domain/auth'
import { AccessDenied } from '../components/ui/AccessDenied'
import { useApp } from './AppContext'
import { SESSION_EXPIRED_MESSAGE } from '../services/apiClient'

interface ProtectedRouteProps {
  children: ReactNode
  platformRoles?: Exclude<PlatformRole, null>[]
  workspaceRoles?: WorkspaceRole[]
  requiresActivePlan?: boolean
}

export function ProtectedRoute({
  children,
  platformRoles,
  workspaceRoles,
  requiresActivePlan = false,
}: ProtectedRouteProps) {
  const location = useLocation()
  const {
    authStatus,
    authError,
    hasActivePlan,
    workspacesLoaded,
    currentWorkspace,
    isAuthenticated,
    platformRole,
  } = useApp()

  if (authStatus === 'checking') {
    return <div role="status">Verificando sua sessão...</div>
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
          sessionExpired: authError === SESSION_EXPIRED_MESSAGE,
        }}
      />
    )
  }

  if (
    platformRoles &&
    (!platformRole || !platformRoles.includes(platformRole))
  ) {
    return <AccessDenied />
  }

  if (
    workspaceRoles &&
    (!currentWorkspace || !workspaceRoles.includes(currentWorkspace.role))
  ) {
    return <AccessDenied />
  }

  if (requiresActivePlan && !workspacesLoaded && !hasActivePlan) {
    return <div role="status">Verificando sua assinatura...</div>
  }

  if (
    requiresActivePlan &&
    !hasActivePlan &&
    platformRole !== 'platform_owner'
  ) {
    return <Navigate to="/billing" replace />
  }

  return children
}
