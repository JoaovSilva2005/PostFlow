import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { PlatformRole, WorkspaceRole } from '../domain/auth'
import { AccessDenied } from '../components/ui/AccessDenied'
import { useApp } from './AppContext'

interface ProtectedRouteProps {
  children: ReactNode
  platformRoles?: Exclude<PlatformRole, null>[]
  workspaceRoles?: WorkspaceRole[]
}

export function ProtectedRoute({
  children,
  platformRoles,
  workspaceRoles,
}: ProtectedRouteProps) {
  const location = useLocation()
  const { authStatus, currentWorkspace, isAuthenticated, platformRole } =
    useApp()

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

  return children
}
