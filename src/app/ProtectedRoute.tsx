import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { PlatformRole, WorkspaceRole } from '../domain/auth'
import { AccessDenied } from '../components/ui/AccessDenied'
import { useApp } from './AppContext'

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
    billingStatus,
    currentWorkspace,
    isAuthenticated,
    platformRole,
  } = useApp()

  if (authStatus === 'checking') {
    return <div role="status">Verificando sua sessão...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
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

  const hasActivePlan =
    billingStatus === 'active' || billingStatus === 'trialing'
  if (
    requiresActivePlan &&
    !hasActivePlan &&
    platformRole !== 'platform_owner'
  ) {
    return <Navigate to="/billing" replace />
  }

  return children
}
