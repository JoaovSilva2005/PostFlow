import { Navigate, Route, Routes } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { BrandPage } from '../features/brand/BrandPage'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { ChatPage } from '../features/content/ChatPage'
import { FinancePage } from '../features/finance/FinancePage'
import { FiscalPage } from '../features/fiscal/FiscalPage'
import { BillingPage } from '../features/billing/BillingPage'
import { AdminPlansPage } from '../features/admin/AdminPlansPage'
import { ProtectedRoute } from './ProtectedRoute'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/brand"
        element={
          <ProtectedRoute
            workspaceRoles={['owner', 'admin', 'editor', 'viewer']}
            requiresActivePlan
          >
            <BrandPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/new"
        element={
          <ProtectedRoute
            workspaceRoles={['owner', 'admin', 'editor', 'viewer']}
            requiresActivePlan
          >
            <BrandPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute
            workspaceRoles={['owner', 'admin', 'editor', 'viewer']}
            requiresActivePlan
          >
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute
            workspaceRoles={['owner', 'admin', 'editor', 'viewer']}
            requiresActivePlan
          >
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute
            workspaceRoles={['owner', 'admin', 'editor', 'viewer']}
          >
            <BillingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance"
        element={
          <ProtectedRoute
            platformRoles={['platform_owner', 'finance_admin', 'support']}
          >
            <FinancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fiscal"
        element={
          <ProtectedRoute
            platformRoles={['platform_owner', 'finance_admin', 'support']}
          >
            <FiscalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/plans"
        element={
          <ProtectedRoute
            platformRoles={['platform_owner', 'finance_admin', 'support']}
          >
            <AdminPlansPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance"
        element={<Navigate to="/admin/finance" replace />}
      />
      <Route path="/fiscal" element={<Navigate to="/admin/fiscal" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
