import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useApp } from './AppContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { isAuthenticated } = useApp()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
