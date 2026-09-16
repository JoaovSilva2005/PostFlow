import { Navigate, Route, Routes } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { BrandPage } from '../features/brand/BrandPage'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { ChatPage } from '../features/content/ChatPage'
import { FinancePage } from '../features/finance/FinancePage'
import { FiscalPage } from '../features/fiscal/FiscalPage'
import { ProtectedRoute } from './ProtectedRoute'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/brand"
        element={
          <ProtectedRoute>
            <BrandPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance"
        element={
          <ProtectedRoute>
            <FinancePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
      <Route
        path="/fiscal"
        element={
          <ProtectedRoute>
            <FiscalPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
