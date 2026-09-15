import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useApp } from './AppContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { authStatus, isAuthenticated } = useApp()

  if (authStatus === 'checking') {
    return <div role="status">Verificando sua sessão...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
